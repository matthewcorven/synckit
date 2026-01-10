# Remaining Load Test Failures - Investigation Instructions

**Purpose:** Investigate and fix the 2 remaining load test failures  
**Goal:** Achieve 100% pass rate on individual load test runs  
**Created:** January 6, 2026

---

## Current Status

After implementing connection throttling fixes, the .NET server now passes **95% of load tests** when run individually on a fresh server:

| Test File | Pass | Total | Status |
|-----------|------|-------|--------|
| large-documents.test.ts | 10 | 11 | 1 failure |
| high-frequency.test.ts | 11 | 12 | 1 failure |
| profiling.test.ts | 8 | 8 | ✅ |
| burst-traffic.test.ts | 12 | 12 | ✅ |

---

## Failure #1: Large Field Values Not Syncing

### Test Details
- **File:** `tests/load/large-documents.test.ts`
- **Test Name:** `should handle large field values`
- **Line:** ~207

### Error
```
expect(state.large1).toBe(largeValue1);
                     ^
Expected: "xxxx..." (10KB string)
Received: undefined
```

### What the Test Does
```typescript
// Creates two 10KB string values
const largeValue1 = 'x'.repeat(10000);
const largeValue2 = 'y'.repeat(10000);

// Client 1 sets large values
await clients[0].setField(docId, 'large1', largeValue1);
await clients[0].setField(docId, 'large2', largeValue2);

// Wait for sync
await sleep(5000);

// Client 2 should receive the large values
const state = await clients[1].getDocumentState(docId);
expect(state.large1).toBe(largeValue1);  // FAILS - state.large1 is undefined
```

### Investigation Steps

#### Step 1: Verify the Test Isolation
```bash
cd /Users/core/git/matthewcorven/synckit/tests
TEST_SERVER_TYPE=external TEST_SERVER_PORT=8090 bun test load/large-documents.test.ts -t "large field values"
```

#### Step 2: Check Binary Protocol Encoding
The .NET server uses MessagePack for binary protocol. Large strings may hit encoding limits.

**Files to investigate:**
- `server/csharp/src/SyncKit.Server/Protocol/Binary/BinaryProtocolHandler.cs`
- `server/csharp/src/SyncKit.Server/Protocol/Binary/MessagePackSerializer.cs`

**Key questions:**
1. Is MessagePack configured with sufficient max string length?
2. Are large strings being truncated during serialization?
3. Is WebSocket message fragmentation handling correct?

#### Step 3: Check WebSocket Message Size Limits
**File:** `server/csharp/src/SyncKit.Server/WebSockets/WebSocketConnection.cs`

Look for:
- `ReceiveBufferSize` configuration
- `MaxMessageSize` limits
- Message fragmentation handling

#### Step 4: Add Diagnostic Logging
Add temporary logging to trace the value through the system:

```csharp
// In DeltaMessageHandler.cs
_logger.LogDebug("Received delta for field {Field} with value length {Length}", 
    delta.Key, 
    delta.Value?.ToString()?.Length ?? 0);
```

#### Step 5: Compare with TypeScript Server
```bash
# Run same test against TypeScript server
cd tests
TEST_SERVER_TYPE=external TEST_SERVER_PORT=8080 bun test load/large-documents.test.ts -t "large field values"
```

If TypeScript passes, the issue is .NET-specific.

### Likely Root Causes

1. **MessagePack string length limit** - Default may be 64KB but chunking could be an issue
2. **WebSocket receive buffer too small** - May need to increase `ReceiveBufferSize`
3. **JSON fallback path** - If binary fails, JSON fallback may have issues with large strings
4. **Delta serialization** - The delta payload may not be handling large strings correctly

### Fix Template

If the issue is buffer size:
```csharp
// In Program.cs or WebSocket configuration
webSocket.Options.ReceiveBufferSize = 1024 * 1024; // 1MB buffer
```

If the issue is MessagePack:
```csharp
// In MessagePack configuration
var options = MessagePackSerializerOptions.Standard
    .WithSecurity(MessagePackSecurity.UntrustedData)
    .WithOmitAssemblyVersion(true);
```

---

## Failure #2: LWW Conflict Resolution Not Converging

### Test Details
- **File:** `tests/load/high-frequency.test.ts`
- **Test Name:** `should handle high-frequency with conflicts`
- **Line:** ~469

### Error
```
expect(states[0]).toEqual(states[1]);
                          ^
Expected: { "conflict0": "0-80", "conflict14": "2-94", ... }
Received: { "conflict0": "0-80", "conflict14": "1-94", ... }

- "conflict14": "2-94",
+ "conflict14": "1-94",
- "conflict8": "1-88",
- "conflict9": "1-89",
+ "conflict8": "0-88",
+ "conflict9": "2-89",
```

### What the Test Does
```typescript
// 3 clients concurrently update the same 20 fields
const clients = await createClients(3);
const docId = `conflict-test-${Date.now()}`;

// All clients subscribe
await Promise.all(clients.map(c => c.subscribe(docId)));

// High-frequency conflicting updates
for (let round = 0; round < 100; round++) {
  for (let field = 0; field < 20; field++) {
    const clientIdx = round % 3;
    await clients[clientIdx].setField(docId, `conflict${field}`, `${clientIdx}-${round}`);
  }
}

// Wait for sync
await sleep(3000);

// All clients should converge to same state via LWW
const states = await Promise.all(clients.map(c => c.getDocumentState(docId)));
expect(states[0]).toEqual(states[1]);  // FAILS - states differ
expect(states[1]).toEqual(states[2]);
```

