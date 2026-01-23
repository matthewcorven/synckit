using System.Text.Json;
using DogTrials.Api.Dtos;
using DogTrials.Api.Entities;

namespace DogTrials.Api.Endpoints;

internal static class EntryMappingExtensions
{
    public static EntrySummaryDto ToSummaryDto(this Entry entry)
    {
        return new EntrySummaryDto(
            entry.EntryId,
            entry.TrialId,
            entry.Status.ToString(),
            entry.SubmittedAtUtc,
            entry.ContactEmail ?? string.Empty,
            entry.DogCallName ?? string.Empty,
            entry.DogRegisteredName,
            entry.PdfStatus.ToString());
    }

    public static EntryDetailDto ToDetailDto(this Entry entry)
    {
        var trial = entry.Trial;
        var selections = DeserializeSelections(entry.SelectionsJson);
        var notifications = entry.Notifications.Select(n => n.ToDto()).ToList();
        var junior = entry.JuniorDob is not null || !string.IsNullOrWhiteSpace(entry.JuniorMemberId)
            ? new JuniorDto(entry.JuniorDob?.ToString("yyyy-MM-dd"), entry.JuniorMemberId)
            : null;

        return new EntryDetailDto(
            entry.EntryId,
            new TrialInfoDto(
                trial.TrialId,
                trial.Name,
                trial.OrganizerSlug,
                trial.EventSlug,
                trial.TrackingSlug,
                trial.HostClub,
                trial.StartDate.ToString("yyyy-MM-dd"),
                trial.EndDate.ToString("yyyy-MM-dd"),
                trial.SecretaryEmail),
            entry.Status.ToString(),
            new FormTemplateKeyDto(
                trial.OrganizationCode,
                trial.SportCode,
                trial.FormCode,
                trial.FormVersion),
            entry.RegistrationOrTrackingNumber,
            new DogDto(
                entry.RegistrationOrTrackingNumber,
                entry.DogBreed,
                entry.DogRegisteredName,
                entry.DogDob?.ToString("yyyy-MM-dd"),
                entry.DogColor,
                entry.DogCallName,
                entry.DogSex,
                entry.DogSire,
                entry.DogDam,
                entry.DogBreeders),
            new ContactDto(
                entry.ContactOwners,
                new AddressDto(
                    entry.ContactStreet,
                    entry.ContactCity,
                    entry.ContactState,
                    entry.ContactZip),
                entry.ContactEmail,
                entry.ContactPhone,
                entry.ContactHandler,
                entry.ContactMembershipNumber,
                junior),
            new FeesDto(entry.TotalEntryFees, entry.FeesCurrency ?? "USD"),
            new EmergencyContactDto(entry.EmergencyName, entry.EmergencyPhone),
            selections,
            new TermsAcceptanceDto(entry.TermsVersion, entry.TermsAcceptedAtUtc, entry.TermsAcceptedByUserId),
            new EntryProcessingDto(
                entry.PdfStatus.ToString(),
                new GeneratedPdfDto(entry.GeneratedPdfBlobUri, null),
                notifications,
                entry.PdfLastErrorCode is null
                    ? null
                    : new ErrorDto(entry.PdfLastErrorCode, "Processing error")));
    }

    private static NotificationDto ToDto(this Notification notification)
    {
        return new NotificationDto(
            notification.RecipientType.ToString(),
            notification.Status.ToString(),
            notification.SentAtUtc,
            notification.LastErrorCode);
    }

    public static EntrySelectionsDto DeserializeSelections(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return new EntrySelectionsDto(new List<EntrySelectionCellDto>(), new List<EntrySelectionCellDto>());
        }

        try
        {
            var selections = JsonSerializer.Deserialize<EntrySelectionsDto>(
                json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            return selections ?? new EntrySelectionsDto(new List<EntrySelectionCellDto>(), new List<EntrySelectionCellDto>());
        }
        catch (JsonException)
        {
            return new EntrySelectionsDto(new List<EntrySelectionCellDto>(), new List<EntrySelectionCellDto>());
        }
    }
}
