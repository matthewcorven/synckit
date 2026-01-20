# Plan: C# Latency Parity - Phase 2 (Final)

**Target:** P95 ≤ 51ms (match TypeScript)

---

## Steps

### 1. L.6 - Fire-and-Forget Broadcasts (30 min)

Change `await _connectionManager.BroadcastToDocumentAsync()` to `_ = _connectionManager.BroadcastToDocumentAsync()` in `DeltaBatchingService.cs`.

**File:** `server/csharp/src/SyncKit.Server/Services/DeltaBatchingService.cs`

---

### 2. L.5 - Match TypeScript Storage Pattern (2-3 hrs)

Create `InMemorySyncCoordinator` with:
- In-memory `ConcurrentDictionary<string, DocumentState>` as primary state
- `GetDocument()` loads from storage only on first access
- `SetField()` / `DeleteField()` with LWW resolution
- Async persist with try/catch (await but catch errors, log, continue)

Update `DeltaMessageHandler.cs` to use coordinator instead of direct storage calls.

**Files:**
- Create: `server/csharp/src/SyncKit.Server/Sync/InMemorySyncCoordinator.cs`
- Modify: `server/csharp/src/SyncKit.Server/WebSockets/Handlers/DeltaMessageHandler.cs`

**TypeScript Reference:** `server/typescript/src/sync/coordinator.ts`

---

### 3. L.9 - Remove Batch Locks (30 min)

Replace `lock (batch.Lock)` with `ConcurrentDictionary` operations.

**File:** `server/csharp/src/SyncKit.Server/Services/DeltaBatchingService.cs`

---

### 4. Benchmark - Run CI to verify parity

```bash
gh workflow run perf-benchmark.yml --ref feature/11-dotnet-server-perf -f server_type=csharp -f max_connections=30000
```

---

## Success Criteria

| Metric | Current | Target |
|--------|---------|--------|
| P95 Latency (CI, 30k conn) | 1,608ms | ≤51ms |
| All integration tests | Pass | Pass |
