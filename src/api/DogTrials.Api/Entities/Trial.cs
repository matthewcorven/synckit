namespace DogTrials.Api.Entities;

public sealed class Trial
{
    public Guid TrialId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string OrganizationCode { get; set; } = string.Empty;
    public string SportCode { get; set; } = string.Empty;
    public string FormCode { get; set; } = string.Empty;
    public string FormVersion { get; set; } = string.Empty;
    public string OrganizerSlug { get; set; } = string.Empty;
    public string EventSlug { get; set; } = string.Empty;
    public string TrackingSlug { get; set; } = string.Empty;
    public string HostClub { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string? Location { get; set; }
    public string SecretaryEmail { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
}
