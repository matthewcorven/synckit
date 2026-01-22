using DogTrials.Api.Data;
using DogTrials.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;

namespace DogTrials.Api.Tests;

public class UsersEntityTests
{
    [Fact]
    public void UserModel_ConfiguresUniqueConstraintAndIndexes()
    {
        var options = new DbContextOptionsBuilder<DogTrialsDbContext>()
            .UseInMemoryDatabase("UserModelTests")
            .Options;

        using var context = new DogTrialsDbContext(options);
        var designTimeModel = context.GetService<IDesignTimeModel>().Model;
        var entity = designTimeModel.FindEntityType(typeof(User));

        Assert.NotNull(entity);

        var externalSubject = entity!.FindProperty(nameof(User.ExternalSubject));
        Assert.NotNull(externalSubject);
        Assert.Equal(256, externalSubject!.GetMaxLength());

        var email = entity.FindProperty(nameof(User.Email));
        Assert.NotNull(email);
        Assert.Equal(320, email!.GetMaxLength());

        var uniqueIndex = entity.GetIndexes()
            .SingleOrDefault(i => i.GetDatabaseName() == "UX_Users_ExternalSubject");

        Assert.NotNull(uniqueIndex);
        Assert.True(uniqueIndex!.IsUnique);

        var emailIndex = entity.GetIndexes()
            .SingleOrDefault(i => i.GetDatabaseName() == "IX_Users_Email");

        Assert.NotNull(emailIndex);
    }

    [Fact]
    public async Task UserInsert_DuplicateExternalSubject_FailsWhenUsingSqlServer()
    {
        var options = TestDatabase.TryCreateSqlServerOptions();
        if (options is null)
        {
            return;
        }

        await using var context = new DogTrialsDbContext(options);
        await context.Database.EnsureDeletedAsync();
        await context.Database.MigrateAsync();

        var externalSubject = Guid.NewGuid().ToString("N");

        context.Users.Add(new User
        {
            UserId = Guid.NewGuid(),
            ExternalSubject = externalSubject,
            Email = "handler@example.com",
            Role = UserRole.Handler
        });

        await context.SaveChangesAsync();

        context.Users.Add(new User
        {
            UserId = Guid.NewGuid(),
            ExternalSubject = externalSubject,
            Email = "handler2@example.com",
            Role = UserRole.Handler
        });

        await Assert.ThrowsAnyAsync<DbUpdateException>(() => context.SaveChangesAsync());
    }
}
