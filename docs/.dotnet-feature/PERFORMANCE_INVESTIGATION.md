# C# Server Performance Investigation Plan

> **Purpose:** Comprehensive, automated local profiling to identify ALL hot paths causing the 33x latency gap (1,701ms vs 51ms P95).

---

## Current State

| Metric | TypeScript | C# | Gap |
|--------|------------|-----|-----|
| P95 Latency | 51ms | 1,701ms | **33x worse** |
| Max Ops/Sec (Aggregate) | 2,000 | 1,350 | 32% lower |
| Memory Growth | 3.95 MB/min | 0.01 MB/min | C# better |

The latency fix plan (LATENCY_FIX_PLAN.md) improved 80% load latency from 1,213ms to 302ms, but the benchmark still shows 1,701ms P95 - indicating remaining bottlenecks.

---

## Investigation Tools Created

### Tool 1: `profile-csharp-server.sh` (CPU + Memory Profiling)

**What it does:**
1. Installs dotnet-trace, dotnet-counters, dotnet-dump
2. Builds server in Release mode with symbols
3. Starts server with profiling-friendly settings
4. Collects CPU trace (call stacks) during 60s load test
5. Collects performance counters (GC, thread pool, allocations)
6. Runs custom load test with detailed latency tracking
7. Generates analysis report with actionable insights

**Run:**
```bash
cd /Users/core/git/matthewcorven/synckit/tests/perf
./profile-csharp-server.sh
```

**Output:**
- `trace.speedscope.json` - CPU flamegraph (open at https://speedscope.app/)
- `counters-load.csv` - GC, thread pool, socket metrics
- `test-output.log` - Latency distribution
- `analysis-report.md` - Summary and next steps

### Tool 2: `deep-timing-analysis.sh` (Code-Level Instrumentation)

**What it does:**
1. Adds high-resolution timing instrumentation to key server methods
2. Creates `/timing/report` endpoint for real-time analysis
3. Runs focused latency test
4. Extracts phase-by-phase timing breakdown (microsecond precision)
5. Restores original code after analysis

**Run:**
```bash
cd /Users/core/git/matthewcorven/synckit/tests/perf
./deep-timing-analysis.sh
```

**Output:**
- `timing-report.txt` - Phase breakdown (AddToBatch, FlushBatch, BroadcastField, etc.)
- `timing-events.json` - Raw timing events for analysis

---

## Investigation Protocol (Automated)

### Phase 1: Full CPU Profile (15-30 minutes)

```bash
cd /Users/core/git/matthewcorven/synckit/tests/perf
./profile-csharp-server.sh
```

**Analyze:**
1. Open `trace.speedscope.json` at https://www.speedscope.app/
2. Look for functions with high "self time" percentage:
   - `JsonSerializer.Serialize` - JSON overhead
   - `WebSocket.SendAsync` - Network I/O
   - `ConcurrentDictionary.*` - Lock contention
   - `Channel.Writer.TryWrite` - Queue operations
   - `Timer.*` - Timer callback overhead

3. Check `counters-load.csv` for:
   - `gc-heap-size` - Memory growth during test
   - `gen-0-gc-count`, `gen-2-gc-count` - GC frequency
   - `threadpool-queue-length` - Thread pool saturation
   - `alloc-rate` - Allocation rate (high = GC pressure)

### Phase 2: Code-Level Timing (10 minutes)

```bash
cd /Users/core/git/matthewcorven/synckit/tests/perf
./deep-timing-analysis.sh
```

**Analyze timing-report.txt:**
- Which phase has the highest P95 time?
- Is it `AddToBatch`, `FlushBatch`, `BroadcastField`, or something else?
- Compare microsecond timings to the 50ms batch interval

### Phase 3: Compare to TypeScript (Reference)

The TypeScript server flushBatch method (server/typescript/src/websocket/server.ts:389-418):
```typescript
private flushBatch(documentId: string) {
  const batch = this.pendingBatches.get(documentId);
  // ...
  
  // Send individual field updates (SDK format)
  for (const [field, value] of Object.entries(batch.delta)) {
    const subscribers = this.coordinator.getSubscribers(documentId);
    
    for (const connectionId of subscribers) {
      const connection = this.registry.get(connectionId);
      // ...
      connection.send(fieldMessage);  // Direct send, no channel
    }
  }
}
```

**Key differences to investigate:**
1. **Message queuing:** C# uses bounded channel, TypeScript sends directly
2. **Serialization:** C# uses System.Text.Json, TypeScript uses native JSON
3. **Connection tracking:** Both use ConcurrentDictionary
4. **Timer implementation:** C# uses System.Threading.Timer, TypeScript uses setTimeout

---

## Known Bottleneck Candidates

### 1. Send Queue (High Suspicion)

C# Connection.Send() queues to a bounded channel:
```csharp
// Connection.cs line 215-230
_sendQueue.Writer.TryWrite((message, messageType, data))
```

The background `ProcessSendQueueAsync` then sends sequentially. Under load, this creates:
- Queue latency (waiting for earlier messages to send)
- Single-threaded bottleneck per connection

**TypeScript comparison:** Direct `connection.send()` without queuing.

### 2. JSON Serialization (Medium Suspicion)

C# serializes each field message:
```csharp
// DeltaBatchingService.cs line 168
var deltaJson = JsonSerializer.SerializeToElement(singleFieldDelta);
```

For 100 fields, this is 100 serialization calls per flush.

### 3. Timer Callback Overhead (Low-Medium Suspicion)

50ms batch timer fires on ThreadPool:
```csharp
// DeltaBatchingService.cs line 90
newBatch.Timer = new Timer(_ => FlushBatch(docId), null, _batchInterval, ...);
```

Under high load, timer callback may be delayed by ThreadPool saturation.

### 4. ConcurrentDictionary Contention (Low Suspicion)

Multiple ConcurrentDictionary operations:
- `_pendingBatches.GetOrAdd()` - per delta
- `_documentSubscriptions.TryGetValue()` - per broadcast
- `batch.Delta[key] = value` - per field

---

## Success Criteria

After profiling, we should have:

1. **Quantified bottleneck breakdown:**
   - X% of latency in serialization
   - Y% in send queue
   - Z% in broadcast fan-out
   - etc.

2. **Specific methods to optimize:**
   - Method name, file, line number
   - Time spent (microseconds)
   - How it compares to TypeScript

3. **Actionable fix list** (prioritized by impact)

---

## Quick Start

```bash
# Run full profile (recommended first)
cd /Users/core/git/matthewcorven/synckit/tests/perf
./profile-csharp-server.sh

# View results
open results/profile-*/analysis-report.md

# View flamegraph (drag trace.speedscope.json to the site)
open https://www.speedscope.app/
```

---

## Related Files

- [SERVER_PERFORMANCE.md](../architecture/SERVER_PERFORMANCE.md) - Current benchmark results
- [LATENCY_FIX_PLAN.md](./LATENCY_FIX_PLAN.md) - Previous latency investigation
- [DeltaBatchingService.cs](../../server/csharp/src/SyncKit.Server/Services/DeltaBatchingService.cs) - Batching logic
- [Connection.cs](../../server/csharp/src/SyncKit.Server/WebSockets/Connection.cs) - Send queue
- [ConnectionManager.cs](../../server/csharp/src/SyncKit.Server/WebSockets/ConnectionManager.cs) - Broadcast logic
