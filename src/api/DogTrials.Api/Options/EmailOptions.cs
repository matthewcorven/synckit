namespace DogTrials.Api.Options;

public sealed class EmailOptions
{
    public const string SectionName = "Email";

    public string? ConnectionString { get; set; }
    public string? SenderAddress { get; set; }

    public void ApplyEnvironmentOverrides()
    {
        var connectionString = Environment.GetEnvironmentVariable("EMAIL_CONNECTION_STRING");
        if (!string.IsNullOrWhiteSpace(connectionString))
        {
            ConnectionString = connectionString;
        }

        var senderAddress = Environment.GetEnvironmentVariable("EMAIL_SENDER_ADDRESS");
        if (!string.IsNullOrWhiteSpace(senderAddress))
        {
            SenderAddress = senderAddress;
        }
    }
}
