# SyncKit Copilot Instructions

## Project Overview

SyncKit is a production-ready offline-first sync engine (v0.1.0) with a **three-layer architecture**:
- **Rust Core** (`core/`) - WASM-compiled CRDT engine with LWW (Last-Write-Wins) merge
- **TypeScript SDK** (`sdk/`) - Developer-facing API with React hooks and storage adapters
- **Multi-Language Server** (`server/typescript/`) - WebSocket sync server (Bun + Hono)

**Philosophy**: Simple for 80% of use cases (LWW document sync), powerful for advanced needs (Text/Counter/Set CRDTs planned for v0.2+).

## Architecture Deep-Dive

### WASM Build Variants (Critical!)

The project has **two distinct build configurations** defined in `core/Cargo.toml`:

```toml
# Default: core-lite (~45KB gzipped)
default = ["core-lite", "wasm"]
core-lite = ["wee_alloc"]  # Minimal: LWW + VectorClock only

# Full variant (~59KB gzipped)
core = ["prost", "bytes", "base64", "chrono"]  # + Protobuf + DateTime
```

**When working on Rust code**:
- If modifying `core/src/sync/` (LWW, vector clocks) → affects both variants
- If modifying `core/src/protocol/` → requires `prost` feature (full variant only)
- If modifying `core/src/crdt/` → feature-gated (opt-in, requires `core` feature)
- Build both variants after changes: `bash core/scripts/build-wasm.sh`

### Storage Architecture Pattern

**Client-side storage is field-level granular** (`sdk/src/storage/`):
```typescript
// WRONG: Don't store just the document data
await storage.set(id, doc.toJSON())

// CORRECT: Store with vector clock for causality
const stored: StoredDocument = {
  id: docId,
  data: documentData,
  version: vectorClock,  // Maps clientId → count
  updatedAt: Date.now()
}
```

Vector clocks **must persist** for conflict resolution. See `sdk/src/document.ts:loadFromStored()`.

### Sync Protocol Flow (Critical for Server Work)

**Document updates follow this exact sequence** (`sdk/src/document.ts:update()`):

1. Increment vector clock: `vectorClock[clientId]++`
2. Apply to WASM doc: `wasmDoc.setField(field, value, BigInt(clock), clientId)`
3. Update local state: `updateLocalState()` (reads from WASM)
4. Persist to storage: `storage.set(id, {...data, version: vectorClock})`
5. Notify subscribers: `subscribers.forEach(cb => cb(data))`
6. Push to sync manager: `syncManager.pushOperation({type: 'set', ...})`

**Never skip step 1** - vector clocks track causality. **Never swap steps 2 and 4** - WASM is source of truth.

### Cross-Tab Sync Strategy

Unlike typical implementations, SyncKit uses **server-mediated cross-tab sync** (`sdk/src/sync/manager.ts`):

```typescript
// Each tab connects via WebSocket
// Server broadcasts operations to all connected clients
// No BroadcastChannel API (deferred to v0.2+)
```

**Why**: Ensures consistent ordering across all clients. When adding cross-tab features, operations must flow through the sync manager.

## Development Workflows

### WASM Build Process (Run on Rust Changes)

```bash
cd core
bash scripts/build-wasm.sh  # Linux/Mac
# OR
.\scripts\build-wasm.ps1    # Windows
```

**Outputs**:
- `core/pkg/synckit_core_bg.wasm` - Binary (~49KB → ~48KB gzipped)
- `core/pkg/synckit_core.js` - JS bindings
- `core/pkg/synckit_core.d.ts` - TypeScript types

**Post-build**: SDK auto-copies WASM files via `npm run copy-wasm` (runs on `npm run build`).

### Testing Strategy (700+ Tests Across 3 Layers)

**Unit tests** (fast, run frequently):
```bash
cd core && cargo test          # Rust unit tests
npm test -w sdk                # TypeScript SDK tests
cd server/typescript && bun test tests/unit/
```

**Integration tests** (slower, run pre-commit):
```bash
cd tests && bun test integration/  # 244 tests, requires server
```

**Chaos tests** (adversarial, run on network changes):
```bash
cd tests && bun test chaos/  # 80 tests: packet loss, latency, corruption
```

**Load tests** (performance, run on optimization):
```bash
cd tests && bun test load/   # 61 tests: concurrent clients, burst traffic
```

### Monorepo Structure (Not Standard npm Workspaces)

```bash
# SDK is an npm workspace
npm run build         # Builds SDK only
npm run build -w sdk  # Explicit SDK build

# Server is NOT a workspace (uses Bun, not npm)
cd server/typescript && bun install && bun run dev

# Tests use Bun, separate package.json
cd tests && bun test
```

**Why**: Bun and npm toolchains don't mix well. Keep them separate.

## Code Patterns & Conventions

### TypeScript SDK Pattern: WASM Wrapper + Subscriptions

All SDK classes follow this pattern (`sdk/src/document.ts`):

