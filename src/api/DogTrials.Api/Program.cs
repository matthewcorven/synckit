using System.Diagnostics;
using System.Text;
using DogTrials.Api.Data;
using DogTrials.Api.Endpoints;
using DogTrials.Api.Middleware;
using DogTrials.Api.Options;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
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

builder.Services.AddOptions<TestAuthOptions>()
    .Bind(builder.Configuration.GetSection(TestAuthOptions.SectionName))
    .PostConfigure(options => options.ApplyEnvironmentOverrides());

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer();

builder.Services
    .AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<Microsoft.Extensions.Options.IOptions<TestAuthOptions>>((options, testAuthOptions) =>
    {
        var config = testAuthOptions.Value;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config.SigningKey)),
            ValidateIssuer = true,
            ValidIssuer = config.Issuer,
            ValidateAudience = true,
            ValidAudience = config.Audience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddDbContext<DogTrialsDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DogTrialsSql")));

var app = builder.Build();

app.UseExceptionHandler();
app.UseMiddleware<CorrelationMiddleware>();
app.UseStatusCodePages(async context =>
{
    if (context.HttpContext.Response.HasStarted)
    {
        return;
    }

    if (context.HttpContext.Request.Path.StartsWithSegments("/api/testauth")
        && context.HttpContext.Response.StatusCode == StatusCodes.Status404NotFound)
    {
        return;
    }

    var problem = Results.Problem(statusCode: context.HttpContext.Response.StatusCode);
    await problem.ExecuteAsync(context.HttpContext);
});

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapHealthEndpoints();
app.MapTestAuthEndpoints();

app.Run();

public partial class Program;
