using DogTrials.Api.Data;
using DogTrials.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;

namespace DogTrials.Api.Tests;

public class EntriesEntityTests
{
    [Fact]
    public void EntryModel_ConfiguresConstraintsAndIndexes()
    {
        var options = new DbContextOptionsBuilder<DogTrialsDbContext>()
            .UseInMemoryDatabase("EntryModelTests")
            .Options;

        using var context = new DogTrialsDbContext(options);
        var designTimeModel = context.GetService<IDesignTimeModel>().Model;
        var entity = designTimeModel.FindEntityType(typeof(Entry));

        Assert.NotNull(entity);

        var checkConstraint = entity!.GetCheckConstraints()
            .SingleOrDefault(c => c.Name == "CK_Entries_SequenceNumber_Positive");

        Assert.NotNull(checkConstraint);
        Assert.Equal("[SequenceNumber] IS NULL OR [SequenceNumber] >= 1", checkConstraint!.Sql);

        var sequenceIndex = entity.GetIndexes()
            .SingleOrDefault(i => i.GetDatabaseName() == "UX_Entries_TrialId_SequenceNumber");

        Assert.NotNull(sequenceIndex);
        Assert.True(sequenceIndex!.IsUnique);
        Assert.Equal("[SequenceNumber] IS NOT NULL", sequenceIndex.GetFilter());

        var regIndex = entity.GetIndexes()
            .SingleOrDefault(i => i.GetDatabaseName() == "UX_Entries_RegistrationOrTrackingNumber");

        Assert.NotNull(regIndex);
        Assert.True(regIndex!.IsUnique);
        Assert.Equal("[RegistrationOrTrackingNumber] IS NOT NULL", regIndex.GetFilter());

        var draftIndex = entity.GetIndexes()
            .SingleOrDefault(i => i.GetDatabaseName() == "UX_Entries_TrialId_CreatedByUserId_Draft");

        Assert.NotNull(draftIndex);
        Assert.True(draftIndex!.IsUnique);
        Assert.Equal("[Status] = 'Draft'", draftIndex.GetFilter());

        var retryIndex = entity.GetIndexes()
            .SingleOrDefault(i => i.GetDatabaseName() == "IX_Entries_Status_PdfStatus_PdfNextAttemptAtUtc");

        Assert.NotNull(retryIndex);
    }

    [Fact]
    public async Task Entry_InsertWithoutValidTrial_FailsWhenUsingSqlServer()
    {
        var options = TestDatabase.TryCreateSqlServerOptions();
        if (options is null)
        {
            return;
        }

        await using var context = new DogTrialsDbContext(options);
        await context.Database.EnsureDeletedAsync();
        await context.Database.MigrateAsync();

        var user = BuildUser();
        context.Users.Add(user);
        await context.SaveChangesAsync();

        context.Entries.Add(new Entry
        {
            EntryId = Guid.NewGuid(),
            TrialId = Guid.NewGuid(),
            CreatedByUserId = user.UserId,
            Status = EntryStatus.Draft
        });

        await Assert.ThrowsAnyAsync<DbUpdateException>(() => context.SaveChangesAsync());
    }

    [Fact]
    public async Task Entry_DuplicateSequenceNumber_FailsWhenUsingSqlServer()
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
        var userA = BuildUser();
        var userB = BuildUser();
        context.Trials.Add(trial);
        context.Users.AddRange(userA, userB);
        await context.SaveChangesAsync();

        context.Entries.Add(new Entry
        {
            EntryId = Guid.NewGuid(),
            TrialId = trial.TrialId,
            CreatedByUserId = userA.UserId,
            Status = EntryStatus.Submitted,
            SequenceNumber = 1
        });

        context.Entries.Add(new Entry
        {
            EntryId = Guid.NewGuid(),
            TrialId = trial.TrialId,
            CreatedByUserId = userB.UserId,
            Status = EntryStatus.Submitted,
            SequenceNumber = 1
        });

        await Assert.ThrowsAnyAsync<DbUpdateException>(() => context.SaveChangesAsync());
    }

    [Fact]
    public async Task Entry_DuplicateRegistrationNumber_FailsWhenUsingSqlServer()
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
        var userA = BuildUser();
        var userB = BuildUser();
        context.Trials.Add(trial);
        context.Users.AddRange(userA, userB);
        await context.SaveChangesAsync();

        context.Entries.Add(new Entry
        {
            EntryId = Guid.NewGuid(),
            TrialId = trial.TrialId,
            CreatedByUserId = userA.UserId,
            Status = EntryStatus.Submitted,
            SequenceNumber = 1,
            RegistrationOrTrackingNumber = "EXCLUB-0001"
        });

        context.Entries.Add(new Entry
        {
            EntryId = Guid.NewGuid(),
            TrialId = trial.TrialId,
            CreatedByUserId = userB.UserId,
            Status = EntryStatus.Submitted,
            SequenceNumber = 2,
            RegistrationOrTrackingNumber = "EXCLUB-0001"
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
