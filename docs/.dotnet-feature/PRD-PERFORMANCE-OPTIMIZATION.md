
## Iteration 6: Reduce allocations in JSON parsing/serialization

**Date:** 2026-01-13
**Change:** Updated JsonProtocolHandler to parse directly from ReadOnlyMemory<byte> and deserialize from Span/bytes where possible to avoid allocating intermediate strings on serialize/deserialize paths. Also switched to JsonSerializer.SerializeToUtf8Bytes for serialization to avoid UTF8 encoding allocations.
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
- dotnet-counters and dotnet-trace are not available in the environment; attempted to run allocation profiling but collectors were not found. Saved run logs to tests/docs/tuning-results/iteration-6-run.log.
- Build succeeded and short integration runs show slight improvement in pass rate and reduced timeouts.

### Decision
- Action: Keep
- No-change counter: 0
- Next iteration: Phase C - ensure we can run allocation profiling (install dotnet-trace/dotnet-counters) in CI or local environment; consider pooling JSON serializer or reduce allocation hotspots in Binary handler payload construction.
