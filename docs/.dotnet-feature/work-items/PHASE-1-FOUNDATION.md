# Phase 1: Foundation - Detailed Work Items

**Phase Duration:** 2 weeks (Weeks 1-2)  
**Phase Goal:** Runnable server with health endpoint and Docker support

---

## Work Item Details

### F1-01: Create Solution Structure

**Priority:** P0  
**Estimate:** 2 hours  
**Dependencies:** None

#### Description

Create the .NET solution and project structure following the established `server/{language}/` pattern.

#### Tasks

1. Create `server/csharp/` directory
2. Create solution file `SyncKit.Server.sln`
3. Create main project `SyncKit.Server/`
4. Create test project `SyncKit.Server.Tests/`
5. Add project references
6. Configure target framework (.NET 10)
7. Add .gitignore entries for .NET artifacts

#### File Structure

```
server/csharp/
├── SyncKit.Server.sln
├── SyncKit.Server/
│   ├── SyncKit.Server.csproj
│   ├── Program.cs
│   └── Properties/
│       └── launchSettings.json
├── SyncKit.Server.Tests/
│   ├── SyncKit.Server.Tests.csproj
│   └── UnitTest1.cs
└── .gitignore
```

#### Commands

```bash
# Create solution
dotnet new sln -n SyncKit.Server

# Create projects
dotnet new webapi -n SyncKit.Server -o SyncKit.Server --no-https
dotnet new xunit -n SyncKit.Server.Tests -o SyncKit.Server.Tests

# Add to solution
dotnet sln add SyncKit.Server/SyncKit.Server.csproj
dotnet sln add SyncKit.Server.Tests/SyncKit.Server.Tests.csproj

# Add reference
dotnet add SyncKit.Server.Tests/SyncKit.Server.Tests.csproj reference SyncKit.Server/SyncKit.Server.csproj
```

#### Acceptance Criteria

- [ ] Solution builds with `dotnet build`
- [ ] Tests run with `dotnet test`
- [ ] Project structure matches specification
- [ ] Target framework is `net10.0`

---

### F1-02: Add Configuration System

**Priority:** P0  
**Estimate:** 4 hours  
**Dependencies:** F1-01

#### Description

Implement configuration management using ASP.NET Core Configuration with environment variable support, matching the TypeScript server's configuration pattern.

#### Tasks

1. Create `SyncKitConfig.cs` configuration class
2. Create `appsettings.json` with defaults
3. Create `appsettings.Development.json`
4. Add environment variable mapping
5. Register configuration in DI container
6. Add configuration validation

#### Configuration Class

```csharp
// SyncKit.Server/Configuration/SyncKitConfig.cs
public class SyncKitConfig
{
    // Server
    public int Port { get; set; } = 8080;
    public string Host { get; set; } = "0.0.0.0";
    public string Environment { get; set; } = "Development";
    
    // Database
    public string? DatabaseUrl { get; set; }
    public int DatabasePoolMin { get; set; } = 2;
    public int DatabasePoolMax { get; set; } = 10;
    
    // Redis
    public string? RedisUrl { get; set; }
    public string RedisChannelPrefix { get; set; } = "synckit:";
    
    // JWT
    public string JwtSecret { get; set; } = null!; // Required
    public string JwtExpiresIn { get; set; } = "24h";
    public string JwtRefreshExpiresIn { get; set; } = "7d";
    
    // WebSocket
    public int WsHeartbeatInterval { get; set; } = 30000;
    public int WsHeartbeatTimeout { get; set; } = 60000;
    public int WsMaxConnections { get; set; } = 10000;
    
    // Sync
    public int SyncBatchSize { get; set; } = 100;
    public int SyncBatchDelay { get; set; } = 50;
    
    // Auth
    public bool AuthRequired { get; set; } = true;
}
```

#### Environment Variable Mapping

