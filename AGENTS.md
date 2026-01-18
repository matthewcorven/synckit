# AGENTS.md

> **Purpose:** This document provides AI coding agents with essential context for working on this repository.

---

## Repository Overview

**SyncKit** is a production-ready, offline-first sync engine for modern collaborative applications. It provides:

- Real-time synchronization with automatic conflict resolution
- Rich text editing (Fugue + Peritext CRDTs)
- Undo/redo that syncs across tabs and sessions
- Live presence and cursor sharing
- Framework adapters for React, Vue, and Svelte

**Core Value Proposition:** Build collaborative apps in hours, not months—without vendor lock-in.

---

## Repository Structure

| Directory | Purpose |
|-----------|---------|
| `core/` | Rust CRDT engine (compiled to WebAssembly) |
| `sdk/` | TypeScript SDK (`@synckit-js/sdk`) |
| `server/typescript/` | Reference TypeScript WebSocket server |
| `server/csharp/src/` | .NET Server implementation (in development) |
| `tests/` | Integration, load, and chaos test suites |
| `examples/` | Example applications (React, Vue, Svelte, Vanilla) |
| `docs/` | Documentation and guides |

---

## Active Initiative: .NET Server Implementation

### Context

SyncKit is adding a second server implementation in **ASP.NET Core (.NET 10)** to provide enterprise .NET teams with a native option while maintaining full protocol compatibility with the TypeScript server.

### Key Documents

All .NET Server planning documents are located in `docs/.dotnet-feature/`:

| Document | Purpose |
|----------|---------|
| [PROPOSAL.md](docs/.dotnet-feature/PROPOSAL.md) | Feature proposal with goals, scope, and maintainer feedback |
| [IMPLEMENTATION_PLAN.md](docs/.dotnet-feature/IMPLEMENTATION_PLAN.md) | **Single source of truth** for implementation—architecture decisions, timeline, dependencies, success criteria |
| [EVALUATION_CHECKLIST.md](docs/.dotnet-feature/EVALUATION_CHECKLIST.md) | Quality assurance checklist for plan documents |

### Phase Work Items

Detailed work items are in `docs/.dotnet-feature/work-items/`:

| Phase | Document | Focus |
|-------|----------|-------|
| 1 | [PHASE-1-FOUNDATION.md](docs/.dotnet-feature/work-items/PHASE-1-FOUNDATION.md) | Solution structure, config, logging, health endpoint, Docker |
| 2 | [PHASE-2-PROTOCOL.md](docs/.dotnet-feature/work-items/PHASE-2-PROTOCOL.md) | WebSocket middleware, JSON/Binary protocols, auto-detection |
| 3 | [PHASE-3-AUTH.md](docs/.dotnet-feature/work-items/PHASE-3-AUTH.md) | JWT authentication, RBAC permissions |
| 4 | [PHASE-4-SYNC-ENGINE.md](docs/.dotnet-feature/work-items/PHASE-4-SYNC-ENGINE.md) | Vector clocks, LWW merge, sync coordinator |
| 5 | [PHASE-5-AWARENESS.md](docs/.dotnet-feature/work-items/PHASE-5-AWARENESS.md) | Presence protocol, cursor sharing |
| 6 | [PHASE-6-STORAGE.md](docs/.dotnet-feature/work-items/PHASE-6-STORAGE.md) | PostgreSQL storage, Redis pub/sub |
| 7 | [PHASE-7-TESTING.md](docs/.dotnet-feature/work-items/PHASE-7-TESTING.md) | Test coverage, integration tests, documentation |

### Technical Summary

- **Target Framework:** .NET 10 (ASP.NET Core)
- **Protocol:** Dual WebSocket protocols (JSON for tests, Binary for SDK clients) with auto-detection
- **Authentication:** JWT + RBAC
- **Sync Algorithm:** Last-Write-Wins (LWW) with Vector Clocks
- **Storage:** In-Memory (default), PostgreSQL (persistent)
- **Coordination:** Redis pub/sub for multi-server deployments
- **Test Target:** Pass all ~410 integration tests from existing test suite
- **Timeline:** 13 weeks (57 work items, ~217 hours estimated)

### Test Dependencies

PostgreSQL and Redis are **required** for full test validation. Both are provided via Docker Compose:

```bash
# Start test dependencies
cd server/csharp
docker compose -f docker-compose.test.yml up -d

# Run tests
cd ../../tests
bun test
```

---

## Testing During Development

### ⚠️ Critical: Terminal Separation for Server Testing

**The .NET server is a long-running process.** When running tests against it, you **MUST use separate terminals**:

| Terminal | Purpose | Notes |
|----------|---------|-------|
| **Terminal 1** | .NET server process | Runs continuously, do NOT interrupt |
| **Terminal 2** | Test commands | All `bun test`, `curl`, health checks |

**Common mistake:** Running `curl` or `bun test` in the same terminal as `dotnet run` will kill the server process (Ctrl+C or command completion terminates the foreground process).

