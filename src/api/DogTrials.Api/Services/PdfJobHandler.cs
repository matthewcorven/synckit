using DogTrials.Api.Entities;

namespace DogTrials.Api.Services;

public sealed class PdfJobHandler : IPdfJobHandler
{
    private readonly IPdfStampingService _stampingService;
    private readonly ILogger<PdfJobHandler> _logger;

    public PdfJobHandler(IPdfStampingService stampingService, ILogger<PdfJobHandler> logger)
    {
        _stampingService = stampingService;
        _logger = logger;
    }

    public async Task<PdfJobResult> HandleAsync(Entry entry, CancellationToken cancellationToken)
    {
        var pdfBytes = await _stampingService.GeneratePdfAsync(entry, cancellationToken);
        _logger.LogInformation("Generated PDF bytes for entry {EntryId} ({Length} bytes)", entry.EntryId, pdfBytes.Length);
        return PdfJobResult.Ok();
    }
}
