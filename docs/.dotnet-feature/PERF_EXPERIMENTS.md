# C# Server Performance Experiments

> **Purpose:** Track and compare different architectural approaches to reduce P95 latency in the SyncKit C# server.

## Overview

This document tracks the results of performance experiments testing different concurrency patterns for the C# server. The goal is to identify the best architecture for minimizing P95 latency while maintaining throughput and reliability.

## Test Scenarios

All experiments are measured against the same 3 scenarios:

| Scenario | Clients | Documents | Ops/Sec/Client | Total Ops/Sec | Duration | Measures |
|----------|---------|-----------|----------------|---------------|----------|----------|
| **A: Single-Doc Contention** | 10 | 1 | 100 | 1,000 | 30s | Lock contention |
| **B: Multi-Doc Distribution** | 100 | 100 | 10 | 1,000 | 30s | Overhead without contention |
| **C: Burst + Recovery** | 50 | 10 | burst 100 | 5,000 peak | 10s + 20s | Queue depth, recovery |

## Results Comparison

| Experiment | Scenario A P95 | Scenario B P95 | Scenario C P95 | Throughput | Convergence | Notes |
|------------|----------------|----------------|----------------|------------|-------------|-------|
| + Quick-wins | **53 ms** | **66 ms** | **55 ms** | 817 ops/s | 100% | Pre-sized collections, inlining, cached timestamps |
| Actor Model (Channels) | TBD | TBD | TBD | TBD | TBD | Channel<T> per document |
| Single-threaded | TBD | TBD | TBD | TBD | TBD | Global event loop |
| Striped Locks | TBD | TBD | TBD | TBD | TBD | 64-stripe lock array |
| Dataflow Pipeline | TBD | TBD | TBD | TBD | TBD | ActionBlock<T> per document |

> **Baseline captured:** 2026-01-20 with quick-wins optimizations applied to `feature/11-dotnet-server-perf`

## Experiment Details

### Baseline (Simple Lock)

**Branch:** `feature/11-dotnet-server-perf`  
**Status:** Pending

Current implementation uses a simple `lock` (Monitor) in `Document.cs` for all state mutations.

```csharp
// Current pattern
private readonly object _stateLock = new();

public void AddDelta(StoredDelta delta)
{
    lock (_stateLock)
    {
        _deltas.Add(delta);
        // ...
    }
}
```

**Results:**
- Scenario A P95: TBD ms
- Scenario B P95: TBD ms
- Scenario C P95: TBD ms
- Throughput: TBD ops/sec
- Memory: TBD MB

---

### Quick-wins Optimizations

**Branch:** `feature/11-dotnet-server-perf` (after optimization)  
**Status:** Pending

Micro-optimizations applied before architectural changes:
- Pre-sized collections (List, Dictionary)
- `ArrayPool<byte>` for buffer management
- `[MethodImpl(AggressiveInlining)]` on hot paths
- Cached timestamps to avoid repeated `DateTime.UtcNow` calls

**Results:**
- Scenario A P95: TBD ms
- Scenario B P95: TBD ms
- Scenario C P95: TBD ms
- Throughput: TBD ops/sec
- Memory: TBD MB

---

### Experiment A: Actor Model (Channels)

**Branch:** `perf/actor-model`  
**Status:** Pending

Replace `lock` with `Channel<DeltaOperation>` per document. Each document becomes an actor processing operations sequentially.

```csharp
// Proposed pattern
private readonly Channel<DeltaOperation> _opChannel;

public async ValueTask AddDeltaAsync(StoredDelta delta)
{
    await _opChannel.Writer.WriteAsync(new DeltaOperation { Delta = delta });
}

private async Task ProcessOperations()
{
    await foreach (var op in _opChannel.Reader.ReadAllAsync())
    {
        // Process without lock - single consumer
    }
}
```

**Hypothesis:** Better for Scenario A (single-doc contention) due to ordered processing without lock overhead.

**Results:**
- Scenario A P95: TBD ms
- Scenario B P95: TBD ms
- Scenario C P95: TBD ms
- Throughput: TBD ops/sec
- Memory: TBD MB

---

### Experiment B: Single-threaded Event Loop

