using System.Net;
using System.Text.Json;
using DogTrials.Api.Data;
using DogTrials.Api.Entities;
using DogTrials.Api.Services;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace DogTrials.Api.Tests;

public sealed class SecretaryEndpointsTests
{
    private const string SigningKey = "test-signing-key-32-bytes-minimum-123456";
    private const string Issuer = "dog-trials.testauth";
    private const string Audience = "dog-trials.api";

    [Fact]
    public async Task ListEntries_ReturnsPaginatedEntries_WhenSecretary()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        var seed = await SeedEntriesAsync(connectionString);

        using var factory = CreateFactory(connectionString, new FakeBlobStorageService("https://example.test/pdf"));
        using var client = factory.CreateClient();

        var token = await GetTokenAsync(client, "Secretary");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/secretary/entries?page=1&pageSize=2");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        var items = root.GetProperty("items");
        Assert.Equal(2, items.GetArrayLength());
        Assert.Equal(3, root.GetProperty("total").GetInt32());

        var firstId = items[0].GetProperty("entryId").GetGuid();
        Assert.Equal(seed.LatestSubmittedEntryId, firstId);
    }

    [Fact]
    public async Task ListEntries_FiltersByTrialAndStatus()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        var seed = await SeedEntriesAsync(connectionString);

        using var factory = CreateFactory(connectionString, new FakeBlobStorageService("https://example.test/pdf"));
        using var client = factory.CreateClient();

        var token = await GetTokenAsync(client, "Secretary");
        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            $"/api/secretary/entries?trialId={seed.TrialId}&status=Submitted&page=1&pageSize=10");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(json);
        var items = document.RootElement.GetProperty("items");

        Assert.Equal(2, items.GetArrayLength());
        Assert.All(items.EnumerateArray(), item =>
        {
            Assert.Equal(seed.TrialId, item.GetProperty("trialId").GetGuid());
            Assert.Equal("Submitted", item.GetProperty("status").GetString());
        });
    }

    [Fact]
    public async Task ListEntries_ReturnsForbidden_WhenHandlerRole()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        await SeedEntriesAsync(connectionString);

        using var factory = CreateFactory(connectionString, new FakeBlobStorageService("https://example.test/pdf"));
        using var client = factory.CreateClient();

        var token = await GetTokenAsync(client, "Handler");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/secretary/entries?page=1&pageSize=5");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetEntry_ReturnsDetail_WhenSecretary()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        var entryId = await SeedEntryWithNotificationsAsync(connectionString);

        using var factory = CreateFactory(connectionString, new FakeBlobStorageService("https://example.test/pdf"));
        using var client = factory.CreateClient();

        var token = await GetTokenAsync(client, "Secretary");
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/secretary/entries/{entryId}");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        Assert.Equal(entryId, root.GetProperty("entryId").GetGuid());
        Assert.Equal("Submitted", root.GetProperty("status").GetString());
        Assert.Equal("Success", root.GetProperty("processing").GetProperty("pdfStatus").GetString());
        Assert.Equal(2, root.GetProperty("processing").GetProperty("emailNotifications").GetArrayLength());
    }

    [Fact]
    public async Task GetPdf_ReturnsSasUrl_WhenPdfReady()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        var entryId = await SeedPdfReadyEntryAsync(connectionString);
        var fakeSasUrl = "https://example.test/download?sas=1";

        using var factory = CreateFactory(connectionString, new FakeBlobStorageService(fakeSasUrl));
        using var client = factory.CreateClient();

        var token = await GetTokenAsync(client, "Secretary");
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/secretary/entries/{entryId}/pdf");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(json);
        Assert.Equal(fakeSasUrl, document.RootElement.GetProperty("downloadUrl").GetString());
    }

    [Fact]
    public async Task RetryPdf_ResetsStatusAndEnqueuesJob()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        var entryId = await SeedPdfFailedEntryAsync(connectionString);
        var queue = new FakeBackgroundJobQueue();

        using var factory = CreateFactory(connectionString, new FakeBlobStorageService("https://example.test/pdf"), queue);
        using var client = factory.CreateClient();

        var token = await GetTokenAsync(client, "Secretary");
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/api/secretary/entries/{entryId}/pdf/retry");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);

        await using var verify = CreateContext(connectionString);
        var entry = await verify.Entries.FindAsync(entryId);
        Assert.NotNull(entry);
        Assert.Equal(PdfStatus.Queued, entry!.PdfStatus);
        Assert.Equal(0, entry.PdfAttemptCount);
        Assert.Null(entry.PdfLastErrorCode);

        Assert.Contains(queue.EnqueuedJobs, job => job is PdfGenerationJob pdf && pdf.EntryId == entryId);
    }

    private static WebApplicationFactory<Program> CreateFactory(
        string connectionString,
        IBlobStorageService blobStorageService,
        IBackgroundJobQueue? backgroundJobQueue = null)
    {
        return new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureAppConfiguration((_, config) =>
                {
                    var settings = new Dictionary<string, string?>
                    {
                        ["ConnectionStrings:DogTrialsSql"] = connectionString,
                        ["TrialSeeding:Enabled"] = "false",
                        ["TestAuth:Enabled"] = "true",
                        ["TestAuth:Secret"] = "test-secret",
                        ["TestAuth:SigningKey"] = SigningKey,
                        ["TestAuth:Issuer"] = Issuer,
                        ["TestAuth:Audience"] = Audience,
                        ["TestAuth:TokenLifetimeMinutes"] = "15"
                    };

                    config.AddInMemoryCollection(settings);
                });

                builder.ConfigureServices(services =>
                {
                    services.RemoveAll<IBlobStorageService>();
                    services.AddSingleton(blobStorageService);

                    if (backgroundJobQueue is not null)
                    {
                        services.RemoveAll<IBackgroundJobQueue>();
                        services.AddSingleton(backgroundJobQueue);
                    }
                });
            });
    }

    private static async Task<SeedEntriesResult> SeedEntriesAsync(string connectionString)
    {
        await using var context = CreateContext(connectionString);
        await context.Database.MigrateAsync();

        var userId = Guid.NewGuid();
        context.Users.Add(new User
        {
            UserId = userId,
            ExternalSubject = Guid.NewGuid().ToString("N"),
            Email = "handler@example.com",
            Role = UserRole.Handler,
            CreatedAtUtc = DateTime.UtcNow
        });

        var trialId = Guid.NewGuid();
        var otherTrialId = Guid.NewGuid();

        context.Trials.AddRange(
            new Trial
            {
                TrialId = trialId,
                Name = "Secretary Trial",
                OrganizationCode = "ASCA",
                SportCode = "StockDog",
                FormCode = "TrialEntry",
                FormVersion = "2020-10-08",
                OrganizerSlug = "ORG-SEC",
                EventSlug = "EVT-SEC",
                HostClub = "Example Club",
                StartDate = new DateOnly(2026, 5, 2),
                EndDate = new DateOnly(2026, 5, 3),
                Location = "Bryan, TX",
                SecretaryEmail = "secretary@example.com",
                IsActive = true,
                CreatedAtUtc = DateTime.UtcNow
            },
            new Trial
            {
                TrialId = otherTrialId,
                Name = "Other Trial",
                OrganizationCode = "ASCA",
                SportCode = "StockDog",
                FormCode = "TrialEntry",
                FormVersion = "2020-10-08",
                OrganizerSlug = "ORG-OTHER",
                EventSlug = "EVT-OTHER",
                HostClub = "Other Club",
                StartDate = new DateOnly(2026, 6, 2),
                EndDate = new DateOnly(2026, 6, 3),
                Location = "Austin, TX",
                SecretaryEmail = "secretary@example.com",
                IsActive = true,
                CreatedAtUtc = DateTime.UtcNow
            });

        var now = DateTime.UtcNow;
        var latestSubmittedEntryId = Guid.NewGuid();
        var olderSubmittedEntryId = Guid.NewGuid();
        var draftEntryId = Guid.NewGuid();

        context.Entries.AddRange(
            new Entry
            {
                EntryId = latestSubmittedEntryId,
                TrialId = trialId,
                CreatedByUserId = userId,
                Status = EntryStatus.Submitted,
                SubmittedAtUtc = now.AddMinutes(-5),
                ContactEmail = "handler@example.com",
                DogCallName = "Ranger",
                DogRegisteredName = "Registered",
                PdfStatus = PdfStatus.Success,
                CreatedAtUtc = now.AddMinutes(-10)
            },
            new Entry
            {
                EntryId = olderSubmittedEntryId,
                TrialId = trialId,
                CreatedByUserId = userId,
                Status = EntryStatus.Submitted,
                SubmittedAtUtc = now.AddMinutes(-20),
                ContactEmail = "handler@example.com",
                DogCallName = "Comet",
                DogRegisteredName = "Comet Registered",
                PdfStatus = PdfStatus.Queued,
                CreatedAtUtc = now.AddMinutes(-30)
            },
            new Entry
            {
                EntryId = draftEntryId,
                TrialId = otherTrialId,
                CreatedByUserId = userId,
                Status = EntryStatus.Draft,
                ContactEmail = "handler@example.com",
                DogCallName = "Drafty",
                DogRegisteredName = "Drafty Registered",
                PdfStatus = PdfStatus.Queued,
                CreatedAtUtc = now.AddMinutes(-2)
            });

        await context.SaveChangesAsync();

        return new SeedEntriesResult(trialId, latestSubmittedEntryId, olderSubmittedEntryId, draftEntryId);
    }

    private static async Task<Guid> SeedEntryWithNotificationsAsync(string connectionString)
    {
        await using var context = CreateContext(connectionString);
        await context.Database.MigrateAsync();

        var userId = Guid.NewGuid();
        context.Users.Add(new User
        {
            UserId = userId,
            ExternalSubject = Guid.NewGuid().ToString("N"),
            Email = "handler@example.com",
            Role = UserRole.Handler,
            CreatedAtUtc = DateTime.UtcNow
        });

        var trialId = Guid.NewGuid();
        context.Trials.Add(new Trial
        {
            TrialId = trialId,
            Name = "Detail Trial",
            OrganizationCode = "ASCA",
            SportCode = "StockDog",
            FormCode = "TrialEntry",
            FormVersion = "2020-10-08",
            OrganizerSlug = "ORG-DETAIL",
            EventSlug = "EVT-DETAIL",
            HostClub = "Example Club",
            StartDate = new DateOnly(2026, 5, 2),
            EndDate = new DateOnly(2026, 5, 3),
            Location = "Bryan, TX",
            SecretaryEmail = "secretary@example.com",
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow
        });

        var entryId = Guid.NewGuid();
        context.Entries.Add(new Entry
        {
            EntryId = entryId,
            TrialId = trialId,
            CreatedByUserId = userId,
            Status = EntryStatus.Submitted,
            SubmittedAtUtc = DateTime.UtcNow,
            ContactEmail = "handler@example.com",
            DogCallName = "Ranger",
            PdfStatus = PdfStatus.Success,
            GeneratedPdfBlobUri = "https://example.test/blob",
            CreatedAtUtc = DateTime.UtcNow
        });

        context.Notifications.AddRange(
            new Notification
            {
                NotificationId = Guid.NewGuid(),
                EntryId = entryId,
                RecipientType = RecipientType.Handler,
                Status = NotificationStatus.Success,
                SentAtUtc = DateTime.UtcNow,
                CreatedAtUtc = DateTime.UtcNow
            },
            new Notification
            {
                NotificationId = Guid.NewGuid(),
                EntryId = entryId,
                RecipientType = RecipientType.Secretary,
                Status = NotificationStatus.Queued,
                CreatedAtUtc = DateTime.UtcNow
            });

        await context.SaveChangesAsync();
        return entryId;
    }

    private static async Task<Guid> SeedPdfReadyEntryAsync(string connectionString)
    {
        await using var context = CreateContext(connectionString);
        await context.Database.MigrateAsync();

        var userId = Guid.NewGuid();
        context.Users.Add(new User
        {
            UserId = userId,
            ExternalSubject = Guid.NewGuid().ToString("N"),
            Email = "handler@example.com",
            Role = UserRole.Handler,
            CreatedAtUtc = DateTime.UtcNow
        });

        var trialId = Guid.NewGuid();
        context.Trials.Add(new Trial
        {
            TrialId = trialId,
            Name = "PDF Trial",
            OrganizationCode = "ASCA",
            SportCode = "StockDog",
            FormCode = "TrialEntry",
            FormVersion = "2020-10-08",
            OrganizerSlug = "ORG-PDF",
            EventSlug = "EVT-PDF",
            HostClub = "Example Club",
            StartDate = new DateOnly(2026, 5, 2),
            EndDate = new DateOnly(2026, 5, 3),
            Location = "Bryan, TX",
            SecretaryEmail = "secretary@example.com",
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow
        });

        var entryId = Guid.NewGuid();
        context.Entries.Add(new Entry
        {
            EntryId = entryId,
            TrialId = trialId,
            CreatedByUserId = userId,
            Status = EntryStatus.Submitted,
            SubmittedAtUtc = DateTime.UtcNow,
            ContactEmail = "handler@example.com",
            DogCallName = "Ranger",
            PdfStatus = PdfStatus.Success,
            GeneratedPdfBlobUri = "https://example.test/blob",
            CreatedAtUtc = DateTime.UtcNow
        });

        await context.SaveChangesAsync();
        return entryId;
    }

    private static async Task<Guid> SeedPdfFailedEntryAsync(string connectionString)
    {
        await using var context = CreateContext(connectionString);
        await context.Database.MigrateAsync();

        var userId = Guid.NewGuid();
        context.Users.Add(new User
        {
            UserId = userId,
            ExternalSubject = Guid.NewGuid().ToString("N"),
            Email = "handler@example.com",
            Role = UserRole.Handler,
            CreatedAtUtc = DateTime.UtcNow
        });

        var trialId = Guid.NewGuid();
        context.Trials.Add(new Trial
        {
            TrialId = trialId,
            Name = "Retry Trial",
            OrganizationCode = "ASCA",
            SportCode = "StockDog",
            FormCode = "TrialEntry",
            FormVersion = "2020-10-08",
            OrganizerSlug = "ORG-RETRY",
            EventSlug = "EVT-RETRY",
            HostClub = "Example Club",
            StartDate = new DateOnly(2026, 5, 2),
            EndDate = new DateOnly(2026, 5, 3),
            Location = "Bryan, TX",
            SecretaryEmail = "secretary@example.com",
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow
        });

        var entryId = Guid.NewGuid();
        context.Entries.Add(new Entry
        {
            EntryId = entryId,
            TrialId = trialId,
            CreatedByUserId = userId,
            Status = EntryStatus.Submitted,
            SubmittedAtUtc = DateTime.UtcNow,
            ContactEmail = "handler@example.com",
            DogCallName = "Ranger",
            PdfStatus = PdfStatus.Failed,
            PdfAttemptCount = 3,
            PdfNextAttemptAtUtc = DateTime.UtcNow.AddMinutes(10),
            PdfLastErrorCode = "PDF_FAIL",
            CreatedAtUtc = DateTime.UtcNow
        });

        await context.SaveChangesAsync();
        return entryId;
    }

    private static DogTrialsDbContext CreateContext(string connectionString)
    {
        return new DogTrialsDbContext(new DbContextOptionsBuilder<DogTrialsDbContext>()
            .UseSqlServer(connectionString)
            .Options);
    }

    private static async Task<string> GetTokenAsync(HttpClient client, string role)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/testauth/token");
        request.Headers.Add("X-Test-Auth-Secret", "test-secret");
        request.Headers.Add("X-Test-Role", role);

        using var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(json);
        return document.RootElement.GetProperty("accessToken").GetString()!;
    }

    private sealed class FakeBlobStorageService(string sasUrl) : IBlobStorageService
    {
        public Task<string> UploadPdfAsync(Guid entryId, byte[] pdfBytes, CancellationToken ct)
        {
            return Task.FromResult($"https://example.test/{entryId}.pdf");
        }

        public Task<string> GenerateSasUrlAsync(Guid entryId, TimeSpan ttl, CancellationToken ct)
        {
            return Task.FromResult(sasUrl);
        }
    }

    private sealed class FakeBackgroundJobQueue : IBackgroundJobQueue
    {
        public List<BackgroundJob> EnqueuedJobs { get; } = new();

        public ValueTask EnqueueEntrySubmittedAsync(Guid entryId, CancellationToken cancellationToken = default)
        {
            EnqueuedJobs.Add(new PdfGenerationJob(Guid.NewGuid(), entryId));
            return ValueTask.CompletedTask;
        }

        public ValueTask EnqueuePdfGenerationAsync(Guid entryId, CancellationToken cancellationToken = default)
        {
            EnqueuedJobs.Add(new PdfGenerationJob(Guid.NewGuid(), entryId));
            return ValueTask.CompletedTask;
        }

        public ValueTask EnqueueEmailNotificationAsync(Guid entryId, RecipientType recipientType, CancellationToken cancellationToken = default)
        {
            EnqueuedJobs.Add(new EmailNotificationJob(Guid.NewGuid(), entryId, recipientType));
            return ValueTask.CompletedTask;
        }

        public ValueTask<BackgroundJob> DequeueAsync(CancellationToken cancellationToken)
        {
            throw new InvalidOperationException("Dequeue not supported in fake queue.");
        }
    }

    private sealed record SeedEntriesResult(
        Guid TrialId,
        Guid LatestSubmittedEntryId,
        Guid OlderSubmittedEntryId,
        Guid DraftEntryId);
}
