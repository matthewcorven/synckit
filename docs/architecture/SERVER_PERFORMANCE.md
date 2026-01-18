# Server Performance Comparison

This document summarizes performance discovery benchmarks for SyncKit server implementations. The numbers are produced by exploratory scripts in tests/perf and are intended to help compare limits between TypeScript and C# servers.

## Environment (Auto-Generated)

<!-- PERF_ENV_START -->
| Server | OS | CPU | RAM (GB) | Runtime | Captured |
|--------|----|-----|----------|---------|----------|
| TypeScript | macOS 25.2.0 | Apple M4 Max (16 cores) | 128 | Bun 1.3.5 | 2026-01-15T13:32:48.532Z |
| C# | macOS 25.2.0 | Apple M4 Max (16 cores) | 128 | Bun 1.3.5 | 2026-01-18T00:51:08.984Z |
<!-- PERF_ENV_END -->

## Performance Summary (Auto-Generated)

<!-- PERF_TABLE_START -->
| Metric | TypeScript | C# | Unit |
|--------|------------|-----|------|
| Max Concurrent Connections | 5,001 | 501 | connections |
| Max Ops/Sec (Single Client) | 1,000 | 1,000 | ops/sec |
| Max Ops/Sec (Aggregate) | 2,000 | 1,529 | ops/sec |
| P95 Latency | 55 | 1,465 | ms |
| Memory Growth | -1.28 | -0.29 | MB/min |

*Last updated: 2026-01-15T13:32:48.532Z*
<!-- PERF_TABLE_END -->

## Configuration Limits (Manual)

Document any server-side caps or configuration limits that affect performance:

- Max WebSocket connections
- Rate limits
- Payload size limits
- Storage constraints

## Methodology

Performance discovery scripts are intentionally exploratory and run outside CI. Each script progressively ramps load to find the maximum stable operating point:

- Max connections: binary search across connection counts, verifying stability for 10s at each step.
- Max ops/sec: ramps send rate until fewer than 80% of ops converge within 1s, then binary searches.
- Latency ceiling: measures p95 latency at idle, 50%, 80%, and max load.
- Memory stability: samples memory every 10s during a sustained 5-minute load and computes growth rate in MB/min.
