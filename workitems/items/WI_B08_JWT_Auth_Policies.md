# WI-B08: JWT Auth Policies

**Owner:** Agent B (Platform)  
**Status:** Proposed  
**Milestone:** M1  
**Dependencies:** B07  
**Artifacts folder (recommended):** `../artifacts/WI-B08/`

## Goal
Configure JWT bearer authentication with role-based authorization policies.

## Scope
### In
- JWT bearer authentication setup
- Role extraction from token claims
- Authorization policies: Handler, Secretary
- Token validation parameters
- Support for both TestAuth and production tokens
- Claim transformation if needed

### Out
- TestAuth endpoint (see B02)
- User provisioning (see B09)
- Entra External ID setup (see B27)

## Implementation notes
- Both TestAuth tokens and production IdP tokens use same validation
- Role claim location may vary (configure claim type)
- Policies:
  - `Handler` - requires Handler role
  - `Secretary` - requires Secretary role
- Token validation:
  - Issuer validation
  - Audience validation
  - Signature validation
  - Expiration check

## Acceptance criteria
- [ ] JWT authentication configured
- [ ] Handler policy works
- [ ] Secretary policy works
- [ ] Invalid tokens return 401
- [ ] Missing role returns 403
- [ ] Both TestAuth and production tokens work

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- Policy evaluation tests
- Token validation tests

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B08/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Request with valid Handler token succeeds
- Request with valid Secretary token succeeds
- Request with expired token fails
- Request with wrong role fails

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B08/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- TestAuth token works with protected endpoint

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B08/playwright/auth-policy-trace.zip`

### DB verification
**Artifact requirements**
- N/A

**Artifacts (add as relative links during work)**
- N/A

### Telemetry verification
- Auth failures logged appropriately

**Artifact requirements**
- Log sample showing auth events

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B08/telemetry/auth-logs.txt`

## Risks / Questions
- Claim type for roles (standard vs custom)
- Multiple valid issuers (TestAuth + production)

## Configuration
```json
// appsettings.json
{
  "Authentication": {
    "Authority": "https://login.example.com",
    "Audience": "api://dog-trials",
    "ValidIssuers": [
      "https://login.example.com",
      "test-auth"
    ]
  }
}
```

## Implementation
```csharp
// Program.cs
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = builder.Configuration["Authentication:Authority"];
        options.Audience = builder.Configuration["Authentication:Audience"];
        
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuers = builder.Configuration
                .GetSection("Authentication:ValidIssuers")
                .Get<string[]>(),
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Authentication:Audience"],
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(5)
        };
        
        // For TestAuth tokens with symmetric key
        if (builder.Configuration.GetValue<bool>("TestAuth:Enabled"))
        {
            var key = builder.Configuration["TestAuth:SigningKey"];
            options.TokenValidationParameters.IssuerSigningKey = 
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key!));
        }
    });

builder.Services.AddAuthorizationBuilder()
    .AddPolicy("Handler", policy =>
        policy.RequireRole("Handler", "Secretary")) // Secretary can do Handler things
    .AddPolicy("Secretary", policy =>
        policy.RequireRole("Secretary"));
```

## Role Claim Handling
```csharp
// If role claim is in non-standard location
builder.Services.AddSingleton<IClaimsTransformation, RoleClaimsTransformation>();

public class RoleClaimsTransformation : IClaimsTransformation
{
    public Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        var identity = principal.Identity as ClaimsIdentity;
        
        // Map custom role claim to standard role
        var roleClaim = principal.FindFirst("custom_role") 
            ?? principal.FindFirst("roles");
            
        if (roleClaim != null && identity != null)
        {
            identity.AddClaim(new Claim(ClaimTypes.Role, roleClaim.Value));
        }
        
        return Task.FromResult(principal);
    }
}
```

## Endpoint Protection Example
```csharp
// Handler-only endpoint
app.MapGet("/api/entries/{entryId}", GetEntry)
    .RequireAuthorization("Handler");

// Secretary-only endpoint
app.MapGet("/api/secretary/entries", GetSecretaryEntries)
    .RequireAuthorization("Secretary");
```
