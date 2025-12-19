# Phase 3: Authentication & Authorization - Detailed Work Items

**Phase Duration:** 1.5 weeks (Weeks 5-6)  
**Phase Goal:** JWT authentication with RBAC permissions

---

## Work Item Details

### A3-01: Create JWT Validator Service

**Priority:** P0  
**Estimate:** 6 hours  
**Dependencies:** P2-02

#### Description

Create a service to validate JWT tokens using the same algorithm as the TypeScript server (HS256 with shared secret).

#### Tasks

1. Create `IJwtValidator.cs` interface
2. Create `JwtValidator.cs` implementation
3. Support HS256 algorithm
4. Validate token claims (iss, aud, exp, iat)
5. Extract permissions from token

#### Token Structure

```csharp
public class TokenPayload
{
    public string Sub { get; set; } = null!;    // User ID
    public string ClientId { get; set; } = null!;
    public string Iss { get; set; } = null!;     // Issuer
    public string Aud { get; set; } = null!;     // Audience
    public long Exp { get; set; }                // Expiration (Unix)
    public long Iat { get; set; }                // Issued at (Unix)
    public string[] Permissions { get; set; } = Array.Empty<string>();
}
```

#### Implementation

```csharp
// SyncKit.Server/Auth/IJwtValidator.cs
public interface IJwtValidator
{
    TokenPayload? Validate(string token);
    bool IsExpired(TokenPayload payload);
}

// SyncKit.Server/Auth/JwtValidator.cs
public class JwtValidator : IJwtValidator
{
    private readonly ILogger<JwtValidator> _logger;
    private readonly byte[] _secretBytes;
    private readonly string? _issuer;
    private readonly string? _audience;

    public JwtValidator(IOptions<SyncKitConfig> config, ILogger<JwtValidator> logger)
    {
        _logger = logger;
        var jwtConfig = config.Value.Auth.Jwt;
        _secretBytes = Encoding.UTF8.GetBytes(jwtConfig.Secret);
        _issuer = jwtConfig.Issuer;
        _audience = jwtConfig.Audience;
    }

    public TokenPayload? Validate(string token)
    {
        try
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var validationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(_secretBytes),
                ValidateIssuer = !string.IsNullOrEmpty(_issuer),
                ValidIssuer = _issuer,
                ValidateAudience = !string.IsNullOrEmpty(_audience),
                ValidAudience = _audience,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            };

            var principal = tokenHandler.ValidateToken(token, validationParameters, out var validatedToken);

            if (validatedToken is not JwtSecurityToken jwt)
            {
                return null;
            }

            return new TokenPayload
            {
                Sub = jwt.Subject ?? jwt.Claims.FirstOrDefault(c => c.Type == "sub")?.Value ?? "",
                ClientId = jwt.Claims.FirstOrDefault(c => c.Type == "clientId")?.Value ?? "",
                Iss = jwt.Issuer,
                Aud = jwt.Audiences.FirstOrDefault() ?? "",
                Exp = long.Parse(jwt.Claims.First(c => c.Type == "exp").Value),
                Iat = long.Parse(jwt.Claims.First(c => c.Type == "iat").Value),
                Permissions = jwt.Claims
                    .Where(c => c.Type == "permissions" || c.Type == "scope")
                    .SelectMany(c => c.Value.Split(' ', StringSplitOptions.RemoveEmptyEntries))
                    .ToArray()
            };
        }
        catch (SecurityTokenException ex)
        {
            _logger.LogWarning("Token validation failed: {Error}", ex.Message);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error validating token");
            return null;
        }
    }

    public bool IsExpired(TokenPayload payload)
    {
        var expiration = DateTimeOffset.FromUnixTimeSeconds(payload.Exp);
        return expiration <= DateTimeOffset.UtcNow;
    }
}
```

#### Acceptance Criteria

- [ ] Valid tokens return TokenPayload
- [ ] Invalid tokens return null
- [ ] Expired tokens rejected
- [ ] Issuer validated when configured
- [ ] Audience validated when configured
- [ ] Permissions extracted correctly

