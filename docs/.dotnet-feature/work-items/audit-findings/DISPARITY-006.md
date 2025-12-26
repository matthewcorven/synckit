# DISPARITY-006: AwarenessStateMessage.States Structure Mismatch

**Category:** Protocol  
**Priority:** P0 (Blocking)  
**Estimate:** 0.5h

---

## Files Affected

| Role | File Path |
|------|-----------|
| .NET (to fix) | `server/csharp/src/SyncKit.Server/WebSockets/Protocol/Messages/AwarenessStateMessage.cs` |
| TypeScript (reference) | `server/typescript/src/websocket/protocol.ts` |

---

## Current Behavior (.NET)

```csharp
public class AwarenessStateMessage : BaseMessage
{
    [JsonPropertyName("type")]
    public override MessageType Type => MessageType.AwarenessState;

    [JsonPropertyName("documentId")]
    public required string DocumentId { get; set; }

    [JsonPropertyName("states")]
    public required List<AwarenessClientState> States { get; set; }  // ← Custom class
}

public class AwarenessClientState
{
    [JsonPropertyName("clientId")]
    public required string ClientId { get; set; }

    [JsonPropertyName("state")]
    public required Dictionary<string, object> State { get; set; }  // ← Typed dictionary

    [JsonPropertyName("clock")]
    public required long Clock { get; set; }
}
```

**Issue:** The `AwarenessClientState` class uses `Dictionary<string, object>` for the state, which doesn't preserve arbitrary JSON structures. It should use `JsonElement` instead.

---

## Expected Behavior (TypeScript Reference)

```typescript
export interface AwarenessStateMessage extends BaseMessage {
  type: MessageType.AWARENESS_STATE;
  documentId: string;
  states: Array<{
    clientId: string;
    state: Record<string, unknown>;  // ← Generic JSON object
    clock: number;
  }>;
}
```

**Correct behavior:** The `state` field in each awareness entry should be a generic JSON object that can contain any application-specific data.

---

## Disparity Details

| Aspect | TypeScript | .NET (Current) | Required Change |
|--------|------------|----------------|-----------------|
| states[].state | `Record<string, unknown>` | `Dictionary<string, object>` | Change to `JsonElement` |
| states[].clock | `number` | `long` | ✓ Correct (long is 64-bit) |

---

## Suggested Fix

Change the `AwarenessClientState.State` property to use `JsonElement`:

```csharp
public class AwarenessStateMessage : BaseMessage
{
    [JsonPropertyName("type")]
    public override MessageType Type => MessageType.AwarenessState;

    [JsonPropertyName("documentId")]
    public required string DocumentId { get; set; }

    /// <summary>
    /// Current awareness states for all clients.
    /// </summary>
    [JsonPropertyName("states")]
    public required List<AwarenessClientState> States { get; set; }
}

/// <summary>
/// Individual client's awareness state.
/// </summary>
public class AwarenessClientState
{
    /// <summary>
    /// Client ID.
    /// </summary>
    [JsonPropertyName("clientId")]
    public required string ClientId { get; set; }

    /// <summary>
    /// Client's awareness state.
    /// Can be any JSON-serializable object representing the client's presence state.
    /// </summary>
    [JsonPropertyName("state")]
    public required JsonElement State { get; set; }  // ← Changed from Dictionary<string, object> to JsonElement

    /// <summary>
    /// Logical clock for this state.
    /// </summary>
    [JsonPropertyName("clock")]
    public required long Clock { get; set; }
}
```

---

## Acceptance Criteria

- [ ] `AwarenessClientState.State` type changed from `Dictionary<string, object>` to `JsonElement`
- [ ] JSON serialization preserves arbitrary nested structures
- [ ] Code compiles without errors
- [ ] Existing unit tests pass
- [ ] Integration tests pass with SDK clients

---

## Related

- **Audit Document:** [AUDIT-TYPESCRIPT-PARITY.md](../AUDIT-TYPESCRIPT-PARITY.md)
- **Related Disparities:** DISPARITY-005 (AwarenessUpdateMessage)

---

**Status:** ⬜ Not Started
