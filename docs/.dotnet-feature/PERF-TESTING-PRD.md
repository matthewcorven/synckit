# PRD: C# Server Performance Testing

> **Status:** In Progress  
> **Last Updated:** 2026-01-18  
> **Branch:** `feature/11-dotnet-server-perf`  
> **Loop Compatible:** Yes (RALPH Loop - autonomous execution)

---

## 0. Progress Tracker

> **RALPH LOOP INSTRUCTIONS:** Each iteration:
> 1. Find the task marked `**NEXT →**`
> 2. Execute ONLY that task's command
> 3. Update this tracker based on result
> 4. Commit changes to this PRD
> 5. EXIT (do not continue)

### ✅ Completed
- [x] Update Program.cs connection limits to 50,000
- [x] Verify run-perf-benchmark.sh has correct flags  
- [x] Build C# server in Release mode
- [x] Fix benchmark script permissions (chmod +x tests/run-perf-benchmark.sh)
- [x] Run full perf benchmark (automated script handles server lifecycle)
- [x] Verify results file exists and contains valid data

### 🔄 In Progress
_(Move current task here while working)_

### 📋 Next Up
- [ ] **NEXT →** Verify SERVER_PERFORMANCE.md was updated
- [ ] Stage all changes for final commit

### 🚫 Blocked
_(none)_

---

## 0.1 Current Task Details

**Task:** Verify SERVER_PERFORMANCE.md was updated

**Why This Works Autonomously:** The benchmark updates the performance table, and the command below validates the C# column exists.

**Command:**
```bash
grep -A 10 "C# (.NET" /Users/core/git/matthewcorven/synckit/docs/architecture/SERVER_PERFORMANCE.md || echo "C# column not found"
```

**Success Condition:** 
- Exit code 0
- C# column is present in SERVER_PERFORMANCE.md

**On Success:** 
1. Move task to Completed
2. Set NEXT → to "Stage all changes for final commit"
3. Commit: `git add docs/.dotnet-feature/PERF-TESTING-PRD.md && git commit -m "perf: verify perf docs"`

**On Failure:**
1. Check exit code and error output
2. Add error details to Signs section
3. Commit: `git add docs/.dotnet-feature/PERF-TESTING-PRD.md && git commit -m "perf: docs verification failed - [reason]"`

---

## 1. Signs (Tuning Rules)

> **PURPOSE:** When something fails, check here first. Append new failure patterns.

