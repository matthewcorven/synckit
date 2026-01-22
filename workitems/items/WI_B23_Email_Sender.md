# WI-B23: Email Sender

**Owner:** Agent B (Platform)  
**Status:** Proposed  
**Milestone:** M4  
**Dependencies:** B20, B06  
**Artifacts folder (recommended):** `../artifacts/WI-B23/`

## Goal
Implement email sending service using Azure Communication Services with notification tracking.

## Scope
### In
- Azure Communication Services Email client
- Email templates (Handler, Secretary)
- PDF attachment via SAS URL or direct
- Notification status tracking
- Retry logic integration
- Idempotent sending

### Out
- Background channels (see B20)
- Blob storage (see B22)

## Implementation notes
- ACS Email requires verified sender domain
- Email types:
  - Handler: Confirmation with PDF link
  - Secretary: New entry notification with PDF link
- Notification tracking per recipient type
- Mark as Success only after ACS confirms delivery
- OpenTelemetry span: `Email.Send`
- SAS URL for PDF (24-hour TTL)

## Acceptance criteria
- [ ] Handler receives confirmation email
- [ ] Secretary receives notification email
- [ ] PDF link included in emails
- [ ] Notification status tracked correctly
- [ ] Idempotent (no duplicate emails)
- [ ] Retry on failure

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- Email template rendering
- Notification status updates

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B23/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Send email via ACS
- Notification marked Success

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B23/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- N/A — email delivery

**Artifacts (add as relative links during work)**
- N/A

### DB verification
**Artifact requirements**
- Notification SentAtUtc populated
- Status = Success

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B23/db/notification-status.txt`

### Telemetry verification
- Verify `Email.Send` span with status and recipientType

**Artifact requirements**
- Trace screenshot

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B23/telemetry/email-trace.png`

## Risks / Questions
- ACS email limits/throttling
- Sender domain verification

## Implementation
```csharp
public interface IEmailSenderService
{
    Task SendEntryConfirmationAsync(Entry entry, RecipientType recipientType, CancellationToken ct);
}

public class AcsEmailSenderService : IEmailSenderService
{
    private readonly EmailClient _emailClient;
    private readonly IBlobStorageService _blobService;
    private readonly IOptions<EmailOptions> _options;
    private readonly ILogger<AcsEmailSenderService> _logger;
    
    public async Task SendEntryConfirmationAsync(Entry entry, RecipientType recipientType, CancellationToken ct)
    {
        using var activity = DiagnosticConfig.ActivitySource.StartActivity("Email.Send");
        activity?.SetTag("entry.id", entry.EntryId);
        activity?.SetTag("email.recipientType", recipientType.ToString());
        
        var recipientEmail = recipientType == RecipientType.Handler
            ? entry.ContactEmail!
            : entry.Trial.SecretaryEmail;
            
        var pdfUrl = await _blobService.GenerateSasUrlAsync(entry.EntryId, SasTtl.EmailLink, ct);
        
        var subject = recipientType == RecipientType.Handler
            ? $"Entry Confirmation - {entry.Trial.Name}"
            : $"New Entry Received - {entry.DogCallName} - {entry.Trial.Name}";
            
        var htmlBody = GenerateEmailBody(entry, recipientType, pdfUrl);
        
        var emailMessage = new EmailMessage(
            senderAddress: _options.Value.SenderAddress,
            content: new EmailContent(subject)
            {
                Html = htmlBody
            },
            recipients: new EmailRecipients(new List<EmailAddress>
            {
                new EmailAddress(recipientEmail)
            }));
        
        var operation = await _emailClient.SendAsync(WaitUntil.Completed, emailMessage, ct);
        
        if (operation.Value.Status == EmailSendStatus.Succeeded)
        {
            activity?.SetTag("email.status", "Success");
            _logger.LogInformation("Email sent to {RecipientType} for entry {EntryId}",
                recipientType, entry.EntryId);
        }
        else
        {
            activity?.SetTag("email.status", "Failed");
            throw new EmailSendException($"Email send failed: {operation.Value.Status}");
        }
    }
    
    private string GenerateEmailBody(Entry entry, RecipientType recipientType, string pdfUrl)
    {
        if (recipientType == RecipientType.Handler)
        {
            return $"""
                <h2>Entry Confirmation</h2>
                <p>Your entry for <strong>{entry.Trial.Name}</strong> has been received.</p>
                <p><strong>Registration #:</strong> {entry.RegistrationOrTrackingNumber}</p>
                <p><strong>Dog:</strong> {entry.DogCallName}</p>
                <p><strong>Trial Dates:</strong> {entry.Trial.StartDate:MMM d} - {entry.Trial.EndDate:MMM d, yyyy}</p>
                <p><a href="{pdfUrl}">Download your entry form (PDF)</a></p>
                <p><em>This link expires in 24 hours.</em></p>
                <p>If you have questions, contact the trial secretary at {entry.Trial.SecretaryEmail}.</p>
                """;
        }
        else
        {
            return $"""
                <h2>New Entry Received</h2>
                <p>A new entry has been submitted for <strong>{entry.Trial.Name}</strong>.</p>
                <p><strong>Registration #:</strong> {entry.RegistrationOrTrackingNumber}</p>
                <p><strong>Handler:</strong> {entry.ContactEmail}</p>
                <p><strong>Dog:</strong> {entry.DogCallName} ({entry.DogBreed})</p>
                <p><a href="{pdfUrl}">View entry form (PDF)</a></p>
                <p><em>This link expires in 24 hours.</em></p>
                """;
        }
    }
}
```

## Email Job Handler
```csharp
public class EmailJobHandler : IEmailJobHandler
{
    public async Task HandleAsync(EmailNotificationJob job, CancellationToken ct)
    {
        var notification = await _context.Notifications
            .Include(n => n.Entry)
            .ThenInclude(e => e.Trial)
            .Where(n => n.EntryId == job.EntryId && n.RecipientType == job.RecipientType)
            .FirstOrDefaultAsync(ct);
            
        if (notification is null) return;
        
        // Idempotency check
        if (notification.Status == NotificationStatus.Success)
        {
            _logger.LogDebug("Email already sent for {EntryId} to {RecipientType}",
                job.EntryId, job.RecipientType);
            return;
        }
        
        notification.Status = NotificationStatus.InProgress;
        notification.LastAttemptAtUtc = DateTime.UtcNow;
        notification.AttemptCount++;
        await _context.SaveChangesAsync(ct);
        
        try
        {
            await _emailSender.SendEntryConfirmationAsync(
                notification.Entry, notification.RecipientType, ct);
            
            notification.Status = NotificationStatus.Success;
            notification.SentAtUtc = DateTime.UtcNow;
            notification.LastErrorCode = null;
        }
        catch (Exception ex)
        {
            notification.Status = NotificationStatus.Failed;
            notification.LastErrorCode = "EMAIL_SEND_FAILED";
            notification.NextAttemptAtUtc = RetryCalculator.GetNextAttemptTime(notification.AttemptCount);
            
            _logger.LogError(ex, "Email send failed for {EntryId} to {RecipientType}",
                job.EntryId, job.RecipientType);
        }
        
        await _context.SaveChangesAsync(ct);
    }
}
```

## Configuration
```json
{
  "Email": {
    "ConnectionString": "endpoint=https://dgmvp-acs.communication.azure.com/;accesskey=...",
    "SenderAddress": "DoNotReply@notifications.dogtrial.example.com"
  }
}
```
