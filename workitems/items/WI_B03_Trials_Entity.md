# WI-B03: Trials Entity

**Owner:** Agent B (Platform)  
**Status:** Proposed  
**Milestone:** M1  
**Dependencies:** B01  
**Artifacts folder (recommended):** `../artifacts/WI-B03/`

## Goal
Create the Trials entity with EF Core configuration and initial migration.

## Scope
### In
- Trials entity class
- EF Core DbContext configuration
- Unique constraint: `UX_Trials_OrganizerSlug_EventSlug`
- TrackingSlug computed column
- Initial migration
- SQL Server connection configuration

### Out
- TrialCounters (see B04)
- Entries (see B05)
- Seeding (see B10)
- Endpoints (see B11)

## Implementation notes
- Follow DB_Constraints_and_Retry_Model.md exactly
- TrackingSlug = `OrganizerSlug + '-' + EventSlug`
- Consider computed persisted column for TrackingSlug
- Use SQL Server LocalDB or container for development
- Migration should be idempotent

## Acceptance criteria
- [ ] Trials table created with all columns
- [ ] Unique constraint enforced on OrganizerSlug + EventSlug
- [ ] TrackingSlug is deterministic
- [ ] Migration runs without error
- [ ] DbContext can query/insert trials

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- Entity configuration is correct
- Unique constraint is configured

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B03/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Insert trial, verify saved
- Duplicate OrganizerSlug + EventSlug fails

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B03/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- N/A — data layer only

**Artifacts (add as relative links during work)**
- N/A

### DB verification
**Artifact requirements**
- Migration script output
- Table structure verification query
- Constraint test output

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B03/db/migration-script.sql`
- `../artifacts/WI-B03/db/table-structure.txt`

### Telemetry verification
- N/A

**Artifact requirements**
- N/A

**Artifacts (add as relative links during work)**
- N/A

## Risks / Questions
- SQL Server vs PostgreSQL decision (MVP: SQL Server)
- TrackingSlug length limits

## Entity Definition
```csharp
public class Trial
{
    public Guid TrialId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string OrganizationCode { get; set; } = string.Empty;  // e.g., "ASCA"
    public string SportCode { get; set; } = string.Empty;         // e.g., "StockDog"
    public string FormCode { get; set; } = string.Empty;          // e.g., "TrialEntry"
    public string FormVersion { get; set; } = string.Empty;       // e.g., "2020-10-08"
    public string OrganizerSlug { get; set; } = string.Empty;     // e.g., "EXCLUB"
    public string EventSlug { get; set; } = string.Empty;         // e.g., "SPRING-2026-05-02"
    public string TrackingSlug { get; set; } = string.Empty;      // Computed: OrganizerSlug-EventSlug
    public string HostClub { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string? Location { get; set; }
    public string SecretaryEmail { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }

    // Navigation
    public TrialCounter? Counter { get; set; }
    public ICollection<Entry> Entries { get; set; } = new List<Entry>();
}
```

## EF Core Configuration
```csharp
public class TrialConfiguration : IEntityTypeConfiguration<Trial>
{
    public void Configure(EntityTypeBuilder<Trial> builder)
    {
        builder.ToTable("Trials");
        builder.HasKey(t => t.TrialId);
        
        builder.Property(t => t.OrganizerSlug)
            .HasMaxLength(32)
            .IsRequired();
            
        builder.Property(t => t.EventSlug)
            .HasMaxLength(64)
            .IsRequired();
            
        builder.Property(t => t.TrackingSlug)
            .HasMaxLength(100)
            .HasComputedColumnSql("[OrganizerSlug] + '-' + [EventSlug]", stored: true);
            
        builder.Property(t => t.SecretaryEmail)
            .HasMaxLength(320)
            .IsRequired();
            
        builder.HasIndex(t => new { t.OrganizerSlug, t.EventSlug })
            .IsUnique()
            .HasDatabaseName("UX_Trials_OrganizerSlug_EventSlug");
    }
}
```

## Migration Commands
```bash
# Add migration
dotnet ef migrations add InitialTrials --project src/api/DogTrials.Api

# Apply migration
dotnet ef database update --project src/api/DogTrials.Api

# Generate SQL script
dotnet ef migrations script --project src/api/DogTrials.Api -o artifacts/WI-B03/db/migration-script.sql
```
