# Plan: Server Performance Benchmarking & Automated Documentation

**TL;DR:** Create dedicated performance discovery scripts (separate from load tests) that progressively ramp load to find maximum stable capabilities, capture key metrics (max concurrent connections, max ops/sec, p95 latency, memory stability), and automatically update the performance comparison table at [docs/architecture/SERVER_PERFORMANCE.md](docs/architecture/SERVER_PERFORMANCE.md).

---

## Design Principle: Separation of Concerns

| Aspect | Load Tests (`tests/load/`) | Perf Discovery (`tests/perf/`) |
|--------|---------------------------|--------------------------------|
| **Goal** | Assert handling of *known* load | Discover *maximum* stable capability |
| **Pattern** | Fixed scenarios → pass/fail | Ramp up until failure/degradation |
| **Output** | Boolean (assertion) | Numeric limits |
| **Stability** | Must be deterministic for CI | Inherently exploratory |
| **Reuse** | — | Imports helpers from `tests/helpers/` |

Load tests remain pure assertion tests for CI/CD. Performance scripts are separate discovery tools.

---

## Key Metrics (Priority Order)

1. **Max Concurrent Connections** — Peak simultaneous WebSocket connections sustained without degradation
2. **Max Ops/Sec** — Maximum operations per second (single client and aggregate)
3. **P95 Latency** — 95th percentile operation latency under load
4. **Memory Stability** — Heap growth rate over sustained load (MB/min)

---

## Steps

### Step 1: Create Performance Discovery Scripts Directory

Create `tests/perf/` directory with dedicated discovery scripts that import shared helpers:

```
tests/
├── helpers/           # Shared utilities (existing)
│   ├── client.ts      # WebSocket client helpers
│   ├── server.ts      # Server lifecycle helpers
│   └── metrics.ts     # Timing/measurement utilities
├── load/              # Assertion tests (unchanged)
└── perf/              # NEW: Discovery scripts
    ├── discover-max-connections.ts
    ├── discover-max-ops.ts
    ├── discover-latency-ceiling.ts
    └── discover-memory-stability.ts
```

### Step 2: Create Max Connections Discovery Script

Create `tests/perf/discover-max-connections.ts`:

- Uses binary search to find max stable connections
- Starts at 100, doubles until failure, then binary searches
- "Stable" = all connections maintained for 10s without drops
- Returns: `{ maxConnections: number, degradationPoint: number, connectTimeAtMax: number }`

**Algorithm:**
```typescript
async function discoverMaxConnections(serverUrl: string): Promise<ConnectionResult> {
  let low = 100, high = 10000, maxStable = 0;
  
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const result = await testConnectionCount(mid, serverUrl);
    
    if (result.stable) {
      maxStable = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  
  return { maxConnections: maxStable, ... };
}
```

### Step 3: Create Max Ops/Sec Discovery Script

Create `tests/perf/discover-max-ops.ts`:

- Ramps ops/sec linearly until sync convergence drops below 80%
- Tests single-client max and aggregate max separately
- "Max" = highest rate where 80%+ operations sync within 1s
- Returns: `{ singleClientMax: number, aggregateMax: number, clientsAtAggregate: number }`

**Algorithm:**
```typescript
async function discoverMaxOps(serverUrl: string): Promise<OpsResult> {
  // Single client: ramp from 10 ops/s to failure
  // Aggregate: fixed client count, ramp total ops
  // Binary search on rate, measure convergence %
}
```

### Step 4: Create Latency Ceiling Discovery Script

Create `tests/perf/discover-latency-ceiling.ts`:

- Measures p50, p95, p99 latency at increasing load levels
- Finds the load level where p95 exceeds acceptable threshold (e.g., 500ms)
- Returns: `{ p95AtIdle: number, p95At50Pct: number, p95At80Pct: number, p95AtMax: number }`

### Step 5: Create Memory Stability Discovery Script

Create `tests/perf/discover-memory-stability.ts`:

- Runs sustained load for 5 minutes
- Samples heap usage every 10 seconds
- Calculates growth rate (MB/min) via linear regression
- Returns: `{ initialHeapMb: number, finalHeapMb: number, growthMbPerMin: number, stable: boolean }`

### Step 6: Create Orchestration Script

Create `tests/perf/capture-all.ts` that:

