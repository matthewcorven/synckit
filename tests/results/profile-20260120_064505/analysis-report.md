# C# Server Performance Profile Analysis

**Generated:** 2026-01-20T06:46:43-05:00
**Duration:** 60s
**Connections:** 100
**Ops/sec Target:** 500

## Files Generated

| File | Description |
|------|-------------|
| `trace.nettrace` | CPU trace (open with Visual Studio / PerfView) |
| `trace.speedscope.json` | Flamegraph (open at speedscope.app) |
| `counters-baseline.csv` | Idle performance counters |
| `counters-load.csv` | Under-load performance counters |
| `test-output.log` | Test results with latency stats |
| `server.log` | Server logs during profiling |

## Quick Analysis

### Test Results
Results:
  Sent:           30000
  Received:       15726 (52.4%)
  Min Latency:    2ms
  Avg Latency:    1999.1ms
  P50 Latency:    61ms
  P95 Latency:    14637ms
  P99 Latency:    26214ms
  Max Latency:    29803ms

{
  "stats": {
    "totalSent": 30000,
    "totalReceived": 15726,
    "convergenceRate": 0.5242,
    "minLatency": 2,
    "maxLatency": 29803,
    "avgLatency": 1999.1099453134937,
    "p50": 61,
    "p95": 14637,
    "p99": 26214,

### How to Identify Hot Paths

1. **CPU Profile Analysis:**
   - Open `trace.speedscope.json` at https://www.speedscope.app/
   - Look for functions with high "self time" (time spent in the function itself)
   - Sort by "total time" to see call tree impact

2. **Key Methods to Investigate:**
   - `DeltaBatchingService.FlushBatch` - Batching and broadcast
   - `Connection.Send` - Message serialization and queuing
   - `ConnectionManager.BroadcastToDocumentAsync` - Fan-out logic
   - `JsonProtocolHandler.Serialize` - JSON serialization
   - `BinaryProtocolHandler.Serialize` - Binary serialization
   - `WebSocket.SendAsync` - Actual network send

3. **GC Pressure:**
   - Check `counters-load.csv` for "gc-heap-size" growth
   - Look for "gen-0-gc-count", "gen-1-gc-count", "gen-2-gc-count"
   - High Gen2 GCs indicate memory pressure

4. **Thread Pool Starvation:**
   - Check `counters-load.csv` for "threadpool-queue-length"
   - Values > 0 indicate thread pool saturation
   - Check "threadpool-thread-count" vs expected parallelism

## Counter Analysis

### Key Metrics from Load Test

```
Timestamp,Provider,Counter Name,Counter Type,Mean/Increment
01/20/2026 06:45:10,System.Runtime,dotnet.process.memory.working_set (By),Metric,150847488
01/20/2026 06:45:10,System.Runtime,dotnet.gc.last_collection.heap.size (By)[gc.heap.generation=loh],Metric,0
01/20/2026 06:45:10,System.Runtime,dotnet.gc.last_collection.heap.size (By)[gc.heap.generation=gen0],Metric,0
01/20/2026 06:45:10,System.Runtime,dotnet.gc.last_collection.heap.size (By)[gc.heap.generation=gen1],Metric,0
01/20/2026 06:45:10,System.Runtime,dotnet.gc.last_collection.heap.size (By)[gc.heap.generation=poh],Metric,0
01/20/2026 06:45:10,System.Runtime,dotnet.gc.last_collection.heap.size (By)[gc.heap.generation=gen2],Metric,0
01/20/2026 06:45:10,System.Runtime,dotnet.gc.last_collection.heap.fragmentation.size (By)[gc.heap.generation=loh],Metric,0
01/20/2026 06:45:10,System.Runtime,dotnet.gc.last_collection.heap.fragmentation.size (By)[gc.heap.generation=gen0],Metric,0
01/20/2026 06:45:10,System.Runtime,dotnet.gc.last_collection.heap.fragmentation.size (By)[gc.heap.generation=gen1],Metric,0
01/20/2026 06:45:10,System.Runtime,dotnet.gc.last_collection.heap.fragmentation.size (By)[gc.heap.generation=poh],Metric,0
01/20/2026 06:45:10,System.Runtime,dotnet.gc.last_collection.heap.fragmentation.size (By)[gc.heap.generation=gen2],Metric,0
01/20/2026 06:45:10,System.Runtime,dotnet.gc.last_collection.memory.committed_size (By),Metric,0
01/20/2026 06:45:10,System.Runtime,dotnet.process.cpu.count ({cpu}),Metric,16
01/20/2026 06:45:10,System.Runtime,dotnet.assembly.count ({assembly}),Metric,62
01/20/2026 06:45:10,System.Runtime,dotnet.timer.count ({timer}),Metric,0
01/20/2026 06:45:11,System.Runtime,dotnet.process.memory.working_set (By),Metric,151158784
01/20/2026 06:45:11,System.Runtime,dotnet.jit.compiled_il.size (By / 1 sec),Rate,15233
01/20/2026 06:45:11,System.Runtime,dotnet.jit.compiled_methods ({method} / 1 sec),Rate,128
01/20/2026 06:45:11,System.Runtime,dotnet.gc.pause.time (s / 1 sec),Rate,0
...(see full file for more)
```

## Next Steps

Based on the profile results:

1. **If CPU-bound:** Optimize hot methods identified in speedscope
2. **If GC-bound:** Reduce allocations (pooling, spans, etc.)
3. **If I/O-bound:** Check WebSocket send patterns
4. **If Thread-bound:** Increase parallelism or reduce contention

---
*Profile collected from: /Users/core/git/matthewcorven/synckit/server/csharp/src/SyncKit.Server*
