# C# Server Performance Optimization - Agent Master Prompt

> **Purpose:** This document provides sequential instructions for AI agents to systematically implement performance optimizations for the SyncKit C# server. Each agent reads this prompt, checks progress.txt, completes ONE objective, tests it, and updates progress.txt.

---

## Agent Protocol

### Before Starting ANY Work

1. **Read this entire document** to understand the full scope
2. **Read `progress.txt`** in this directory to find current state
3. **Identify the next incomplete objective** (status: `NOT_STARTED` or `IN_PROGRESS`)
4. **Complete only ONE objective** before updating progress.txt
5. **Run ALL required tests** before marking complete

### After Completing Work

Update `progress.txt` with:
```
[OBJECTIVE_ID]
Status: COMPLETED | FAILED | IN_PROGRESS
Agent: [Your session identifier or timestamp]
Date: [ISO date]
Notes: [Brief description of what was done or why it failed]
Tests Passed: [Yes/No with details]
Commit: [Git commit hash if applicable]
```

### If You Encounter a Blocker

1. Mark status as `BLOCKED` in progress.txt
2. Document the blocker clearly
3. Do NOT proceed to the next objective
4. The next agent will attempt to resolve or escalate

---

## Reference Documents

Read these documents for context (in order of importance):

| Document | Purpose | Required Reading |
|----------|---------|------------------|
| `CSHARP_IMPROVEMENT_ANALYSIS.md` | Primary guide with prioritized improvements | ✅ Yes |
| `PERFORMANCE_OPTIMIZATION_PLAN.md` | Detailed .NET implementation patterns | For reference |
| `CSHARP_SERVER_REFERENCE.md` | Current C# server architecture | For reference |
| `TYPESCRIPT_SERVER_REFERENCE.md` | TypeScript server (reference implementation) | For reference |
| `../architecture/SERVER_PERFORMANCE.md` | Current benchmark results | For reference |

---

## Repository Structure

```
server/csharp/src/
├── SyncKit.Server/           # Main server project
│   ├── Program.cs
│   ├── WebSockets/
│   │   ├── Handlers/         # Message handlers (DeltaMessageHandler.cs)
│   │   ├── Connection.cs
│   │   └── ConnectionManager.cs
│   ├── Sync/
│   │   └── Document.cs       # Document state management
│   ├── Storage/
│   │   └── InMemoryStorageAdapter.cs
│   └── Protocol/
│       └── BinaryProtocolHandler.cs
└── SyncKit.Server.Tests/     # Unit tests

tests/                        # Integration tests (Bun/TypeScript)
├── integration/
│   └── run-against-csharp.sh
```

---

## Test Commands

### Unit Tests (C#)
```bash
cd /Users/core/git/matthewcorven/synckit/server/csharp/src/SyncKit.Server.Tests
dotnet test --configuration Release --verbosity minimal
```

### Integration Tests (requires server running in separate terminal)

**Terminal 1 - Start Server:**
```bash
cd /Users/core/git/matthewcorven/synckit/server/csharp/src/SyncKit.Server
SYNCKIT_SERVER_URL=http://localhost:8090 \
SYNCKIT_AUTH_REQUIRED=false \
JWT_SECRET='test-secret-key-for-integration-tests-only-32-chars' \
dotnet run --configuration Release
```

**Terminal 2 - Run Tests:**
```bash
cd /Users/core/git/matthewcorven/synckit/tests
./integration/run-against-csharp.sh
```

### Health Check
```bash
curl -s -w '\nHTTP Status: %{http_code}\n' http://localhost:8090/health
```

### Performance Benchmark (after all optimizations)
```bash
cd /Users/core/git/matthewcorven/synckit/tests
PERF_MAX_CONNECTIONS=30000 ./run-perf-benchmark.sh csharp
```

---

## Objectives (Execute in Order)

### Phase 0: Critical Optimizations (P0)

#### OBJECTIVE 0.1: Delta Batching Service

**Goal:** Implement 50ms delta batching to coalesce rapid updates before broadcast.

