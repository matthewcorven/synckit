# PRD: C# Server Performance Testing

> **Status:** In Progress  
> **Last Updated:** 2026-01-17  
> **Branch:** `feature/11-dotnet-server-perf`

---

## 1. Situation Analysis

### 1.1 Current State

We have successfully completed performance testing for the **TypeScript server** implementation with the following results:

| Metric | TypeScript Result |
|--------|-------------------|
| Max Concurrent Connections | **30,001** |
| Single Client Ops/sec | 1,000 |
| Aggregate Ops/sec | 2,000 |
| P95 Latency at Max Load | 51ms |
| Memory Stability | ✓ Stable |

The C# (.NET 10) server implementation exists and passes basic functionality tests, but **performance testing has not completed successfully**.

### 1.2 Problems Identified

During C# performance testing attempts, the following issues were encountered:

1. **Port Configuration Override**
   - The `launchSettings.json` hardcodes port 8080, overriding environment variables
   - **Solution:** Use `--no-launch-profile` flag and `SYNCKIT_SERVER_URL` (not `ASPNETCORE_URLS`)

2. **SERVER_TYPE Environment Variable**
   - Tests default to `typescript` server (port 8080) unless `SERVER_TYPE=csharp` is set
   - This caused tests to fail silently by connecting to wrong port

3. **Connection Limits in Program.cs**
   - `MaxConcurrentConnections` and `MaxConcurrentUpgradedConnections` were set to **1,000**
   - This capped performance at 1,000 connections regardless of test ceiling, so we have updated to **50,000** in `Program.cs`

4. **Test Hanging**
   - The `capture-all.ts` script runs 4 sequential phases
   - Hanging observed after connection discovery phase completes
   - Root cause: likely ops discovery or latency tests

### 1.3 Working Smoke Test Configuration (Validated Locally)

The following configuration successfully ran connection tests locally at a limited ceiling of 500 connections:

```bash
# Server startup (Terminal 1)
SYNCKIT_SERVER_URL="http://0.0.0.0:8090" \
SYNCKIT_AUTH_REQUIRED=false \
JWT_SECRET='test-secret-key-for-integration-tests-only-32-chars' \
dotnet run --project server/csharp/src/SyncKit.Server/SyncKit.Server.csproj \
  --configuration Release --no-build --no-launch-profile

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

## 2. Desired Outcomes

### 2.1 Primary Goal

**Complete C# server performance testing at 30,000 max concurrent connections** to match TypeScript baseline and populate the comparison table in `docs/architecture/SERVER_PERFORMANCE.md`.

### 2.2 Success Criteria

| Metric | Target |
|--------|--------|
| Max Concurrent Connections | ≥ 30,000 (or documented limit) |
| Performance Data Captured | All 4 phases complete |
| docs/architecture/SERVER_PERFORMANCE.md | Auto-updated with C# results |
| GitHub CI Workflow | Passes without hanging |

### 2.3 Deliverables

1. ✅ Updated `run-perf-benchmark.sh` with correct C# startup flags
2. ✅ Updated C# `Program.cs` with higher connection limits
3. ⬜ Successful local perf capture at 30,000 connections
4. ⬜ Updated GitHub CI workflow with correct environment variables
5. ⬜ Successful CI perf capture
6. ⬜ Auto-committed docs/architecture/SERVER_PERFORMANCE.md with C# results

---

## 3. Execution Plan

### Phase 1: Code Changes (Estimated: 15 min)

#### 1.1 Increase C# Server Connection Limits

**File:** `server/csharp/src/SyncKit.Server/Program.cs`

Change:
```csharp
serverOptions.Limits.MaxConcurrentConnections = 1000;
serverOptions.Limits.MaxConcurrentUpgradedConnections = 1000;
```

To:
```csharp
serverOptions.Limits.MaxConcurrentConnections = 50000;
serverOptions.Limits.MaxConcurrentUpgradedConnections = 50000;
```

#### 1.2 Verify run-perf-benchmark.sh Updates

**File:** `tests/run-perf-benchmark.sh`

Ensure C# startup uses:
```bash
SYNCKIT_SERVER_URL="http://0.0.0.0:${SERVER_PORT}" \
SYNCKIT_AUTH_REQUIRED=false \
JWT_SECRET='test-secret-key-for-integration-tests-only-32-chars' \
dotnet run --configuration Release --no-build --no-launch-profile
```

#### 1.3 Update CI Workflow (if needed)

**File:** `.github/workflows/perf-benchmark.yml`

Ensure `SERVER_TYPE` is passed to the benchmark script:
```yaml
env:
  SERVER_TYPE: ${{ github.event.inputs.server_type }}
  SERVER_PORT: ${{ github.event.inputs.server_type == 'csharp' && '8090' || '8080' }}
  PERF_MAX_CONNECTIONS: ${{ github.event.inputs.max_connections }}
