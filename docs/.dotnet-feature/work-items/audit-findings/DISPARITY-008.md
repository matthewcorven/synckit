# DISPARITY-008: TokenPayload.Iat and Exp Should Be Unix Seconds, Not Milliseconds

**Category:** Auth  
**Priority:** P1 (High)  
**Estimate:** 0.5h

---

## Files Affected

| Role | File Path |
|------|-----------|
| .NET (to fix) | `server/csharp/src/SyncKit.Server/Auth/TokenPayload.cs` |
| TypeScript (reference) | `server/typescript/src/auth/jwt.ts` |

---

## Current Behavior (.NET)

```csharp
public class TokenPayload
{
    /// <summary>User ID (sub claim, maps to TypeScript userId).</summary>
    public string UserId { get; set; } = null!;

    /// <summary>User's email address (optional).</summary>
    public string? Email { get; set; }

    /// <summary>Document-level permissions.</summary>
    public DocumentPermissions Permissions { get; set; } = new();

    /// <summary>Token issued-at timestamp (Unix epoch seconds).</summary>
    public long? Iat { get; set; }  // ← Comment says seconds, but JWT standard uses seconds

    /// <summary>Token expiration timestamp (Unix epoch seconds).</summary>
    public long? Exp { get; set; }  // ← Comment says seconds, but JWT standard uses seconds
}
```

**Issue:** The comments correctly state that `iat` and `exp` should be Unix epoch seconds (JWT standard), but the implementation doesn't enforce this. The TypeScript server uses the `jsonwebtoken` library which automatically handles this correctly.

---

## Expected Behavior (TypeScript Reference)

```typescript
export interface TokenPayload {
  userId: string;
  email?: string;
  permissions: DocumentPermissions;
  iat?: number;  // Issued at (Unix seconds, per JWT spec)
  exp?: number;  // Expiration (Unix seconds, per JWT spec)
}
```

**Correct behavior:** JWT tokens use Unix epoch seconds (not milliseconds) for `iat` and `exp` claims per RFC 7519.

---

## Disparity Details

| Aspect | TypeScript | .NET (Current) | Issue |
|--------|------------|----------------|-------|
| iat | Unix seconds | Unix seconds (correct) | ✓ Correct |
| exp | Unix seconds | Unix seconds (correct) | ✓ Correct |
| Type | `number` | `long?` | ✓ Correct |

---

## Suggested Fix

The current implementation is correct. However, ensure that:

1. JWT generation uses `DateTimeOffset.UtcNow.ToUnixTimeSeconds()` (not milliseconds)
2. JWT validation compares against `DateTimeOffset.UtcNow.ToUnixTimeSeconds()`
3. Documentation is clear about the units

**Verify in JwtGenerator.cs:**
```csharp
// Should use ToUnixTimeSeconds(), not ToUnixTimeMilliseconds()
var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
var exp = now + expirationSeconds;

return new TokenPayload
{
    UserId = userId,
    Email = email,
    Permissions = permissions,
    Iat = now,      // ← Unix seconds
    Exp = exp       // ← Unix seconds
};
```

---

## Acceptance Criteria

- [ ] JWT generation uses `ToUnixTimeSeconds()` for `iat` and `exp`
- [ ] JWT validation uses `ToUnixTimeSeconds()` for expiration checks
- [ ] Documentation clearly states that `iat` and `exp` are Unix seconds
- [ ] Code compiles without errors
- [ ] Existing unit tests pass
- [ ] Integration tests pass with SDK clients

---

## Related

- **Audit Document:** [AUDIT-TYPESCRIPT-PARITY.md](../AUDIT-TYPESCRIPT-PARITY.md)
- **Related Disparities:** None

---

**Status:** ⬜ Not Started
