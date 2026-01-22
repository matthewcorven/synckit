using System.Text.Json;
using DogTrials.Api.Data;
using DogTrials.Api.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace DogTrials.Api.Tests;

public sealed class TrialSeedingServiceTests
{
    [Fact]
    public void SeedFile_Parses_WithExpectedFields()
    {
        var seedFilePath = SeedFileLocator.GetPath();
        var json = File.ReadAllText(seedFilePath);
        var seeds = JsonSerializer.Deserialize<List<TrialSeedRecord>>(
            json,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        Assert.NotNull(seeds);
        Assert.NotEmpty(seeds!);
        Assert.All(seeds!, seed =>
        {
            Assert.False(string.IsNullOrWhiteSpace(seed.OrganizerSlug));
            Assert.False(string.IsNullOrWhiteSpace(seed.EventSlug));
            Assert.False(string.IsNullOrWhiteSpace(seed.Name));
            Assert.False(string.IsNullOrWhiteSpace(seed.StartDate));
            Assert.False(string.IsNullOrWhiteSpace(seed.EndDate));
        });
    }

    [Fact]
    public async Task SeedTrialsAsync_IsIdempotent_WhenUsingSqlServer()
    {
        var options = TestDatabase.TryCreateSqlServerOptions();
        if (options is null)
        {
            return;
        }

        await using var context = new DogTrialsDbContext(options);
        await context.Database.EnsureDeletedAsync();
        await context.Database.MigrateAsync();

        var logger = LoggerFactory.Create(builder => builder.AddDebug()).CreateLogger<TrialSeedingService>();
        var seedingOptions = Microsoft.Extensions.Options.Options.Create(new TrialSeedingOptions
        {
            Enabled = true,
            SeedFilePath = SeedFileLocator.GetPath()
        });
        var seeder = new TrialSeedingService(context, logger, seedingOptions);

        await seeder.SeedTrialsAsync(CancellationToken.None);

        var firstTrialCount = await context.Trials.CountAsync();
        var firstCounterCount = await context.TrialCounters.CountAsync();
        var firstFormTemplateCount = await context.FormTemplates.CountAsync();

        await seeder.SeedTrialsAsync(CancellationToken.None);

        var secondTrialCount = await context.Trials.CountAsync();
        var secondCounterCount = await context.TrialCounters.CountAsync();
        var secondFormTemplateCount = await context.FormTemplates.CountAsync();

        Assert.True(firstTrialCount > 0);
        Assert.Equal(firstTrialCount, secondTrialCount);
        Assert.Equal(firstCounterCount, secondCounterCount);
        Assert.Equal(firstTrialCount, firstCounterCount);
        Assert.True(firstFormTemplateCount > 0);
        Assert.Equal(firstFormTemplateCount, secondFormTemplateCount);
    }

    private static class SeedFileLocator
    {
        public static string GetPath()
        {
            var directory = new DirectoryInfo(AppContext.BaseDirectory);
            while (directory is not null)
            {
                var candidate = Path.Combine(directory.FullName, "src", "api", "DogTrials.Api", "Data", "trials.seed.json");
                if (File.Exists(candidate))
                {
                    return candidate;
                }

                directory = directory.Parent;
            }

            throw new FileNotFoundException("Unable to locate trials.seed.json in repository tree.");
        }
    }
}
