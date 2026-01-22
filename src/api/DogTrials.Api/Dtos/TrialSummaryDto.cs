namespace DogTrials.Api.Dtos;

public sealed record TrialSummaryDto(
    Guid TrialId,
    string Name,
    FormTemplateKeyDto FormTemplate,
    string OrganizerSlug,
    string EventSlug,
    string TrackingSlug,
    string HostClub,
    string StartDate,
    string EndDate,
    string? Location,
    string SecretaryEmail,
    bool IsActive);
