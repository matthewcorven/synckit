using System.Net;
using System.Text.Json;
using DogTrials.Api.Data;
using DogTrials.Api.Entities;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace DogTrials.Api.Tests;

public sealed class FormTemplatesEndpointsTests
{
    private const string SigningKey = "test-signing-key-32-bytes-minimum-123456";
    private const string Issuer = "dog-trials.testauth";
    private const string Audience = "dog-trials.api";

    [Fact]
    public async Task GetMetadata_ReturnsMetadata_WhenAuthenticated()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        await EnsureDatabaseAsync(connectionString);

        // seed corresponding form template
        await using (var context = CreateContext(connectionString))
        {
            var ft = new DogTrials.Api.Entities.FormTemplate
            {
                OrganizationCode = "ASCA",
                SportCode = "StockDog",
                FormCode = "TrialEntry",
                Version = "2020-10-08",
                GridConfigJson = "[{\"grid\":\"Upper\",\"rows\":[\"Sheep\",\"Cattle\",\"Ducks\",\"Mixed\"],\"cols\":[\"STD\",\"OPN\",\"ADV\",\"FTD_OPN\",\"FTD_ADV\",\"DATE1_TRIAL1\"],\"disabledCells\":[{\"row\":\"Mixed\",\"col\":\"STD\"}]}]"
            };

            context.FormTemplates.Add(ft);
            await context.SaveChangesAsync();
        }

        using var factory = CreateFactory(connectionString);
        using var client = factory.CreateClient();

        var token = await GetTokenAsync(client, "Handler");
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/form-templates/ASCA/StockDog/TrialEntry/2020-10-08/metadata");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        Assert.Equal("ASCA", root.GetProperty("formTemplate").GetProperty("organizationCode").GetString());
        Assert.Equal(JsonValueKind.Array, root.GetProperty("grids").ValueKind);
    }

    [Fact]
    public async Task GetMetadata_ReturnsNotFound_WhenMissing()
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
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/form-templates/ASCA/StockDog/TrialEntry/2020-10-08/metadata");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task GetMetadata_EmitsTelemetrySpan()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        await EnsureDatabaseAsync(connectionString);

        // seed corresponding form template
        await using (var context = CreateContext(connectionString))
        {
            var ft = new DogTrials.Api.Entities.FormTemplate
            {
                OrganizationCode = "ASCA",
                SportCode = "StockDog",
                FormCode = "TrialEntry",
                Version = "2020-10-08",
                GridConfigJson = "[{\"grid\":\"Upper\",\"rows\":[\"Sheep\"],\"cols\":[\"STD\"],\"disabledCells\":[]}]"
            };

            context.FormTemplates.Add(ft);
            await context.SaveChangesAsync();
        }

        var activities = new List<System.Diagnostics.Activity>();
        var listener = new System.Diagnostics.ActivityListener
        {
            ShouldListenTo = source => true,
            Sample = (ref System.Diagnostics.ActivityCreationOptions<System.Diagnostics.ActivityContext> _) => System.Diagnostics.ActivitySamplingResult.AllDataAndRecorded,
            ActivityStarted = activity => { lock (activities) { activities.Add(activity); } },
        };

        System.Diagnostics.ActivitySource.AddActivityListener(listener);

        using var factory = CreateFactory(connectionString);
        using var client = factory.CreateClient();

        var token = await GetTokenAsync(client, "Handler");
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/form-templates/ASCA/StockDog/TrialEntry/2020-10-08/metadata");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        // find any activity that corresponds to this route
        var found = activities.FirstOrDefault(a => a.DisplayName?.Contains("form-templates") == true);
        Assert.NotNull(found);

        // assert the activity has http.route tag for the endpoint route template
        var routeTag = found!.Tags.FirstOrDefault(t => t.Key == "http.route").Value;
        Assert.Equal("/api/form-templates/{organizationCode}/{sportCode}/{formCode}/{version}/metadata", routeTag);

        // assert form.template tag present
        var ftTag = found.Tags.FirstOrDefault(t => t.Key == "form.template").Value;
        Assert.Equal("ASCA/StockDog/TrialEntry/2020-10-08", ftTag);

        // cleanup listener
        listener.Dispose();
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
