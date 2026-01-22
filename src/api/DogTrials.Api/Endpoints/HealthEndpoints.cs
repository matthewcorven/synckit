using System.Reflection;

namespace DogTrials.Api.Endpoints;

public static class HealthEndpoints
{
    internal const string ActivitySourceName = "DogTrials.Api";

    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/health", () => Results.Ok(new
        {
            status = "ok",
            utcNow = DateTime.UtcNow.ToString("o"),
            version = GetVersion()
        }))
        .WithName("Health");

        return endpoints;
    }

    private static string GetVersion()
    {
        var assembly = Assembly.GetExecutingAssembly();
        var informationalVersion = assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()
            ?.InformationalVersion;

        if (!string.IsNullOrWhiteSpace(informationalVersion))
        {
            return informationalVersion;
        }

        return assembly.GetName().Version?.ToString() ?? "unknown";
    }
}
