# Phase 7: Testing & Validation - Detailed Work Items

**Phase Duration:** 2 weeks (Weeks 12-13)  
**Phase Goal:** Pass all 410 existing tests, performance benchmarks, and prepare PR

> **Critical:** This phase validates full compatibility with the existing TypeScript server. All integration tests (244), chaos tests (86), load tests (73), and binary protocol tests (7) must pass against the .NET server.

---

## Work Item Details

### V7-01: Set Up Test Environment

**Priority:** P0  
**Estimate:** 4 hours  
**Dependencies:** All previous phases

#### Description

Configure the test environment to run the existing test suite against the .NET server.

#### Tasks

1. Update test configuration for .NET server
2. Configure Aspire orchestration for test environment
3. Add test server startup scripts (Aspire CLI or Docker Compose)
4. Configure parallel test execution

#### Test Environment Options

The test environment requires PostgreSQL and Redis for full feature parity validation. You have two options:

### Option 1: Aspire Orchestration (Recommended)

The Aspire AppHost provides the easiest way to start the full test environment:

```bash
# Start C# backend with PostgreSQL + Redis
cd orchestration/aspire
dotnet run --project SyncKit.AppHost --launch-profile "C# Backend + PostgreSQL"

# In another terminal, run tests
cd tests
export SYNCKIT_SERVER_URL=ws://localhost:5000/ws
export SYNCKIT_HTTP_URL=http://localhost:5000
bun test
```

**Benefits of Aspire:**
- Automatic dependency management (PostgreSQL, Redis)
- Persistent volumes for data across restarts
- Unified dashboard for monitoring all services
- Proper health checks and startup ordering
- Connection strings automatically injected

### Option 2: Docker Compose (CI/CD)

For CI/CD pipelines or when Aspire is not available:

```yaml
# server/csharp/src/docker-compose.test.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: synckit_test
      POSTGRES_USER: synckit
      POSTGRES_PASSWORD: synckit_test
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U synckit -d synckit_test"]
      interval: 5s
      timeout: 5s
      retries: 5
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  synckit-dotnet:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - SYNCKIT__JWT__SECRET=test-secret-at-least-32-characters-long
      - SYNCKIT__LOG__LEVEL=Debug
      - STORAGE__PROVIDER=postgresql
      - STORAGE__POSTGRESQL__CONNECTIONSTRING=Host=postgres;Port=5432;Database=synckit_test;Username=synckit;Password=synckit_test
      - STORAGE__REDIS__ENABLED=true
      - STORAGE__REDIS__CONNECTIONSTRING=redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 2s
      timeout: 5s
      retries: 10

volumes:
  postgres_data:
```

#### Connection Strings (for local development)

| Service | Connection String |
|---------|------------------|
| PostgreSQL | `Host=localhost;Port=5432;Database=synckit_test;Username=synckit;Password=synckit_test` |
| Redis | `localhost:6379` |

#### Test Runner Scripts

**Option 1: Aspire Orchestration (Recommended for Development)**

```bash
#!/bin/bash
# tests/run-against-csharp-aspire.sh
set -e

echo "Starting test environment via Aspire..."

# Start Aspire AppHost in background
cd ../orchestration/aspire
dotnet run --project SyncKit.AppHost --launch-profile "C# Backend + PostgreSQL" &
ASPIRE_PID=$!

# Wait for server to be ready (Aspire handles dependency ordering)
echo "Waiting for services to be healthy..."
for i in {1..60}; do
    if curl -s http://localhost:5000/health > /dev/null; then
        echo "Server ready!"
        break
    fi
    echo "Waiting for server... ($i/60)"
    sleep 2
done

# Run tests
cd ../../tests
export SYNCKIT_SERVER_URL=ws://localhost:5000/ws
export SYNCKIT_HTTP_URL=http://localhost:5000
export SYNCKIT_USE_STORAGE=true
export SYNCKIT_USE_REDIS=true
bun test

# Capture exit code
TEST_EXIT=$?

# Cleanup - Aspire handles container cleanup on exit
kill $ASPIRE_PID 2>/dev/null || true

exit $TEST_EXIT
```

**Option 2: Docker Compose (CI/CD)**

