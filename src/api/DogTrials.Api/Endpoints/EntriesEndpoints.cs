using DogTrials.Api.Data;
using DogTrials.Api.Dtos;
using DogTrials.Api.Entities;
using DogTrials.Api.Security;
using Microsoft.EntityFrameworkCore;
using System.Diagnostics;

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

        return endpoints;
    }
}
