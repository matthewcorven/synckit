# WI-B12: Registration Metadata

**Owner:** Agent B (Platform)  
**Status:** Proposed  
**Milestone:** M2  
**Dependencies:** B11  
**Artifacts folder (recommended):** `../artifacts/WI-B12/`

## Goal
Implement the trial-scoped registration metadata endpoint.

## Scope
### In
- `GET /api/trials/{trialId}/registration/metadata` endpoint
- Returns `TrialRegistrationMetadataDto`
- Includes embedded FormMetadataDto with grid structure
- Authentication required

### Out
- Form template metadata endpoint (see B13)
- Entry endpoints (see B14+)

## Implementation notes
- Trial is the entry point for registration
- Response includes formTemplate key AND full form metadata
- Grid structure (rows, cols, disabledCells) embedded
- This makes the trial the single entry point for starting registration

## Acceptance criteria
- [ ] Endpoint returns registration metadata for trial
- [ ] Response includes formTemplate key
- [ ] Response includes full grid metadata
- [ ] 404 for non-existent trial
- [ ] Authentication required

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- Endpoint returns correct DTO shape
- Grid metadata included

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B12/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Endpoint returns expected structure
- Disabled cells match PRD spec

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B12/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- UI can fetch metadata and render grids

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B12/playwright/metadata-trace.zip`

### DB verification
**Artifact requirements**
- N/A — derived data

**Artifacts (add as relative links during work)**
- N/A

### Telemetry verification
- Verify span tags

**Artifact requirements**
- Trace screenshot

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B12/telemetry/metadata-trace.png`

## Risks / Questions
- ~~Should grid metadata be stored in DB or hardcoded for MVP?~~ → **RESOLVED: Stored in database** - FormTemplates table with JSON grid config

## DTO (from PRD)
```csharp
public record TrialRegistrationMetadataDto(
    Guid TrialId,
    FormTemplateKeyDto FormTemplate,
    FormMetadataDto FormMetadata
);

public record FormMetadataDto(
    FormTemplateKeyDto FormTemplate,
    List<GridMetadataDto> Grids
);

public record GridMetadataDto(
    string Grid,  // "Upper" or "Lower"
    List<string> Rows,
    List<string> Cols,
    List<DisabledCellDto> DisabledCells
);

public record DisabledCellDto(string Row, string Col);
```

## Implementation
```csharp
app.MapGet("/api/trials/{trialId:guid}/registration/metadata", async (
    Guid trialId,
    DogTrialsDbContext context,
    IFormMetadataService formMetadataService) =>
{
    var trial = await context.Trials.FindAsync(trialId);
    
    if (trial is null)
    {
        return Results.Problem(
            title: "Trial not found",
            statusCode: 404,
            extensions: new Dictionary<string, object?>
            {
                ["errorCode"] = "TRIAL_NOT_FOUND"
            });
    }
    
    var formTemplate = new FormTemplateKeyDto(
        trial.OrganizationCode,
        trial.SportCode,
        trial.FormCode,
        trial.FormVersion);
    
    var formMetadata = formMetadataService.GetFormMetadata(formTemplate);
    
    return Results.Ok(new TrialRegistrationMetadataDto(
        trial.TrialId,
        formTemplate,
        formMetadata));
})
.RequireAuthorization("Handler");
```

## Form Metadata Service (Database Storage)
```csharp
// FormTemplates entity stores grid configuration in database
public class FormTemplate
{
    public int FormTemplateId { get; set; }
    public string OrganizationCode { get; set; } = null!;
    public string SportCode { get; set; } = null!;
    public string FormCode { get; set; } = null!;
    public string Version { get; set; } = null!;
    public string GridConfigJson { get; set; } = null!;  // JSON column
}

public class FormMetadataService : IFormMetadataService
{
    private readonly DogTrialsDbContext _context;
    
    public FormMetadataService(DogTrialsDbContext context)
    {
        _context = context;
    }
    
    public async Task<FormMetadataDto?> GetFormMetadataAsync(FormTemplateKeyDto template)
    {
        var formTemplate = await _context.FormTemplates
            .FirstOrDefaultAsync(f => 
                f.OrganizationCode == template.OrganizationCode &&
                f.SportCode == template.SportCode &&
                f.FormCode == template.FormCode &&
                f.Version == template.Version);
                
        if (formTemplate is null) return null;
        
        var grids = JsonSerializer.Deserialize<List<GridMetadataDto>>(
            formTemplate.GridConfigJson);
            
        return new FormMetadataDto(template, grids ?? new());
    }
}
```

## Response Example
```json
{
  "trialId": "9d4a8d25-2c59-4f1f-8c79-6c63e74f5f49",
  "formTemplate": {
    "organizationCode": "ASCA",
    "sportCode": "StockDog",
    "formCode": "TrialEntry",
    "version": "2020-10-08"
  },
  "formMetadata": {
    "formTemplate": {
      "organizationCode": "ASCA",
      "sportCode": "StockDog",
      "formCode": "TrialEntry",
      "version": "2020-10-08"
    },
    "grids": [
      {
        "grid": "Upper",
        "rows": ["Sheep", "Cattle", "Ducks", "Mixed"],
        "cols": ["STD", "OPN", "ADV", "FTD_OPN", "FTD_ADV", "DATE1_TRIAL1"],
        "disabledCells": [
          { "row": "Mixed", "col": "STD" },
          { "row": "Mixed", "col": "OPN" }
        ]
      }
    ]
  }
}
```
