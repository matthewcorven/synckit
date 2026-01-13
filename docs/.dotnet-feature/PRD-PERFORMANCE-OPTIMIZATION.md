
## Iteration 6: Reduce allocations in JSON parsing/serialization

**Date:** 2026-01-13
**Change:** Updated JsonProtocolHandler to parse directly from ReadOnlyMemory<byte> and deserialize from Span/bytes where possible to avoid allocating intermediate strings on serialize/deserialize paths. This reduces per-message allocation pressure.
**Files Modified:**
- server/csharp/src/SyncKit.Server/WebSockets/Protocol/JsonProtocolHandler.cs

**Hypothesis:** Eliminating the UTF-8 string intermediate will lower GC pressure under sustained load and reduce GC-triggered pauses.

### Results
| Metric | Baseline | This Iteration | Delta |
|--------|----------|----------------|-------|
| Pass Rate | 48/61 (78%) | 49/61 (80%) | +2 |
| Server Stable | Yes | Yes | - |
| Timeouts | 6 | 4 | -2 |

### Evidence
- Builds succeeded and short integration runs show slight improvement in pass rate and reduced timeouts.
- Memory profiling planned next (PerfView allocation sampling) to validate allocation reduction under sustained high concurrency.

### Decision
- Action: Keep
- No-change counter: 0
- Next iteration: Phase C - Run PerfView/dotnet-trace allocation sampling and analyze hot paths; consider pooling payload buffers for Binary handler.
