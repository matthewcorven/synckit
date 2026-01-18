# PRD: C# Server Performance Testing

> **Status:** In Progress  
> **Last Updated:** 2026-01-17  
> **Branch:** `feature/11-dotnet-server-perf`  
> **Loop Compatible:** Yes (RALPH Loop - read, act, update, exit)

---

## 0. Progress Tracker

> **RALPH LOOP INSTRUCTIONS:** Each iteration, read this section FIRST. Find the next unchecked task under "Next Up", execute ONLY that task, update this tracker, commit, then EXIT.

### ✅ Completed
- [x] Update Program.cs connection limits to 50,000
- [x] Verify run-perf-benchmark.sh has correct flags  
- [x] Build C# server in Release mode

### 🔄 In Progress
_(Move current task here while working)_

### 📋 Next Up
- [ ] **NEXT →** Verify server health on port 8090
- [ ] Run connection discovery (30,000 ceiling)
- [ ] Run ops discovery
- [ ] Run latency discovery  
- [ ] Run memory stability test
- [ ] Run full capture-all.ts
- [ ] Update SERVER_PERFORMANCE.md table
- [ ] Verify CI workflow environment variables
- [ ] Trigger CI workflow and confirm success
- [ ] Commit final results to branch

### 🚫 Blocked
_(none currently)_

---

## 0.1 Current Task Details

**Task:** Verify server health on port 8090

**Prerequisites:**
- C# server must be running in a SEPARATE terminal (see Section 5.1)

**Command:**
```bash
curl -s http://localhost:8090/health | jq .status
```

**Success Condition:** Output is `"ok"`

**On Success:** 
1. Mark task `[x]` in Completed
2. Move "Run connection discovery" to In Progress
3. Update "Current Task Details" with connection discovery info
4. Commit: `git add docs/.dotnet-feature/PERF-TESTING-PRD.md && git commit -m "perf: health check passed"`

**On Failure:** 
1. Check Section 1 (Signs) for matching symptom
2. If new failure pattern, add to Signs
3. Add task to Blocked with error details

---

## 1. Signs (Tuning Rules)

> **PURPOSE:** When something fails, check here first. When you discover a new failure pattern, ADD IT HERE for future iterations.

