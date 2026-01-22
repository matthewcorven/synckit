using System.Net;
using System.Text.Json;
using DogTrials.Api.Data;
using DogTrials.Api.Entities;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace DogTrials.Api.Tests;

public sealed class TrialsEndpointsTests
{
    private const string SigningKey = "test-signing-key-32-bytes-minimum-123456";
    private const string Issuer = "dog-trials.testauth";
    private const string Audience = "dog-trials.api";

    [Fact]
    public async Task List_ReturnsOnlyActiveTrials_WhenAuthenticated()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        await SeedTrialAsync(connectionString, isActive: true, name: "Active Trial");
        await SeedTrialAsync(connectionString, isActive: false, name: "Inactive Trial");

        using var factory = CreateFactory(connectionString);
        using var client = factory.CreateClient();

        var token = await GetTokenAsync(client, "Handler");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/trials");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        Assert.Equal(JsonValueKind.Array, root.ValueKind);
        Assert.Single(root.EnumerateArray());
        Assert.Equal("Active Trial", root[0].GetProperty("name").GetString());
    }

    [Fact]
    public async Task GetById_ReturnsTrial_WhenAuthenticated()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        var trialId = await SeedTrialAsync(connectionString, isActive: true, name: "Detail Trial");

        using var factory = CreateFactory(connectionString);
        using var client = factory.CreateClient();

        var token = await GetTokenAsync(client, "Handler");
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/trials/{trialId}");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        Assert.Equal(trialId.ToString(), root.GetProperty("trialId").GetString());
        Assert.Equal("Detail Trial", root.GetProperty("name").GetString());
    }

    [Fact]
    public async Task GetById_ReturnsNotFound_WhenMissing()
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
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/trials/{Guid.NewGuid()}" );
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task List_ReturnsUnauthorized_WhenMissingToken()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        await EnsureDatabaseAsync(connectionString);

        using var factory = CreateFactory(connectionString);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/api/trials");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
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

    private static async Task<Guid> SeedTrialAsync(string connectionString, bool isActive, string name)
    {
        await using var context = CreateContext(connectionString);
        await context.Database.MigrateAsync();

        var trialId = Guid.NewGuid();
        var trial = new Trial
        {
            TrialId = trialId,
            Name = name,
            OrganizationCode = "ASCA",
            SportCode = "StockDog",
            FormCode = "TrialEntry",
            FormVersion = "2020-10-08",
            OrganizerSlug = $"ORG-{Guid.NewGuid():N}".Substring(0, 12),
            EventSlug = $"EVT-{Guid.NewGuid():N}".Substring(0, 12),
            HostClub = "Example Club",
            StartDate = new DateOnly(2026, 5, 2),
            EndDate = new DateOnly(2026, 5, 3),
            Location = "Bryan, TX",
            SecretaryEmail = "secretary@example.com",
            IsActive = isActive,
            CreatedAtUtc = DateTime.UtcNow
        };

        context.Trials.Add(trial);
        context.TrialCounters.Add(new TrialCounter
        {
            TrialId = trialId,
            NextSequenceNumber = 1
        });

        await context.SaveChangesAsync();
        return trialId;
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
