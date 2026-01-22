namespace DogTrials.Api.Dtos;

public sealed record TrialInfoDto(
    Guid TrialId,
    string Name,
    string OrganizerSlug,
    string EventSlug,
    string TrackingSlug,
    string HostClub,
    string StartDate,
    string EndDate,
    string SecretaryEmail);

public sealed record DogDto(
    string? AscaRegistrationNumber,
    string? Breed,
    string? RegisteredName,
    string? Dob,
    string? Color,
    string? CallName,
    string? Sex,
    string? Sire,
    string? Dam,
    string? Breeders);

public sealed record AddressDto(
    string? Street,
    string? City,
    string? State,
    string? Zip);

public sealed record JuniorDto(
    string? Dob,
    string? MemberId);

public sealed record ContactDto(
    string? Owners,
    AddressDto OwnerAddress,
    string? Email,
    string? Phone,
    string? Handler,
    string? MembershipNumber,
    JuniorDto? Junior);

public sealed record FeesDto(
    decimal? TotalEntryFees,
    string? Currency);

public sealed record EmergencyContactDto(
    string? Name,
    string? PhoneOrNumber);

public sealed record EntrySelectionCellDto(
    string Row,
    string Col,
    string? Value);

public sealed record EntrySelectionsDto(
    List<EntrySelectionCellDto> Upper,
    List<EntrySelectionCellDto> Lower);

public sealed record TermsAcceptanceDto(
    string? Version,
    DateTime? AcceptedAtUtc,
    Guid? AcceptedByUserId);

public sealed record GeneratedPdfDto(
    string? BlobUri,
    string? DownloadUrl);

public sealed record NotificationDto(
    string RecipientType,
    string Status,
    DateTime? SentAtUtc,
    string? LastError);

public sealed record ErrorDto(
    string Code,
    string Message);

public sealed record EntryProcessingDto(
    string PdfStatus,
    GeneratedPdfDto GeneratedPdf,
    List<NotificationDto> EmailNotifications,
    ErrorDto? LastError);

public sealed record EntryDetailDto(
    Guid EntryId,
    TrialInfoDto Trial,
    string Status,
    FormTemplateKeyDto FormTemplate,
    string? EntryNumber,
    DogDto Dog,
    ContactDto Contact,
    FeesDto Fees,
    EmergencyContactDto EmergencyContact,
    EntrySelectionsDto Selections,
    TermsAcceptanceDto Terms,
    EntryProcessingDto Processing);