| # | Symptom | Cause | Fix |
|---|---------|-------|-----|
| 1 | `--no-build` fails | Binary not built | Run: `cd server/csharp/src/SyncKit.Server && dotnet build --configuration Release` |
| 2 | Port 8090 in use | Previous server didn't stop | Script auto-kills; if persists: `lsof -ti:8090 \| xargs kill -9` |
| 3 | Server never healthy (60s timeout) | Build issue or crash | Check dotnet output; rebuild server |
| 4 | Connections cap at ~1,000 | Old Program.cs limits | Verify `MaxConcurrentConnections = 50000` in Program.cs, rebuild |
| 5 | macOS socket errors at high counts | .NET macOS bug (#47020) | Reduce `PERF_MAX_CONNECTIONS` or run in CI |
| 6 | Script not executable | Missing chmod | Run: `chmod +x tests/run-perf-benchmark.sh` |

### New Signs (append here)
- 2026-01-18: `./run-perf-benchmark.sh` permission denied (exit 126). Fix: `chmod +x tests/run-perf-benchmark.sh`.

---

## 2. Iteration Template

> **Autonomous Execution Flow:**

```
1. READ     → Find "NEXT →" task in Section 0
2. EXECUTE  → Run the command in Section 0.1
3. CHECK    → Verify success condition
4. UPDATE   → Move task appropriately, set new "NEXT →"
5. COMMIT   → git add -A && git commit -m "perf: [result]" (local only, no push)
6. EXIT     → STOP. Next iteration handles next task.

**CONSTRAINT:** Agent cannot `git push`. All commits are local. Human pushes after loop completes.
```

**CRITICAL:** Do NOT try to run multiple tasks. Do NOT manually start servers. The automated script handles server lifecycle.

---

## 3. Task Reference (Autonomous Commands)

### 3.1 Full Benchmark (PRIMARY - use this)

```bash
cd /Users/core/git/matthewcorven/synckit/tests && PERF_MAX_CONNECTIONS=30000 ./run-perf-benchmark.sh csharp
```

This single command:
- ✅ Starts server as background process
- ✅ Waits for health automatically
- ✅ Runs all 4 discovery phases
- ✅ Updates SERVER_PERFORMANCE.md
- ✅ Stops server on completion

### 3.2 Rebuild Server (if needed)

```bash
cd /Users/core/git/matthewcorven/synckit/server/csharp/src/SyncKit.Server && dotnet build --configuration Release
```

### 3.3 Verify Results

```bash
ls -la /Users/core/git/matthewcorven/synckit/tests/results/perf-csharp-*.json && cat /Users/core/git/matthewcorven/synckit/tests/results/perf-csharp-*.json | head -50
```

### 3.4 Verify Docs Updated

```bash
grep -A 10 "C# (.NET" /Users/core/git/matthewcorven/synckit/docs/architecture/SERVER_PERFORMANCE.md || echo "C# column not found"
```

---

## 4. Context

### 4.1 Goal

**Complete C# server performance testing at 30,000 max concurrent connections** to match TypeScript baseline.

### 4.2 TypeScript Baseline

| Metric | TypeScript | C# Target |
|--------|------------|-----------|
| Max Connections | 30,001 | ≥30,000 |
| Single Client Ops/sec | 1,000 | ~1,000 |
| Aggregate Ops/sec | 2,000 | ~2,000 |
| P95 Latency | 51ms | <100ms |
| Memory Stable | ✓ | ✓ |

### 4.3 Validated Smoke Test (500 connections)

```
Max Connections: 501 ✓
Ops/sec: 1,000 single, 1,529 aggregate ✓
```

---

## 5. Environment Variables

| Variable | Value | Set By |
|----------|-------|--------|
| `PERF_MAX_CONNECTIONS` | `30000` | Command line |
| `SERVER_TYPE` | `csharp` | Script (from arg) |
| `SERVER_PORT` | `8090` | Script default |
| `SYNCKIT_SERVER_URL` | `http://0.0.0.0:8090` | Script |
| `SYNCKIT_AUTH_REQUIRED` | `false` | Script |
| `JWT_SECRET` | `test-secret-...` | Script |

All environment variables are set automatically by `run-perf-benchmark.sh`.

---

## 6. File State Reference

| File | Purpose | Success Indicator |
|------|---------|-------------------|
| `tests/results/perf-csharp-*.json` | Raw results | File exists with data |
| `docs/architecture/SERVER_PERFORMANCE.md` | Comparison table | Has C# column |
| `server/csharp/src/SyncKit.Server/Program.cs` | Connection limits | Shows 50000 |

---

## 7. Post-Loop Actions (Human Required)

> **NOTE:** The RALPH Loop agent cannot `git push`. After the loop completes successfully, a human must:

```bash
# Push all commits made by the loop
git push origin feature/11-dotnet-server-perf

# Optionally trigger CI workflow
gh workflow run perf-benchmark.yml -f server_type=csharp -f max_connections=30000
```

---

## Appendix: How run-perf-benchmark.sh Works

The script (`tests/run-perf-benchmark.sh csharp`) does:

1. **Ensures port 8090 is free** (kills any existing process)
2. **Starts C# server as background process** with correct env vars
3. **Polls health endpoint** for up to 60 seconds
4. **Runs `capture-all.ts`** which executes all discovery phases
5. **Runs `update-perf-table.ts`** to update SERVER_PERFORMANCE.md
6. **Cleans up** server process on exit (trap handler)

This is why the PRD uses the automated script instead of manual server management - it works autonomously without needing persistent terminals across RALPH Loop iterations.
