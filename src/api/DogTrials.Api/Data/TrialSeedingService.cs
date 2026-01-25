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

        // Seed form templates (if file present)
        var formTemplatesPath = Path.Combine(AppContext.BaseDirectory, "Data", "formtemplates.seed.json");
        if (File.Exists(formTemplatesPath))
        {
            try
            {
                var formJson = await File.ReadAllTextAsync(formTemplatesPath, ct);
                var formSeeds = JsonSerializer.Deserialize<List<FormTemplateSeedRecord>>(formJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (formSeeds is not null && formSeeds.Count > 0)
                {
                    foreach (var f in formSeeds)
                    {
                        var existing = await _context.FormTemplates.FirstOrDefaultAsync(ft =>
                            ft.OrganizationCode == f.OrganizationCode &&
                            ft.SportCode == f.SportCode &&
                            ft.FormCode == f.FormCode &&
                            ft.Version == f.Version,
                            ct);

                        var gridJson = JsonSerializer.Serialize(f.GridConfig);

                        if (existing is not null)
                        {
                            // Update if GridConfigJson is null or empty (fix for incomplete seeds)
                            if (string.IsNullOrEmpty(existing.GridConfigJson))
                            {
                                existing.GridConfigJson = gridJson;
                                _logger.LogInformation("Updated form template GridConfigJson for {Org}-{Sport}-{Form}-{Ver}.", f.OrganizationCode, f.SportCode, f.FormCode, f.Version);
                            }
                            else
                            {
                                _logger.LogDebug("Form template already exists for {Org}-{Sport}-{Form}-{Ver}.", f.OrganizationCode, f.SportCode, f.FormCode, f.Version);
                            }
                            continue;
                        }

                        var ftEntity = new FormTemplate
                        {
                            OrganizationCode = f.OrganizationCode,
                            SportCode = f.SportCode,
                            FormCode = f.FormCode,
                            Version = f.Version,
                            GridConfigJson = gridJson
                        };

                        _context.FormTemplates.Add(ftEntity);
                        _logger.LogInformation("Seeding form template {Org}-{Sport}-{Form}-{Ver}.", f.OrganizationCode, f.SportCode, f.FormCode, f.Version);
                    }

                    await _context.SaveChangesAsync(ct);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to seed form templates from {Path}.", formTemplatesPath);
            }
        }
    }
}
