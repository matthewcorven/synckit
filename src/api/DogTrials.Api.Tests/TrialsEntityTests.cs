using DogTrials.Api.Data;
using DogTrials.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace DogTrials.Api.Tests;

public class TrialsEntityTests
{
    [Fact]
    public void TrialModel_ConfiguresUniqueConstraintAndComputedSlug()
    {
        var options = new DbContextOptionsBuilder<DogTrialsDbContext>()
            .UseInMemoryDatabase("TrialsModelTests")
            .Options;

        using var context = new DogTrialsDbContext(options);
        var entity = context.Model.FindEntityType(typeof(Trial));

        Assert.NotNull(entity);

        var trackingSlug = entity!.FindProperty(nameof(Trial.TrackingSlug));
        Assert.NotNull(trackingSlug);
        Assert.Equal("[OrganizerSlug] + '-' + [EventSlug]", trackingSlug!.GetComputedColumnSql());

        var organizerSlug = entity.FindProperty(nameof(Trial.OrganizerSlug));
        var eventSlug = entity.FindProperty(nameof(Trial.EventSlug));
        Assert.Equal(32, organizerSlug!.GetMaxLength());
        Assert.Equal(64, eventSlug!.GetMaxLength());

        var index = entity.GetIndexes()
            .SingleOrDefault(i => i.Properties.Select(p => p.Name).SequenceEqual(new[]
            {
                nameof(Trial.OrganizerSlug),
                nameof(Trial.EventSlug)
            }));

        Assert.NotNull(index);
        Assert.True(index!.IsUnique);
        Assert.Equal("UX_Trials_OrganizerSlug_EventSlug", index.GetDatabaseName());
    }

    [Fact]
    public async Task TrialInsert_DuplicateOrganizerAndEvent_FailsWhenUsingSqlServer()
    {
        var connectionString = Environment.GetEnvironmentVariable("DOGTRIALS_TEST_SQL");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return;
        }

        var options = new DbContextOptionsBuilder<DogTrialsDbContext>()
            .UseSqlServer(connectionString)
            .Options;

        await using var context = new DogTrialsDbContext(options);
        await context.Database.EnsureDeletedAsync();
        await context.Database.MigrateAsync();

        var trial = BuildTrial();
        context.Trials.Add(trial);
        await context.SaveChangesAsync();

        var duplicate = BuildTrial();
        duplicate.TrialId = Guid.NewGuid();

        context.Trials.Add(duplicate);

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
}