**Branch:** `perf/single-threaded`  
**Status:** Pending

Single global `Channel<Func<ValueTask>>` with one consumer thread. All document operations serialized through one thread.

```csharp
// Proposed pattern
private static readonly Channel<Func<ValueTask>> _eventLoop;

public static async ValueTask EnqueueAsync(Func<ValueTask> operation)
{
    await _eventLoop.Writer.WriteAsync(operation);
}
```

**Hypothesis:** Eliminates all lock contention but may bottleneck under multi-doc scenarios.

**Results:**
- Scenario A P95: TBD ms
- Scenario B P95: TBD ms
- Scenario C P95: TBD ms
- Throughput: TBD ops/sec
- Memory: TBD MB

---

### Experiment C: Striped Locking

**Branch:** `perf/striped-locks`  
**Status:** Pending

Use a 64-stripe lock array in `InMemoryStorageAdapter`. Documents hash to a stripe, reducing contention.

```csharp
// Proposed pattern
private readonly object[] _stripes = new object[64];

private object GetStripe(string documentId)
{
    var hash = documentId.GetHashCode() & 0x7FFFFFFF;
    return _stripes[hash % _stripes.Length];
}
```

**Hypothesis:** Good balance for multi-doc scenarios while maintaining simplicity.

**Results:**
- Scenario A P95: TBD ms
- Scenario B P95: TBD ms
- Scenario C P95: TBD ms
- Throughput: TBD ops/sec
- Memory: TBD MB

---

### Experiment D: Dataflow Pipeline

**Branch:** `perf/dataflow`  
**Status:** Pending

Use `System.Threading.Tasks.Dataflow.ActionBlock<T>` with `MaxDegreeOfParallelism=1` per document.

```csharp
// Proposed pattern
private readonly ActionBlock<StoredDelta> _processor;

public Document(string id)
{
    _processor = new ActionBlock<StoredDelta>(
        ProcessDelta,
        new ExecutionDataflowBlockOptions { MaxDegreeOfParallelism = 1 }
    );
}
```

**Hypothesis:** Built-in batching and backpressure may help with Scenario C (burst recovery).

**Results:**
- Scenario A P95: TBD ms
- Scenario B P95: TBD ms
- Scenario C P95: TBD ms
- Throughput: TBD ops/sec
- Memory: TBD MB

---

## How to Run Experiments

### Local Testing

```bash
# 1. Start the C# server (Terminal 1)
cd server/csharp/src/SyncKit.Server
ASPNETCORE_ENVIRONMENT=Production \
SYNCKIT_SERVER_URL=http://localhost:8090 \
SYNCKIT_AUTH_REQUIRED=false \
JWT_SECRET='test-secret-key-for-integration-tests-only-32-chars' \
dotnet run --configuration Release

# 2. Run scenarios (Terminal 2)
cd tests
EXPERIMENT_NAME=baseline-simple-lock \
SERVER_TYPE=csharp \
SERVER_PORT=8090 \
bun run perf/scenarios/run-all.ts
```

### CI Workflow

Push to any `perf/*` branch to trigger automatic testing:

```bash
git checkout -b perf/my-experiment
# Make changes
git push origin perf/my-experiment
# CI runs all scenarios and posts results
```

---

## Decision Criteria

The winning architecture will be selected based on:

1. **P95 Latency** (primary) - Lower is better, especially for Scenario A
2. **Throughput** - Must maintain current baseline
3. **Memory stability** - No significant growth over time
4. **Code complexity** - Simpler solutions preferred if metrics are similar
5. **Burst recovery** - Scenario C recovery time

---

## Timeline

| Week | Activity |
|------|----------|
| 1 | Baseline + Quick-wins |
| 2 | Experiments A & B |
| 3 | Experiments C & D |
| 4 | Analysis + Winner merge |

---

## References

- [PERFORMANCE_OPTIMIZATION_PLAN.md](./PERFORMANCE_OPTIMIZATION_PLAN.md) - Original optimization plan
- [SERVER_PERFORMANCE.md](../architecture/SERVER_PERFORMANCE.md) - General performance benchmarks
- [Document.cs](../../server/csharp/src/SyncKit.Server/Sync/Document.cs) - Current implementation
