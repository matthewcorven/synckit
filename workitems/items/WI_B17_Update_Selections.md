# WI-B17: Update Selections

**Owner:** Agent B (Platform)  
**Status:** Proposed  
**Milestone:** M2  
**Dependencies:** B15  
**Artifacts folder (recommended):** `../artifacts/WI-B17/`

## Goal
Implement the update selections endpoint for grid class selections.

## Scope
### In
- `PUT /api/entries/{entryId}/selections` endpoint
- Request body: `EntrySelectionsReplaceRequestDto`
- Replaces all selections for specified grid
- Validates disabled cells
- Only Draft entries
- Ownership validation

### Out
- Submit endpoint (see B19)

## Implementation notes
- Replaces entire grid selections (not merge)
- Validates no disabled cells are selected
- Returns 400 with errors.selections if disabled cell targeted
- Store as JSON in SelectionsJson column
- OpenTelemetry span: `Entry.UpdateSelections`

## Acceptance criteria
- [ ] Replaces selections for specified grid
- [ ] Validates disabled cells
- [ ] Returns 400 for disabled cell selection
- [ ] Only works on Draft entries
- [ ] Returns updated entry detail

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- Selections replaced correctly
- Disabled cell validation works
- Status validation works

**Artifacts (add as relative links during work)**
- [../artifacts/WI-B17/unit-test-results.txt](../artifacts/WI-B17/unit-test-results.txt)

### Integration tests (BDD)
**Artifact requirements**
- Update selections succeeds
- Disabled cell returns 400
- Selections persisted correctly

**Artifacts (add as relative links during work)**
- [../artifacts/WI-B17/integration-test-results.txt](../artifacts/WI-B17/integration-test-results.txt)

### E2E (BDD, Playwright)
**Artifact requirements**
- Select cells in UI, save, reload, verify

**Artifacts (add as relative links during work)**
- [../artifacts/WI-B17/playwright/selections-trace.zip](../artifacts/WI-B17/playwright/selections-trace.zip)

### DB verification
**Artifact requirements**
- SelectionsJson updated correctly

**Artifacts (add as relative links during work)**
- [../artifacts/WI-B17/db/selections-updated.txt](../artifacts/WI-B17/db/selections-updated.txt)

### Telemetry verification
- Verify `Entry.UpdateSelections` span

**Artifact requirements**
- N/A

**Artifacts (add as relative links during work)**
- N/A

## Risks / Questions
- Should we validate selection count?
- Date columns based on trial dates?

## DTO
```csharp
public record EntrySelectionsReplaceRequestDto(
    string Grid,  // "Upper" or "Lower"
    List<SelectionItemDto> Items
);

public record SelectionItemDto(
    string Row,
    string Col,
    string Value  // "X" or ""
);
```

## Implementation
```csharp
app.MapPut("/api/entries/{entryId:guid}/selections", async (
    Guid entryId,
    EntrySelectionsReplaceRequestDto request,
    HttpContext context,
    DogTrialsDbContext dbContext,
    IFormMetadataService formMetadataService) =>
{
    using var activity = DiagnosticConfig.ActivitySource.StartActivity("Entry.UpdateSelections");
    activity?.SetTag("entry.id", entryId);
    activity?.SetTag("grid", request.Grid);
    
    var userId = context.GetUserId();
    
    var entry = await dbContext.Entries
        .Include(e => e.Trial)
        .Where(e => e.EntryId == entryId)
        .FirstOrDefaultAsync();
        
    if (entry is null)
        return Results.Problem(title: "Entry not found", statusCode: 404);
        
    if (entry.CreatedByUserId != userId)
        return Results.Problem(title: "Access denied", statusCode: 403);
        
    if (entry.Status != EntryStatus.Draft)
        return Results.Problem(title: "Entry already submitted", statusCode: 409);
    
    // Validate disabled cells
    var formTemplate = new FormTemplateKeyDto(
        entry.Trial.OrganizationCode,
        entry.Trial.SportCode,
        entry.Trial.FormCode,
        entry.Trial.FormVersion);
    var metadata = formMetadataService.GetFormMetadata(formTemplate);
    var gridMetadata = metadata.Grids.FirstOrDefault(g => g.Grid == request.Grid);
    
    if (gridMetadata is null)
    {
        return Results.Problem(
            title: "Invalid grid",
            statusCode: 400,
            extensions: new Dictionary<string, object?>
            {
                ["errors"] = new Dictionary<string, string[]>
                {
                    ["grid"] = new[] { "Invalid grid specified." }
                }
            });
    }
    
    var disabledSet = gridMetadata.DisabledCells
        .Select(d => $"{d.Row}:{d.Col}")
        .ToHashSet();
        
    var invalidSelections = request.Items
        .Where(i => i.Value == "X" && disabledSet.Contains($"{i.Row}:{i.Col}"))
        .ToList();
        
    if (invalidSelections.Any())
    {
        return Results.Problem(
            title: "Selection targets a disabled cell",
            statusCode: 400,
            extensions: new Dictionary<string, object?>
            {
                ["errors"] = new Dictionary<string, string[]>
                {
                    ["selections"] = new[] { "Selection targets a disabled cell." }
                }
            });
    }
    
    // Update selections
    var selections = DeserializeSelections(entry.SelectionsJson) 
        ?? new SelectionsDto(new List<SelectionItemDto>(), new List<SelectionItemDto>());
    
    if (request.Grid == "Upper")
        selections = selections with { Upper = request.Items };
    else
        selections = selections with { Lower = request.Items };
    
    entry.SelectionsJson = JsonSerializer.Serialize(selections);
    entry.UpdatedAtUtc = DateTime.UtcNow;
    await dbContext.SaveChangesAsync();
    
    return Results.Ok(entry.ToDetailDto());
})
.RequireAuthorization("Handler");
```

## Request Example
```json
{
  "grid": "Upper",
  "items": [
    { "row": "Sheep", "col": "STD", "value": "X" },
    { "row": "Sheep", "col": "DATE1_TRIAL1", "value": "X" },
    { "row": "Cattle", "col": "OPN", "value": "X" }
  ]
}
```

## Error Response (Disabled Cell)
```json
{
  "type": "https://tools.ietf.org/html/rfc7807",
  "title": "Selection targets a disabled cell",
  "status": 400,
  "traceId": "abc123...",
  "errors": {
    "selections": ["Selection targets a disabled cell."]
  }
}
```
