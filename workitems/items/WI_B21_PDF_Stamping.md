# WI-B21: PDF Stamping

**Owner:** Agent B (Platform)  
**Status:** Proposed  
**Milestone:** M4  
**Dependencies:** B20  
**Artifacts folder (recommended):** `../artifacts/WI-B21/`

## Goal
Implement PDF template loading and form field stamping service.

## Scope
### In
- PDF library integration (QuestPDF, iText, or similar OSS)
- Template loading from assets
- Form field stamping with entry data
- Grid cell marking
- Output PDF generation
- PdfStatus tracking

### Out
- Blob storage (see B22)
- Email attachment (see B23)

## Implementation notes
- Library selection: Use permissive OSS license (MIT/Apache)
- Template: `Assets/templates/asca-stockdog-entry.pdf`
- Stamp all form fields matching EntryDetailDto
- Mark grid cells with X for selections
- Generate Registration/Tracking number in header
- Set PdfStatus to InProgress while generating
- Set to Success/Failed after completion
- OpenTelemetry span: `Pdf.Generate`

## Acceptance criteria
- [ ] PDF template loaded successfully
- [ ] All form fields stamped correctly
- [ ] Grid selections marked with X
- [ ] Registration number appears
- [ ] Output PDF is valid
- [ ] PdfStatus tracking works

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- Template loading works
- Field stamping produces valid PDF
- Grid marking works

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B21/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Generate PDF from entry data
- Verify PDF is readable

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B21/integration-test-results.txt`
- `../artifacts/WI-B21/sample-output.pdf`

### E2E (BDD, Playwright)
**Artifact requirements**
- N/A — backend only

**Artifacts (add as relative links during work)**
- N/A

### DB verification
**Artifact requirements**
- PdfStatus transitions correctly

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B21/db/pdf-status.txt`

### Telemetry verification
- Verify `Pdf.Generate` span with status tag

**Artifact requirements**
- Trace screenshot

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B21/telemetry/pdf-generate-trace.png`

## Risks / Questions
- ~~PDF library licensing (ensure OSS compliant)~~ → **RESOLVED: QuestPDF** - Modern .NET, MIT license, fluent API
- Template format and field names

## Implementation
```csharp
public interface IPdfStampingService
{
    Task<byte[]> GeneratePdfAsync(Entry entry, CancellationToken ct);
}

public class PdfStampingService : IPdfStampingService
{
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<PdfStampingService> _logger;
    
    public async Task<byte[]> GeneratePdfAsync(Entry entry, CancellationToken ct)
    {
        using var activity = DiagnosticConfig.ActivitySource.StartActivity("Pdf.Generate");
        activity?.SetTag("entry.id", entry.EntryId);
        
        try
        {
            var templatePath = Path.Combine(_env.ContentRootPath, 
                "Assets", "templates", "asca-stockdog-entry.pdf");
            
            // Using QuestPDF as example (actual implementation depends on library choice)
            var document = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Content().Column(column =>
                    {
                        // Header with registration number
                        column.Item().Text($"Registration #: {entry.RegistrationOrTrackingNumber}");
                        
                        // Dog information
                        column.Item().Text($"Call Name: {entry.DogCallName}");
                        column.Item().Text($"Breed: {entry.DogBreed}");
                        // ... more fields
                        
                        // Grid sections
                        RenderGrid(column, entry);
                    });
                });
            });
            
            using var stream = new MemoryStream();
            document.GeneratePdf(stream);
            
            activity?.SetTag("pdf.status", "Success");
            return stream.ToArray();
        }
        catch (Exception ex)
        {
            activity?.SetTag("pdf.status", "Failed");
            activity?.SetTag("error", ex.Message);
            _logger.LogError(ex, "PDF generation failed for entry {EntryId}", entry.EntryId);
            throw;
        }
    }
}
```

## Job Handler
```csharp
public class PdfJobHandler : IPdfJobHandler
{
    private readonly DogTrialsDbContext _context;
    private readonly IPdfStampingService _pdfService;
    private readonly IBlobStorageService _blobService;
    private readonly IBackgroundJobQueue _queue;
    
    public async Task HandleAsync(PdfGenerationJob job, CancellationToken ct)
    {
        var entry = await _context.Entries
            .Include(e => e.Trial)
            .FirstOrDefaultAsync(e => e.EntryId == job.EntryId, ct);
            
        if (entry is null) return;
        
        // Idempotency check
        if (entry.PdfStatus == PdfStatus.Success)
        {
            _logger.LogDebug("PDF already generated for {EntryId}", job.EntryId);
            return;
        }
        
        entry.PdfStatus = PdfStatus.InProgress;
        entry.PdfLastAttemptAtUtc = DateTime.UtcNow;
        entry.PdfAttemptCount++;
        await _context.SaveChangesAsync(ct);
        
        try
        {
            var pdfBytes = await _pdfService.GeneratePdfAsync(entry, ct);
            var blobUri = await _blobService.UploadPdfAsync(entry.EntryId, pdfBytes, ct);
            
            entry.PdfStatus = PdfStatus.Success;
            entry.GeneratedPdfBlobUri = blobUri;
            entry.PdfLastErrorCode = null;
            
            // Enqueue email notifications now that PDF is ready
            await _queue.EnqueueEmailNotificationAsync(entry.EntryId, RecipientType.Handler);
            await _queue.EnqueueEmailNotificationAsync(entry.EntryId, RecipientType.Secretary);
        }
        catch (Exception ex)
        {
            entry.PdfStatus = PdfStatus.Failed;
            entry.PdfLastErrorCode = "PDF_GENERATION_FAILED";
            entry.PdfNextAttemptAtUtc = RetryCalculator.GetNextAttemptTime(entry.PdfAttemptCount);
            
            _logger.LogError(ex, "PDF generation failed for {EntryId}, attempt {Attempt}",
                job.EntryId, job.AttemptNumber);
        }
        
        await _context.SaveChangesAsync(ct);
    }
}
```

## PDF Field Mapping
| Entry Field | PDF Field Name |
|-------------|----------------|
| DogCallName | dog_call_name |
| DogBreed | dog_breed |
| DogRegisteredName | dog_reg_name |
| DogDob | dog_dob |
| DogColor | dog_color |
| DogSex | dog_sex |
| ContactOwners | owner_name |
| ContactEmail | email |
| ContactPhone | phone |
| RegistrationOrTrackingNumber | reg_number |
| Selections | Grid cells |
