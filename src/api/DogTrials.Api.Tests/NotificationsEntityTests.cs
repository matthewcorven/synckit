using DogTrials.Api.Data;
using DogTrials.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;

namespace DogTrials.Api.Tests;

public class NotificationsEntityTests
{
    [Fact]
    public void NotificationModel_ConfiguresConstraintsAndIndexes()
    {
        var options = new DbContextOptionsBuilder<DogTrialsDbContext>()
            .UseInMemoryDatabase("NotificationModelTests")
            .Options;

        using var context = new DogTrialsDbContext(options);
        var designTimeModel = context.GetService<IDesignTimeModel>().Model;
        var entity = designTimeModel.FindEntityType(typeof(Notification));

        Assert.NotNull(entity);

        var uniqueIndex = entity!.GetIndexes()
            .SingleOrDefault(i => i.GetDatabaseName() == "UX_Notifications_EntryId_RecipientType");

        Assert.NotNull(uniqueIndex);
        Assert.True(uniqueIndex!.IsUnique);

        var retryIndex = entity.GetIndexes()
            .SingleOrDefault(i => i.GetDatabaseName() == "IX_Notifications_Status_NextAttemptAtUtc");

        Assert.NotNull(retryIndex);
    }

    [Fact]
    public async Task Notification_InsertWithoutEntry_FailsWhenUsingSqlServer()
    {
        var options = TestDatabase.TryCreateSqlServerOptions();
        if (options is null)
        {
            return;
        }

        await using var context = new DogTrialsDbContext(options);
        await context.Database.EnsureDeletedAsync();
        await context.Database.MigrateAsync();

        context.Notifications.Add(new Notification
        {
            NotificationId = Guid.NewGuid(),
            EntryId = Guid.NewGuid(),
            RecipientType = RecipientType.Handler
        });

        await Assert.ThrowsAnyAsync<DbUpdateException>(() => context.SaveChangesAsync());
    }

    [Fact]
    public async Task Notification_DuplicateRecipientType_FailsWhenUsingSqlServer()
    {
        var options = TestDatabase.TryCreateSqlServerOptions();
        if (options is null)
        {
            return;
        }

        await using var context = new DogTrialsDbContext(options);
        await context.Database.EnsureDeletedAsync();
        await context.Database.MigrateAsync();

        var trial = BuildTrial();
        var user = BuildUser();
        var entry = new Entry
        {
            EntryId = Guid.NewGuid(),
            TrialId = trial.TrialId,
            CreatedByUserId = user.UserId,
            Status = EntryStatus.Draft
        };

        context.Trials.Add(trial);
        context.Users.Add(user);
        context.Entries.Add(entry);
        await context.SaveChangesAsync();

        context.Notifications.AddRange(
            new Notification
            {
                NotificationId = Guid.NewGuid(),
                EntryId = entry.EntryId,
                RecipientType = RecipientType.Handler
            },
            new Notification
            {
                NotificationId = Guid.NewGuid(),
                EntryId = entry.EntryId,
                RecipientType = RecipientType.Handler
            });

        await Assert.ThrowsAnyAsync<DbUpdateException>(() => context.SaveChangesAsync());
    }

    private static Trial BuildTrial() => new()
    {
        TrialId = Guid.NewGuid(),
        Name = "Sample Trial",
        OrganizationCode = "ASCA",
        SportCode = "StockDog",
        FormCode = "TrialEntry",
        FormVersion = "2020-10-08",
        OrganizerSlug = "EXCLUB",
        EventSlug = "SPRING-2026-05-02",
        HostClub = "Example Club",
        StartDate = new DateOnly(2026, 5, 2),
        EndDate = new DateOnly(2026, 5, 3),
        Location = "Bryan, TX",
        SecretaryEmail = "secretary@example.com",
        IsActive = true
    };

    private static User BuildUser() => new()
    {
        UserId = Guid.NewGuid(),
        ExternalSubject = Guid.NewGuid().ToString("N"),
        Email = "handler@example.com",
        Role = UserRole.Handler
    };
}