```

---

### Phase 2: Local Validation (Estimated: 45 min)

#### 2.1 Build C# Server

```bash
cd server/csharp/src/SyncKit.Server
dotnet build --configuration Release
```

#### 2.2 Start C# Server (Terminal 1 - DEDICATED)

```bash
SYNCKIT_SERVER_URL="http://0.0.0.0:8090" \
SYNCKIT_AUTH_REQUIRED=false \
JWT_SECRET='test-secret-key-for-integration-tests-only-32-chars' \
dotnet run --project /path/to/SyncKit.Server.csproj \
  --configuration Release --no-build --no-launch-profile
```

#### 2.3 Verify Health (Terminal 2)

```bash
curl -s http://localhost:8090/health | jq
```

Expected:
```json
{"status":"ok","version":"1.0.0",...}
```

#### 2.4 Run Individual Discovery Phases (Terminal 2)

Run each phase separately to identify any hangs:

```bash
cd tests

# Phase 1: Connection Discovery
SERVER_TYPE=csharp PERF_MAX_CONNECTIONS=30000 \
  bun run perf/discover-max-connections.ts

# Phase 2: Ops Discovery  
SERVER_TYPE=csharp bun run perf/discover-max-ops.ts

# Phase 3: Latency Discovery
SERVER_TYPE=csharp bun run perf/discover-latency-ceiling.ts

# Phase 4: Memory Stability
SERVER_TYPE=csharp bun run perf/discover-memory-stability.ts
```

#### 2.5 Run Full Capture

Once individual phases pass:

```bash
cd tests
SERVER_TYPE=csharp PERF_MAX_CONNECTIONS=30000 \
  bun run perf/capture-all.ts
```

#### 2.6 Update Performance Table

```bash
cd tests
bun run perf/update-perf-table.ts
```

#### 2.7 Verify Results

```bash
# Check results file
cat tests/results/perf-csharp-*.json | jq

# Check updated table
cat docs/architecture/SERVER_PERFORMANCE.md
```

---

### Phase 3: CI Validation (Estimated: 30 min)

#### 3.1 Commit Changes

```bash
git add -A
git commit -m "fix(perf): increase C# connection limits and fix CI env vars"
git push origin feature/11-dotnet-server-perf
```

#### 3.2 Trigger CI Workflow

Via GitHub CLI:
```bash
gh workflow run perf-benchmark.yml \
  -f server_type=csharp \
  -f max_connections=30000
```

Or via GitHub UI:
1. Go to Actions → "Perf Benchmark (fixed)"
2. Click "Run workflow"
3. Select `server_type: csharp`, `max_connections: 30000`

#### 3.3 Monitor Run

```bash
# Get latest run ID
RUN_ID=$(gh run list --workflow=perf-benchmark.yml --limit=1 --json databaseId -q '.[0].databaseId')

# Watch status
gh run watch $RUN_ID

