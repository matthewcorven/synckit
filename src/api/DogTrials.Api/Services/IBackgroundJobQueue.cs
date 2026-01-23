using DogTrials.Api.Entities;

namespace DogTrials.Api.Services;

public interface IBackgroundJobQueue
{
    ValueTask EnqueueEntrySubmittedAsync(Guid entryId, CancellationToken cancellationToken = default);
    ValueTask EnqueuePdfGenerationAsync(Guid entryId, CancellationToken cancellationToken = default);
    ValueTask EnqueueEmailNotificationAsync(Guid entryId, RecipientType recipientType, CancellationToken cancellationToken = default);
    ValueTask<BackgroundJob> DequeueAsync(CancellationToken cancellationToken);
}