| # | Symptom | Cause | Fix |
|---|---------|-------|-----|
| 1 | Tests connect to port 8080 not 8090 | Missing `SERVER_TYPE=csharp` | Set `SERVER_TYPE=csharp` before ALL test commands |
| 2 | Server ignores `SYNCKIT_SERVER_URL` | launchSettings.json override | Add `--no-launch-profile` flag to dotnet run |
| 3 | Connections cap at ~1,000 | Old binary with 1K limits | Rebuild: `dotnet build --configuration Release` |
| 4 | Test hangs >60 seconds | Phase-specific issue | Run individual discovery scripts to isolate |
| 5 | macOS socket errors at high counts | .NET macOS bug (#47020) | Expected locally; CI (Ubuntu) succeeds |
| 6 | `SocketAddress` validation errors | File descriptor limits | Run `ulimit -n 65536` before starting server |
| 7 | Server dies unexpectedly | Ran command in server terminal | **NEVER** run curl/bun in the server terminal |
| 8 | Health check connection refused | Server not started | Start server first (see Section 5.1) |

### New Signs (append here)
_(Add new failure patterns as discovered)_

---

## 2. Iteration Template

> **Follow this for EVERY loop iteration:**

```
1. READ     → Section 0 (Progress Tracker) — find task marked "NEXT →"
2. VERIFY   → Check prerequisites (server running? correct terminal?)
3. EXECUTE  → Run the SINGLE task command
4. CHECK    → Did output match success condition?
5. UPDATE   → Edit this PRD:
              ✓ Success: Move task to Completed, update "Current Task Details"
              ✗ Failure: Check Signs, add to Blocked, add new Sign if needed
6. COMMIT   → git add docs/.dotnet-feature/PERF-TESTING-PRD.md && git commit -m "perf: [task]"
7. EXIT     → STOP. Do not continue to next task. Fresh context spawns.
```

---

## 3. Context

### 3.1 Goal

**Complete C# server performance testing at 30,000 max concurrent connections** to match TypeScript baseline and populate `docs/architecture/SERVER_PERFORMANCE.md`.

### 3.2 TypeScript Baseline (Target to Match)

| Metric | TypeScript Result | C# Target |
|--------|-------------------|-----------|
| Max Concurrent Connections | 30,001 | ≥30,000 |
| Single Client Ops/sec | 1,000 | ~1,000 |
| Aggregate Ops/sec | 2,000 | ~2,000 |
| P95 Latency at Max Load | 51ms | <100ms |
| Memory Stability | ✓ Stable | ✓ Stable |

### 3.3 Smoke Test Results (500 connections - validated)

```
Max Connections: 501 ✓
Single Client Ops/sec: 1,000 ✓
Aggregate Ops/sec: 1,529 ✓
P95 Latency: 1,465ms (high due to 1K limit - now fixed)
```

---

## 4. Task Reference

### 4.1 Connection Discovery

**Command:**
```bash
cd tests
SERVER_TYPE=csharp PERF_MAX_CONNECTIONS=30000 bun run perf/discover-max-connections.ts
```
**Success:** File `tests/results/connections-csharp-*.json` created with `maxConnections` value  
**Output Location:** `tests/results/`

### 4.2 Ops Discovery

**Command:**
```bash
cd tests
SERVER_TYPE=csharp bun run perf/discover-max-ops.ts
```
**Success:** Console outputs ops/sec metrics  
**Depends On:** Connection discovery complete

### 4.3 Latency Discovery

**Command:**
```bash
cd tests
SERVER_TYPE=csharp bun run perf/discover-latency-ceiling.ts
```
**Success:** Console outputs P95 latency  
**Depends On:** Ops discovery complete

### 4.4 Memory Stability

**Command:**
```bash
cd tests
SERVER_TYPE=csharp bun run perf/discover-memory-stability.ts
```
**Success:** Memory stable over test duration  
**Depends On:** Latency discovery complete

### 4.5 Full Capture (all phases)

**Command:**
```bash
cd tests
SERVER_TYPE=csharp PERF_MAX_CONNECTIONS=30000 bun run perf/capture-all.ts
```
**Success:** `tests/results/perf-csharp-*.json` created with all metrics  
**Alternative:** Run if individual phases all pass

### 4.6 Update Performance Table

**Command:**
```bash
cd tests
bun run perf/update-perf-table.ts
```
**Success:** `docs/architecture/SERVER_PERFORMANCE.md` updated with C# column  
**Depends On:** Full capture complete

---

## 5. Server Management

### 5.1 Start C# Server (DEDICATED TERMINAL)

> ⚠️ **CRITICAL:** Run this in a terminal you will NOT use for tests

```bash
cd /Users/core/git/matthewcorven/synckit
SYNCKIT_SERVER_URL="http://0.0.0.0:8090" \
SYNCKIT_AUTH_REQUIRED=false \
JWT_SECRET='test-secret-key-for-integration-tests-only-32-chars' \
dotnet run --project server/csharp/src/SyncKit.Server/SyncKit.Server.csproj \
  --configuration Release --no-launch-profile
```

### 5.2 Health Check (SEPARATE TERMINAL)

```bash
curl -s http://localhost:8090/health | jq
```

Expected: `{"status":"ok","version":"1.0.0",...}`

### 5.3 Rebuild Server (if needed)

```bash
cd /Users/core/git/matthewcorven/synckit/server/csharp/src/SyncKit.Server
dotnet build --configuration Release
```

---

## 6. File State Reference

| File | Purpose | Check |
|------|---------|-------|
| This PRD | Task tracking & iteration state | Update every iteration |
| `tests/results/perf-csharp-*.json` | Raw perf results | Exists = capture complete |
| `docs/architecture/SERVER_PERFORMANCE.md` | Final comparison table | Has C# column = done |
| `server/csharp/src/SyncKit.Server/Program.cs` | Connection limits | Should show 50000 |

---

## 7. CI Workflow

### 7.1 Trigger via CLI

```bash
gh workflow run perf-benchmark.yml \
  -f server_type=csharp \
  -f max_connections=30000
```

### 7.2 Monitor

```bash
RUN_ID=$(gh run list --workflow=perf-benchmark.yml --limit=1 --json databaseId -q '.[0].databaseId')
gh run watch $RUN_ID
```

---

## 8. Environment Variables Reference

| Variable | Value | Required For |
|----------|-------|--------------|
| `SERVER_TYPE` | `csharp` | All test commands |
| `PERF_MAX_CONNECTIONS` | `30000` | Connection discovery |
| `SYNCKIT_SERVER_URL` | `http://0.0.0.0:8090` | Server startup |
| `SYNCKIT_AUTH_REQUIRED` | `false` | Server startup |
| `JWT_SECRET` | `test-secret-key-for-integration-tests-only-32-chars` | Server startup |

---

## Appendix: Original Problem Analysis

### Problems Identified (Historical)

1. **Port Configuration Override** — Fixed with `--no-launch-profile`
2. **SERVER_TYPE defaulting** — Document in Signs
3. **Connection Limits** — ✅ Fixed to 50,000 in Program.cs
4. **Test Hanging** — Isolate with individual phase runs

### Validated Configuration

```bash
# Server startup (Terminal 1)
SYNCKIT_SERVER_URL="http://0.0.0.0:8090" \
SYNCKIT_AUTH_REQUIRED=false \
JWT_SECRET='test-secret-key-for-integration-tests-only-32-chars' \
dotnet run --project server/csharp/src/SyncKit.Server/SyncKit.Server.csproj \
  --configuration Release--no-launch-profile

# Test execution (Terminal 2)
cd tests
SERVER_TYPE=csharp PERF_MAX_CONNECTIONS=500 bun run perf/capture-all.ts
```

**Local Results (500 connection ceiling):**
- 501 connections stable
- 1,000 ops/sec single client
- 1,529 aggregate ops/sec
- 1,465ms p95 latency (high - likely due to 1,000 connection limit)

---

## Appendix A: Quick Start (Automated)

Use `run-perf-benchmark.sh` which handles server lifecycle automatically:

```bash
cd /Users/core/git/matthewcorven/synckit

# Build C# server first
cd server/csharp/src/SyncKit.Server
dotnet build --configuration Release
cd -

# Run full perf benchmark (starts server, runs tests, updates docs)
cd tests
PERF_MAX_CONNECTIONS=30000 ./run-perf-benchmark.sh csharp

# View results
cat results/perf-csharp-*.json | jq
cat ../docs/architecture/SERVER_PERFORMANCE.md
```

---

## Appendix B: Related Scripts

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `tests/run-perf-benchmark.sh` | **Performance testing** - starts server, runs all perf discovery phases | This PRD |
| `tests/integration/run-against-csharp.sh` | **Integration testing** - runs integration tests | Functionality validation (not perf) |
