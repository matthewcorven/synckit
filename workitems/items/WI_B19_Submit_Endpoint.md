# WI-B19: Submit Endpoint

**Owner:** Agent B (Platform)  
**Status:** Proposed  
**Milestone:** M3  
**Dependencies:** B16, B17, B18  
**Artifacts folder (recommended):** `../artifacts/WI-B19/`

## Goal
Implement the submit entry endpoint with validation, sequence allocation, and background job enqueuing.

## Scope
### In
- `POST /api/entries/{entryId}/submit` endpoint
- Comprehensive validation (all required fields)
- Terms acceptance recording
- Sequence number allocation (transactional)
- Registration/Tracking number generation
- Status transition: Draft → Submitted
- Enqueue PDF and email jobs
- Return support ID

### Out
- Background processing (see B20)
- PDF generation (see B21)
- Email sending (see B23)

## Implementation notes
- Validation rules per PRD:
  - Required dog fields: breed, callName, dob, sex
  - Required contact fields: owners, email, phone
  - Required emergency: name, phoneOrNumber
  - Required fees: totalEntryFees > 0
  - Required: at least one selection
  - Required: terms accepted
- Email constraint: `contact.email` must match authenticated user (configurable)
- Sequence allocation: Use transactional pattern from B04
- Registration number format: `{TrackingSlug}-{paddedSequence}`
- Idempotent: If already Submitted, return 409
- OpenTelemetry span: `Entry.Submit`

## Acceptance criteria
- [ ] Validates all required fields
- [ ] Returns 400 with validation errors
- [ ] Returns 409 if already submitted
- [ ] Allocates sequence number atomically
- [ ] Generates registration/tracking number
- [ ] Transitions status to Submitted
- [ ] Records terms acceptance
- [ ] Enqueues PDF and email jobs
- [ ] Returns support ID

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- All validation rules tested
- Sequence allocation logic tested
- Registration number format tested

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B19/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Valid submit succeeds
- Missing required field returns 400
- Already submitted returns 409
- Concurrent submits don't duplicate sequence

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B19/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- Complete form, submit, verify success
- Submit with missing field, verify errors

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B19/playwright/submit-trace.zip`

### DB verification
**Artifact requirements**
- Entry status = Submitted
- SequenceNumber set
- RegistrationOrTrackingNumber set
- Terms fields populated
- Notifications created

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B19/db/submit-verification.txt`

### Telemetry verification
- Verify `Entry.Submit` span with all tags

**Artifact requirements**
- Trace screenshot

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B19/telemetry/submit-trace.png`

## Risks / Questions
- Email mismatch handling (strict vs configurable)
- Concurrent submit race conditions

## DTO
```csharp
public record SubmitEntryRequestDto(
    bool AcceptTerms,
    string TermsVersion
);

