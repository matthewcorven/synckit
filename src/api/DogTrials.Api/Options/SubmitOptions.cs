namespace DogTrials.Api.Options;

public sealed class SubmitOptions
{
    public const string SectionName = "Submit";

    public bool AllowDifferentEmail { get; set; }

    public void ApplyEnvironmentOverrides()
    {
        var allowOverride = Environment.GetEnvironmentVariable("ALLOW_ENTRY_EMAIL_DIFFERENT_FROM_LOGIN");
        if (bool.TryParse(allowOverride, out var allowDifferent))
        {
            AllowDifferentEmail = allowDifferent;
        }
    }
}
