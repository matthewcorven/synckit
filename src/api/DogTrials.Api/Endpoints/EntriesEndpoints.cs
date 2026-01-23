using DogTrials.Api.Data;
using DogTrials.Api.Dtos;
using DogTrials.Api.Entities;
using DogTrials.Api.Options;
using DogTrials.Api.Security;
using DogTrials.Api.Services;
using Microsoft.EntityFrameworkCore;
using System.Diagnostics;
using System.Text.Json;

namespace DogTrials.Api.Endpoints;

public static class EntriesEndpoints
{
    public static IEndpointRouteBuilder MapEntriesEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/entries")
            .RequireAuthorization(AuthPolicies.Handler);

        group.MapPost("", async (
            EntryCreateRequestDto request,
            HttpContext context,
            DogTrialsDbContext dbContext,
            ILogger<Program> logger) =>
        {
            using var activitySource = new ActivitySource(HealthEndpoints.ActivitySourceName);
            using var activity = activitySource.StartActivity("Entry.CreateDraft");
            activity?.SetTag("trial.id", request.TrialId.ToString());

            var userId = context.GetUserId();

            // Validate trial exists and is active
            var trial = await dbContext.Trials
                .Where(t => t.TrialId == request.TrialId && t.IsActive)
                .Select(t => new { t.TrialId })
                .FirstOrDefaultAsync();

            if (trial is null)
            {
                return Results.Problem(
                    title: "Trial not found or not active",
                    statusCode: StatusCodes.Status400BadRequest,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errorCode"] = "TRIAL_NOT_FOUND",
                        ["errors"] = new Dictionary<string, string[]>
                        {
                            ["trialId"] = new[] { "Trial not found or not active." }
                        }
                    });
            }

            // If the user already has a submitted entry for this trial -> conflict
            var hasSubmitted = await dbContext.Entries
                .AnyAsync(e => e.TrialId == request.TrialId && e.CreatedByUserId == userId && e.Status == EntryStatus.Submitted);

            if (hasSubmitted)
            {
                return Results.Problem(
                    title: "Entry already submitted",
                    statusCode: StatusCodes.Status409Conflict,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errorCode"] = "ENTRY_ALREADY_SUBMITTED"
                    });
            }

            // If a draft already exists for this user + trial, return it (idempotent)
            var existingDraft = await dbContext.Entries
                .Where(e => e.TrialId == request.TrialId && e.CreatedByUserId == userId && e.Status == EntryStatus.Draft)
                .Select(e => new { e.EntryId })
                .FirstOrDefaultAsync();

            if (existingDraft is not null)
            {
                activity?.SetTag("entry.id", existingDraft.EntryId.ToString());
                activity?.SetTag("entry.status", "Draft");

                return Results.Ok(new EntryCreateResponseDto(existingDraft.EntryId, "Draft"));
            }

            var entry = new Entry
            {
                EntryId = Guid.NewGuid(),
                TrialId = request.TrialId,
                CreatedByUserId = userId,
                Status = EntryStatus.Draft,
                PdfStatus = PdfStatus.Queued,
                CreatedAtUtc = DateTime.UtcNow
            };

            dbContext.Entries.Add(entry);
            await dbContext.SaveChangesAsync();

            activity?.SetTag("entry.id", entry.EntryId.ToString());
            activity?.SetTag("entry.status", "Draft");

            logger.LogInformation("Draft entry created: {EntryId} for trial {TrialId}", entry.EntryId, request.TrialId);

