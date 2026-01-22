# WI-B14: Create Draft

**Owner:** Agent B (Platform)  
**Status:** ✅ Completed  
**Milestone:** M2  
**Dependencies:** B05, B08, B09  
**Artifacts folder (recommended):** `../artifacts/WI-B14/`

## Goal
Implement the create draft entry endpoint.

## Scope
### In
- `POST /api/entries` endpoint
- Request body: `{ trialId: guid }`
- Creates entry in Draft status
- Associates with authenticated user
- Returns entry ID and status
- Handler authorization

### Out
- Get entry (see B15)
- Update entry (see B16)
- Submit (see B19)

## Implementation notes
- Validates trial exists and is active
- **Enforces one draft per user per trial** (returns existing draft if one exists, or 409 if submitted)
- Sets CreatedByUserId from authenticated user
- Sets Status to Draft
- Initializes processing fields (PdfStatus = Queued)
- Returns 201 Created with location header
- OpenTelemetry span: `Entry.CreateDraft`

## Acceptance criteria
- [ ] Creates entry in Draft status
- [ ] Associates with authenticated user
- [ ] Returns 201 with entry ID
- [ ] Validates trial exists
- [ ] Returns 400 for non-existent trial
- [ ] **Returns existing draft if one already exists** (idempotent)
- [ ] **Returns 409 if user already has submitted entry for trial**
- [ ] Handler authorization required

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- Entry created with correct fields
- Trial validation works
- User association works

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B14/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Create entry, verify in database
- Non-existent trial returns 400
- Unauthenticated returns 401

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B14/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- Create draft via UI, verify response

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B14/playwright/create-draft-trace.zip`

### DB verification
**Artifact requirements**
- Entry record created with correct fields
- CreatedByUserId matches authenticated user

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B14/db/entry-created.txt`

### Telemetry verification
- Verify `Entry.CreateDraft` span
- Verify `entry.id` and `trial.id` tags

**Artifact requirements**
- Trace screenshot

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B14/telemetry/create-draft-trace.png`

## Risks / Questions
- ~~Should we limit drafts per user per trial?~~ → **RESOLVED: One draft per user per trial** - Prevent duplicate entries

## DTO
```csharp
public record EntryCreateRequestDto(Guid TrialId);

public record EntryCreateResponseDto(
    Guid EntryId,
    string Status
);
```

## Implementation
```csharp
app.MapPost("/api/entries", async (
    EntryCreateRequestDto request,
    HttpContext context,
    DogTrialsDbContext dbContext,
    ILogger<EntriesEndpoints> logger) =>
{
    using var activity = DiagnosticConfig.ActivitySource.StartActivity("Entry.CreateDraft");
    activity?.SetTag("trial.id", request.TrialId);
    
    var userId = context.GetUserId();
    
    // Validate trial exists and is active
    var trial = await dbContext.Trials
        .Where(t => t.TrialId == request.TrialId && t.IsActive)
        .FirstOrDefaultAsync();
        
    if (trial is null)
    {
        return Results.Problem(
            title: "Trial not found or not active",
            statusCode: 400,
            extensions: new Dictionary<string, object?>
            {
                ["errorCode"] = "TRIAL_NOT_FOUND",
                ["errors"] = new Dictionary<string, string[]>
                {
                    ["trialId"] = new[] { "Trial not found or not active." }
                }
            });
    }
    
    var entry = new Entry
    {
        EntryId = Guid.NewGuid(),
        TrialId = request.TrialId,
        CreatedByUserId = userId,
        Status = EntryStatus.Draft,
        PdfStatus = PdfStatus.Queued,
        CreatedAtUtc = DateTime.UtcNow
    };
    
    dbContext.Entries.Add(entry);
    await dbContext.SaveChangesAsync();
    
    activity?.SetTag("entry.id", entry.EntryId);
    activity?.SetTag("entry.status", "Draft");
    
    logger.LogInformation("Draft entry created: {EntryId} for trial {TrialId}", 
        entry.EntryId, request.TrialId);
    
    return Results.Created(
        $"/api/entries/{entry.EntryId}",
        new EntryCreateResponseDto(entry.EntryId, "Draft"));
})
.RequireAuthorization("Handler");
```

## Response Examples

### 201 Created
```json
{
  "entryId": "f3e0e855-6522-4d4b-8d9e-34e61f9a4a75",
  "status": "Draft"
}
```

### 400 Bad Request
```json
{
  "type": "https://tools.ietf.org/html/rfc7807",
  "title": "Trial not found or not active",
  "status": 400,
  "traceId": "abc123...",
  "errorCode": "TRIAL_NOT_FOUND",
  "errors": {
    "trialId": ["Trial not found or not active."]
  }
}
```
