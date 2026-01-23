using DogTrials.Api.Entities;

namespace DogTrials.Api.Services;

public static class BackgroundJobGuards
{
    public static bool ShouldProcessPdf(Entry entry, DateTime utcNow, int maxAttempts)
    {
        if (entry.Status != EntryStatus.Submitted)
        {
            return false;
        }

        if (entry.PdfStatus == PdfStatus.Success)
        {
            return false;
        }

        if (entry.PdfAttemptCount >= maxAttempts)
        {
            return false;
        }

        if (entry.PdfNextAttemptAtUtc is not null && entry.PdfNextAttemptAtUtc > utcNow)
        {
            return false;
        }

        return true;
    }

    public static bool ShouldProcessNotification(Notification notification, DateTime utcNow, int maxAttempts)
    {
        if (notification.Status == NotificationStatus.Success)
        {
            return false;
        }

        if (notification.AttemptCount >= maxAttempts)
        {
            return false;
        }

        if (notification.NextAttemptAtUtc is not null && notification.NextAttemptAtUtc > utcNow)
        {
            return false;
        }

        return true;
    }
}
