using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace DogTrials.Api.Tests;

public class HealthEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public HealthEndpointTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Health_ReturnsOkPayloadAndSupportHeader()
    {
        using var client = _factory.CreateClient();
        using var response = await client.GetAsync("/api/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(response.Headers.Contains("x-support-id"));

        var json = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(json);

        var root = document.RootElement;
        Assert.Equal("ok", root.GetProperty("status").GetString());
        Assert.True(root.TryGetProperty("utcNow", out _));
        Assert.True(root.TryGetProperty("version", out _));
    }
}
