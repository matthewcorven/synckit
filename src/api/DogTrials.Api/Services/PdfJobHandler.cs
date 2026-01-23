using DogTrials.Api.Entities;

namespace DogTrials.Api.Services;

public sealed class PdfJobHandler : IPdfJobHandler
{
    private readonly IPdfStampingService _stampingService;
    private readonly IBlobStorageService _blobStorageService;
    private readonly ILogger<PdfJobHandler> _logger;

    public PdfJobHandler(
        IPdfStampingService stampingService,
        IBlobStorageService blobStorageService,
        ILogger<PdfJobHandler> logger)
    {
        _stampingService = stampingService;
        _blobStorageService = blobStorageService;
        _logger = logger;
    }

    public async Task<PdfJobResult> HandleAsync(Entry entry, CancellationToken cancellationToken)
    {
        var pdfBytes = await _stampingService.GeneratePdfAsync(entry, cancellationToken);
        _logger.LogInformation("Generated PDF bytes for entry {EntryId} ({Length} bytes)", entry.EntryId, pdfBytes.Length);

        var blobUri = await _blobStorageService.UploadPdfAsync(entry.EntryId, pdfBytes, cancellationToken);
        _logger.LogInformation("Uploaded PDF for entry {EntryId} to blob storage", entry.EntryId);

        return PdfJobResult.Ok(blobUri);
    }
}
