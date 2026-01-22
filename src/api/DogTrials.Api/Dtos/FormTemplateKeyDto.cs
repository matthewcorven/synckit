namespace DogTrials.Api.Dtos;

public sealed record FormTemplateKeyDto(
    string OrganizationCode,
    string SportCode,
    string FormCode,
    string Version);
