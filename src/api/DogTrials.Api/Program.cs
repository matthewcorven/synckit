using System.Diagnostics;
using System.Security.Claims;
using System.Text;
using Azure.Identity;
using Azure.Storage.Blobs;
using DogTrials.Api.Data;
using DogTrials.Api.Endpoints;
using DogTrials.Api.Middleware;
using DogTrials.Api.Options;
using DogTrials.Api.Security;
using DogTrials.Api.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OpenTelemetry.Trace;

DotNetEnv.Env.Load();

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

builder.Services.AddOptions<UserProvisioningOptions>()
    .Bind(builder.Configuration.GetSection(UserProvisioningOptions.SectionName))
    .PostConfigure(options => options.ApplyEnvironmentOverrides());

builder.Services.AddOptions<TrialSeedingOptions>()
    .Bind(builder.Configuration.GetSection(TrialSeedingOptions.SectionName))
    .PostConfigure(options => options.ApplyEnvironmentOverrides());

builder.Services.AddOptions<TermsOptions>()
    .Bind(builder.Configuration.GetSection(TermsOptions.SectionName))
    .PostConfigure(options => options.ApplyEnvironmentOverrides());

builder.Services.AddOptions<StorageOptions>()
    .Bind(builder.Configuration.GetSection(StorageOptions.SectionName))
    .PostConfigure(options => options.ApplyEnvironmentOverrides());

builder.Services.AddOptions<EmailOptions>()
    .Bind(builder.Configuration.GetSection(EmailOptions.SectionName))
    .PostConfigure(options => options.ApplyEnvironmentOverrides());

builder.Services.AddOptions<SubmitOptions>()
    .Bind(builder.Configuration.GetSection(SubmitOptions.SectionName))
    .PostConfigure(options => options.ApplyEnvironmentOverrides());

builder.Services.AddOptions<DogTrials.Api.Options.AuthenticationOptions>()
    .Bind(builder.Configuration.GetSection(DogTrials.Api.Options.AuthenticationOptions.SectionName));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer();

builder.Services
    .AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<Microsoft.Extensions.Options.IOptions<DogTrials.Api.Options.AuthenticationOptions>, Microsoft.Extensions.Options.IOptions<TestAuthOptions>>((options, authOptions, testAuthOptions) =>
    {
        var authConfig = authOptions.Value;
        var testAuthConfig = testAuthOptions.Value;

        var validIssuers = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (!string.IsNullOrWhiteSpace(authConfig.Authority))
        {
            options.Authority = authConfig.Authority;
            options.RequireHttpsMetadata = authConfig.RequireHttpsMetadata;
            validIssuers.Add(authConfig.Authority);
        }

        if (!string.IsNullOrWhiteSpace(authConfig.Audience))
        {
            options.Audience = authConfig.Audience;
        }
        if (authConfig.ValidIssuers is { Length: > 0 })
        {
            foreach (var issuer in authConfig.ValidIssuers)
            {
                if (!string.IsNullOrWhiteSpace(issuer))
                {
                    validIssuers.Add(issuer);
                }
            }
        }

        if (testAuthConfig.Enabled && !string.IsNullOrWhiteSpace(testAuthConfig.Issuer))
        {
            validIssuers.Add(testAuthConfig.Issuer);
        }

        var validAudiences = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (authConfig.ValidAudiences is { Length: > 0 })
        {
            foreach (var audience in authConfig.ValidAudiences)
            {
                if (!string.IsNullOrWhiteSpace(audience))
                {
                    validAudiences.Add(audience);
                }
            }
        }

        if (!string.IsNullOrWhiteSpace(authConfig.Audience))
        {
            validAudiences.Add(authConfig.Audience);
        }

        if (testAuthConfig.Enabled && !string.IsNullOrWhiteSpace(testAuthConfig.Audience))
        {
            validAudiences.Add(testAuthConfig.Audience);
        }

        var parameters = options.TokenValidationParameters ?? new TokenValidationParameters();
        parameters.ValidateIssuerSigningKey = true;
        parameters.ValidateIssuer = validIssuers.Count > 0;
        parameters.ValidIssuers = validIssuers;
        parameters.ValidateAudience = validAudiences.Count > 0;
        parameters.ValidAudiences = validAudiences;
        parameters.ValidateLifetime = true;
        parameters.ClockSkew = TimeSpan.FromSeconds(30);
        parameters.RoleClaimType = string.IsNullOrWhiteSpace(authConfig.RoleClaimType)
            ? ClaimTypes.Role
            : authConfig.RoleClaimType;

        if (testAuthConfig.Enabled && !string.IsNullOrWhiteSpace(testAuthConfig.SigningKey))
        {
            var testAuthKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(testAuthConfig.SigningKey));
            parameters.IssuerSigningKeyResolver = (token, securityToken, kid, validationParameters) =>
            {
                var keys = new List<SecurityKey> { testAuthKey };
                if (validationParameters.IssuerSigningKey != null)
                {
                    keys.Add(validationParameters.IssuerSigningKey);
                }

                if (validationParameters.IssuerSigningKeys != null)
                {
                    keys.AddRange(validationParameters.IssuerSigningKeys);
                }

                return keys;
            };
        }

        options.TokenValidationParameters = parameters;
    });

