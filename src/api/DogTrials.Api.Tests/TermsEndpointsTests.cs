using System.Net;
using System.Text.Json;
using DogTrials.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace DogTrials.Api.Tests;

public sealed class TermsEndpointsTests
{
    private const string SigningKey = "test-signing-key-32-bytes-minimum-123456";
    private const string Issuer = "dog-trials.testauth";
    private const string Audience = "dog-trials.api";

    [Fact]
    public async Task GetCurrent_ReturnsTerms_WhenAuthenticated()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        await EnsureDatabaseAsync(connectionString);

        using var factory = CreateFactory(connectionString, "test");
        CreateTermsFile(factory, "test", "<script>alert('x')</script><p>OK</p>");

        using var client = factory.CreateClient();
        var token = await GetTokenAsync(client, "Handler");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/terms/current");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        Assert.Equal("test", root.GetProperty("version").GetString());
        var html = root.GetProperty("html").GetString();
        Assert.NotNull(html);
        Assert.DoesNotContain("<script", html, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("<p>OK</p>", html, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetCurrent_ReturnsUnauthorized_WhenNoToken()
    {
        var connectionString = TestDatabase.TryCreateSqlServerConnectionString();
        if (connectionString is null)
        {
            return;
        }

        await EnsureDatabaseAsync(connectionString);

        using var factory = CreateFactory(connectionString, "v1");
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/api/terms/current");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private static void CreateTermsFile(WebApplicationFactory<Program> factory, string version, string content)
    {
        using var scope = factory.Services.CreateScope();
        var env = scope.ServiceProvider.GetRequiredService<IWebHostEnvironment>();
        var termsDirectory = Path.Combine(env.ContentRootPath, "Data", "terms");
        Directory.CreateDirectory(termsDirectory);
        var filePath = Path.Combine(termsDirectory, $"{version}.html");
        File.WriteAllText(filePath, content);
    }

    private static WebApplicationFactory<Program> CreateFactory(string connectionString, string termsVersion)
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
                        ["Terms:CurrentVersion"] = termsVersion,
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
