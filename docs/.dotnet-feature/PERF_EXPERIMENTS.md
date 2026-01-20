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
| **TypeScript (Reference)** | **55 ms** | 83 ms | **136 ms** | 800 ops/s | **100%** | Single-threaded event loop |
| C# Baseline (Simple Lock) | 11,186 ms | 64 ms | 13,329 ms | 823 ops/s | 59.0% | Heavy contention on single doc |
| **C# Actor Model (Channels)** | **63 ms** | **64 ms** | 12,227 ms | 819 ops/s | 57.3% | **177x improvement in Scenario A** |
| C# Striped Locks | 13,311 ms | 64 ms | 11,050 ms | 835 ops/s | 56.3% | Same stripe = same contention |
| C# Dataflow Pipeline | 64 ms | 64 ms | 11,208 ms | 819 ops/s | 59.7% | Similar to Actor Model |

### Key Findings

1. **TypeScript is the gold standard** for Scenario A (55ms) and Scenario C (136ms) - its single-threaded event loop naturally eliminates contention.

2. **C# Actor Model matches TypeScript** in Scenario A (63ms vs 55ms) - only 15% slower, within margin of error.

3. **C# beats TypeScript in Scenario B** (64ms vs 83ms) - multi-threaded C# handles distributed load better.

4. **Scenario C (Burst) is a problem for all C# approaches** (~11-13s vs TypeScript's 136ms) - needs further investigation.

5. **Convergence gap** - TypeScript achieves 100% while C# hovers around 57-60%. This suggests message delivery or timing issues in C#.

> **Benchmark Date:** 2026-01-20 on `feature/11-dotnet-server-perf` branch

## Experiment Details

### Baseline (Simple Lock)

**Branch:** `feature/11-dotnet-server-perf`  
**Status:** Complete

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
- Scenario A P95: **11,186 ms** (severe contention)
- Scenario B P95: **64 ms**
- Scenario C P95: **13,329 ms**
- Throughput: 823 ops/sec
- Convergence: 59.0%

**Analysis:** Single-document contention causes severe latency spikes. The lock becomes a bottleneck when 10 clients send 100 ops/sec to the same document.

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
**Status:** Complete - **WINNER**

Replace `lock` with `Channel<DeltaOperation>` per document. Each document becomes an actor processing operations sequentially.

```csharp
// Implementation
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
- Scenario A P95: **63 ms** (177x improvement!)
- Scenario B P95: **64 ms**
- Scenario C P95: **12,227 ms**
- Throughput: 819 ops/sec
- Convergence: 57.3%

**Analysis:** Eliminates lock contention entirely. Operations queue in the channel and process sequentially, avoiding the thundering herd problem. Scenario A improvement is dramatic.

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
**Status:** Complete

Use a 64-stripe lock array in storage adapter. Documents hash to a stripe, reducing contention across documents.

```csharp
// Implementation
private readonly object[] _stripes = new object[64];

private object GetStripe(string documentId)
{
    var hash = documentId.GetHashCode() & 0x7FFFFFFF;
    return _stripes[hash % _stripes.Length];
}
```

**Hypothesis:** Good balance for multi-doc scenarios while maintaining simplicity.

**Results:**
- Scenario A P95: **13,311 ms** (worse than baseline)
- Scenario B P95: **64 ms**
- Scenario C P95: **11,050 ms**
- Throughput: 835 ops/sec
- Convergence: 56.3%

**Analysis:** Does not help single-document contention (all clients hash to the same stripe). Slightly worse than baseline in Scenario A. Would only help if different documents were being accessed simultaneously.

---

### Experiment D: Dataflow Pipeline

**Branch:** `perf/dataflow`  
**Status:** Complete

Use `System.Threading.Tasks.Dataflow.ActionBlock<T>` with `MaxDegreeOfParallelism=1` per document.

```csharp
// Implementation
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
- Scenario A P95: **64 ms** (same as Actor Model)
- Scenario B P95: **64 ms**
- Scenario C P95: **11,208 ms**
- Throughput: 819 ops/sec
- Convergence: 59.7%

**Analysis:** Very similar to Actor Model. Both eliminate lock contention effectively. Dataflow has slightly more overhead but provides built-in backpressure handling.

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

---

## Conclusion & Recommendation

### Winner: Actor Model (Channels)

Based on the benchmark results, the **Actor Model** implementation is the recommended architecture:

| Criterion | Actor Model | TypeScript | Notes |
|-----------|-------------|------------|-------|
| Scenario A P95 | 63 ms | 55 ms | C# within 15% of TypeScript |
| Scenario B P95 | **64 ms** | 83 ms | C# 23% faster |
| Scenario C P95 | 12,227 ms | **136 ms** | Gap needs investigation |
| Convergence | 57.3% | **100%** | Gap needs investigation |

**Why Actor Model over Dataflow:**
- Nearly identical performance (63ms vs 64ms P95)
- Simpler API (`Channel<T>` vs `ActionBlock<T>`)
- Fewer dependencies (no System.Threading.Tasks.Dataflow NuGet)
- Better control over channel options (bounded capacity, backpressure mode)

**Key Insight:**
Lock contention was causing 11+ second P95 latencies when multiple clients target the same document. The Actor Model completely eliminates this by serializing operations through a channel, achieving near-TypeScript performance in Scenario A.

### Remaining Gaps vs TypeScript

1. **Scenario C (Burst Recovery):** C# takes 12+ seconds vs TypeScript's 136ms. This may be due to:
   - WebSocket write backpressure handling differences
   - Broadcast efficiency (TypeScript may batch better)
   - GC pauses during high allocation periods

2. **Convergence Rate:** C# achieves ~57% vs TypeScript's 100%. Possible causes:
   - Message ordering issues in broadcast
   - ACK handling differences
   - Race conditions in state synchronization

### Next Steps

1. Merge `perf/actor-model` branch into `feature/11-dotnet-server-perf`
2. Update `InMemoryStorageAdapter` to use `ActorDocument` by default
3. Run full integration test suite to verify correctness
4. **Investigate Scenario C gap** - profile burst handling and broadcast paths
5. **Investigate convergence gap** - compare message ordering with TypeScript

---

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
