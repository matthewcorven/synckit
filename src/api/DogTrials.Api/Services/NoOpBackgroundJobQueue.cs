namespace DogTrials.Api.Services;

public sealed class NoOpBackgroundJobQueue : IBackgroundJobQueue
{
    public Task EnqueueEntrySubmittedAsync(Guid entryId, CancellationToken cancellationToken = default)
    {
        return Task.CompletedTask;
    }
}
