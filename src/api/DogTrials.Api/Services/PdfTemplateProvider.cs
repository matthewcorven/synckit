using Microsoft.Extensions.Logging;

namespace DogTrials.Api.Services;

public interface IPdfTemplateProvider
{
    Task<byte[]> LoadTemplateAsync(CancellationToken cancellationToken);
    string? TemplatePath { get; }
}

public sealed class PdfTemplateProvider : IPdfTemplateProvider
{
    private readonly string[] _candidatePaths;
    private readonly ILogger<PdfTemplateProvider> _logger;

    public PdfTemplateProvider(IWebHostEnvironment environment, ILogger<PdfTemplateProvider> logger)
    {
        _logger = logger;

        var contentRoot = environment.ContentRootPath;
        _candidatePaths = new[]
        {
            Path.GetFullPath(Path.Combine(contentRoot, "Assets", "templates", "asca-stockdog-entry.pdf")),
            Path.GetFullPath(Path.Combine(contentRoot, "..", "..", "docs", "assets", "asca-entry-form.pdf"))
        };
    }

    public string? TemplatePath { get; private set; }

    public async Task<byte[]> LoadTemplateAsync(CancellationToken cancellationToken)
    {
        foreach (var path in _candidatePaths)
        {
            if (!File.Exists(path))
            {
                continue;
            }

            TemplatePath = path;
            _logger.LogInformation("Loading PDF template from {TemplatePath}", path);
            return await File.ReadAllBytesAsync(path, cancellationToken);
        }

        throw new FileNotFoundException("PDF template not found.");
    }
}
