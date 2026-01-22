# WI-B01: API Scaffold

**Owner:** Agent B (Platform)  
**Status:** Proposed  
**Milestone:** M0  
**Dependencies:** CFG01  
**Artifacts folder (recommended):** `../artifacts/WI-B01/`

## Goal
Create the .NET 10 Web API scaffold with health endpoint and correlation header middleware.

## Scope
### In
- .NET 10 Web API project initialization
- `/api/health` endpoint
- Correlation header middleware (`x-support-id`)
- ProblemDetails error handling
- OpenTelemetry basic setup
- launchSettings.json for both streams

### Out
- Authentication (see B02, B08)
- Database (see B03-B07)
- Business endpoints (see B11+)

## Implementation notes
- Use minimal APIs or controllers (team preference)
- Health endpoint returns: `{ status: "ok", utcNow: "...", version: "..." }`
- Every response must include `x-support-id` header
- ProblemDetails for all 4xx/5xx responses
- Configure OpenTelemetry with Activity source
- Version from assembly or git SHA

## Acceptance criteria
- [ ] `dotnet run` starts API on configured port
- [ ] `GET /api/health` returns 200 with status object
- [ ] All responses include `x-support-id` header
- [ ] Errors return `application/problem+json`
- [ ] OpenTelemetry traces are generated

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- Health endpoint returns expected shape
- Correlation middleware adds header

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B01/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Full request/response cycle test
- Verify correlation header present

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B01/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- Health endpoint responds (smoke test)

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B01/playwright/health-check-trace.zip`

### DB verification
**Artifact requirements**
- N/A

**Artifacts (add as relative links during work)**
- N/A

### Telemetry verification
- Verify traces appear in console/output
- Verify `x-support-id` matches trace ID

**Artifact requirements**
- Screenshot of trace output

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B01/telemetry/trace-output.png`

## Risks / Questions
- .NET 10 preview availability (ensure SDK installed)
- ~~Minimal APIs vs Controllers preference~~ → **RESOLVED: Minimal APIs** - Clean, less boilerplate

## Project Structure
```
src/api/
├── DogTrials.Api/
│   ├── Program.cs
│   ├── DogTrials.Api.csproj
│   ├── Properties/
│   │   └── launchSettings.json
│   ├── Endpoints/
│   │   └── HealthEndpoints.cs
│   ├── Middleware/
│   │   └── CorrelationMiddleware.cs
│   └── appsettings.json
└── DogTrials.Api.Tests/
    └── HealthEndpointTests.cs
```

## Key Implementation

### Health Endpoint
```csharp
app.MapGet("/api/health", () => Results.Ok(new
{
    status = "ok",
    utcNow = DateTime.UtcNow.ToString("o"),
    version = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "unknown"
}));
```

### Correlation Middleware
```csharp
public class CorrelationMiddleware
{
    public async Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        var traceId = Activity.Current?.TraceId.ToString() 
            ?? Guid.NewGuid().ToString("N");
        
        context.Response.Headers["x-support-id"] = traceId;
        await next(context);
    }
}
```

### ProblemDetails Configuration
```csharp
builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = ctx =>
    {
        ctx.ProblemDetails.Extensions["traceId"] = 
            Activity.Current?.TraceId.ToString();
    };
});
```
