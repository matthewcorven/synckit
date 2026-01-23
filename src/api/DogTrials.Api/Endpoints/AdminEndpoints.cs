using DogTrials.Api.Data;
using DogTrials.Api.Dtos;
using DogTrials.Api.Entities;
using DogTrials.Api.Security;
using DogTrials.Api.Services;
using Microsoft.EntityFrameworkCore;
using System.IO;

namespace DogTrials.Api.Endpoints;

public static class AdminEndpoints
{
    private static readonly TimeSpan UiDownloadTtl = TimeSpan.FromMinutes(15);

    public static IEndpointRouteBuilder MapAdminEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/admin/entries")
            .RequireAuthorization(AuthPolicies.Secretary);

        group.MapGet("/{entryId:guid}/processing-status", async (
            Guid entryId,
            DogTrialsDbContext dbContext,
            IBlobStorageService blobStorageService,
            ILogger<Program> logger,
            CancellationToken ct) =>
        {
            var entry = await dbContext.Entries
                .AsNoTracking()
                .Include(e => e.Notifications)
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

            string? downloadUrl = null;
            if (entry.PdfStatus == PdfStatus.Success && !string.IsNullOrWhiteSpace(entry.GeneratedPdfBlobUri))
            {
                try
                {
                    downloadUrl = await blobStorageService.GenerateSasUrlAsync(entry.EntryId, UiDownloadTtl, ct);
                }
                catch (FileNotFoundException ex)
                {
                    logger.LogWarning(ex, "PDF blob not found for entry {EntryId}", entry.EntryId);
                }
            }

            var notifications = entry.Notifications
                .Select(n => new NotificationStatusDto(
                    n.RecipientType.ToString(),
                    n.Status.ToString(),
                    n.SentAtUtc,
                    n.LastErrorCode))
                .ToList();

            ErrorDto? lastError = null;
            if (!string.IsNullOrWhiteSpace(entry.PdfLastErrorCode))
            {
                lastError = new ErrorDto(entry.PdfLastErrorCode, "PDF processing error. Contact support.");
            }

            return Results.Ok(new ProcessingStatusDto(
                entry.EntryId,
                entry.PdfStatus.ToString(),
                downloadUrl,
                notifications,
                lastError));
        })
        .WithName("AdminEntries_ProcessingStatus");

        return endpoints;
    }
}