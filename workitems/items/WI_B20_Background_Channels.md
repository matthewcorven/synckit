# WI-B20: Background Channels

**Owner:** Agent B (Platform)  
**Status:** Proposed  
**Milestone:** M4  
**Dependencies:** B19  
**Artifacts folder (recommended):** `../artifacts/WI-B20/`

## Goal
Implement the background processing infrastructure using Channels and hosted services.

## Scope
### In
- Background job queue using System.Threading.Channels
- Hosted service for processing jobs
- PDF generation job type
- Email sending job type
- Retry logic with exponential backoff
- Startup recovery scan for incomplete work
- Idempotent job processing

### Out
- PDF stamping (see B21)
- Blob storage (see B22)
- Email sending (see B23)

## Implementation notes
- Use `Channel<BackgroundJob>` for in-memory queue
- Hosted service consumes from channel
- Job types: PdfGeneration, EmailNotification
- Retry strategy:
  - Exponential backoff: 1m, 5m, 15m, 30m
  - Max attempts: 10
  - After max, leave as Failed
- Startup scan queries:
  - Entries: Status=Submitted, PdfStatus IN (Queued, InProgress, Failed), NextAttempt due
  - Notifications: Status IN (Queued, InProgress, Failed), NextAttempt due
- Idempotency: Check status before processing

## Acceptance criteria
- [ ] Jobs can be enqueued
- [ ] Hosted service processes jobs
- [ ] Retry logic with backoff works
- [ ] Startup recovery re-queues incomplete work
- [ ] Idempotent processing (no duplicates)

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- Queue accepts and returns jobs
- Retry backoff calculation correct
- Idempotency check works

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B20/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Job enqueued and processed
- Failed job retried
- Startup recovery works

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B20/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- N/A — infrastructure

**Artifacts (add as relative links during work)**
- N/A

### DB verification
**Artifact requirements**
- Retry fields updated correctly

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B20/db/retry-fields.txt`

### Telemetry verification
- Verify job processing spans

**Artifact requirements**
- Trace showing job processing

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B20/telemetry/job-trace.png`

## Risks / Questions
- Memory pressure with large queues
- Graceful shutdown handling

## Implementation
```csharp
// Job types
public abstract record BackgroundJob(Guid JobId, Guid EntryId, int AttemptNumber);
public record PdfGenerationJob(Guid JobId, Guid EntryId, int AttemptNumber) 
    : BackgroundJob(JobId, EntryId, AttemptNumber);
public record EmailNotificationJob(Guid JobId, Guid EntryId, RecipientType RecipientType, int AttemptNumber) 
    : BackgroundJob(JobId, EntryId, AttemptNumber);

// Queue interface
public interface IBackgroundJobQueue
{
    ValueTask EnqueuePdfGenerationAsync(Guid entryId);
    ValueTask EnqueueEmailNotificationAsync(Guid entryId, RecipientType recipientType);
    ValueTask<BackgroundJob> DequeueAsync(CancellationToken ct);
}

// Channel-based implementation
public class ChannelBackgroundJobQueue : IBackgroundJobQueue
{
    private readonly Channel<BackgroundJob> _channel;
    
    public ChannelBackgroundJobQueue()
    {
        _channel = Channel.CreateUnbounded<BackgroundJob>(new UnboundedChannelOptions
        {
            SingleReader = false,
            SingleWriter = false
        });
    }
    
    public async ValueTask EnqueuePdfGenerationAsync(Guid entryId)
    {
        var job = new PdfGenerationJob(Guid.NewGuid(), entryId, 1);
        await _channel.Writer.WriteAsync(job);
    }
    
    public async ValueTask EnqueueEmailNotificationAsync(Guid entryId, RecipientType recipientType)
    {
        var job = new EmailNotificationJob(Guid.NewGuid(), entryId, recipientType, 1);
        await _channel.Writer.WriteAsync(job);
    }
    
    public async ValueTask<BackgroundJob> DequeueAsync(CancellationToken ct)
    {
        return await _channel.Reader.ReadAsync(ct);
    }
}

// Hosted service
public class BackgroundJobProcessor : BackgroundService
{
    private readonly IBackgroundJobQueue _queue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<BackgroundJobProcessor> _logger;
    
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
    
    private async Task ProcessJobAsync(BackgroundJob job, CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        
        switch (job)
        {
            case PdfGenerationJob pdfJob:
                var pdfHandler = scope.ServiceProvider.GetRequiredService<IPdfJobHandler>();
                await pdfHandler.HandleAsync(pdfJob, ct);
                break;
                
            case EmailNotificationJob emailJob:
                var emailHandler = scope.ServiceProvider.GetRequiredService<IEmailJobHandler>();
                await emailHandler.HandleAsync(emailJob, ct);
                break;
        }
    }
}

// Startup recovery service
public class StartupRecoveryService : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<DogTrialsDbContext>();
        var queue = scope.ServiceProvider.GetRequiredService<IBackgroundJobQueue>();
        var now = DateTime.UtcNow;
        
        // Recover incomplete PDFs
        var incompletePdfs = await dbContext.Entries
            .Where(e => e.Status == EntryStatus.Submitted)
            .Where(e => e.PdfStatus != PdfStatus.Success)
            .Where(e => e.PdfNextAttemptAtUtc == null || e.PdfNextAttemptAtUtc <= now)
            .Where(e => e.PdfAttemptCount < 10)
            .Select(e => e.EntryId)
            .ToListAsync(cancellationToken);
            
        foreach (var entryId in incompletePdfs)
        {
            await queue.EnqueuePdfGenerationAsync(entryId);
        }
        
        // Recover incomplete notifications
        var incompleteNotifications = await dbContext.Notifications
            .Where(n => n.Status != NotificationStatus.Success)
            .Where(n => n.NextAttemptAtUtc == null || n.NextAttemptAtUtc <= now)
            .Where(n => n.AttemptCount < 10)
            .Select(n => new { n.EntryId, n.RecipientType })
            .ToListAsync(cancellationToken);
            
        foreach (var n in incompleteNotifications)
        {
            await queue.EnqueueEmailNotificationAsync(n.EntryId, n.RecipientType);
        }
        
        _logger.LogInformation("Recovered {PdfCount} PDFs and {EmailCount} notifications",
            incompletePdfs.Count, incompleteNotifications.Count);
    }
    
    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
```

## Retry Backoff Calculation
```csharp
public static class RetryCalculator
{
    private static readonly TimeSpan[] BackoffSchedule = 
    {
        TimeSpan.FromMinutes(1),
        TimeSpan.FromMinutes(5),
        TimeSpan.FromMinutes(15),
        TimeSpan.FromMinutes(30),
        TimeSpan.FromMinutes(30),
        TimeSpan.FromMinutes(30),
        TimeSpan.FromMinutes(30),
        TimeSpan.FromMinutes(30),
        TimeSpan.FromMinutes(30),
        TimeSpan.FromMinutes(30)
    };
    
    public static DateTime? GetNextAttemptTime(int attemptCount)
    {
        if (attemptCount >= BackoffSchedule.Length)
            return null; // Max attempts reached
            
        return DateTime.UtcNow + BackoffSchedule[attemptCount];
    }
}
```
