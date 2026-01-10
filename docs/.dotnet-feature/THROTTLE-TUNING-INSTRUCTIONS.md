# .NET Server Throttle Tuning Instructions

**Purpose:** Systematically relax connection throttling limits to find optimal values  
**Goal:** Remove or minimize throttling restrictions while maintaining server stability  
**Created:** January 6, 2026

---

## Background

The .NET server currently has two semaphore-based throttling mechanisms that were added to prevent crashes under burst connection load:

1. **WebSocket Accept Semaphore** (`SyncWebSocketMiddleware.cs`): Limits concurrent `AcceptWebSocketAsync()` operations
2. **Connection Creation Semaphore** (`ConnectionManager.cs`): Limits concurrent connection object creation

These were set conservatively at 20 and 10 respectively. The goal is to relax these limits as much as possible while maintaining stability.

---

## Files to Modify

### 1. Configuration Class
**File:** `server/csharp/src/SyncKit.Server/Configuration/SyncKitConfig.cs`

Add these new configuration properties:
```csharp
/// <summary>
/// Maximum concurrent WebSocket accept operations.
/// Set to 0 for unlimited (no throttling).
/// Default: 100
/// </summary>
public int WsAcceptConcurrency { get; set; } = 100;

/// <summary>
/// Maximum concurrent connection creation operations.
/// Set to 0 for unlimited (no throttling).
/// Default: 50
/// </summary>
public int WsConnectionCreationConcurrency { get; set; } = 50;
```

### 2. WebSocket Middleware
**File:** `server/csharp/src/SyncKit.Server/WebSockets/SyncWebSocketMiddleware.cs`

Current code (lines 24-30):
```csharp
private static readonly SemaphoreSlim _acceptSemaphore = new(20, 20);
```

Change to use injected configuration:
- Make the semaphore non-static and initialized from config
- If config value is 0, skip semaphore entirely (no throttling)
- Inject `IOptions<SyncKitConfig>` in constructor

### 3. Connection Manager
**File:** `server/csharp/src/SyncKit.Server/WebSockets/ConnectionManager.cs`

Current code (lines 26-31):
```csharp
private readonly SemaphoreSlim _connectionSemaphore = new(10, 10);
```

Change to use config value, same pattern as middleware.

---

## Testing Procedure

### Prerequisites
```bash
# Terminal 1: Start test dependencies (if needed)
cd server/csharp/src
docker compose -f docker-compose.test.yml up -d postgres redis

# Terminal 2: Will be used for running the server
# Terminal 3: Will be used for running tests
```

### Test Command
```bash
cd /Users/core/git/matthewcorven/synckit/tests
TEST_SERVER_TYPE=external TEST_SERVER_PORT=8090 bun test load/ --timeout 120000
```

### Success Criteria
- Server does NOT crash (check health endpoint after tests)
- Load tests pass rate should be ≥72% (current baseline: 44/61)

### Health Check
```bash
curl -s http://localhost:8090/health
```

---

## Tuning Steps

### Phase 1: Make Configuration Work

1. Add config properties to `SyncKitConfig.cs`
2. Update `SyncWebSocketMiddleware.cs` to read from config
3. Update `ConnectionManager.cs` to read from config
4. Add environment variable support: `WS_ACCEPT_CONCURRENCY`, `WS_CONNECTION_CREATION_CONCURRENCY`
5. Verify server starts with default values
6. Run full load test suite - should match baseline (44/61 pass)

### Phase 2: Systematic Relaxation

Test each configuration in order. For each test:
1. Kill any existing server: `pkill -f "dotnet.*SyncKit"`
2. Start server with new config values
3. Wait for server ready (health check)
4. Run full load test suite
5. Check server health after tests
6. Record results in the table below

**Configuration Matrix to Test:**

| Test # | Accept | Creation | Expected | Actual | Server Stable? | Notes |
|--------|--------|----------|----------|--------|----------------|-------|
| 1 | 20 | 10 | Baseline | | | Current values |
| 2 | 50 | 25 | | | | |
| 3 | 100 | 50 | | | | |
| 4 | 200 | 100 | | | | |
| 5 | 500 | 250 | | | | |
| 6 | 1000 | 500 | | | | |
| 7 | 0 (unlimited) | 500 | | | | Test accept only |
| 8 | 500 | 0 (unlimited) | | | | Test creation only |
| 9 | 0 (unlimited) | 0 (unlimited) | | | | Full unrestricted |