### Investigation Steps

#### Step 1: Verify the Test Isolation
```bash
cd /Users/core/git/matthewcorven/synckit/tests
TEST_SERVER_TYPE=external TEST_SERVER_PORT=8090 bun test load/high-frequency.test.ts -t "conflicts"
```

#### Step 2: Check Vector Clock Implementation
**Files to investigate:**
- `server/csharp/src/SyncKit.Server/Sync/VectorClock.cs`
- `server/csharp/src/SyncKit.Server/Sync/LwwRegister.cs`
- `server/csharp/src/SyncKit.Server/Sync/SyncCoordinator.cs`

**Key questions:**
1. Is the vector clock comparison correct? (happens-before relationship)
2. Is the LWW timestamp resolution fine enough? (microseconds vs milliseconds)
3. Is there a race condition in applying concurrent updates?

#### Step 3: Check Broadcast Order
The server receives updates and broadcasts them. If broadcasts arrive out-of-order, clients may not converge.

**File:** `server/csharp/src/SyncKit.Server/WebSockets/ConnectionManager.cs`

Look for:
- `BroadcastToSubscribers` - Is ordering preserved?
- Are there any async fire-and-forget broadcasts?

#### Step 4: Add Diagnostic Logging
```csharp
// In SyncCoordinator.cs
_logger.LogDebug("LWW merge for {Field}: local={LocalTs}, remote={RemoteTs}, winner={Winner}",
    field, localTimestamp, remoteTimestamp, winner);
```

#### Step 5: Increase Sync Wait Time
The test waits 3 seconds. Try increasing:

```typescript
// In the test, temporarily change:
await sleep(3000);  // Original
await sleep(10000); // Try 10 seconds
```

If this passes, the issue is propagation delay, not logic.

#### Step 6: Compare with TypeScript Server
```bash
cd tests
TEST_SERVER_TYPE=external TEST_SERVER_PORT=8080 bun test load/high-frequency.test.ts -t "conflicts"
```

### Likely Root Causes

1. **Timestamp resolution too coarse** - If multiple updates happen in same millisecond, LWW can't distinguish
2. **Client ID tiebreaker missing** - When timestamps tie, need consistent tiebreaker (e.g., higher client ID wins)
3. **Async broadcast race** - Updates broadcast out-of-order
4. **Missing sync request** - Clients may need to request full state sync after high-frequency updates
5. **Vector clock merge bug** - Incorrect merge of concurrent updates

### Fix Template

If timestamp resolution is the issue:
```csharp
// Use high-resolution timestamp
public long GetTimestamp()
{
    return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() * 1000 
         + (Stopwatch.GetTimestamp() % 1000); // Add microsecond component
}
```

If tiebreaker is missing:
```csharp
// In LWW comparison
if (localTimestamp == remoteTimestamp)
{
    // Consistent tiebreaker: higher client ID wins
    return string.Compare(localClientId, remoteClientId) > 0 
        ? local 
        : remote;
}
```

---

## Testing Commands Reference

```bash
# Kill any running server
pkill -f "dotnet.*SyncKit"

# Start fresh server
cd /Users/core/git/matthewcorven/synckit/server/csharp/src/SyncKit.Server
SYNCKIT_SERVER_URL=http://localhost:8090 \
SYNCKIT_AUTH_REQUIRED=false \
JWT_SECRET='test-secret-key-for-integration-tests-only-32-chars' \
dotnet run --configuration Release

# Run specific failing test (in separate terminal)
cd /Users/core/git/matthewcorven/synckit/tests

# Failure #1: Large field values
TEST_SERVER_TYPE=external TEST_SERVER_PORT=8090 bun test load/large-documents.test.ts -t "large field values"

# Failure #2: Conflict resolution
TEST_SERVER_TYPE=external TEST_SERVER_PORT=8090 bun test load/high-frequency.test.ts -t "conflicts"

# Run against TypeScript server for comparison (port 8080)
cd /Users/core/git/matthewcorven/synckit/server/typescript
bun run dev &
cd /Users/core/git/matthewcorven/synckit/tests
TEST_SERVER_TYPE=external TEST_SERVER_PORT=8080 bun test load/large-documents.test.ts -t "large field values"

# Health check
curl -s http://localhost:8090/health | jq '.'
```

---

## Success Criteria

### Failure #1: Large Field Values
- [ ] Test passes with 10KB string values
- [ ] Test passes with values up to 100KB (stretch goal)
- [ ] No regressions in other large-documents tests

### Failure #2: Conflict Resolution
- [ ] All 3 clients converge to identical state
- [ ] Convergence happens within 5 seconds
- [ ] No regressions in other high-frequency tests

---

## Deliverables

After fixing each issue:

1. **Code changes** with clear comments explaining the fix
2. **Test verification** showing the test now passes
3. **Regression check** confirming other tests still pass:
   ```bash
   TEST_SERVER_TYPE=external TEST_SERVER_PORT=8090 bun test load/
   ```
4. **Update PHASE-ASSESSMENT-MATRIX.md** with final results
