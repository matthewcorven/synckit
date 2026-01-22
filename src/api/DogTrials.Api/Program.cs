using System.Diagnostics;
using DogTrials.Api.Endpoints;
using DogTrials.Api.Middleware;
using OpenTelemetry.Trace;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = context =>
    {
        var traceId = Activity.Current?.TraceId.ToString() ?? context.HttpContext.TraceIdentifier;
        context.ProblemDetails.Extensions["traceId"] = traceId;
    };
});

builder.Services.AddOpenTelemetry()
    .WithTracing(tracing =>
    {
        tracing
            .AddSource(HealthEndpoints.ActivitySourceName)
            .AddAspNetCoreInstrumentation()
            .AddConsoleExporter();
    });

var app = builder.Build();

app.UseExceptionHandler();
app.UseMiddleware<CorrelationMiddleware>();
app.UseStatusCodePages(async context =>
{
    if (context.HttpContext.Response.HasStarted)
    {
        return;
    }

    var problem = Results.Problem(statusCode: context.HttpContext.Response.StatusCode);
    await problem.ExecuteAsync(context.HttpContext);
});

app.UseHttpsRedirection();

app.MapHealthEndpoints();

app.Run();

public partial class Program;
