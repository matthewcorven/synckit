using DogTrials.Api.Data;
using DogTrials.Api.Dtos;
using DogTrials.Api.Entities;
using DogTrials.Api.Security;
using DogTrials.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace DogTrials.Api.Endpoints;

public static class TrialsEndpoints
{
    public static IEndpointRouteBuilder MapTrialsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/trials")
            .RequireAuthorization(AuthPolicies.Handler);

        group.MapGet("", async (DogTrialsDbContext context) =>
            {
                var trials = await context.Trials
                    .AsNoTracking()
                    .Where(trial => trial.IsActive)
                    .OrderBy(trial => trial.StartDate)
                    .Select(trial => trial.ToSummaryDto())
                    .ToListAsync();

                return Results.Ok(trials);
            })
            .WithName("Trials_List");

        group.MapGet("/{trialId:guid}", async (Guid trialId, DogTrialsDbContext context) =>
            {
                var trial = await context.Trials
                    .AsNoTracking()
                    .Where(t => t.TrialId == trialId)
                    .Select(t => t.ToSummaryDto())
                    .FirstOrDefaultAsync();

                return trial is null
                    ? Results.Problem(
                        title: "Trial not found",
                        statusCode: StatusCodes.Status404NotFound,
                        extensions: new Dictionary<string, object?>
                        {
                            ["errorCode"] = "TRIAL_NOT_FOUND"
                        })
                    : Results.Ok(trial);
            })
            .WithName("Trials_GetById");

        group.MapGet("/{trialId:guid}/registration/metadata", async (Guid trialId, DogTrialsDbContext context, IFormMetadataService formMetadataService) =>
            {
                var trial = await context.Trials
                    .AsNoTracking()
                    .Where(t => t.TrialId == trialId)
                    .Select(t => new { t.TrialId, t.OrganizationCode, t.SportCode, t.FormCode, t.FormVersion })
                    .FirstOrDefaultAsync();

                if (trial is null)
                {
                    return Results.Problem(
                        title: "Trial not found",
                        statusCode: StatusCodes.Status404NotFound,
                        extensions: new Dictionary<string, object?>
                        {
                            ["errorCode"] = "TRIAL_NOT_FOUND"
                        });
                }

                var formTemplate = new FormTemplateKeyDto(
                    trial.OrganizationCode,
                    trial.SportCode,
                    trial.FormCode,
                    trial.FormVersion);

                var formMetadata = await formMetadataService.GetFormMetadataAsync(formTemplate);

                if (formMetadata is null)
                {
                    return Results.Problem(
                        title: "Form template not found",
                        statusCode: StatusCodes.Status404NotFound,
                        extensions: new Dictionary<string, object?>
                        {
                            ["errorCode"] = "FORM_TEMPLATE_NOT_FOUND"
                        });
                }

                var dto = new TrialRegistrationMetadataDto(trial.TrialId, formTemplate, formMetadata);
                System.Diagnostics.Activity.Current?.SetTag("trial.id", trial.TrialId.ToString());
                return Results.Ok(dto);
            })
            .WithName("Trials_GetRegistrationMetadata");

        return endpoints;
    }

    private static TrialSummaryDto ToSummaryDto(this Trial trial)
    {
        return new TrialSummaryDto(
            trial.TrialId,
            trial.Name,
            new FormTemplateKeyDto(
                trial.OrganizationCode,
                trial.SportCode,
                trial.FormCode,
                trial.FormVersion),
            trial.OrganizerSlug,
            trial.EventSlug,
            trial.TrackingSlug,
            trial.HostClub,
            trial.StartDate.ToString("yyyy-MM-dd"),
            trial.EndDate.ToString("yyyy-MM-dd"),
            trial.Location,
            trial.SecretaryEmail,
            trial.IsActive);
    }
}