```bash
#!/bin/bash
# server/csharp/src/run-tests.sh
set -e

echo "Starting test environment (PostgreSQL + Redis + .NET Server)..."
docker compose -f docker-compose.test.yml up -d --build

# Wait for all services to be healthy
echo "Waiting for services to be healthy..."
docker compose -f docker-compose.test.yml ps

# Run tests
cd ../../tests
export SYNCKIT_SERVER_URL=ws://localhost:8080/ws
export SYNCKIT_HTTP_URL=http://localhost:8080
export SYNCKIT_USE_STORAGE=true
export SYNCKIT_USE_REDIS=true
bun test

# Capture exit code
TEST_EXIT=$?

# Cleanup
cd ../server/csharp
docker compose -f docker-compose.test.yml down

exit $TEST_EXIT
```

**Option 3: Local Development (Dependencies via Docker)**

```bash
#!/bin/bash
# tests/run-against-csharp.sh
set -e

# Start only PostgreSQL and Redis via Docker
cd ../server/csharp
docker compose -f docker-compose.test.yml up -d postgres redis

# Wait for dependencies
echo "Waiting for PostgreSQL and Redis..."
sleep 5

# Start .NET server locally (uses local connection strings)
export STORAGE__PROVIDER=postgresql
export STORAGE__POSTGRESQL__CONNECTIONSTRING="Host=localhost;Port=5432;Database=synckit_test;Username=synckit;Password=synckit_test"
export STORAGE__REDIS__ENABLED=true
export STORAGE__REDIS__CONNECTIONSTRING="localhost:6379"

dotnet run &
SERVER_PID=$!

# Wait for server to be ready
for i in {1..30}; do
    if curl -s http://localhost:8080/health > /dev/null; then
        echo "Server ready!"
        break
    fi
    echo "Waiting for server... ($i/30)"
    sleep 1
done

# Run tests
cd ../../tests
export SYNCKIT_SERVER_URL=ws://localhost:8080/ws
export SYNCKIT_USE_STORAGE=true
export SYNCKIT_USE_REDIS=true
bun test

# Capture exit code
TEST_EXIT=$?

# Cleanup
kill $SERVER_PID

exit $TEST_EXIT
```

#### Acceptance Criteria

- [ ] Docker Compose starts .NET server
- [ ] Health check waits for server ready
- [ ] Test suite can connect to .NET server
- [ ] Results captured and exported
- [ ] Parallel execution works

---

### V7-02: Run Binary Protocol Tests

**Priority:** P0  
**Estimate:** 3 hours  
**Dependencies:** V7-01

#### Description

Run and pass all 7 binary protocol tests against the .NET server.

#### Test Files

- `tests/binary/binary-protocol.test.ts`
- `tests/binary/binary-roundtrip.test.ts`

#### Expected Tests

| Test | Description |
|------|-------------|
| Binary message encoding | Correct header format |
| Binary message decoding | Parse header correctly |
| Type code mapping | All codes match |
| Endianness | Big-endian for multi-byte |
| Round-trip | Encode → decode matches |
| Large payloads | Handle >64KB messages |
| Invalid binary | Graceful error handling |

#### Validation Command

```bash
cd tests
SYNCKIT_SERVER_URL=ws://localhost:8080/ws bun test binary/
```

#### Expected Output

```
✓ binary-protocol.test.ts
  ✓ Binary message encoding (12ms)
  ✓ Binary message decoding (8ms)
  ✓ Type code mapping (5ms)
  ✓ Endianness (3ms)
  ✓ Round-trip all message types (45ms)
  ✓ Large payload handling (28ms)
  ✓ Invalid binary graceful error (15ms)

7 pass
0 fail
```

#### Troubleshooting Guide

| Issue | Likely Cause | Fix |
|-------|--------------|-----|
| Header parse fail | Endianness wrong | Use BinaryPrimitives with BigEndian |
| Wrong type code | Mapping mismatch | Check MessageTypeCode enum |
| Truncated message | Payload length wrong | Verify uint32 read |

#### Acceptance Criteria

- [ ] All 7 binary tests pass
- [ ] Wire format matches TypeScript
- [ ] No test timeouts
- [ ] Error cases handled

---

### V7-03: Run Integration Tests

**Priority:** P0  
**Estimate:** 8 hours  
**Dependencies:** V7-01

#### Description

Run and pass all 244 integration tests against the .NET server.

#### Test Categories

| Category | Count | Description |
|----------|-------|-------------|
| Auth | 32 | JWT, API key, permissions |
| Subscribe | 28 | Document subscription flow |
| Delta | 45 | Delta sync and broadcast |
| Sync | 38 | Sync request/response |
| Awareness | 35 | Presence and cursors |
| Reconnect | 22 | Reconnection handling |
| Error | 24 | Error cases and recovery |
| E2E | 20 | Full workflow tests |

