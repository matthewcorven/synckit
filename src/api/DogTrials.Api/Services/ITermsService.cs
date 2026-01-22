using DogTrials.Api.Dtos;

namespace DogTrials.Api.Services;

public interface ITermsService
{
    Task<TermsDto> GetCurrentTermsAsync(CancellationToken cancellationToken = default);
}