### .NET Server Testing Workflow

**Step 1: Start the .NET server (Terminal 1 - dedicated)**
```bash
cd server/csharp/src/SyncKit.Server
SYNCKIT_SERVER_URL=http://localhost:8090 \
SYNCKIT_AUTH_REQUIRED=false \
JWT_SECRET='test-secret-key-for-integration-tests-only-32-chars' \
dotnet run
```
> Leave this terminal running. The server logs will appear here.

**Step 2: Run tests (Terminal 2 - separate)**
```bash
cd tests

# Option A: Run all integration tests
./integration/run-against-csharp.sh

# Option B: Run specific test category
./integration/run-against-csharp.sh sync      # Sync protocol tests
./integration/run-against-csharp.sh binary    # Binary protocol tests
./integration/run-against-csharp.sh load      # Load tests
./integration/run-against-csharp.sh chaos     # Chaos tests

# Option C: Manual environment variables
TEST_SERVER_TYPE=external TEST_SERVER_PORT=8090 bun test integration/
```

**Alternative: Auto-managed server (single terminal)**
```bash
cd tests
./integration/run-against-csharp.sh --with-server    # Script starts/stops server automatically
```

### Quick Health Check

```bash
# In Terminal 2 (NOT the server terminal)
curl -s -w '\nHTTP Status: %{http_code}\n' http://localhost:8090/health
```

Or use VS Code tasks: `Cmd+Shift+P` → "Tasks: Run Task" → "Health Check"

### Port Configuration

| Server | Default Port |
|--------|-------------|
| .NET server | 8090 |
| TypeScript server | 8080 |

### Environment Variables for .NET Server Testing

| Variable | Value | Purpose |
|----------|-------|---------|
| `TEST_SERVER_TYPE` | `external` | Use pre-started server instead of spawning one |
| `TEST_SERVER_PORT` | `8090` | Port where external server is listening |
| `SYNCKIT_SERVER_URL` | `http://localhost:8090` | Server's base URL |
| `SYNCKIT_AUTH_REQUIRED` | `false` | Disable auth for testing |
| `JWT_SECRET` | `test-secret-key-for-integration-tests-only-32-chars` | JWT signing key (must be 32+ chars) |

> **💡 VS Code Users:** Pre-configured tasks are available in `.vscode/tasks.json` (`Health Check`, `Health Check (Verbose)`). Access via `Cmd+Shift+P` → "Tasks: Run Task". Tasks run in a new terminal panel and prompt for the port.

---

## Performance Testing

Performance benchmarks measure max connections, throughput, latency, and memory stability.

📖 **Full instructions:** [docs/architecture/SERVER_PERFORMANCE.md](docs/architecture/SERVER_PERFORMANCE.md)

### Quick Reference

```bash
# Local: Run perf benchmark for C# server
cd tests && bun install
PERF_MAX_CONNECTIONS=30000 ./run-perf-benchmark.sh csharp

# GitHub Actions: Trigger workflow
gh repo set-default matthewcorven/synckit
gh workflow run perf-benchmark.yml \
  --ref feature/11-dotnet-server-perf \
  -f server_type=csharp \
  -f max_connections=30000
```

**Key notes:**
- The `--ref` flag is required—it specifies the branch with the `workflow_dispatch` trigger
- Results are saved to `tests/results/` and auto-update `SERVER_PERFORMANCE.md`
- Expected duration: 15-45 minutes locally

---

## Reference Implementation

When implementing the .NET server, refer to the TypeScript server as the canonical reference:

| Component | TypeScript Reference |
|-----------|---------------------|
| Protocol | `server/typescript/src/websocket/protocol.ts` |
| Connection | `server/typescript/src/websocket/connection.ts` |
| Auth/JWT | `server/typescript/src/auth/jwt.ts` |
| Sync | `server/typescript/src/sync/coordinator.ts` |
| Storage | `server/typescript/src/storage/interface.ts` |
| Config | `server/typescript/src/config.ts` |

---

## Agent Guidelines

1. **Start with IMPLEMENTATION_PLAN.md** — It is the single source of truth for the .NET initiative
2. **Check phase documents** before implementing any work item for detailed acceptance criteria
3. **Maintain protocol compatibility** — The .NET server must pass all existing integration tests
4. **Use Docker Compose** for PostgreSQL and Redis dependencies
5. **Follow existing patterns** from the TypeScript server implementation
6. Be aware of your current working directory before running commands so that don't use any relative paths incorrectly.
7. **Never run tests in the same terminal foreground as a server process** — Servers must run in dedicated terminal background (or using a tool); tests and health checks go in terminal foreground.

---

## Quick Links

- [README.md](README.md) — Full project overview
- [CONTRIBUTING.md](CONTRIBUTING.md) — Contribution guidelines including key Commit Conventions
- [ROADMAP.md](ROADMAP.md) — Project roadmap
- [docs/](docs/) — Full documentation
