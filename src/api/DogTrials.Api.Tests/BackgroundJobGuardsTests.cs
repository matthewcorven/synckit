using DogTrials.Api.Entities;
using DogTrials.Api.Services;

namespace DogTrials.Api.Tests;

public sealed class BackgroundJobGuardsTests
{
    [Fact]
    public void ShouldProcessPdf_ReturnsFalse_WhenSuccess()
    {
        var entry = new Entry
        {
            EntryId = Guid.NewGuid(),
            TrialId = Guid.NewGuid(),
            CreatedByUserId = Guid.NewGuid(),
            Status = EntryStatus.Submitted,
            PdfStatus = PdfStatus.Success,
            PdfAttemptCount = 1,
            CreatedAtUtc = DateTime.UtcNow
        };

        var result = BackgroundJobGuards.ShouldProcessPdf(entry, DateTime.UtcNow, maxAttempts: 10);

        Assert.False(result);
    }

    [Fact]
    public void ShouldProcessNotification_ReturnsFalse_WhenNotDue()
    {
        var notification = new Notification
        {
            NotificationId = Guid.NewGuid(),
            EntryId = Guid.NewGuid(),
            RecipientType = RecipientType.Handler,
            Status = NotificationStatus.Failed,
            AttemptCount = 1,
            NextAttemptAtUtc = DateTime.UtcNow.AddMinutes(5),
            CreatedAtUtc = DateTime.UtcNow
        };

        var result = BackgroundJobGuards.ShouldProcessNotification(notification, DateTime.UtcNow, maxAttempts: 10);

        Assert.False(result);
    }
}
