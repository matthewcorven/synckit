# DISPARITY-010: Document.UpdatedAt Should Use Unix Milliseconds for Consistency

**Category:** Sync  
**Priority:** P2 (Medium)  
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
public class Document
{
    /// <summary>
    /// When the document was created.
    /// </summary>
    public DateTime CreatedAt { get; }  // ← DateTime (local timezone)

    /// <summary>
    /// When the document was last updated.
    /// </summary>
    public DateTime UpdatedAt { get; private set; }  // ← DateTime (local timezone)
}
```

**Issue:** The `CreatedAt` and `UpdatedAt` properties use `DateTime` objects, but the TypeScript reference uses Unix milliseconds (`number`). This causes inconsistency with other timestamp fields in the codebase (e.g., `BaseMessage.Timestamp` uses `long` for Unix milliseconds).

---

## Expected Behavior (TypeScript Reference)

```typescript
export interface DocumentState {
  documentId: string;
  wasmDoc: WasmDocument;
  vectorClock: WasmVectorClock;
  subscribers: Set<string>;
  lastModified: number;  // ← Unix milliseconds
}
```

**Correct behavior:** Timestamps should be Unix milliseconds for consistency with the protocol and storage layer.

---

## Disparity Details

| Aspect | TypeScript | .NET (Current) | Required Change |
|--------|------------|----------------|-----------------|
| lastModified | `number` (Unix ms) | `DateTime` | Change to `long` (Unix ms) |
| Consistency | Unix ms throughout | Mixed (DateTime + long) | Standardize on Unix ms |

---

## Suggested Fix

Change `CreatedAt` and `UpdatedAt` to use Unix milliseconds:

```csharp
public class Document
{
    private readonly object _lock = new();
    private readonly List<StoredDelta> _deltas = new();
    private readonly HashSet<string> _subscribedConnections = new();

    /// <summary>
    /// Unique identifier for the document.
    /// </summary>
    public string Id { get; }

    /// <summary>
    /// Vector clock tracking causality for this document.
    /// </summary>
    public VectorClock VectorClock { get; private set; }

    /// <summary>
    /// When the document was created (Unix milliseconds).
    /// </summary>
    public long CreatedAt { get; }  // ← Changed from DateTime to long

    /// <summary>
    /// When the document was last updated (Unix milliseconds).
    /// </summary>
    public long UpdatedAt { get; private set; }  // ← Changed from DateTime to long

    /// <summary>
    /// Create a new empty document.
    /// </summary>
    /// <param name="id">Document identifier</param>
    public Document(string id)
    {
        Id = id;
        VectorClock = new VectorClock();
        CreatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        UpdatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    }

    /// <summary>
    /// Create a document from existing state (e.g., loaded from storage).
    /// </summary>
    /// <param name="id">Document identifier</param>
    /// <param name="vectorClock">Existing vector clock</param>
    /// <param name="deltas">Existing deltas</param>
    public Document(string id, VectorClock vectorClock, IEnumerable<StoredDelta> deltas)
    {
        Id = id;
        VectorClock = vectorClock;
        _deltas = deltas.ToList();
        CreatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        UpdatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    }

    /// <summary>
    /// Add a delta to the document.
    /// Merges the delta's vector clock and updates the timestamp.
    /// </summary>
    /// <param name="delta">Delta to add</param>
    public void AddDelta(StoredDelta delta)
    {
        lock (_lock)
        {
            _deltas.Add(delta);
            VectorClock = VectorClock.Merge(delta.VectorClock);
            UpdatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();  // ← Updated
        }
    }

    // ... rest of the class remains the same
}
```

---

## Acceptance Criteria

- [ ] `CreatedAt` changed from `DateTime` to `long` (Unix milliseconds)
- [ ] `UpdatedAt` changed from `DateTime` to `long` (Unix milliseconds)
- [ ] All timestamp assignments use `DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()`
- [ ] Code compiles without errors
- [ ] Existing unit tests pass
- [ ] Integration tests pass with SDK clients

---

## Related

- **Audit Document:** [AUDIT-TYPESCRIPT-PARITY.md](../AUDIT-TYPESCRIPT-PARITY.md)
- **Related Disparities:** DISPARITY-008 (TokenPayload timestamps)

---

**Status:** ⬜ Not Started
