using System.Text.RegularExpressions;
using DogTrials.Api.Dtos;
using DogTrials.Api.Options;
using Microsoft.Extensions.Options;

namespace DogTrials.Api.Services;

public sealed class TermsService : ITermsService
{
    private static readonly Regex ScriptTagRegex = new(
        "<script\\b[^<]*(?:(?!<\\/script>)<[^<]*)*<\\/script>",
        RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.Compiled);

    private static readonly Regex EventHandlerRegex = new(
        "\\s+on\\w+\\s*=\\s*(\".*?\"|'.*?'|[^\\s>]+)",
        RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.Compiled);

    private static readonly Regex JavascriptHrefRegex = new(
        "\\s+(href|src)\\s*=\\s*(\"|')\\s*javascript:[^\"']*(\"|')",
        RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.Compiled);

    private readonly TermsOptions _options;
    private readonly IWebHostEnvironment _environment;

    public TermsService(IOptions<TermsOptions> options, IWebHostEnvironment environment)
    {
        _options = options.Value;
        _environment = environment;
    }

    public async Task<TermsDto> GetCurrentTermsAsync(CancellationToken cancellationToken = default)
    {
        var version = _options.CurrentVersion;
        if (string.IsNullOrWhiteSpace(version))
        {
            throw new InvalidOperationException("Terms current version is not configured.");
        }

        var htmlPath = Path.Combine(_environment.ContentRootPath, "Data", "terms", $"{version}.html");
        if (!File.Exists(htmlPath))
        {
            throw new FileNotFoundException($"Terms file not found: {version}", htmlPath);
        }

        var html = await File.ReadAllTextAsync(htmlPath, cancellationToken);
        var sanitized = SanitizeHtml(html);

        return new TermsDto(version, sanitized);
    }

    private static string SanitizeHtml(string html)
    {
        if (string.IsNullOrWhiteSpace(html))
        {
            return string.Empty;
        }

        var sanitized = ScriptTagRegex.Replace(html, string.Empty);
        sanitized = EventHandlerRegex.Replace(sanitized, string.Empty);
        sanitized = JavascriptHrefRegex.Replace(sanitized, string.Empty);
        return sanitized;
    }
}
