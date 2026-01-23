using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Sas;
using DogTrials.Api.Options;
using Microsoft.Extensions.Options;

namespace DogTrials.Api.Services;

public sealed class AzureBlobStorageService : IBlobStorageService
{
    private readonly BlobServiceClient _blobServiceClient;
    private readonly StorageOptions _options;
    private readonly ILogger<AzureBlobStorageService> _logger;

    public AzureBlobStorageService(
        BlobServiceClient blobServiceClient,
        IOptions<StorageOptions> options,
        ILogger<AzureBlobStorageService> logger)
    {
        _blobServiceClient = blobServiceClient;
        _options = options.Value;
        _logger = logger;
    }

    public static string GetPdfBlobName(Guid entryId) => $"entries/{entryId}.pdf";

    public async Task<string> UploadPdfAsync(Guid entryId, byte[] pdfBytes, CancellationToken ct)
    {
        var containerClient = _blobServiceClient.GetBlobContainerClient(_options.ContainerName);
        await containerClient.CreateIfNotExistsAsync(PublicAccessType.None, cancellationToken: ct);

        var blobName = GetPdfBlobName(entryId);
        var blobClient = containerClient.GetBlobClient(blobName);

        using var stream = new MemoryStream(pdfBytes);
        await blobClient.UploadAsync(stream, overwrite: true, cancellationToken: ct);
        var headers = new BlobHttpHeaders { ContentType = "application/pdf" };
        await blobClient.SetHttpHeadersAsync(headers, cancellationToken: ct);

        _logger.LogInformation("PDF uploaded to blob storage for entry {EntryId}", entryId);
        return blobClient.Uri.ToString();
    }

    public async Task<string> GenerateSasUrlAsync(Guid entryId, TimeSpan ttl, CancellationToken ct)
    {
        var containerClient = _blobServiceClient.GetBlobContainerClient(_options.ContainerName);
        var blobName = GetPdfBlobName(entryId);
        var blobClient = containerClient.GetBlobClient(blobName);

        if (!await blobClient.ExistsAsync(ct))
        {
            throw new FileNotFoundException($"PDF not found for entry {entryId}");
        }

        var now = DateTimeOffset.UtcNow;
        var sasBuilder = BuildReadSasBuilder(_options.ContainerName, blobName, now, ttl);

        if (blobClient.CanGenerateSasUri)
        {
            var sasUri = blobClient.GenerateSasUri(sasBuilder);
            return sasUri.ToString();
        }

        var accountName = _blobServiceClient.AccountName;
        if (string.IsNullOrWhiteSpace(accountName))
        {
            throw new InvalidOperationException("Storage account name was unavailable for SAS generation.");
        }

        var delegationKey = await _blobServiceClient.GetUserDelegationKeyAsync(
            startsOn: now.AddMinutes(-5),
            expiresOn: sasBuilder.ExpiresOn,
            cancellationToken: ct);

        var sasToken = sasBuilder.ToSasQueryParameters(delegationKey, accountName).ToString();
        var uriBuilder = new UriBuilder(blobClient.Uri)
        {
            Query = sasToken
        };

        return uriBuilder.Uri.ToString();
    }

    public static BlobSasBuilder BuildReadSasBuilder(string containerName, string blobName, DateTimeOffset now, TimeSpan ttl)
    {
        var builder = new BlobSasBuilder
        {
            BlobContainerName = containerName,
            BlobName = blobName,
            Resource = "b",
            StartsOn = now.AddMinutes(-5),
            ExpiresOn = now.Add(ttl)
        };

        builder.SetPermissions(BlobSasPermissions.Read);
        return builder;
    }
}
