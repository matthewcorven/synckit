# Phase 7: Testing & Validation

**Phase Duration:** 2 weeks (Weeks 12-13)  
**Phase Goal:** Pass all 410 existing tests, performance benchmarks, and prepare PR

> **Critical:** This phase validates full compatibility with the existing TypeScript server. All integration tests (244), chaos tests (86), load tests (73), and binary protocol tests (7) must pass against the .NET server.

---

## Overview

This phase runs the complete test suite against the .NET server and prepares the implementation for PR and merge.

## Quick Start with Aspire

The fastest way to set up the test environment is using Aspire orchestration:

```bash
# Start C# backend with PostgreSQL + Redis
cd orchestration/aspire
dotnet run --project SyncKit.AppHost --launch-profile "C# Backend + PostgreSQL"

# In another terminal, run tests
cd tests
SYNCKIT_SERVER_URL=ws://localhost:5000/ws bun test
```

For cross-backend compatibility testing:

```bash
# Start both backends against same PostgreSQL/Redis
dotnet run --project SyncKit.AppHost --launch-profile "Full Stack (Both Backends + PostgreSQL)"

# Run tests against both backends to verify parity
```

See [orchestration/aspire/README.md](../../../../orchestration/aspire/README.md) for all launch profiles.

## Work Items

| ID | Title | Priority | Est (h) | Document |
|----|-------|----------|---------|----------|
| V7-01 | Set up test environment | P0 | 4 | [V7-01.md](V7-01.md) |
| V7-02 | Run binary protocol tests | P0 | 3 | [V7-02.md](V7-02.md) |
| V7-03 | Run integration tests | P0 | 8 | [V7-03.md](V7-03.md) |
| V7-04 | Run load tests | P0 | 4 | [V7-04.md](V7-04.md) |
| V7-05 | Run chaos tests | P0 | 4 | [V7-05.md](V7-05.md) |
| V7-06 | Create SDK compatibility tests | P0 | 4 | [V7-06.md](V7-06.md) |
| V7-07 | Create performance benchmarks | P1 | 4 | [V7-07.md](V7-07.md) |
| V7-08 | Create test report | P0 | 2 | [V7-08.md](V7-08.md) |
| V7-09 | Prepare PR description | P0 | 2 | [V7-09.md](V7-09.md) |
| V7-10 | Code review and fixes | P0 | 8 | [V7-10.md](V7-10.md) |
| V7-11 | Connection rate limiting (optional) | P2 | 3 | [V7-11.md](V7-11.md) |
| V7-12 | High-performance logging (optional) | P2 | 1 | [V7-12.md](V7-12.md) |
| **Total** | | | **47** | |

## Test Summary

| Category | Count | Description |
|----------|-------|-------------|
| Binary Protocol | 7 | Wire format compatibility |
| Integration | 244 | Full workflow tests |
| Load | 73 | Performance under stress |
| Chaos | 86 | Fault tolerance |
| **Total** | **410** | |

## Dependencies

```
All Previous Phases ─► V7-01 ─┬─► V7-02 ─┬─► V7-06
                              ├─► V7-03 ─┤
                              ├─► V7-04 ─┼─► V7-07
                              └─► V7-05 ─┘

V7-02...V7-07 ─► V7-08 ─► V7-09 ─► V7-10
```

## Performance Targets

| Metric | Target |
|--------|--------|
| p50 latency | <10ms |
| p99 latency | <100ms |
| Throughput | >5000 msg/s |
| Memory (1k conn) | <500MB |

## Exit Criteria

- [ ] All 410 tests pass
- [ ] Performance meets or exceeds TypeScript server
- [ ] SDK works without modification
- [ ] Documentation complete
- [ ] PR approved and merged

---

**Legend:** ⬜ Not Started | 🔄 In Progress | ✅ Complete

[← Back to Implementation Plan](../../IMPLEMENTATION_PLAN.md)
