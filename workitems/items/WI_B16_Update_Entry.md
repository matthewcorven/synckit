# WI-B16: Update Entry

**Owner:** Agent B (Platform)  
**Status:** Proposed  
**Milestone:** M2  
**Dependencies:** B15  
**Artifacts folder (recommended):** `../artifacts/WI-B16/`

## Goal
Implement the update entry endpoint for draft editing.

## Scope
### In
- `PUT /api/entries/{entryId}` endpoint
- Request body: `EntryUpdateRequestDto`
- Only Draft entries can be updated
- Ownership validation
- Partial updates (only provided fields)
- Returns updated `EntryDetailDto`

### Out
- Update selections (see B17)
- Submit (see B19)

## Implementation notes
- MVP null handling: Reject explicit nulls; omit fields to leave unchanged
- Validate entry is Draft (return 409 if Submitted)
- Validate ownership (return 403 if not owner)
- **Optimistic concurrency via ETag/RowVersion**: Check If-Match header, return 412 Precondition Failed on conflict
- Update only provided fields
- Set UpdatedAtUtc timestamp
- Return ETag header with new RowVersion
- OpenTelemetry span: `Entry.Update`

## Acceptance criteria
- [ ] Updates draft entry fields
- [ ] Returns 409 if already submitted
- [ ] Returns 403 if not owner
- [ ] Returns 404 if not found
- [ ] Only updates provided fields
- [ ] Returns updated entry detail
- [ ] **Returns 412 if ETag/RowVersion mismatch**
- [ ] **Returns ETag header in response**

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- Partial update works
- Status validation works
- Ownership validation works

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B16/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Update draft succeeds
- Update submitted returns 409
- Update other user's entry returns 403

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B16/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- Fill form, save, reload, verify data persists

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B16/playwright/update-entry-trace.zip`

### DB verification
**Artifact requirements**
- Entry fields updated correctly
- UpdatedAtUtc set

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B16/db/entry-updated.txt`

### Telemetry verification
- Verify `Entry.Update` span

**Artifact requirements**
- Trace screenshot

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B16/telemetry/update-trace.png`

## Risks / Questions
- ~~Consider optimistic concurrency (ETag/version)~~ → **RESOLVED: Yes - ETag/RowVersion** - Track row version, reject stale updates

## DTO
```csharp
public record EntryUpdateRequestDto(
    DogUpdateDto? Dog,
    ContactUpdateDto? Contact,
    FeesUpdateDto? Fees,
    EmergencyContactUpdateDto? EmergencyContact
);

public record DogUpdateDto(
    string? Breed,
    string? RegisteredName,
    string? Dob,
    string? Color,
    string? CallName,
    string? Sex,
    string? Sire,
    string? Dam,
    string? Breeders
);

// Similar for Contact, Fees, EmergencyContact
```

## Implementation
```csharp
app.MapPut("/api/entries/{entryId:guid}", async (
    Guid entryId,
    EntryUpdateRequestDto request,
    HttpContext context,
    DogTrialsDbContext dbContext,
    ILogger<EntriesEndpoints> logger) =>
{
    using var activity = DiagnosticConfig.ActivitySource.StartActivity("Entry.Update");
    activity?.SetTag("entry.id", entryId);
    
    var userId = context.GetUserId();
    
    var entry = await dbContext.Entries
        .Include(e => e.Trial)
        .Include(e => e.Notifications)
        .Where(e => e.EntryId == entryId)
        .FirstOrDefaultAsync();
        
    if (entry is null)
    {
        return Results.Problem(
            title: "Entry not found",
            statusCode: 404,
            extensions: new Dictionary<string, object?>
            {
                ["errorCode"] = "ENTRY_NOT_FOUND"
            });
    }
    
    if (entry.CreatedByUserId != userId)
    {
        return Results.Problem(
            title: "Access denied",
            statusCode: 403,
            extensions: new Dictionary<string, object?>
            {
                ["errorCode"] = "ENTRY_FORBIDDEN"
            });
    }
    
    if (entry.Status != EntryStatus.Draft)
    {
        return Results.Problem(
            title: "Entry already submitted",
            statusCode: 409,
            extensions: new Dictionary<string, object?>
            {
                ["errorCode"] = "ENTRY_ALREADY_SUBMITTED"
            });
    }
    
    // Apply partial updates
    if (request.Dog is not null)
    {
        entry.DogBreed = request.Dog.Breed ?? entry.DogBreed;
        entry.DogRegisteredName = request.Dog.RegisteredName ?? entry.DogRegisteredName;
        entry.DogCallName = request.Dog.CallName ?? entry.DogCallName;
        entry.DogDob = request.Dog.Dob is not null 
            ? DateOnly.Parse(request.Dog.Dob) 
            : entry.DogDob;
        entry.DogColor = request.Dog.Color ?? entry.DogColor;
        entry.DogSex = request.Dog.Sex ?? entry.DogSex;
        entry.DogSire = request.Dog.Sire ?? entry.DogSire;
        entry.DogDam = request.Dog.Dam ?? entry.DogDam;
        entry.DogBreeders = request.Dog.Breeders ?? entry.DogBreeders;
    }
    
    // Similar for Contact, Fees, EmergencyContact...
    
    entry.UpdatedAtUtc = DateTime.UtcNow;
    await dbContext.SaveChangesAsync();
    
    activity?.SetTag("entry.status", entry.Status.ToString());
    logger.LogInformation("Entry updated: {EntryId}", entryId);
    
    return Results.Ok(entry.ToDetailDto());
})
.RequireAuthorization("Handler");
```

## Response Examples

### 200 OK
```json
{
  "entryId": "f3e0e855-6522-4d4b-8d9e-34e61f9a4a75",
  "status": "Draft",
  "dog": {
    "breed": "Australian Shepherd",
    "callName": "Ranger"
  }
}
```

### 409 Conflict
```json
{
  "type": "https://tools.ietf.org/html/rfc7807",
  "title": "Entry already submitted",
  "status": 409,
  "traceId": "abc123...",
  "errorCode": "ENTRY_ALREADY_SUBMITTED"
}
```
