namespace DogTrials.Api.Dtos;

public sealed record SubmitEntryRequestDto(
    bool AcceptTerms,
    string? TermsVersion);