---

### A3-02: Create API Key Validator Service

**Priority:** P0  
**Estimate:** 3 hours  
**Dependencies:** F1-02

#### Description

Create a service to validate API keys as an alternative authentication method.

#### Tasks

1. Create `IApiKeyValidator.cs` interface
2. Create `ApiKeyValidator.cs` implementation
3. Support multiple valid keys
4. Return synthetic TokenPayload for authorized keys

#### Implementation

```csharp
// SyncKit.Server/Auth/IApiKeyValidator.cs
public interface IApiKeyValidator
{
    TokenPayload? Validate(string apiKey);
}

// SyncKit.Server/Auth/ApiKeyValidator.cs
public class ApiKeyValidator : IApiKeyValidator
{
    private readonly HashSet<string> _validKeys;
    private readonly ILogger<ApiKeyValidator> _logger;

    public ApiKeyValidator(IOptions<SyncKitConfig> config, ILogger<ApiKeyValidator> logger)
    {
        _logger = logger;
        var keys = config.Value.Auth.ApiKeys ?? Array.Empty<string>();
        _validKeys = keys.ToHashSet();
        
        if (_validKeys.Count == 0)
        {
            _logger.LogWarning("No API keys configured - API key auth disabled");
        }
    }

    public TokenPayload? Validate(string apiKey)
    {
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return null;
        }

        if (!_validKeys.Contains(apiKey))
        {
            _logger.LogWarning("Invalid API key attempted");
            return null;
        }

        // API keys get full permissions
        return new TokenPayload
        {
            Sub = "api-key-user",
            ClientId = apiKey[..8], // Use first 8 chars as client ID
            Iss = "synckit-server",
            Aud = "synckit-api",
            Exp = DateTimeOffset.UtcNow.AddYears(1).ToUnixTimeSeconds(),
            Iat = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
            Permissions = new[] 
            { 
                "document:read", 
                "document:write", 
                "awareness:read", 
                "awareness:write" 
            }
        };
    }
}
```

#### Acceptance Criteria

- [ ] Valid API keys return TokenPayload
- [ ] Invalid API keys return null
- [ ] Multiple API keys supported
- [ ] Full permissions granted

---

### A3-03: Implement Auth Message Handler

**Priority:** P0  
**Estimate:** 4 hours  
**Dependencies:** A3-01, A3-02, P2-03

#### Description

Handle AUTH messages and transition connections to authenticated state.

#### Tasks

1. Create `IMessageHandler.cs` interface
2. Create `AuthMessageHandler.cs`
3. Wire into Connection message routing
4. Send AUTH_SUCCESS or AUTH_ERROR response

#### Implementation

```csharp
// SyncKit.Server/WebSocket/Handlers/IMessageHandler.cs
public interface IMessageHandler
{
    MessageType[] HandledTypes { get; }
    Task HandleAsync(Connection connection, IMessage message);
}

// SyncKit.Server/WebSocket/Handlers/AuthMessageHandler.cs
public class AuthMessageHandler : IMessageHandler
{
    private readonly IJwtValidator _jwtValidator;
    private readonly IApiKeyValidator _apiKeyValidator;
    private readonly ILogger<AuthMessageHandler> _logger;

    public MessageType[] HandledTypes => new[] { MessageType.Auth };

    public AuthMessageHandler(
        IJwtValidator jwtValidator,
        IApiKeyValidator apiKeyValidator,
        ILogger<AuthMessageHandler> logger)
    {
        _jwtValidator = jwtValidator;
        _apiKeyValidator = apiKeyValidator;
        _logger = logger;
    }

    public async Task HandleAsync(Connection connection, IMessage message)
    {
        if (message is not AuthMessage auth)
        {
            return;
        }

        _logger.LogDebug("Processing auth for connection {ConnectionId}", connection.Id);

        TokenPayload? payload = null;

        // Try JWT first
        if (!string.IsNullOrEmpty(auth.Token))
        {
            payload = _jwtValidator.Validate(auth.Token);
        }
        // Fall back to API key
        else if (!string.IsNullOrEmpty(auth.ApiKey))
        {
            payload = _apiKeyValidator.Validate(auth.ApiKey);
        }

        if (payload == null)
        {
            _logger.LogWarning("Auth failed for connection {ConnectionId}", connection.Id);
            
            await connection.SendAsync(new AuthErrorMessage
            {
                Id = MessageIdGenerator.Generate(),
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                Error = "Authentication failed"
            });
            
            await connection.CloseAsync(
                WebSocketCloseStatus.PolicyViolation, 
                "Authentication failed");
            return;
        }

        // Store auth info on connection
        connection.UserId = payload.Sub;
        connection.ClientId = payload.ClientId;
        connection.TokenPayload = payload;
        connection.State = ConnectionState.Authenticated;

        _logger.LogInformation(
            "Connection {ConnectionId} authenticated as user {UserId}",
            connection.Id, payload.Sub);

        await connection.SendAsync(new AuthSuccessMessage
        {
            Id = MessageIdGenerator.Generate(),
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            UserId = payload.Sub,
            Permissions = payload.Permissions
        });
    }
}
```

