# WI-B09: User Provisioning

**Owner:** Agent B (Platform)  
**Status:** Proposed  
**Milestone:** M1  
**Dependencies:** B07, B08  
**Artifacts folder (recommended):** `../artifacts/WI-B09/`

## Goal
Implement automatic user provisioning on first authenticated request with secretary allowlist support.

## Scope
### In
- Auto-upsert user on authenticated request
- Extract user info from JWT claims
- Secretary email allowlist configuration
- Role determination logic
- Middleware or service for provisioning
- Update LastLoginAtUtc on each request

### Out
- JWT validation (see B08)
- Users entity (see B07)
- Entra External ID (see B27)

## Implementation notes
- MVP email claim extraction (from PRD):
  1. Prefer `preferred_username`
  2. Fallback to `email`
  3. Fallback to first value in `emails` array
- Secretary allowlist parsing:
  - Parse `SECRETARY_EMAIL_ALLOWLIST` as comma/semicolon/newline-separated
  - Case-insensitive matching
- Role determination:
  - If email in secretary allowlist → Secretary
  - Otherwise → Handler
- Auto-provision creates user record if not exists
- Update last login timestamp on each request

## Acceptance criteria
- [ ] First authenticated request creates user record
- [ ] Email extracted from correct claim
- [ ] Secretary allowlist determines role correctly
- [ ] Subsequent requests update LastLoginAtUtc
- [ ] User ID available in HttpContext for endpoints

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- Email claim extraction priority
- Secretary allowlist parsing
- Role determination logic

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B09/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- First request creates user
- Secretary email gets Secretary role
- Non-secretary gets Handler role
- Subsequent request updates timestamp

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B09/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- TestAuth Handler creates Handler user
- TestAuth Secretary creates Secretary user

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B09/playwright/user-provisioning-trace.zip`

### DB verification
**Artifact requirements**
- User record created with correct fields
- Role matches allowlist configuration

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B09/db/user-verification.txt`

### Telemetry verification
- User provisioning logged (no PII)

**Artifact requirements**
- Log sample showing provisioning event

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B09/telemetry/provisioning-logs.txt`

## Risks / Questions
- Claim names vary by IdP (ensure flexibility)
- Case sensitivity of email comparison

## Configuration
```json
// appsettings.json
{
  "UserProvisioning": {
    "SecretaryEmailAllowlist": "secretary@example.com,admin@example.com"
  }
}
```

## Environment Variable
```bash
SECRETARY_EMAIL_ALLOWLIST="secretary@club1.org;secretary@club2.org"
```

## Implementation
```csharp
public class UserProvisioningMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<UserProvisioningMiddleware> _logger;

    public async Task InvokeAsync(
        HttpContext context,
        IUserService userService,
        IOptions<UserProvisioningOptions> options)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var sub = context.User.FindFirst("sub")?.Value;
            var email = ExtractEmail(context.User);
            
            if (sub != null && email != null)
            {
                var role = DetermineRole(email, options.Value.SecretaryEmailAllowlist);
                var user = await userService.GetOrCreateUserAsync(sub, email, role);
                
                // Store in HttpContext for later use
                context.Items["UserId"] = user.UserId;
                context.Items["UserRole"] = user.Role;
            }
        }
        
        await _next(context);
    }
    
    private string? ExtractEmail(ClaimsPrincipal principal)
    {
        // Priority order per PRD
        return principal.FindFirst("preferred_username")?.Value
            ?? principal.FindFirst("email")?.Value
            ?? principal.FindFirst("emails")?.Value?.Split(',').FirstOrDefault();
    }
    
    private UserRole DetermineRole(string email, string? allowlist)
    {
        if (string.IsNullOrEmpty(allowlist))
            return UserRole.Handler;
            
        var secretaryEmails = allowlist
            .Split(new[] { ',', ';', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(e => e.Trim().ToLowerInvariant())
            .ToHashSet();
            
        return secretaryEmails.Contains(email.ToLowerInvariant())
            ? UserRole.Secretary
            : UserRole.Handler;
    }
}
```

## Extension Method for Easy Access
```csharp
public static class HttpContextUserExtensions
{
    public static Guid GetUserId(this HttpContext context)
    {
        return context.Items["UserId"] as Guid? 
            ?? throw new UnauthorizedAccessException("User not provisioned");
    }
    
    public static UserRole GetUserRole(this HttpContext context)
    {
        return context.Items["UserRole"] as UserRole? 
            ?? throw new UnauthorizedAccessException("User not provisioned");
    }
}

// Usage in endpoint
app.MapPost("/api/entries", (HttpContext context, CreateEntryRequest request) =>
{
    var userId = context.GetUserId();
    // ...
});
```
