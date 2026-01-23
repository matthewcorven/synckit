using System.Diagnostics;
using DogTrials.Api.Data;
using DogTrials.Api.Endpoints;
using DogTrials.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DogTrials.Api.Services;

public sealed class BackgroundJobProcessor : BackgroundService
{
    private readonly IBackgroundJobQueue _queue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<BackgroundJobProcessor> _logger;
    private readonly BackgroundJobOptions _options;
    private readonly ActivitySource _activitySource;

    public BackgroundJobProcessor(
        IBackgroundJobQueue queue,
        IServiceScopeFactory scopeFactory,
        ILogger<BackgroundJobProcessor> logger,
        IOptions<BackgroundJobOptions> options)
    {
        _queue = queue;
        _scopeFactory = scopeFactory;
        _logger = logger;
        _options = options.Value;
        _activitySource = new ActivitySource(HealthEndpoints.ActivitySourceName);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Background job processor starting");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var job = await _queue.DequeueAsync(stoppingToken);
                await ProcessJobAsync(job, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing background job");
            }
        }
    }

    public Task ProcessJobAsync(BackgroundJob job, CancellationToken ct)
    {
        return job switch
        {
            PdfGenerationJob pdfJob => ProcessPdfJobAsync(pdfJob, ct),
            EmailNotificationJob emailJob => ProcessEmailJobAsync(emailJob, ct),
            _ => Task.CompletedTask
        };
    }

    private async Task ProcessPdfJobAsync(PdfGenerationJob job, CancellationToken ct)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<DogTrialsDbContext>();
        var handler = scope.ServiceProvider.GetRequiredService<IPdfJobHandler>();

        var entry = await dbContext.Entries
            .Include(e => e.Trial)
            .FirstOrDefaultAsync(e => e.EntryId == job.EntryId, ct);

        if (entry is null)
        {
            _logger.LogWarning("PDF job skipped; entry not found: {EntryId}", job.EntryId);
            return;
        }

        var now = DateTime.UtcNow;
        if (!BackgroundJobGuards.ShouldProcessPdf(entry, now, _options.MaxAttempts))
        {
            return;
        }

        entry.PdfStatus = PdfStatus.InProgress;
        entry.PdfAttemptCount += 1;
        entry.PdfLastAttemptAtUtc = now;
        entry.PdfNextAttemptAtUtc = RetryCalculator.GetNextAttemptTime(entry.PdfAttemptCount, now);
        entry.PdfLastErrorCode = null;

        await dbContext.SaveChangesAsync(ct);

        using var activity = _activitySource.StartActivity("Pdf.Generate");
        activity?.SetTag("entry.id", entry.EntryId.ToString());
        activity?.SetTag("trial.id", entry.TrialId.ToString());
        activity?.SetTag("entry.status", entry.Status.ToString());
        activity?.SetTag("entry.mode", "direct");

        try
        {
            var result = await handler.HandleAsync(entry, ct);

            if (result.Success)
            {
                entry.PdfStatus = PdfStatus.Success;
                entry.PdfLastErrorCode = null;
                entry.PdfNextAttemptAtUtc = null;

                if (!string.IsNullOrWhiteSpace(result.GeneratedPdfBlobUri))
                {
                    entry.GeneratedPdfBlobUri = result.GeneratedPdfBlobUri;
                }
            }
            else
            {
                entry.PdfStatus = PdfStatus.Failed;
                entry.PdfLastErrorCode = result.ErrorCode ?? "PDF_JOB_FAILED";
                entry.PdfNextAttemptAtUtc = RetryCalculator.GetNextAttemptTime(entry.PdfAttemptCount, now);
            }
        }
        catch (Exception ex)
        {
            entry.PdfStatus = PdfStatus.Failed;
            entry.PdfLastErrorCode = "PDF_JOB_EXCEPTION";
            entry.PdfNextAttemptAtUtc = RetryCalculator.GetNextAttemptTime(entry.PdfAttemptCount, now);

            _logger.LogError(ex, "Unhandled PDF job error for entry {EntryId}", entry.EntryId);
        }

        activity?.SetTag("pdf.status", entry.PdfStatus.ToString());
        await dbContext.SaveChangesAsync(ct);
    }

    private async Task ProcessEmailJobAsync(EmailNotificationJob job, CancellationToken ct)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<DogTrialsDbContext>();
        var handler = scope.ServiceProvider.GetRequiredService<IEmailJobHandler>();

        var notification = await dbContext.Notifications
            .Include(n => n.Entry)
            .ThenInclude(e => e.Trial)
            .FirstOrDefaultAsync(n => n.EntryId == job.EntryId && n.RecipientType == job.RecipientType, ct);

        if (notification is null)
        {
            _logger.LogWarning("Email job skipped; notification not found: {EntryId} {RecipientType}", job.EntryId, job.RecipientType);
            return;
        }

        var now = DateTime.UtcNow;
        if (!BackgroundJobGuards.ShouldProcessNotification(notification, now, _options.MaxAttempts))
        {
            return;
        }

        notification.Status = NotificationStatus.InProgress;
        notification.AttemptCount += 1;
        notification.LastAttemptAtUtc = now;
        notification.NextAttemptAtUtc = RetryCalculator.GetNextAttemptTime(notification.AttemptCount, now);
        notification.LastErrorCode = null;

        await dbContext.SaveChangesAsync(ct);

        using var activity = _activitySource.StartActivity("Email.Send");
        activity?.SetTag("entry.id", notification.EntryId.ToString());
        activity?.SetTag("trial.id", notification.Entry.TrialId.ToString());
        activity?.SetTag("entry.status", notification.Entry.Status.ToString());
        activity?.SetTag("entry.mode", "direct");
        activity?.SetTag("email.recipientType", notification.RecipientType.ToString());

        try
        {
            var result = await handler.HandleAsync(notification, ct);

            if (result.Success)
            {
                notification.Status = NotificationStatus.Success;
                notification.LastErrorCode = null;
                notification.NextAttemptAtUtc = null;
                notification.SentAtUtc = result.SentAtUtc ?? now;
            }
            else
            {
                notification.Status = NotificationStatus.Failed;
                notification.LastErrorCode = result.ErrorCode ?? "EMAIL_JOB_FAILED";
                notification.NextAttemptAtUtc = RetryCalculator.GetNextAttemptTime(notification.AttemptCount, now);
            }
        }
        catch (Exception ex)
        {
            notification.Status = NotificationStatus.Failed;
            notification.LastErrorCode = "EMAIL_JOB_EXCEPTION";
            notification.NextAttemptAtUtc = RetryCalculator.GetNextAttemptTime(notification.AttemptCount, now);

            _logger.LogError(ex, "Unhandled email job error for entry {EntryId} {RecipientType}", notification.EntryId, notification.RecipientType);
        }

        activity?.SetTag("email.status", notification.Status.ToString());
        await dbContext.SaveChangesAsync(ct);
    }
}
