namespace DogTrials.Api.Services;

public interface IBlobStorageService
{
    Task<string> UploadPdfAsync(Guid entryId, byte[] pdfBytes, CancellationToken ct);
    Task<string> GenerateSasUrlAsync(Guid entryId, TimeSpan ttl, CancellationToken ct);
}
