using DogTrials.Api.Services;

namespace DogTrials.Api.Tests;

public sealed class RetryCalculatorTests
{
    [Fact]
    public void GetNextAttemptTime_UsesBackoffSchedule()
    {
        var now = new DateTime(2026, 1, 22, 12, 0, 0, DateTimeKind.Utc);

        var first = RetryCalculator.GetNextAttemptTime(1, now);
        var second = RetryCalculator.GetNextAttemptTime(2, now);
        var fourth = RetryCalculator.GetNextAttemptTime(4, now);

        Assert.Equal(now.AddMinutes(1), first);
        Assert.Equal(now.AddMinutes(5), second);
        Assert.Equal(now.AddMinutes(30), fourth);
    }

    [Fact]
    public void GetNextAttemptTime_ReturnsNull_WhenMaxAttemptsExceeded()
    {
        var now = new DateTime(2026, 1, 22, 12, 0, 0, DateTimeKind.Utc);

        var next = RetryCalculator.GetNextAttemptTime(11, now);

        Assert.Null(next);
    }
}
