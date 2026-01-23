using DogTrials.Api.Entities;
using DogTrials.Api.Options;
using DogTrials.Api.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace DogTrials.Api.Tests;

public sealed class EmailJobHandlerIntegrationTests
{
    [Fact]
    public async Task SendsEmail_WhenAcsConfigurationProvided()
    {
        var connectionString = Environment.GetEnvironmentVariable("EMAIL_CONNECTION_STRING");
        var senderAddress = Environment.GetEnvironmentVariable("EMAIL_SENDER_ADDRESS");
        var handlerRecipient = Environment.GetEnvironmentVariable("EMAIL_TEST_HANDLER");
        var secretaryRecipient = Environment.GetEnvironmentVariable("EMAIL_TEST_SECRETARY");

        if (string.IsNullOrWhiteSpace(connectionString)
            || string.IsNullOrWhiteSpace(senderAddress)
            || string.IsNullOrWhiteSpace(handlerRecipient)
            || string.IsNullOrWhiteSpace(secretaryRecipient))
        {
            return;
        }

        var options = Microsoft.Extensions.Options.Options.Create(new EmailOptions
        {
            ConnectionString = connectionString,
            SenderAddress = senderAddress
        });

        var blob = new StubBlobStorageService();
        var handler = new AcsEmailJobHandler(blob, options, NullLogger<AcsEmailJobHandler>.Instance);

        var entry = CreateEntry(handlerRecipient, secretaryRecipient);

        var handlerResult = await handler.HandleAsync(new Notification
        {
            EntryId = entry.EntryId,
            RecipientType = RecipientType.Handler,
            Entry = entry
        }, CancellationToken.None);

        var secretaryResult = await handler.HandleAsync(new Notification
        {
            EntryId = entry.EntryId,
            RecipientType = RecipientType.Secretary,
            Entry = entry
        }, CancellationToken.None);

        Assert.True(handlerResult.Success);
        Assert.True(secretaryResult.Success);
    }

    private static Entry CreateEntry(string handlerEmail, string secretaryEmail)
    {
        var trial = new Trial
        {
            TrialId = Guid.NewGuid(),
            Name = "Integration Trial",
            StartDate = new DateOnly(2026, 5, 2),
            EndDate = new DateOnly(2026, 5, 3),
            SecretaryEmail = secretaryEmail
        };

        return new Entry
        {
            EntryId = Guid.NewGuid(),
            TrialId = trial.TrialId,
            RegistrationOrTrackingNumber = "EXCLUB-SPRING-2026-05-02-0001",
            DogCallName = "Ranger",
            ContactEmail = handlerEmail,
            Trial = trial
        };
    }

    private sealed class StubBlobStorageService : IBlobStorageService
    {
        public Task<string> UploadPdfAsync(Guid entryId, byte[] pdfBytes, CancellationToken ct)
        {
            return Task.FromResult($"https://example.com/entries/{entryId}.pdf");
        }

        public Task<string> GenerateSasUrlAsync(Guid entryId, TimeSpan ttl, CancellationToken ct)
        {
            return Task.FromResult($"https://example.com/entries/{entryId}.pdf?sig=stub");
        }
    }
}
