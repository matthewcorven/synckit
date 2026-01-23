# WI-B24: Processing Status

**Owner:** Agent B (Platform)  
**Status:** Proposed  
**Milestone:** M4  
**Dependencies:** B22, B23  
**Artifacts folder (recommended):** `../artifacts/WI-B24/`

## Goal
Implement the processing status endpoint for polling async work completion.

## Scope
### In
- `GET /api/admin/entries/{entryId}/processing-status` endpoint
- Returns `ProcessingStatusDto`
- Secretary or test-only authorization
- PDF status with download URL
- Email notification statuses
- Error information (sanitized)

### Out
- Background processing (see B20-B23)

## Implementation notes
- Used by Playwright for deterministic E2E testing
- Poll until terminal state (Success/Failed)
- Generate SAS URL on-demand if PDF ready
- Include last error code (no PII)
- Secretary can access any entry's status
- Consider rate limiting

## Acceptance criteria
- [ ] Returns PDF status
- [ ] Returns download URL when PDF ready
- [ ] Returns notification statuses
- [ ] Returns error codes (no PII)
- [ ] Secretary authorization works
- [ ] Works with TestAuth

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- Status endpoint returns correct shape
- SAS URL generated when PDF ready

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B24/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Endpoint returns all statuses
- Download URL works

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B24/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- Poll until PDF Success
- Download PDF via URL

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B24/playwright/status-polling-trace.zip`

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
- Rate limiting for polling
- Public vs authenticated access
- E2E gap: Playwright polling + PDF download validation is pending until secretary UI wiring (A12/A13) and B25 are live.

## DTO
```csharp
public record ProcessingStatusDto(
    Guid EntryId,
    string PdfStatus,
    string? GeneratedPdfDownloadUrl,
    List<NotificationStatusDto> EmailNotifications,
    ErrorDto? LastError
);

public record NotificationStatusDto(
    string RecipientType,
    string Status,
    DateTime? SentAtUtc,
    string? LastError
);

public record ErrorDto(
    string Code,
    string Message
);
```

## Implementation
```csharp
app.MapGet("/api/admin/entries/{entryId:guid}/processing-status", async (
    Guid entryId,
    DogTrialsDbContext context,
    IBlobStorageService blobService) =>
{
    var entry = await context.Entries
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
    
    string? downloadUrl = null;
    if (entry.PdfStatus == PdfStatus.Success && entry.GeneratedPdfBlobUri is not null)
    {
        downloadUrl = await blobService.GenerateSasUrlAsync(entryId, SasTtl.UiDownload, CancellationToken.None);
    }
    
    var notifications = entry.Notifications
        .Select(n => new NotificationStatusDto(
            n.RecipientType.ToString(),
            n.Status.ToString(),
            n.SentAtUtc,
            n.LastErrorCode))
        .ToList();
    
    var lastError = entry.PdfLastErrorCode is not null
        ? new ErrorDto(entry.PdfLastErrorCode, "PDF processing error. Contact support.")
        : null;
    
    return Results.Ok(new ProcessingStatusDto(
        entry.EntryId,
        entry.PdfStatus.ToString(),
        downloadUrl,
        notifications,
        lastError));
})
.RequireAuthorization("Secretary");
```

## Response Example
```json
{
  "entryId": "f3e0e855-6522-4d4b-8d9e-34e61f9a4a75",
  "pdfStatus": "Success",
  "generatedPdfDownloadUrl": "https://dgmvpstorage.blob.core.windows.net/pdf/entries/f3e0e855-6522-4d4b-8d9e-34e61f9a4a75.pdf?sv=...",
  "emailNotifications": [
    {
      "recipientType": "Handler",
      "status": "Success",
      "sentAtUtc": "2026-01-20T15:22:30Z",
      "lastError": null
    },
    {
      "recipientType": "Secretary",
      "status": "Success",
      "sentAtUtc": "2026-01-20T15:22:31Z",
      "lastError": null
    }
  ],
  "lastError": null
}
```

## Playwright Polling Helper
```typescript
async function waitForProcessingComplete(
  request: APIRequestContext,
  entryId: string,
  config: TestAuthConfig,
  timeoutMs: number = 60000
): Promise<ProcessingStatusDto> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const response = await request.get(
      `${config.apiUrl}/api/admin/entries/${entryId}/processing-status`,
      { headers: { Authorization: `Bearer ${config.token}` } }
    );
    
    const status = await response.json() as ProcessingStatusDto;
    
    // Check if all processing is complete
    const pdfComplete = status.pdfStatus === 'Success' || status.pdfStatus === 'Failed';
    const emailsComplete = status.emailNotifications.every(
      n => n.status === 'Success' || n.status === 'Failed'
    );
    
    if (pdfComplete && emailsComplete) {
      return status;
    }
    
    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error(`Processing not complete after ${timeoutMs}ms`);
}
```