#### Acceptance Criteria

- [ ] JWT auth works
- [ ] API key auth works
- [ ] AUTH_SUCCESS sent on success
- [ ] AUTH_ERROR sent on failure
- [ ] Connection closed on auth failure
- [ ] User ID set on connection

---

### A3-04: Implement Permission Checking

**Priority:** P0  
**Estimate:** 3 hours  
**Dependencies:** A3-03

#### Description

Create a permission service to check if authenticated users can perform operations.

#### Permission Patterns

| Permission | Description |
|------------|-------------|
| `document:read` | Can subscribe to documents |
| `document:write` | Can send deltas |
| `document:*:read` | Read access to all documents |
| `document:{id}:write` | Write access to specific document |
| `awareness:read` | Can receive awareness updates |
| `awareness:write` | Can send awareness updates |

#### Implementation

```csharp
// SyncKit.Server/Auth/IPermissionChecker.cs
public interface IPermissionChecker
{
    bool CanRead(TokenPayload payload, string documentId);
    bool CanWrite(TokenPayload payload, string documentId);
    bool CanAccessAwareness(TokenPayload payload);
    bool HasPermission(TokenPayload payload, string permission);
}

// SyncKit.Server/Auth/PermissionChecker.cs
public class PermissionChecker : IPermissionChecker
{
    public bool CanRead(TokenPayload payload, string documentId)
    {
        return HasDocumentPermission(payload, documentId, "read");
    }

    public bool CanWrite(TokenPayload payload, string documentId)
    {
        return HasDocumentPermission(payload, documentId, "write");
    }

    public bool CanAccessAwareness(TokenPayload payload)
    {
        return HasPermission(payload, "awareness:read") ||
               HasPermission(payload, "awareness:write") ||
               HasPermission(payload, "awareness:*");
    }

    public bool HasPermission(TokenPayload payload, string permission)
    {
        if (payload.Permissions == null || payload.Permissions.Length == 0)
        {
            return false;
        }

        // Check exact match
        if (payload.Permissions.Contains(permission))
        {
            return true;
        }

        // Check wildcard patterns
        var parts = permission.Split(':');
        for (int i = parts.Length; i > 0; i--)
        {
            var wildcardPermission = string.Join(':', parts.Take(i - 1).Append("*"));
            if (payload.Permissions.Contains(wildcardPermission))
            {
                return true;
            }
        }

        return false;
    }

    private bool HasDocumentPermission(TokenPayload payload, string documentId, string action)
    {
        // Check specific document permission
        if (HasPermission(payload, $"document:{documentId}:{action}"))
        {
            return true;
        }

        // Check general document permission
        if (HasPermission(payload, $"document:{action}"))
        {
            return true;
        }

        // Check wildcard
        if (HasPermission(payload, "document:*"))
        {
            return true;
        }

        return false;
    }
}
```

