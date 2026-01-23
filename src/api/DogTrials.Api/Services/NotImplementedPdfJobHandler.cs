using DogTrials.Api.Entities;

namespace DogTrials.Api.Services;

public sealed class NotImplementedPdfJobHandler : IPdfJobHandler
{
    public Task<PdfJobResult> HandleAsync(Entry entry, CancellationToken cancellationToken)
    {
        return Task.FromResult(PdfJobResult.Fail("PDF_NOT_IMPLEMENTED"));
    }
}
