namespace DogTrials.Api.Entities;

public sealed class Notification
{
    public Guid NotificationId { get; set; }
    public Guid EntryId { get; set; }
    public RecipientType RecipientType { get; set; }
    public NotificationStatus Status { get; set; } = NotificationStatus.Queued;
    public int AttemptCount { get; set; }
    public DateTime? NextAttemptAtUtc { get; set; }
    public DateTime? LastAttemptAtUtc { get; set; }
    public string? LastErrorCode { get; set; }
    public DateTime? SentAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }

    public Entry Entry { get; set; } = null!;
}

public enum RecipientType
{
    Handler,
    Secretary
}

public enum NotificationStatus
{
    Queued,
    InProgress,
    Success,
    Failed
}