| Environment Variable | Config Property | Default |
|---------------------|-----------------|---------|
| `PORT` | `Port` | `8080` |
| `HOST` | `Host` | `0.0.0.0` |
| `ASPNETCORE_ENVIRONMENT` | `Environment` | `Development` |
| `DATABASE_URL` | `DatabaseUrl` | - |
| `DB_POOL_MIN` | `DatabasePoolMin` | `2` |
| `DB_POOL_MAX` | `DatabasePoolMax` | `10` |
| `REDIS_URL` | `RedisUrl` | - |
| `REDIS_CHANNEL_PREFIX` | `RedisChannelPrefix` | `synckit:` |
| `JWT_SECRET` | `JwtSecret` | **Required** |
| `JWT_EXPIRES_IN` | `JwtExpiresIn` | `24h` |
| `JWT_REFRESH_EXPIRES_IN` | `JwtRefreshExpiresIn` | `7d` |
| `WS_HEARTBEAT_INTERVAL` | `WsHeartbeatInterval` | `30000` |
| `WS_HEARTBEAT_TIMEOUT` | `WsHeartbeatTimeout` | `60000` |
| `WS_MAX_CONNECTIONS` | `WsMaxConnections` | `10000` |
| `SYNC_BATCH_SIZE` | `SyncBatchSize` | `100` |
| `SYNC_BATCH_DELAY` | `SyncBatchDelay` | `50` |
| `SYNCKIT_AUTH_REQUIRED` | `AuthRequired` | `true` |

#### Configuration Registration

```csharp
// Program.cs - Options pattern with validation (mirrors TypeScript Zod validation)
builder.Services.AddOptions<SyncKitConfig>()
    .Bind(builder.Configuration)
    .ValidateDataAnnotations()
    .ValidateOnStart(); // Fail fast on startup if config invalid
```

#### Data Annotations (matching TypeScript Zod schema)

```csharp
public class SyncKitConfig
{
    [Required, MinLength(32)] // Matches: jwtSecret: z.string().min(32)
    public string JwtSecret { get; set; } = null!;
    
    [Range(1, 65535)] // Matches: port: z.number().int().positive()
    public int Port { get; set; } = 8080;
    
    [Range(1, int.MaxValue)]
    public int WsHeartbeatInterval { get; set; } = 30000;
    
    // ... other properties with matching validation
}
```

#### Acceptance Criteria

- [ ] Configuration loads from appsettings.json
- [ ] Configuration loads from environment variables
- [ ] Environment variables override appsettings
- [ ] Configuration validation fails on startup if JWT_SECRET missing or <32 chars
- [ ] Validation rules match TypeScript Zod schema
- [ ] IOptions<SyncKitConfig> injectable via DI

---

### F1-03: Add Logging Infrastructure

**Priority:** P0  
**Estimate:** 3 hours  
**Dependencies:** F1-01

#### Description

Set up structured logging using Serilog with console and file outputs. Log format should include timestamps, log levels, and contextual information.

#### Tasks

1. Add Serilog NuGet packages
2. Configure Serilog in Program.cs
3. Add log configuration in appsettings.json
4. Create logging conventions documentation
5. Add request logging middleware

#### NuGet Packages

```xml
<PackageReference Include="Serilog.AspNetCore" Version="8.*" />
<PackageReference Include="Serilog.Sinks.Console" Version="5.*" />
<PackageReference Include="Serilog.Sinks.File" Version="5.*" />
```

#### Log Configuration

```json
// appsettings.json
{
  "Serilog": {
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft": "Warning",
        "Microsoft.Hosting.Lifetime": "Information"
      }
    },
    "WriteTo": [
      {
        "Name": "Console",
        "Args": {
          "outputTemplate": "[{Timestamp:HH:mm:ss} {Level:u3}] {SourceContext}: {Message:lj}{NewLine}{Exception}"
        }
      }
    ],
    "Enrich": ["FromLogContext", "WithMachineName", "WithThreadId"]
  }
}
```

#### Log Levels

| Level | Usage |
|-------|-------|
| Debug | Detailed diagnostic information |
| Information | General operational events |
| Warning | Non-critical issues |
| Error | Failures that need attention |
| Fatal | Critical failures |

#### Acceptance Criteria

- [ ] Logs output to console with structured format
- [ ] Log level configurable via appsettings.json
- [ ] Request/response logging works
- [ ] Log context includes source class name
- [ ] Logs include timestamps

---

### F1-04: Implement Health Endpoint

**Priority:** P0  
**Estimate:** 2 hours  
**Dependencies:** F1-02, F1-03

#### Description

Implement a health check endpoint that returns server statistics in JSON format, matching the TypeScript server's health endpoint.

#### Tasks

1. Create HealthController
2. Implement health response model
3. Add server stats collection
4. Register endpoint routing

#### Health Response Model

```csharp
public record HealthResponse
{
    public string Status { get; init; } = "ok";
    public string Version { get; init; } = "1.0.0";
    public long Uptime { get; init; }
    public HealthStats Stats { get; init; } = new();
}

public record HealthStats
{
    public int Connections { get; init; }
    public int Documents { get; init; }
    public long MemoryUsage { get; init; }
}
```

#### ASP.NET Core Health Checks Integration

In addition to the `/health` stats endpoint, add ASP.NET Core health checks for container orchestration:

