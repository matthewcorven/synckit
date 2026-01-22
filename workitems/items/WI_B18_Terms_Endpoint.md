# WI-B18: Terms Endpoint

**Owner:** Agent B (Platform)  
**Status:** Proposed  
**Milestone:** M3  
**Dependencies:** B08  
**Artifacts folder (recommended):** `../artifacts/WI-B18/`

## Goal
Implement the current terms endpoint and terms HTML asset management.

## Scope
### In
- `GET /api/terms/current` endpoint
- Returns `TermsDto` with version and HTML content
- Terms HTML stored as embedded resource or file
- Version tracking via configuration
- Authentication required

### Out
- Submit endpoint (see B19)
- Terms acceptance storage (handled in submit)

## Implementation notes
- Terms version from configuration (`TERMS_VERSION`)
- HTML content stored in `Data/terms/v1.html`
- Return sanitized HTML (no script injection)
- Version must match what's accepted in submit
- Consider caching for performance

## Acceptance criteria
- [ ] Returns terms with version and HTML
- [ ] HTML is properly sanitized
- [ ] Version matches configuration
- [ ] Authentication required
- [ ] Response matches TermsDto

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- Endpoint returns correct DTO
- HTML content loaded correctly

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B18/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Terms endpoint returns expected content

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B18/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- UI loads and displays terms

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B18/playwright/terms-trace.zip`

### DB verification
**Artifact requirements**
- N/A — static content

**Artifacts (add as relative links during work)**
- N/A

### Telemetry verification
- N/A

**Artifact requirements**
- N/A

**Artifacts (add as relative links during work)**
- N/A

## Risks / Questions
- Terms content approval process
- Multiple versions support (future)

## DTO
```csharp
public record TermsDto(
    string Version,
    string Html
);
```

## Implementation
```csharp
app.MapGet("/api/terms/current", async (
    IOptions<TermsOptions> options,
    ITermsService termsService) =>
{
    var terms = await termsService.GetCurrentTermsAsync();
    return Results.Ok(terms);
})
.RequireAuthorization("Handler");

public class TermsService : ITermsService
{
    private readonly TermsOptions _options;
    private readonly IWebHostEnvironment _env;
    
    public async Task<TermsDto> GetCurrentTermsAsync()
    {
        var version = _options.CurrentVersion;
        var htmlPath = Path.Combine(_env.ContentRootPath, "Data", "terms", $"{version}.html");
        
        if (!File.Exists(htmlPath))
        {
            throw new FileNotFoundException($"Terms file not found: {version}");
        }
        
        var html = await File.ReadAllTextAsync(htmlPath);
        
        // Basic sanitization (consider using a proper sanitizer library)
        html = SanitizeHtml(html);
        
        return new TermsDto(version, html);
    }
    
    private string SanitizeHtml(string html)
    {
        // Remove script tags and event handlers
        // Consider using HtmlSanitizer NuGet package
        return html;
    }
}
```

## Configuration
```json
{
  "Terms": {
    "CurrentVersion": "v1"
  }
}
```

## Terms HTML File: Data/terms/v1.html
```html
<h1>Terms and Conditions</h1>

<h2>1. Agreement to Rules</h2>
<p>By submitting this entry, I agree to abide by all ASCA rules and regulations 
governing stockdog trials. I understand that my entry may be rejected if it does 
not comply with these rules.</p>

<h2>2. Liability Waiver</h2>
<p>I understand that participation in stockdog trials involves inherent risks to 
myself, my dog, and my property. I hereby release and hold harmless the trial 
host club, ASCA, and their officers, directors, and volunteers from any and all 
claims for injury or damage.</p>

<h2>3. Dog Health and Vaccination</h2>
<p>I certify that my dog is in good health and has current vaccinations as required 
by the trial host club and local regulations.</p>

<h2>4. Photo/Video Release</h2>
<p>I grant permission for photos and videos taken during the event to be used for 
promotional purposes by the trial host club and ASCA without compensation.</p>

<h2>5. Entry Fees</h2>
<p>I understand that entry fees are non-refundable unless the trial is cancelled. 
In the event of cancellation, refunds will be processed according to club policy.</p>

<h2>6. Conduct</h2>
<p>I agree to conduct myself in a sportsmanlike manner and to treat all participants, 
volunteers, and livestock with respect. Unsportsmanlike conduct may result in 
dismissal from the trial without refund.</p>
```

## Response Example
```json
{
  "version": "v1",
  "html": "<h1>Terms and Conditions</h1><h2>1. Agreement to Rules</h2><p>By submitting this entry...</p>"
}
```
