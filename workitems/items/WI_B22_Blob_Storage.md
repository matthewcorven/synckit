# WI-B22: Blob Storage

**Owner:** Agent B (Platform)  
**Status:** Proposed  
**Milestone:** M4  
**Dependencies:** B21  
**Artifacts folder (recommended):** `../artifacts/WI-B22/`

## Goal
Implement Azure Blob Storage for PDF storage with SAS URL generation.

## Scope
### In
- Azure Blob Storage client setup
- Container: `pdf`
- Blob naming: `entries/{entryId}.pdf`
- Upload PDF service
- SAS URL generation (time-limited)
- PdfStatus tracking integration

### Out
- PDF generation (see B21)
- Email attachment (see B23)

## Implementation notes
- Container is private (no anonymous access)
- Blob name is deterministic for idempotency
- SAS URLs:
  - UI download: 15 minutes TTL
  - Email links: 24 hours TTL
- Overwrite existing blob on regeneration
- Use managed identity in production (connection string for dev)

## Acceptance criteria
- [ ] PDF uploaded to correct container/path
- [ ] Blob overwritten on regeneration
- [ ] SAS URL generated with correct TTL
- [ ] SAS URL allows download
- [ ] Works with managed identity and connection string

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- Blob name generation correct
- SAS URL has correct expiry

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B22/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Upload PDF to blob
- Generate SAS URL
- Download via SAS works

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B22/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- Secretary downloads PDF via SAS URL

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B22/playwright/download-trace.zip`

### DB verification
**Artifact requirements**
- GeneratedPdfBlobUri stored correctly

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B22/db/blob-uri.txt`

### Telemetry verification
- Verify blob operation traces

**Artifact requirements**
- N/A

**Artifacts (add as relative links during work)**
- N/A

## Risks / Questions
- Storage account firewall configuration
- Cost optimization for storage tier

## Implementation
```csharp
public interface IBlobStorageService
{
    Task<string> UploadPdfAsync(Guid entryId, byte[] pdfBytes, CancellationToken ct);
    Task<string> GenerateSasUrlAsync(Guid entryId, TimeSpan ttl, CancellationToken ct);
}

public class AzureBlobStorageService : IBlobStorageService
{
    private readonly BlobServiceClient _blobServiceClient;
    private readonly ILogger<AzureBlobStorageService> _logger;
    private const string ContainerName = "pdf";
    
    public async Task<string> UploadPdfAsync(Guid entryId, byte[] pdfBytes, CancellationToken ct)
    {
        var containerClient = _blobServiceClient.GetBlobContainerClient(ContainerName);
        await containerClient.CreateIfNotExistsAsync(cancellationToken: ct);
        
        var blobName = $"entries/{entryId}.pdf";
        var blobClient = containerClient.GetBlobClient(blobName);
        
        using var stream = new MemoryStream(pdfBytes);
        await blobClient.UploadAsync(stream, overwrite: true, ct);
        
        _logger.LogInformation("PDF uploaded: {BlobUri}", blobClient.Uri);
        
        return blobClient.Uri.ToString();
    }
    
    public async Task<string> GenerateSasUrlAsync(Guid entryId, TimeSpan ttl, CancellationToken ct)
    {
        var containerClient = _blobServiceClient.GetBlobContainerClient(ContainerName);
        var blobName = $"entries/{entryId}.pdf";
        var blobClient = containerClient.GetBlobClient(blobName);
        
        // Check if blob exists
        if (!await blobClient.ExistsAsync(ct))
        {
            throw new FileNotFoundException($"PDF not found for entry {entryId}");
        }
        
        // Generate SAS token
        var sasBuilder = new BlobSasBuilder
        {
            BlobContainerName = ContainerName,
            BlobName = blobName,
            Resource = "b", // blob
            StartsOn = DateTimeOffset.UtcNow.AddMinutes(-5), // Clock skew buffer
            ExpiresOn = DateTimeOffset.UtcNow.Add(ttl)
        };
        
        sasBuilder.SetPermissions(BlobSasPermissions.Read);
        
        // Generate SAS URI
        var sasUri = blobClient.GenerateSasUri(sasBuilder);
        
        return sasUri.ToString();
    }
}
```

## Configuration
```csharp
// Program.cs
builder.Services.AddAzureClients(clientBuilder =>
{
    // Development: connection string
    if (builder.Environment.IsDevelopment())
    {
        clientBuilder.AddBlobServiceClient(
            builder.Configuration["Storage:ConnectionString"]);
    }
    else
    {
        // Production: managed identity
        clientBuilder.AddBlobServiceClient(
            new Uri(builder.Configuration["Storage:BlobEndpoint"]!))
            .WithCredential(new DefaultAzureCredential());
    }
});
```

## appsettings.json
```json
{
  "Storage": {
    "ConnectionString": "UseDevelopmentStorage=true",
    "BlobEndpoint": "https://dgmvpstorage.blob.core.windows.net"
  }
}
```

## SAS URL TTL Constants
```csharp
public static class SasTtl
{
    public static readonly TimeSpan UiDownload = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan EmailLink = TimeSpan.FromHours(24);
}
```
