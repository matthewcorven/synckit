using System.Diagnostics;
using DogTrials.Api.Data;
using DogTrials.Api.Entities;
using DogTrials.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace DogTrials.Api.Tests;

public sealed class BackgroundJobTelemetryTests
{
    [Fact]
    public async Task Processor_EmitsPdfAndEmailSpans_WithRequiredTags()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        var activities = new List<Activity>();
        using var listener = new ActivityListener
        {
            ShouldListenTo = source => source.Name == "DogTrials.Api",
            Sample = (ref ActivityCreationOptions<ActivityContext> _) => ActivitySamplingResult.AllData,
            ActivityStopped = activity => activities.Add(activity)
        };

        ActivitySource.AddActivityListener(listener);

        var services = BuildServices(connectionString);
        await SeedWorkAsync(services);

        var processor = CreateProcessor(services);
        var ids = services.GetRequiredService<TestIds>();

        await processor.ProcessJobAsync(new PdfGenerationJob(Guid.NewGuid(), ids.EntryId), CancellationToken.None);
        await processor.ProcessJobAsync(new EmailNotificationJob(Guid.NewGuid(), ids.EntryId, RecipientType.Handler), CancellationToken.None);

        var pdfSpan = activities.LastOrDefault(activity => activity.DisplayName == "Pdf.Generate");
        Assert.NotNull(pdfSpan);
        Assert.Equal(ids.EntryId.ToString(), pdfSpan!.GetTagItem("entry.id"));
        Assert.Equal(ids.TrialId.ToString(), pdfSpan.GetTagItem("trial.id"));
        Assert.Equal(EntryStatus.Submitted.ToString(), pdfSpan.GetTagItem("entry.status"));
        Assert.Equal("direct", pdfSpan.GetTagItem("entry.mode"));
        Assert.Equal(PdfStatus.Success.ToString(), pdfSpan.GetTagItem("pdf.status"));

        var emailSpan = activities.LastOrDefault(activity => activity.DisplayName == "Email.Send");
        Assert.NotNull(emailSpan);
        Assert.Equal(ids.EntryId.ToString(), emailSpan!.GetTagItem("entry.id"));
        Assert.Equal(ids.TrialId.ToString(), emailSpan.GetTagItem("trial.id"));
        Assert.Equal(EntryStatus.Submitted.ToString(), emailSpan.GetTagItem("entry.status"));
        Assert.Equal("direct", emailSpan.GetTagItem("entry.mode"));
        Assert.Equal(RecipientType.Handler.ToString(), emailSpan.GetTagItem("email.recipientType"));
        Assert.Equal(NotificationStatus.Success.ToString(), emailSpan.GetTagItem("email.status"));
    }

    private static ServiceProvider BuildServices(string connectionString)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDbContext<DogTrialsDbContext>(options => options.UseSqlServer(connectionString));
        services.AddSingleton<IBackgroundJobQueue, ChannelBackgroundJobQueue>();
        services.AddScoped<IPdfJobHandler, SuccessPdfJobHandler>();
        services.AddScoped<IEmailJobHandler, SuccessEmailJobHandler>();
        services.AddOptions<BackgroundJobOptions>();
        services.AddSingleton<TestIds>();

        return services.BuildServiceProvider();
    }

    private static BackgroundJobProcessor CreateProcessor(ServiceProvider services)
    {
        var queue = services.GetRequiredService<IBackgroundJobQueue>();
        var scopeFactory = services.GetRequiredService<IServiceScopeFactory>();
        var logger = services.GetRequiredService<ILogger<BackgroundJobProcessor>>();
        var options = services.GetRequiredService<IOptions<BackgroundJobOptions>>();

        return new BackgroundJobProcessor(queue, scopeFactory, logger, options);
    }

    private static async Task SeedWorkAsync(ServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
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
            Name = "Telemetry Trial",
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
            PdfStatus = PdfStatus.Queued,
            PdfAttemptCount = 0,
            CreatedAtUtc = DateTime.UtcNow
        });

        dbContext.Notifications.Add(new Notification
        {
            NotificationId = Guid.NewGuid(),
            EntryId = entryId,
            RecipientType = RecipientType.Handler,
            Status = NotificationStatus.Queued,
            AttemptCount = 0,
            CreatedAtUtc = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync();

        var ids = scope.ServiceProvider.GetRequiredService<TestIds>();
        ids.EntryId = entryId;
        ids.TrialId = trialId;
    }

    private sealed class TestIds
    {
        public Guid EntryId { get; set; }
        public Guid TrialId { get; set; }
    }

    private sealed class SuccessPdfJobHandler : IPdfJobHandler
    {
        public Task<PdfJobResult> HandleAsync(Entry entry, CancellationToken cancellationToken)
        {
            return Task.FromResult(PdfJobResult.Ok("blob://pdf"));
        }
    }

    private sealed class SuccessEmailJobHandler : IEmailJobHandler
    {
        public Task<EmailJobResult> HandleAsync(Notification notification, CancellationToken cancellationToken)
        {
            return Task.FromResult(EmailJobResult.Ok(DateTime.UtcNow));
        }
    }
}
