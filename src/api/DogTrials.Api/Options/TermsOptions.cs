namespace DogTrials.Api.Options;

public sealed class TermsOptions
{
    public const string SectionName = "Terms";

    public string? CurrentVersion { get; set; }

    public void ApplyEnvironmentOverrides()
    {
        var version = Environment.GetEnvironmentVariable("TERMS_VERSION");
        if (!string.IsNullOrWhiteSpace(version))
        {
            CurrentVersion = version;
        }
    }
}
