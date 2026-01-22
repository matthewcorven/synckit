using DogTrials.Api.Dtos;
using DogTrials.Api.Security;
using DogTrials.Api.Services;

namespace DogTrials.Api.Endpoints;

public static class FormTemplatesEndpoints
{
    public static IEndpointRouteBuilder MapFormTemplatesEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/form-templates").RequireAuthorization(AuthPolicies.Handler);

        group.MapGet("/{organizationCode}/{sportCode}/{formCode}/{version}/metadata", async (
            string organizationCode,
            string sportCode,
            string formCode,
            string version,
            IFormMetadataService formMetadataService) =>
        {
            var template = new FormTemplateKeyDto(organizationCode, sportCode, formCode, version);
            var metadata = await formMetadataService.GetFormMetadataAsync(template);

            if (metadata is null)
            {
                return Results.Problem(
                    title: "Form template not found",
                    statusCode: StatusCodes.Status404NotFound,
                    extensions: new Dictionary<string, object?>
                    {
                        ["errorCode"] = "FORM_TEMPLATE_NOT_FOUND"
                    });
            }

            System.Diagnostics.Activity.Current?.SetTag("form.template", $"{organizationCode}/{sportCode}/{formCode}/{version}");
            return Results.Ok(metadata);
        })
        .WithName("FormTemplates_GetMetadata");

        return endpoints;
    }
}
