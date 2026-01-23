using DogTrials.Api.Entities;
using DogTrials.Api.Services;

namespace DogTrials.Api.Tests;

public sealed class BackgroundJobQueueTests
{
    [Fact]
    public async Task EnqueueEntrySubmitted_EnqueuesPdfAndEmailJobs()
    {
        var queue = new ChannelBackgroundJobQueue();
        var entryId = Guid.NewGuid();

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(2));
        await queue.EnqueueEntrySubmittedAsync(entryId, cts.Token);

        var jobs = new List<BackgroundJob>
        {
            await queue.DequeueAsync(cts.Token),
            await queue.DequeueAsync(cts.Token),
            await queue.DequeueAsync(cts.Token)
        };

        Assert.Contains(jobs, job => job is PdfGenerationJob pdf && pdf.EntryId == entryId);
        Assert.Contains(jobs, job => job is EmailNotificationJob email && email.EntryId == entryId && email.RecipientType == RecipientType.Handler);
        Assert.Contains(jobs, job => job is EmailNotificationJob email && email.EntryId == entryId && email.RecipientType == RecipientType.Secretary);
    }
}