# Or use polling script
./scripts/poll-workflow-run.sh $RUN_ID
```

#### 3.4 Verify Artifacts

After successful run:
- `perf-results` artifact contains JSON metrics
- `server-performance-md` artifact contains updated table
- Commit auto-pushed to branch with updated `SERVER_PERFORMANCE.md`

---

## 4. Troubleshooting Guide

### Issue: Server doesn't start on expected port

**Symptoms:** Health check fails, tests connect to wrong port

**Solution:**
1. Verify `SYNCKIT_SERVER_URL` is set (not `ASPNETCORE_URLS`)
2. Add `--no-launch-profile` flag
3. Check logs: `tail -f /tmp/csharp-server.log`

### Issue: Tests hang during ops/latency discovery

**Symptoms:** No output for >60 seconds after connection discovery

**Solution:**
1. Run each discovery phase individually to isolate
2. Check server logs for errors
3. Add timeouts to discovery scripts if needed

### Issue: Connection limit reached before 30,000

**Symptoms:** Degradation at ~1,000 connections

**Solution:**
1. Verify `Program.cs` has increased `MaxConcurrentConnections`
2. Rebuild server: `dotnet build --configuration Release`
3. Restart server

### Issue: CI workflow times out

**Symptoms:** Job exceeds 180 minute timeout

**Solution:**
1. Reduce `PERF_MAX_CONNECTIONS` ceiling
2. Check for infinite loops in discovery scripts
3. Add progress logging to identify stuck phase

### Issue: macOS socket errors at high connection counts

**Symptoms:** `SocketAddress` validation errors

**Solution:**
1. Increase file descriptor limits: `ulimit -n 65536`
2. This is a known .NET macOS issue (dotnet/runtime#47020)
3. CI (Ubuntu) doesn't have this issue

---

## 5. Reference Files

| File | Purpose |
|------|---------|
| `tests/perf/capture-all.ts` | Orchestrates all 4 discovery phases |
| `tests/perf/discover-max-connections.ts` | Binary search for max stable connections |
| `tests/perf/discover-max-ops.ts` | Find max ops/sec |
| `tests/perf/discover-latency-ceiling.ts` | Measure p95 latency under load |
| `tests/perf/discover-memory-stability.ts` | Check for memory leaks |
| `tests/perf/update-perf-table.ts` | Updates SERVER_PERFORMANCE.md |
| `tests/run-perf-benchmark.sh` | Shell script to start server + run capture |
| `tests/helpers/server.ts` | Server URL/port helpers (uses SERVER_TYPE) |
| `server/csharp/src/SyncKit.Server/Program.cs` | C# server entry point |
| `.github/workflows/perf-benchmark.yml` | CI workflow |

---

## 6. Environment Variables Reference

| Variable | Purpose | Default |
|----------|---------|---------|
| `SERVER_TYPE` | `typescript` or `csharp` | `typescript` |
| `SERVER_PORT` | Port to connect to | 8080 (TS), 8090 (C#) |
| `PERF_MAX_CONNECTIONS` | Connection ceiling for discovery | 5000 |
| `SYNCKIT_SERVER_URL` | C# server bind URL | - |
| `SYNCKIT_AUTH_REQUIRED` | Disable auth for testing | - |
| `JWT_SECRET` | JWT signing key (32+ chars) | - |

---

## 7. Expected Final Results

After successful completion, `SERVER_PERFORMANCE.md` should show:

| Metric | TypeScript | C# (.NET 10) |
|--------|------------|--------------|
| Max Connections | 30,001 | ≥30,000 |
| Single Client Ops/sec | 1,000 | ~1,000 |
| Aggregate Ops/sec | 2,000 | ~2,000 |
| P95 Latency | 51ms | <100ms |
| Memory Stable | ✓ | ✓ |

---

## Appendix A: Quick Start Commands

### Option 1: Automated (Recommended)

Use `run-perf-benchmark.sh` which handles server lifecycle automatically:

```bash
cd /path/to/synckit

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

### Option 2: Manual (For Debugging)

Use separate terminals when you need to inspect server logs or debug hangs:

```bash
# === TERMINAL 1: C# Server ===
cd /path/to/synckit/server/csharp/src/SyncKit.Server
dotnet build --configuration Release
SYNCKIT_SERVER_URL="http://0.0.0.0:8090" \
SYNCKIT_AUTH_REQUIRED=false \
JWT_SECRET='test-secret-key-for-integration-tests-only-32-chars' \
dotnet run --configuration Release --no-build --no-launch-profile

# === TERMINAL 2: Tests ===
cd /path/to/synckit/tests

# Health check
curl -s http://localhost:8090/health | jq .status

# Full perf capture
SERVER_TYPE=csharp PERF_MAX_CONNECTIONS=30000 bun run perf/capture-all.ts

# Update docs
bun run perf/update-perf-table.ts

# View results
cat results/perf-csharp-*.json | jq
```

---

## Appendix B: Related Scripts

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `tests/run-perf-benchmark.sh` | **Performance testing** - starts server, runs all perf discovery phases, updates SERVER_PERFORMANCE.md | Perf benchmarking (this PRD) |
| `tests/integration/run-against-csharp.sh` | **Integration testing** - runs integration test suite against C# server | Validating C# server functionality (not perf) |

### run-perf-benchmark.sh Usage

```bash
# TypeScript server perf test
./run-perf-benchmark.sh typescript

# C# server perf test  
./run-perf-benchmark.sh csharp

# With custom connection ceiling
PERF_MAX_CONNECTIONS=30000 ./run-perf-benchmark.sh csharp
```

### run-against-csharp.sh Usage (Not for perf testing)

```bash
# Run all integration tests (requires server already running)
./integration/run-against-csharp.sh

# Run specific test category
./integration/run-against-csharp.sh sync

# Auto-start server
./integration/run-against-csharp.sh --with-server
```