            return Results.Created($"/api/entries/{entry.EntryId}", new EntryCreateResponseDto(entry.EntryId, "Draft"));
        })
        .WithName("Entries_CreateDraft");

        group.MapGet("/{entryId:guid}", async (
            Guid entryId,
            HttpContext context,
            DogTrialsDbContext dbContext) =>
        {
            var userId = context.GetUserId();

            var entry = await dbContext.Entries
                .AsNoTracking()
                .Include(e => e.Trial)
                .Include(e => e.Notifications)
                .Where(e => e.EntryId == entryId)
                .FirstOrDefaultAsync();

            if (entry is null)
            {
                return Results.Problem(
                    title: "Entry not found",
                    statusCode: StatusCodes.Status404NotFound,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errorCode"] = "ENTRY_NOT_FOUND"
                    });
            }

            if (entry.CreatedByUserId != userId)
            {
                return Results.Problem(
                    title: "Access denied",
                    statusCode: StatusCodes.Status403Forbidden,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errorCode"] = "ENTRY_FORBIDDEN"
                    });
            }

            Activity.Current?.SetTag("entry.id", entry.EntryId.ToString());

            return Results.Ok(entry.ToDetailDto());
        })
        .WithName("Entries_GetById");

        group.MapPut("/{entryId:guid}", async (
            Guid entryId,
            HttpContext context,
            DogTrialsDbContext dbContext,
            ILogger<Program> logger) =>
        {
            using var activitySource = new ActivitySource(HealthEndpoints.ActivitySourceName);
            using var activity = activitySource.StartActivity("Entry.Update");
            activity?.SetTag("entry.id", entryId.ToString());

            var userId = context.GetUserId();

            var entry = await dbContext.Entries
                .Include(e => e.Trial)
                .Include(e => e.Notifications)
                .Where(e => e.EntryId == entryId)
                .FirstOrDefaultAsync();

            if (entry is null)
            {
                return Results.Problem(
                    title: "Entry not found",
                    statusCode: StatusCodes.Status404NotFound,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errorCode"] = "ENTRY_NOT_FOUND"
                    });
            }

            if (entry.CreatedByUserId != userId)
            {
                return Results.Problem(
                    title: "Access denied",
                    statusCode: StatusCodes.Status403Forbidden,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errorCode"] = "ENTRY_FORBIDDEN"
                    });
            }

            if (entry.Status != EntryStatus.Draft)
            {
                return Results.Problem(
                    title: "Entry already submitted",
                    statusCode: StatusCodes.Status409Conflict,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errorCode"] = "ENTRY_ALREADY_SUBMITTED"
                    });
            }

            if (!context.Request.Headers.TryGetValue("If-Match", out var ifMatchValues) || ifMatchValues.Count == 0)
            {
                return Results.Problem(
                    title: "ETag required",
                    statusCode: StatusCodes.Status412PreconditionFailed,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errorCode"] = "ETAG_REQUIRED"
                    });
            }

            var providedHeader = ifMatchValues.ToString();
            if (string.IsNullOrWhiteSpace(providedHeader))
            {
                return Results.Problem(
                    title: "ETag required",
                    statusCode: StatusCodes.Status412PreconditionFailed,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errorCode"] = "ETAG_REQUIRED"
                    });
            }

            var currentEtag = NormalizeEtag(GetEtag(entry.RowVersion));
            var providedEtag = NormalizeEtag(providedHeader);

            if (!string.Equals(currentEtag, providedEtag, StringComparison.Ordinal))
            {
                return Results.Problem(
                    title: "ETag mismatch",
                    statusCode: StatusCodes.Status412PreconditionFailed,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errorCode"] = "ETAG_MISMATCH"
                    });
            }

            using var document = await JsonDocument.ParseAsync(context.Request.Body);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                return Results.Problem(
                    title: "Invalid request",
                    statusCode: StatusCodes.Status400BadRequest);
            }

            var errors = new Dictionary<string, string[]>();
            var anyUpdates = false;

            if (TryGetObject(document.RootElement, "dog", "dog", errors, out var dog))
            {
                ApplyStringUpdate(dog, "ascaRegistrationNumber", "dog.ascaRegistrationNumber", errors, v => entry.RegistrationOrTrackingNumber = v, ref anyUpdates);
                ApplyStringUpdate(dog, "breed", "dog.breed", errors, v => entry.DogBreed = v, ref anyUpdates);
                ApplyStringUpdate(dog, "registeredName", "dog.registeredName", errors, v => entry.DogRegisteredName = v, ref anyUpdates);
                ApplyDateUpdate(dog, "dob", "dog.dob", errors, v => entry.DogDob = v, ref anyUpdates);
                ApplyStringUpdate(dog, "color", "dog.color", errors, v => entry.DogColor = v, ref anyUpdates);
                ApplyStringUpdate(dog, "callName", "dog.callName", errors, v => entry.DogCallName = v, ref anyUpdates);
                ApplyStringUpdate(dog, "sex", "dog.sex", errors, v => entry.DogSex = v, ref anyUpdates);
                ApplyStringUpdate(dog, "sire", "dog.sire", errors, v => entry.DogSire = v, ref anyUpdates);
                ApplyStringUpdate(dog, "dam", "dog.dam", errors, v => entry.DogDam = v, ref anyUpdates);
                ApplyStringUpdate(dog, "breeders", "dog.breeders", errors, v => entry.DogBreeders = v, ref anyUpdates);
            }

            if (TryGetObject(document.RootElement, "contact", "contact", errors, out var contact))
            {
                ApplyStringUpdate(contact, "owners", "contact.owners", errors, v => entry.ContactOwners = v, ref anyUpdates);
                ApplyStringUpdate(contact, "email", "contact.email", errors, v => entry.ContactEmail = v, ref anyUpdates);
                ApplyStringUpdate(contact, "phone", "contact.phone", errors, v => entry.ContactPhone = v, ref anyUpdates);
                ApplyStringUpdate(contact, "handler", "contact.handler", errors, v => entry.ContactHandler = v, ref anyUpdates);
                ApplyStringUpdate(contact, "membershipNumber", "contact.membershipNumber", errors, v => entry.ContactMembershipNumber = v, ref anyUpdates);

                if (TryGetObject(contact, "ownerAddress", "contact.ownerAddress", errors, out var address))
                {
                    ApplyStringUpdate(address, "street", "contact.ownerAddress.street", errors, v => entry.ContactStreet = v, ref anyUpdates);
                    ApplyStringUpdate(address, "city", "contact.ownerAddress.city", errors, v => entry.ContactCity = v, ref anyUpdates);
                    ApplyStringUpdate(address, "state", "contact.ownerAddress.state", errors, v => entry.ContactState = v, ref anyUpdates);
                    ApplyStringUpdate(address, "zip", "contact.ownerAddress.zip", errors, v => entry.ContactZip = v, ref anyUpdates);
                }

                if (TryGetObject(contact, "junior", "contact.junior", errors, out var junior))
                {
                    ApplyDateUpdate(junior, "dob", "contact.junior.dob", errors, v => entry.JuniorDob = v, ref anyUpdates);
                    ApplyStringUpdate(junior, "memberId", "contact.junior.memberId", errors, v => entry.JuniorMemberId = v, ref anyUpdates);
                }
            }

            if (TryGetObject(document.RootElement, "fees", "fees", errors, out var fees))
            {
                ApplyDecimalUpdate(fees, "totalEntryFees", "fees.totalEntryFees", errors, v => entry.TotalEntryFees = v, ref anyUpdates);
                ApplyStringUpdate(fees, "currency", "fees.currency", errors, v => entry.FeesCurrency = v, ref anyUpdates);
            }

            if (TryGetObject(document.RootElement, "emergencyContact", "emergencyContact", errors, out var emergency))
            {
                ApplyStringUpdate(emergency, "name", "emergencyContact.name", errors, v => entry.EmergencyName = v, ref anyUpdates);
                ApplyStringUpdate(emergency, "phoneOrNumber", "emergencyContact.phoneOrNumber", errors, v => entry.EmergencyPhone = v, ref anyUpdates);
            }

            if (errors.Count > 0)
            {
                return Results.Problem(
                    title: "One or more validation errors occurred.",
                    statusCode: StatusCodes.Status400BadRequest,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errors"] = errors
                    });
            }

            if (!anyUpdates)
            {
                return Results.Problem(
                    title: "No fields provided.",
                    statusCode: StatusCodes.Status400BadRequest,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errors"] = new Dictionary<string, string[]>
                        {
                            ["request"] = new[] { "At least one field must be provided." }
                        }
                    });
            }

            entry.UpdatedAtUtc = DateTime.UtcNow;
            await dbContext.SaveChangesAsync();

            activity?.SetTag("entry.status", entry.Status.ToString());
            logger.LogInformation("Entry updated: {EntryId}", entryId);

            var newEtag = GetEtag(entry.RowVersion);
            context.Response.Headers.ETag = newEtag;

            return Results.Ok(entry.ToDetailDto());
        })
        .WithName("Entries_Update");

        group.MapPut("/{entryId:guid}/selections", async (
            Guid entryId,
            EntrySelectionsReplaceRequestDto request,
            HttpContext context,
            DogTrialsDbContext dbContext,
            IFormMetadataService formMetadataService,
            ILogger<Program> logger) =>
        {
            using var activitySource = new ActivitySource(HealthEndpoints.ActivitySourceName);
            using var activity = activitySource.StartActivity("Entry.UpdateSelections");
            activity?.SetTag("entry.id", entryId.ToString());
            activity?.SetTag("grid", request.Grid);

            if (string.IsNullOrWhiteSpace(request.Grid))
            {
                return Results.Problem(
                    title: "Invalid grid",
                    statusCode: StatusCodes.Status400BadRequest,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errors"] = new Dictionary<string, string[]>
                        {
                            ["grid"] = new[] { "Grid is required." }
                        }
                    });
            }

            if (request.Items is null)
            {
                return Results.Problem(
                    title: "Invalid selections",
                    statusCode: StatusCodes.Status400BadRequest,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errors"] = new Dictionary<string, string[]>
                        {
                            ["items"] = new[] { "Selections items are required." }
                        }
                    });
            }

            var userId = context.GetUserId();

            var entry = await dbContext.Entries
                .Include(e => e.Trial)
                .Include(e => e.Notifications)
                .Where(e => e.EntryId == entryId)
                .FirstOrDefaultAsync();

            if (entry is null)
            {
                return Results.Problem(
                    title: "Entry not found",
                    statusCode: StatusCodes.Status404NotFound,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errorCode"] = "ENTRY_NOT_FOUND"
                    });
            }

            if (entry.CreatedByUserId != userId)
            {
                return Results.Problem(
                    title: "Access denied",
                    statusCode: StatusCodes.Status403Forbidden,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errorCode"] = "ENTRY_FORBIDDEN"
                    });
            }

            if (entry.Status != EntryStatus.Draft)
            {
                return Results.Problem(
                    title: "Entry already submitted",
                    statusCode: StatusCodes.Status409Conflict,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errorCode"] = "ENTRY_ALREADY_SUBMITTED"
                    });
            }

            activity?.SetTag("trial.id", entry.TrialId.ToString());

            var formTemplate = new FormTemplateKeyDto(
                entry.Trial.OrganizationCode,
                entry.Trial.SportCode,
                entry.Trial.FormCode,
                entry.Trial.FormVersion);

            var formMetadata = await formMetadataService.GetFormMetadataAsync(formTemplate);
            if (formMetadata is null)
            {
                return Results.Problem(
                    title: "Form template not found",
                    statusCode: StatusCodes.Status404NotFound,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errorCode"] = "FORM_TEMPLATE_NOT_FOUND"
                    });
            }

            var gridMetadata = formMetadata.Grids.FirstOrDefault(g => string.Equals(g.Grid, request.Grid, StringComparison.OrdinalIgnoreCase));
            if (gridMetadata is null)
            {
                return Results.Problem(
                    title: "Invalid grid",
                    statusCode: StatusCodes.Status400BadRequest,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errors"] = new Dictionary<string, string[]>
                        {
                            ["grid"] = new[] { "Invalid grid specified." }
                        }
                    });
            }

            var disabledSet = gridMetadata.DisabledCells
                .Select(d => $"{d.Row}:{d.Col}")
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var invalidSelections = request.Items
                .Where(i => string.Equals(i.Value, "X", StringComparison.OrdinalIgnoreCase)
                            && disabledSet.Contains($"{i.Row}:{i.Col}"))
                .ToList();

            if (invalidSelections.Count > 0)
            {
                return Results.Problem(
                    title: "Selection targets a disabled cell",
                    statusCode: StatusCodes.Status400BadRequest,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errors"] = new Dictionary<string, string[]>
                        {
                            ["selections"] = new[] { "Selection targets a disabled cell." }
                        }
                    });
            }

            var selections = DeserializeSelections(entry.SelectionsJson);

            if (string.Equals(request.Grid, "Upper", StringComparison.OrdinalIgnoreCase))
            {
                selections = selections with { Upper = request.Items };
            }
            else if (string.Equals(request.Grid, "Lower", StringComparison.OrdinalIgnoreCase))
            {
                selections = selections with { Lower = request.Items };
            }
            else
            {
                return Results.Problem(
                    title: "Invalid grid",
                    statusCode: StatusCodes.Status400BadRequest,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errors"] = new Dictionary<string, string[]>
                        {
                            ["grid"] = new[] { "Invalid grid specified." }
                        }
                    });
            }

            entry.SelectionsJson = JsonSerializer.Serialize(selections);
            entry.UpdatedAtUtc = DateTime.UtcNow;
            await dbContext.SaveChangesAsync();

            activity?.SetTag("entry.status", entry.Status.ToString());
            logger.LogInformation("Entry selections updated: {EntryId}", entryId);

            return Results.Ok(entry.ToDetailDto());
        })
        .WithName("Entries_UpdateSelections");

        group.MapPost("/{entryId:guid}/submit", async (
            Guid entryId,
            SubmitEntryRequestDto request,
            HttpContext context,
            DogTrialsDbContext dbContext,
            TrialCounterAllocator counterAllocator,
            IBackgroundJobQueue jobQueue,
            Microsoft.Extensions.Options.IOptions<SubmitOptions> submitOptions,
            ILogger<Program> logger) =>
        {
            using var activitySource = new ActivitySource(HealthEndpoints.ActivitySourceName);
            using var activity = activitySource.StartActivity("Entry.Submit");
            activity?.SetTag("entry.id", entryId.ToString());

            var userId = context.GetUserId();
            var userRole = context.GetUserRole();
            var userEmail = UserProvisioningService.ExtractEmail(context.User);

            activity?.SetTag("user.role", userRole.ToString());
            activity?.SetTag("entry.mode", "direct");

            var entry = await dbContext.Entries
                .Include(e => e.Trial)
                .Include(e => e.Notifications)
                .Where(e => e.EntryId == entryId)
                .FirstOrDefaultAsync(context.RequestAborted);

            if (entry is null)
            {
                return Results.Problem(
                    title: "Entry not found",
                    statusCode: StatusCodes.Status404NotFound,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errorCode"] = "ENTRY_NOT_FOUND"
                    });
            }

            if (entry.CreatedByUserId != userId)
            {
                return Results.Problem(
                    title: "Access denied",
                    statusCode: StatusCodes.Status403Forbidden,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errorCode"] = "ENTRY_FORBIDDEN"
                    });
            }

            if (entry.Status != EntryStatus.Draft)
            {
                return Results.Problem(
                    title: "Entry already submitted",
                    statusCode: StatusCodes.Status409Conflict,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errorCode"] = "ENTRY_ALREADY_SUBMITTED"
                    });
            }

            activity?.SetTag("trial.id", entry.TrialId.ToString());

            var errors = ValidateSubmit(entry, request, userEmail, submitOptions.Value);
            if (errors.Count > 0)
            {
                return Results.Problem(
                    title: "One or more validation errors occurred.",
                    statusCode: StatusCodes.Status400BadRequest,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errors"] = errors
                    });
            }

            await using var transaction = await dbContext.Database.BeginTransactionAsync(context.RequestAborted);

            try
            {
                var sequenceNumber = await counterAllocator.AllocateSequenceNumberAsync(entry.TrialId, context.RequestAborted);
                if (sequenceNumber <= 0)
                {
                    logger.LogError("Sequence allocation failed for trial {TrialId}", entry.TrialId);
                    return Results.Problem(
                        title: "Sequence allocation failed",
                        statusCode: StatusCodes.Status500InternalServerError,
                        extensions: new Dictionary<string, object?>
                        {
                            ["errorCode"] = "SEQUENCE_ALLOCATION_FAILED"
                        });
                }

                var entryNumber = $"{entry.Trial.TrackingSlug}-{sequenceNumber:D4}";

                entry.Status = EntryStatus.Submitted;
                entry.SequenceNumber = sequenceNumber;
                entry.RegistrationOrTrackingNumber = entryNumber;
                entry.SubmittedAtUtc = DateTime.UtcNow;
                entry.TermsVersion = request.TermsVersion;
                entry.TermsAcceptedAtUtc = DateTime.UtcNow;
                entry.TermsAcceptedByUserId = userId;
                entry.UpdatedAtUtc = DateTime.UtcNow;

                AddMissingNotifications(dbContext, entry, RecipientType.Handler, RecipientType.Secretary);

                await dbContext.SaveChangesAsync(context.RequestAborted);
                await transaction.CommitAsync(context.RequestAborted);

                activity?.SetTag("entry.status", entry.Status.ToString());
                activity?.SetTag("entry.number", entryNumber);

                await jobQueue.EnqueueEntrySubmittedAsync(entry.EntryId, context.RequestAborted);

                var supportId = Activity.Current?.TraceId.ToString() ?? context.TraceIdentifier;

                return Results.Ok(new SubmitEntryResponseDto(
                    entry.EntryId,
                    entry.Status.ToString(),
                    supportId));
            }
            catch
            {
                await transaction.RollbackAsync(context.RequestAborted);
                throw;
            }
        })
        .WithName("Entries_Submit");

        return endpoints;
    }

    private static string GetEtag(byte[] rowVersion)
    {
        return $"\"{Convert.ToBase64String(rowVersion)}\"";
    }

    private static string NormalizeEtag(string etag)
    {
        if (etag.StartsWith("W/", StringComparison.OrdinalIgnoreCase))
        {
            etag = etag[2..];
        }

        return etag.Trim().Trim('"');
    }

    private static bool TryGetObject(JsonElement parent, string propertyName, string path, Dictionary<string, string[]> errors, out JsonElement value)
    {
        value = default;
        if (!parent.TryGetProperty(propertyName, out var element))
        {
            return false;
        }

        if (element.ValueKind == JsonValueKind.Null)
        {
            errors[path] = new[] { "Null values are not allowed." };
            return false;
        }

        if (element.ValueKind != JsonValueKind.Object)
        {
            errors[path] = new[] { "Invalid object value." };
            return false;
        }

        value = element;
        return true;
    }

    private static void ApplyStringUpdate(JsonElement parent, string propertyName, string path, Dictionary<string, string[]> errors, Action<string?> setter, ref bool anyUpdates)
    {
        if (!parent.TryGetProperty(propertyName, out var element))
        {
            return;
        }

        if (element.ValueKind == JsonValueKind.Null)
        {
            errors[path] = new[] { "Null values are not allowed." };
            return;
        }

        if (element.ValueKind != JsonValueKind.String)
        {
            errors[path] = new[] { "Invalid string value." };
            return;
        }

        setter(element.GetString());
        anyUpdates = true;
    }

    private static void ApplyDateUpdate(JsonElement parent, string propertyName, string path, Dictionary<string, string[]> errors, Action<DateOnly?> setter, ref bool anyUpdates)
    {
        if (!parent.TryGetProperty(propertyName, out var element))
        {
            return;
        }

        if (element.ValueKind == JsonValueKind.Null)
        {
            errors[path] = new[] { "Null values are not allowed." };
            return;
        }

        if (element.ValueKind != JsonValueKind.String || !DateOnly.TryParse(element.GetString(), out var date))
        {
            errors[path] = new[] { "Invalid date value." };
            return;
        }

        setter(date);
        anyUpdates = true;
    }

    private static void ApplyDecimalUpdate(JsonElement parent, string propertyName, string path, Dictionary<string, string[]> errors, Action<decimal?> setter, ref bool anyUpdates)
    {
        if (!parent.TryGetProperty(propertyName, out var element))
        {
            return;
        }

        if (element.ValueKind == JsonValueKind.Null)
        {
            errors[path] = new[] { "Null values are not allowed." };
            return;
        }

        if (element.ValueKind != JsonValueKind.Number || !element.TryGetDecimal(out var value))
        {
            errors[path] = new[] { "Invalid number value." };
            return;
        }

        setter(value);
        anyUpdates = true;
    }

    private static EntryDetailDto ToDetailDto(this Entry entry)
    {
        var trial = entry.Trial;
        var selections = DeserializeSelections(entry.SelectionsJson);
        var notifications = entry.Notifications.Select(n => n.ToDto()).ToList();
        var junior = entry.JuniorDob is not null || !string.IsNullOrWhiteSpace(entry.JuniorMemberId)
            ? new JuniorDto(entry.JuniorDob?.ToString("yyyy-MM-dd"), entry.JuniorMemberId)
            : null;

        return new EntryDetailDto(
            entry.EntryId,
            new TrialInfoDto(
                trial.TrialId,
                trial.Name,
                trial.OrganizerSlug,
                trial.EventSlug,
                trial.TrackingSlug,
                trial.HostClub,
                trial.StartDate.ToString("yyyy-MM-dd"),
                trial.EndDate.ToString("yyyy-MM-dd"),
                trial.SecretaryEmail),
            entry.Status.ToString(),
            new FormTemplateKeyDto(
                trial.OrganizationCode,
                trial.SportCode,
                trial.FormCode,
                trial.FormVersion),
            entry.RegistrationOrTrackingNumber,
            new DogDto(
                entry.RegistrationOrTrackingNumber,
                entry.DogBreed,
                entry.DogRegisteredName,
                entry.DogDob?.ToString("yyyy-MM-dd"),
                entry.DogColor,
                entry.DogCallName,
                entry.DogSex,
                entry.DogSire,
                entry.DogDam,
                entry.DogBreeders),
            new ContactDto(
                entry.ContactOwners,
                new AddressDto(
                    entry.ContactStreet,
                    entry.ContactCity,
                    entry.ContactState,
                    entry.ContactZip),
                entry.ContactEmail,
                entry.ContactPhone,
                entry.ContactHandler,
                entry.ContactMembershipNumber,
                junior),
            new FeesDto(entry.TotalEntryFees, entry.FeesCurrency ?? "USD"),
            new EmergencyContactDto(entry.EmergencyName, entry.EmergencyPhone),
            selections,
            new TermsAcceptanceDto(entry.TermsVersion, entry.TermsAcceptedAtUtc, entry.TermsAcceptedByUserId),
            new EntryProcessingDto(
                entry.PdfStatus.ToString(),
                new GeneratedPdfDto(entry.GeneratedPdfBlobUri, null),
                notifications,
                entry.PdfLastErrorCode is null
                    ? null
                    : new ErrorDto(entry.PdfLastErrorCode, "Processing error")));
    }

    private static NotificationDto ToDto(this Notification notification)
    {
        return new NotificationDto(
            notification.RecipientType.ToString(),
            notification.Status.ToString(),
            notification.SentAtUtc,
            notification.LastErrorCode);
    }

    private static EntrySelectionsDto DeserializeSelections(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return new EntrySelectionsDto(new List<EntrySelectionCellDto>(), new List<EntrySelectionCellDto>());
        }

        try
        {
            var selections = JsonSerializer.Deserialize<EntrySelectionsDto>(
                json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            return selections ?? new EntrySelectionsDto(new List<EntrySelectionCellDto>(), new List<EntrySelectionCellDto>());
        }
        catch (JsonException)
        {
            return new EntrySelectionsDto(new List<EntrySelectionCellDto>(), new List<EntrySelectionCellDto>());
        }
    }

    private static Dictionary<string, string[]> ValidateSubmit(Entry entry, SubmitEntryRequestDto request, string? userEmail, SubmitOptions options)
    {
        var errors = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);

        void AddError(string field, string message)
        {
            if (!errors.TryGetValue(field, out var list))
            {
                list = new List<string>();
                errors[field] = list;
            }

            list.Add(message);
        }

        if (string.IsNullOrWhiteSpace(entry.DogBreed))
        {
            AddError("dog.breed", "Breed is required.");
        }

        if (string.IsNullOrWhiteSpace(entry.DogCallName))
        {
            AddError("dog.callName", "Call Name is required.");
        }

        if (entry.DogDob is null)
        {
            AddError("dog.dob", "Date of Birth is required.");
        }

        if (string.IsNullOrWhiteSpace(entry.DogSex))
        {
            AddError("dog.sex", "Sex is required.");
        }

        if (string.IsNullOrWhiteSpace(entry.ContactOwners))
        {
            AddError("contact.owners", "Owners is required.");
        }

        if (string.IsNullOrWhiteSpace(entry.ContactEmail))
        {
            AddError("contact.email", "Email is required.");
        }

        if (string.IsNullOrWhiteSpace(entry.ContactPhone))
        {
            AddError("contact.phone", "Phone is required.");
        }

        if (!options.AllowDifferentEmail)
        {
            if (string.IsNullOrWhiteSpace(userEmail)
                || !string.Equals(entry.ContactEmail, userEmail, StringComparison.OrdinalIgnoreCase))
            {
                AddError("contact.email", "Email must match your login email.");
            }
        }

        if (string.IsNullOrWhiteSpace(entry.EmergencyName))
        {
            AddError("emergencyContact.name", "Emergency contact name is required.");
        }

        if (string.IsNullOrWhiteSpace(entry.EmergencyPhone))
        {
            AddError("emergencyContact.phoneOrNumber", "Emergency contact phone is required.");
        }

        if (entry.TotalEntryFees is null || entry.TotalEntryFees <= 0)
        {
            AddError("fees.totalEntryFees", "Entry fees must be greater than zero.");
        }

        var selections = DeserializeSelections(entry.SelectionsJson);
        var hasSelections = selections.Upper.Any(s => !string.IsNullOrWhiteSpace(s.Value))
            || selections.Lower.Any(s => !string.IsNullOrWhiteSpace(s.Value));
        if (!hasSelections)
        {
            AddError("selections", "At least one class selection is required.");
        }

        if (!request.AcceptTerms)
        {
            AddError("terms", "You must accept the terms.");
        }

        if (string.IsNullOrWhiteSpace(request.TermsVersion))
        {
            AddError("terms", "Terms version is required.");
        }

        return errors.ToDictionary(k => k.Key, v => v.Value.ToArray(), StringComparer.OrdinalIgnoreCase);
    }

    private static void AddMissingNotifications(DogTrialsDbContext dbContext, Entry entry, params RecipientType[] recipientTypes)
    {
        var newNotifications = new List<Notification>();

        foreach (var recipientType in recipientTypes)
        {
            if (entry.Notifications.Any(n => n.RecipientType == recipientType))
            {
                continue;
            }

            newNotifications.Add(new Notification
            {
                NotificationId = Guid.NewGuid(),
                EntryId = entry.EntryId,
                RecipientType = recipientType,
                Status = NotificationStatus.Queued,
                CreatedAtUtc = DateTime.UtcNow
            });
        }

        if (newNotifications.Count > 0)
        {
            dbContext.Notifications.AddRange(newNotifications);
        }
    }
}
