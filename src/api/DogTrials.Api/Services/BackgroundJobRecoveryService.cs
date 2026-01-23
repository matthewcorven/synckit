using DogTrials.Api.Data;
using DogTrials.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DogTrials.Api.Services;

public sealed class BackgroundJobRecoveryService : IHostedService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<BackgroundJobRecoveryService> _logger;
    private readonly BackgroundJobOptions _options;

    public BackgroundJobRecoveryService(
        IServiceScopeFactory scopeFactory,
        ILogger<BackgroundJobRecoveryService> logger,
        IOptions<BackgroundJobOptions> options)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _options = options.Value;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<DogTrialsDbContext>();
        var queue = scope.ServiceProvider.GetRequiredService<IBackgroundJobQueue>();
        var now = DateTime.UtcNow;

        var incompletePdfEntries = await dbContext.Entries
            .AsNoTracking()
            .Where(e => e.Status == EntryStatus.Submitted)
            .Where(e => e.PdfStatus != PdfStatus.Success)
            .Where(e => e.PdfAttemptCount < _options.MaxAttempts)
            .Where(e => e.PdfNextAttemptAtUtc == null || e.PdfNextAttemptAtUtc <= now)
            .Select(e => e.EntryId)
            .ToListAsync(cancellationToken);

        foreach (var entryId in incompletePdfEntries)
        {
            await queue.EnqueuePdfGenerationAsync(entryId, cancellationToken);
        }

        var incompleteNotifications = await dbContext.Notifications
            .AsNoTracking()
            .Where(n => n.Status != NotificationStatus.Success)
            .Where(n => n.AttemptCount < _options.MaxAttempts)
            .Where(n => n.NextAttemptAtUtc == null || n.NextAttemptAtUtc <= now)
            .Select(n => new { n.EntryId, n.RecipientType })
            .ToListAsync(cancellationToken);

        foreach (var notification in incompleteNotifications)
        {
            await queue.EnqueueEmailNotificationAsync(notification.EntryId, notification.RecipientType, cancellationToken);
        }

        _logger.LogInformation(
            "Recovered {PdfCount} PDF jobs and {EmailCount} email jobs",
            incompletePdfEntries.Count,
            incompleteNotifications.Count);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