- Accepts `SERVER_TYPE` env var (`typescript` | `csharp`, default: `typescript`)
- Accepts `SERVER_PORT` env var (default: `8080` for TS, `8090` for C#)
- Runs all discovery scripts in sequence
- Captures environment info
- Outputs combined results to `tests/results/perf-{serverType}-{timestamp}.json`

**Result structure:**
```typescript
interface PerfResult {
  serverType: 'typescript' | 'csharp';
  timestamp: string;
  environment: EnvironmentInfo;
  metrics: {
    maxConcurrentConnections: number;
    maxOpsPerSecSingleClient: number;
    maxOpsPerSecAggregate: number;
    p95LatencyMs: number;
    memoryGrowthMbPerMin: number;
  };
  details: {
    connections: ConnectionResult;
    ops: OpsResult;
    latency: LatencyResult;
    memory: MemoryResult;
  };
}
```

### Step 7: Create Environment Capture Utility

Create `tests/perf/capture-environment.ts` that collects:

- OS name and version (`process.platform`, `os.release()`)
- CPU model and core count (`os.cpus()`)
- Total RAM (`os.totalmem()`)
- Node/Bun version (`process.version`)
- Test timestamp (ISO 8601)

**Output format:**
```typescript
interface EnvironmentInfo {
  os: string;           // e.g., "macOS 14.2.1"
  cpu: string;          // e.g., "Apple M2 Pro (12 cores)"
  ramGb: number;        // e.g., 32
  runtime: string;      // e.g., "Bun 1.1.0"
  timestamp: string;    // e.g., "2026-01-15T10:30:00Z"
}
```

### Step 8: Create Markdown Table Generator

Create `tests/perf/update-perf-table.ts` that:

- Reads all `tests/results/perf-*.json` files
- Groups by `serverType`, keeps latest result per type
- Generates markdown table with side-by-side comparison
- Updates `docs/architecture/SERVER_PERFORMANCE.md` in place (between markers)

**Table format (machine-generated section):**
```markdown
<!-- PERF_TABLE_START -->
| Metric | TypeScript | C# | Unit |
|--------|------------|-----|------|
| Max Concurrent Connections | 1,000 | — | connections |
| Max Ops/Sec (Single Client) | 100 | — | ops/sec |
| Max Ops/Sec (Aggregate) | 500 | — | ops/sec |
| P95 Latency | 45 | — | ms |
| Memory Growth | 0.5 | — | MB/min |

*Last updated: 2026-01-15T10:30:00Z*
<!-- PERF_TABLE_END -->
```

### Step 9: Create SERVER_PERFORMANCE.md Template

Create `docs/architecture/SERVER_PERFORMANCE.md` with:

- Introduction explaining the comparison
- Environment section (auto-populated)
- Performance table section (between markers for auto-update)
- Configuration limits section (manual, from server configs)
- Methodology section explaining discovery algorithms

### Step 10: Create Convenience Scripts

Add to `tests/package.json`:

```json
{
  "scripts": {
    "perf:discover": "bun run perf/capture-all.ts",
    "perf:discover:csharp": "SERVER_TYPE=csharp SERVER_PORT=8090 bun run perf/capture-all.ts",
    "perf:update-table": "bun run perf/update-perf-table.ts",
    "perf:full": "bun run perf:discover && bun run perf:update-table"
  }
}
```

Add convenience shell script `tests/run-perf-benchmark.sh`:

```bash
#!/bin/bash
# Usage: ./run-perf-benchmark.sh [typescript|csharp]
SERVER_TYPE=${1:-typescript}
# ... start server, run discovery, update table
```

### Step 11: Run Initial TypeScript Benchmark

Execute the complete workflow:

```bash
cd tests
./run-perf-benchmark.sh typescript
```

This will:
1. Start TypeScript server
2. Run all discovery scripts (binary search for limits)
3. Save results to `tests/results/perf-typescript-{timestamp}.json`
4. Update `docs/architecture/SERVER_PERFORMANCE.md`

---

## File Deliverables

| File | Purpose |
|------|---------|
| `tests/perf/discover-max-connections.ts` | Binary search for connection ceiling |
| `tests/perf/discover-max-ops.ts` | Ramp test for ops/sec limit |
| `tests/perf/discover-latency-ceiling.ts` | Latency percentiles at load levels |
| `tests/perf/discover-memory-stability.ts` | Heap growth measurement |
| `tests/perf/capture-all.ts` | Main orchestration script |
| `tests/perf/capture-environment.ts` | System info capture |
| `tests/perf/update-perf-table.ts` | Markdown table generator |
| `tests/run-perf-benchmark.sh` | Convenience wrapper |
| `docs/architecture/SERVER_PERFORMANCE.md` | Performance comparison doc |
| `tests/results/.gitkeep` | Results directory (JSON files gitignored) |

---

## Environment Variables

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `SERVER_TYPE` | `typescript`, `csharp` | `typescript` | Target server implementation |
| `SERVER_PORT` | number | `8080` (TS), `8090` (C#) | Server port |
| `PERF_OUTPUT_DIR` | path | `./results` | Where to save JSON results |
| `PERF_VERBOSE` | `true`, `false` | `false` | Enable detailed progress logging |
