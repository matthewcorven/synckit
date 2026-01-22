using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace DogTrials.Api.Tests;

public class AuthPolicyTests
{
    private const string SigningKey = "test-signing-key-32-bytes-minimum-123456";
    private const string Issuer = "dog-trials.testauth";
    private const string Audience = "dog-trials.api";

    [Fact]
    public async Task HandlerPolicy_AllowsHandlerToken()
    {
        using var factory = CreateFactory();
        using var client = factory.CreateClient();

        var token = await GetTokenAsync(client, "Handler");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/testauth/handler");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task HandlerPolicy_AllowsSecretaryToken()
    {
        using var factory = CreateFactory();
        using var client = factory.CreateClient();

        var token = await GetTokenAsync(client, "Secretary");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/testauth/handler");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task SecretaryPolicy_DeniesHandlerToken()
    {
        using var factory = CreateFactory();
        using var client = factory.CreateClient();

        var token = await GetTokenAsync(client, "Handler");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/testauth/secretary");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task MissingToken_ReturnsUnauthorized()
    {
        using var factory = CreateFactory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/api/testauth/handler");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ExpiredToken_ReturnsUnauthorized()
    {
        using var factory = CreateFactory();
        using var client = factory.CreateClient();

        var token = CreateExpiredToken("Handler");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/testauth/handler");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private static async Task<string> GetTokenAsync(HttpClient client, string role)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/testauth/token");
        request.Headers.Add("X-Test-Auth-Secret", "test-secret");
        request.Headers.Add("X-Test-Role", role);

        using var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();
        var document = System.Text.Json.JsonDocument.Parse(json);
        return document.RootElement.GetProperty("accessToken").GetString()!;
    }

    private static string CreateExpiredToken(string role)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SigningKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var now = DateTime.UtcNow;

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, Guid.NewGuid().ToString()),
            new(ClaimTypes.Role, role)
        };

        var token = new JwtSecurityToken(
            issuer: Issuer,
            audience: Audience,
            claims: claims,
            notBefore: now.AddMinutes(-10),
            expires: now.AddMinutes(-5),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static WebApplicationFactory<Program> CreateFactory()
    {
        return new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureAppConfiguration((_, config) =>
                {
                    var settings = new Dictionary<string, string?>
                    {
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
}
