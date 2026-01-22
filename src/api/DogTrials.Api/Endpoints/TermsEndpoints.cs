using DogTrials.Api.Security;
using DogTrials.Api.Services;

namespace DogTrials.Api.Endpoints;

public static class TermsEndpoints
{
    public static IEndpointRouteBuilder MapTermsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/terms")
            .RequireAuthorization(AuthPolicies.Handler);

        group.MapGet("/current", async (ITermsService termsService, CancellationToken cancellationToken) =>
            {
                var terms = await termsService.GetCurrentTermsAsync(cancellationToken);
                return Results.Ok(terms);
            })
            .WithName("Terms_GetCurrent");

        return endpoints;
    }
}
