namespace DogTrials.Api.Dtos;

public sealed record EntrySummaryDto(
    Guid EntryId,
    Guid TrialId,
    string Status,
    DateTime? SubmittedAtUtc,
    string HandlerEmail,
    string DogCallName,
    string? DogRegisteredName,
    string PdfStatus);
