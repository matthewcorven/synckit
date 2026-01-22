using DogTrials.Api.Dtos;

namespace DogTrials.Api.Services;

public interface IFormMetadataService
{
    Task<FormMetadataDto?> GetFormMetadataAsync(FormTemplateKeyDto template);
}
