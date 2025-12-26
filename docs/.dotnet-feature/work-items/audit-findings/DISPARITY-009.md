# DISPARITY-009: VectorClock.Entries Should Return Dictionary<string, long> Not IReadOnlyDictionary

**Category:** Sync  
**Priority:** P2 (Medium)  
**Estimate:** 0.5h

---

## Files Affected

| Role | File Path |
|------|-----------|
| .NET (to fix) | `server/csharp/src/SyncKit.Server/Sync/VectorClock.cs` |
| TypeScript (reference) | `server/typescript/src/sync/coordinator.ts` |

---

## Current Behavior (.NET)

```csharp
public class VectorClock : IEquatable<VectorClock>
{
    private readonly Dictionary<string, long> _entries;

    /// <summary>
    /// Read-only view of clock entries.
    /// </summary>
    public IReadOnlyDictionary<string, long> Entries => _entries;  // ← Returns IReadOnlyDictionary

    public Dictionary<string, long> ToDict() => new(_entries);  // ← Separate method to get mutable copy
}
```

**Issue:** The `Entries` property returns `IReadOnlyDictionary<string, long>`, but the TypeScript reference uses a plain object that can be serialized directly. The `.ToDict()` method is the correct way to get a serializable copy, but the naming is inconsistent.

---

## Expected Behavior (TypeScript Reference)

```typescript
export interface AwarenessClient {
  clientId: string;
  state: Record<string, unknown> | null;
  clock: number;
  lastUpdated: number;
}

// Vector clock is serialized as Record<string, number>
const vectorClock: Record<string, number> = {
  "client-1": 5,
  "client-2": 3
};
```

**Correct behavior:** Vector clocks should serialize to plain JSON objects with string keys and numeric values.

---

## Disparity Details

| Aspect | TypeScript | .NET (Current) | Issue |
|--------|------------|----------------|-------|
| Serialization | `Record<string, number>` | `Dictionary<string, long>` | ✓ Correct |
| Access pattern | Direct object | `.ToDict()` method | Naming inconsistency |

---

## Suggested Fix

The current implementation is functionally correct. However, consider:

1. **Option 1: Keep as-is** - The `.ToDict()` method is explicit and clear
2. **Option 2: Add JSON serialization support** - Implement `IJsonSerializable` or use a custom converter
3. **Option 3: Rename for clarity** - Rename `.ToDict()` to `.ToSerializable()` or `.ToJson()`

**Recommended: Add JSON serialization support**
```csharp
public class VectorClock : IEquatable<VectorClock>
{
    private readonly Dictionary<string, long> _entries;

    /// <summary>
    /// Read-only view of clock entries.
    /// </summary>
    public IReadOnlyDictionary<string, long> Entries => _entries;

    /// <summary>
    /// Convert to dictionary for serialization.
    /// </summary>
    /// <returns>Dictionary of client IDs to clock values</returns>
    public Dictionary<string, long> ToDict() => new(_entries);

    /// <summary>
    /// Convert to JSON-serializable format.
    /// </summary>
    /// <returns>Dictionary suitable for JSON serialization</returns>
    public Dictionary<string, long> ToJson() => ToDict();
}
```

---

## Acceptance Criteria

- [ ] Vector clock serializes to JSON as `{"clientId": value, ...}`
- [ ] `.ToDict()` method returns a mutable copy
- [ ] Code compiles without errors
- [ ] Existing unit tests pass
- [ ] Integration tests pass with SDK clients

---

## Related

- **Audit Document:** [AUDIT-TYPESCRIPT-PARITY.md](../AUDIT-TYPESCRIPT-PARITY.md)
- **Related Disparities:** DISPARITY-003 (DeltaMessage), DISPARITY-004 (SyncRequestMessage)

---

**Status:** ⬜ Not Started
