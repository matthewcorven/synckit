using DogTrials.Api.Entities;

namespace DogTrials.Api.Services;

public interface IPdfStampingService
{
    Task<byte[]> GeneratePdfAsync(Entry entry, CancellationToken cancellationToken);
}
