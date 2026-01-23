namespace DogTrials.Api.Options;

public sealed class StorageOptions
{
    public const string SectionName = "Storage";

    public string? ConnectionString { get; set; }
    public string? BlobEndpoint { get; set; }
    public string ContainerName { get; set; } = "pdf";

    public void ApplyEnvironmentOverrides()
    {
        var connectionString = Environment.GetEnvironmentVariable("STORAGE_CONNECTION_STRING");
        if (!string.IsNullOrWhiteSpace(connectionString))
        {
            ConnectionString = connectionString;
        }

        var blobEndpoint = Environment.GetEnvironmentVariable("STORAGE_BLOB_ENDPOINT");
        if (!string.IsNullOrWhiteSpace(blobEndpoint))
        {
            BlobEndpoint = blobEndpoint;
        }

        var containerName = Environment.GetEnvironmentVariable("STORAGE_CONTAINER_NAME");
        if (!string.IsNullOrWhiteSpace(containerName))
        {
            ContainerName = containerName;
        }
    }
}
