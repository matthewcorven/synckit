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

Create the .NET solution and project structure following the established `server/{language}/src/` pattern.

#### Tasks

1. Create `server/csharp/src/` directory
2. Create solution file `SyncKit.Server.sln`
3. Create main project `SyncKit.Server/`
4. Create test project `SyncKit.Server.Tests/`
5. Add project references
6. Configure target framework (.NET 10)
7. Add .gitignore entries for .NET artifacts

#### File Structure

```
server/csharp/src/
├── SyncKit.Server.sln
├── .editorconfig
├── Directory.Build.props
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

### F1-01a: Add .editorconfig and Directory.Build.props

**Priority:** P0  
**Estimate:** 1 hour  
**Dependencies:** F1-01

#### Description

Add `.editorconfig` for consistent code style enforcement following [Microsoft's .NET coding conventions](https://learn.microsoft.com/en-us/dotnet/fundamentals/code-analysis/code-style-rule-options). Also add `Directory.Build.props` for shared project settings.

#### Tasks

1. Create `.editorconfig` with Microsoft .NET conventions
2. Create `Directory.Build.props` for shared settings
3. Enable nullable reference types
4. Enable implicit usings
5. Configure analyzer severity levels

#### .editorconfig

```editorconfig
# server/csharp/src/.editorconfig
# Top-most EditorConfig file
root = true

# All files
[*]
indent_style = space
indent_size = 4
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

# XML project files
[*.{csproj,vbproj,vcxproj,props,targets}]
indent_size = 2

# JSON files
[*.json]
indent_size = 2

# YAML files
[*.{yml,yaml}]
indent_size = 2

# Markdown files
[*.md]
trim_trailing_whitespace = false

# C# files
[*.cs]
# Organize usings
dotnet_sort_system_directives_first = true
dotnet_separate_import_directive_groups = false

# this. preferences
dotnet_style_qualification_for_field = false:suggestion
dotnet_style_qualification_for_property = false:suggestion
dotnet_style_qualification_for_method = false:suggestion
dotnet_style_qualification_for_event = false:suggestion

# Language keywords vs BCL types preferences
dotnet_style_predefined_type_for_locals_parameters_members = true:suggestion
dotnet_style_predefined_type_for_member_access = true:suggestion

# Parentheses preferences
dotnet_style_parentheses_in_arithmetic_binary_operators = always_for_clarity:silent
dotnet_style_parentheses_in_relational_binary_operators = always_for_clarity:silent
dotnet_style_parentheses_in_other_binary_operators = always_for_clarity:silent
dotnet_style_parentheses_in_other_operators = never_if_unnecessary:silent

# Modifier preferences
dotnet_style_require_accessibility_modifiers = for_non_interface_members:suggestion
dotnet_style_readonly_field = true:suggestion

# Expression-level preferences
dotnet_style_object_initializer = true:suggestion
dotnet_style_collection_initializer = true:suggestion
dotnet_style_explicit_tuple_names = true:suggestion
dotnet_style_null_propagation = true:suggestion
dotnet_style_coalesce_expression = true:suggestion
dotnet_style_prefer_is_null_check_over_reference_equality_method = true:suggestion
dotnet_style_prefer_inferred_tuple_names = true:suggestion
dotnet_style_prefer_inferred_anonymous_type_member_names = true:suggestion
dotnet_style_prefer_auto_properties = true:suggestion
dotnet_style_prefer_conditional_expression_over_assignment = true:suggestion
dotnet_style_prefer_conditional_expression_over_return = true:suggestion
dotnet_style_prefer_simplified_boolean_expressions = true:suggestion
dotnet_style_prefer_compound_assignment = true:suggestion
dotnet_style_prefer_simplified_interpolation = true:suggestion

# var preferences
csharp_style_var_for_built_in_types = false:suggestion
csharp_style_var_when_type_is_apparent = true:suggestion
csharp_style_var_elsewhere = false:suggestion

# Expression-bodied members
csharp_style_expression_bodied_methods = when_on_single_line:suggestion
csharp_style_expression_bodied_constructors = false:suggestion
csharp_style_expression_bodied_operators = when_on_single_line:suggestion
csharp_style_expression_bodied_properties = true:suggestion
csharp_style_expression_bodied_indexers = true:suggestion
csharp_style_expression_bodied_accessors = true:suggestion
csharp_style_expression_bodied_lambdas = true:suggestion
csharp_style_expression_bodied_local_functions = when_on_single_line:suggestion

# Pattern matching preferences
csharp_style_pattern_matching_over_is_with_cast_check = true:suggestion
csharp_style_pattern_matching_over_as_with_null_check = true:suggestion
csharp_style_prefer_switch_expression = true:suggestion
csharp_style_prefer_pattern_matching = true:suggestion
csharp_style_prefer_not_pattern = true:suggestion

# Null-checking preferences
csharp_style_throw_expression = true:suggestion
csharp_style_conditional_delegate_call = true:suggestion

# Code-block preferences
csharp_prefer_braces = true:suggestion
csharp_prefer_simple_using_statement = true:suggestion

# 'using' directive preferences
csharp_using_directive_placement = outside_namespace:suggestion

# File-scoped namespace
csharp_style_namespace_declarations = file_scoped:suggestion

# New line preferences
csharp_new_line_before_open_brace = all
csharp_new_line_before_else = true
csharp_new_line_before_catch = true
csharp_new_line_before_finally = true
csharp_new_line_before_members_in_object_initializers = true
csharp_new_line_before_members_in_anonymous_types = true
csharp_new_line_between_query_expression_clauses = true

