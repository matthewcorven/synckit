using System.Net;
using System.Text.Json;
using DogTrials.Api.Data;
using DogTrials.Api.Entities;
using DogTrials.Api.Services;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace DogTrials.Api.Tests;

public sealed class ProcessingStatusEndpointsTests
{
    private const string SigningKey = "test-signing-key-32-bytes-minimum-123456";
    private const string Issuer = "dog-trials.testauth";
    private const string Audience = "dog-trials.api";

    [Fact]
    public async Task GetProcessingStatus_ReturnsStatus_WhenSecretary()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        var entryId = await SeedEntryAsync(connectionString);

        var fakeSasUrl = "https://example.test/pdf?sas=1";
        using var factory = CreateFactory(connectionString, fakeSasUrl);
        using var client = factory.CreateClient();

        var token = await GetTokenAsync(client, "Secretary");
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/admin/entries/{entryId}/processing-status");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        Assert.Equal(entryId.ToString(), root.GetProperty("entryId").GetString());
        Assert.Equal("Success", root.GetProperty("pdfStatus").GetString());
        Assert.Equal(fakeSasUrl, root.GetProperty("generatedPdfDownloadUrl").GetString());

        var notifications = root.GetProperty("emailNotifications");
        Assert.Equal(JsonValueKind.Array, notifications.ValueKind);
        Assert.Equal(2, notifications.GetArrayLength());

        var lastError = root.GetProperty("lastError");
        Assert.Equal("PDF_FAIL", lastError.GetProperty("code").GetString());
        Assert.Equal("PDF processing error. Contact support.", lastError.GetProperty("message").GetString());
    }

    [Fact]
    public async Task GetProcessingStatus_ReturnsForbidden_WhenHandlerRole()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        var entryId = await SeedEntryAsync(connectionString);

        using var factory = CreateFactory(connectionString, "https://example.test/pdf?sas=1");
        using var client = factory.CreateClient();

        var token = await GetTokenAsync(client, "Handler");
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/admin/entries/{entryId}/processing-status");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetProcessingStatus_ReturnsNotFound_WhenMissingEntry()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        await EnsureDatabaseAsync(connectionString);

        using var factory = CreateFactory(connectionString, "https://example.test/pdf?sas=1");
        using var client = factory.CreateClient();

        var token = await GetTokenAsync(client, "Secretary");
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/admin/entries/{Guid.NewGuid()}/processing-status");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    private static WebApplicationFactory<Program> CreateFactory(string connectionString, string sasUrl)
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
                    services.AddSingleton<IBlobStorageService>(new FakeBlobStorageService(sasUrl));
                });
            });
    }

    private static async Task<Guid> SeedEntryAsync(string connectionString)
    {
        await using var context = CreateContext(connectionString);
        await context.Database.MigrateAsync();

        var trialId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        context.Users.Add(new User
        {
            UserId = userId,
            ExternalSubject = Guid.NewGuid().ToString(),
            Email = "handler@example.com",
            Role = UserRole.Handler,
            CreatedAtUtc = DateTime.UtcNow
        });

        context.Trials.Add(new Trial
        {
            TrialId = trialId,
            Name = "Status Trial",
            OrganizationCode = "ASCA",
            SportCode = "StockDog",
            FormCode = "TrialEntry",
            FormVersion = "2020-10-08",
            OrganizerSlug = "ORG-STATUS",
            EventSlug = "EVT-STATUS",
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
            PdfStatus = PdfStatus.Success,
            GeneratedPdfBlobUri = "https://example.test/blob",
            PdfLastErrorCode = "PDF_FAIL",
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
                Status = NotificationStatus.Failed,
                LastErrorCode = "EMAIL_FAILED",
                CreatedAtUtc = DateTime.UtcNow
            });

        await context.SaveChangesAsync();
        return entryId;
    }

    private static async Task EnsureDatabaseAsync(string connectionString)
    {
        await using var context = CreateContext(connectionString);
        await context.Database.MigrateAsync();
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
}