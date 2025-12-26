# DISPARITY-002: SyncResponseMessage.State Type Mismatch

**Category:** Protocol  
**Priority:** P0 (Blocking)  
**Estimate:** 0.5h

---

## Files Affected

| Role | File Path |
|------|-----------|
| .NET (to fix) | `server/csharp/src/SyncKit.Server/WebSockets/Protocol/Messages/SyncResponseMessage.cs` |
| TypeScript (reference) | `server/typescript/src/websocket/protocol.ts` |

---

## Current Behavior (.NET)

```csharp
public class SyncResponseMessage : BaseMessage
{
    [JsonPropertyName("type")]
    public override MessageType Type => MessageType.SyncResponse;

    [JsonPropertyName("requestId")]
    public required string RequestId { get; set; }

    [JsonPropertyName("documentId")]
    public required string DocumentId { get; set; }

    /// Full document state (for initial sync).
    /// Vector clock represented as a dictionary of client ID to clock value.
    [JsonPropertyName("state")]
    public Dictionary<string, long>? State { get; set; }  // ← Typed as Dictionary<string, long>

    [JsonPropertyName("deltas")]
    public List<DeltaPayload>? Deltas { get; set; }
}
```

**Issue:** The `State` property is typed as `Dictionary<string, long>`, which represents a vector clock. However, the TypeScript reference shows `state?: any` which should contain the full document state (not just the vector clock).

---

## Expected Behavior (TypeScript Reference)

```typescript
export interface SyncResponseMessage extends BaseMessage {
  type: MessageType.SYNC_RESPONSE;
  requestId: string;
  documentId: string;
  state?: any;           // ← Full document state (any type)
  deltas?: any[];        // ← Delta updates
}
```

**Correct behavior:** The `state` field should be `any` (or `object?` in C#) to hold the full document state, not just a vector clock.

---

## Disparity Details

| Aspect | TypeScript | .NET (Current) | Required Change |
|--------|------------|----------------|-----------------|
| state type | `any` | `Dictionary<string, long>?` | Change to `object?` or `JsonElement?` |
| state semantics | Full document state | Vector clock only | Should contain full document state |
| deltas type | `any[]` | `List<DeltaPayload>?` | Keep as is (correct) |

---

## Suggested Fix

Change the `State` property to hold the full document state instead of just a vector clock:

```csharp
public class SyncResponseMessage : BaseMessage
{
    [JsonPropertyName("type")]
    public override MessageType Type => MessageType.SyncResponse;

    [JsonPropertyName("requestId")]
    public required string RequestId { get; set; }

    [JsonPropertyName("documentId")]
    public required string DocumentId { get; set; }

    /// <summary>
    /// Full document state (for initial sync).
    /// Can be any JSON-serializable object representing the document's current state.
    /// </summary>
    [JsonPropertyName("state")]
    public object? State { get; set; }  // ← Changed from Dictionary<string, long>? to object?

    /// <summary>
    /// Delta updates (for incremental sync).
    /// Each delta includes the delta data and its associated vector clock.
    /// </summary>
    [JsonPropertyName("deltas")]
    public List<DeltaPayload>? Deltas { get; set; }
}
```

---

## Acceptance Criteria

- [ ] `State` property type changed from `Dictionary<string, long>?` to `object?`
- [ ] JSON serialization preserves full document state
- [ ] Code compiles without errors
- [ ] Existing unit tests pass
- [ ] Integration tests pass with SDK clients

---

## Related

- **Audit Document:** [AUDIT-TYPESCRIPT-PARITY.md](../AUDIT-TYPESCRIPT-PARITY.md)
- **Related Disparities:** DISPARITY-003 (DeltaPayload structure)

---

**Status:** ⬜ Not Started