### Server Start Command Template
```bash
cd /Users/core/git/matthewcorven/synckit/server/csharp/src/SyncKit.Server
WS_ACCEPT_CONCURRENCY={VALUE} \
WS_CONNECTION_CREATION_CONCURRENCY={VALUE} \
SYNCKIT_SERVER_URL=http://localhost:8090 \
SYNCKIT_AUTH_REQUIRED=false \
JWT_SECRET='test-secret-key-for-integration-tests-only-32-chars' \
dotnet run --configuration Release
```

---

## If Crashes Occur

If the server crashes at any configuration level:

1. **Record the exact configuration** that caused the crash
2. **Capture the crash log**: `cat /tmp/synckit-server.log | tail -100`
3. **Identify the error type**:
   - `SocketAddress` error → Socket accept race condition
   - `OutOfMemory` → Resource exhaustion
   - `ObjectDisposed` → Connection cleanup race
   - Other → Document the full stack trace

4. **Step back** to the last stable configuration
5. **Try intermediate values** between stable and unstable

---

## Alternative Strategies (If Throttling Required)

If we cannot fully remove throttling, consider:

### 1. Platform-Specific Configuration
```csharp
// Only throttle on macOS
if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
{
    // Apply throttling
}
```

### 2. Adaptive Throttling
- Start with no limits
- Monitor for errors
- Dynamically reduce concurrency when issues detected

### 3. Connection Pooling
- Pre-accept a pool of WebSocket connections
- Serve from pool to avoid burst accept

### 4. Kestrel Transport Options
- Try different socket configurations
- Experiment with `ListenOptions` settings

---

## Final Deliverables

After completing all tests, provide:

1. **Updated configuration values** in code (set to highest stable values)
2. **Test results table** filled in completely
3. **Recommendation** - one of:
   - "Throttling can be removed entirely" (with evidence)
   - "Throttling required at X/Y values" (with crash evidence)
   - "Platform-specific throttling recommended" (with platform test results)
4. **Updated PHASE-ASSESSMENT-MATRIX.md** with final disposition

---

## Reference: Current Implementation

### SyncWebSocketMiddleware.cs (current)
```csharp
/// <summary>
/// Semaphore to throttle concurrent WebSocket accept operations.
/// This helps prevent socket accept race conditions under burst traffic on macOS.
/// See: dotnet/runtime#47020 - SocketAddress validation errors during high burst accepts
/// Reduced to 20 concurrent accepts to stay well below the ~180 connection threshold
/// where the race condition typically manifests.
/// </summary>
private static readonly SemaphoreSlim _acceptSemaphore = new(20, 20);
```

### ConnectionManager.cs (current)
```csharp
/// <summary>
/// Semaphore to throttle concurrent connection creation.
/// This helps prevent socket accept race conditions under burst traffic on macOS.
/// See: dotnet/runtime#47020
/// Reduced to 10 to spread out connection creation and avoid socket race.
/// </summary>
private readonly SemaphoreSlim _connectionSemaphore = new(10, 10);
```

---

## Quick Reference Commands

```bash
# Kill server
pkill -f "dotnet.*SyncKit"

# Build
cd /Users/core/git/matthewcorven/synckit/server/csharp/src/SyncKit.Server
dotnet build --configuration Release

# Start server (with unlimited throttling)
WS_ACCEPT_CONCURRENCY=0 \
WS_CONNECTION_CREATION_CONCURRENCY=0 \
SYNCKIT_SERVER_URL=http://localhost:8090 \
SYNCKIT_AUTH_REQUIRED=false \
JWT_SECRET='test-secret-key-for-integration-tests-only-32-chars' \
dotnet run --configuration Release

# Run load tests
cd /Users/core/git/matthewcorven/synckit/tests
TEST_SERVER_TYPE=external TEST_SERVER_PORT=8090 bun test load/ --timeout 120000

# Check server health
curl -s http://localhost:8090/health

# View server logs (if using nohup)
tail -f /tmp/synckit-server.log
```
