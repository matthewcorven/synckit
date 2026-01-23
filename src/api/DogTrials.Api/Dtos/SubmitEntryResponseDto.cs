namespace DogTrials.Api.Dtos;

public sealed record SubmitEntryResponseDto(
    Guid EntryId,
    string Status,
    string SupportId);
