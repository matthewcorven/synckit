# WI-B06: Notifications Entity

**Owner:** Agent B (Platform)  
**Status:** Proposed  
**Milestone:** M1  
**Dependencies:** B05  
**Artifacts folder (recommended):** `../artifacts/WI-B06/`

## Goal
Create the Notifications entity for tracking per-recipient email delivery status.

## Scope
### In
- Notifications entity class
- FK to Entries
- RecipientType enum (Handler, Secretary)
- Status enum (Queued, InProgress, Success, Failed)
- Retry fields (AttemptCount, NextAttemptAtUtc, etc.)
- Unique constraint: `UX_Notifications_EntryId_RecipientType`
- Retry scan index
- Migration

### Out
- Email sending (see B23)
- Processing status endpoint (see B24)

## Implementation notes
- One notification per recipient type per entry
- Unique constraint prevents duplicate notifications
- Retry fields for background processing
- SentAtUtc populated on successful send

## Acceptance criteria
- [ ] Notifications table created with all columns
- [ ] FK to Entries enforced
- [ ] Unique constraint on EntryId + RecipientType
- [ ] Retry scan index created
- [ ] Migration runs without error

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- Entity configuration is correct
- Constraints are configured

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B06/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Insert notification, verify FK enforced
- Duplicate EntryId + RecipientType fails

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B06/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- N/A — data layer only

**Artifacts (add as relative links during work)**
- N/A

### DB verification
**Artifact requirements**
- Table structure verification
- Constraint test results

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B06/db/table-structure.txt`
- `../artifacts/WI-B06/db/constraint-test.txt`

### Telemetry verification
- N/A

**Artifact requirements**
- N/A

**Artifacts (add as relative links during work)**
- N/A

## Risks / Questions
- Should we store recipient email in notification or derive from entry/trial?

## Entity Definition
```csharp
public class Notification
{
    public Guid NotificationId { get; set; }
    public Guid EntryId { get; set; }
    public RecipientType RecipientType { get; set; }
    public NotificationStatus Status { get; set; } = NotificationStatus.Queued;
    public int AttemptCount { get; set; }
    public DateTime? NextAttemptAtUtc { get; set; }
    public DateTime? LastAttemptAtUtc { get; set; }
    public string? LastErrorCode { get; set; }
    public DateTime? SentAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }

    // Navigation
    public Entry Entry { get; set; } = null!;
}

public enum RecipientType { Handler, Secretary }
public enum NotificationStatus { Queued, InProgress, Success, Failed }
```

## EF Core Configuration
```csharp
public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.ToTable("Notifications");
        
        builder.HasKey(n => n.NotificationId);
        
        builder.Property(n => n.RecipientType)
            .HasConversion<string>()
            .HasMaxLength(16);
            
        builder.Property(n => n.Status)
            .HasConversion<string>()
            .HasMaxLength(16);
            
        builder.Property(n => n.LastErrorCode)
            .HasMaxLength(64);
            
        // Unique constraint: one notification per type per entry
        builder.HasIndex(n => new { n.EntryId, n.RecipientType })
            .IsUnique()
            .HasDatabaseName("UX_Notifications_EntryId_RecipientType");
            
        // Retry scan index
        builder.HasIndex(n => new { n.Status, n.NextAttemptAtUtc })
            .HasDatabaseName("IX_Notifications_Status_NextAttemptAtUtc");
            
        // Relationship
        builder.HasOne(n => n.Entry)
            .WithMany(e => e.Notifications)
            .HasForeignKey(n => n.EntryId);
    }
}
```

## DTO Mapping
```csharp
public record NotificationDto(
    string RecipientType,
    string Status,
    DateTime? SentAtUtc,
    string? LastError
);

// Map from entity
public static NotificationDto ToDto(this Notification n) => new(
    n.RecipientType.ToString(),
    n.Status.ToString(),
    n.SentAtUtc,
    n.LastErrorCode
);
```
