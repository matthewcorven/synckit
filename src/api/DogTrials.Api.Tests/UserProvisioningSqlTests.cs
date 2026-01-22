using System.Security.Claims;
using DogTrials.Api.Data;
using DogTrials.Api.Options;
using DogTrials.Api.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace DogTrials.Api.Tests;

public class UserProvisioningSqlTests
{
    [Fact]
    public async Task ProvisionAsync_PersistsUserInSqlServer()
    {
        var options = TestDatabase.TryCreateSqlServerOptions();
        if (options is null)
        {
            return;
        }

        await using var context = new DogTrialsDbContext(options);
        await context.Database.MigrateAsync();

        var provisioningOptions = Microsoft.Extensions.Options.Options.Create(new UserProvisioningOptions
        {
            SecretaryEmailAllowlist = "secretary@example.com"
        });

        var service = new UserProvisioningService(context, provisioningOptions, NullLogger<UserProvisioningService>.Instance);

        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("sub", "sql-user-1"),
            new Claim("email", "secretary@example.com")
        }, "test"));

        var result = await service.ProvisionAsync(principal, CancellationToken.None);
        Assert.NotNull(result);

        var user = await context.Users.SingleAsync(u => u.ExternalSubject == "sql-user-1");
        Assert.Equal("secretary@example.com", user.Email);
        Assert.Equal(DogTrials.Api.Entities.UserRole.Secretary, user.Role);
        Assert.NotEqual(Guid.Empty, user.UserId);
        Assert.NotEqual(default, user.CreatedAtUtc);
        Assert.NotNull(user.LastLoginAtUtc);
    }
}
