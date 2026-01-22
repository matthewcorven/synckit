using System.Text.Json;
using DogTrials.Api.Entities;
using DogTrials.Api.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DogTrials.Api.Data;

public sealed class TrialSeedingService(
    DogTrialsDbContext context,
    ILogger<TrialSeedingService> logger,
    IOptions<TrialSeedingOptions> options)
{
    private readonly DogTrialsDbContext _context = context;
    private readonly ILogger<TrialSeedingService> _logger = logger;
    private readonly TrialSeedingOptions _options = options.Value;

    public async Task SeedTrialsAsync(CancellationToken ct)
    {
        var seedFilePath = _options.ResolveSeedFilePath();
        if (!File.Exists(seedFilePath))
        {
            _logger.LogWarning("Trial seed file not found at {SeedFilePath}.", seedFilePath);
            return;
        }

        var json = await File.ReadAllTextAsync(seedFilePath, ct);
        var seedTrials = JsonSerializer.Deserialize<List<TrialSeedRecord>>(
            json,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        if (seedTrials is null || seedTrials.Count == 0)
        {
            _logger.LogInformation("No trial seed records found at {SeedFilePath}.", seedFilePath);
            return;
        }

        foreach (var seedTrial in seedTrials)
        {
            var exists = await _context.Trials.AnyAsync(
                trial => trial.OrganizerSlug == seedTrial.OrganizerSlug
                      && trial.EventSlug == seedTrial.EventSlug,
                ct);

            if (exists)
            {
                _logger.LogDebug(
                    "Trial already exists for {OrganizerSlug}-{EventSlug}.",
                    seedTrial.OrganizerSlug,
                    seedTrial.EventSlug);
                continue;
            }

            var trialId = Guid.NewGuid();
            var trial = new Trial
            {
                TrialId = trialId,
                Name = seedTrial.Name,
                OrganizationCode = seedTrial.OrganizationCode,
                SportCode = seedTrial.SportCode,
                FormCode = seedTrial.FormCode,
                FormVersion = seedTrial.FormVersion,
                OrganizerSlug = seedTrial.OrganizerSlug,
                EventSlug = seedTrial.EventSlug,
                HostClub = seedTrial.HostClub,
                StartDate = DateOnly.Parse(seedTrial.StartDate),
                EndDate = DateOnly.Parse(seedTrial.EndDate),
                Location = seedTrial.Location,
                SecretaryEmail = seedTrial.SecretaryEmail,
                IsActive = seedTrial.IsActive,
                CreatedAtUtc = DateTime.UtcNow,
                Counter = new TrialCounter
                {
                    TrialId = trialId,
                    NextSequenceNumber = 1
                }
            };

            _context.Trials.Add(trial);
            _logger.LogInformation("Seeding trial {OrganizerSlug}-{EventSlug}.", seedTrial.OrganizerSlug, seedTrial.EventSlug);
        }

        await _context.SaveChangesAsync(ct);
    }
}
