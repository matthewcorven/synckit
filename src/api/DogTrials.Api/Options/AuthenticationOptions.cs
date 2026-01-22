namespace DogTrials.Api.Options;

public sealed class AuthenticationOptions
{
    public const string SectionName = "Authentication";

    public string? Authority { get; set; }
    public string? Audience { get; set; }
    public string[] ValidIssuers { get; set; } = Array.Empty<string>();
    public string[] ValidAudiences { get; set; } = Array.Empty<string>();
    public string RoleClaimType { get; set; } = "roles";
    public bool RequireHttpsMetadata { get; set; } = true;
}
