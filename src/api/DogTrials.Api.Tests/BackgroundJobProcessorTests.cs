using DogTrials.Api.Data;
using DogTrials.Api.Entities;
using DogTrials.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace DogTrials.Api.Tests;

public sealed class BackgroundJobProcessorTests
{
    [Fact]
    public async Task ProcessPdfJob_SetsSuccessAndClearsRetryFields()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        var services = BuildServices(connectionString, new SuccessPdfJobHandler());
        await SeedEntryAsync(services, PdfStatus.Queued);

        var processor = CreateProcessor(services);
        var entryId = services.GetRequiredService<TestIds>().EntryId;

        await processor.ProcessJobAsync(new PdfGenerationJob(Guid.NewGuid(), entryId), CancellationToken.None);

        await using var scope = services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<DogTrialsDbContext>();
        var entry = await dbContext.Entries.FirstAsync(e => e.EntryId == entryId);

        Assert.Equal(PdfStatus.Success, entry.PdfStatus);
        Assert.Equal(1, entry.PdfAttemptCount);
        Assert.Null(entry.PdfNextAttemptAtUtc);
        Assert.Null(entry.PdfLastErrorCode);
        Assert.Equal("blob://pdf", entry.GeneratedPdfBlobUri);
    }

    [Fact]
    public async Task ProcessPdfJob_SetsFailureAndSchedulesRetry()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        var services = BuildServices(connectionString, new FailurePdfJobHandler());
        await SeedEntryAsync(services, PdfStatus.Queued);

        var processor = CreateProcessor(services);
        var entryId = services.GetRequiredService<TestIds>().EntryId;

        await processor.ProcessJobAsync(new PdfGenerationJob(Guid.NewGuid(), entryId), CancellationToken.None);

        await using var scope = services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<DogTrialsDbContext>();
        var entry = await dbContext.Entries.FirstAsync(e => e.EntryId == entryId);

        Assert.Equal(PdfStatus.Failed, entry.PdfStatus);
        Assert.Equal(1, entry.PdfAttemptCount);
        Assert.NotNull(entry.PdfNextAttemptAtUtc);
        Assert.Equal("PDF_FAIL", entry.PdfLastErrorCode);
    }

    private static ServiceProvider BuildServices(string connectionString, IPdfJobHandler pdfJobHandler)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDbContext<DogTrialsDbContext>(options => options.UseSqlServer(connectionString));
        services.AddSingleton<IBackgroundJobQueue, ChannelBackgroundJobQueue>();
        services.AddScoped<IEmailJobHandler, StubEmailJobHandler>();
        services.AddScoped(_ => pdfJobHandler);
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

    private static async Task SeedEntryAsync(ServiceProvider services, PdfStatus pdfStatus)
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
            Name = "Background Trial",
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
            PdfStatus = pdfStatus,
            PdfAttemptCount = 0,
            CreatedAtUtc = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync();

        var ids = scope.ServiceProvider.GetRequiredService<TestIds>();
        ids.EntryId = entryId;
    }

    private sealed class TestIds
    {
        public Guid EntryId { get; set; }
    }

    private sealed class SuccessPdfJobHandler : IPdfJobHandler
    {
        public Task<PdfJobResult> HandleAsync(Entry entry, CancellationToken cancellationToken)
        {
            return Task.FromResult(PdfJobResult.Ok("blob://pdf"));
        }
    }

    private sealed class FailurePdfJobHandler : IPdfJobHandler
    {
        public Task<PdfJobResult> HandleAsync(Entry entry, CancellationToken cancellationToken)
        {
            return Task.FromResult(PdfJobResult.Fail("PDF_FAIL"));
        }
    }

    private sealed class StubEmailJobHandler : IEmailJobHandler
    {
        public Task<EmailJobResult> HandleAsync(Notification notification, CancellationToken cancellationToken)
        {
            return Task.FromResult(EmailJobResult.Ok());
        }
    }
}
