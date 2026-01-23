namespace DogTrials.Api.Dtos;

public sealed record NotificationStatusDto(
    string RecipientType,
    string Status,
    DateTime? SentAtUtc,
    string? LastError);

public sealed record ProcessingStatusDto(
    Guid EntryId,
    string PdfStatus,
    string? GeneratedPdfDownloadUrl,
    List<NotificationStatusDto> EmailNotifications,
    ErrorDto? LastError);