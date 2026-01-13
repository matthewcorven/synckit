# Product Requirements Document: .NET Server Performance Optimization

**Version:** 1.0  
**Date:** January 13, 2026  
**Status:** Active Development  
**Methodology:** Ralph Loop - Evidence-Based Iterative Improvement

---

## Executive Summary

The SyncKit .NET server currently achieves 44/61 (72%) pass rate on load tests with conservative throttle settings (Accept=20/Creation=10). Attempts to relax throttling degraded performance to 36.5%. This PRD outlines a systematic approach to fundamentally improve the server's concurrent connection handling and throughput by applying Microsoft ASP.NET Core best practices and architectural optimizations.

**Goal:** Achieve ≥90% load test pass rate (55+/61 tests) with improved concurrency handling.

---

## Problem Statement

### Current State

| Metric | Value | Status |
|--------|-------|--------|
| Load Test Pass Rate | 44/61 (72%) | ⚠️ Below target |
| Semaphore Throttling | Accept=20, Creation=10 | 🔒 Conservative |
| Timeout Failures | 17/61 tests | ❌ High |
| Server Crashes | 0 | ✅ Stable |
| Concurrency Limit | ~200 connections | ⚠️ Limited |

### Root Causes Identified

1. **Semaphore Overhead:** Throttling at 20/10 prevents crashes but introduces queueing latency
2. **Sync-over-Async Patterns:** Potential blocking operations in hot paths
3. **Memory Pressure:** Large document handling (10K+ fields) causes timeouts
4. **Thread Pool Starvation:** High connection bursts may exhaust thread pool
5. **Channel Backpressure:** Unbounded channels may create memory pressure

### Evidence from Throttle Tuning

- Baseline (20/10): 44/61 tests pass (72%)
- Relaxed (100/50): 23/63 tests pass (36.5%) - **50% DEGRADATION**
- **Conclusion:** Simple throttle relaxation makes performance WORSE

---

## Success Criteria

### Primary Goals (P0)

1. **Load Test Pass Rate ≥ 90%** (55+/61 tests passing)
2. **Server Stability** maintained (zero crashes under load)
3. **Large Document Handling** (10K fields test passes)
4. **Sustained Load** (10-minute stability test passes)
5. **Burst Traffic** (200+ concurrent connections handled)

### Secondary Goals (P1)

1. **Eliminate Throttling** OR reduce to minimal values (Accept=50+, Creation=25+)
2. **Reduce Timeout Failures** by 75% (≤5 timeout failures)
3. **Memory Efficiency** (no OutOfMemory exceptions)
4. **Latency Reduction** (p99 latency <500ms for single operations)

### Evidence Requirements

Each iteration MUST provide:
- Full load test results (pass/fail counts)
- Server stability confirmation (health check after tests)
- Baseline comparison (vs 44/61)
- Performance metrics (memory, CPU, latency if available)

---

## Microsoft Best Practices to Apply

### 1. Avoid Blocking Calls (CRITICAL)

**Current Risk:** WebSocket accept/connection creation may have blocking operations

**Actions:**
- Audit all WebSocket middleware for `Task.Wait()`, `Task.Result`, `.GetAwaiter().GetResult()`
- Ensure `AcceptWebSocketAsync()` is truly async
- Verify ConnectionManager uses only async APIs
- Profile with PerfView to detect thread pool starvation

