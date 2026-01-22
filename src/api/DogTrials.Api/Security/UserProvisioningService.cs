using System.Security.Claims;
using DogTrials.Api.Data;
using DogTrials.Api.Entities;
using DogTrials.Api.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DogTrials.Api.Security;

public interface IUserProvisioningService
{
    Task<UserProvisioningResult?> ProvisionAsync(ClaimsPrincipal principal, CancellationToken cancellationToken);
}

public sealed record UserProvisioningResult(Guid UserId, UserRole Role);

public sealed class UserProvisioningService : IUserProvisioningService
{
    private static readonly char[] AllowlistSeparators = [',', ';', '\n', '\r'];

    private readonly DogTrialsDbContext _dbContext;
    private readonly IOptions<UserProvisioningOptions> _options;
    private readonly ILogger<UserProvisioningService> _logger;

    public UserProvisioningService(
        DogTrialsDbContext dbContext,
        IOptions<UserProvisioningOptions> options,
        ILogger<UserProvisioningService> logger)
    {
        _dbContext = dbContext;
        _options = options;
        _logger = logger;
    }

    public async Task<UserProvisioningResult?> ProvisionAsync(ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        if (principal.Identity?.IsAuthenticated != true)
        {
            return null;
        }

        var subject = principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? principal.FindFirstValue("sub")
            ?? principal.FindFirstValue(JwtClaimNames.Subject);
        var email = ExtractEmail(principal);

        if (string.IsNullOrWhiteSpace(subject) || string.IsNullOrWhiteSpace(email))
        {
            _logger.LogWarning("User provisioning skipped because subject or email claim is missing.");
            return null;
        }

        var role = DetermineRole(email, _options.Value.SecretaryEmailAllowlist);
        var utcNow = DateTime.UtcNow;

        var existing = await _dbContext.Users
            .SingleOrDefaultAsync(user => user.ExternalSubject == subject, cancellationToken);

        if (existing is null)
        {
            var created = new User
            {
                UserId = Guid.NewGuid(),
                ExternalSubject = subject,
                Email = email,
                Role = role,
                CreatedAtUtc = utcNow,
                LastLoginAtUtc = utcNow
            };

            _dbContext.Users.Add(created);

            try
            {
                await _dbContext.SaveChangesAsync(cancellationToken);
                _logger.LogInformation("User provisioned with role {Role} and id {UserId}.", role, created.UserId);
                return new UserProvisioningResult(created.UserId, created.Role);
            }
            catch (DbUpdateException)
            {
                existing = await _dbContext.Users
                    .SingleOrDefaultAsync(user => user.ExternalSubject == subject, cancellationToken);
            }
        }

        if (existing is null)
        {
            _logger.LogWarning("User provisioning failed to locate existing user after retry.");
            return null;
        }

        existing.Email = email;
        existing.Role = role;
        existing.LastLoginAtUtc = utcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("User login recorded for {UserId} with role {Role}.", existing.UserId, existing.Role);

        return new UserProvisioningResult(existing.UserId, existing.Role);
    }

    public static string? ExtractEmail(ClaimsPrincipal principal)
    {
        var preferredUsername = principal.FindFirstValue("preferred_username");
        if (!string.IsNullOrWhiteSpace(preferredUsername))
        {
            return preferredUsername;
        }

        var directEmail = principal.FindFirstValue(JwtClaimNames.Email)
            ?? principal.FindFirstValue(ClaimTypes.Email)
            ?? principal.FindFirstValue("email");
        if (!string.IsNullOrWhiteSpace(directEmail))
        {
            return directEmail;
        }

        var emails = principal.FindAll("emails").Select(claim => claim.Value).ToArray();
        foreach (var value in emails)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                var split = value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                var first = split.FirstOrDefault();
                if (!string.IsNullOrWhiteSpace(first))
                {
                    return first;
                }
            }
        }

        return null;
    }

    public static UserRole DetermineRole(string email, string? allowlist)
    {
        if (string.IsNullOrWhiteSpace(allowlist))
        {
            return UserRole.Handler;
        }

        var entries = allowlist
            .Split(AllowlistSeparators, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(entry => entry.ToLowerInvariant())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return entries.Contains(email.ToLowerInvariant())
            ? UserRole.Secretary
            : UserRole.Handler;
    }

    private static class JwtClaimNames
    {
        public const string Subject = "sub";
        public const string Email = "email";
    }
}
