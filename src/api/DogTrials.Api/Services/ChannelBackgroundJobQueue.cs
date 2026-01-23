using System.Threading.Channels;
using DogTrials.Api.Entities;

namespace DogTrials.Api.Services;

public sealed class ChannelBackgroundJobQueue : IBackgroundJobQueue
{
    private readonly Channel<BackgroundJob> _channel;

    public ChannelBackgroundJobQueue()
    {
        _channel = Channel.CreateUnbounded<BackgroundJob>(new UnboundedChannelOptions
        {
            SingleReader = false,
            SingleWriter = false
        });
    }

    public ValueTask EnqueueEntrySubmittedAsync(Guid entryId, CancellationToken cancellationToken = default)
    {
        return EnqueueEntrySubmittedInternalAsync(entryId, cancellationToken);
    }

    public ValueTask EnqueuePdfGenerationAsync(Guid entryId, CancellationToken cancellationToken = default)
    {
        return _channel.Writer.WriteAsync(new PdfGenerationJob(Guid.NewGuid(), entryId), cancellationToken);
    }

    public ValueTask EnqueueEmailNotificationAsync(Guid entryId, RecipientType recipientType, CancellationToken cancellationToken = default)
    {
        return _channel.Writer.WriteAsync(new EmailNotificationJob(Guid.NewGuid(), entryId, recipientType), cancellationToken);
    }

    public ValueTask<BackgroundJob> DequeueAsync(CancellationToken cancellationToken)
    {
        return _channel.Reader.ReadAsync(cancellationToken);
    }

    private async ValueTask EnqueueEntrySubmittedInternalAsync(Guid entryId, CancellationToken cancellationToken)
    {
        await EnqueuePdfGenerationAsync(entryId, cancellationToken);
        await EnqueueEmailNotificationAsync(entryId, RecipientType.Handler, cancellationToken);
        await EnqueueEmailNotificationAsync(entryId, RecipientType.Secretary, cancellationToken);
    }
}
