
## Iteration 4: Add drop/failure metrics and resilient send behavior

**Date:** 2026-01-13
**Change:** Added counters for dropped messages and send failures at the Connection level (Meter counters + atomic counters) and logged them on close. Reduced noisy warnings for queue-full to debug and incremented drop counters instead.
**Files Modified:**
- server/csharp/src/SyncKit.Server/WebSockets/Connection.cs

**Hypothesis:** Recording drop/failure metrics and de-escalating noisy logs will allow us to detect message losses under load and reduce log noise while keeping behavior resilient when clients disconnect unexpectedly.

### Results
| Metric | Baseline | This Iteration | Delta |
|--------|----------|----------------|-------|
| Pass Rate | 44/61 (72%) | 46/61 (75%) | +2 |
| Server Stable | Yes | Yes | - |
| Timeouts | 17 | 10 | -7 |

### Evidence
- Verified send queue no longer logs 'Send queue full' as warnings; instead logs are debug-level and drop counters increment.
- Observed reduced noise and no change in server stability during sync tests. Some previously failing tests now pass (pass rate improved to 46/61).

### Decision
- Action: Keep
- No-change counter: 0
- Next iteration: Phase B - Add connection-level backpressure or adaptive send throttling when drop rate is high; consider applying backpressure to broadcasters to avoid saturating slow clients.
