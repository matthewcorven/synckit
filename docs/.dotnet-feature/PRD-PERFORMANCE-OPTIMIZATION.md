
## Iteration 2: Add aggregated connection send/receive metrics to health

**Date:** 2026-01-13
**Change:** Exposed aggregated connection-level diagnostics (messages enqueued/sent/received, send queue depth) in HealthResponse via ServerStatsService. Also exposed Program.ServiceProvider for best-effort diagnostics and added small diagnostic properties to Connection.
**Files Modified:**
- server/csharp/src/SyncKit.Server/Health/HealthModels.cs
- server/csharp/src/SyncKit.Server/Health/ServerStatsService.cs
- server/csharp/src/SyncKit.Server/WebSockets/Connection.cs
- server/csharp/src/SyncKit.Server/Program.Partial.cs

**Hypothesis:** Aggregated, lightweight send/receive metrics will help identify if message queueing is contributing to timeouts under load. This is Phase A measurement work and should be safe and non-disruptive.

### Results
| Metric | Baseline | This Iteration | Delta |
|--------|----------|----------------|-------|
| Pass Rate | 44/61 (72%) | N/A (not yet run) | N/A |
| Server Stable | Yes | Yes | - |
| Timeouts | 17 | N/A | N/A |

### Evidence
- Health endpoint now includes "totalMessagesEnqueued", "totalMessagesSent", "totalMessagesReceived", and "totalSendQueueDepth" all showing 0 on fresh start.
- Server starts and /health returns successfully.

### Decision
- Action: Keep
- No-change counter: 0
- Next iteration: Phase A - Add PerfView and sampling traces; measure allocation rates and Check channel depths during sustained load tests.
