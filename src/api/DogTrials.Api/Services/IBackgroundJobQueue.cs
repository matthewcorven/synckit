namespace DogTrials.Api.Services;

public interface IBackgroundJobQueue
{
    Task EnqueueEntrySubmittedAsync(Guid entryId, CancellationToken cancellationToken = default);
}
