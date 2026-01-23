using DogTrials.Api.Entities;
using DogTrials.Api.Services;

namespace DogTrials.Api.Tests;

public sealed class EmailTemplateRendererTests
{
    [Fact]
    public void BuildSubject_ForHandler_UsesTrialName()
    {
        var entry = CreateEntry();

        var subject = EmailTemplateRenderer.BuildSubject(entry, RecipientType.Handler);

        Assert.Contains(entry.Trial.Name, subject, StringComparison.Ordinal);
        Assert.Contains("Entry Confirmation", subject, StringComparison.Ordinal);
    }

    [Fact]
    public void BuildSubject_ForSecretary_UsesDogAndRegistration()
    {
        var entry = CreateEntry();

        var subject = EmailTemplateRenderer.BuildSubject(entry, RecipientType.Secretary);

        Assert.Contains(entry.DogCallName!, subject, StringComparison.Ordinal);
        Assert.Contains(entry.RegistrationOrTrackingNumber!, subject, StringComparison.Ordinal);
    }

    [Fact]
    public void BuildHtmlBody_ForHandler_IncludesPdfLinkAndSecretary()
    {
        var entry = CreateEntry();
        var pdfUrl = "https://example.com/entries/entry.pdf";

        var body = EmailTemplateRenderer.BuildHtmlBody(entry, RecipientType.Handler, pdfUrl);

        Assert.Contains(pdfUrl, body, StringComparison.Ordinal);
        Assert.Contains(entry.Trial.SecretaryEmail, body, StringComparison.Ordinal);
        Assert.Contains(entry.RegistrationOrTrackingNumber!, body, StringComparison.Ordinal);
    }

    [Fact]
    public void BuildHtmlBody_ForSecretary_IncludesHandlerEmailAndPdfLink()
    {
        var entry = CreateEntry();
        var pdfUrl = "https://example.com/entries/entry.pdf";

        var body = EmailTemplateRenderer.BuildHtmlBody(entry, RecipientType.Secretary, pdfUrl);

        Assert.Contains(pdfUrl, body, StringComparison.Ordinal);
        Assert.Contains(entry.ContactEmail!, body, StringComparison.Ordinal);
        Assert.Contains(entry.DogCallName!, body, StringComparison.Ordinal);
    }

    private static Entry CreateEntry()
    {
        return new Entry
        {
            EntryId = Guid.NewGuid(),
            TrialId = Guid.NewGuid(),
            RegistrationOrTrackingNumber = "EXCLUB-SPRING-2026-05-02-0001",
            DogCallName = "Ranger",
            DogBreed = "Australian Shepherd",
            ContactEmail = "handler@example.com",
            Trial = new Trial
            {
                TrialId = Guid.NewGuid(),
                Name = "Spring Trial",
                StartDate = new DateOnly(2026, 5, 2),
                EndDate = new DateOnly(2026, 5, 3),
                SecretaryEmail = "secretary@example.com"
            }
        };
    }
}
