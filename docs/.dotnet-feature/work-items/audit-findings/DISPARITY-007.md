# DISPARITY-007: AuthSuccessMessage.Permissions Type Should Be Generic

**Category:** Protocol  
**Priority:** P1 (High)  
**Estimate:** 0.5h

---

## Files Affected

| Role | File Path |
|------|-----------|
| .NET (to fix) | `server/csharp/src/SyncKit.Server/WebSockets/Protocol/Messages/AuthSuccessMessage.cs` |
| TypeScript (reference) | `server/typescript/src/websocket/protocol.ts` |

---

## Current Behavior (.NET)

```csharp
public class AuthSuccessMessage : BaseMessage
{
    [JsonPropertyName("type")]
    public override MessageType Type => MessageType.AuthSuccess;

    [JsonPropertyName("userId")]
    public required string UserId { get; set; }

    [JsonPropertyName("permissions")]
    public required Dictionary<string, object> Permissions { get; set; }  // ← Typed dictionary
}
```

**Issue:** The `Permissions` property is typed as `Dictionary<string, object>`, but the TypeScript reference uses `Record<string, any>` which should be a generic JSON object. This is less flexible for future permission structures.

---

## Expected Behavior (TypeScript Reference)

```typescript
export interface AuthSuccessMessage extends BaseMessage {
  type: MessageType.AUTH_SUCCESS;
  userId: string;
  permissions: Record<string, any>;  // ← Generic JSON object
}
```

**Correct behavior:** The `permissions` field should be a generic JSON object that can contain any permission structure.

---

## Disparity Details

| Aspect | TypeScript | .NET (Current) | Issue |
|--------|------------|----------------|-------|
| permissions | `Record<string, any>` | `Dictionary<string, object>` | Type mismatch: should be more generic |

---

## Suggested Fix

Change the `Permissions` property to use `JsonElement` or `object` for maximum flexibility:

```csharp
public class AuthSuccessMessage : BaseMessage
{
    [JsonPropertyName("type")]
    public override MessageType Type => MessageType.AuthSuccess;

    /// <summary>
    /// Authenticated user ID.
    /// </summary>
    [JsonPropertyName("userId")]
    public required string UserId { get; set; }

    /// <summary>
    /// User permissions (document access, roles, etc.).
    /// Can be any JSON-serializable object representing the user's permissions.
    /// </summary>
    [JsonPropertyName("permissions")]
    public required object Permissions { get; set; }  // ← Changed from Dictionary<string, object> to object
}
```

**Or use JsonElement for more control:**
```csharp
[JsonPropertyName("permissions")]
public required JsonElement Permissions { get; set; }
```

---

## Acceptance Criteria

- [ ] `Permissions` property type changed to `object` or `JsonElement`
- [ ] JSON serialization preserves arbitrary permission structures
- [ ] Code compiles without errors
- [ ] Existing unit tests pass
- [ ] Integration tests pass with SDK clients

---

## Related

- **Audit Document:** [AUDIT-TYPESCRIPT-PARITY.md](../AUDIT-TYPESCRIPT-PARITY.md)
- **Related Disparities:** DISPARITY-005 (AwarenessUpdateMessage), DISPARITY-006 (AwarenessStateMessage)

---

**Status:** ⬜ Not Started
