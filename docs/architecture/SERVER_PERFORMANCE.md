# Server Performance Comparison

This document summarizes performance discovery benchmarks for SyncKit server implementations. The numbers are produced by exploratory scripts in tests/perf and are intended to help compare limits between TypeScript and C# servers.

## Environment (Auto-Generated)

<!-- PERF_ENV_START -->
| Server | OS | CPU | RAM (GB) | Runtime | Captured |
|--------|----|-----|----------|---------|----------|
| TypeScript | linux 6.11.0-1018-azure | AMD EPYC 7763 64-Core Processor (4 cores) | 16 | Bun 1.3.6 | 2026-01-17T15:37:49.881Z |
| C# | — | — | — | — | — |
<!-- PERF_ENV_END -->

## Performance Summary (Auto-Generated)

<!-- PERF_TABLE_START -->
| Metric | TypeScript | C# | Unit |
|--------|------------|-----|------|
| Max Concurrent Connections | 5,001 | — | connections |
| Max Ops/Sec (Single Client) | 1,000 | — | ops/sec |
| Max Ops/Sec (Aggregate) | 2,000 | — | ops/sec |
| P95 Latency | 54 | — | ms |
| Memory Growth | 3.91 | — | MB/min |

*Last updated: 2026-01-17T15:37:49.881Z*
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
