using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using DogTrials.Api.Options;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Options;

namespace DogTrials.Api.Endpoints;

public static class TestAuthEndpoints
{
    private const int DefaultExpiresInSeconds = 900;

    public static IEndpointRouteBuilder MapTestAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/testauth");

        group.MapPost("/token", (HttpContext context, IOptions<TestAuthOptions> optionsAccessor, ILoggerFactory loggerFactory) =>
            {
                var options = optionsAccessor.Value;
                if (!options.Enabled)
                {
                    return Results.NotFound();
                }

                var logger = loggerFactory.CreateLogger("Security.TestAuth");
                var secret = context.Request.Headers["X-Test-Auth-Secret"].FirstOrDefault();
                if (!IsSecretValid(secret, options.Secret))
                {
                    logger.LogWarning("SecurityEvent: TestAuth invalid secret attempt");
                    return Results.Problem(title: "Unauthorized", statusCode: StatusCodes.Status401Unauthorized);
                }

                var role = context.Request.Headers["X-Test-Role"].FirstOrDefault();
                if (!IsRoleValid(role))
                {
                    return Results.Problem(
                        title: "Invalid role",
                        detail: "X-Test-Role must be Handler or Secretary",
                        statusCode: StatusCodes.Status400BadRequest);
                }

                if (string.IsNullOrWhiteSpace(options.SigningKey) || options.SigningKey.Length < 32)
                {
                    logger.LogWarning("SecurityEvent: TestAuth signing key is missing or too short");
                    return Results.Problem(
                        title: "TestAuth not configured",
                        detail: "Signing key is missing or too short.",
                        statusCode: StatusCodes.Status500InternalServerError);
                }

                var now = DateTimeOffset.UtcNow;
                var email = role == "Secretary" ? "secretary@example.com" : "handler@example.com";

                var claims = new List<Claim>
                {
                    new(JwtRegisteredClaimNames.Sub, Guid.NewGuid().ToString()),
                    new(JwtRegisteredClaimNames.Email, email),
                    new(ClaimTypes.Role, role!),
                    new("role", role!)
                };

                var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.SigningKey));
                var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
                var token = new JwtSecurityToken(
                    issuer: options.Issuer,
                    audience: options.Audience,
                    claims: claims,
                    notBefore: now.UtcDateTime,
                    expires: now.AddMinutes(options.TokenLifetimeMinutes).UtcDateTime,
                    signingCredentials: credentials);

                var accessToken = new JwtSecurityTokenHandler().WriteToken(token);

                logger.LogWarning("SecurityEvent: TestAuth token issued for role {Role}", role);

                return Results.Ok(new
                {
                    accessToken,
                    expiresInSeconds = options.TokenLifetimeMinutes * 60,
                    role
                });
            })
            .AllowAnonymous();

        group.MapGet("/validate", [Authorize] (ClaimsPrincipal user, IOptions<TestAuthOptions> optionsAccessor) =>
            {
                var options = optionsAccessor.Value;
                if (!options.Enabled)
                {
                    return Results.NotFound();
                }

                var role = user.FindFirstValue(ClaimTypes.Role) ?? user.FindFirstValue("role");
                var subject = user.FindFirstValue(JwtRegisteredClaimNames.Sub);

                return Results.Ok(new
                {
                    subject,
                    role
                });
            })
            .RequireAuthorization();

        return app;
    }

    private static bool IsSecretValid(string? provided, string expected)
    {
        if (string.IsNullOrWhiteSpace(provided) || string.IsNullOrWhiteSpace(expected))
        {
            return false;
        }

        var providedBytes = Encoding.UTF8.GetBytes(provided);
        var expectedBytes = Encoding.UTF8.GetBytes(expected);

        return providedBytes.Length == expectedBytes.Length
            && CryptographicOperations.FixedTimeEquals(providedBytes, expectedBytes);
    }

    private static bool IsRoleValid(string? role)
        => role is "Handler" or "Secretary";
}
