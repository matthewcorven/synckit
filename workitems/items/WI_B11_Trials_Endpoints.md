# WI-B11: Trials Endpoints

**Owner:** Agent B (Platform)  
**Status:** Proposed  
**Milestone:** M1  
**Dependencies:** B10, B08  
**Artifacts folder (recommended):** `../artifacts/WI-B11/`

## Goal
Implement the trials list and detail endpoints.

## Scope
### In
- `GET /api/trials` — List active trials
- `GET /api/trials/{trialId}` — Get trial by ID
- TrialSummaryDto mapping
- Authentication required (Handler or Secretary)
- Error handling (404 for not found)

### Out
- Registration metadata (see B12)
- Form metadata (see B13)
- Entry endpoints (see B14+)

## Implementation notes
- Both endpoints require authentication
- List returns only active trials by default
- DTO must match PRD contract exactly
- Include FormTemplateKey in response
- Return ProblemDetails for 404

## Acceptance criteria
- [ ] `GET /api/trials` returns list of active trials
- [ ] `GET /api/trials/{id}` returns single trial
- [ ] 404 returned for non-existent trial
- [ ] Response matches TrialSummaryDto exactly
- [ ] Authentication required
- [ ] `x-support-id` header present

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- Endpoint returns correct DTO shape
- Only active trials returned in list
- 404 for missing trial

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B11/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- List endpoint returns seeded trials
- Detail endpoint returns specific trial
- Unauthenticated request returns 401

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B11/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- UI can fetch and display trials
- Trial selection navigates correctly

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B11/playwright/trials-api-trace.zip`

### DB verification
**Artifact requirements**
- N/A — read-only endpoints

**Artifacts (add as relative links during work)**
- N/A

### Telemetry verification
- Verify spans with trial.id tag

**Artifact requirements**
- Trace screenshot

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B11/telemetry/trials-trace.png`

## Risks / Questions
- Pagination for large trial lists (future enhancement)

## DTO (from PRD)
```csharp
public record TrialSummaryDto(
    Guid TrialId,
    string Name,
    FormTemplateKeyDto FormTemplate,
    string OrganizerSlug,
    string EventSlug,
    string TrackingSlug,
    string HostClub,
    string StartDate,  // ISO date
    string EndDate,    // ISO date
    string? Location,
    string SecretaryEmail,
    bool IsActive
);

public record FormTemplateKeyDto(
    string OrganizationCode,
    string SportCode,
    string FormCode,
    string Version
);
```

## Implementation
```csharp
// Trials endpoints
var trials = app.MapGroup("/api/trials")
    .RequireAuthorization("Handler");

trials.MapGet("/", async (DogTrialsDbContext context) =>
{
    var trials = await context.Trials
        .Where(t => t.IsActive)
        .OrderBy(t => t.StartDate)
        .Select(t => t.ToSummaryDto())
        .ToListAsync();
        
    return Results.Ok(trials);
});

trials.MapGet("/{trialId:guid}", async (
    Guid trialId,
    DogTrialsDbContext context) =>
{
    var trial = await context.Trials
        .Where(t => t.TrialId == trialId)
        .Select(t => t.ToSummaryDto())
        .FirstOrDefaultAsync();
        
    return trial is null
        ? Results.Problem(
            title: "Trial not found",
            statusCode: 404,
            extensions: new Dictionary<string, object?>
            {
                ["errorCode"] = "TRIAL_NOT_FOUND"
            })
        : Results.Ok(trial);
});

// Mapping extension
public static TrialSummaryDto ToSummaryDto(this Trial t) => new(
    t.TrialId,
    t.Name,
    new FormTemplateKeyDto(
        t.OrganizationCode,
        t.SportCode,
        t.FormCode,
        t.FormVersion),
    t.OrganizerSlug,
    t.EventSlug,
    t.TrackingSlug,
    t.HostClub,
    t.StartDate.ToString("yyyy-MM-dd"),
    t.EndDate.ToString("yyyy-MM-dd"),
    t.Location,
    t.SecretaryEmail,
    t.IsActive
);
```

## Response Examples

### GET /api/trials (200)
```json
[
  {
    "trialId": "9d4a8d25-2c59-4f1f-8c79-6c63e74f5f49",
    "name": "Spring Stockdog Trial 2026",
    "formTemplate": {
      "organizationCode": "ASCA",
      "sportCode": "StockDog",
      "formCode": "TrialEntry",
      "version": "2020-10-08"
    },
    "organizerSlug": "EXCLUB",
    "eventSlug": "SPRING-2026-05-02",
    "trackingSlug": "EXCLUB-SPRING-2026-05-02",
    "hostClub": "Example Stockdog Club",
    "startDate": "2026-05-02",
    "endDate": "2026-05-03",
    "location": "Bryan, TX",
    "secretaryEmail": "secretary@exclub.org",
    "isActive": true
  }
]
```

### GET /api/trials/{id} (404)
```json
{
  "type": "https://tools.ietf.org/html/rfc7807",
  "title": "Trial not found",
  "status": 404,
  "traceId": "abc123...",
  "errorCode": "TRIAL_NOT_FOUND"
}
```
