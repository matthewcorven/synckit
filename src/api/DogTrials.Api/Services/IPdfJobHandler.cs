using DogTrials.Api.Entities;

namespace DogTrials.Api.Services;

public interface IPdfJobHandler
{
    Task<PdfJobResult> HandleAsync(Entry entry, CancellationToken cancellationToken);
}