#### Acceptance Criteria

- [ ] Exact permission matching works
- [ ] Wildcard permission matching works
- [ ] Document-specific permissions work
- [ ] Awareness permissions checked

---

### A3-05: Add Auth Timeout

**Priority:** P1  
**Estimate:** 2 hours  
**Dependencies:** A3-03

#### Description

Enforce authentication timeout - connections must authenticate within configured time or be terminated.

#### Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `AUTH_TIMEOUT_MS` | 30000 | Time allowed for auth |

#### Implementation

```csharp
// In Connection class - add to constructor
public Connection(/* ... */)
{
    // ... existing code ...
    
    // Start auth timeout
    _authTimeoutCts = new CancellationTokenSource();
    _ = EnforceAuthTimeoutAsync(_authTimeoutCts.Token);
}

private CancellationTokenSource? _authTimeoutCts;

private async Task EnforceAuthTimeoutAsync(CancellationToken ct)
{
    try
    {
        await Task.Delay(_config.AuthTimeoutMs, ct);
        
        if (State != ConnectionState.Authenticated)
        {
            _logger.LogWarning(
                "Connection {ConnectionId} auth timeout - terminating",
                Id);
            await CloseAsync(
                WebSocketCloseStatus.PolicyViolation,
                "Authentication timeout");
        }
    }
    catch (OperationCanceledException)
    {
        // Auth completed in time, ignore
    }
}

// Cancel timeout when auth succeeds
public void OnAuthenticated()
{
    _authTimeoutCts?.Cancel();
    _authTimeoutCts = null;
}
```

#### Acceptance Criteria

- [ ] Unauthenticated connections terminated after timeout
- [ ] Authenticated connections not affected
- [ ] Timeout configurable via environment
- [ ] Clean cancellation on successful auth

---

### A3-06: Enforce Auth on All Operations

**Priority:** P0  
**Estimate:** 3 hours  
**Dependencies:** A3-04

#### Description

Create middleware/guard that ensures authentication before processing non-auth messages.

#### Tasks

1. Create auth guard
2. Apply to subscribe operations
3. Apply to delta operations
4. Apply to awareness operations
5. Return proper error responses

#### Implementation

```csharp
// SyncKit.Server/WebSocket/AuthGuard.cs
public class AuthGuard
{
    private readonly IPermissionChecker _permissionChecker;
    private readonly ILogger<AuthGuard> _logger;

    public AuthGuard(
        IPermissionChecker permissionChecker, 
        ILogger<AuthGuard> logger)
    {
        _permissionChecker = permissionChecker;
        _logger = logger;
    }

    public async Task<bool> RequireAuthAsync(Connection connection)
    {
        if (connection.State != ConnectionState.Authenticated || 
            connection.TokenPayload == null)
        {
            _logger.LogWarning(
                "Unauthorized request from connection {ConnectionId}",
                connection.Id);
            
            await connection.SendErrorAsync("Not authenticated");
            return false;
        }
        return true;
    }

    public async Task<bool> RequireReadAsync(Connection connection, string documentId)
    {
        if (!await RequireAuthAsync(connection)) return false;

        if (!_permissionChecker.CanRead(connection.TokenPayload!, documentId))
        {
            _logger.LogWarning(
                "Connection {ConnectionId} denied read access to {DocumentId}",
                connection.Id, documentId);
            
            await connection.SendErrorAsync("Read access denied", new { documentId });
            return false;
        }
        return true;
    }

    public async Task<bool> RequireWriteAsync(Connection connection, string documentId)
    {
        if (!await RequireAuthAsync(connection)) return false;

        if (!_permissionChecker.CanWrite(connection.TokenPayload!, documentId))
        {
            _logger.LogWarning(
                "Connection {ConnectionId} denied write access to {DocumentId}",
                connection.Id, documentId);
            
            await connection.SendErrorAsync("Write access denied", new { documentId });
            return false;
        }
        return true;
    }

    public async Task<bool> RequireAwarenessAsync(Connection connection)
    {
        if (!await RequireAuthAsync(connection)) return false;

        if (!_permissionChecker.CanAccessAwareness(connection.TokenPayload!))
        {
            await connection.SendErrorAsync("Awareness access denied");
            return false;
        }
        return true;
    }
}
```

