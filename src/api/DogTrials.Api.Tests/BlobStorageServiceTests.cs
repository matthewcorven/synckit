using System.Net;
using System.Text;
using Azure.Storage.Blobs;
using DogTrials.Api.Options;
using DogTrials.Api.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace DogTrials.Api.Tests;

public sealed class BlobStorageServiceTests
{
    [Fact]
    public void GetPdfBlobName_FormatsExpectedPath()
    {
        var entryId = Guid.Parse("11111111-2222-3333-4444-555555555555");

        var result = AzureBlobStorageService.GetPdfBlobName(entryId);

        Assert.Equal("entries/11111111-2222-3333-4444-555555555555.pdf", result);
    }

    [Fact]
    public void BuildReadSasBuilder_UsesTtlForExpiry()
    {
        var now = new DateTimeOffset(2026, 1, 22, 12, 0, 0, TimeSpan.Zero);
        var ttl = TimeSpan.FromMinutes(15);

        var builder = AzureBlobStorageService.BuildReadSasBuilder("pdf", "entries/entry.pdf", now, ttl);

        Assert.Equal(now.Add(ttl), builder.ExpiresOn);
        Assert.Equal("pdf", builder.BlobContainerName);
        Assert.Equal("entries/entry.pdf", builder.BlobName);
    }

    [Fact]
    public async Task UploadAndDownload_WithSas_Works_WhenConnectionStringProvided()
    {
        var connectionString = Environment.GetEnvironmentVariable("AZURE_STORAGE_CONNECTION_STRING");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return;
        }

        var options = Microsoft.Extensions.Options.Options.Create(new StorageOptions
        {
            ConnectionString = connectionString,
            ContainerName = "pdf"
        });

        var clientOptions = new BlobClientOptions(BlobClientOptions.ServiceVersion.V2023_11_03);
        var client = new BlobServiceClient(connectionString, clientOptions);
        var service = new AzureBlobStorageService(client, options, NullLogger<AzureBlobStorageService>.Instance);

        var entryId = Guid.NewGuid();
        var payload = Encoding.UTF8.GetBytes("%PDF-1.4\n%BlobStorageTest\n");

        var blobUri = await service.UploadPdfAsync(entryId, payload, CancellationToken.None);
        Assert.Contains(entryId.ToString(), blobUri, StringComparison.OrdinalIgnoreCase);

        var sasUrl = await service.GenerateSasUrlAsync(entryId, TimeSpan.FromMinutes(5), CancellationToken.None);

        using var http = new HttpClient();
        var response = await http.GetAsync(sasUrl);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var downloaded = await response.Content.ReadAsByteArrayAsync();
        Assert.Equal(payload, downloaded);
    }
}
