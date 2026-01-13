
## Iteration 3: Add per-connection EventCounters (Meter) for enqueued/sent/received

**Date:** 2026-01-13
**Change:** Added System.Diagnostics.Metrics Meter counters on Connection for enqueued/sent/received messages and registered server-level observable gauges for memory and aggregated send queue depth. This enables low-overhead sampling with PerfView and OTel in later iterations.
**Files Modified:**
- server/csharp/src/SyncKit.Server/WebSockets/Connection.cs
- server/csharp/src/SyncKit.Server/Health/ServerStatsService.cs

**Hypothesis:** Low-overhead meters and observables will make it easier to correlate high send queue depths and GC pressure with failing tests.

### Results
| Metric | Baseline | This Iteration | Delta |
|--------|----------|----------------|-------|
| Pass Rate | 44/61 (72%) | N/A (not yet run) | N/A |
| Server Stable | Yes | Yes | - |
| Timeouts | 17 | N/A | N/A |

### Evidence
- Health endpoint remains functional and returns zeroed aggregate metrics on fresh start.
- No observable perf regression from adding Meter counters in local smoke tests.

### Decision
- Action: Keep
- No-change counter: 0
- Next iteration: Phase A - Add PerfView scripts and a short sampling run to capture call stacks and allocation rates under load.
