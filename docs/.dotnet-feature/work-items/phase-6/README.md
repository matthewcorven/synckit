# Phase 6: Storage

**Phase Duration:** 1.5 weeks (Weeks 10-11)  
**Phase Goal:** Persistent storage with PostgreSQL and horizontal scaling with Redis pub/sub

> **Note:** This phase makes the server production-ready with persistent document storage and multi-instance support.

---

## Overview

This phase implements persistent storage with PostgreSQL and Redis pub/sub for multi-server deployments.

## Prerequisites

PostgreSQL and Redis are **required** for this phase. You have two options:

### Option 1: Aspire Orchestration (Recommended)

The Aspire AppHost provides the easiest way to start all dependencies:

```bash
cd orchestration/aspire
dotnet run --project SyncKit.AppHost --launch-profile "C# Backend + PostgreSQL"
```

This automatically:
- Starts PostgreSQL with persistent volume
- Starts Redis with persistent volume  
- Configures connection strings via environment variables
- Provides unified dashboard at https://localhost:17235

See [orchestration/aspire/README.md](../../../../orchestration/aspire/README.md) for all configuration options.

### Option 2: Docker Compose

For manual control or CI/CD pipelines:

```bash
cd server/csharp
docker compose -f docker-compose.test.yml up -d postgres redis
```

## Shared Infrastructure Note

Both TypeScript and C# servers share the **same PostgreSQL and Redis instances** via Aspire orchestration. This means:

- **Schema is managed centrally** - by shared migration tooling (T6-03), not individual servers
- **C# adapter validates, doesn't create** - assumes schema already exists
- **Both servers are protocol-compatible** - same tables, same data formats

## Work Items

| ID | Title | Priority | Est (h) | Document |
|----|-------|----------|---------|----------|
| T6-01 | Define storage abstractions | P0 | 2 | [T6-01.md](T6-01.md) |
| T6-02 | Create PostgreSQL storage adapter | P0 | 6 | [T6-02.md](T6-02.md) |
| T6-03 | Shared database migration tooling | P0 | 4 | [T6-03.md](T6-03.md) |
| T6-04 | Create Redis pub/sub provider | P0 | 6 | [T6-04.md](T6-04.md) |
| T6-05 | Create storage provider factory | P0 | 3 | [T6-05.md](T6-05.md) |
| T6-06 | Add health checks for storage | P1 | 2 | [T6-06.md](T6-06.md) |
| T6-07 | Storage integration tests | P0 | 6 | [T6-07.md](T6-07.md) |
| **Total** | | | **29** | |

## Dependencies

```
                    ┌─► T6-03 (Migrations) ─► T6-02 (PostgreSQL Adapter) ─┐
                    │                                                      │
S4-03 ─► T6-01 (Interfaces) ─────────────────────────────────────────────►├─► T6-05 (Factory)
                    │                                                      │
                    └─► T6-04 (Redis Pub/Sub) ────────────────────────────┘
                              ▲
                              │
                    S4-06, W5-03

T6-02, T6-04 ─► T6-06 (Health Checks)

T6-02...T6-06 ─► T6-07 (Integration Tests)
```

**Key sequencing:**
- T6-01 defines interfaces that all other tasks depend on
- T6-03 (migrations) runs before T6-02 (adapter) since the adapter assumes schema exists
- T6-04 (Redis) can run in parallel with T6-02/T6-03 after T6-01 completes
- T6-05 (factory) needs both T6-02 and T6-04 complete

## Connection Strings

| Service | Aspire (auto-injected) | Manual Connection String |
|---------|------------------------|--------------------------|
| PostgreSQL | `ConnectionStrings__synckit` | `Host=localhost;Port=5432;Database=synckit_test;Username=synckit;Password=synckit_test` |
| Redis | `ConnectionStrings__redis` | `localhost:6379` |

> **Note:** When using Aspire, connection strings are automatically injected as environment variables. No manual configuration needed.

## Exit Criteria

- [ ] Documents persist to PostgreSQL
- [ ] Multi-instance sync via Redis pub/sub
- [ ] Health checks for all storage backends
- [ ] Integration tests pass

---

**Legend:** ⬜ Not Started | 🔄 In Progress | ✅ Complete

[← Back to Implementation Plan](../../IMPLEMENTATION_PLAN.md)