#### Usage in Handlers

```csharp
public class SubscribeMessageHandler : IMessageHandler
{
    private readonly AuthGuard _authGuard;
    
    public async Task HandleAsync(Connection connection, IMessage message)
    {
        var subscribe = (SubscribeMessage)message;
        
        if (!await _authGuard.RequireReadAsync(connection, subscribe.DocumentId))
        {
            return;
        }
        
        // Process subscription...
    }
}
```

#### Acceptance Criteria

- [ ] Non-auth messages require authentication
- [ ] Subscribe requires read permission
- [ ] Delta requires write permission
- [ ] Awareness requires awareness permission
- [ ] Proper error messages sent

---

### A3-07: Auth Unit Tests

**Priority:** P0  
**Estimate:** 4 hours  
**Dependencies:** A3-01 through A3-06

#### Description

Comprehensive unit tests for authentication and authorization.

#### Test Categories

1. JWT Validation Tests
2. API Key Validation Tests
3. Permission Checking Tests
4. Auth Handler Tests
5. Auth Guard Tests

#### Test Examples

```csharp
public class JwtValidatorTests
{
    private readonly JwtValidator _validator;
    private const string TestSecret = "test-secret-at-least-32-characters";

    public JwtValidatorTests()
    {
        var config = Options.Create(new SyncKitConfig
        {
            Auth = new AuthConfig
            {
                Jwt = new JwtConfig { Secret = TestSecret }
            }
        });
        _validator = new JwtValidator(config, NullLogger<JwtValidator>.Instance);
    }

    [Fact]
    public void Validate_ValidToken_ReturnsPayload()
    {
        var token = CreateTestToken(DateTime.UtcNow.AddHours(1));
        
        var payload = _validator.Validate(token);
        
        Assert.NotNull(payload);
        Assert.Equal("test-user", payload.Sub);
    }

    [Fact]
    public void Validate_ExpiredToken_ReturnsNull()
    {
        var token = CreateTestToken(DateTime.UtcNow.AddHours(-1));
        
        var payload = _validator.Validate(token);
        
        Assert.Null(payload);
    }

    [Fact]
    public void Validate_InvalidSignature_ReturnsNull()
    {
        var token = CreateTestToken(DateTime.UtcNow.AddHours(1), "wrong-secret");
        
        var payload = _validator.Validate(token);
        
        Assert.Null(payload);
    }

    private string CreateTestToken(DateTime expiry, string? secret = null)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(secret ?? TestSecret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: "test-issuer",
            audience: "test-audience",
            claims: new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, "test-user"),
                new Claim("clientId", "test-client"),
                new Claim("permissions", "document:read document:write")
            },
            expires: expiry,
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public class PermissionCheckerTests
{
    private readonly PermissionChecker _checker = new();

    [Theory]
    [InlineData("document:read", "doc-1", true)]
    [InlineData("document:*", "doc-1", true)]
    [InlineData("document:doc-1:read", "doc-1", true)]
    [InlineData("document:doc-2:read", "doc-1", false)]
    [InlineData("document:write", "doc-1", false)]
    public void CanRead_VariousPermissions_CorrectResult(
        string permission, string documentId, bool expected)
    {
        var payload = new TokenPayload { Permissions = new[] { permission } };
        
        var result = _checker.CanRead(payload, documentId);
        
        Assert.Equal(expected, result);
    }

    [Fact]
    public void HasPermission_WildcardMatch_ReturnsTrue()
    {
        var payload = new TokenPayload { Permissions = new[] { "document:*" } };
        
        Assert.True(_checker.HasPermission(payload, "document:doc-1:read"));
        Assert.True(_checker.HasPermission(payload, "document:doc-1:write"));
    }
}

public class AuthMessageHandlerTests
{
    [Fact]
    public async Task HandleAsync_ValidToken_SendsAuthSuccess()
    {
        var handler = CreateHandler();
        var connection = CreateMockConnection();
        var message = new AuthMessage
        {
            Id = "msg-1",
            Timestamp = 1234567890,
            Token = CreateValidToken()
        };

        await handler.HandleAsync(connection, message);

        Assert.Equal(ConnectionState.Authenticated, connection.State);
        // Verify AUTH_SUCCESS was sent
    }

    [Fact]
    public async Task HandleAsync_InvalidToken_SendsAuthErrorAndCloses()
    {
        var handler = CreateHandler();
        var connection = CreateMockConnection();
        var message = new AuthMessage
        {
            Id = "msg-1",
            Timestamp = 1234567890,
            Token = "invalid-token"
        };

        await handler.HandleAsync(connection, message);

        Assert.Equal(ConnectionState.Disconnected, connection.State);
        // Verify AUTH_ERROR was sent
        // Verify connection was closed
    }
}
```

