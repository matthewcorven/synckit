using DogTrials.Api.Data;
using DogTrials.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;

namespace DogTrials.Api.Tests;

public class TrialCountersEntityTests
{
    [Fact]
    public void TrialCounterModel_ConfiguresCheckConstraintAndRelationship()
    {
        var options = new DbContextOptionsBuilder<DogTrialsDbContext>()
            .UseInMemoryDatabase("TrialCounterModelTests")
            .Options;

        using var context = new DogTrialsDbContext(options);
        var designTimeModel = context.GetService<IDesignTimeModel>().Model;
        var entity = designTimeModel.FindEntityType(typeof(TrialCounter));

        Assert.NotNull(entity);

        var checkConstraint = entity!.GetCheckConstraints()
            .SingleOrDefault(c => c.Name == "CK_TrialCounters_NextSequenceNumber_Positive");

        Assert.NotNull(checkConstraint);
        Assert.Equal("[NextSequenceNumber] >= 1", checkConstraint!.Sql);

        var foreignKey = entity.GetForeignKeys()
            .SingleOrDefault(fk => fk.PrincipalEntityType.ClrType == typeof(Trial));

        Assert.NotNull(foreignKey);
        Assert.True(foreignKey!.IsUnique);
        Assert.Equal(nameof(TrialCounter.TrialId), foreignKey.Properties.Single().Name);
    }

    [Fact]
    public async Task TrialCounter_InsertInvalidNextSequenceNumber_FailsWhenUsingSqlServer()
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
        context.TrialCounters.Add(new TrialCounter
        {
            TrialId = trial.TrialId,
            NextSequenceNumber = 0
        });

        await Assert.ThrowsAnyAsync<DbUpdateException>(() => context.SaveChangesAsync());
    }

    [Fact]
    public async Task TrialCounter_InsertWithoutTrial_FailsWhenUsingSqlServer()
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

        context.TrialCounters.Add(new TrialCounter
        {
            TrialId = Guid.NewGuid(),
            NextSequenceNumber = 1
        });

        await Assert.ThrowsAnyAsync<DbUpdateException>(() => context.SaveChangesAsync());
    }

    [Fact]
    public async Task TrialCounter_AllocatesDistinctSequenceNumbers_WhenConcurrent()
    {
        var connectionString = Environment.GetEnvironmentVariable("DOGTRIALS_TEST_SQL");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return;
        }

        var options = new DbContextOptionsBuilder<DogTrialsDbContext>()
            .UseSqlServer(connectionString)
            .Options;

        await using (var setupContext = new DogTrialsDbContext(options))
        {
            await setupContext.Database.EnsureDeletedAsync();
            await setupContext.Database.MigrateAsync();

            var trial = BuildTrial();
            setupContext.Trials.Add(trial);
            setupContext.TrialCounters.Add(new TrialCounter
            {
                TrialId = trial.TrialId,
                NextSequenceNumber = 1
            });
            await setupContext.SaveChangesAsync();
        }

        var trialId = await GetTrialIdAsync(options);

        var tasks = Enumerable.Range(0, 5)
            .Select(_ => AllocateAsync(options, trialId))
            .ToArray();

        var results = await Task.WhenAll(tasks);

        Assert.Equal(5, results.Distinct().Count());
        Assert.Equal(1, results.Min());
    }

    private static async Task<Guid> GetTrialIdAsync(DbContextOptions<DogTrialsDbContext> options)
    {
        await using var context = new DogTrialsDbContext(options);
        return await context.Trials.Select(t => t.TrialId).SingleAsync();
    }

    private static async Task<int> AllocateAsync(DbContextOptions<DogTrialsDbContext> options, Guid trialId)
    {
        await using var context = new DogTrialsDbContext(options);
        var allocator = new TrialCounterAllocator(context);
        return await allocator.AllocateSequenceNumberAsync(trialId);
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
