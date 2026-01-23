namespace DogTrials.Api.Services;

public sealed class BackgroundJobOptions
{
    public int MaxAttempts { get; set; } = 10;
}
