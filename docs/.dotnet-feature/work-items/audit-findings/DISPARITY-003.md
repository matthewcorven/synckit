# DISPARITY-003: DeltaMessage.Delta Type Should Be Generic

**Category:** Protocol  
**Priority:** P1 (High)  
**Estimate:** 0.5h

---

## Files Affected

| Role | File Path |
|------|-----------|
| .NET (to fix) | `server/csharp/src/SyncKit.Server/WebSockets/Protocol/Messages/DeltaMessage.cs` |
| TypeScript (reference) | `server/typescript/src/websocket/protocol.ts` |

---

## Current Behavior (.NET)

```csharp
public class DeltaMessage : BaseMessage
{
    [JsonPropertyName("type")]
    public override MessageType Type => MessageType.Delta;

    [JsonPropertyName("documentId")]
    public required string DocumentId { get; set; }

    [JsonPropertyName("delta")]
    public required object Delta { get; set; }  // ← Typed as object (correct)

    [JsonPropertyName("vectorClock")]
    public required Dictionary<string, long> VectorClock { get; set; }
}
```

**Issue:** While the `Delta` property is correctly typed as `object`, the `VectorClock` is typed as `Dictionary<string, long>`. However, in TypeScript, the vector clock is represented as `Record<string, number>` which serializes to a plain JSON object. The .NET version should use `JsonElement` or `Dictionary<string, long>` consistently with how it's serialized.

---

## Expected Behavior (TypeScript Reference)

```typescript
export interface DeltaMessage extends BaseMessage {
  type: MessageType.DELTA;
  documentId: string;
  delta: any;                           // ← Generic delta data
  vectorClock: Record<string, number>;  // ← Vector clock as plain object
}
```

**Correct behavior:** The `vectorClock` should serialize to a plain JSON object with string keys and numeric values, matching TypeScript's `Record<string, number>`.

---

## Disparity Details

| Aspect | TypeScript | .NET (Current) | Issue |
|--------|------------|----------------|-------|
| delta | `any` | `object` | ✓ Correct |
| vectorClock | `Record<string, number>` | `Dictionary<string, long>` | Type mismatch: `number` vs `long` |

---

## Suggested Fix

The current implementation is mostly correct. However, verify that:

1. `Dictionary<string, long>` serializes to JSON as `{"clientId": 123, ...}` (it does)
2. The JSON property names are correct (they are)
3. Consider using `Dictionary<string, int>` instead of `long` if vector clock values are guaranteed to fit in 32-bit integers

**Recommended change (if vector clocks fit in int):**
```csharp
public class DeltaMessage : BaseMessage
{
    [JsonPropertyName("type")]
    public override MessageType Type => MessageType.Delta;

    [JsonPropertyName("documentId")]
    public required string DocumentId { get; set; }

    [JsonPropertyName("delta")]
    public required object Delta { get; set; }

    /// <summary>
    /// Vector clock representing the state after this delta.
    /// Maps client IDs to their logical clock values.
    /// </summary>
    [JsonPropertyName("vectorClock")]
    public required Dictionary<string, int> VectorClock { get; set; }  // ← Changed from long to int
}
```

**Or keep as-is if vector clocks can exceed int.MaxValue:**
```csharp
// Current implementation is correct for large vector clock values
public required Dictionary<string, long> VectorClock { get; set; }
```

---

## Acceptance Criteria

- [ ] Vector clock serializes to JSON as `{"clientId": value, ...}`
- [ ] Vector clock values match TypeScript's `number` type (JavaScript numbers are 64-bit floats)
- [ ] JSON serialization produces identical output to TypeScript server
- [ ] Code compiles without errors
- [ ] Existing unit tests pass

---

## Related

- **Audit Document:** [AUDIT-TYPESCRIPT-PARITY.md](../AUDIT-TYPESCRIPT-PARITY.md)
- **Related Disparities:** DISPARITY-002 (SyncResponseMessage), DISPARITY-004 (SyncRequestMessage)

---

**Status:** ⬜ Not Started
