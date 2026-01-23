using System.Globalization;
using DogTrials.Api.Entities;

namespace DogTrials.Api.Services;

public static class EmailTemplateRenderer
{
    public static string BuildSubject(Entry entry, RecipientType recipientType)
    {
        var trialName = entry.Trial.Name;
        var dogName = entry.DogCallName ?? "Unknown dog";
        var registrationNumber = entry.RegistrationOrTrackingNumber ?? "Pending";

        return recipientType == RecipientType.Handler
            ? $"Entry Confirmation - {trialName}"
            : $"New Entry Received - {dogName} - {trialName} ({registrationNumber})";
    }

    public static string BuildHtmlBody(Entry entry, RecipientType recipientType, string pdfUrl)
    {
        var trialName = entry.Trial.Name;
        var registrationNumber = entry.RegistrationOrTrackingNumber ?? "Pending";
        var dogName = entry.DogCallName ?? "Unknown dog";
        var dogBreed = entry.DogBreed ?? "";
        var dateRange = FormatDateRange(entry.Trial.StartDate, entry.Trial.EndDate);
        var secretaryEmail = entry.Trial.SecretaryEmail;
        var handlerEmail = entry.ContactEmail ?? "";

        return recipientType switch
        {
            RecipientType.Handler => $"""
                <h2>Entry Confirmation</h2>
                <p>Your entry for <strong>{trialName}</strong> has been received.</p>
                <p><strong>Registration #:</strong> {registrationNumber}</p>
                <p><strong>Dog:</strong> {dogName}</p>
                <p><strong>Trial Dates:</strong> {dateRange}</p>
                <p><a href=\"{pdfUrl}\">Download your entry form (PDF)</a></p>
                <p><em>This link expires in 24 hours.</em></p>
                <p>If you have questions, contact the trial secretary at {secretaryEmail}.</p>
                """,
            RecipientType.Secretary => $"""
                <h2>New Entry Received</h2>
                <p>A new entry has been submitted for <strong>{trialName}</strong>.</p>
                <p><strong>Registration #:</strong> {registrationNumber}</p>
                <p><strong>Handler:</strong> {handlerEmail}</p>
                <p><strong>Dog:</strong> {dogName} {FormatBreed(dogBreed)}</p>
                <p><a href=\"{pdfUrl}\">View entry form (PDF)</a></p>
                <p><em>This link expires in 24 hours.</em></p>
                """,
            _ => throw new ArgumentOutOfRangeException(nameof(recipientType), recipientType, "Unsupported recipient type")
        };
    }

    private static string FormatDateRange(DateOnly startDate, DateOnly endDate)
    {
        var start = startDate.ToString("MMM d", CultureInfo.InvariantCulture);
        var end = endDate.ToString("MMM d, yyyy", CultureInfo.InvariantCulture);
        return $"{start} - {end}";
    }

    private static string FormatBreed(string breed)
    {
        return string.IsNullOrWhiteSpace(breed) ? string.Empty : $"({breed})";
    }
}
