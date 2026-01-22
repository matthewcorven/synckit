using System.Security.Claims;
using DogTrials.Api.Data;
using DogTrials.Api.Entities;
using DogTrials.Api.Options;
using DogTrials.Api.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace DogTrials.Api.Tests;

public class UserProvisioningServiceTests
{
    [Fact]
    public void ExtractEmail_PrefersPreferredUsername()
    {
        var principal = BuildPrincipal(
            new Claim("preferred_username", "preferred@example.com"),
            new Claim("email", "email@example.com"));

        var email = UserProvisioningService.ExtractEmail(principal);

        Assert.Equal("preferred@example.com", email);
    }

    [Fact]
    public void ExtractEmail_FallsBackToEmailThenEmailsArray()
    {
        var principal = BuildPrincipal(
            new Claim("emails", "first@example.com,second@example.com"));

        var email = UserProvisioningService.ExtractEmail(principal);

        Assert.Equal("first@example.com", email);
    }

    [Fact]
    public void DetermineRole_UsesAllowlistAndIsCaseInsensitive()
    {
        var allowlist = "secretary@example.com;Other@Example.com\nthird@example.com";

        var secretaryRole = UserProvisioningService.DetermineRole("Secretary@Example.com", allowlist);
        var handlerRole = UserProvisioningService.DetermineRole("handler@example.com", allowlist);

        Assert.Equal(UserRole.Secretary, secretaryRole);
        Assert.Equal(UserRole.Handler, handlerRole);
    }

    [Fact]
    public async Task ProvisionAsync_CreatesAndUpdatesUser()
    {
        var options = new DbContextOptionsBuilder<DogTrialsDbContext>()
            .UseInMemoryDatabase("UserProvisioningTests")
            .Options;

        await using var context = new DogTrialsDbContext(options);

        var provisioningOptions = Microsoft.Extensions.Options.Options.Create(new UserProvisioningOptions
        {
            SecretaryEmailAllowlist = "secretary@example.com"
        });

        var service = new UserProvisioningService(context, provisioningOptions, NullLogger<UserProvisioningService>.Instance);

        var principal = BuildPrincipal(
            new Claim("sub", "subject-1"),
            new Claim("email", "secretary@example.com"));

        var firstResult = await service.ProvisionAsync(principal, CancellationToken.None);
        Assert.NotNull(firstResult);

        var user = await context.Users.SingleAsync();
        Assert.Equal(UserRole.Secretary, user.Role);
        Assert.Equal("subject-1", user.ExternalSubject);
        Assert.NotNull(user.LastLoginAtUtc);
        var firstLogin = user.LastLoginAtUtc;

        await Task.Delay(10);
        var secondResult = await service.ProvisionAsync(principal, CancellationToken.None);
        Assert.NotNull(secondResult);
        Assert.Equal(user.UserId, secondResult!.UserId);

        var updatedUser = await context.Users.SingleAsync();
        Assert.True(updatedUser.LastLoginAtUtc >= firstLogin);
    }

    [Fact]
    public async Task ProvisionAsync_MissingClaims_ReturnsNull()
    {
        var options = new DbContextOptionsBuilder<DogTrialsDbContext>()
            .UseInMemoryDatabase("UserProvisioningTestsMissingClaims")
            .Options;

        await using var context = new DogTrialsDbContext(options);
        var provisioningOptions = Microsoft.Extensions.Options.Options.Create(new UserProvisioningOptions());
        var service = new UserProvisioningService(context, provisioningOptions, NullLogger<UserProvisioningService>.Instance);

        var principal = BuildPrincipal(new Claim("email", "handler@example.com"));

        var result = await service.ProvisionAsync(principal, CancellationToken.None);

        Assert.Null(result);
        Assert.Empty(context.Users);
    }

    private static ClaimsPrincipal BuildPrincipal(params Claim[] claims)
    {
        var identity = new ClaimsIdentity(claims, "test");
        return new ClaimsPrincipal(identity);
    }
}
