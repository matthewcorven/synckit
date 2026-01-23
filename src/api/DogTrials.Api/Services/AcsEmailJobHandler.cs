using Azure;
using Azure.Communication.Email;
using DogTrials.Api.Entities;
using DogTrials.Api.Options;
using Microsoft.Extensions.Options;

namespace DogTrials.Api.Services;

public sealed class AcsEmailJobHandler : IEmailJobHandler
{
    private readonly IBlobStorageService _blobStorageService;
    private readonly IOptions<EmailOptions> _options;
    private readonly ILogger<AcsEmailJobHandler> _logger;

    public AcsEmailJobHandler(
        IBlobStorageService blobStorageService,
        IOptions<EmailOptions> options,
        ILogger<AcsEmailJobHandler> logger)
    {
        _blobStorageService = blobStorageService;
        _options = options;
        _logger = logger;
    }

    public async Task<EmailJobResult> HandleAsync(Notification notification, CancellationToken cancellationToken)
    {
        var entry = notification.Entry;
        if (entry.Trial is null)
        {
            return EmailJobResult.Fail("EMAIL_ENTRY_TRIAL_MISSING");
        }

        var options = _options.Value;
        if (string.IsNullOrWhiteSpace(options.ConnectionString) || string.IsNullOrWhiteSpace(options.SenderAddress))
        {
            _logger.LogWarning("Email configuration missing; cannot send notification for entry {EntryId}", entry.EntryId);
            return EmailJobResult.Fail("EMAIL_CONFIG_MISSING");
        }

        var recipientEmail = notification.RecipientType switch
        {
            RecipientType.Handler => entry.ContactEmail,
            RecipientType.Secretary => entry.Trial.SecretaryEmail,
            _ => null
        };

        if (string.IsNullOrWhiteSpace(recipientEmail))
        {
            _logger.LogWarning("Email recipient missing for entry {EntryId} recipient {RecipientType}", entry.EntryId, notification.RecipientType);
            return EmailJobResult.Fail("EMAIL_RECIPIENT_MISSING");
        }

        var pdfUrl = await _blobStorageService.GenerateSasUrlAsync(entry.EntryId, SasTtl.EmailLink, cancellationToken);
        var subject = EmailTemplateRenderer.BuildSubject(entry, notification.RecipientType);
        var body = EmailTemplateRenderer.BuildHtmlBody(entry, notification.RecipientType, pdfUrl);

        var emailMessage = new EmailMessage(
            senderAddress: options.SenderAddress,
            content: new EmailContent(subject)
            {
                Html = body
            },
            recipients: new EmailRecipients(new List<EmailAddress>
            {
                new EmailAddress(recipientEmail)
            }));

        try
        {
            var emailClient = new EmailClient(options.ConnectionString);
            var operation = await emailClient.SendAsync(WaitUntil.Completed, emailMessage, cancellationToken);

            if (operation.Value.Status == EmailSendStatus.Succeeded)
            {
                _logger.LogInformation("Email sent for entry {EntryId} to {RecipientType}", entry.EntryId, notification.RecipientType);
                return EmailJobResult.Ok(DateTime.UtcNow);
            }

            _logger.LogWarning("Email send failed for entry {EntryId} to {RecipientType}: {Status}", entry.EntryId, notification.RecipientType, operation.Value.Status);
            return EmailJobResult.Fail("EMAIL_SEND_FAILED");
        }
        catch (RequestFailedException ex)
        {
            _logger.LogError(ex, "Email send request failed for entry {EntryId} to {RecipientType}", entry.EntryId, notification.RecipientType);
            return EmailJobResult.Fail("EMAIL_SEND_EXCEPTION");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Email send unexpected error for entry {EntryId} to {RecipientType}", entry.EntryId, notification.RecipientType);
            return EmailJobResult.Fail("EMAIL_SEND_EXCEPTION");
        }
    }
}
