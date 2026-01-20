# Phase 2: Performance Investigation Plan

> **Purpose:** Investigate and resolve the remaining performance gaps between C# and TypeScript servers after Actor Model optimization.

## Summary

The Actor Model merge achieved **177x improvement** in Scenario A (single-doc contention), bringing C# to near-parity with TypeScript (63ms vs 55ms). However, two critical gaps remain:

| Gap | C# | TypeScript | Severity |
|-----|-----|-----------|----------|
| **Scenario C (Burst Recovery)** | 12,227 ms | 136 ms | **90x slower** |
| **Convergence Rate** | ~57% | 100% | **40% data loss** |

## Current State (Post Actor Model Merge)

```
Branch: feature/11-dotnet-server-perf
Merge: perf/actor-model ✓
Integration Tests: 253/256 passed (3 timing-related failures in framework tests)
```

### Test Results Summary

| Scenario | TypeScript | C# Actor Model | Status |
|----------|------------|----------------|--------|
| A: Single-Doc Contention | 55 ms | 63 ms | ✅ Near parity |
| B: Multi-Doc Distribution | 83 ms | 64 ms | ✅ **C# faster** |
| C: Burst + Recovery | 136 ms | 12,227 ms | ❌ 90x gap |
| Convergence | 100% | 57.3% | ❌ 40% loss |

---

## Investigation 1: Scenario C (Burst Recovery) Gap

### Hypothesis

The burst scenario floods the server with 5,000 ops/sec peak. The Actor Model handles individual document operations well, but the **broadcast path** becomes the bottleneck when delivering updates to many subscribers simultaneously.

### Likely Bottlenecks

1. **ConnectionManager.BroadcastAsync()** - Sequential iteration over subscribers
2. **WebSocket write backpressure** - Per-connection send buffer congestion
3. **Serialization overhead** - Re-serializing the same delta for each connection
4. **GC pressure** - High allocation rate during burst creates GC pauses

### Investigation Steps

#### Step 1: Profile Broadcast Path
Add timing spans to identify the slowest operation:

```csharp
// In ConnectionManager.cs
public async Task BroadcastAsync(string documentId, byte[] message)
{
    var sw = Stopwatch.StartNew();
    var subscribers = GetSubscribers(documentId);
    var getTime = sw.ElapsedMilliseconds;
    
    foreach (var conn in subscribers)
    {
        await conn.SendAsync(message);
    }
    var sendTime = sw.ElapsedMilliseconds - getTime;
    
    _logger.LogDebug("Broadcast to {Count} subs: get={Get}ms, send={Send}ms", 
        subscribers.Count, getTime, sendTime);
}
```

#### Step 2: Compare with TypeScript Broadcast
Review TypeScript implementation for differences:
- Does it batch multiple deltas into single WebSocket frames?
- Does it use `Promise.all()` for parallel sends?
- Does it have any debouncing/throttling?

```bash
# Relevant TypeScript files to review
server/typescript/src/websocket/connection.ts
server/typescript/src/sync/coordinator.ts
```

#### Step 3: Test Parallel Broadcast
Replace sequential foreach with `Task.WhenAll`:

```csharp
// Experiment: Parallel broadcast
await Task.WhenAll(subscribers.Select(conn => conn.SendAsync(message)));
```

#### Step 4: Test Delta Batching
Coalesce multiple deltas into single broadcast:

```csharp
// Instead of: foreach delta -> broadcast
// Try: collect deltas -> batch serialize -> single broadcast
```

### Experiments to Run

| Experiment | Branch | Description |
|------------|--------|-------------|
| Parallel Broadcast | `perf/parallel-broadcast` | Use Task.WhenAll for sends |
| Delta Batching | `perf/delta-batching` | Coalesce deltas per document |
| Shared Buffer | `perf/shared-buffer` | Serialize once, broadcast bytes |
| Backpressure | `perf/backpressure` | Detect slow consumers, drop/skip |

---

## Investigation 2: Convergence Gap

### Hypothesis

40% of deltas aren't reaching all clients. This suggests:
- Messages dropped under load
- Race conditions in subscription management
- ACK handling differences between servers

### Investigation Steps

#### Step 1: Add Delta Counters
Track sent vs received deltas:

```csharp
// In ConnectionManager or SyncCoordinator
private static long _deltasSent = 0;
private static long _deltasAcked = 0;

// Expose via /metrics endpoint
app.MapGet("/metrics", () => new { 
    deltasSent = _deltasSent, 
    deltasAcked = _deltasAcked,
    convergence = (double)_deltasAcked / _deltasSent
});
```