builder.Services.AddAuthorizationBuilder()
    .AddPolicy(AuthPolicies.Handler, policy => policy.RequireRole(UserRoles.Handler, UserRoles.Secretary))
    .AddPolicy(AuthPolicies.Secretary, policy => policy.RequireRole(UserRoles.Secretary));

builder.Services.AddSingleton<IClaimsTransformation, RoleClaimsTransformation>();
builder.Services.AddScoped<IUserProvisioningService, UserProvisioningService>();
builder.Services.AddScoped<TrialSeedingService>();
builder.Services.AddScoped<ITermsService, TermsService>();
builder.Services.AddScoped<TrialCounterAllocator>();
builder.Services.AddSingleton(sp =>
{
    var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<StorageOptions>>().Value;
    if (!string.IsNullOrWhiteSpace(options.ConnectionString))
    {
        return new BlobServiceClient(options.ConnectionString);
    }

    if (!string.IsNullOrWhiteSpace(options.BlobEndpoint))
    {
        return new BlobServiceClient(new Uri(options.BlobEndpoint), new DefaultAzureCredential());
    }

    throw new InvalidOperationException("Storage configuration is missing. Set Storage:ConnectionString or Storage:BlobEndpoint.");
});
builder.Services.AddScoped<IBlobStorageService, AzureBlobStorageService>();
builder.Services.AddSingleton<IBackgroundJobQueue, ChannelBackgroundJobQueue>();
builder.Services.AddScoped<IPdfTemplateProvider, PdfTemplateProvider>();
builder.Services.AddScoped<IPdfStampingService, PdfStampingService>();
builder.Services.AddScoped<IPdfJobHandler, PdfJobHandler>();
builder.Services.AddScoped<IEmailJobHandler, AcsEmailJobHandler>();
builder.Services.AddHostedService<BackgroundJobProcessor>();
builder.Services.AddHostedService<BackgroundJobRecoveryService>();
builder.Services.AddOptions<BackgroundJobOptions>();

// Form metadata service
builder.Services.AddScoped<IFormMetadataService, FormMetadataService>();

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
app.UseMiddleware<UserProvisioningMiddleware>();
app.UseAuthorization();

app.MapHealthEndpoints();
app.MapTestAuthEndpoints();
app.MapTrialsEndpoints();
app.MapFormTemplatesEndpoints();
app.MapEntriesEndpoints();
app.MapTermsEndpoints();

var seedingOptions = app.Services.GetRequiredService<Microsoft.Extensions.Options.IOptions<TrialSeedingOptions>>();
if (seedingOptions.Value.Enabled)
{
    using var scope = app.Services.CreateScope();
    var seeder = scope.ServiceProvider.GetRequiredService<TrialSeedingService>();
    await seeder.SeedTrialsAsync(CancellationToken.None);
}

app.Run();

public partial class Program;
