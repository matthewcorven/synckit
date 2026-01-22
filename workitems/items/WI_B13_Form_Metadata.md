# WI-B13: Form Metadata

**Owner:** Agent B (Platform)  
**Status:** Proposed  
**Milestone:** M2  
**Dependencies:** B11  
**Artifacts folder (recommended):** `../artifacts/WI-B13/`

## Goal
Implement the form template metadata endpoint for direct form lookup.

## Scope
### In
- `GET /api/form-templates/{org}/{sport}/{form}/{version}/metadata` endpoint
- Returns `FormMetadataDto`
- Grid structure with disabled cells
- Authentication required

### Out
- Trial registration metadata (see B12)
- Entry endpoints (see B14+)

## Implementation notes
- This is an alternative to getting metadata via trial
- Useful for direct form template lookup
- MVP: Return hardcoded metadata for known templates
- Future: Store templates in database

## Acceptance criteria
- [ ] Endpoint returns form metadata
- [ ] Response includes grid structure
- [ ] Disabled cells match PRD spec
- [ ] 404 for unknown form template
- [ ] Authentication required

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- Endpoint returns correct DTO shape
- Unknown template returns 404

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B13/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Known template returns expected structure
- Disabled cells correct

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B13/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- N/A — covered by B12

**Artifacts (add as relative links during work)**
- N/A

### DB verification
**Artifact requirements**
- N/A

**Artifacts (add as relative links during work)**
- N/A

### Telemetry verification
- Verify span tags

**Artifact requirements**
- N/A

**Artifacts (add as relative links during work)**
- N/A

## Risks / Questions
- Version handling (exact match vs compatibility)

## Implementation
```csharp
app.MapGet("/api/form-templates/{org}/{sport}/{form}/{version}/metadata", (
    string org,
    string sport,
    string form,
    string version,
    IFormMetadataService formMetadataService) =>
{
    var template = new FormTemplateKeyDto(org, sport, form, version);
    
    try
    {
        var metadata = formMetadataService.GetFormMetadata(template);
        return Results.Ok(metadata);
    }
    catch (UnknownFormTemplateException)
    {
        return Results.Problem(
            title: "Form template not found",
            statusCode: 404,
            extensions: new Dictionary<string, object?>
            {
                ["errorCode"] = "FORM_TEMPLATE_NOT_FOUND"
            });
    }
})
.RequireAuthorization("Handler");
```

## Response Example
```json
{
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
      "cols": ["STD", "OPN", "ADV", "FTD_OPN", "FTD_ADV", "DATE1_TRIAL1", "DATE1_TRIAL2"],
      "disabledCells": [
        { "row": "Mixed", "col": "STD" },
        { "row": "Mixed", "col": "OPN" },
        { "row": "Mixed", "col": "ADV" },
        { "row": "Mixed", "col": "FTD_OPN" },
        { "row": "Mixed", "col": "FTD_ADV" }
      ]
    },
    {
      "grid": "Lower",
      "rows": ["Sheep", "Cattle", "Ducks"],
      "cols": ["NOV", "WRK_JR_HNDLR", "FEO", "POST_ADV", "RTD", "DATE1_TRIAL1", "DATE1_TRIAL2"],
      "disabledCells": [
        { "row": "Ducks", "col": "POST_ADV" },
        { "row": "Ducks", "col": "RTD" }
      ]
    }
  ]
}
```
