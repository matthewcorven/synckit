using System.Text.Json;
using DogTrials.Api.Data;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.EntityFrameworkCore;
using DogTrials.Api.Options;

namespace DogTrials.Api.Tests;

public sealed class FormTemplateSeedingTests
{
    [Fact]
    public void SeedFile_Parses_WithExpectedFields()
    {
        var seedFilePath = SeedFileLocator.GetPath();
        var json = File.ReadAllText(seedFilePath);
        var seeds = JsonSerializer.Deserialize<List<FormTemplateSeedRecord>>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        Assert.NotNull(seeds);
        Assert.NotEmpty(seeds!);
        Assert.All(seeds!, seed =>
        {
            Assert.False(string.IsNullOrWhiteSpace(seed.OrganizationCode));
            Assert.False(string.IsNullOrWhiteSpace(seed.SportCode));
            Assert.False(string.IsNullOrWhiteSpace(seed.FormCode));
            Assert.False(string.IsNullOrWhiteSpace(seed.Version));
            Assert.True(seed.GridConfig.ValueKind == JsonValueKind.Array || seed.GridConfig.ValueKind == JsonValueKind.Object);
        });
    }

    [Fact]
    public async Task FormTemplates_AreSeeded_Idempotent()
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
            SeedFilePath = Path.Combine(AppContext.BaseDirectory, "Data", "trials.seed.json")
        });
        var seeder = new TrialSeedingService(context, logger, seedingOptions);

        await seeder.SeedTrialsAsync(CancellationToken.None);

        var first = await context.FormTemplates.CountAsync();
        await seeder.SeedTrialsAsync(CancellationToken.None);
        var second = await context.FormTemplates.CountAsync();

        Assert.True(first > 0);
        Assert.Equal(first, second);
    }

    private static class SeedFileLocator
    {
        public static string GetPath()
        {
            var directory = new DirectoryInfo(AppContext.BaseDirectory);
            while (directory is not null)
            {
                var candidate = Path.Combine(directory.FullName, "src", "api", "DogTrials.Api", "Data", "formtemplates.seed.json");
                if (File.Exists(candidate))
                {
                    return candidate;
                }

                directory = directory.Parent;
            }

            throw new FileNotFoundException("Unable to locate formtemplates.seed.json in repository tree.");
        }
    }
}