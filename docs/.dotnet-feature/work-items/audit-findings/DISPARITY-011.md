# DISPARITY-011: StoredDelta.Timestamp Should Be long (Unix Milliseconds)

**Category:** Sync  
**Priority:** P1 (High)  
**Estimate:** 0.5h

---

## Files Affected

| Role | File Path |
|------|-----------|
| .NET (to fix) | `server/csharp/src/SyncKit.Server/Sync/Document.cs` |
| TypeScript (reference) | `server/typescript/src/sync/coordinator.ts` |

---

## Current Behavior (.NET)

```csharp
public class StoredDelta
{
    /// <summary>
    /// Unique identifier for this delta (message ID).
    /// </summary>
    public required string Id { get; init; }

    /// <summary>
    /// Client that created this delta.
    /// </summary>
    public required string ClientId { get; init; }

    /// <summary>
    /// Timestamp when the delta was created (Unix milliseconds).
    /// </summary>
    public required long Timestamp { get; init; }  // ← Correctly typed as long

    /// <summary>
    /// The actual delta data (JSON payload).
    /// </summary>
    public required JsonElement Data { get; init; }

    /// <summary>
    /// Vector clock representing the state after this delta.
    /// </summary>
    public required VectorClock VectorClock { get; init; }
}
```

**Issue:** The `Timestamp` property is correctly typed as `long` for Unix milliseconds. However, this disparity document is created to ensure consistency across all timestamp fields in the codebase.

---

## Expected Behavior (TypeScript Reference)

```typescript
// TypeScript doesn't have a StoredDelta interface in the reference,
// but the pattern is consistent: timestamps are numbers (Unix milliseconds)
```

**Correct behavior:** All timestamps should be Unix milliseconds for consistency.

---

## Disparity Details

| Aspect | TypeScript | .NET (Current) | Status |
|--------|------------|----------------|--------|
| Timestamp | `number` (Unix ms) | `long` (Unix ms) | ✓ Correct |

---

## Suggested Fix

No changes needed. The `StoredDelta.Timestamp` is correctly implemented. This disparity is documented for completeness and to ensure consistency with other timestamp fields.

---

## Acceptance Criteria

- [ ] `StoredDelta.Timestamp` remains as `long` (Unix milliseconds)
- [ ] All timestamp assignments use `DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()`
- [ ] Code compiles without errors
- [ ] Existing unit tests pass

---

## Related

- **Audit Document:** [AUDIT-TYPESCRIPT-PARITY.md](../AUDIT-TYPESCRIPT-PARITY.md)
- **Related Disparities:** DISPARITY-008 (TokenPayload), DISPARITY-010 (Document timestamps)

---

**Status:** ⬜ Not Started
