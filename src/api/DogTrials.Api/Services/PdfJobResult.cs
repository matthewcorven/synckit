namespace DogTrials.Api.Services;

public sealed record PdfJobResult(bool Success, string? ErrorCode = null, string? GeneratedPdfBlobUri = null)
{
    public static PdfJobResult Ok(string? generatedPdfBlobUri = null) => new(true, null, generatedPdfBlobUri);
    public static PdfJobResult Fail(string errorCode) => new(false, errorCode, null);
}