#### Validation Command

```bash
cd tests
SYNCKIT_SERVER_URL=ws://localhost:8080/ws bun test integration/
```

#### Test Tracking Spreadsheet

Track progress as you fix issues:

```markdown
| Test File | Pass | Fail | Blocked | Notes |
|-----------|------|------|---------|-------|
| auth.test.ts | 32 | 0 | 0 | ✅ |
| subscribe.test.ts | 28 | 0 | 0 | ✅ |
| delta.test.ts | 45 | 0 | 0 | ✅ |
| ... | | | | |
```

#### Common Issues and Fixes

| Issue | Symptom | Fix |
|-------|---------|-----|
| Message ID format | Test expects specific format | Match TypeScript `nanoid()` |
| Timestamp precision | Off-by-one errors | Use Unix milliseconds |
| JSON casing | Property not found | Use camelCase |
| Array ordering | Wrong order in response | Match TypeScript order |

#### Acceptance Criteria

- [ ] All 244 integration tests pass
- [ ] No test timeouts (>30s)
- [ ] Tests run in <5 minutes total
- [ ] No flaky tests

---

### V7-04: Run Load Tests

**Priority:** P0  
**Estimate:** 4 hours  
**Dependencies:** V7-03

#### Description

Run and pass all 73 load tests to verify performance under stress.

#### Load Test Scenarios

| Scenario | Connections | Messages/sec | Duration |
|----------|-------------|--------------|----------|
| Basic load | 100 | 1000 | 60s |
| High connections | 1000 | 500 | 60s |
| High throughput | 100 | 10000 | 30s |
| Sustained | 500 | 2000 | 300s |
| Burst | 100 | 50000 | 10s |

#### Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| p50 latency | <10ms | Median response time |
| p99 latency | <100ms | Tail latency |
| Throughput | >5000 msg/s | Single instance |
| Memory | <500MB | 1000 connections |
| CPU | <80% | Under load |

#### Validation Command

```bash
cd tests
SYNCKIT_SERVER_URL=ws://localhost:8080/ws bun test load/
```

#### Performance Comparison

```bash
# Generate comparison report
bun run load:compare --baseline=typescript --target=dotnet
```

#### Acceptance Criteria

- [ ] All 73 load tests pass
- [ ] p99 latency <100ms
- [ ] No memory leaks
- [ ] Graceful degradation under overload
- [ ] Performance within 20% of TypeScript

---

### V7-05: Run Chaos Tests

**Priority:** P0  
**Estimate:** 4 hours  
**Dependencies:** V7-03

#### Description

Run and pass all 86 chaos tests for fault tolerance and recovery.

#### Chaos Scenarios

| Scenario | Description |
|----------|-------------|
| Network partition | Simulate network splits |
| Server restart | Recovery after restart |
| Message loss | Handle dropped messages |
| Clock skew | Handle time drift |
| Slow client | Back-pressure handling |
| Malformed messages | Invalid input handling |
| Connection storms | Rapid connect/disconnect |
| Memory pressure | Low memory conditions |

#### Validation Command

```bash
cd tests
SYNCKIT_SERVER_URL=ws://localhost:8080/ws bun test chaos/
```

#### Fault Injection

```typescript
// Example chaos test setup
const chaos = new ChaosProxy({
  target: 'ws://localhost:8080/ws',
  latency: { min: 10, max: 500 },
  dropRate: 0.05,
  reorderRate: 0.02
});
```

#### Acceptance Criteria

- [ ] All 86 chaos tests pass
- [ ] Server recovers from all fault scenarios
- [ ] No data corruption
- [ ] Proper error messages sent
- [ ] Timeouts handled correctly

---

### V7-06: Create SDK Compatibility Tests

**Priority:** P0  
**Estimate:** 4 hours  
**Dependencies:** V7-02

#### Description

Verify the .NET server works with the production SDK (binary protocol).

#### Prerequisites

Start the test environment using Aspire:

```bash
# Start C# backend with PostgreSQL + Redis
cd orchestration/aspire
dotnet run --project SyncKit.AppHost --launch-profile "C# Backend + PostgreSQL"
```

Or for cross-backend testing:

```bash
# Start both backends to verify SDK works with either
dotnet run --project SyncKit.AppHost --launch-profile "Full Stack (Both Backends + PostgreSQL)"
```

#### Test Scenarios

1. SDK connects to .NET server
2. Document sync works end-to-end
3. Awareness updates work
4. Reconnection works
5. All SDK features functional
6. **Cross-backend sync** (data written via TS backend readable via C# backend)

#### Test Implementation

```typescript
// tests/sdk/dotnet-server-compat.test.ts
import { SyncKitClient, Document } from '@synckit/sdk';

describe('SDK with .NET Server', () => {
  let client: SyncKitClient;
  
  beforeAll(async () => {
    client = new SyncKitClient({
      serverUrl: process.env.SYNCKIT_SERVER_URL!,
      token: createTestToken(),
    });
    await client.connect();
  });

  afterAll(async () => {
    await client.disconnect();
  });

  test('document sync roundtrip', async () => {
    const doc = await client.subscribe('test-doc');
    
    doc.set('field', 'value');
    await doc.sync();
    
    // Create second client
    const client2 = new SyncKitClient({
      serverUrl: process.env.SYNCKIT_SERVER_URL!,
      token: createTestToken(),
    });
    await client2.connect();
    const doc2 = await client2.subscribe('test-doc');
    
    expect(doc2.get('field')).toBe('value');
  });

  test('awareness updates', async () => {
    const doc = await client.subscribe('awareness-test');
    
    client.setAwareness(doc.id, {
      cursor: { x: 100, y: 200 }
    });

    // Verify awareness reaches other clients
  });

  test('reconnection recovery', async () => {
    const doc = await client.subscribe('reconnect-test');
    doc.set('before', 'disconnect');
    
    // Force disconnect
    await client.disconnect();
    await client.connect();
    
    // Verify state recovered
    const doc2 = await client.subscribe('reconnect-test');
    expect(doc2.get('before')).toBe('disconnect');
  });
});
```

#### Validation Command

```bash
cd tests
SYNCKIT_SERVER_URL=ws://localhost:8080/ws bun test sdk/
```

#### Acceptance Criteria

- [ ] SDK connects successfully
- [ ] Binary protocol works
- [ ] All SDK operations work
- [ ] Reconnection works
- [ ] No protocol errors

---

### V7-07: Create Performance Benchmarks

**Priority:** P1  
**Estimate:** 4 hours  
**Dependencies:** V7-04

#### Description

Create detailed performance benchmarks comparing .NET and TypeScript servers.

#### Benchmark Suite

```csharp
// server/csharp/src/benchmarks/SyncBenchmarks.cs
[MemoryDiagnoser]
[SimpleJob(RuntimeMoniker.Net90)]
public class SyncBenchmarks
{
    private JsonProtocolHandler _jsonHandler = null!;
    private BinaryProtocolHandler _binaryHandler = null!;
    private byte[] _jsonMessage = null!;
    private byte[] _binaryMessage = null!;

    [GlobalSetup]
    public void Setup()
    {
        _jsonHandler = new JsonProtocolHandler();
        _binaryHandler = new BinaryProtocolHandler();
        
        var message = new DeltaMessage
        {
            Id = "msg-1",
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            DocumentId = "doc-1",
            Delta = JsonDocument.Parse("""{"field":"value"}""").RootElement,
            VectorClock = new() { ["client-1"] = 1 }
        };

        _jsonMessage = _jsonHandler.Serialize(message).ToArray();
        _binaryMessage = _binaryHandler.Serialize(message).ToArray();
    }

    [Benchmark]
    public IMessage? JsonParse() => _jsonHandler.Parse(_jsonMessage);

    [Benchmark]
    public IMessage? BinaryParse() => _binaryHandler.Parse(_binaryMessage);

    [Benchmark]
    public ReadOnlyMemory<byte> JsonSerialize()
    {
        var message = new DeltaMessage
        {
            Id = "msg-1",
            Timestamp = 1234567890,
            DocumentId = "doc-1",
            VectorClock = new() { ["client-1"] = 1 }
        };
        return _jsonHandler.Serialize(message);
    }

    [Benchmark]
    public ReadOnlyMemory<byte> BinarySerialize()
    {
        var message = new DeltaMessage
        {
            Id = "msg-1",
            Timestamp = 1234567890,
            DocumentId = "doc-1",
            VectorClock = new() { ["client-1"] = 1 }
        };
        return _binaryHandler.Serialize(message);
    }

    [Benchmark]
    public VectorClock VectorClockMerge()
    {
        var clock1 = new VectorClock(new() { ["a"] = 1, ["b"] = 3 });
        var clock2 = new VectorClock(new() { ["a"] = 2, ["c"] = 1 });
        return clock1.Merge(clock2);
    }
}
```

#### Benchmark Report

```markdown
| Method | Mean | Allocated |
|--------|------|-----------|
| JsonParse | 2.5 μs | 1.2 KB |
| BinaryParse | 1.8 μs | 0.9 KB |
| JsonSerialize | 1.5 μs | 0.8 KB |
| BinarySerialize | 0.8 μs | 0.4 KB |
| VectorClockMerge | 0.2 μs | 256 B |
```

#### Acceptance Criteria

- [ ] Benchmarks for all critical paths
- [ ] Memory allocation tracked
- [ ] Results documented
- [ ] Comparison with TypeScript
- [ ] Performance targets met

---

### V7-08: Create Test Report

**Priority:** P0  
**Estimate:** 2 hours  
**Dependencies:** V7-02 through V7-07

#### Description

Generate comprehensive test report documenting compatibility.

#### Report Template

```markdown
# SyncKit .NET Server Compatibility Report

## Summary

| Test Category | Pass | Fail | Skip | Total |
|--------------|------|------|------|-------|
| Binary Protocol | 7 | 0 | 0 | 7 |
| Integration | 244 | 0 | 0 | 244 |
| Load | 73 | 0 | 0 | 73 |
| Chaos | 86 | 0 | 0 | 86 |
| **Total** | **410** | **0** | **0** | **410** |

## Performance Comparison

| Metric | TypeScript | .NET | Difference |
|--------|-----------|------|------------|
| p50 Latency | 8ms | 6ms | -25% |
| p99 Latency | 45ms | 35ms | -22% |
| Throughput | 8000 msg/s | 12000 msg/s | +50% |
| Memory (1k conn) | 400MB | 280MB | -30% |

## Protocol Compatibility

- ✅ JSON protocol: Fully compatible
- ✅ Binary protocol: Fully compatible
- ✅ Auto-detection: Working correctly
- ✅ All message types: Supported

## Known Differences

1. **Message ID generation**: .NET uses GUID instead of nanoid
   - Impact: None (IDs are opaque strings)
   
2. **Timestamp precision**: .NET uses milliseconds
   - Impact: None (matches spec)

## Test Artifacts

- Full test logs: `results/full-logs.txt`
- Performance data: `results/performance.json`
- Coverage report: `results/coverage/`

## Certification

This .NET server implementation passes all 410 compatibility tests
and meets all performance requirements for production use.

Date: YYYY-MM-DD
Version: 1.0.0
```

#### Acceptance Criteria

- [ ] Report includes all test categories
- [ ] Pass/fail counts accurate
- [ ] Performance comparison included
- [ ] Known differences documented
- [ ] Artifacts preserved

---

### V7-09: Prepare PR Description

**Priority:** P0  
**Estimate:** 2 hours  
**Dependencies:** V7-08

#### Description

Write comprehensive PR description for the .NET server implementation.

#### Tasks

1. Summarize implementation scope
2. Document breaking changes (none expected)
3. List all new files added
4. Reference test results and coverage
5. Include deployment instructions

#### PR Template

```markdown
## Summary

Adds ASP.NET Core 10 server implementation for SyncKit with full protocol compatibility.

## Changes

- **New:** `server/csharp/src/` - Complete .NET server implementation
- **New:** Docker support for .NET server
- **Docs:** .NET-specific documentation and guides

## Test Results

- ✅ All 410 integration tests pass
- ✅ Binary protocol compatibility verified
- ✅ Performance benchmarks meet targets
- ✅ >80% code coverage

## How to Test

```bash
cd server/csharp
docker compose up -d
cd ../../tests
SYNCKIT_SERVER_URL=ws://localhost:8080/ws bun test
```

## Checklist

- [ ] All tests pass
- [ ] Documentation updated
- [ ] No breaking changes
- [ ] Performance verified
- [ ] Security review passed
```

#### Acceptance Criteria

- [ ] PR description follows template
- [ ] All test results included
- [ ] Breaking changes documented
- [ ] Deployment instructions clear
- [ ] Linked to tracking issue

---

### V7-10: Code Review and Fixes

**Priority:** P0  
**Estimate:** 8 hours  
**Dependencies:** V7-09

#### Description

Address feedback from code review and make necessary fixes.

#### Tasks

1. Submit PR for review
2. Address reviewer comments
3. Fix any identified issues
4. Update documentation as needed
5. Get final approval

#### Expected Review Focus Areas

| Area | Reviewer Concerns |
|------|-------------------|
| Security | JWT handling, input validation |
| Performance | Memory usage, async patterns |
| Protocol | Binary/JSON compatibility |
| Testing | Coverage gaps, edge cases |
| Documentation | Completeness, accuracy |

#### Response Time Targets

| Review Round | Target Response |
|--------------|-----------------|
| Initial review | 24 hours |
| Follow-up comments | 12 hours |
| Final approval | 24 hours |

#### Acceptance Criteria

- [ ] All review comments addressed
- [ ] No blocking issues remaining
- [ ] Maintainer approval received
- [ ] CI/CD pipeline green
- [ ] Ready to merge

---

### V7-11: Connection Rate Limiting (Optional)

**Priority:** P2  
**Estimate:** 3 hours  
**Dependencies:** V7-03

#### Description

Add per-connection message rate limiting to protect against misbehaving clients. This is an **enhancement beyond the TypeScript reference** implementation.

> **Note:** The TypeScript server does not implement per-connection rate limiting. This is a .NET-specific security enhancement.

#### Implementation

```csharp
// SyncKit.Server/WebSocket/ConnectionRateLimiter.cs
public class ConnectionRateLimiter
{
    private readonly int _maxMessagesPerSecond;
    private readonly ILogger<ConnectionRateLimiter> _logger;
    
    private int _messageCount;
    private DateTime _windowStart;
    private readonly object _lock = new();

    public ConnectionRateLimiter(int maxMessagesPerSecond, ILogger<ConnectionRateLimiter> logger)
    {
        _maxMessagesPerSecond = maxMessagesPerSecond;
        _logger = logger;
        _windowStart = DateTime.UtcNow;
    }

    public bool TryAcquire(string connectionId)
    {
        lock (_lock)
        {
            var now = DateTime.UtcNow;
            if ((now - _windowStart).TotalSeconds >= 1)
            {
                // Reset window
                _windowStart = now;
                _messageCount = 0;
            }
            
            if (++_messageCount > _maxMessagesPerSecond)
            {
                _logger.LogWarning(
                    "Rate limit exceeded for connection {ConnectionId}: {Count}/{Max} messages/sec",
                    connectionId, _messageCount, _maxMessagesPerSecond);
                return false;
            }
            
            return true;
        }
    }
}

// Integration in Connection.ProcessMessagesAsync():
if (!_rateLimiter.TryAcquire(Id))
{
    SendError("Rate limit exceeded. Please slow down.");
    continue;
}
```

#### Configuration

```json
{
  "SyncKit": {
    "RateLimiting": {
      "Enabled": true,
      "MaxMessagesPerSecond": 100
    }
  }
}
```

#### Acceptance Criteria

- [ ] Configurable rate limit per connection
- [ ] Graceful rejection with error message
- [ ] Rate limit logged for monitoring
- [ ] Can be disabled via configuration

---

### V7-12: High-Performance Logging (Optional)

**Priority:** P2  
**Estimate:** 1 hour  
**Dependencies:** V7-07

#### Description

Add `LoggerMessage.Define` source-generated logging for hot paths to reduce allocation overhead. This follows [Microsoft's high-performance logging guidance](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/logging/loggermessage).

> **Note:** This is an optimization for high-throughput scenarios. Standard Serilog logging is sufficient for most deployments.

#### Implementation

```csharp
// SyncKit.Server/Logging/LogMessages.cs
public static partial class LogMessages
{
    [LoggerMessage(
        EventId = 1001,
        Level = LogLevel.Debug,
        Message = "Delta received for document {DocumentId} from client {ClientId}")]
    public static partial void DeltaReceived(
        ILogger logger, string documentId, string clientId);

    [LoggerMessage(
        EventId = 1002,
        Level = LogLevel.Debug,
        Message = "Broadcasting to {SubscriberCount} subscribers for document {DocumentId}")]
    public static partial void BroadcastingDelta(
        ILogger logger, int subscriberCount, string documentId);

    [LoggerMessage(
        EventId = 1003,
        Level = LogLevel.Debug,
        Message = "Message sent to connection {ConnectionId}: {MessageType}")]
    public static partial void MessageSent(
        ILogger logger, string connectionId, string messageType);

    [LoggerMessage(
        EventId = 2001,
        Level = LogLevel.Warning,
        Message = "Connection {ConnectionId} authentication timeout")]
    public static partial void AuthTimeout(
        ILogger logger, string connectionId);
}

// Usage in hot path:
LogMessages.DeltaReceived(_logger, documentId, clientId);
```

#### Acceptance Criteria

- [ ] Hot path logging uses `LoggerMessage.Define`
- [ ] Zero-allocation logging verified in benchmarks
- [ ] Event IDs documented for log analysis

---

## Phase 7 Summary

| ID | Title | Priority | Est (h) | Status |
|----|-------|----------|---------|--------|
| V7-01 | Set up test environment | P0 | 4 | ⬜ |
| V7-02 | Run binary protocol tests | P0 | 3 | ⬜ |
| V7-03 | Run integration tests | P0 | 8 | ⬜ |
| V7-04 | Run load tests | P0 | 4 | ⬜ |
| V7-05 | Run chaos tests | P0 | 4 | ⬜ |
| V7-06 | Create SDK compatibility tests | P0 | 4 | ⬜ |
| V7-07 | Create performance benchmarks | P1 | 4 | ⬜ |
| V7-08 | Create test report | P0 | 2 | ⬜ |
| V7-09 | Prepare PR description | P0 | 2 | ⬜ |
| V7-10 | Code review and fixes | P0 | 8 | ⬜ |
| V7-11 | Connection rate limiting (optional) | P2 | 3 | ⬜ |
| V7-12 | High-performance logging (optional) | P2 | 1 | ⬜ |
| **Total** | | | **47** | |

**Legend:** ⬜ Not Started | 🔄 In Progress | ✅ Complete

---

## Phase 7 Validation

After completing Phase 7:

### Using Aspire Orchestration (Recommended)

1. **Start Test Environment**
   ```bash
   # Start C# backend with full infrastructure
   cd orchestration/aspire
   dotnet run --project SyncKit.AppHost --launch-profile "C# Backend + PostgreSQL"
   
   # Aspire Dashboard available at https://localhost:17235
   # Monitor all services, logs, and traces in one place
   ```

2. **Run All Tests**
   ```bash
   # In another terminal
   cd tests
   SYNCKIT_SERVER_URL=ws://localhost:5000/ws bun test
   
   # Expected output:
   # ✓ 410 tests passed
   # 0 failed
   # 0 skipped
   ```

3. **Cross-Backend Compatibility Test**
   ```bash
   # Start both backends against same PostgreSQL/Redis
   cd orchestration/aspire
   dotnet run --project SyncKit.AppHost --launch-profile "Full Stack (Both Backends + PostgreSQL)"
   
   # Run tests against TypeScript backend
   cd tests
   SYNCKIT_SERVER_URL=ws://localhost:3000/ws bun test
   
   # Run tests against C# backend
   SYNCKIT_SERVER_URL=ws://localhost:5000/ws bun test
   
   # Both should pass with identical results
   ```

### Validation Checklist

1. **All Tests Pass**
   - ✓ 410 tests pass against C# backend
   - ✓ Same tests pass against TypeScript backend
   - ✓ Cross-backend data sharing works via shared PostgreSQL/Redis

2. **Performance Targets Met**
   - p99 latency <100ms ✓
   - Throughput >5000 msg/s ✓
   - Memory <500MB @ 1000 connections ✓

3. **SDK Works**
   - Binary protocol fully functional ✓
   - All SDK features work ✓

4. **Documentation Complete**
   - Test report generated ✓
   - Performance comparison documented ✓
   - Aspire orchestration documented ✓

---

## Exit Criteria

The .NET server implementation is considered **complete** when:

1. ✅ All 410 tests pass
2. ✅ Performance meets or exceeds TypeScript server
3. ✅ SDK works without modification
4. ✅ Documentation complete
5. ✅ Docker images published
6. ✅ CI/CD pipeline green

## Next Steps After Phase 7

1. **Release preparation**
   - Version tagging
   - Changelog update
   - NuGet package (if applicable)

2. **Documentation**
   - Update main README
   - Add .NET-specific guides
   - API documentation

3. **Monitoring**
   - Prometheus metrics
   - Grafana dashboards
   - Alert rules