```typescript
class SyncDocument<T> {
  private wasmDoc: WasmDocument | null = null  // Lazy-loaded
  private subscribers = new Set<SubscriptionCallback<T>>()
  private data: T = {} as T  // Cached state

  async init() {
    const wasm = await initWASM()  // Shared WASM instance
    this.wasmDoc = new wasm.WasmDocument(this.id)
    // Load from storage...
    this.updateLocalState()  // Read from WASM
  }

  subscribe(cb: SubscriptionCallback<T>): Unsubscribe {
    this.subscribers.add(cb)
    cb(this.get())  // Immediate call with current state
    return () => this.subscribers.delete(cb)
  }
}
```

**Key insights**:
- WASM is source of truth, TypeScript is a view
- Subscriptions call immediately (React expects this)
- `updateLocalState()` always reads from WASM, never modifies directly

### React Hook Pattern: Context + Ref Management

React hooks use stable references (`sdk/src/adapters/react.tsx`):

```typescript
export function useSyncDocument<T>(id: string) {
  const docRef = useRef<SyncDocument<T> | null>(null)
  const [initialized, setInitialized] = useState(false)

  // Get or create document (runs once)
  if (!docRef.current) {
    docRef.current = synckit.document<T>(id)
  }

  // Subscribe only after init
  useEffect(() => {
    if (!initialized) return
    return doc.subscribe(setData)
  }, [doc, initialized])
}
```

**Why**: `document()` caches instances. Multiple `useSyncDocument()` calls return the same instance.

### Rust Error Handling: thiserror + SyncError

All errors use `thiserror` (`core/src/error.rs`):

```rust
#[derive(Debug, thiserror::Error)]
pub enum SyncError {
    #[error("Storage error: {0}")]
    Storage(String),
    
    #[error("Merge conflict: {0}")]
    MergeConflict(String),
}

pub type Result<T> = std::result::Result<T, SyncError>;
```

**Pattern**: Always use `Result<T>` not `Result<T, E>`. SyncError is the only error type.

## Critical "Why" Decisions

### Why Field-Level Granularity (Not Document-Level)?

**Decision**: `Document { fields: HashMap<FieldPath, Field> }` (see `core/src/document.rs`)

**Rationale**: Concurrent updates to different fields don't conflict. Example:
```typescript
// Client A updates title, Client B updates status
// Document-level LWW: One client loses their entire document
// Field-level LWW: Both updates preserved
```

Trade-off: Larger memory footprint (vector clock per field). Acceptable for 80% use case.

### Why Separate Lite Variant?

**Size breakdown** (from `sdk/package.json` exports):
- Default: 59KB gzipped (48KB WASM + 10KB SDK)
- Lite: 45KB gzipped (43KB WASM + 1.5KB SDK)

**Why**: Protobuf adds 5KB. DateTime adds 2KB. Text CRDT adds 8KB (future).

**When to recommend Lite**: Mobile apps, bundle-size critical projects. **When to avoid**: If planning to use server sync (needs Protobuf).

### Why Rust Core (Not Pure TypeScript)?

**Performance targets** (verified in benchmarks):
- Local update: <1ms (5-20μs actual)
- Vector clock merge: 1000 ops/sec
- WASM size: 48KB (vs 150KB+ for pure JS CRDT libs)

**Rust achieves**:
- Zero-cost abstractions (no GC pauses)
- Memory safety (prevents corruption bugs)
- WASM compilation (portable)

### Why No BroadcastChannel Yet?

**Current**: Server-mediated cross-tab sync (`sdk/src/sync/manager.ts`)
**Planned**: BroadcastChannel for offline multi-tab (v0.2+)

**Reason**: Server sync ensures:
- Consistent operation ordering (server is arbiter)
- Offline queue plays back in correct order
- Simpler implementation for v0.1.0

BroadcastChannel would bypass server, causing ordering issues.

## Common Tasks & Examples

### Adding a New CRDT Type

1. **Define in Rust** (`core/src/crdt/my_crdt.rs`):
```rust
#[cfg(feature = "my-crdt")]
pub mod my_crdt {
    pub struct MyCRDT { /* ... */ }
    impl MyCRDT {
        pub fn merge(&mut self, other: &MyCRDT) { /* ... */ }
    }
}
```

2. **Add feature to Cargo.toml**:
```toml
[features]
my-crdt = ["core"]  # Requires full core
```

3. **Expose in WASM** (`core/src/wasm/bindings.rs`):
```rust
#[cfg(feature = "my-crdt")]
#[wasm_bindgen]
pub struct WasmMyCRDT { /* ... */ }
```

4. **Wrap in SDK** (`sdk/src/my-crdt.ts`):
```typescript
export class MyCRDT {
  private wasmCrdt: WasmMyCRDT
  // Mirror Rust API...
}
```

5. **Add React hook** (`sdk/src/adapters/react.tsx`):
```typescript
export function useMyCRDT(id: string) { /* ... */ }
```

### Debugging Merge Conflicts

