
## Iteration 1: Add health telemetry (GC counts, ThreadPool, CPU)

**Date:** 2026-01-13
**Change:** Exposed GC collection counts and ThreadPool/Cpu stats in health response via ServerStatsService.GetStats()
**Files Modified:**
- server/csharp/src/SyncKit.Server/Health/HealthModels.cs
- server/csharp/src/SyncKit.Server/Health/ServerStatsService.cs

**Hypothesis:** Adding low-cost telemetry will help identify whether GC/ThreadPool pressure correlates with failing load tests. This is a Phase A measurement change and should be non-disruptive.

### Results
| Metric | Baseline | This Iteration | Delta |
|--------|----------|----------------|-------|
| Pass Rate | 44/61 (72%) | N/A (not yet run) | N/A |
| Server Stable | Yes | Yes | - |
| Timeouts | 17 | N/A | N/A |

### Decision
- Action: Keep
- No-change counter: 0
- Next iteration: Phase A - Add PerfView sampling and more granular metrics (allocation rates, channel depths)
