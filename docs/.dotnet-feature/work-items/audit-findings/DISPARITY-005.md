# DISPARITY-005: AwarenessUpdateMessage.State Type Should Be JsonElement

**Category:** Protocol  
**Priority:** P0 (Blocking)  
**Estimate:** 0.5h

---

## Files Affected

| Role | File Path |
|------|-----------|
| .NET (to fix) | `server/csharp/src/SyncKit.Server/WebSockets/Protocol/Messages/AwarenessUpdateMessage.cs` |
| TypeScript (reference) | `server/typescript/src/websocket/protocol.ts` |

---

## Current Behavior (.NET)

```csharp
public class AwarenessUpdateMessage : BaseMessage
{
    [JsonPropertyName("type")]
    public override MessageType Type => MessageType.AwarenessUpdate;

    [JsonPropertyName("documentId")]
    public required string DocumentId { get; set; }

    [JsonPropertyName("clientId")]
    public required string ClientId { get; set; }

    /// Awareness state (cursor position, selection, user info, etc.).
    /// Null means the client has left.
    [JsonPropertyName("state")]
    public Dictionary<string, object>? State { get; set; }  // ← Typed as Dictionary<string, object>

    [JsonPropertyName("clock")]
    public required long Clock { get; set; }
}
```

**Issue:** The `State` property is typed as `Dictionary<string, object>?`, but the TypeScript reference uses `Record<string, unknown> | null` which should be serialized as a generic JSON object, not a typed dictionary. This causes issues with nested objects and arrays.

---

## Expected Behavior (TypeScript Reference)

```typescript
export interface AwarenessUpdateMessage extends BaseMessage {
  type: MessageType.AWARENESS_UPDATE;
  documentId: string;
  clientId: string;
  state: Record<string, unknown> | null;  // ← Generic JSON object or null
  clock: number;
}
```

**Correct behavior:** The `state` field should be a generic JSON object (or null) that can contain any application-specific data structure.

---

## Disparity Details

| Aspect | TypeScript | .NET (Current) | Required Change |
|--------|------------|----------------|-----------------|
| state type | `Record<string, unknown> \| null` | `Dictionary<string, object>?` | Change to `JsonElement?` |
| state semantics | Generic JSON object | Typed dictionary | Should preserve arbitrary JSON structure |
| Null handling | `\| null` | `?` (nullable) | ✓ Correct |

---

## Suggested Fix

Change the `State` property to use `JsonElement?` to preserve arbitrary JSON structures:

```csharp
public class AwarenessUpdateMessage : BaseMessage
{
    [JsonPropertyName("type")]
    public override MessageType Type => MessageType.AwarenessUpdate;

    [JsonPropertyName("documentId")]
    public required string DocumentId { get; set; }

    [JsonPropertyName("clientId")]
    public required string ClientId { get; set; }

    /// <summary>
    /// Awareness state (cursor position, selection, user info, etc.).
    /// Can be any JSON-serializable object representing the client's presence state.
    /// Null means the client has left.
    /// </summary>
    [JsonPropertyName("state")]
    public JsonElement? State { get; set; }  // ← Changed from Dictionary<string, object>? to JsonElement?

    /// <summary>
    /// Logical clock for ordering awareness updates.
    /// </summary>
    [JsonPropertyName("clock")]
    public required long Clock { get; set; }
}
```

---

## Acceptance Criteria

- [ ] `State` property type changed from `Dictionary<string, object>?` to `JsonElement?`
- [ ] JSON serialization preserves arbitrary nested structures
- [ ] Null state correctly serializes as `null`
- [ ] Code compiles without errors
- [ ] Existing unit tests pass
- [ ] Integration tests pass with SDK clients

---

## Related

- **Audit Document:** [AUDIT-TYPESCRIPT-PARITY.md](../AUDIT-TYPESCRIPT-PARITY.md)
- **Related Disparities:** DISPARITY-006 (AwarenessStateMessage), DISPARITY-007 (AwarenessClientState)

---

**Status:** ⬜ Not Started