**References:**
- [ASP.NET Core Best Practices - Avoid Blocking](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/best-practices#avoid-blocking-calls)

### 2. Minimize Large Object Allocations

**Current Risk:** 10K field documents likely hit LOH (>85KB)

**Actions:**
- Use `ArrayPool<byte>` for WebSocket buffer management
- Implement streaming deserialization for large documents
- Cache frequently accessed document states
- Profile GC with PerfView (Gen2 collections indicate LOH pressure)

**References:**
- [Large Object Heap Optimization](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/large-object-heap)

### 3. Optimize Kestrel Configuration

**Current Config:** Using defaults (may be suboptimal)

**Actions:**
- Configure `MaxConcurrentConnections` / `MaxConcurrentUpgradedConnections`
- Tune HTTP/2 limits (if applicable): `MaxStreamsPerConnection`
- Disable `AllowSynchronousIO` to catch blocking patterns
- Configure keep-alive timeouts appropriately

**References:**
- [Kestrel Options](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/servers/kestrel/options)

### 4. Channel Configuration & Backpressure

**Current Risk:** Unbounded channels may grow without limit

**Actions:**
- Consider bounded channels with backpressure policies
- Implement flow control for send queues
- Monitor channel depths during load tests
- Use `Channel<T>.Writer.TryWrite()` with capacity checks

### 5. ThreadPool Configuration

**Current Risk:** Default thread pool may be insufficient for burst traffic

**Actions:**
- Configure `ThreadPool.SetMinThreads()` for faster response to bursts
- Monitor thread pool queue length under load
- Use `Task.Run()` judiciously (avoid in hot paths)

**References:**
- [Thread Pool Starvation](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/debug-threadpool-starvation)

### 6. Replace Semaphore Throttling with Better Patterns

**Current Issue:** Semaphores are causing queueing delays

**Alternatives to Investigate:**
1. **Rate Limiting Middleware** (more sophisticated than semaphores)
2. **Adaptive Concurrency Control** (dynamically adjust based on metrics)
3. **Platform-Specific Guards** (only throttle on macOS where socket race occurs)
4. **Kestrel Transport Options** (low-level socket configuration)
5. **Remove Throttling Entirely** and fix underlying socket race with kernel tuning

---

## Architecture Improvements Roadmap

### Phase A: Measurement & Profiling (1-2 iterations)

**Objective:** Establish baseline metrics and identify hot paths

**Tasks:**
1. Add comprehensive performance telemetry (memory, CPU, GC, thread pool)
2. Profile with PerfView during load tests
3. Identify blocking operations in hot paths
4. Measure channel queue depths
5. Profile Gen2 GC collections (LOH pressure indicator)

**Evidence:** PerfView trace, telemetry dashboard, hot path analysis

### Phase B: Quick Wins - Async/Await Audit (2-3 iterations)

**Objective:** Eliminate sync-over-async patterns

**Tasks:**
1. Audit WebSocket middleware for blocking calls
2. Audit ConnectionManager for blocking calls
3. Audit message handlers for blocking calls
4. Replace any `Task.Wait()` / `Task.Result` with `await`
5. Verify all I/O operations are async

**Evidence:** Load test improvement, PerfView showing reduced thread pool waits

### Phase C: Memory Optimization (3-4 iterations)

**Objective:** Reduce LOH allocations and GC pressure

**Tasks:**
1. Implement `ArrayPool<byte>` for WebSocket buffers
2. Implement streaming JSON deserialization for large documents
3. Add caching for frequently accessed document states
4. Optimize delta message serialization
5. Profile GC behavior before/after changes

**Evidence:** Reduced Gen2 collections, large document tests passing

### Phase D: Kestrel & ThreadPool Tuning (2-3 iterations)

**Objective:** Optimize server configuration for high concurrency

**Tasks:**
1. Configure `MaxConcurrentConnections` appropriately
2. Configure `MaxConcurrentUpgradedConnections` for WebSockets
3. Tune HTTP/2 settings (if used)
4. Configure `ThreadPool.SetMinThreads()` for burst handling
5. Disable `AllowSynchronousIO` to enforce async patterns

**Evidence:** Burst traffic tests passing, sustained load stability

### Phase E: Channel & Backpressure (2-3 iterations)

**Objective:** Prevent unbounded memory growth in send queues

**Tasks:**
1. Evaluate bounded vs unbounded channels
2. Implement backpressure policies for send queues
3. Add flow control to prevent overwhelming clients
4. Monitor and log channel queue depths
5. Implement circuit breakers for unhealthy connections

**Evidence:** Memory stability under sustained load, no OutOfMemory errors

### Phase F: Throttle Replacement (3-4 iterations)

**Objective:** Replace semaphore throttling with better concurrency control

**Tasks:**
1. Implement rate limiting middleware (per-IP, global)
2. Evaluate adaptive concurrency control algorithms
3. Implement platform-specific socket tuning (macOS kernel parameters)
4. Test removing throttling entirely with above improvements
5. A/B test different concurrency strategies

**Evidence:** ≥90% test pass rate, stable with higher concurrency limits

---

## Server Startup & Testing Instructions

### Kill Existing Server Instances

```bash
lsof -ti:8090 | xargs kill -9 2>/dev/null || echo "No server on port 8090"
```

### Build Server (Release Mode)

```bash
cd /Users/core/git/matthewcorven/synckit/server/csharp/src/SyncKit.Server
dotnet build --configuration Release
```

### Start Server (Terminal 1 - Dedicated)

```bash
cd /Users/core/git/matthewcorven/synckit/server/csharp/src/SyncKit.Server
SYNCKIT_SERVER_URL=http://localhost:8090 \
SYNCKIT_AUTH_REQUIRED=false \
JWT_SECRET='test-secret-key-for-integration-tests-only-32-chars' \
dotnet run --configuration Release
```

**Wait for:** "Application started" message

### Check Server Health (Terminal 2)

```bash
# Wait 2 seconds for server startup
sleep 2

# Health check (should return {"status":"ok"})
curl -s http://localhost:8090/health
```

### Run Full Load Test Suite (Terminal 2)

```bash
cd /Users/core/git/matthewcorven/synckit/tests
TEST_SERVER_TYPE=external TEST_SERVER_PORT=8090 \
  bun test load/ --timeout 1200000 2>&1 | \
  tee /tmp/load-test-iter-$(date +%Y%m%d-%H%M%S).log
```

**Expected Duration:** ~9 hours for full suite

### Extract Test Results

```bash
# From test output, look for:
# "X pass"
# "Y skip" 
# "Z fail"
```

---

## Ralph Loop Integration

### How to Start

Read the full prompt in [RALPH-LOOP-PROMPT.md](RALPH-LOOP-PROMPT.md), then execute:

```bash
/ralph-loop "[paste prompt from RALPH-LOOP-PROMPT.md]. Output <promise>COMPLETE</promise> when done." --completion-promise "COMPLETE" --max-iterations 50
```

### Iteration Workflow

Each iteration follows this workflow:

1. **Select Change:** Pick ONE improvement from phases below (start Phase A)
2. **Modify Code:** Make the change in appropriate files
3. **Build:** `cd /Users/core/git/matthewcorven/synckit/server/csharp/src/SyncKit.Server && dotnet build --configuration Release`
4. **Kill Server:** `lsof -ti:8090 | xargs kill -9 2>/dev/null || echo "No server running"`
5. **Start Server:** 
   ```bash
   cd /Users/core/git/matthewcorven/synckit/server/csharp/src/SyncKit.Server
   SYNCKIT_SERVER_URL=http://localhost:8090 \
   SYNCKIT_AUTH_REQUIRED=false \
   JWT_SECRET='test-secret-key-for-integration-tests-only-32-chars' \
   dotnet run --configuration Release &
   ```
6. **Health Check:** `sleep 3 && curl -s http://localhost:8090/health` (should return `{"status":"healthy"}`)
7. **Run Tests:**
   ```bash
   cd /Users/core/git/matthewcorven/synckit/tests
   TEST_SERVER_TYPE=external TEST_SERVER_PORT=8090 \
     bun test load/ --timeout 1200000 2>&1 | \
     tee /tmp/load-test-iter-$(date +%Y%m%d-%H%M%S).log
   ```
8. **Extract Results:** Count "X pass", "Y skip", "Z fail" from test output
9. **Document:** Update this PRD with iteration results (template below)
10. **Decide:**
    - Pass rate improved >2%: ✅ KEEP change, commit, reset counter to 0
    - Pass rate unchanged (±2%): ⚠️ INCREMENT counter, consider keeping if neutral
    - Pass rate regressed >2%: ❌ REVERT immediately, increment counter
    - Server crashed: ❌ REVERT IMMEDIATELY
11. **Stop Check:**
    - No-change counter = 5: STOP (ceiling reached)
    - Pass rate ≥55/61: STOP (goal achieved)
    - Server unstable: STOP (crisis)

### Critical Rules

- ✅ ONE change per iteration (no exceptions)
- ✅ ALWAYS run full load tests (no shortcuts)
- ✅ ALWAYS check server health after tests
- ✅ REVERT immediately if server crashes or regresses >2%
- ✅ DOCUMENT every iteration with evidence
- ✅ COMPARE to baseline (44/61) every iteration
- ✅ START with Phase A (measurement) - low risk, high value

### Evidence Template (per iteration)

```markdown
## Iteration N: [Change Description]

**Date:** YYYY-MM-DD
**Change:** Brief description of code/config change
**Files Modified:** [list files]
**Hypothesis:** Why this should improve performance

### Results
| Metric | Baseline | This Iteration | Delta |
|--------|----------|----------------|-------|
| Pass Rate | 44/61 (72%) | X/61 (Y%) | ±Z% |
| Server Stable | Yes | Yes/No | - |
| Timeouts | 17 | X | ±Y |

### Decision
- Action: Keep/Revert/NoChange
- No-change counter: N (stop at 5)
- Next iteration: [focus area]
```

### Stop Conditions

1. ✅ **Goal Achieved:** ≥55/61 tests passing (90%)
2. ⏹️ **Ceiling Reached:** 5 consecutive iterations without improvement
3. ❌ **Crisis:** Server becomes unstable (crashes, OutOfMemory)

### Completion Format

```
<promise>COMPLETE</promise>

Final Results:
- Best Pass Rate: X/61 (Y%)
- Total Iterations: N
- Key Improvements: [list]
- Remaining Issues: [list]
- Recommendation: [next steps or conclusion]
```

---

## Risk Management

### High-Risk Changes

1. **Removing throttling entirely** - May reintroduce macOS socket race condition
   - **Mitigation:** Test incrementally (Accept=50, 100, 200, unlimited)
   - **Rollback:** Restore semaphores if crashes occur

2. **Bounded channels** - May deadlock if not implemented correctly
   - **Mitigation:** Thorough unit tests, gradual rollout
   - **Rollback:** Revert to unbounded channels

3. **ThreadPool min threads** - Incorrect values may hurt performance
   - **Mitigation:** Research recommended values, start conservative
   - **Rollback:** Restore defaults

### Test Safety

- Always maintain server stability as P0 requirement
- Run health check after EVERY test iteration
- Keep baseline configuration in git for quick rollback
- Log all configuration changes in iteration notes

---

## Success Metrics Summary

| Metric | Current | Target | Stretch Goal |
|--------|---------|--------|--------------|
| **Load Test Pass Rate** | 72% (44/61) | 90% (55/61) | 95% (58/61) |
| **Server Crashes** | 0 | 0 | 0 |
| **Timeout Failures** | 17 | ≤5 | 0 |
| **Max Concurrency** | ~200 | 500+ | 1000+ |
| **10K Fields Test** | Timeout | Pass | Pass |
| **Sustained Load Test** | Timeout | Pass | Pass |

---

## Timeline Estimate

- **Phase A (Measurement):** 2-3 days
- **Phase B (Async Audit):** 3-5 days
- **Phase C (Memory):** 5-7 days
- **Phase D (Kestrel/ThreadPool):** 3-5 days
- **Phase E (Channels):** 3-5 days
- **Phase F (Throttle Replacement):** 5-7 days

**Total:** 21-32 days (with Ralph Loop iterations)

**Stop Condition:** Achieved if 5 consecutive iterations yield no improvement

---

## References

- [ASP.NET Core Performance Best Practices](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/best-practices)
- [Kestrel Configuration Options](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/servers/kestrel/options)
- [.NET Thread Pool Starvation Debugging](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/debug-threadpool-starvation)
- [Large Object Heap Optimization](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/large-object-heap)
- [Ralph Loop Methodology](https://github.com/rot13maxi/opencode-ralph)

---

## Document History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-13 | 1.0 | Initial PRD based on throttle tuning results |