#### Step 2: Compare ACK Flows
1. Log every ACK sent by C# server
2. Compare with TypeScript ACK flow
3. Check if clients receive ACKs for all deltas

#### Step 3: Review Subscription Timing
Check if clients miss deltas during subscription setup:

```csharp
// Log subscription lifecycle
_logger.LogDebug("Client {Id} subscribed to {Doc} at clock {Clock}", 
    connectionId, documentId, vectorClock);
```

#### Step 4: Test Message Ordering
Add sequence numbers to verify no reordering or drops:

```csharp
// Add sequence to each broadcast
public record DeltaEnvelope(int Sequence, StoredDelta Delta);
```

### Experiments to Run

| Experiment | Branch | Description |
|------------|--------|-------------|
| Delta Counters | `perf/delta-counters` | Track sent/received/acked |
| Ordered Delivery | `perf/ordered-delivery` | Ensure FIFO per document |
| Retry on Timeout | `perf/retry-timeout` | Re-send unacked deltas |

---

## Investigation 3: Framework Test Failures

### Current Failures (3 tests)

1. `should allow client to set multiple fields` - getDocumentState returns before all deltas processed
2. `should support document state assertions` - Same timing issue
3. `should have clean state from previous test suite` - Isolation issue

### Root Cause

The Actor Model processes deltas asynchronously through a channel. When `getDocumentState` is called immediately after `setField`, the state may not reflect the latest delta yet.

### Fix Options

| Option | Pros | Cons |
|--------|------|------|
| **A: Wait for ACK** | Correct behavior | Adds latency to tests |
| **B: Flush channel** | Fast, deterministic | Requires exposing internal API |
| **C: Retry with backoff** | Works with existing API | Slower tests |

### Recommended Fix

Add a `WaitForPendingOperations()` method to `ActorModelStorageAdapter`:

```csharp
public async Task WaitForPendingOperationsAsync(string documentId)
{
    var doc = GetDocument(documentId);
    await doc.DrainChannelAsync(); // Wait for channel to empty
}
```

Expose via test endpoint `/_test/flush/{documentId}`.

---

## Execution Plan

### Week 1: Diagnostics

| Day | Task | Output |
|-----|------|--------|
| 1 | Add broadcast timing spans | Identify bottleneck |
| 2 | Add delta counters + /metrics | Quantify convergence |
| 3 | Compare TypeScript broadcast impl | Identify differences |
| 4 | Review ACK flow differences | Find drop points |
| 5 | Document findings | Update PERF_EXPERIMENTS.md |

### Week 2: Experiments

| Day | Experiment | Target |
|-----|------------|--------|
| 1-2 | Parallel Broadcast | Scenario C < 5s |
| 3-4 | Delta Batching | Throughput +20% |
| 5 | Best combination | Converge on solution |

### Week 3: Polish

| Day | Task |
|-----|------|
| 1 | Fix framework test timing issues |
| 2 | Run full benchmark suite |
| 3 | Update documentation |
| 4 | PR for main |
| 5 | Buffer |

---

## Success Criteria

| Metric | Current | Target | Stretch |
|--------|---------|--------|---------|
| Scenario C P95 | 12,227 ms | < 500 ms | < 200 ms |
| Convergence | 57% | > 95% | 100% |
| Framework Tests | 253/256 | 256/256 | - |

---

## Quick Reference Commands

```bash
# Run specific scenario
cd tests && EXPERIMENT_NAME=parallel-broadcast SERVER_TYPE=csharp bun run perf/scenarios/burst-recovery.ts

# Check convergence metrics
curl http://localhost:8090/metrics

# Run framework tests only
cd tests && TEST_SERVER_TYPE=external TEST_SERVER_PORT=8090 bun test integration/framework.test.ts

# Profile with dotnet-trace
dotnet-trace collect --process-id $(pgrep -f SyncKit.Server) --duration 00:00:30
```

---

## References

- [PERF_EXPERIMENTS.md](./PERF_EXPERIMENTS.md) - Experiment results tracking
- [Document.cs](../../server/csharp/src/SyncKit.Server/Sync/Document.cs) - Document implementation
- [ActorModelStorageAdapter.cs](../../server/csharp/src/SyncKit.Server/Storage/ActorModelStorageAdapter.cs) - Actor Model implementation
- [ConnectionManager.cs](../../server/csharp/src/SyncKit.Server/WebSockets/ConnectionManager.cs) - Broadcast logic
- [TypeScript coordinator.ts](../../server/typescript/src/sync/coordinator.ts) - Reference implementation
