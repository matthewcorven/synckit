namespace DogTrials.Api.Options;

public sealed class TestAuthOptions
{
    public const string SectionName = "TestAuth";

    public bool Enabled { get; set; }
    public string Secret { get; set; } = "dev-only-secret-change-me";
    public string SigningKey { get; set; } = "dev-only-testauth-signing-key-change-me-32-bytes-min";
    public string Issuer { get; set; } = "dog-trials.testauth";
    public string Audience { get; set; } = "dog-trials.api";
    public int TokenLifetimeMinutes { get; set; } = 15;

    public void ApplyEnvironmentOverrides()
    {
        var enabled = Environment.GetEnvironmentVariable("ENABLE_TEST_AUTH");
        if (!string.IsNullOrWhiteSpace(enabled) && bool.TryParse(enabled, out var isEnabled))
        {
            Enabled = isEnabled;
        }

        var secret = Environment.GetEnvironmentVariable("TEST_AUTH_SECRET");
        if (!string.IsNullOrWhiteSpace(secret))
        {
            Secret = secret;
        }

        var signingKey = Environment.GetEnvironmentVariable("TEST_AUTH_SIGNING_KEY");
        if (!string.IsNullOrWhiteSpace(signingKey))
        {
            SigningKey = signingKey;
        }
    }
}
