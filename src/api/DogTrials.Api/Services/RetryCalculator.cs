namespace DogTrials.Api.Services;

public static class RetryCalculator
{
    private static readonly TimeSpan[] BackoffSchedule =
    {
        TimeSpan.FromMinutes(1),
        TimeSpan.FromMinutes(5),
        TimeSpan.FromMinutes(15),
        TimeSpan.FromMinutes(30),
        TimeSpan.FromMinutes(30),
        TimeSpan.FromMinutes(30),
        TimeSpan.FromMinutes(30),
        TimeSpan.FromMinutes(30),
        TimeSpan.FromMinutes(30),
        TimeSpan.FromMinutes(30)
    };

    public static DateTime? GetNextAttemptTime(int attemptCount, DateTime utcNow)
    {
        if (attemptCount <= 0)
        {
            return utcNow;
        }

        var index = attemptCount - 1;
        if (index >= BackoffSchedule.Length)
        {
            return null;
        }

        return utcNow + BackoffSchedule[index];
    }
}
