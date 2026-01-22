using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace DogTrials.Api.Security;

public sealed class RoleClaimsTransformation : IClaimsTransformation
{
    private static readonly string[] SourceRoleClaimTypes = ["roles", "role", ClaimTypes.Role];
    private readonly string _targetRoleClaimType;

    public RoleClaimsTransformation(IOptions<DogTrials.Api.Options.AuthenticationOptions> options)
    {
        var roleClaimType = options.Value.RoleClaimType;
        _targetRoleClaimType = string.IsNullOrWhiteSpace(roleClaimType)
            ? ClaimTypes.Role
            : roleClaimType;
    }

    public Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        if (principal.Identity is not ClaimsIdentity identity || !identity.IsAuthenticated)
        {
            return Task.FromResult(principal);
        }

        var existingRoles = new HashSet<string>(
            identity.FindAll(_targetRoleClaimType).Select(claim => claim.Value),
            StringComparer.OrdinalIgnoreCase);

        foreach (var claimType in SourceRoleClaimTypes)
        {
            var claims = principal.FindAll(claimType).ToList();
            foreach (var claim in claims)
            {
                if (existingRoles.Add(claim.Value))
                {
                    identity.AddClaim(new Claim(_targetRoleClaimType, claim.Value));
                }
            }
        }

        return Task.FromResult(principal);
    }
}
