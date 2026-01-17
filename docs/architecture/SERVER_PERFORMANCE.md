# Server Performance Comparison

This document summarizes performance discovery benchmarks for SyncKit server implementations. The numbers are produced by exploratory scripts in tests/perf and are intended to help compare limits between TypeScript and C# servers.

## Environment (Auto-Generated)

<!-- PERF_ENV_START -->
| Server | OS | CPU | RAM (GB) | Runtime | Captured |
|--------|----|-----|----------|---------|----------|
| TypeScript | linux 6.11.0-1018-azure | Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz (4 cores) | 16 | Bun 1.3.6 | 2026-01-17T21:53:14.057Z |
| C# | — | — | — | — | — |
<!-- PERF_ENV_END -->

## Performance Summary (Auto-Generated)

<!-- PERF_TABLE_START -->
| Metric | TypeScript | C# | Unit |
|--------|------------|-----|------|
| Max Concurrent Connections | 30,001 | — | connections |
| Max Ops/Sec (Single Client) | 1,000 | — | ops/sec |
| Max Ops/Sec (Aggregate) | 2,000 | — | ops/sec |
| P95 Latency | 51 | — | ms |
| Memory Growth | 3.95 | — | MB/min |

*Last updated: 2026-01-17T21:53:14.056Z*
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
