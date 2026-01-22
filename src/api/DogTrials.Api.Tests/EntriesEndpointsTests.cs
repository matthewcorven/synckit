using System.Net;
using System.Text.Json;
using DogTrials.Api.Data;
using DogTrials.Api.Entities;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace DogTrials.Api.Tests;

public sealed class EntriesEndpointsTests
{
    private const string SigningKey = "test-signing-key-32-bytes-minimum-123456";
    private const string Issuer = "dog-trials.testauth";
    private const string Audience = "dog-trials.api";

    [Fact]
    public async Task CreateDraft_CreatesEntry_WhenAuthenticated()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        await EnsureDatabaseAsync(connectionString);

        // seed trial
        Guid trialId;
        await using (var context = CreateContext(connectionString))
        {
            var trial = new Trial
            {
                TrialId = Guid.NewGuid(),
                Name = "Sample Trial",
                OrganizationCode = "ASCA",
                SportCode = "StockDog",
                FormCode = "TrialEntry",
                FormVersion = "2020-10-08",
                OrganizerSlug = "EXCLUB",
                EventSlug = "SPRING-2026-05-02",
                HostClub = "Example Club",
                StartDate = new DateOnly(2026, 5, 2),
                EndDate = new DateOnly(2026, 5, 3),
                Location = "Bryan, TX",
                SecretaryEmail = "secretary@example.com",
                IsActive = true
            };

            context.Trials.Add(trial);
            await context.SaveChangesAsync();
            trialId = trial.TrialId;
        }

        using var factory = CreateFactory(connectionString);
        using var client = factory.CreateClient();

        var token = await GetTokenAsync(client, "Handler");

        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/entries");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        request.Content = new StringContent(JsonSerializer.Serialize(new { trialId }), System.Text.Encoding.UTF8, "application/json");

        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var entryId = root.GetProperty("entryId").GetGuid();
        var status = root.GetProperty("status").GetString();

        Assert.Equal("Draft", status);