#### Acceptance Criteria

- [ ] JWT validation fully tested
- [ ] API key validation tested
- [ ] Permission patterns tested
- [ ] Auth handler flow tested
- [ ] Auth guard enforcement tested
- [ ] Edge cases covered (empty token, malformed, etc.)

---

### A3-08: Implement JWT Generation Service

**Priority:** P0  
**Estimate:** 4 hours  
**Dependencies:** A3-01

#### Description

Create a service to generate JWT tokens for the `/auth/login` endpoint. Must match TypeScript server token generation.

#### Tasks

1. Create `IJwtGenerator.cs` interface
2. Create `JwtGenerator.cs` implementation
3. Generate access tokens (24h default)
4. Generate refresh tokens (7d default)
5. Include permissions in token claims

#### Interface

```csharp
// SyncKit.Server/Auth/IJwtGenerator.cs
public interface IJwtGenerator
{
    string GenerateAccessToken(string userId, string clientId, string[] permissions);
    string GenerateRefreshToken(string userId);
    (string AccessToken, string RefreshToken) GenerateTokenPair(
        string userId, 
        string clientId, 
        string[] permissions);
}
```

#### Implementation

```csharp
// SyncKit.Server/Auth/JwtGenerator.cs
public class JwtGenerator : IJwtGenerator
{
    private readonly byte[] _secretBytes;
    private readonly string _issuer;
    private readonly string _audience;
    private readonly TimeSpan _accessTokenExpiry;
    private readonly TimeSpan _refreshTokenExpiry;

    public JwtGenerator(IOptions<SyncKitConfig> config)
    {
        var jwtConfig = config.Value.Auth.Jwt;
        _secretBytes = Encoding.UTF8.GetBytes(jwtConfig.Secret);
        _issuer = jwtConfig.Issuer ?? "synckit-server";
        _audience = jwtConfig.Audience ?? "synckit-client";
        _accessTokenExpiry = ParseDuration(jwtConfig.ExpiresIn ?? "24h");
        _refreshTokenExpiry = ParseDuration(jwtConfig.RefreshExpiresIn ?? "7d");
    }

    public string GenerateAccessToken(string userId, string clientId, string[] permissions)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId),
            new("clientId", clientId),
            new("permissions", string.Join(" ", permissions))
        };

        var key = new SymmetricSecurityKey(_secretBytes);
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _issuer,
            audience: _audience,
            claims: claims,
            expires: DateTime.UtcNow.Add(_accessTokenExpiry),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateRefreshToken(string userId)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId),
            new("type", "refresh")
        };

        var key = new SymmetricSecurityKey(_secretBytes);
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _issuer,
            audience: _audience,
            claims: claims,
            expires: DateTime.UtcNow.Add(_refreshTokenExpiry),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public (string AccessToken, string RefreshToken) GenerateTokenPair(
        string userId, string clientId, string[] permissions)
    {
        return (
            GenerateAccessToken(userId, clientId, permissions),
            GenerateRefreshToken(userId)
        );
    }

    private static TimeSpan ParseDuration(string duration)
    {
        // Parse "24h", "7d", "30m" format
        var value = int.Parse(duration[..^1]);
        return duration[^1] switch
        {
            'h' => TimeSpan.FromHours(value),
            'd' => TimeSpan.FromDays(value),
            'm' => TimeSpan.FromMinutes(value),
            's' => TimeSpan.FromSeconds(value),
            _ => TimeSpan.FromHours(24)
        };
    }
}
```

