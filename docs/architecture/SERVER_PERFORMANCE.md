# Server Performance Comparison

This document summarizes performance discovery benchmarks for SyncKit server implementations. The numbers are produced by exploratory scripts in tests/perf and are intended to help compare limits between TypeScript and C# servers.

## Environment (Auto-Generated)

<!-- PERF_ENV_START -->
| Server | OS | CPU | RAM (GB) | Runtime | Captured |
|--------|----|-----|----------|---------|----------|
| TypeScript | linux 6.11.0-1018-azure | Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz (4 cores) | 16 | Bun 1.3.6 | 2026-01-17T21:53:14.057Z |
| C# | linux 6.11.0-1018-azure | AMD EPYC 7763 64-Core Processor (4 cores) | 16 | Bun 1.3.6 | 2026-01-21T14:36:30.057Z |
<!-- PERF_ENV_END -->

## Performance Summary (Auto-Generated)

<!-- PERF_TABLE_START -->
| Metric | TypeScript | C# | Unit |
|--------|------------|-----|------|
| Max Concurrent Connections | 30,001 | 30,001 | connections |
| Max Ops/Sec (Single Client) | 1,000 | 1,000 | ops/sec |
| Max Ops/Sec (Aggregate) | 2,000 | 1,771 | ops/sec |
| P95 Latency | 51 | 1,639 | ms |
| Memory Growth | 3.95 | 0.00 | MB/min |

*Last updated: 2026-01-17T21:53:14.057Z*
<!-- PERF_TABLE_END -->

## Configuration Limits (Manual)

Document any server-side caps or configuration limits that affect performance:

- Max WebSocket connections
- Rate limits
- Payload size limits
- Storage constraints

## Performance Tuning (.NET Server)

The .NET server includes configurable parameters that allow operators to tune performance based on their hardware and workload characteristics.

### WebSocket Backpressure Configuration

**Environment Variable:** `WS_MAX_PENDING_SENDS_PER_CONNECTION`  
**Default:** `100`  
**Range:** `0` (unlimited) to `int.MaxValue`

This setting controls the maximum number of pending WebSocket send operations per connection before backpressure is applied. When the limit is reached, new sends are dropped (with debug logging) until pending sends complete.

#### How It Works

The .NET WebSocket implementation requires serialized sends (only one `SendAsync` at a time per socket). The server uses a fire-and-forget pattern with a semaphore to bound the number of concurrent pending sends:

```
Client Request → Serialize → Acquire Semaphore → Queue SendAsync → Release on Complete
                                    ↓
                          (if semaphore full, drop message)
```

#### Configuration Tradeoffs

| Value | Latency Impact | Message Loss | Memory Usage | Best For |
|-------|---------------|--------------|--------------|----------|
| `50` | Lowest P95 under load | Higher drop rate under burst | Lowest | Latency-sensitive apps |
| `100` (default) | Balanced | Moderate | Moderate | General purpose |
| `200-500` | Higher P95 under sustained load | Lower drop rate | Higher | Burst-tolerant apps |
| `0` (unlimited) | Can spike to seconds | None | Unbounded | Testing only |

#### Benchmark Results

The following results were captured on GitHub Actions runners (AMD EPYC 7763, 4 cores, 16GB RAM) with 30,000 connections:

<!-- TUNING_TABLE_START -->
| WS_MAX_PENDING_SENDS | P95 @ 50% | P95 @ 80% | P95 @ Max | Avg Semaphore Wait | Max Pending |
|---------------------|-----------|-----------|-----------|-------------------|-------------|
| 50 | 51ms | 142ms | 1,405ms | 15,364µs | 1,200 |
| 100 (default) | 51ms | 160ms | 1,639ms | 15µs | 153 |
| 200 | 52ms | 181ms | 1,572ms | 2,483µs | 300 |
| 500 | 51ms | 120ms | 1,563ms | 22µs | 226 |
| 0 (unlimited/baseline) | 51ms | 155ms | 1,861ms | 22,720µs | 13,103 |
<!-- TUNING_TABLE_END -->

**Key Observations:**

1. **All bounded values outperform unlimited** - The baseline (0/unlimited) has the worst P95 @ Max (1,861ms) due to unbounded task accumulation causing 22.7ms average semaphore waits.

2. **50 achieves lowest P95 @ Max (1,405ms)** - But shows degraded semaphore wait under extreme load (15,364µs avg), suggesting the limit is too aggressive and causes backpressure-induced retries.

3. **500 provides excellent balance** - Only 22µs avg semaphore wait with 1,563ms P95 @ Max. The higher limit absorbs burst traffic without causing contention.

4. **100 (default) is conservative** - Good for memory-constrained environments but may not be optimal for high-throughput scenarios.

**Recommendation:** For most production workloads on modern hardware (4+ cores, 8GB+ RAM), consider **200-500** for better burst handling. Use **50-100** only if memory is constrained or you prefer to drop messages early rather than queue them.

#### Setting the Value

**Environment variable:**
```bash
WS_MAX_PENDING_SENDS_PER_CONNECTION=200 dotnet run
```

**appsettings.json:**
```json
{
  "SyncKit": {
    "WsMaxPendingSendsPerConnection": 200
  }
}
```

**GitHub Actions workflow dispatch:**
```bash
gh workflow run perf-benchmark.yml \
  --ref perf/option1-bounded-concurrency \
  -f server_type=csharp \
  -f max_connections=30000 \
  -f ws_max_pending_sends=200
```

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
