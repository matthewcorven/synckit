# WI-B04: TrialCounters Entity

**Owner:** Agent B (Platform)  
**Status:** Proposed  
**Milestone:** M1  
**Dependencies:** B03  
**Artifacts folder (recommended):** `../artifacts/WI-B04/`

## Goal
Create the TrialCounters entity for safe sequence number allocation.

## Scope
### In
- TrialCounters entity class
- FK to Trials
- NextSequenceNumber field (starts at 1)
- Check constraint: positive number
- Migration
- Allocation method (transactional)

### Out
- Entries entity (see B05)
- Submit logic (see B19)

## Implementation notes
- One row per trial (1:1 with Trials)
- NextSequenceNumber used in submit to allocate entry numbers
- Must be incremented atomically (transaction + row lock)
- Check constraint: `NextSequenceNumber >= 1`
- Created when trial is seeded

## Acceptance criteria
- [ ] TrialCounters table created with FK to Trials
- [ ] Check constraint prevents negative/zero values
- [ ] Counter can be atomically incremented
- [ ] Migration runs without error

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- Entity configuration is correct
- FK constraint is configured

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B04/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Insert counter, verify FK enforced
- Increment counter atomically
- Concurrent increment test (no duplicates)

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B04/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- N/A — data layer only

**Artifacts (add as relative links during work)**
- N/A

### DB verification
**Artifact requirements**
- Table structure verification
- Check constraint verification
- Concurrent allocation test results

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B04/db/table-structure.txt`
- `../artifacts/WI-B04/db/constraint-test.txt`

### Telemetry verification
- N/A

**Artifact requirements**
- N/A

**Artifacts (add as relative links during work)**
- N/A

## Risks / Questions
- Ensure row-level locking works correctly under load
- Recovery if counter gets out of sync

## Entity Definition
```csharp
public class TrialCounter
{
    public Guid TrialId { get; set; }
    public int NextSequenceNumber { get; set; } = 1;

    // Navigation
    public Trial Trial { get; set; } = null!;
}
```

## EF Core Configuration
```csharp
public class TrialCounterConfiguration : IEntityTypeConfiguration<TrialCounter>
{
    public void Configure(EntityTypeBuilder<TrialCounter> builder)
    {
        builder.ToTable("TrialCounters", t =>
        {
            t.HasCheckConstraint(
                "CK_TrialCounters_NextSequenceNumber_Positive",
                "[NextSequenceNumber] >= 1");
        });
        
        builder.HasKey(tc => tc.TrialId);
        
        builder.HasOne(tc => tc.Trial)
            .WithOne(t => t.Counter)
            .HasForeignKey<TrialCounter>(tc => tc.TrialId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
```

## Atomic Allocation Pattern
```csharp
public async Task<int> AllocateSequenceNumberAsync(Guid trialId, CancellationToken ct)
{
    // Use raw SQL with UPDLOCK, HOLDLOCK for safe concurrent access
    var sql = @"
        UPDATE TrialCounters WITH (UPDLOCK, HOLDLOCK)
        SET NextSequenceNumber = NextSequenceNumber + 1
        OUTPUT DELETED.NextSequenceNumber
        WHERE TrialId = @trialId";
    
    var sequenceNumber = await _context.Database
        .SqlQueryRaw<int>(sql, new SqlParameter("@trialId", trialId))
        .FirstOrDefaultAsync(ct);
    
    return sequenceNumber;
}
```

## Alternative: Stored Procedure
```sql
CREATE PROCEDURE [dbo].[AllocateSequenceNumber]
    @TrialId UNIQUEIDENTIFIER,
    @SequenceNumber INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    
    UPDATE TrialCounters WITH (UPDLOCK, HOLDLOCK)
    SET @SequenceNumber = NextSequenceNumber,
        NextSequenceNumber = NextSequenceNumber + 1
    WHERE TrialId = @TrialId;
END
```
