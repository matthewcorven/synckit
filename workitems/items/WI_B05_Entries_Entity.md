# WI-B05: Entries Entity

**Owner:** Agent B (Platform)  
**Status:** Proposed  
**Milestone:** M1  
**Dependencies:** B04  
**Artifacts folder (recommended):** `../artifacts/WI-B05/`

## Goal
Create the Entries entity with all form fields, processing status, and required constraints.

## Scope
### In
- Entries entity with all fields from API contract
- FK to Trials, Users
- Status enum (Draft, Submitted)
- Processing status fields (PdfStatus, retry fields)
- Filtered unique indexes:
  - `UX_Entries_TrialId_SequenceNumber`
  - `UX_Entries_RegistrationOrTrackingNumber`
- Selections stored as JSON or child table
- Migration

### Out
- Notifications entity (see B06)
- Entry endpoints (see B14-B17)
- Submit logic (see B19)

## Implementation notes
- Follow DB_Constraints_and_Retry_Model.md exactly
- SequenceNumber is NULL until submitted
- RegistrationOrTrackingNumber is NULL until submitted
- Filtered unique indexes: WHERE column IS NOT NULL
- Consider JSON column for selections or normalize to child table
- Processing fields for retry logic

## Acceptance criteria
- [ ] Entries table created with all columns
- [ ] FK constraints to Trials and Users work
- [ ] Filtered unique indexes are created
- [ ] Status defaults to Draft
- [ ] Processing fields support retry logic
- [ ] Migration runs without error

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- Entity configuration is correct
- Constraints are configured

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B05/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Insert entry, verify FK enforced
- Unique constraint on SequenceNumber works (filtered)
- Unique constraint on RegistrationNumber works (filtered)

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B05/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- N/A — data layer only

**Artifacts (add as relative links during work)**
- N/A

### DB verification
**Artifact requirements**
- Table structure verification
- Index verification
- Constraint test results

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B05/db/table-structure.txt`
- `../artifacts/WI-B05/db/index-verification.txt`

### Telemetry verification
- N/A

**Artifact requirements**
- N/A

**Artifacts (add as relative links during work)**
- N/A

## Risks / Questions
- Selections storage: JSON vs normalized table
- PII fields encryption consideration (future)

## Entity Definition
```csharp
public class Entry
{
    public Guid EntryId { get; set; }
    public Guid TrialId { get; set; }
    public Guid CreatedByUserId { get; set; }
    
    // Status
    public EntryStatus Status { get; set; } = EntryStatus.Draft;
    public int? SequenceNumber { get; set; }
    public string? RegistrationOrTrackingNumber { get; set; }
    public DateTime? SubmittedAtUtc { get; set; }
    
    // Dog info (could be separate entity or JSON)
    public string? DogBreed { get; set; }
    public string? DogRegisteredName { get; set; }
    public string? DogCallName { get; set; }
    public DateOnly? DogDob { get; set; }
    public string? DogColor { get; set; }
    public string? DogSex { get; set; }
    public string? DogSire { get; set; }
    public string? DogDam { get; set; }
    public string? DogBreeders { get; set; }
    
    // Contact info
    public string? ContactOwners { get; set; }
    public string? ContactStreet { get; set; }
    public string? ContactCity { get; set; }
    public string? ContactState { get; set; }
    public string? ContactZip { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public string? ContactHandler { get; set; }
    public string? ContactMembershipNumber { get; set; }
    public DateOnly? JuniorDob { get; set; }
    public string? JuniorMemberId { get; set; }
    
    // Emergency & Fees
    public string? EmergencyName { get; set; }
    public string? EmergencyPhone { get; set; }
    public decimal? TotalEntryFees { get; set; }
    
    // Selections (JSON)
    public string? SelectionsJson { get; set; }
    
    // Terms
    public string? TermsVersion { get; set; }
    public DateTime? TermsAcceptedAtUtc { get; set; }
    public Guid? TermsAcceptedByUserId { get; set; }
    
    // Processing status
    public PdfStatus PdfStatus { get; set; } = PdfStatus.Queued;
    public string? GeneratedPdfBlobUri { get; set; }
    public int PdfAttemptCount { get; set; }
    public DateTime? PdfNextAttemptAtUtc { get; set; }
    public DateTime? PdfLastAttemptAtUtc { get; set; }
    public string? PdfLastErrorCode { get; set; }
    
    // Timestamps
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }

    // Navigation
    public Trial Trial { get; set; } = null!;
    public User CreatedByUser { get; set; } = null!;
    public ICollection<Notification> Notifications { get; set; } = new List<Notification>();
}

public enum EntryStatus { Draft, Submitted }
public enum PdfStatus { Queued, InProgress, Success, Failed }
```

## EF Core Configuration
```csharp
public class EntryConfiguration : IEntityTypeConfiguration<Entry>
{
    public void Configure(EntityTypeBuilder<Entry> builder)
    {
        builder.ToTable("Entries", t =>
        {
            t.HasCheckConstraint(
                "CK_Entries_SequenceNumber_Positive",
                "[SequenceNumber] IS NULL OR [SequenceNumber] >= 1");
        });
        
        builder.HasKey(e => e.EntryId);
        
        builder.Property(e => e.Status)
            .HasConversion<string>()
            .HasMaxLength(16);
            
        builder.Property(e => e.PdfStatus)
            .HasConversion<string>()
            .HasMaxLength(16);
            
        builder.Property(e => e.RegistrationOrTrackingNumber)
            .HasMaxLength(128);
            
        // Filtered unique indexes
        builder.HasIndex(e => new { e.TrialId, e.SequenceNumber })
            .IsUnique()
            .HasFilter("[SequenceNumber] IS NOT NULL")
            .HasDatabaseName("UX_Entries_TrialId_SequenceNumber");
            
        builder.HasIndex(e => e.RegistrationOrTrackingNumber)
            .IsUnique()
            .HasFilter("[RegistrationOrTrackingNumber] IS NOT NULL")
            .HasDatabaseName("UX_Entries_RegistrationOrTrackingNumber");
            
        // Retry scan index
        builder.HasIndex(e => new { e.Status, e.PdfStatus, e.PdfNextAttemptAtUtc })
            .HasDatabaseName("IX_Entries_Status_PdfStatus_PdfNextAttemptAtUtc");
            
        // Relationships
        builder.HasOne(e => e.Trial)
            .WithMany(t => t.Entries)
            .HasForeignKey(e => e.TrialId);
            
        builder.HasOne(e => e.CreatedByUser)
            .WithMany(u => u.Entries)
            .HasForeignKey(e => e.CreatedByUserId);
    }
}
```
