# WI-B02: TestAuth Endpoint

**Owner:** Agent B (Platform)  
**Status:** Proposed  
**Milestone:** M0  
**Dependencies:** B01  
**Artifacts folder (recommended):** `../artifacts/WI-B02/`

## Goal
Implement the TestAuth endpoint for deterministic Playwright testing without external IdP.

## Scope
### In
- `POST /api/testauth/token` endpoint
- Header validation: `X-Test-Auth-Secret`, `X-Test-Role`
- JWT generation for Handler/Secretary roles
- Feature flag: `ENABLE_TEST_AUTH` (default false)
- 404 response when disabled
- Security logging of TestAuth usage

### Out
- Real JWT authentication (see B08)
- User provisioning (see B09)
- Database integration (see B03-B07)

## Implementation notes
- **Critical:** TestAuth is required for M0 Playwright tests
- When `ENABLE_TEST_AUTH=false`: return 404 (not 403)
- When enabled, require both headers:
  - `X-Test-Auth-Secret`: must match configured secret
  - `X-Test-Role`: `Handler` or `Secretary`
- Generate short-lived JWT (15 minutes)
- JWT claims: `sub`, `role`, `email` (test email)
- Log all TestAuth usage as security event (no PII)
- Same JWT validation as production auth

## Acceptance criteria
- [ ] When disabled, endpoint returns 404
- [ ] When enabled with wrong secret, returns 401
- [ ] When enabled with valid secret + role, returns JWT
- [ ] Generated JWT is accepted by auth middleware
- [ ] Security events are logged
- [ ] Token expires in 15 minutes

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- Endpoint returns 404 when disabled
- Endpoint returns 401 with wrong secret
- Endpoint returns JWT with valid request
- JWT contains correct claims

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B02/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Full token request/response cycle
- Token works with protected endpoint

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B02/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- loginAs('Handler') returns valid token
- loginAs('Secretary') returns valid token
- Token used in subsequent requests

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B02/playwright/testauth-trace.zip`

### DB verification
**Artifact requirements**
- N/A — no DB interaction

**Artifacts (add as relative links during work)**
- N/A

### Telemetry verification
- Verify security log events for TestAuth usage
- No PII in logs

**Artifact requirements**
- Log output showing security events

**Artifacts (add as relative links during work)**
- `../artifacts/WI-B02/telemetry/security-logs.txt`

## Risks / Questions
- Ensure TestAuth is NEVER enabled in production
- Consider IP allowlist as additional safety

## API Contract (from PRD)
```
POST /api/testauth/token
Headers:
  X-Test-Auth-Secret: <secret>
  X-Test-Role: Handler|Secretary
Response 200:
{
  "accessToken": "<jwt>",
  "expiresInSeconds": 900,
  "role": "Handler"
}
Response 404 (when disabled):
  (no body)
Response 401 (invalid secret):
  ProblemDetails
```

## Configuration
```json
// appsettings.json
{
  "TestAuth": {
    "Enabled": false,
    "Secret": "dev-only-secret-change-me",
    "SigningKey": "your-256-bit-secret-key-for-jwt-signing"
  }
}
```

## Environment Variables
```bash
ENABLE_TEST_AUTH=false          # Default
TEST_AUTH_SECRET=<secret>       # Required when enabled
TEST_AUTH_SIGNING_KEY=<key>     # For JWT signing
```

## Implementation Sketch
```csharp
app.MapPost("/api/testauth/token", async (
    HttpContext context,
    IOptions<TestAuthOptions> options,
    ILogger<TestAuthEndpoint> logger) =>
{
    if (!options.Value.Enabled)
    {
        return Results.NotFound();
    }

    var secret = context.Request.Headers["X-Test-Auth-Secret"].FirstOrDefault();
    var role = context.Request.Headers["X-Test-Role"].FirstOrDefault();

    if (secret != options.Value.Secret)
    {
        logger.LogWarning("TestAuth: Invalid secret attempt");
        return Results.Problem(
            title: "Unauthorized",
            statusCode: 401);
    }

    if (role is not ("Handler" or "Secretary"))
    {
        return Results.Problem(
            title: "Invalid role",
            detail: "X-Test-Role must be Handler or Secretary",
            statusCode: 400);
    }

    logger.LogInformation("TestAuth: Token issued for role {Role}", role);

    var token = GenerateTestJwt(role, options.Value);
    
    return Results.Ok(new
    {
        accessToken = token,
        expiresInSeconds = 900,
        role = role
    });
});
```
