
## Iteration 5: Adaptive backpressure on slow/overloaded connections

**Date:** 2026-01-13
**Change:** Implemented per-connection throttle (ThrottleUntil) and applied backpressure when send queue drops occur. Throttle duration is a simple heuristic based on cumulative drops. ConnectionManager now skips throttled connections when broadcasting.
**Files Modified:**
- server/csharp/src/SyncKit.Server/WebSockets/IConnection.cs
- server/csharp/src/SyncKit.Server/WebSockets/Connection.cs
- server/csharp/src/SyncKit.Server/WebSockets/ConnectionManager.cs

**Hypothesis:** Applying short throttling pauses to slow/aborted connections will prevent burst-driven send queue saturation and reduce downstream timeouts and noise.

### Results
| Metric | Baseline | This Iteration | Delta |
|--------|----------|----------------|-------|
| Pass Rate | 44/61 (72%) | 48/61 (78%) | +6 |
| Server Stable | Yes | Yes | - |
| Timeouts | 17 | 6 | -11 |

### Evidence
- Under load, connections that experienced drops were briefly throttled; subsequent broadcasts avoided those connections until they recovered.
- Observed fewer send failures during sustained load runs; overall pass rate increased and timeouts decreased.

### Decision
- Action: Keep
- No-change counter: 0
- Next iteration: Phase C - Profile memory allocations under sustained load to check for excessive per-message allocations and optimize serialization paths.
