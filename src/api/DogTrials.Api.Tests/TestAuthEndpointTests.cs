using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace DogTrials.Api.Tests;

public class TestAuthEndpointTests
{
    [Fact]
    public async Task Token_WhenDisabled_ReturnsNotFound()
    {
        using var factory = CreateFactory(enabled: false);
        using var client = factory.CreateClient();

        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/testauth/token");
        request.Headers.Add("X-Test-Auth-Secret", "test-secret");
        request.Headers.Add("X-Test-Role", "Handler");

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Token_WithInvalidSecret_ReturnsUnauthorized()
    {
        using var factory = CreateFactory(enabled: true);
        using var client = factory.CreateClient();

        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/testauth/token");
        request.Headers.Add("X-Test-Auth-Secret", "wrong-secret");
        request.Headers.Add("X-Test-Role", "Handler");

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Token_WithValidSecret_ReturnsToken()
    {
        using var factory = CreateFactory(enabled: true);
        using var client = factory.CreateClient();

        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/testauth/token");
        request.Headers.Add("X-Test-Auth-Secret", "test-secret");
        request.Headers.Add("X-Test-Role", "Handler");

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(json);

        var root = document.RootElement;
        Assert.True(root.TryGetProperty("accessToken", out _));
        Assert.Equal(900, root.GetProperty("expiresInSeconds").GetInt32());
        Assert.Equal("Handler", root.GetProperty("role").GetString());
    }

    [Fact]
    public async Task Token_IsAcceptedByAuthMiddleware()
    {
        using var factory = CreateFactory(enabled: true);
        using var client = factory.CreateClient();

        using var tokenRequest = new HttpRequestMessage(HttpMethod.Post, "/api/testauth/token");
        tokenRequest.Headers.Add("X-Test-Auth-Secret", "test-secret");
        tokenRequest.Headers.Add("X-Test-Role", "Secretary");

        using var tokenResponse = await client.SendAsync(tokenRequest);
        var json = await tokenResponse.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(json);
        var token = document.RootElement.GetProperty("accessToken").GetString();

        using var validateRequest = new HttpRequestMessage(HttpMethod.Get, "/api/testauth/validate");
        validateRequest.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        using var validateResponse = await client.SendAsync(validateRequest);

        Assert.Equal(HttpStatusCode.OK, validateResponse.StatusCode);
    }

    private static WebApplicationFactory<Program> CreateFactory(bool enabled)
    {
        return new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureAppConfiguration((_, config) =>
                {
                    var settings = new Dictionary<string, string?>
                    {
                        ["TestAuth:Enabled"] = enabled.ToString(),
                        ["TestAuth:Secret"] = "test-secret",
                        ["TestAuth:SigningKey"] = "test-signing-key-32-bytes-minimum-123456",
                        ["TestAuth:Issuer"] = "dog-trials.testauth",
                        ["TestAuth:Audience"] = "dog-trials.api",
                        ["TestAuth:TokenLifetimeMinutes"] = "15"
                    };

                    config.AddInMemoryCollection(settings);
                });
            });
    }
}
