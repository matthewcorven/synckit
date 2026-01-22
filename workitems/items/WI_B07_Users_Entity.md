# WI-B07: Users Entity

**Owner:** Agent B (Platform)  
**Status:** Proposed  
**Milestone:** M1  
**Dependencies:** B01  
**Artifacts folder (recommended):** `../artifacts/WI-B07/`

## Goal
Create the Users entity for mapping external identity subjects to internal user IDs.

## Scope
### In
- Users entity class
- External subject (from JWT `sub` claim) to internal UserId mapping
- Role storage
- Email storage (for reference, not authentication)
- Unique constraint on ExternalSubject
- Migration

### Out
- JWT validation (see B08)
- User provisioning logic (see B09)
- Secretary allowlist (see B09)

## Implementation notes
- MVP identity mapping (from PRD):
  - Use JWT `sub` claim as stable external identifier
  - Internal `UserId` (GUID) used in Entries.CreatedByUserId
- Role is stored for reference but primarily derived from JWT
- Email stored for display/notification purposes
- Auto-provisioning happens on first authenticated request (see B09)

## Acceptance criteria
- [ ] Users table created with all columns
- [ ] Unique constraint on ExternalSubject
- [ ] UserId can be used as FK in Entries
- [ ] Migration runs without error

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- Entity configuration is correct
- Unique constraint is configured

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B07/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Insert user, verify saved
- Duplicate ExternalSubject fails

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B07/integration-test-results.txt`

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
- `../artifacts/WI-B07/db/table-structure.txt`

### Telemetry verification
- N/A

**Artifact requirements**
- N/A

**Artifacts (add as relative links during work)**
- N/A

## Risks / Questions
- ExternalSubject format varies by IdP (ensure max length)
- Consider soft delete for user removal

## Entity Definition
```csharp
public class User
{
    public Guid UserId { get; set; }
    public string ExternalSubject { get; set; } = string.Empty;  // JWT sub claim
    public string Email { get; set; } = string.Empty;            // For display/notification
    public UserRole Role { get; set; } = UserRole.Handler;       // Handler or Secretary
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? LastLoginAtUtc { get; set; }

    // Navigation
    public ICollection<Entry> Entries { get; set; } = new List<Entry>();
}

public enum UserRole { Handler, Secretary }
```

## EF Core Configuration
```csharp
public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("Users");
        
        builder.HasKey(u => u.UserId);
        
        builder.Property(u => u.ExternalSubject)
            .HasMaxLength(256)  // JWT sub can be various formats
            .IsRequired();
            
        builder.Property(u => u.Email)
            .HasMaxLength(320)  // Max email length per RFC
            .IsRequired();
            
        builder.Property(u => u.Role)
            .HasConversion<string>()
            .HasMaxLength(16);
            
        // Unique constraint on external subject
        builder.HasIndex(u => u.ExternalSubject)
            .IsUnique()
            .HasDatabaseName("UX_Users_ExternalSubject");
            
        // Index for email lookups (secretary allowlist)
        builder.HasIndex(u => u.Email)
            .HasDatabaseName("IX_Users_Email");
    }
}
```

## User Lookup/Creation Pattern
```csharp
public async Task<User> GetOrCreateUserAsync(
    string externalSubject,
    string email,
    UserRole role,
    CancellationToken ct)
{
    var user = await _context.Users
        .FirstOrDefaultAsync(u => u.ExternalSubject == externalSubject, ct);
        
    if (user is null)
    {
        user = new User
        {
            UserId = Guid.NewGuid(),
            ExternalSubject = externalSubject,
            Email = email,
            Role = role,
            CreatedAtUtc = DateTime.UtcNow
        };
        _context.Users.Add(user);
        await _context.SaveChangesAsync(ct);
    }
    else
    {
        // Update last login
        user.LastLoginAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
    }
    
    return user;
}
```