        // verify DB
        await using var verify = CreateContext(connectionString);
        var entry = await verify.Entries.FindAsync(entryId);
        Assert.NotNull(entry);
        Assert.Equal(entry!.TrialId, trialId);
    }

    [Fact]
    public async Task CreateDraft_ReturnsBadRequest_WhenTrialMissing()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        await EnsureDatabaseAsync(connectionString);

        using var factory = CreateFactory(connectionString);
        using var client = factory.CreateClient();

        var token = await GetTokenAsync(client, "Handler");

        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/entries");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        request.Content = new StringContent(JsonSerializer.Serialize(new { trialId = Guid.NewGuid() }), System.Text.Encoding.UTF8, "application/json");

        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task CreateDraft_ReturnsUnauthorized_WhenUnauthenticated()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        await EnsureDatabaseAsync(connectionString);

        using var factory = CreateFactory(connectionString);
        using var client = factory.CreateClient();

        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/entries");
        request.Content = new StringContent(JsonSerializer.Serialize(new { trialId = Guid.NewGuid() }), System.Text.Encoding.UTF8, "application/json");

        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CreateDraft_ReturnsExistingDraft_WhenPresent()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        await EnsureDatabaseAsync(connectionString);

        // seed trial + existing draft
        Guid trialId;
        await using (var context = CreateContext(connectionString))
        {
            var trial = new Trial
            {
                TrialId = Guid.NewGuid(),
                Name = "Sample Trial",
                OrganizationCode = "ASCA",
                SportCode = "StockDog",
                FormCode = "TrialEntry",
                FormVersion = "2020-10-08",
                OrganizerSlug = "EXCLUB",
                EventSlug = "SPRING-2026-05-02",
                HostClub = "Example Club",
                StartDate = new DateOnly(2026, 5, 2),
                EndDate = new DateOnly(2026, 5, 3),
                Location = "Bryan, TX",
                SecretaryEmail = "secretary@example.com",
                IsActive = true
            };

            context.Trials.Add(trial);
            await context.SaveChangesAsync();
            trialId = trial.TrialId;
        }

        using var factory = CreateFactory(connectionString);
        using var client = factory.CreateClient();

        var token = await GetTokenAsync(client, "Handler");

        // create first draft
        using (var req = new HttpRequestMessage(HttpMethod.Post, "/api/entries"))
        {
            req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            req.Content = new StringContent(JsonSerializer.Serialize(new { trialId }), System.Text.Encoding.UTF8, "application/json");
            using var resp = await client.SendAsync(req);
            resp.EnsureSuccessStatusCode();
        }

        // create second time - should return existing draft 200 OK
        using (var req2 = new HttpRequestMessage(HttpMethod.Post, "/api/entries"))
        {
            req2.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            req2.Content = new StringContent(JsonSerializer.Serialize(new { trialId }), System.Text.Encoding.UTF8, "application/json");
            using var resp2 = await client.SendAsync(req2);
            Assert.Equal(HttpStatusCode.OK, resp2.StatusCode);
            var json = await resp2.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var id = doc.RootElement.GetProperty("entryId").GetGuid();
            Assert.NotEqual(Guid.Empty, id);
        }
    }

    [Fact]
    public async Task CreateDraft_ReturnsConflict_WhenSubmittedExists()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        await EnsureDatabaseAsync(connectionString);

        Guid trialId;
        Guid userId;

        // seed trial + submitted entry for same user (via direct DB insert after provisioning)
        await using (var context = CreateContext(connectionString))
        {
            var trial = new Trial
            {
                TrialId = Guid.NewGuid(),
                Name = "Sample Trial",
                OrganizationCode = "ASCA",
                SportCode = "StockDog",
                FormCode = "TrialEntry",
                FormVersion = "2020-10-08",
                OrganizerSlug = "EXCLUB",
                EventSlug = "SPRING-2026-05-02",
                HostClub = "Example Club",
                StartDate = new DateOnly(2026, 5, 2),
                EndDate = new DateOnly(2026, 5, 3),
                Location = "Bryan, TX",
                SecretaryEmail = "secretary@example.com",
                IsActive = true
            };

            context.Trials.Add(trial);
            await context.SaveChangesAsync();
            trialId = trial.TrialId;
        }

        using var factory = CreateFactory(connectionString);
        using var client = factory.CreateClient();

        var token = await GetTokenAsync(client, "Handler");

        // The TestAuth token provisions a user; retrieve it from DB
        await using (var context = CreateContext(connectionString))
        {
            var user = context.Users.First();
            userId = user.UserId;

            context.Entries.Add(new Entry
            {
                EntryId = Guid.NewGuid(),
                TrialId = trialId,
                CreatedByUserId = userId,
                Status = EntryStatus.Submitted,
                SequenceNumber = 1
            });

            await context.SaveChangesAsync();
        }

        using var req = new HttpRequestMessage(HttpMethod.Post, "/api/entries");
        req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        req.Content = new StringContent(JsonSerializer.Serialize(new { trialId }), System.Text.Encoding.UTF8, "application/json");

        using var resp = await client.SendAsync(req);
        Assert.Equal(HttpStatusCode.Conflict, resp.StatusCode);
        Assert.Equal("application/problem+json", resp.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task GetEntry_ReturnsEntryDetail_WhenOwner()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        await EnsureDatabaseAsync(connectionString);

        Guid trialId;
        await using (var context = CreateContext(connectionString))
        {
            var trial = new Trial
            {
                TrialId = Guid.NewGuid(),
                Name = "Sample Trial",
                OrganizationCode = "ASCA",
                SportCode = "StockDog",
                FormCode = "TrialEntry",
                FormVersion = "2020-10-08",
                OrganizerSlug = "EXCLUB",
                EventSlug = "SPRING-2026-05-02",
                HostClub = "Example Club",
                StartDate = new DateOnly(2026, 5, 2),
                EndDate = new DateOnly(2026, 5, 3),
                Location = "Bryan, TX",
                SecretaryEmail = "secretary@example.com",
                IsActive = true
            };

            context.Trials.Add(trial);
            await context.SaveChangesAsync();
            trialId = trial.TrialId;
        }

        using var factory = CreateFactory(connectionString);
        using var client = factory.CreateClient();

        var token = await GetTokenAsync(client, "Handler");

        Guid entryId;
        await using (var context = CreateContext(connectionString))
        {
            var user = await context.Users.SingleAsync();
            entryId = Guid.NewGuid();

            var selectionsJson = JsonSerializer.Serialize(new
            {
                upper = new[] { new { row = "Sheep", col = "STD", value = "X" } },
                lower = Array.Empty<object>()
            });

            var entry = new Entry
            {
                EntryId = entryId,
                TrialId = trialId,
                CreatedByUserId = user.UserId,
                Status = EntryStatus.Draft,
                DogBreed = "Australian Shepherd",
                DogCallName = "Ranger",
                DogDob = new DateOnly(2021, 4, 10),
                ContactEmail = "handler@example.com",
                ContactOwners = "Owner One",
                ContactStreet = "123 Main St",
                ContactCity = "Bryan",
                ContactState = "TX",
                ContactZip = "77801",
                TotalEntryFees = 25m,
                FeesCurrency = "USD",
                EmergencyName = "Emergency Contact",
                EmergencyPhone = "555-111-2222",
                SelectionsJson = selectionsJson,
                PdfStatus = PdfStatus.Queued,
                CreatedAtUtc = DateTime.UtcNow
            };

            context.Entries.Add(entry);
            context.Notifications.Add(new Notification
            {
                NotificationId = Guid.NewGuid(),
                EntryId = entryId,
                RecipientType = RecipientType.Handler,
                Status = NotificationStatus.Queued,
                CreatedAtUtc = DateTime.UtcNow
            });

            await context.SaveChangesAsync();
        }

        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/entries/{entryId}");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        Assert.Equal(entryId, root.GetProperty("entryId").GetGuid());
        Assert.Equal(trialId, root.GetProperty("trial").GetProperty("trialId").GetGuid());
        Assert.Equal("Australian Shepherd", root.GetProperty("dog").GetProperty("breed").GetString());
        Assert.Equal("handler@example.com", root.GetProperty("contact").GetProperty("email").GetString());
        Assert.Equal("Queued", root.GetProperty("processing").GetProperty("pdfStatus").GetString());
        Assert.Equal(1, root.GetProperty("processing").GetProperty("emailNotifications").GetArrayLength());
        Assert.Equal(1, root.GetProperty("selections").GetProperty("upper").GetArrayLength());
    }

    [Fact]
    public async Task GetEntry_ReturnsForbidden_WhenNotOwner()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        await EnsureDatabaseAsync(connectionString);

        Guid trialId;
        await using (var context = CreateContext(connectionString))
        {
            var trial = new Trial
            {
                TrialId = Guid.NewGuid(),
                Name = "Sample Trial",
                OrganizationCode = "ASCA",
                SportCode = "StockDog",
                FormCode = "TrialEntry",
                FormVersion = "2020-10-08",
                OrganizerSlug = "EXCLUB",
                EventSlug = "SPRING-2026-05-02",
                HostClub = "Example Club",
                StartDate = new DateOnly(2026, 5, 2),
                EndDate = new DateOnly(2026, 5, 3),
                Location = "Bryan, TX",
                SecretaryEmail = "secretary@example.com",
                IsActive = true
            };

            context.Trials.Add(trial);
            await context.SaveChangesAsync();
            trialId = trial.TrialId;
        }

        using var factory = CreateFactory(connectionString);
        using var client = factory.CreateClient();

        var token = await GetTokenAsync(client, "Handler");

        Guid entryId;
        await using (var context = CreateContext(connectionString))
        {
            var owner = await context.Users.SingleAsync();
            var otherUser = new User
            {
                UserId = Guid.NewGuid(),
                ExternalSubject = Guid.NewGuid().ToString("N"),
                Email = "other@example.com",
                Role = UserRole.Handler,
                CreatedAtUtc = DateTime.UtcNow
            };

            entryId = Guid.NewGuid();
            context.Users.Add(otherUser);
            context.Entries.Add(new Entry
            {
                EntryId = entryId,
                TrialId = trialId,
                CreatedByUserId = otherUser.UserId,
                Status = EntryStatus.Draft,
                PdfStatus = PdfStatus.Queued,
                CreatedAtUtc = DateTime.UtcNow
            });

            await context.SaveChangesAsync();

            Assert.NotEqual(owner.UserId, otherUser.UserId);
        }

        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/entries/{entryId}");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetEntry_ReturnsNotFound_WhenMissing()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        await EnsureDatabaseAsync(connectionString);

        using var factory = CreateFactory(connectionString);
        using var client = factory.CreateClient();

        var token = await GetTokenAsync(client, "Handler");

        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/entries/{Guid.NewGuid()}");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateEntry_UpdatesFields_WhenDraftAndEtagMatches()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        await EnsureDatabaseAsync(connectionString);

        Guid trialId;
        await using (var context = CreateContext(connectionString))
        {
            var trial = new Trial
            {
                TrialId = Guid.NewGuid(),
                Name = "Sample Trial",
                OrganizationCode = "ASCA",
                SportCode = "StockDog",
                FormCode = "TrialEntry",
                FormVersion = "2020-10-08",
                OrganizerSlug = "EXCLUB",
                EventSlug = "SPRING-2026-05-02",
                HostClub = "Example Club",
                StartDate = new DateOnly(2026, 5, 2),
                EndDate = new DateOnly(2026, 5, 3),
                Location = "Bryan, TX",
                SecretaryEmail = "secretary@example.com",
                IsActive = true
            };

            context.Trials.Add(trial);
            await context.SaveChangesAsync();
            trialId = trial.TrialId;
        }

        using var factory = CreateFactory(connectionString);
        using var client = factory.CreateClient();

        var token = await GetTokenAsync(client, "Handler");

        Guid entryId;
        string etag;
        await using (var context = CreateContext(connectionString))
        {
            var user = await context.Users.SingleAsync();
            entryId = Guid.NewGuid();

            var entry = new Entry
            {
                EntryId = entryId,
                TrialId = trialId,
                CreatedByUserId = user.UserId,
                Status = EntryStatus.Draft,
                PdfStatus = PdfStatus.Queued,
                CreatedAtUtc = DateTime.UtcNow
            };

            context.Entries.Add(entry);
            await context.SaveChangesAsync();

            etag = $"\"{Convert.ToBase64String(entry.RowVersion)}\"";
        }

        using var request = new HttpRequestMessage(HttpMethod.Put, $"/api/entries/{entryId}");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        request.Headers.TryAddWithoutValidation("If-Match", etag);
        request.Content = new StringContent(
            JsonSerializer.Serialize(new { dog = new { callName = "Ranger", breed = "Australian Shepherd" } }),
            System.Text.Encoding.UTF8,
            "application/json");

        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(response.Headers.ETag is not null);

        await using var verify = CreateContext(connectionString);
        var updated = await verify.Entries.FindAsync(entryId);
        Assert.NotNull(updated);
        Assert.Equal("Ranger", updated!.DogCallName);
        Assert.Equal("Australian Shepherd", updated.DogBreed);
        Assert.NotNull(updated.UpdatedAtUtc);
    }

    [Fact]
    public async Task UpdateEntry_ReturnsConflict_WhenSubmitted()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        await EnsureDatabaseAsync(connectionString);

        Guid trialId;
        await using (var context = CreateContext(connectionString))
        {
            var trial = new Trial
            {
                TrialId = Guid.NewGuid(),
                Name = "Sample Trial",
                OrganizationCode = "ASCA",
                SportCode = "StockDog",
                FormCode = "TrialEntry",
                FormVersion = "2020-10-08",
                OrganizerSlug = "EXCLUB",
                EventSlug = "SPRING-2026-05-02",
                HostClub = "Example Club",
                StartDate = new DateOnly(2026, 5, 2),
                EndDate = new DateOnly(2026, 5, 3),
                Location = "Bryan, TX",
                SecretaryEmail = "secretary@example.com",
                IsActive = true
            };

            context.Trials.Add(trial);
            await context.SaveChangesAsync();
            trialId = trial.TrialId;
        }

        using var factory = CreateFactory(connectionString);
        using var client = factory.CreateClient();

        var token = await GetTokenAsync(client, "Handler");

        Guid entryId;
        await using (var context = CreateContext(connectionString))
        {
            var user = await context.Users.SingleAsync();
            entryId = Guid.NewGuid();

            context.Entries.Add(new Entry
            {
                EntryId = entryId,
                TrialId = trialId,
                CreatedByUserId = user.UserId,
                Status = EntryStatus.Submitted,
                PdfStatus = PdfStatus.Queued,
                CreatedAtUtc = DateTime.UtcNow
            });

            await context.SaveChangesAsync();
        }

        using var request = new HttpRequestMessage(HttpMethod.Put, $"/api/entries/{entryId}");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        request.Content = new StringContent(
            JsonSerializer.Serialize(new { dog = new { callName = "Ranger" } }),
            System.Text.Encoding.UTF8,
            "application/json");

        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task UpdateEntry_ReturnsForbidden_WhenNotOwner()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        await EnsureDatabaseAsync(connectionString);

        Guid trialId;
        await using (var context = CreateContext(connectionString))
        {
            var trial = new Trial
            {
                TrialId = Guid.NewGuid(),
                Name = "Sample Trial",
                OrganizationCode = "ASCA",
                SportCode = "StockDog",
                FormCode = "TrialEntry",
                FormVersion = "2020-10-08",
                OrganizerSlug = "EXCLUB",
                EventSlug = "SPRING-2026-05-02",
                HostClub = "Example Club",
                StartDate = new DateOnly(2026, 5, 2),
                EndDate = new DateOnly(2026, 5, 3),
                Location = "Bryan, TX",
                SecretaryEmail = "secretary@example.com",
                IsActive = true
            };

            context.Trials.Add(trial);
            await context.SaveChangesAsync();
            trialId = trial.TrialId;
        }

        using var factory = CreateFactory(connectionString);
        using var client = factory.CreateClient();

        var token = await GetTokenAsync(client, "Handler");

        Guid entryId;
        await using (var context = CreateContext(connectionString))
        {
            var otherUser = new User
            {
                UserId = Guid.NewGuid(),
                ExternalSubject = Guid.NewGuid().ToString("N"),
                Email = "other@example.com",
                Role = UserRole.Handler,
                CreatedAtUtc = DateTime.UtcNow
            };

            context.Users.Add(otherUser);
            await context.SaveChangesAsync();

            entryId = Guid.NewGuid();
            context.Entries.Add(new Entry
            {
                EntryId = entryId,
                TrialId = trialId,
                CreatedByUserId = otherUser.UserId,
                Status = EntryStatus.Draft,
                PdfStatus = PdfStatus.Queued,
                CreatedAtUtc = DateTime.UtcNow
            });

            await context.SaveChangesAsync();
        }

        using var request = new HttpRequestMessage(HttpMethod.Put, $"/api/entries/{entryId}");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        request.Content = new StringContent(
            JsonSerializer.Serialize(new { dog = new { callName = "Ranger" } }),
            System.Text.Encoding.UTF8,
            "application/json");

        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task UpdateEntry_ReturnsPreconditionFailed_WhenEtagMismatch()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        await EnsureDatabaseAsync(connectionString);

        Guid trialId;
        await using (var context = CreateContext(connectionString))
        {
            var trial = new Trial
            {
                TrialId = Guid.NewGuid(),
                Name = "Sample Trial",
                OrganizationCode = "ASCA",
                SportCode = "StockDog",
                FormCode = "TrialEntry",
                FormVersion = "2020-10-08",
                OrganizerSlug = "EXCLUB",
                EventSlug = "SPRING-2026-05-02",
                HostClub = "Example Club",
                StartDate = new DateOnly(2026, 5, 2),
                EndDate = new DateOnly(2026, 5, 3),
                Location = "Bryan, TX",
                SecretaryEmail = "secretary@example.com",
                IsActive = true
            };

            context.Trials.Add(trial);
            await context.SaveChangesAsync();
            trialId = trial.TrialId;
        }

        using var factory = CreateFactory(connectionString);
        using var client = factory.CreateClient();

        var token = await GetTokenAsync(client, "Handler");

        Guid entryId;
        await using (var context = CreateContext(connectionString))
        {
            var user = await context.Users.SingleAsync();
            entryId = Guid.NewGuid();

            context.Entries.Add(new Entry
            {
                EntryId = entryId,
                TrialId = trialId,
                CreatedByUserId = user.UserId,
                Status = EntryStatus.Draft,
                PdfStatus = PdfStatus.Queued,
                CreatedAtUtc = DateTime.UtcNow
            });

            await context.SaveChangesAsync();
        }

        using var request = new HttpRequestMessage(HttpMethod.Put, $"/api/entries/{entryId}");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        request.Headers.TryAddWithoutValidation("If-Match", "\"invalid-etag\"");
        request.Content = new StringContent(
            JsonSerializer.Serialize(new { dog = new { callName = "Ranger" } }),
            System.Text.Encoding.UTF8,
            "application/json");

        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.PreconditionFailed, response.StatusCode);
    }


    private static WebApplicationFactory<Program> CreateFactory(string connectionString)
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
            });
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
}
