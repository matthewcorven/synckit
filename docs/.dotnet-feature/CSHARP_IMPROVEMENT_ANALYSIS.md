# C# Server Improvement Analysis

> **Purpose:** Analysis comparing the C# server implementation to the TypeScript reference server, identifying improvement opportunities for performance, architecture, and maintainability.

**Date:** January 18, 2026  
**Analysis by:** GitHub Copilot

---

## Executive Summary

The C# server implementation is functionally complete and passes all integration tests. However, the performance benchmarks show significant gaps compared to the TypeScript server:

| Metric | TypeScript | C# | Gap |
|--------|------------|-----|-----|
| P95 Latency | 51ms | 1,655ms | **32x slower** |
| Aggregate Ops/Sec | 2,000 | 1,032 | **48% lower** |
| Memory Growth | 3.95 MB/min | 0.07 MB/min | ✅ Better |

This document identifies **15 improvement opportunities** ranked by impact.

---

## Table of Contents

1. [Critical Improvements](#1-critical-improvements)
2. [High-Impact Improvements](#2-high-impact-improvements)
3. [Medium-Impact Improvements](#3-medium-impact-improvements)
4. [Low-Impact / Polish Items](#4-low-impact--polish-items)
5. [Architecture Differences Summary](#5-architecture-differences-summary)
6. [Implementation Recommendations](#6-implementation-recommendations)

---

## 1. Critical Improvements

### 1.1 ❌ Missing Delta Batching (P95 Latency Root Cause)

**TypeScript Implementation:**
```typescript
// server/typescript/src/websocket/server.ts
private pendingBatches: Map<string, { delta: Record<string, any>, timer: NodeJS.Timeout }> = new Map();
private readonly BATCH_INTERVAL = 50; // 50ms batching window

private addToBatch(documentId: string, delta: Record<string, any>) {
  let batch = this.pendingBatches.get(documentId);
  if (!batch) {
    batch = {
      delta: {},
      timer: setTimeout(() => this.flushBatch(documentId), this.BATCH_INTERVAL),
    };
    this.pendingBatches.set(documentId, batch);
  }
  Object.assign(batch.delta, delta);
}

private flushBatch(documentId: string) {
  // Coalesces rapid updates, broadcasts once per 50ms
}
```

**C# Implementation:** NOT IMPLEMENTED - Every delta triggers immediate broadcast.

**Impact:**
- Under load, the C# server sends N broadcasts for N rapid deltas
- TypeScript sends 1 broadcast per 50ms window regardless of delta count
- This explains the **32x P95 latency difference**

**Recommendation:**
```csharp
// Add to DeltaMessageHandler or create DeltaBatchingService
private readonly ConcurrentDictionary<string, DeltaBatch> _pendingBatches = new();
private readonly TimeSpan _batchInterval = TimeSpan.FromMilliseconds(50);

private class DeltaBatch {
    public Dictionary<string, object?> Delta { get; } = new();
    public Timer Timer { get; set; }
}

public void AddToBatch(string documentId, Dictionary<string, object?> delta) {
    var batch = _pendingBatches.GetOrAdd(documentId, _ => new DeltaBatch {
        Timer = new Timer(_ => FlushBatch(documentId), null, _batchInterval, Timeout.InfiniteTimeSpan)
    });
    
    lock (batch.Delta) {
        foreach (var (key, value) in delta)
            batch.Delta[key] = value; // Later writes override
    }
}
```

**Estimated Impact:** 5-10x latency improvement under load

---

### 1.2 ⚠️ Inefficient LWW Resolution (BuildState)

**TypeScript Implementation:**
```typescript
// LWW is applied at write-time in setField()
setField(path: string, valueJson: string, clock: bigint, clientId: string): any {
  const existing = this.fields.get(path);
  if (existing) {
    // LWW comparison happens once, at write time
    if (timestampWins || (timestampTie && clockWins) || ...) {
      this.fields.set(path, { value, clock, clientId, timestamp });
      return value;
    }
    return existing.value;
  }
}

// getField() is O(1) - just a Map lookup
getField(path: string): string | null {
  const field = this.fields.get(path);
  return field ? JSON.stringify(field.value) : null;
}
```

**C# Implementation:**
```csharp
// server/csharp/src/SyncKit.Server/Sync/Document.cs
public Dictionary<string, object?> BuildState() {
    foreach (var delta in _deltas)  // O(n) - iterates ALL deltas
    {
        foreach (var property in delta.Data.EnumerateObject())
        {
            // LWW comparison for each field, every time
        }
    }
    return state;
}
```

**Impact:**
- TypeScript: O(1) state read (pre-computed)
- C#: O(n) state read where n = total delta count
- Every `GetDocumentStateAsync()` call recomputes from scratch
- Under load with many deltas, this becomes a major bottleneck

**Recommendation:** Cache resolved state with invalidation:
```csharp
public class Document {
    private Dictionary<string, object?>? _cachedState;
    private bool _stateInvalidated = true;
    
    public void AddDelta(StoredDelta delta) {
        _stateLock.EnterWriteLock();
        try {
            _deltas.Add(delta);
            _stateInvalidated = true; // Invalidate cache
            // ...
        }
    }
    
    public Dictionary<string, object?> BuildState() {
        _stateLock.EnterReadLock();
        try {
            if (!_stateInvalidated && _cachedState != null)
                return _cachedState;
            
            // Compute state...
            _cachedState = state;
            _stateInvalidated = false;
            return state;
        }
    }
}
```

Alternatively, apply LWW at write-time (matching TypeScript):
```csharp
private ConcurrentDictionary<string, FieldEntry> _resolvedFields = new();

public void ApplyDelta(StoredDelta delta) {
    foreach (var property in delta.Data.EnumerateObject()) {
        var fieldName = property.Name;
        _resolvedFields.AddOrUpdate(fieldName, 
            // Add new
            _ => new FieldEntry(property.Value, delta.Timestamp, delta.VectorClock.Get(delta.ClientId), delta.ClientId),
            // Update with LWW
            (_, existing) => LwwWinner(existing, property.Value, delta));
    }
}
```

**Estimated Impact:** 2-5x throughput improvement for state reads

---

## 2. High-Impact Improvements

### 2.1 ⚠️ JSON Serialization Allocations

**TypeScript Implementation:**
```typescript
// V8 JIT optimizes JSON.parse/stringify for hot paths
const payload = JSON.parse(payloadJson);
const data = JSON.stringify(message);
```

**C# Implementation:**
```csharp
// System.Text.Json allocates on every call
var json = JsonSerializer.Serialize(message, message.GetType(), JsonOptions);
var payloadByteCount = Encoding.UTF8.GetByteCount(json);
var rentedBuffer = ArrayPool<byte>.Shared.Rent(totalSize);
// ... copy, return buffer
var result = span.ToArray(); // Additional allocation!
ArrayPool<byte>.Shared.Return(rentedBuffer);
```

**Issues:**
1. `JsonSerializer.Serialize()` creates intermediate string
2. `Encoding.UTF8.GetByteCount()` + `GetBytes()` is two-pass
3. `span.ToArray()` allocates again instead of returning rented buffer

**Recommendation:** Use source-generated serializers and pooled buffers:
```csharp
// Use source generators for zero-reflection serialization
[JsonSourceGenerationOptions(WriteIndented = false)]
[JsonSerializable(typeof(DeltaMessage))]
[JsonSerializable(typeof(AckMessage))]
// ... all message types
public partial class SyncKitJsonContext : JsonSerializerContext { }

// Serialize directly to pooled buffer
public ReadOnlyMemory<byte> Serialize(IMessage message) {
    using var buffer = new PooledByteBufferWriter(initialCapacity: 256);
    JsonSerializer.Serialize(buffer, message, SyncKitJsonContext.Default.GetTypeInfo(message.GetType()));
    return buffer.WrittenMemory; // Returns slice, no copy
}
```

**Estimated Impact:** 20-30% reduction in GC pressure

---

### 2.2 ⚠️ Broadcast Parallelization Overhead

**TypeScript Implementation:**
```typescript
// Sequential sends, but each send is non-blocking (enqueues to kernel buffer)
for (const connectionId of subscribers) {
  const connection = registry.get(connectionId);
  connection.send(fieldMessage); // Returns immediately
}
```

**C# Implementation:**
```csharp
// Parallel.ForEach has overhead for coordination
Parallel.ForEach(connections.Values, connection => {
    connection.Send(message); // Non-blocking (queues to channel)
});
```

**Issue:** `Parallel.ForEach` has thread pool scheduling overhead. Since `connection.Send()` is already non-blocking (queues to bounded channel), parallel dispatch adds synchronization cost without benefit.

**Recommendation:** Use sequential send or `Task.WhenAll` for truly async operations:
```csharp
// Option 1: Sequential (same as TypeScript)
foreach (var connection in connections.Values) {
    if (excludeConnectionId != null && connection.Id == excludeConnectionId)
        continue;
    connection.Send(message);
}

// Option 2: If Send becomes async in future
var sendTasks = connections.Values
    .Where(c => c.Id != excludeConnectionId)
    .Select(c => c.SendAsync(message));
await Task.WhenAll(sendTasks);
```

**Estimated Impact:** 5-10% latency reduction for broadcasts

---

### 2.3 ⚠️ ReaderWriterLockSlim Contention

**TypeScript Implementation:**
```typescript
// Single-threaded event loop - no locks needed
const existing = this.fields.get(path);
this.fields.set(path, { value, clock, clientId, timestamp });
```

**C# Implementation:**
```csharp
// ReaderWriterLockSlim has overhead even for uncontended access
_stateLock.EnterWriteLock();
try {
    _deltas.Add(delta);
    // ...
}
finally {
    _stateLock.ExitWriteLock();
}
```

**Issue:** Reader-writer locks have ~20-50ns overhead per acquire/release, and can cause thread contention under high concurrency.

**Recommendation:** Consider lock-free structures for hot paths:
```csharp
// Option 1: ConcurrentDictionary for resolved state (lock-free reads)
private ConcurrentDictionary<string, FieldEntry> _resolvedFields = new();

// Option 2: Immutable snapshots (copy-on-write)
private ImmutableDictionary<string, FieldEntry> _state = ImmutableDictionary<string, FieldEntry>.Empty;

public void ApplyDelta(StoredDelta delta) {
    var newState = _state;
    foreach (var property in delta.Data.EnumerateObject()) {
        newState = newState.SetItem(property.Name, /* LWW winner */);
    }
    Interlocked.Exchange(ref _state, newState);
}
```

**Estimated Impact:** 10-20% throughput improvement under contention

---

## 3. Medium-Impact Improvements

### 3.1 🔸 ACK Tracking Not Implemented

**TypeScript Implementation:**
```typescript
// Full ACK tracking with retries
private pendingAcks: Map<string, PendingAckInfo> = new Map();

private handleAck(connection: Connection, message: AckMessage) {
  const ackKey = `${connection.id}-${messageId}`;
  const pendingAck = this.pendingAcks.get(ackKey);
  if (pendingAck) {
    clearTimeout(pendingAck.timeout);
    this.pendingAcks.delete(ackKey);
  }
}
```

**C# Implementation:**
```csharp
// AckMessageHandler.cs - Currently a no-op
public Task HandleAsync(IConnection connection, IMessage message) {
    _logger.LogDebug("Received ACK from {ConnectionId}", connection.Id);
    return Task.CompletedTask;
}
```

**Impact:** No retry mechanism for lost messages. In unreliable networks, messages can be lost silently.

**Recommendation:** Implement pending ACK tracking:
```csharp
public class AckTracker {
    private readonly ConcurrentDictionary<string, PendingAck> _pending = new();
    private readonly TimeSpan _timeout = TimeSpan.FromSeconds(5);
    private readonly int _maxRetries = 3;
    
    public void TrackMessage(string connectionId, string messageId, IMessage message) {
        var key = $"{connectionId}-{messageId}";
        var pendingAck = new PendingAck(message, DateTime.UtcNow, _maxRetries);
        _pending[key] = pendingAck;
        
        // Schedule retry timer
        pendingAck.Timer = new Timer(_ => RetryOrTimeout(key), null, _timeout, Timeout.InfiniteTimeSpan);
    }
    
    public void AcknowledgeMessage(string connectionId, string messageId) {
        var key = $"{connectionId}-{messageId}";
        if (_pending.TryRemove(key, out var pending))
            pending.Timer?.Dispose();
    }
}
```

**Priority:** Medium (affects reliability, not raw performance)

---

### 3.2 🔸 Vector Clock Uses `long` Instead of `BigInt`

**TypeScript Implementation:**
```typescript
// Uses BigInt for arbitrary precision
clocks: new Map<string, bigint>(),
tick(clientId: string): bigint {
  const current = this.clocks.get(clientId) || 0n;
  const next = current + 1n;
  this.clocks.set(clientId, next);
  return next;
}
```

**C# Implementation:**
```csharp
// Uses long (Int64) - limited to 9.2 quintillion
private readonly Dictionary<string, long> _entries;
public long Get(string clientId) => _entries.GetValueOrDefault(clientId, 0);
```

**Impact:** Theoretical overflow after 9.2 quintillion operations per client. Not a practical concern, but inconsistent with TypeScript.

**Recommendation:** Consider `System.Numerics.BigInteger` for parity, or document the difference as acceptable.

---

### 3.3 🔸 Connection ID Format Difference

**TypeScript:**
```typescript
const connectionId = `conn-${++this.connectionCounter}`;
// Example: "conn-1", "conn-2", "conn-3"
```

**C#:**
```csharp
var connectionId = $"conn_{counter}_{timestamp}";
// Example: "conn_1_1737234567890", "conn_2_1737234567891"
```

**Impact:** Minor - IDs are longer in C# (more memory, longer log lines). Timestamp suffix is redundant since counter already ensures uniqueness.

**Recommendation:** Match TypeScript format for consistency:
```csharp
var connectionId = $"conn-{Interlocked.Increment(ref _connectionCounter)}";
```

---

### 3.4 🔸 Health Check Response Format Mismatch

**TypeScript:**
```typescript
return c.json({
  status: 'healthy',
  timestamp: new Date().toISOString(),
  version: '0.1.0',
  uptime: process.uptime(),
  connections: stats?.connections || {...},
  documents: stats?.documents || {...},
});
```

**C#:**
```csharp
return Results.Ok(new HealthResponse {
    Status = "healthy",
    Version = "1.0.0",  // Different version string
    Timestamp = DateTime.UtcNow.ToString("o"),
    Uptime = statsService.GetUptimeSeconds(),
    Stats = statsService.GetStats()
});
```

**Issues:**
- `Version` is hardcoded differently
- Stats structure differs (nested `Stats` vs inline `connections`/`documents`)

**Recommendation:** Align JSON structure for client compatibility.

---

## 4. Low-Impact / Polish Items

### 4.1 📝 Inconsistent Logging Levels

TypeScript uses `console.log/warn/error` consistently. C# mixes levels (`LogDebug`, `LogInformation`, `LogWarning`) somewhat inconsistently.

**Recommendation:** Create logging guidelines:
- `Trace`: Per-message details (parse/serialize)
- `Debug`: Connection lifecycle, subscription changes
- `Information`: Server startup, authentication
- `Warning`: Recoverable errors, connection limits
- `Error`: Unrecoverable errors, data corruption

### 4.2 📝 Missing Server Graceful Shutdown Timeout

**TypeScript:**
```typescript
const shutdown = async () => {
  await wsServer.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000); // Force exit after 10s
};
```

**C#:** Relies on ASP.NET Core default shutdown (no explicit timeout).

**Recommendation:** Add explicit shutdown timeout:
```csharp
builder.Services.Configure<HostOptions>(opts => {
    opts.ShutdownTimeout = TimeSpan.FromSeconds(10);
});
```

### 4.3 📝 Error Message Details Structure

**TypeScript:**
```typescript
connection.sendError('Permission denied', { documentId });
// Sends: { error: 'Permission denied', details: { documentId: 'doc123' } }
```

**C#:** Error details are inconsistent across handlers.

---

## 5. Architecture Differences Summary

| Aspect | TypeScript | C# | Notes |
|--------|------------|-----|-------|
| **Concurrency Model** | Single-threaded event loop | Multi-threaded async/await | TypeScript avoids locks entirely |
| **Delta Batching** | 50ms window | None | Critical gap |
| **LWW Resolution** | At write-time (O(1) read) | At read-time (O(n)) | Major performance diff |
| **State Storage** | `Map<field, entry>` | `List<StoredDelta>` | C# stores raw deltas |
| **JSON Handling** | V8 optimized | System.Text.Json + allocations | C# has more overhead |
| **Broadcast** | Sequential non-blocking | Parallel.ForEach | C# has synchronization overhead |
| **Locking** | None (event loop) | ReaderWriterLockSlim | C# has lock overhead |
| **ACK Tracking** | Full implementation | Stub (no-op) | C# missing feature |
| **Memory Management** | V8 GC | .NET GC + ArrayPool | Both capable |

---

## 6. Implementation Recommendations

### Priority Order

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| **P0** | Delta Batching | 2-3 days | 5-10x latency |
| **P0** | LWW State Caching | 2-3 days | 2-5x throughput |
| **P1** | JSON Source Generators | 1-2 days | 20-30% GC |
| **P1** | Sequential Broadcast | 0.5 days | 5-10% latency |
| **P2** | Lock-free State | 2-3 days | 10-20% throughput |
| **P2** | ACK Tracking | 2-3 days | Reliability |
| **P3** | Minor polish items | 1-2 days | Consistency |

### Quick Wins (< 1 hour each)

1. Change broadcast from `Parallel.ForEach` to `foreach`
2. Match connection ID format to TypeScript
3. Add explicit shutdown timeout
4. Align health check JSON structure

### Estimated Total Effort

- **P0 items:** 4-6 days
- **P1 items:** 1.5-2.5 days
- **P2 items:** 4-6 days
- **P3 items:** 1-2 days

**Total:** 10-16 days for comprehensive alignment

---

## Appendix: Performance Benchmark Details

From `SERVER_PERFORMANCE.md`:

```
| Metric | TypeScript | C# | Unit |
|--------|------------|-----|------|
| Max Concurrent Connections | 30,001 | 30,001 | connections |
| Max Ops/Sec (Single Client) | 1,000 | 1,000 | ops/sec |
| Max Ops/Sec (Aggregate) | 2,000 | 1,032 | ops/sec |
| P95 Latency | 51 | 1,655 | ms |
| Memory Growth | 3.95 | 0.07 | MB/min |
```

The **P95 latency** gap (32x) is the most critical metric. Delta batching alone should reduce this by 5-10x, and LWW caching should further improve throughput-related latency.

The **aggregate ops/sec** gap (48%) correlates with the lack of batching - C# processes each delta individually while TypeScript coalesces them.

The excellent **memory growth** in C# (0.07 MB/min vs 3.95 MB/min) suggests the ArrayPool and .NET GC are working well - this is a positive differentiator.

---

## Conclusion

The C# server is functionally complete but has performance gaps primarily due to:

1. **Missing delta batching** (causes broadcast storms)
2. **O(n) state computation** (rebuilds from all deltas on every read)

Addressing these two items should bring C# performance within 2x of TypeScript, which is acceptable for enterprise deployments where .NET ecosystem benefits outweigh raw performance.

The excellent memory stability in C# is a notable advantage for long-running production deployments.
