namespace DogTrials.Api.Entities;

public sealed class Entry
{
    public Guid EntryId { get; set; }
    public Guid TrialId { get; set; }
    public Guid CreatedByUserId { get; set; }

    public EntryStatus Status { get; set; } = EntryStatus.Draft;
    public int? SequenceNumber { get; set; }
    public string? RegistrationOrTrackingNumber { get; set; }
    public DateTime? SubmittedAtUtc { get; set; }

    public string? DogBreed { get; set; }
    public string? DogRegisteredName { get; set; }
    public string? DogCallName { get; set; }
    public DateOnly? DogDob { get; set; }
    public string? DogColor { get; set; }
    public string? DogSex { get; set; }
    public string? DogSire { get; set; }
    public string? DogDam { get; set; }
    public string? DogBreeders { get; set; }

    public string? ContactOwners { get; set; }
    public string? ContactStreet { get; set; }
    public string? ContactCity { get; set; }
    public string? ContactState { get; set; }
    public string? ContactZip { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public string? ContactHandler { get; set; }
    public string? ContactMembershipNumber { get; set; }
    public DateOnly? JuniorDob { get; set; }
    public string? JuniorMemberId { get; set; }

    public string? EmergencyName { get; set; }
    public string? EmergencyPhone { get; set; }
    public decimal? TotalEntryFees { get; set; }
    public string? FeesCurrency { get; set; }

    public string? SelectionsJson { get; set; }

    public string? TermsVersion { get; set; }
    public DateTime? TermsAcceptedAtUtc { get; set; }
    public Guid? TermsAcceptedByUserId { get; set; }

    public PdfStatus PdfStatus { get; set; } = PdfStatus.Queued;
    public string? GeneratedPdfBlobUri { get; set; }
    public int PdfAttemptCount { get; set; }
    public DateTime? PdfNextAttemptAtUtc { get; set; }
    public DateTime? PdfLastAttemptAtUtc { get; set; }
    public string? PdfLastErrorCode { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    public Trial Trial { get; set; } = null!;
    public User CreatedByUser { get; set; } = null!;
}

public enum EntryStatus
{
    Draft,
    Submitted
}

public enum PdfStatus
{
    Queued,
    InProgress,
    Success,
    Failed
}
