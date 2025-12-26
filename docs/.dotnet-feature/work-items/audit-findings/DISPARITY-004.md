# DISPARITY-004: SyncRequestMessage.VectorClock Type Inconsistency

**Category:** Protocol  
**Priority:** P1 (High)  
**Estimate:** 0.5h

---

## Files Affected

| Role | File Path |
|------|-----------|
| .NET (to fix) | `server/csharp/src/SyncKit.Server/WebSockets/Protocol/Messages/SyncRequestMessage.cs` |
| TypeScript (reference) | `server/typescript/src/websocket/protocol.ts` |

---

## Current Behavior (.NET)

```csharp
public class SyncRequestMessage : BaseMessage
{
    [JsonPropertyName("type")]
    public override MessageType Type => MessageType.SyncRequest;

    [JsonPropertyName("documentId")]
    public required string DocumentId { get; set; }

    /// Optional vector clock representing client's current state.
    [JsonPropertyName("vectorClock")]
    public Dictionary<string, long>? VectorClock { get; set; }  // ← long type
}
```

**Issue:** The `VectorClock` is typed as `Dictionary<string, long>?`, but TypeScript uses `Record<string, number>` which in JSON is a plain object with numeric values. The type should be consistent with other message types.

---

## Expected Behavior (TypeScript Reference)

```typescript
export interface SyncRequestMessage extends BaseMessage {
  type: MessageType.SYNC_REQUEST;
  documentId: string;
  vectorClock?: Record<string, number>;  // ← number type (JavaScript 64-bit float)
}
```

**Correct behavior:** The `vectorClock` should be `Record<string, number>` which serializes to a plain JSON object with numeric values.

---

## Disparity Details

| Aspect | TypeScript | .NET (Current) | Issue |
|--------|------------|----------------|-------|
| vectorClock | `Record<string, number>?` | `Dictionary<string, long>?` | Type mismatch: `number` vs `long` |
| Nullability | Optional (`?`) | Nullable (`?`) | ✓ Correct |

---

## Suggested Fix

Ensure consistency with other message types. If using `long` for vector clocks throughout the codebase, document why. If using `int`, change to `int` for consistency.

**Option 1: Keep as long (for large values)**
```csharp
public class SyncRequestMessage : BaseMessage
{
    [JsonPropertyName("type")]
    public override MessageType Type => MessageType.SyncRequest;

    [JsonPropertyName("documentId")]
    public required string DocumentId { get; set; }

    /// <summary>
    /// Optional vector clock representing client's current state.
    /// Maps client IDs to their logical clock values.
    /// </summary>
    [JsonPropertyName("vectorClock")]
    public Dictionary<string, long>? VectorClock { get; set; }
}
```

**Option 2: Use int for consistency with JavaScript numbers**
```csharp
public class SyncRequestMessage : BaseMessage
{
    [JsonPropertyName("type")]
    public override MessageType Type => MessageType.SyncRequest;

    [JsonPropertyName("documentId")]
    public required string DocumentId { get; set; }

    /// <summary>
    /// Optional vector clock representing client's current state.
    /// Maps client IDs to their logical clock values.
    /// </summary>
    [JsonPropertyName("vectorClock")]
    public Dictionary<string, int>? VectorClock { get; set; }
}
```

---

## Acceptance Criteria

- [ ] Vector clock type is consistent across all message types
- [ ] JSON serialization produces identical output to TypeScript server
- [ ] Code compiles without errors
- [ ] Existing unit tests pass
- [ ] Integration tests pass with SDK clients

---

## Related

- **Audit Document:** [AUDIT-TYPESCRIPT-PARITY.md](../AUDIT-TYPESCRIPT-PARITY.md)
- **Related Disparities:** DISPARITY-003 (DeltaMessage), DISPARITY-002 (SyncResponseMessage)

---

**Status:** ⬜ Not Started