#### Acceptance Criteria

- [ ] Access tokens generated with correct claims
- [ ] Refresh tokens generated with extended expiry
- [ ] Tokens pass validation by JwtValidator
- [ ] Expiry times configurable

---

### A3-09: Implement AuthController (REST Endpoints)

**Priority:** P0  
**Estimate:** 6 hours  
**Dependencies:** A3-01, A3-02, A3-08

#### Description

Implement REST authentication endpoints matching the TypeScript server.

#### Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/login` | User login, returns tokens | No |
| POST | `/auth/refresh` | Refresh access token | Bearer (refresh token) |
| GET | `/auth/me` | Get current user info | Bearer |
| POST | `/auth/verify` | Verify token validity | No |

#### Implementation

```csharp
// SyncKit.Server/Controllers/AuthController.cs
[ApiController]
[Route("auth")]
public class AuthController : ControllerBase
{
    private readonly IJwtGenerator _jwtGenerator;
    private readonly IJwtValidator _jwtValidator;
    private readonly IApiKeyValidator _apiKeyValidator;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        IJwtGenerator jwtGenerator,
        IJwtValidator jwtValidator,
        IApiKeyValidator apiKeyValidator,
        ILogger<AuthController> logger)
    {
        _jwtGenerator = jwtGenerator;
        _jwtValidator = jwtValidator;
        _apiKeyValidator = apiKeyValidator;
        _logger = logger;
    }

    /// <summary>
    /// Login with credentials or API key
    /// </summary>
    [HttpPost("login")]
    public IActionResult Login([FromBody] LoginRequest request)
    {
        // For development/testing, accept any userId
        // In production, this would validate against a user store
        if (string.IsNullOrEmpty(request.UserId))
        {
            return BadRequest(new { error = "userId required" });
        }

        var clientId = request.ClientId ?? Guid.NewGuid().ToString("N")[..16];
        var permissions = request.Permissions ?? new[] { "document:read", "document:write" };

        var (accessToken, refreshToken) = _jwtGenerator.GenerateTokenPair(
            request.UserId, clientId, permissions);

        _logger.LogInformation("User {UserId} logged in", request.UserId);

        return Ok(new LoginResponse
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            UserId = request.UserId,
            ExpiresIn = 86400 // 24 hours in seconds
        });
    }

    /// <summary>
    /// Refresh access token using refresh token
    /// </summary>
    [HttpPost("refresh")]
    public IActionResult Refresh([FromBody] RefreshRequest request)
    {
        var payload = _jwtValidator.Validate(request.RefreshToken);
        if (payload == null)
        {
            return Unauthorized(new { error = "Invalid refresh token" });
        }

        // Generate new access token
        var accessToken = _jwtGenerator.GenerateAccessToken(
            payload.Sub, payload.ClientId, payload.Permissions);

        return Ok(new RefreshResponse
        {
            AccessToken = accessToken,
            ExpiresIn = 86400
        });
    }

    /// <summary>
    /// Get current user info from token
    /// </summary>
    [HttpGet("me")]
    [Authorize]
    public IActionResult Me()
    {
        var token = HttpContext.Request.Headers.Authorization
            .FirstOrDefault()?.Replace("Bearer ", "");

        if (string.IsNullOrEmpty(token))
        {
            return Unauthorized(new { error = "No token provided" });
        }

        var payload = _jwtValidator.Validate(token);
        if (payload == null)
        {
            return Unauthorized(new { error = "Invalid token" });
        }

        return Ok(new MeResponse
        {
            UserId = payload.Sub,
            ClientId = payload.ClientId,
            Permissions = payload.Permissions
        });
    }

    /// <summary>
    /// Verify if a token is valid
    /// </summary>
    [HttpPost("verify")]
    public IActionResult Verify([FromBody] VerifyRequest request)
    {
        var payload = _jwtValidator.Validate(request.Token);
        
        return Ok(new VerifyResponse
        {
            Valid = payload != null,
            UserId = payload?.Sub,
            ExpiresAt = payload?.Exp
        });
    }
}

// Request/Response DTOs
public record LoginRequest(string UserId, string? ClientId, string[]? Permissions);
public record LoginResponse(string AccessToken, string RefreshToken, string UserId, int ExpiresIn);
public record RefreshRequest(string RefreshToken);
public record RefreshResponse(string AccessToken, int ExpiresIn);
public record MeResponse(string UserId, string ClientId, string[] Permissions);
public record VerifyRequest(string Token);
public record VerifyResponse(bool Valid, string? UserId, long? ExpiresAt);
```

