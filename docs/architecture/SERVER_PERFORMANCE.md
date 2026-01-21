# Server Performance Comparison

This document summarizes performance discovery benchmarks for SyncKit server implementations. The numbers are produced by exploratory scripts in tests/perf and are intended to help compare limits between TypeScript and C# servers.

## Environment (Auto-Generated)

<!-- PERF_ENV_START -->
| Server | OS | CPU | RAM (GB) | Runtime | Captured |
|--------|----|-----|----------|---------|----------|
| TypeScript | linux 6.11.0-1018-azure | Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz (4 cores) | 16 | Bun 1.3.6 | 2026-01-17T21:53:14.057Z |
| C# | linux 6.11.0-1018-azure | AMD EPYC 7763 64-Core Processor (4 cores) | 16 | Bun 1.3.6 | 2026-01-21T05:22:56.189Z |
<!-- PERF_ENV_END -->

## Performance Summary (Auto-Generated)

<!-- PERF_TABLE_START -->
| Metric | TypeScript | C# | Unit |
|--------|------------|-----|------|
| Max Concurrent Connections | 30,001 | 30,001 | connections |
| Max Ops/Sec (Single Client) | 1,000 | 1,000 | ops/sec |
| Max Ops/Sec (Aggregate) | 2,000 | 2,000 | ops/sec |
| P95 Latency | 51 | 1,257 | ms |
| Memory Growth | 3.95 | 0.00 | MB/min |

*Last updated: 2026-01-17T21:53:14.057Z*
<!-- PERF_TABLE_END -->

## Configuration Limits (Manual)

Document any server-side caps or configuration limits that affect performance:

- Max WebSocket connections
- Rate limits
- Payload size limits
- Storage constraints

## Running Performance Tests

### Local Execution

**Prerequisites:**
- Bun 1.3+ (`curl -fsSL https://bun.sh/install | bash`)
- .NET 10 SDK (for C# server): `dotnet --version` should show 10.x
- Ports 8080 (TypeScript) or 8090 (C#) must be available

**Step-by-step:**

```bash
# 1. Install test dependencies
cd tests
bun install

# 2. Run benchmark for TypeScript server
./run-perf-benchmark.sh typescript

# 3. Run benchmark for C# server
./run-perf-benchmark.sh csharp

# 4. Run with higher connection ceiling (e.g., 30K)
PERF_MAX_CONNECTIONS=30000 ./run-perf-benchmark.sh csharp
```

**What the script does:**
1. Builds the server (Release mode for C#)
2. Starts the server on the appropriate port
3. Runs `tests/perf/discover-max-connections.ts` - binary search for max stable connections
4. Runs throughput tests - measures ops/sec at various load levels
5. Runs latency tests - captures p50, p95, p99 at idle, 50%, 80%, and max load
6. Runs memory stability tests - 5-minute sustained load, measures MB/min growth
7. Saves JSON results to `tests/results/perf-{server}-{timestamp}.json`
8. Updates this file (`SERVER_PERFORMANCE.md`) with new metrics
9. Stops the server

**Expected duration:** 15-45 minutes depending on `PERF_MAX_CONNECTIONS`

**Output files:**
- `tests/results/perf-csharp-{timestamp}.json` - Raw metrics
- `docs/architecture/SERVER_PERFORMANCE.md` - Updated comparison table

### GitHub Actions Execution

Performance tests can be triggered manually via GitHub Actions workflow dispatch.

**Prerequisites:**
- GitHub CLI installed (`gh --version`)
- Authenticated (`gh auth login`)
- Repository set as default (`gh repo set-default matthewcorven/synckit`)

**Trigger the workflow:**

```bash
# C# server with 30,000 max connections
gh workflow run perf-benchmark.yml \
  --ref feature/11-dotnet-server-perf \
  -f server_type=csharp \
  -f max_connections=30000

# TypeScript server with default 5,000 max connections
gh workflow run perf-benchmark.yml \
  --ref feature/11-dotnet-server-perf \
  -f server_type=typescript
```

**Important:** The `--ref` flag specifies the branch containing the workflow file with `workflow_dispatch` enabled. This is required because GitHub reads the workflow definition from the specified ref.

**Monitor progress:**

```bash
# Check workflow status
gh run list --workflow="perf-benchmark.yml" -L 3

# Watch live logs
gh run watch <run-id>

# View completed run logs
gh run view <run-id> --log
```

**Download artifacts:**

```bash
# Download performance results JSON
gh run download <run-id> -n perf-results

# Download updated SERVER_PERFORMANCE.md
gh run download <run-id> -n server-performance-md
```

**GitHub Actions limitations:**
- Ubuntu runners have ~7GB RAM and 2 vCPUs - expect lower limits than local M-series Macs
- Max connections typically caps at 1,000-5,000 on GitHub runners
- Workflow timeout is 180 minutes

### Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `PERF_MAX_CONNECTIONS` | `5000` | Upper bound for connection discovery |
| `SERVER_TYPE` | `typescript` | Which server to benchmark |
| `SERVER_PORT` | `8080` (TS) / `8090` (C#) | Server port |
| `SYNCKIT_SERVER_URL` | Auto-generated | Full base URL for the server |
| `SYNCKIT_AUTH_REQUIRED` | `false` | Auth disabled for perf tests |

---

## Methodology

Performance discovery scripts are intentionally exploratory and run outside CI. Each script progressively ramps load to find the maximum stable operating point:

- **Max connections:** Binary search across connection counts, verifying stability for 10 seconds at each step. A connection count is "stable" if all connections remain open without errors.
- **Max ops/sec:** Ramps send rate until fewer than 80% of ops converge within 1 second, then binary searches to find the sustainable maximum.
- **Latency ceiling:** Measures p50, p95, p99 latency at idle, 50%, 80%, and max load levels.
- **Memory stability:** Samples memory every 10 seconds during a sustained 5-minute load and computes growth rate in MB/min. Negative values indicate GC reclamation.
