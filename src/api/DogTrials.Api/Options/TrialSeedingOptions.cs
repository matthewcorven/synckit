namespace DogTrials.Api.Options;

public sealed class TrialSeedingOptions
{
    public const string SectionName = "TrialSeeding";

    public bool Enabled { get; set; }
    public string? SeedFilePath { get; set; }

    public void ApplyEnvironmentOverrides()
    {
        var enabled = Environment.GetEnvironmentVariable("SEED_TRIALS");
        if (!string.IsNullOrWhiteSpace(enabled) && bool.TryParse(enabled, out var isEnabled))
        {
            Enabled = isEnabled;
        }

        var seedPath = Environment.GetEnvironmentVariable("TRIALS_SEED_PATH");
        if (!string.IsNullOrWhiteSpace(seedPath))
        {
            SeedFilePath = seedPath;
        }
    }

    public string ResolveSeedFilePath()
    {
        return string.IsNullOrWhiteSpace(SeedFilePath)
            ? Path.Combine(AppContext.BaseDirectory, "Data", "trials.seed.json")
            : SeedFilePath;
    }
}
