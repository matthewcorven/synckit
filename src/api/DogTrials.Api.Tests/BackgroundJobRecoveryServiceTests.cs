using DogTrials.Api.Data;
using DogTrials.Api.Entities;
using DogTrials.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace DogTrials.Api.Tests;

public sealed class BackgroundJobRecoveryServiceTests
{
    [Fact]
    public async Task StartAsync_RequeuesIncompleteWork()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDbContext<DogTrialsDbContext>(options => options.UseSqlServer(connectionString));
        services.AddSingleton<IBackgroundJobQueue, ChannelBackgroundJobQueue>();
        services.AddOptions<BackgroundJobOptions>();

        var provider = services.BuildServiceProvider();
        await SeedWorkAsync(provider);

        var recovery = new BackgroundJobRecoveryService(
            provider.GetRequiredService<IServiceScopeFactory>(),
            provider.GetRequiredService<ILogger<BackgroundJobRecoveryService>>(),
            provider.GetRequiredService<IOptions<BackgroundJobOptions>>());

        await recovery.StartAsync(CancellationToken.None);

        var queue = provider.GetRequiredService<IBackgroundJobQueue>();
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(2));

        var first = await queue.DequeueAsync(cts.Token);
        var second = await queue.DequeueAsync(cts.Token);

        Assert.True(first is PdfGenerationJob || second is PdfGenerationJob);
        Assert.True(first is EmailNotificationJob || second is EmailNotificationJob);
    }

    private static async Task SeedWorkAsync(ServiceProvider provider)
    {
        await using var scope = provider.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<DogTrialsDbContext>();
        await dbContext.Database.MigrateAsync();

        var trialId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var entryId = Guid.NewGuid();

        dbContext.Users.Add(new User
        {
            UserId = userId,
            ExternalSubject = "test-subject",
            Email = "handler@example.com",
            Role = UserRole.Handler,
            CreatedAtUtc = DateTime.UtcNow
        });

        dbContext.Trials.Add(new Trial
        {
            TrialId = trialId,
            Name = "Recovery Trial",
            OrganizationCode = "ASCA",
            SportCode = "StockDog",
            FormCode = "TrialEntry",
            FormVersion = "2020-10-08",
            OrganizerSlug = "EXCLUB",
            EventSlug = "SPRING-2026-05-02",
            TrackingSlug = "EXCLUB-SPRING-2026-05-02",
            HostClub = "Example Club",
            StartDate = new DateOnly(2026, 5, 2),
            EndDate = new DateOnly(2026, 5, 3),
            SecretaryEmail = "secretary@example.com",
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow
        });

        dbContext.Entries.Add(new Entry
        {
            EntryId = entryId,
            TrialId = trialId,
            CreatedByUserId = userId,
            Status = EntryStatus.Submitted,
            PdfStatus = PdfStatus.Failed,
            PdfAttemptCount = 1,
            PdfNextAttemptAtUtc = DateTime.UtcNow.AddMinutes(-1),
            CreatedAtUtc = DateTime.UtcNow
        });

        dbContext.Notifications.Add(new Notification
        {
            NotificationId = Guid.NewGuid(),
            EntryId = entryId,
            RecipientType = RecipientType.Handler,
            Status = NotificationStatus.Failed,
            AttemptCount = 1,
            NextAttemptAtUtc = DateTime.UtcNow.AddMinutes(-1),
            CreatedAtUtc = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync();
    }
}