**Why:** The TypeScript server batches deltas in 50ms windows. Without this, C# broadcasts N messages for N rapid deltas, causing the 32x P95 latency gap.

**Files to Create/Modify:**
- CREATE: `SyncKit.Server/Services/DeltaBatchingService.cs`
- MODIFY: `SyncKit.Server/WebSockets/Handlers/DeltaMessageHandler.cs` - Use batching service
- MODIFY: `SyncKit.Server/Program.cs` - Register service

**Implementation Reference:**
```csharp
// DeltaBatchingService.cs
public class DeltaBatchingService : IHostedService, IDisposable
{
    private readonly ConcurrentDictionary<string, DeltaBatch> _pendingBatches = new();
    private readonly TimeSpan _batchInterval = TimeSpan.FromMilliseconds(50);
    private readonly IConnectionManager _connectionManager;
    private readonly ILogger<DeltaBatchingService> _logger;
    
    private class DeltaBatch
    {
        public ConcurrentDictionary<string, JsonElement> Delta { get; } = new();
        public Timer? Timer { get; set; }
        public string? OriginConnectionId { get; set; }
    }
    
    public void AddToBatch(string documentId, Dictionary<string, JsonElement> delta, string? originConnectionId)
    {
        var batch = _pendingBatches.GetOrAdd(documentId, _ => 
        {
            var b = new DeltaBatch { OriginConnectionId = originConnectionId };
            b.Timer = new Timer(_ => FlushBatch(documentId), null, _batchInterval, Timeout.InfiniteTimeSpan);
            return b;
        });
        
        foreach (var (key, value) in delta)
            batch.Delta[key] = value;  // Later writes win
    }
    
    private void FlushBatch(string documentId)
    {
        if (_pendingBatches.TryRemove(documentId, out var batch))
        {
            batch.Timer?.Dispose();
            // Build and broadcast coalesced delta message
            // ...
        }
    }
}
```

**Tests Required:**
- [ ] Unit tests pass: `dotnet test`
- [ ] Integration tests pass: `./integration/run-against-csharp.sh`
- [ ] Verify batching works: Send 10 rapid deltas, confirm only ~1-2 broadcasts

**Acceptance Criteria:**
- Delta messages within 50ms window are coalesced
- Broadcast occurs once per batch window per document
- No regression in existing functionality

---

#### OBJECTIVE 0.2: LWW State Caching (Write-Time Resolution)

**Goal:** Apply LWW at write-time instead of read-time, cache resolved state.

**Why:** Current `BuildState()` iterates ALL historical deltas (O(n)) on every read. TypeScript resolves LWW at write-time for O(1) reads.

**Files to Modify:**
- `SyncKit.Server/Sync/Document.cs` - Add resolved fields dictionary, apply LWW at write

**Implementation Reference:**
```csharp
public class Document
{
    private readonly ConcurrentDictionary<string, FieldEntry> _resolvedFields = new();
    private readonly List<StoredDelta> _deltas = new();  // Keep for history/replay
    
    private record FieldEntry(JsonElement Value, long Timestamp, long Clock, string ClientId);
    
    public void ApplyDelta(StoredDelta delta)
    {
        // Store raw delta for history
        _deltas.Add(delta);
        
        // Apply LWW to resolved state
        foreach (var property in delta.Data.EnumerateObject())
        {
            var newEntry = new FieldEntry(
                property.Value.Clone(),
                delta.Timestamp,
                delta.VectorClock.Get(delta.ClientId),
                delta.ClientId
            );
            
            _resolvedFields.AddOrUpdate(
                property.Name,
                newEntry,
                (_, existing) => LwwWinner(existing, newEntry)
            );
        }
    }
    
    private FieldEntry LwwWinner(FieldEntry existing, FieldEntry incoming)
    {
        // Timestamp wins, then clock, then clientId
        if (incoming.Timestamp > existing.Timestamp) return incoming;
        if (incoming.Timestamp < existing.Timestamp) return existing;
        if (incoming.Clock > existing.Clock) return incoming;
        if (incoming.Clock < existing.Clock) return existing;
        return string.Compare(incoming.ClientId, existing.ClientId, StringComparison.Ordinal) > 0 
            ? incoming : existing;
    }
    
    public Dictionary<string, object?> BuildState()
    {
        // O(fields) instead of O(deltas)
        return _resolvedFields.ToDictionary(
            kv => kv.Key,
            kv => (object?)JsonSerializer.Deserialize<object>(kv.Value.Value.GetRawText())
        );
    }
}
```

