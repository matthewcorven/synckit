namespace DogTrials.Api.Services;

public sealed record EmailJobResult(bool Success, string? ErrorCode = null, DateTime? SentAtUtc = null)
{
    public static EmailJobResult Ok(DateTime? sentAtUtc = null) => new(true, null, sentAtUtc);
    public static EmailJobResult Fail(string errorCode) => new(false, errorCode, null);
}
