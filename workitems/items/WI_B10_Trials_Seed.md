# WI-B10: Trials Seed

**Owner:** Agent B (Platform)  
**Status:** Proposed  
**Milestone:** M1  
**Dependencies:** B03, B04  
**Artifacts folder (recommended):** `../artifacts/WI-B10/`

## Goal
Create trial seed data file and startup seeding behavior.

## Scope
### In
- `trials.seed.json` file with sample trials
- Startup seeding logic (idempotent)
- TrialCounter creation alongside Trial
- Realistic ASCA stockdog trial data
- Multiple sample trials for testing

### Out
- Trials endpoints (see B11)
- Form metadata (see B13)

## Implementation notes
- Seed file location: `src/api/Data/trials.seed.json`
- Seeding runs on startup if enabled
- Idempotent: skip existing trials (by OrganizerSlug + EventSlug)
- Create TrialCounter record for each trial
- Include 2-3 sample trials with different dates/locations
- TrackingSlug auto-computed from OrganizerSlug + EventSlug

## Acceptance criteria
- [ ] Seed file contains valid trial data
- [ ] Seeding creates trials on startup
- [ ] Seeding is idempotent (re-running doesn't duplicate)
- [ ] TrialCounter created for each trial
- [ ] TrackingSlug is correctly computed

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- Seed file parses correctly
- Seeding logic skips existing trials

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B10/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Seeding creates expected trial count
- Re-seeding doesn't create duplicates
- TrialCounters exist for all trials

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B10/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- N/A — seeding only

**Artifacts (add as relative links during work)**
- N/A

### DB verification
**Artifact requirements**
- Query showing seeded trials
- Query showing TrialCounters

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B10/db/seeded-trials.txt`

### Telemetry verification
- Seeding logged appropriately

**Artifact requirements**
- Log sample

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B10/telemetry/seeding-logs.txt`

## Risks / Questions
- Production seeding strategy (one-time vs always)
- Consider migration-based seeding alternative

## Seed File: trials.seed.json
```json
[
  {
    "name": "Spring Stockdog Trial 2026",
    "organizationCode": "ASCA",
    "sportCode": "StockDog",
    "formCode": "TrialEntry",
    "formVersion": "2020-10-08",
    "organizerSlug": "EXCLUB",
    "eventSlug": "SPRING-2026-05-02",
    "hostClub": "Example Stockdog Club",
    "startDate": "2026-05-02",
    "endDate": "2026-05-03",
    "location": "Bryan, TX",
    "secretaryEmail": "secretary@exclub.org",
    "isActive": true
  },
  {
    "name": "Summer Championship 2026",
    "organizationCode": "ASCA",
    "sportCode": "StockDog",
    "formCode": "TrialEntry",
    "formVersion": "2020-10-08",
    "organizerSlug": "EXCLUB",
    "eventSlug": "SUMMER-2026-07-15",
    "hostClub": "Example Stockdog Club",
    "startDate": "2026-07-15",
    "endDate": "2026-07-17",
    "location": "Austin, TX",
    "secretaryEmail": "secretary@exclub.org",
    "isActive": true
  },
  {
    "name": "Fall Classic 2026",
    "organizationCode": "ASCA",
    "sportCode": "StockDog",
    "formCode": "TrialEntry",
    "formVersion": "2020-10-08",
    "organizerSlug": "OTHERCLUB",
    "eventSlug": "FALL-2026-10-20",
    "hostClub": "Other Stockdog Club",
    "startDate": "2026-10-20",
    "endDate": "2026-10-21",
    "location": "Dallas, TX",
    "secretaryEmail": "secretary@otherclub.org",
    "isActive": true
  }
]
```

## Seeding Service
```csharp
public class TrialSeedingService
{
    private readonly DogTrialsDbContext _context;
    private readonly ILogger<TrialSeedingService> _logger;

    public async Task SeedTrialsAsync(CancellationToken ct)
    {
        var seedFile = Path.Combine(AppContext.BaseDirectory, "Data", "trials.seed.json");
        if (!File.Exists(seedFile))
        {
            _logger.LogWarning("Seed file not found: {Path}", seedFile);
            return;
        }

        var json = await File.ReadAllTextAsync(seedFile, ct);
        var seedTrials = JsonSerializer.Deserialize<List<TrialSeedDto>>(json);

        foreach (var seedTrial in seedTrials ?? [])
        {
            var exists = await _context.Trials.AnyAsync(
                t => t.OrganizerSlug == seedTrial.OrganizerSlug 
                  && t.EventSlug == seedTrial.EventSlug, ct);

            if (exists)
            {
                _logger.LogDebug("Trial already exists: {Slug}", 
                    $"{seedTrial.OrganizerSlug}-{seedTrial.EventSlug}");
                continue;
            }

            var trial = new Trial
            {
                TrialId = Guid.NewGuid(),
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
                Counter = new TrialCounter { NextSequenceNumber = 1 }
            };

            _context.Trials.Add(trial);
            _logger.LogInformation("Seeding trial: {Name}", trial.Name);
        }

        await _context.SaveChangesAsync(ct);
    }
}
```

## Startup Registration
```csharp
// Program.cs
if (builder.Configuration.GetValue<bool>("SeedTrials"))
{
    using var scope = app.Services.CreateScope();
    var seeder = scope.ServiceProvider.GetRequiredService<TrialSeedingService>();
    await seeder.SeedTrialsAsync(CancellationToken.None);
}
```
