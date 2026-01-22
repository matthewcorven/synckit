# WI-B15: Get Entry

**Owner:** Agent B (Platform)  
**Status:** Proposed  
**Milestone:** M2  
**Dependencies:** B14  
**Artifacts folder (recommended):** `../artifacts/WI-B15/`

## Goal
Implement the get entry detail endpoint.

## Scope
### In
- `GET /api/entries/{entryId}` endpoint
- Returns `EntryDetailDto`
- Ownership validation (user can only see own entries)
- Handler authorization
- Full entry detail including all form fields

### Out
- Update entry (see B16)
- Update selections (see B17)
- Secretary access (see B25)

## Implementation notes
- Validates entry belongs to authenticated user
- Returns 403 if not owner
- Returns 404 if entry doesn't exist
- Maps all fields to EntryDetailDto
- Includes trial summary in response
- Includes processing status

## Acceptance criteria
- [ ] Returns full entry detail
- [ ] Validates ownership
- [ ] Returns 403 if not owner
- [ ] Returns 404 if not found
- [ ] Response matches EntryDetailDto exactly
- [ ] Handler authorization required

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- Entry returned with correct DTO shape
- Ownership validation works
- 404 for missing entry

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B15/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Get own entry succeeds
- Get other user's entry returns 403
- Non-existent entry returns 404

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B15/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- Create entry, fetch it, verify data

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B15/playwright/get-entry-trace.zip`

### DB verification
**Artifact requirements**
- N/A — read-only

**Artifacts (add as relative links during work)**
- N/A

### Telemetry verification
- Verify span with entry.id tag

**Artifact requirements**
- N/A

**Artifacts (add as relative links during work)**
- N/A

## Risks / Questions
- Should selections be embedded or separate endpoint?

## Implementation
```csharp
app.MapGet("/api/entries/{entryId:guid}", async (
    Guid entryId,
    HttpContext context,
    DogTrialsDbContext dbContext) =>
{
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
    
    return Results.Ok(entry.ToDetailDto());
})
.RequireAuthorization("Handler");
```

## DTO Mapping
```csharp
public static EntryDetailDto ToDetailDto(this Entry e) => new(
    e.EntryId,
    e.Trial.ToTrialInfoDto(),
    e.Status.ToString(),
    new FormTemplateKeyDto(
        e.Trial.OrganizationCode,
        e.Trial.SportCode,
        e.Trial.FormCode,
        e.Trial.FormVersion),
    new DogDto(
        e.RegistrationOrTrackingNumber,
        e.DogBreed,
        e.DogRegisteredName,
        e.DogDob?.ToString("yyyy-MM-dd"),
        e.DogColor,
        e.DogCallName,
        e.DogSex,
        e.DogSire,
        e.DogDam,
        e.DogBreeders),
    new ContactDto(
        e.ContactOwners,
        new AddressDto(e.ContactStreet, e.ContactCity, e.ContactState, e.ContactZip),
        e.ContactEmail,
        e.ContactPhone,
        e.ContactHandler,
        e.ContactMembershipNumber,
        e.JuniorDob is not null ? new JuniorDto(e.JuniorDob?.ToString("yyyy-MM-dd"), e.JuniorMemberId) : null),
    new FeesDto(e.TotalEntryFees, "USD"),
    new EmergencyContactDto(e.EmergencyName, e.EmergencyPhone),
    DeserializeSelections(e.SelectionsJson),
    new TermsDto(e.TermsVersion, e.TermsAcceptedAtUtc, e.TermsAcceptedByUserId),
    new ProcessingDto(
        e.PdfStatus.ToString(),
        new GeneratedPdfDto(e.GeneratedPdfBlobUri, null), // SAS URL generated on demand
        e.Notifications.Select(n => n.ToDto()).ToList(),
        e.PdfLastErrorCode is not null 
            ? new ErrorDto(e.PdfLastErrorCode, "Processing error") 
            : null)
);
```

## Response Example (from PRD)
```json
{
  "entryId": "f3e0e855-6522-4d4b-8d9e-34e61f9a4a75",
  "trial": {
    "trialId": "9d4a8d25-2c59-4f1f-8c79-6c63e74f5f49",
    "name": "Spring Stockdog Trial",
    "organizerSlug": "EXCLUB",
    "eventSlug": "SPRING-2026-05-02",
    "trackingSlug": "EXCLUB-SPRING-2026-05-02",
    "hostClub": "Example Club",
    "startDate": "2026-05-02",
    "endDate": "2026-05-03",
    "secretaryEmail": "secretary@example.com"
  },
  "status": "Draft",
  "formTemplate": { "organizationCode": "ASCA", "sportCode": "StockDog", "formCode": "TrialEntry", "version": "2020-10-08" },
  "dog": {
    "registrationOrTrackingNumber": null,
    "breed": "Australian Shepherd",
    "callName": "Ranger"
  },
  "contact": {
    "owners": "Jane Handler",
    "email": "jane@example.com"
  },
  "selections": {
    "upper": [{ "row": "Sheep", "col": "STD", "value": "X" }],
    "lower": []
  },
  "terms": {
    "version": "v1",
    "acceptedAtUtc": null
  },
  "processing": {
    "pdfStatus": "Queued",
    "emailNotifications": []
  }
}
```
