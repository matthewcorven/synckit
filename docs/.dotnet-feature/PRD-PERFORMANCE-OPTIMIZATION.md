
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
| Pass Rate | 44/61 (72%) | 44/61 (72%) | 0 |
| Server Stable | Yes | Yes | - |
| Timeouts | 17 | 12 | -5 (improvement)

### Evidence
- Ran full integration suite against .NET server (logs saved to tests/docs/tuning-results/iteration-3-load.log).
- Observed several occurrences of `Send queue full` warnings in logs under high-concurrency tests, indicating the server dropped messages when client closed unexpectedly. Aggregated send queue depths remained low when traced.
- No GC pressure observed in short runs; allocation rate appears moderate.

### Decision
- Action: Keep
- No-change counter: 0
- Next iteration: Phase B - Address send/drop behavior when clients disconnect unexpectedly; add defensive checks and metrics for message drops and failed sends, and ensure server doesn't throw when send fails.