public record SubmitEntryResponseDto(
    Guid EntryId,
    string Status,
    string SupportId
);
```

## Implementation
```csharp
app.MapPost("/api/entries/{entryId:guid}/submit", async (
    Guid entryId,
    SubmitEntryRequestDto request,
    HttpContext context,
    DogTrialsDbContext dbContext,
    ISequenceAllocator sequenceAllocator,
    IBackgroundJobQueue jobQueue,
    IOptions<SubmitOptions> options,
    ILogger<EntriesEndpoints> logger) =>
{
    using var activity = DiagnosticConfig.ActivitySource.StartActivity("Entry.Submit");
    activity?.SetTag("entry.id", entryId);
    
    var userId = context.GetUserId();
    var userEmail = context.User.FindFirst("email")?.Value;
    
    await using var transaction = await dbContext.Database.BeginTransactionAsync();
    
    try
    {
        var entry = await dbContext.Entries
            .Include(e => e.Trial)
            .Where(e => e.EntryId == entryId)
            .FirstOrDefaultAsync();
            
        if (entry is null)
            return Results.Problem(title: "Entry not found", statusCode: 404);
            
        if (entry.CreatedByUserId != userId)
            return Results.Problem(title: "Access denied", statusCode: 403);
            
        if (entry.Status != EntryStatus.Draft)
            return Results.Problem(title: "Entry already submitted", statusCode: 409,
                extensions: new Dictionary<string, object?> { ["errorCode"] = "ENTRY_ALREADY_SUBMITTED" });
        
        // Validate required fields
        var errors = ValidateEntry(entry, request, userEmail, options.Value);
        if (errors.Any())
        {
            return Results.Problem(
                title: "One or more validation errors occurred.",
                statusCode: 400,
                extensions: new Dictionary<string, object?>
                {
                    ["errors"] = errors
                });
        }
        
        // Allocate sequence number
        var sequenceNumber = await sequenceAllocator.AllocateAsync(entry.TrialId);
        
        // Generate registration number
        var regNumber = $"{entry.Trial.TrackingSlug}-{sequenceNumber:D4}";
        
        // Update entry
        entry.Status = EntryStatus.Submitted;
        entry.SequenceNumber = sequenceNumber;
        entry.RegistrationOrTrackingNumber = regNumber;
        entry.SubmittedAtUtc = DateTime.UtcNow;
        entry.TermsVersion = request.TermsVersion;
        entry.TermsAcceptedAtUtc = DateTime.UtcNow;
        entry.TermsAcceptedByUserId = userId;
        entry.UpdatedAtUtc = DateTime.UtcNow;
        
        // Create notification records
        dbContext.Notifications.AddRange(
            new Notification
            {
                NotificationId = Guid.NewGuid(),
                EntryId = entryId,
                RecipientType = RecipientType.Handler,
                Status = NotificationStatus.Queued,
                CreatedAtUtc = DateTime.UtcNow
            },
            new Notification
            {
                NotificationId = Guid.NewGuid(),
                EntryId = entryId,
                RecipientType = RecipientType.Secretary,
                Status = NotificationStatus.Queued,
                CreatedAtUtc = DateTime.UtcNow
            });
        
        await dbContext.SaveChangesAsync();
        await transaction.CommitAsync();
        
        // Enqueue background jobs
        await jobQueue.EnqueuePdfGenerationAsync(entryId);
        
        var traceId = Activity.Current?.TraceId.ToString() ?? Guid.NewGuid().ToString("N");
        
        activity?.SetTag("entry.status", "Submitted");
        activity?.SetTag("entry.registrationNumber", regNumber);
        
        return Results.Ok(new SubmitEntryResponseDto(
            entry.EntryId,
            "Submitted",
            traceId));
    }
    catch
    {
        await transaction.RollbackAsync();
        throw;
    }
})
.RequireAuthorization("Handler");
```

## Validation Helper
```csharp
private static Dictionary<string, string[]> ValidateEntry(
    Entry entry, SubmitEntryRequestDto request, string? userEmail, SubmitOptions options)
{
    var errors = new Dictionary<string, List<string>>();
    
    void AddError(string field, string message)
    {
        if (!errors.ContainsKey(field))
            errors[field] = new List<string>();
        errors[field].Add(message);
    }
    
    // Dog validation
    if (string.IsNullOrWhiteSpace(entry.DogBreed))
        AddError("dog.breed", "Breed is required.");
    if (string.IsNullOrWhiteSpace(entry.DogCallName))
        AddError("dog.callName", "Call Name is required.");
    if (entry.DogDob is null)
        AddError("dog.dob", "Date of Birth is required.");
    if (string.IsNullOrWhiteSpace(entry.DogSex))
        AddError("dog.sex", "Sex is required.");
        
    // Contact validation
    if (string.IsNullOrWhiteSpace(entry.ContactOwners))
        AddError("contact.owners", "Owners is required.");
    if (string.IsNullOrWhiteSpace(entry.ContactEmail))
        AddError("contact.email", "Email is required.");
    if (string.IsNullOrWhiteSpace(entry.ContactPhone))
        AddError("contact.phone", "Phone is required.");
        
    // Email match validation
    if (!options.AllowDifferentEmail && 
        !string.Equals(entry.ContactEmail, userEmail, StringComparison.OrdinalIgnoreCase))
        AddError("contact.email", "Email must match your login email.");
        
    // Emergency validation
    if (string.IsNullOrWhiteSpace(entry.EmergencyName))
        AddError("emergencyContact.name", "Emergency contact name is required.");
    if (string.IsNullOrWhiteSpace(entry.EmergencyPhone))
        AddError("emergencyContact.phoneOrNumber", "Emergency contact phone is required.");
        
    // Fees validation
    if (entry.TotalEntryFees is null or <= 0)
        AddError("fees.totalEntryFees", "Entry fees must be greater than zero.");
        
    // Selections validation
    var selections = DeserializeSelections(entry.SelectionsJson);
    if (selections is null || (!selections.Upper.Any() && !selections.Lower.Any()))
        AddError("selections", "At least one class selection is required.");
        
    // Terms validation
    if (!request.AcceptTerms)
        AddError("terms", "You must accept the terms.");
    if (string.IsNullOrWhiteSpace(request.TermsVersion))
        AddError("terms", "Terms version is required.");
    
    return errors.ToDictionary(k => k.Key, v => v.Value.ToArray());
}
```
