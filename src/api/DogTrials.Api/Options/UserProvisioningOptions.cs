namespace DogTrials.Api.Options;

public sealed class UserProvisioningOptions
{
    public const string SectionName = "UserProvisioning";

    public string? SecretaryEmailAllowlist { get; set; }

    public void ApplyEnvironmentOverrides()
    {
        var allowlist = Environment.GetEnvironmentVariable("SECRETARY_EMAIL_ALLOWLIST");
        if (!string.IsNullOrWhiteSpace(allowlist))
        {
            SecretaryEmailAllowlist = allowlist;
        }
    }
}