```csharp
// Program.cs
builder.Services.AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy(), tags: new[] { "live" });

// Liveness probe - is the process running?
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("live")
});

// Readiness probe - can accept traffic? (expanded in Phase 6 with DB/Redis checks)
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});
```

> **Note:** Kubernetes and Docker use separate liveness/readiness probes. The existing `/health` endpoint provides detailed stats for monitoring dashboards.

#### Expected Response

```json
GET /health HTTP/1.1

{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 12345,
  "stats": {
    "connections": 42,
    "documents": 100,
    "memoryUsage": 52428800
  }
}
```

#### Acceptance Criteria

- [ ] `GET /health` returns 200 with JSON stats (matches TypeScript server)
- [ ] Response includes status, version, uptime, stats
- [ ] `GET /health/live` returns 200 (liveness probe)
- [ ] `GET /health/ready` returns 200 when ready (readiness probe)
- [ ] Uptime is accurate (seconds since start)

---

### F1-05: Create Dockerfile

**Priority:** P0  
**Estimate:** 2 hours  
**Dependencies:** F1-01

#### Description

Create a multi-stage Dockerfile for building and running the .NET server with optimized image size.

#### Tasks

1. Create Dockerfile with multi-stage build
2. Optimize for production (no SDK in final image)
3. Configure non-root user
4. Set up health check
5. Document build arguments

#### Dockerfile

```dockerfile
# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy csproj and restore
COPY SyncKit.Server/SyncKit.Server.csproj SyncKit.Server/
RUN dotnet restore SyncKit.Server/SyncKit.Server.csproj

# Copy source and build
COPY . .
WORKDIR /src/SyncKit.Server
RUN dotnet publish -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Create non-root user
RUN adduser --disabled-password --gecos "" appuser
USER appuser

# Copy published app
COPY --from=build /app/publish .

# Configure
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "SyncKit.Server.dll"]
```

#### Acceptance Criteria

- [ ] `docker build` succeeds
- [ ] Image size <100MB
- [ ] Container runs as non-root user
- [ ] Health check passes
- [ ] Environment variables configurable at runtime

---

### F1-06: Create docker-compose.yml

**Priority:** P0  
**Estimate:** 2 hours  
**Dependencies:** F1-05

#### Description

Create docker-compose configuration for local development with optional PostgreSQL and Redis services.

#### Tasks

1. Create docker-compose.yml
2. Configure SyncKit server service
3. Add PostgreSQL service (optional)
4. Add Redis service (optional)
5. Configure networking
6. Add volume mounts for persistence

#### docker-compose.yml

```yaml
version: '3.8'

services:
  synckit-server:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - ASPNETCORE_ENVIRONMENT=Development
      - JWT_SECRET=development-secret-change-in-production-min-32-chars
      - DATABASE_URL=postgresql://synckit:synckit@postgres:5432/synckit
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 10s
      timeout: 3s
      retries: 3

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=synckit
      - POSTGRES_PASSWORD=synckit
      - POSTGRES_DB=synckit
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U synckit"]
      interval: 5s
      timeout: 3s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

#### Acceptance Criteria

- [ ] `docker compose up` starts all services
- [ ] SyncKit server accessible at localhost:8080
- [ ] PostgreSQL accessible from SyncKit server
- [ ] Redis accessible from SyncKit server
- [ ] Data persists in volumes across restarts

---

### F1-07: Setup GitHub Actions CI

**Priority:** P1  
**Estimate:** 4 hours  
**Dependencies:** F1-01

#### Description

Create GitHub Actions workflow for continuous integration including build, test, and Docker image validation.

#### Tasks

1. Create `.github/workflows/dotnet-server.yml`
2. Configure .NET SDK setup
3. Add build and test steps
4. Add Docker build step
5. Configure caching for faster builds

#### Workflow File

```yaml
# .github/workflows/dotnet-server.yml
name: .NET Server CI

on:
  push:
    branches: [main]
    paths:
      - 'server/csharp/**'
  pull_request:
    branches: [main]
    paths:
      - 'server/csharp/**'

defaults:
  run:
    working-directory: server/csharp

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup .NET
      uses: actions/setup-dotnet@v4
      with:
        dotnet-version: '10.0.x'
    
    - name: Restore dependencies
      run: dotnet restore
    
    - name: Build
      run: dotnet build --no-restore
    
    - name: Test
      run: dotnet test --no-build --verbosity normal --collect:"XPlat Code Coverage"
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        files: '**/coverage.cobertura.xml'

  docker:
    runs-on: ubuntu-latest
    needs: build
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Build Docker image
      run: docker build -t synckit-server:test .
    
    - name: Test Docker image
      run: |
        docker run -d --name test-server -p 8080:8080 \
          -e JWT_SECRET=test-secret-at-least-32-characters-long \
          synckit-server:test
        sleep 5
        curl -f http://localhost:8080/health
        docker stop test-server
