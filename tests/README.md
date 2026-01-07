# SyncKit Tests

Comprehensive test suite for SyncKit sync engine.

## Setup

Install dependencies:

```bash
cd tests
bun install
```

## Running Tests

```bash
# Run all tests
bun test

# Run specific test suites
bun test:integration    # Integration tests
bun test:load          # Load & stress tests
bun test:chaos         # Chaos engineering tests
bun test:storage       # Storage & persistence tests
bun test:sync          # Sync protocol tests
bun test:offline       # Offline/online tests

# Watch mode
bun test:watch
```

## Test Structure

```
tests/
├── binary/              # Binary protocol tests (7 tests)
├── integration/          # Integration tests
│   ├── helpers/         # Test utilities
│   ├── sync/            # Sync protocol tests (86 tests)
│   ├── storage/         # Storage & persistence (55 tests)
│   └── offline/         # Offline scenarios (103 tests)
├── load/                # Load & stress tests (73 tests)
├── chaos/               # Chaos engineering (86 tests)
```

## Test Coverage

- **Binary Protocol Tests:** 7 tests (production WebSocket binary protocol)
- **Integration Tests:** 244 tests (sync, storage, offline)
- **Load Tests:** 73 tests (concurrent clients, sustained load, burst traffic)
- **Chaos Tests:** 86 tests (network failures, packet loss, latency, convergence)
- **Total:** 410 comprehensive tests ✅ (100% pass rate)

## Prerequisites

Tests require:
- Running PostgreSQL (optional - tests work with in-memory mode)
- Running Redis (optional - tests work without Redis)
- Bun runtime

## Environment Variables

Tests use default configuration but can be customized:

```bash
# Basic test configuration
TEST_PORT=3001              # Test server port
TEST_HOST=localhost         # Test server host
TEST_TIMEOUT=30000          # Test timeout (ms)
TEST_VERBOSE=false          # Verbose logging

# Testing against external servers (.NET, production)
TEST_SERVER_TYPE=external   # Use 'external' for pre-ß server
TEST_SERVER_PORT=8090       # Port of external serverß
```

## Running Against .NET Server

The test suite can run against the .NET SyncKit server for cross-platform validation:

```bash
# Option 1: Server already running
# First, start the .NET server in another terminal:
cd server/csharp/src/SyncKit.Server
SYNCKIT_SERVER_URL=http://localhost:8090 \
SYNCKIT_AUTH_REQUIRED=false \
JWT_SECRET='test-secret-key-for-integration-tests-only-32-chars' \
dotnet run

# Then in a separate terminal,run tests:
cd tests
./run-against-csharp.sh              # Run all integration tests
./run-against-csharp.sh sync         # Run only sync tests

# Option 2: Let the script start the server
./run-against-csharp.sh --with-server

# Option 3: Manual environment variables
TEST_SERVER_TYPE=external TEST_SERVER_PORT=8090 bun test integration
```

### .NET Server Prerequisites

```bash
# Start Docker dependencies (PostgreSQL + Redis)
cd server/csharp
docker compose -f docker-compose.test.yml up -d

# For in-memory mode (no Docker needed):
SYNCKIT_AUTH_REQUIRED=false dotnet run
```

### Current .NET Server Test Results

As of the latest test run:
- **247 pass** (96% pass rate)
- **9 fail** (isolation/timing issues with external server mode)

Known limitations with external server mode:
- Test isolation tests fail (server state persists between test suites)
- Delayed sync tests may timeout (require extended wait periods)

## Writing New Tests

See `integration/helpers/` for test utilities:
- `test-server.ts` - Server lifecycle management
- `test-client.ts` - Test client wrapper
- `assertions.ts` - Custom assertions
- `config.ts` - Test configuration

Example test:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { setupTestServer, teardownTestServer } from './helpers/test-server';
import { TestClient } from './helpers/test-client';

describe('My Test Suite', () => {
  beforeAll(async () => {
    await setupTestServer();
  });

  afterAll(async () => {
    await teardownTestServer();
  });

  it('should sync data', async () => {
    const client = new TestClient();
    await client.init();
    await client.connect();
    
    await client.setField('doc1', 'key', 'value');
    const state = await client.getDocumentState('doc1');
    
    expect(state.key).toBe('value');
    
    await client.cleanup();
  });
});
```

## Troubleshooting

**Issue:** `Cannot find package 'hono'`
- **Solution:** Run `bun install` in the `tests/` directory

**Issue:** Tests timing out
- **Solution:** Increase `TEST_TIMEOUT` or check if server is running

**Issue:** Port already in use
- **Solution:** Change `TEST_PORT` or kill process on port 3001