**Tests Required:**
- [ ] Unit tests pass
- [ ] Integration tests pass (especially conflict resolution tests)
- [ ] Verify LWW behavior matches TypeScript

**Acceptance Criteria:**
- `BuildState()` is O(fields) not O(deltas)
- LWW conflict resolution produces identical results to TypeScript
- No regression in sync behavior

---

### Phase 1: High-Impact Optimizations (P1)

#### OBJECTIVE 1.1: JSON Source Generators

**Goal:** Replace reflection-based JSON serialization with compile-time source generators.

**Files to Create/Modify:**
- CREATE: `SyncKit.Server/Protocol/SyncKitJsonContext.cs`
- MODIFY: `SyncKit.Server/Protocol/BinaryProtocolHandler.cs` - Use source-generated context
- MODIFY: All message serialization call sites

**Implementation Reference:**
```csharp
// SyncKitJsonContext.cs
[JsonSourceGenerationOptions(
    PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    GenerationMode = JsonSourceGenerationMode.Default
)]
[JsonSerializable(typeof(DeltaMessage))]
[JsonSerializable(typeof(AckMessage))]
[JsonSerializable(typeof(SyncRequestMessage))]
[JsonSerializable(typeof(SyncResponseMessage))]
[JsonSerializable(typeof(SubscribeMessage))]
[JsonSerializable(typeof(UnsubscribeMessage))]
[JsonSerializable(typeof(AwarenessMessage))]
[JsonSerializable(typeof(ErrorMessage))]
[JsonSerializable(typeof(Dictionary<string, object?>))]
public partial class SyncKitJsonContext : JsonSerializerContext { }
```

**Tests Required:**
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Binary protocol tests pass

---

#### OBJECTIVE 1.2: Sequential Broadcast (Remove Parallel.ForEach)

**Goal:** Replace `Parallel.ForEach` with sequential loop for broadcasts.

**Why:** `Connection.Send()` is non-blocking (queues to channel). Parallel.ForEach adds thread pool overhead without benefit.

**Files to Modify:**
- `SyncKit.Server/WebSockets/ConnectionManager.cs`

**Change:**
```csharp
// FROM:
Parallel.ForEach(connections.Values, connection => {
    connection.Send(message);
});

// TO:
foreach (var connection in connections.Values)
{
    if (excludeConnectionId != null && connection.Id == excludeConnectionId)
        continue;
    connection.Send(message);
}
```

**Tests Required:**
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Load tests pass (verify no regression under concurrent load)

---

#### OBJECTIVE 1.3: ValueTask for In-Memory Operations

**Goal:** Use `ValueTask` for storage methods that complete synchronously.

**Files to Modify:**
- `SyncKit.Server/Storage/IStorageAdapter.cs` - Change return types
- `SyncKit.Server/Storage/InMemoryStorageAdapter.cs` - Return `ValueTask`
- All callers of storage methods

**Tests Required:**
- [ ] Unit tests pass
- [ ] Integration tests pass

---

### Phase 2: Medium-Impact Optimizations (P2)

#### OBJECTIVE 2.1: ACK Tracking Implementation

**Goal:** Implement proper ACK tracking with retry mechanism.

**Files to Create/Modify:**
- CREATE: `SyncKit.Server/Services/AckTracker.cs`
- MODIFY: `SyncKit.Server/WebSockets/Handlers/AckMessageHandler.cs`
- MODIFY: Delta broadcast to track pending ACKs

**Tests Required:**
- [ ] Unit tests for AckTracker
- [ ] Integration tests pass
- [ ] Test ACK timeout and retry behavior