#### Acceptance Criteria

- [ ] `/auth/login` returns valid token pair
- [ ] `/auth/refresh` generates new access token
- [ ] `/auth/me` returns user info from token
- [ ] `/auth/verify` validates tokens correctly
- [ ] Error responses match TypeScript server format

---

## Phase 3 Summary

| ID | Title | Priority | Est (h) | Status |
|----|-------|----------|---------|--------|
| A3-01 | Create JWT validator service | P0 | 6 | ⬜ |
| A3-02 | Create API key validator service | P0 | 3 | ⬜ |
| A3-03 | Implement auth message handler | P0 | 4 | ⬜ |
| A3-04 | Implement permission checking | P0 | 3 | ⬜ |
| A3-05 | Add auth timeout | P1 | 2 | ⬜ |
| A3-06 | Enforce auth on all operations | P0 | 3 | ⬜ |
| A3-07 | Auth unit tests | P0 | 4 | ⬜ |
| A3-08 | Implement JWT generation service | P0 | 4 | ⬜ |
| A3-09 | Implement AuthController (REST) | P0 | 6 | ⬜ |
| **Total** | | | **35** | |

**Legend:** ⬜ Not Started | 🔄 In Progress | ✅ Complete

---

## Phase 3 Validation

After completing Phase 3, the following should work:

1. **REST Login Endpoint**
   ```bash
   curl -X POST http://localhost:8080/auth/login \
     -H "Content-Type: application/json" \
     -d '{"userId":"user-1","permissions":["document:read","document:write"]}'
   
   # Response:
   # {"accessToken":"eyJ...","refreshToken":"eyJ...","userId":"user-1","expiresIn":86400}
   ```

2. **JWT Authentication (WebSocket)**
   ```json
   > {"type":"auth","id":"1","timestamp":0,"token":"eyJ..."}
   < {"type":"auth_success","id":"2","timestamp":0,"userId":"user-1","permissions":["document:read"]}
   ```

3. **API Key Authentication**
   ```json
   > {"type":"auth","id":"1","timestamp":0,"apiKey":"sk_test_..."}
   < {"type":"auth_success","id":"2","timestamp":0,...}
   ```

4. **Permission Enforcement**
   ```json
   // Without auth:
   > {"type":"subscribe","id":"1","timestamp":0,"documentId":"doc-1"}
   < {"type":"error","id":"2","timestamp":0,"error":"Not authenticated"}
   
   // Without read permission:
   > {"type":"subscribe","id":"1","timestamp":0,"documentId":"doc-1"}
   < {"type":"error","id":"2","timestamp":0,"error":"Read access denied"}
   ```

5. **Auth Timeout**
   - Connect without sending auth message
   - Connection should close after 30 seconds