# Indentation preferences
csharp_indent_case_contents = true
csharp_indent_switch_labels = true
csharp_indent_labels = one_less_than_current
csharp_indent_block_contents = true
csharp_indent_braces = false
csharp_indent_case_contents_when_block = false

# Space preferences
csharp_space_after_cast = false
csharp_space_after_keywords_in_control_flow_statements = true
csharp_space_between_parentheses = false
csharp_space_before_colon_in_inheritance_clause = true
csharp_space_after_colon_in_inheritance_clause = true
csharp_space_around_binary_operators = before_and_after
csharp_space_between_method_declaration_parameter_list_parentheses = false
csharp_space_between_method_declaration_empty_parameter_list_parentheses = false
csharp_space_between_method_declaration_name_and_open_parenthesis = false
csharp_space_between_method_call_parameter_list_parentheses = false
csharp_space_between_method_call_empty_parameter_list_parentheses = false
csharp_space_between_method_call_name_and_opening_parenthesis = false
csharp_space_after_comma = true
csharp_space_before_comma = false
csharp_space_after_dot = false
csharp_space_before_dot = false
csharp_space_after_semicolon_in_for_statement = true
csharp_space_before_semicolon_in_for_statement = false
csharp_space_around_declaration_statements = false
csharp_space_before_open_square_brackets = false
csharp_space_between_empty_square_brackets = false
csharp_space_between_square_brackets = false

# Wrapping preferences
csharp_preserve_single_line_statements = false
csharp_preserve_single_line_blocks = true

# Primary constructor preferences (.NET 8+)
csharp_style_prefer_primary_constructors = true:suggestion

# Naming conventions
dotnet_naming_rule.interface_should_be_begins_with_i.severity = suggestion
dotnet_naming_rule.interface_should_be_begins_with_i.symbols = interface
dotnet_naming_rule.interface_should_be_begins_with_i.style = begins_with_i

dotnet_naming_rule.types_should_be_pascal_case.severity = suggestion
dotnet_naming_rule.types_should_be_pascal_case.symbols = types
dotnet_naming_rule.types_should_be_pascal_case.style = pascal_case

dotnet_naming_rule.non_field_members_should_be_pascal_case.severity = suggestion
dotnet_naming_rule.non_field_members_should_be_pascal_case.symbols = non_field_members
dotnet_naming_rule.non_field_members_should_be_pascal_case.style = pascal_case

dotnet_naming_rule.private_fields_should_be_camel_case_with_underscore.severity = suggestion
dotnet_naming_rule.private_fields_should_be_camel_case_with_underscore.symbols = private_fields
dotnet_naming_rule.private_fields_should_be_camel_case_with_underscore.style = camel_case_with_underscore

dotnet_naming_symbols.interface.applicable_kinds = interface
dotnet_naming_symbols.interface.applicable_accessibilities = public, internal, private, protected, protected_internal, private_protected

dotnet_naming_symbols.types.applicable_kinds = class, struct, interface, enum
dotnet_naming_symbols.types.applicable_accessibilities = public, internal, private, protected, protected_internal, private_protected

dotnet_naming_symbols.non_field_members.applicable_kinds = property, event, method
dotnet_naming_symbols.non_field_members.applicable_accessibilities = public, internal, private, protected, protected_internal, private_protected

dotnet_naming_symbols.private_fields.applicable_kinds = field
dotnet_naming_symbols.private_fields.applicable_accessibilities = private

dotnet_naming_style.pascal_case.capitalization = pascal_case
dotnet_naming_style.begins_with_i.required_prefix = I
dotnet_naming_style.begins_with_i.capitalization = pascal_case
dotnet_naming_style.camel_case_with_underscore.required_prefix = _
dotnet_naming_style.camel_case_with_underscore.capitalization = camel_case

# Analyzer rules
dotnet_diagnostic.CA1848.severity = suggestion  # Use LoggerMessage for performance
dotnet_diagnostic.CA2007.severity = none        # Don't require ConfigureAwait (ASP.NET Core)
dotnet_diagnostic.CA1062.severity = none        # Null check handled by nullable reference types
dotnet_diagnostic.IDE0005.severity = warning    # Remove unnecessary usings
```

#### Directory.Build.props

```xml
<!-- server/csharp/src/Directory.Build.props -->
<Project>
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>false</TreatWarningsAsErrors>
    <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>
    <AnalysisLevel>latest-recommended</AnalysisLevel>
  </PropertyGroup>

  <PropertyGroup>
    <Authors>SyncKit Contributors</Authors>
    <Company>SyncKit</Company>
    <Product>SyncKit Server</Product>
    <Copyright>Copyright © 2024-2025 SyncKit Contributors</Copyright>
    <RepositoryUrl>https://github.com/synckit/synckit</RepositoryUrl>
    <RepositoryType>git</RepositoryType>
  </PropertyGroup>

  <ItemGroup>
    <!-- Enable code analysis -->
    <PackageReference Include="Microsoft.CodeAnalysis.NetAnalyzers" Version="9.*">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers</IncludeAssets>
    </PackageReference>
  </ItemGroup>
</Project>
```

#### Acceptance Criteria

- [ ] `.editorconfig` enforces consistent code style
- [ ] `Directory.Build.props` applies to all projects in solution
- [ ] Nullable reference types enabled
- [ ] Code analysis enabled with recommended rules
- [ ] IDE shows style violations as suggestions/warnings

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
      - 'server/csharp/src/**'
  pull_request:
    branches: [main]
    paths:
      - 'server/csharp/src/**'

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

- [ ] Workflow triggers on push/PR to server/csharp/src/**
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

1. Create server/csharp/src/README.md
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