---

#### OBJECTIVE 2.2: Object Pooling for Messages

**Goal:** Pool frequently-allocated message objects.

**Files to Create/Modify:**
- CREATE: `SyncKit.Server/Protocol/MessagePool.cs`
- MODIFY: Message handlers to use pooling

**Tests Required:**
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Memory profiling shows reduced allocations

---

### Phase 3: Polish and Verification (P3)

#### OBJECTIVE 3.1: Connection ID Format Alignment

**Goal:** Match TypeScript connection ID format (`conn-N` instead of `conn_N_timestamp`).

**Files to Modify:**
- `SyncKit.Server/WebSockets/ConnectionManager.cs`

**Tests Required:**
- [ ] Unit tests pass
- [ ] Integration tests pass

---

#### OBJECTIVE 3.2: Health Check Response Alignment

**Goal:** Align health check JSON structure with TypeScript.

**Files to Modify:**
- Health endpoint in `Program.cs` or dedicated handler

**Tests Required:**
- [ ] Health check returns identical structure to TypeScript

---

#### OBJECTIVE 3.3: Final Performance Benchmark

**Goal:** Run full performance benchmark and document results.

**Commands:**
```bash
cd /Users/core/git/matthewcorven/synckit/tests
PERF_MAX_CONNECTIONS=30000 ./run-perf-benchmark.sh csharp 2>&1 | tee perf-final-results.log
```

**Success Criteria:**
| Metric | Before | Target | Actual |
|--------|--------|--------|--------|
| P95 Latency | 1,655ms | ≤200ms | ? |
| Aggregate Ops/Sec | 1,032 | ≥1,800 | ? |
| Memory Growth | 0.07 MB/min | ≤0.1 MB/min | ? |

**Update:** `../architecture/SERVER_PERFORMANCE.md` with final results.

---

## Test Execution

Run all tests after each objective:
```bash
# Unit Tests
cd /Users/core/git/matthewcorven/synckit/server/csharp/src/SyncKit.Server.Tests
dotnet test --configuration Release --verbosity minimal

# Integration Tests
cd /Users/core/git/matthewcorven/synckit/tests
./integration/run-against-csharp.sh --with-server
```

---

## Commit Convention

After each objective, commit with message format:
```
perf(csharp): <objective description>

Objective: <OBJECTIVE_ID>
- <bullet point of changes>
- <bullet point of changes>

Tests: all passing
```

Example:
```
perf(csharp): implement delta batching service

Objective: 0.1
- Add DeltaBatchingService with 50ms coalescing window
- Integrate with DeltaMessageHandler
- Register as hosted service in Program.cs

Tests: all passing
```

---

## Troubleshooting

### Server Won't Start
```bash
# Check if port is in use
lsof -i :8090
# Kill existing process
pkill -f "dotnet run"
```

### Tests Fail with Connection Refused
- Ensure server is running in **separate terminal**
- Wait 2-3 seconds after server start before running tests

### Build Errors After Changes
```bash
cd /Users/core/git/matthewcorven/synckit/server/csharp/src/SyncKit.Server
dotnet clean
dotnet build --configuration Release
```

---

## Success Definition

The optimization effort is **COMPLETE** when:

1. ✅ All objectives marked `COMPLETED` in progress.txt
2. ✅ All unit tests passing
3. ✅ All integration tests passing
4. ✅ Performance benchmark shows:
   - P95 Latency ≤200ms (from 1,655ms)
   - Aggregate Ops/Sec ≥1,800 (from 1,032)
5. ✅ Results documented in SERVER_PERFORMANCE.md

---

## Agent Checklist (Copy for Each Session)

```
[ ] Read AGENT_MASTER_PROMPT.md (this document)
[ ] Read progress.txt for current state
[ ] Identify next incomplete objective
[ ] Read relevant reference documents
[ ] Implement changes
[ ] Run unit tests
[ ] Run integration tests (if applicable)
[ ] Update progress.txt
[ ] Commit changes with proper message
[ ] Confirm next agent can continue
```
