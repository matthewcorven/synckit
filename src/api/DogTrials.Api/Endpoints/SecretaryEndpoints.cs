using DogTrials.Api.Data;
using DogTrials.Api.Dtos;
using DogTrials.Api.Entities;
using DogTrials.Api.Security;
using DogTrials.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.IO;

namespace DogTrials.Api.Endpoints;

public static class SecretaryEndpoints
{
    public static IEndpointRouteBuilder MapSecretaryEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/secretary")
            .RequireAuthorization(AuthPolicies.Secretary);

        group.MapGet("/entries", async (
            [FromQuery] Guid? trialId,
            [FromQuery] string? status,
            [FromQuery] int page,
            [FromQuery] int pageSize,
            DogTrialsDbContext dbContext) =>
        {
            page = page <= 0 ? 1 : page;
            pageSize = pageSize <= 0 ? 50 : pageSize;

            var hasStatusFilter = false;
            var statusEnum = default(EntryStatus);
            if (!string.IsNullOrWhiteSpace(status))
            {
                if (!Enum.TryParse<EntryStatus>(status, true, out statusEnum))
                {
                    return Results.Problem(
                        title: "Invalid status filter",
                        statusCode: StatusCodes.Status400BadRequest,
                        extensions: new Dictionary<string, object?>
                        {
                            ["errors"] = new Dictionary<string, string[]>
                            {
                                ["status"] = new[] { "Invalid status filter." }
                            }
                        });
                }

                hasStatusFilter = true;
            }

            var query = dbContext.Entries.AsNoTracking().AsQueryable();

            if (trialId.HasValue)
            {
                query = query.Where(e => e.TrialId == trialId.Value);
            }

            if (hasStatusFilter)
            {
                query = query.Where(e => e.Status == statusEnum);
            }

            var total = await query.CountAsync();

            var items = await query
                .OrderByDescending(e => e.SubmittedAtUtc ?? DateTime.MinValue)
                .ThenByDescending(e => e.CreatedAtUtc)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(e => e.ToSummaryDto())
                .ToListAsync();

            return Results.Ok(new PaginatedResponse<EntrySummaryDto>(items, page, pageSize, total));
        })
        .WithName("SecretaryEntries_List");

        group.MapGet("/entries/{entryId:guid}", async (
            Guid entryId,
            DogTrialsDbContext dbContext) =>
        {
            var entry = await dbContext.Entries
                .AsNoTracking()
                .Include(e => e.Trial)
                .Include(e => e.Notifications)
                .FirstOrDefaultAsync(e => e.EntryId == entryId);

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

            return Results.Ok(entry.ToDetailDto());
        })
        .WithName("SecretaryEntries_GetById");

        group.MapGet("/entries/{entryId:guid}/pdf", async (
            Guid entryId,
            DogTrialsDbContext dbContext,
            IBlobStorageService blobStorageService,
            ILogger<Program> logger,
            CancellationToken ct) =>
        {
            var entry = await dbContext.Entries
                .AsNoTracking()
                .FirstOrDefaultAsync(e => e.EntryId == entryId, ct);

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

            if (entry.PdfStatus != PdfStatus.Success || string.IsNullOrWhiteSpace(entry.GeneratedPdfBlobUri))
            {
                return Results.Problem(
                    title: "PDF not available",
                    statusCode: StatusCodes.Status404NotFound,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errorCode"] = "PDF_NOT_AVAILABLE"
                    });
            }

            try
            {
                var downloadUrl = await blobStorageService.GenerateSasUrlAsync(entry.EntryId, SasTtl.UiDownload, ct);
                return Results.Ok(new { downloadUrl });
            }
            catch (FileNotFoundException ex)
            {
                logger.LogWarning(ex, "PDF blob not found for entry {EntryId}", entry.EntryId);
                return Results.Problem(
                    title: "PDF not available",
                    statusCode: StatusCodes.Status404NotFound,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errorCode"] = "PDF_NOT_AVAILABLE"
                    });
            }
        })
        .WithName("SecretaryEntries_GetPdf");

        group.MapPost("/entries/{entryId:guid}/pdf/retry", async (
            Guid entryId,
            DogTrialsDbContext dbContext,
            IBackgroundJobQueue jobQueue,
            CancellationToken ct) =>
        {
            var entry = await dbContext.Entries
                .FirstOrDefaultAsync(e => e.EntryId == entryId && e.Status == EntryStatus.Submitted, ct);

            if (entry is null)
            {
                return Results.Problem(
                    title: "Entry not found or not submitted",
                    statusCode: StatusCodes.Status404NotFound,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errorCode"] = "ENTRY_NOT_FOUND"
                    });
            }

            if (entry.PdfStatus == PdfStatus.InProgress)
            {
                return Results.Problem(
                    title: "PDF generation already in progress",
                    statusCode: StatusCodes.Status409Conflict,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errorCode"] = "PDF_IN_PROGRESS"
                    });
            }

            entry.PdfStatus = PdfStatus.Queued;
            entry.PdfAttemptCount = 0;
            entry.PdfNextAttemptAtUtc = DateTime.UtcNow;
            entry.PdfLastAttemptAtUtc = null;
            entry.PdfLastErrorCode = null;

            await dbContext.SaveChangesAsync(ct);
            await jobQueue.EnqueuePdfGenerationAsync(entry.EntryId, ct);

            return Results.Accepted();
        })
        .WithName("SecretaryEntries_RetryPdf");

        return endpoints;
    }
}