**Enable debug logs** in document.ts:
```typescript
console.log(`[Document] applyRemoteOperation for ${this.id}...`)
console.log(`[Document] Current vector clock:`, this.vectorClock)
console.log(`[Document] Remote vector clock:`, operation.clock)
```

**Check for**:
- Vector clock not incrementing → missing `tick()` call
- Same timestamp, different values → tie-breaking by clientId
- Operation applied but UI not updating → subscription issue

### Performance Profiling

**Rust benchmarks** (use Criterion):
```bash
cd core && cargo bench
```

**TypeScript profiling** (use Chrome DevTools):
```typescript
performance.mark('sync-start')
await doc.update({ field: 'value' })
performance.mark('sync-end')
performance.measure('sync', 'sync-start', 'sync-end')
```

**Load testing** (use tests/load/):
```bash
cd tests && bun test load/concurrent-clients.test.ts
```

## Integration Points

### Server → Client Delta Format

**Server sends** (`server/typescript/src/sync/`):
```json
{
  "type": "sync_response",
  "documentId": "doc-123",
  "delta": {
    "field": "title",
    "value": "New Title",
    "clock": { "client-1": 42, "client-2": 10 },
    "clientId": "client-1"
  }
}
```

**Client applies** (`sdk/src/document.ts:applyRemoteOperation()`):
1. Merge vector clocks: `this.vectorClock[id] = Math.max(local, remote)`
2. Apply to WASM: `wasmDoc.setField(field, value, BigInt(maxClock), clientId)`
3. Update UI: `notifySubscribers()`

**Critical**: Server must send **complete vector clock**, not just the operation's timestamp.

### Storage Adapters (Extensibility Point)

Implement `StorageAdapter` interface (`sdk/src/types.ts`):

```typescript
interface StorageAdapter {
  init(): Promise<void>
  get(id: string): Promise<StoredDocument | null>
  set(id: string, doc: StoredDocument): Promise<void>
  delete(id: string): Promise<void>
  list(): Promise<string[]>
  clear(): Promise<void>
}
```

**Examples**: IndexedDB (`sdk/src/storage/indexeddb.ts`), Memory (`sdk/src/storage/memory.ts`).

**Future**: OPFS, SQLite, File System.

## Testing Requirements

### Property-Based Tests (Core Rust)

Use PropTest for invariants (`core/tests/property_tests.rs`):

```rust
proptest! {
    #[test]
    fn lww_merge_is_commutative(
        field1 in prop_field(),
        field2 in prop_field()
    ) {
        let mut doc1 = Document::new("test".into());
        let mut doc2 = Document::new("test".into());
        
        doc1.merge(&field1); doc1.merge(&field2);
        doc2.merge(&field2); doc2.merge(&field1);
        
        assert_eq!(doc1, doc2);  // Order doesn't matter
    }
}
```

**Test LWW properties**: Commutativity, idempotence, convergence.

### Chaos Engineering Tests

Simulate network failures (`tests/chaos/`):

```typescript
// tests/chaos/packet-loss.test.ts
test('converges despite 50% packet loss', async () => {
  const simulator = new NetworkSimulator({ packetLoss: 0.5 })
  // Apply 100 operations...
  // Assert all replicas converge
})
```

**Run on network protocol changes** to verify resilience.

## File Ownership & Navigation

- **Sync algorithm changes**: `core/src/sync/lww.rs` + `core/tests/property_tests.rs`
- **WASM bindings**: `core/src/wasm/bindings.rs` (exports to JS)
- **SDK API**: `sdk/src/synckit.ts` (main entry) + `sdk/src/document.ts` (per-doc API)
- **React hooks**: `sdk/src/adapters/react.tsx`
- **Server sync logic**: `server/typescript/src/sync/manager.ts`
- **Protocol definitions**: `protocol/specs/*.proto` (if adding features requiring wire format)
- **Build system**: `core/scripts/build-wasm.sh` (WASM), `sdk/package.json` (SDK build)

## Anti-Patterns to Avoid

❌ **Don't modify document state without updating vector clock**:
```typescript
// BAD: Direct assignment bypasses causality
this.data.field = value
```

❌ **Don't persist document without vector clock**:
```typescript
// BAD: Loses merge capability
storage.set(id, doc.toJSON())
```

❌ **Don't mix WASM variants** (lite vs full in same build)

❌ **Don't assume operations apply immediately over network** - use offline queue

❌ **Don't use `any` types in SDK** - TypeScript generics preserve user types

✅ **Do increment vector clock before every update**
✅ **Do persist complete `StoredDocument` (data + version + updatedAt)**
✅ **Do use `SyncDocument.subscribe()` for reactive updates**
✅ **Do handle offline scenarios** (queue operations, retry on reconnect)

---

*Last updated: v0.1.0 - For questions, see [CONTRIBUTING.md](../CONTRIBUTING.md) or [Discussions](https://github.com/Dancode-188/synckit/discussions)*