```

#### Acceptance Criteria

- [ ] Workflow triggers on push/PR to server/csharp/**
- [ ] Build step succeeds
- [ ] Test step runs all tests
- [ ] Coverage report uploaded
- [ ] Docker image builds successfully

---

### F1-08: Add README.md

**Priority:** P1  
**Estimate:** 2 hours  
**Dependencies:** F1-04

#### Description

Create comprehensive README documentation for the .NET server implementation.

#### Tasks

1. Create server/csharp/README.md
2. Document prerequisites
3. Document quick start
4. Document configuration
5. Document development workflow
6. Document testing

#### README Structure

```markdown
# SyncKit .NET Server

ASP.NET Core implementation of the SyncKit sync server.

## Prerequisites
## Quick Start
## Configuration
## Development
## Testing
## Docker
## API Reference
## Contributing
```

#### Acceptance Criteria

- [ ] README covers all major topics
- [ ] Quick start works when followed step-by-step
- [ ] Configuration table matches implementation
- [ ] Examples are accurate and tested

---

### F1-09: Implement Graceful Shutdown

**Priority:** P1  
**Estimate:** 2 hours  
**Dependencies:** F1-02

#### Description

Implement graceful shutdown handling using `IHostApplicationLifetime`, matching the TypeScript server's SIGTERM/SIGINT handlers.

> **Reference:** TypeScript server [index.ts](server/typescript/src/index.ts) implements shutdown with 10s force-exit timeout.

#### Tasks

1. Register shutdown handlers via `IHostApplicationLifetime`
2. Stop accepting new connections
3. Close existing WebSocket connections gracefully
4. Dispose storage/Redis connections
5. Add force-exit timeout (10s)

#### Implementation

```csharp
// Program.cs
var app = builder.Build();
var lifetime = app.Services.GetRequiredService<IHostApplicationLifetime>();

lifetime.ApplicationStopping.Register(async () =>
{
    Log.Information("Shutdown signal received, closing gracefully...");
    
    // 1. Stop accepting new WebSocket connections
    // (middleware will reject new upgrades)
    
    // 2. Close all active WebSocket connections
    var connectionManager = app.Services.GetRequiredService<IConnectionManager>();
    await connectionManager.CloseAllAsync(
        WebSocketCloseStatus.EndpointUnavailable, 
        "Server shutdown");
    
    // 3. Dispose coordinator (clears awareness, unsubscribes)
    var coordinator = app.Services.GetRequiredService<ISyncCoordinator>();
    await coordinator.DisposeAsync();
    
    Log.Information("Graceful shutdown complete");
});

// Force exit after 10 seconds (matches TypeScript)
lifetime.ApplicationStopping.Register(() =>
{
    Task.Delay(TimeSpan.FromSeconds(10)).ContinueWith(_ =>
    {
        Log.Warning("Forced shutdown after timeout");
        Environment.Exit(1);
    });
});
```

#### Acceptance Criteria

- [ ] Server responds to SIGTERM gracefully
- [ ] Server responds to SIGINT (Ctrl+C) gracefully
- [ ] Active WebSocket connections closed with 1001 status
- [ ] Storage/Redis connections disposed
- [ ] Force exit after 10 seconds if shutdown hangs

---

## Phase 1 Summary

| ID | Title | Priority | Est (h) | Status |
|----|-------|----------|---------|--------|
| F1-01 | Create solution structure | P0 | 2 | ⬜ |
| F1-02 | Add configuration system | P0 | 4 | ⬜ |
| F1-03 | Add logging infrastructure | P0 | 3 | ⬜ |
| F1-04 | Implement health endpoint | P0 | 4 | ⬜ |
| F1-05 | Create Dockerfile | P0 | 2 | ⬜ |
| F1-06 | Create docker-compose.yml | P0 | 2 | ⬜ |
| F1-07 | Setup GitHub Actions CI | P1 | 4 | ⬜ |
| F1-08 | Add README.md | P1 | 2 | ⬜ |
| F1-09 | Implement graceful shutdown | P1 | 2 | ⬜ |
| **Total** | | | **25** | |

**Legend:** ⬜ Not Started | 🔄 In Progress | ✅ Complete
