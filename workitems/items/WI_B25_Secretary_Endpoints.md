# WI-B25: Secretary Endpoints

**Owner:** Agent B (Platform)  
**Status:** Proposed  
**Milestone:** M5  
**Dependencies:** B15, B22  
**Artifacts folder (recommended):** `../artifacts/WI-B25/`

## Goal
Implement the secretary portal endpoints for entry management.

## Scope
### In
- `GET /api/secretary/entries` — Paginated entry list
- `GET /api/secretary/entries/{entryId}` — Entry detail
- `GET /api/secretary/entries/{entryId}/pdf` — PDF download URL
- `POST /api/secretary/entries/{entryId}/pdf/retry` — Trigger PDF regeneration
- Secretary authorization
- Trial filtering
- Status filtering

### Out
- Secretary UI (see A12, A13)
- Processing status (see B24)

## Implementation notes
- Secretary can view all entries (not just own)
- Pagination with configurable page size
- Filter by trial and status
- Sort by submission date (newest first)
- Return SAS URL for PDF download

## Acceptance criteria
- [ ] List entries with pagination
- [ ] Filter by trial works
- [ ] Filter by status works
- [ ] Detail returns full entry
- [ ] PDF endpoint returns SAS URL
- [ ] Secretary authorization required
- [ ] **PDF retry endpoint resets status to Queued and enqueues job**

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- Pagination logic works
- Filtering works
- DTO mapping correct

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B25/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- List returns paginated entries
- Detail returns entry
- PDF URL works

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B25/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- Secretary views entry list
- Secretary views entry detail
- Secretary downloads PDF

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B25/playwright/secretary-flow-trace.zip`

### DB verification
**Artifact requirements**
- N/A — read-only

**Artifacts (add as relative links during work)**
- N/A

### Telemetry verification
- N/A

**Artifact requirements**
- N/A

**Artifacts (add as relative links during work)**
- N/A

## Risks / Questions
- Performance with large entry counts
- ~~Should secretary see draft entries?~~ → **RESOLVED: Yes - Include drafts** - Secretary can see in-progress entries

## Implementation
```csharp
var secretary = app.MapGroup("/api/secretary")
    .RequireAuthorization("Secretary");

// List entries
secretary.MapGet("/entries", async (
    [FromQuery] Guid? trialId,
    [FromQuery] string? status,
    [FromQuery] int page = 1,
    [FromQuery] int pageSize = 50,
    DogTrialsDbContext context) =>
{
    var query = context.Entries
        .Include(e => e.Trial)
        .AsQueryable();
        
    if (trialId.HasValue)
        query = query.Where(e => e.TrialId == trialId.Value);
        
    if (!string.IsNullOrEmpty(status) && Enum.TryParse<EntryStatus>(status, out var statusEnum))
        query = query.Where(e => e.Status == statusEnum);
    // No default filter - secretary sees all entries (Draft + Submitted)
    
    var total = await query.CountAsync();
    
    var items = await query
        .OrderByDescending(e => e.SubmittedAtUtc)
        .Skip((page - 1) * pageSize)
        .Take(pageSize)
        .Select(e => e.ToSummaryDto())
        .ToListAsync();
    
    return Results.Ok(new PaginatedResponse<EntrySummaryDto>(items, page, pageSize, total));
});

// Get entry detail
secretary.MapGet("/entries/{entryId:guid}", async (
    Guid entryId,
    DogTrialsDbContext context) =>
{
    var entry = await context.Entries
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
    
    return Results.Ok(entry.ToDetailDto());
});

// Get PDF download URL
secretary.MapGet("/entries/{entryId:guid}/pdf", async (
    Guid entryId,
    DogTrialsDbContext context,
    IBlobStorageService blobService) =>
{
    var entry = await context.Entries
        .Where(e => e.EntryId == entryId)
        .FirstOrDefaultAsync();
        
    if (entry is null)
    {
        return Results.Problem(
            title: "Entry not found",
            statusCode: 404);
    }
    
    if (entry.PdfStatus != PdfStatus.Success || entry.GeneratedPdfBlobUri is null)
    {
        return Results.Problem(
            title: "PDF not available",
            statusCode: 404,
            extensions: new Dictionary<string, object?>
            {
                ["errorCode"] = "PDF_NOT_AVAILABLE"
            });
    }
    
    var downloadUrl = await blobService.GenerateSasUrlAsync(entryId, SasTtl.UiDownload, CancellationToken.None);
    
    return Results.Ok(new { downloadUrl });
});

// Retry PDF generation
secretary.MapPost("/entries/{entryId:guid}/pdf/retry", async (
    Guid entryId,
    DogTrialsDbContext context,
    IBackgroundJobQueue jobQueue) =>
{
    var entry = await context.Entries
        .Where(e => e.EntryId == entryId && e.Status == EntryStatus.Submitted)
        .FirstOrDefaultAsync();
        
    if (entry is null)
    {
        return Results.Problem(
            title: "Entry not found or not submitted",
            statusCode: 404,
            extensions: new Dictionary<string, object?>
            {
                ["errorCode"] = "ENTRY_NOT_FOUND"
            });
    }
    
    if (entry.PdfStatus == PdfStatus.InProgress)
    {
        return Results.Problem(
            title: "PDF generation already in progress",
            statusCode: 409,
            extensions: new Dictionary<string, object?>
            {
                ["errorCode"] = "PDF_IN_PROGRESS"
            });
    }
    
    // Reset status and enqueue retry
    entry.PdfStatus = PdfStatus.Queued;
    entry.PdfNextAttemptAtUtc = DateTime.UtcNow;
    entry.PdfLastErrorCode = null;
    await context.SaveChangesAsync();
    
    await jobQueue.EnqueueAsync(new PdfGenerationJob(entryId));
    
    return Results.Accepted();
});
```

## DTOs
```csharp
public record EntrySummaryDto(
    Guid EntryId,
    Guid TrialId,
    string Status,
    DateTime? SubmittedAtUtc,
    string HandlerEmail,
    string DogCallName,
    string? DogRegisteredName,
    string PdfStatus
);

public record PaginatedResponse<T>(
    List<T> Items,
    int Page,
    int PageSize,
    int Total
);

// Mapping extension
public static EntrySummaryDto ToSummaryDto(this Entry e) => new(
    e.EntryId,
    e.TrialId,
    e.Status.ToString(),
    e.SubmittedAtUtc,
    e.ContactEmail ?? "",
    e.DogCallName ?? "",
    e.DogRegisteredName,
    e.PdfStatus.ToString()
);
```

## Response Examples

### GET /api/secretary/entries
```json
{
  "items": [
    {
      "entryId": "f3e0e855-6522-4d4b-8d9e-34e61f9a4a75",
      "trialId": "9d4a8d25-2c59-4f1f-8c79-6c63e74f5f49",
      "status": "Submitted",
      "submittedAtUtc": "2026-01-20T15:22:11Z",
      "handlerEmail": "jane@example.com",
      "dogCallName": "Ranger",
      "dogRegisteredName": "Example's Blue Lightning",
      "pdfStatus": "Success"
    }
  ],
  "page": 1,
  "pageSize": 50,
  "total": 45
}
```

### GET /api/secretary/entries/{id}/pdf
```json
{
  "downloadUrl": "https://dgmvpstorage.blob.core.windows.net/pdf/entries/f3e0e855-6522-4d4b-8d9e-34e61f9a4a75.pdf?sv=..."
}
```
