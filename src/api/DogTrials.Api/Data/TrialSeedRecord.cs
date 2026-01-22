namespace DogTrials.Api.Data;

public sealed record TrialSeedRecord
{
    public string Name { get; init; } = string.Empty;
    public string OrganizationCode { get; init; } = string.Empty;
    public string SportCode { get; init; } = string.Empty;
    public string FormCode { get; init; } = string.Empty;
    public string FormVersion { get; init; } = string.Empty;
    public string OrganizerSlug { get; init; } = string.Empty;
    public string EventSlug { get; init; } = string.Empty;
    public string HostClub { get; init; } = string.Empty;
    public string StartDate { get; init; } = string.Empty;
    public string EndDate { get; init; } = string.Empty;
    public string? Location { get; init; }
    public string SecretaryEmail { get; init; } = string.Empty;
    public bool IsActive { get; init; }
}
