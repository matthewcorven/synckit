# Phase 5: Awareness - Detailed Work Items

**Phase Duration:** 1 week (Week 9)  
**Phase Goal:** Awareness protocol for presence, cursors, and ephemeral state

> **Note:** Awareness is a separate, ephemeral sync mechanism. Unlike document state, awareness data is NOT persisted - it's only broadcast to other connected clients.

---

## Work Item Details

### W5-01: Create Awareness State Model

**Priority:** P0  
**Estimate:** 3 hours  
**Dependencies:** None

#### Description

Define the data structures for awareness state tracking.

#### Tasks

1. Create `AwarenessState.cs` class
2. Create `AwarenessEntry.cs` class
3. Support arbitrary state payloads
4. Track local clocks for each client

#### Implementation

```csharp
// SyncKit.Server/Awareness/AwarenessState.cs
public class AwarenessState
{
    public string ClientId { get; init; } = null!;
    public string? UserId { get; set; }
    public string? UserName { get; set; }
    public string? UserColor { get; set; }
    public JsonElement? Cursor { get; set; }
    public JsonElement? Selection { get; set; }
    public long Clock { get; set; }
    public DateTime LastUpdated { get; set; }
    
    // Arbitrary additional state
    public Dictionary<string, JsonElement>? CustomState { get; set; }
}

// SyncKit.Server/Awareness/AwarenessEntry.cs
public class AwarenessEntry
{
    public string DocumentId { get; init; } = null!;
    public string ClientId { get; init; } = null!;
    public AwarenessState State { get; set; } = null!;
    public long Clock { get; set; }
    public DateTime ExpiresAt { get; set; }
}
```

#### JSON Format

```json
{
  "clientId": "client-abc",
  "userId": "user-123",
  "userName": "Alice",
  "userColor": "#FF5733",
  "cursor": {
    "x": 100,
    "y": 200,
    "elementId": "editor-1"
  },
  "selection": {
    "start": 10,
    "end": 25
  },
  "clock": 42,
  "customState": {
    "typing": true,
    "lastActive": 1702900000000
  }
}
```

#### Acceptance Criteria

- [ ] AwarenessState holds all standard fields
- [ ] Custom state supported via dictionary
- [ ] Clock tracks version for each client
- [ ] Expiration tracked for cleanup

---

### W5-02: Create Awareness Store

**Priority:** P0  
**Estimate:** 4 hours  
**Dependencies:** W5-01

#### Description

Create in-memory store for awareness state with automatic expiration.

#### Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `AWARENESS_TIMEOUT_MS` | 30000 | Time before awareness expires |

#### Implementation

```csharp
// SyncKit.Server/Awareness/IAwarenessStore.cs
public interface IAwarenessStore
{
    Task<AwarenessEntry?> GetAsync(string documentId, string clientId);
    Task<IReadOnlyList<AwarenessEntry>> GetAllAsync(string documentId);
    Task SetAsync(string documentId, string clientId, AwarenessState state, long clock);
    Task RemoveAsync(string documentId, string clientId);
    Task RemoveAllForConnectionAsync(string connectionId);
    Task<IReadOnlyList<AwarenessEntry>> GetExpiredAsync();
    Task PruneExpiredAsync();
}

// SyncKit.Server/Awareness/InMemoryAwarenessStore.cs
public class InMemoryAwarenessStore : IAwarenessStore
{
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, AwarenessEntry>> _store = new();
    private readonly TimeSpan _timeout;
    private readonly ILogger<InMemoryAwarenessStore> _logger;

    public InMemoryAwarenessStore(
        IOptions<SyncKitConfig> config,
        ILogger<InMemoryAwarenessStore> logger)
    {
        _timeout = TimeSpan.FromMilliseconds(config.Value.AwarenessTimeoutMs);
        _logger = logger;
    }

    public Task<AwarenessEntry?> GetAsync(string documentId, string clientId)
    {
        if (_store.TryGetValue(documentId, out var docStore) &&
            docStore.TryGetValue(clientId, out var entry))
        {
            return Task.FromResult<AwarenessEntry?>(entry);
        }
        return Task.FromResult<AwarenessEntry?>(null);
    }

    public Task<IReadOnlyList<AwarenessEntry>> GetAllAsync(string documentId)
    {
        if (_store.TryGetValue(documentId, out var docStore))
        {
            var now = DateTime.UtcNow;
            var activeEntries = docStore.Values
                .Where(e => e.ExpiresAt > now)
                .ToList();
            return Task.FromResult<IReadOnlyList<AwarenessEntry>>(activeEntries);
        }
        return Task.FromResult<IReadOnlyList<AwarenessEntry>>(Array.Empty<AwarenessEntry>());
    }

    public Task SetAsync(string documentId, string clientId, AwarenessState state, long clock)
    {
        var docStore = _store.GetOrAdd(documentId, _ => new());
        
        if (docStore.TryGetValue(clientId, out var existing))
        {
            // Only update if clock is newer
            if (clock <= existing.Clock)
            {
                _logger.LogDebug(
                    "Ignoring stale awareness update for {ClientId} in {DocumentId}: {Clock} <= {ExistingClock}",
                    clientId, documentId, clock, existing.Clock);
                return Task.CompletedTask;
            }
        }

        var entry = new AwarenessEntry
        {
            DocumentId = documentId,
            ClientId = clientId,
            State = state,
            Clock = clock,
            ExpiresAt = DateTime.UtcNow.Add(_timeout)
        };

        docStore[clientId] = entry;
        
        _logger.LogDebug(
            "Updated awareness for {ClientId} in {DocumentId} at clock {Clock}",
            clientId, documentId, clock);
        
        return Task.CompletedTask;
    }

    public Task RemoveAsync(string documentId, string clientId)
    {
        if (_store.TryGetValue(documentId, out var docStore))
        {
            docStore.TryRemove(clientId, out _);
        }
        return Task.CompletedTask;
    }

    public Task RemoveAllForConnectionAsync(string connectionId)
    {
        // Remove awareness for all documents when connection closes
        foreach (var (docId, docStore) in _store)
        {
            var toRemove = docStore.Values
                .Where(e => e.ClientId == connectionId)
                .Select(e => e.ClientId)
                .ToList();
            
            foreach (var clientId in toRemove)
            {
                docStore.TryRemove(clientId, out _);
            }
        }
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<AwarenessEntry>> GetExpiredAsync()
    {
        var now = DateTime.UtcNow;
        var expired = _store.Values
            .SelectMany(d => d.Values)
            .Where(e => e.ExpiresAt <= now)
            .ToList();
        return Task.FromResult<IReadOnlyList<AwarenessEntry>>(expired);
    }

    public Task PruneExpiredAsync()
    {
        var now = DateTime.UtcNow;
        var removed = 0;

        foreach (var (docId, docStore) in _store)
        {
            var expired = docStore.Values
                .Where(e => e.ExpiresAt <= now)
                .Select(e => e.ClientId)
                .ToList();

            foreach (var clientId in expired)
            {
                if (docStore.TryRemove(clientId, out _))
                {
                    removed++;
                }
            }
        }

        if (removed > 0)
        {
            _logger.LogDebug("Pruned {Count} expired awareness entries", removed);
        }

        return Task.CompletedTask;
    }
}
```

#### Acceptance Criteria

- [ ] State stored per document per client
- [ ] Clock-based update ordering
- [ ] Stale updates rejected
- [ ] Expiration tracked
- [ ] Pruning removes expired entries
- [ ] Connection cleanup removes all entries

---

### W5-03: Implement Awareness Update Handler

**Priority:** P0  
**Estimate:** 4 hours  
**Dependencies:** W5-02, A3-06

#### Description

Handle AWARENESS_UPDATE messages - store locally and broadcast to other subscribers.

#### Implementation

```csharp
// SyncKit.Server/WebSocket/Handlers/AwarenessUpdateHandler.cs
public class AwarenessUpdateHandler : IMessageHandler
{
    private readonly AuthGuard _authGuard;
    private readonly IAwarenessStore _awarenessStore;
    private readonly IStorageAdapter _storage;
    private readonly IConnectionManager _connectionManager;
    private readonly ILogger<AwarenessUpdateHandler> _logger;

    public MessageType[] HandledTypes => new[] { MessageType.AwarenessUpdate };

    public AwarenessUpdateHandler(
        AuthGuard authGuard,
        IAwarenessStore awarenessStore,
        IStorageAdapter storage,
        IConnectionManager connectionManager,
        ILogger<AwarenessUpdateHandler> logger)
    {
        _authGuard = authGuard;
        _awarenessStore = awarenessStore;
        _storage = storage;
        _connectionManager = connectionManager;
        _logger = logger;
    }

    public async Task HandleAsync(Connection connection, IMessage message)
    {
        var update = (AwarenessUpdateMessage)message;

        // Check permissions
        if (!await _authGuard.RequireAwarenessAsync(connection))
        {
            return;
        }

        // Verify subscribed to document
        if (!connection.GetSubscriptions().Contains(update.DocumentId))
        {
            _logger.LogWarning(
                "Connection {ConnectionId} sent awareness for unsubscribed document {DocumentId}",
                connection.Id, update.DocumentId);
            await connection.SendErrorAsync("Not subscribed to document");
            return;
        }

        // Parse state
        AwarenessState state;
        try
        {
            state = JsonSerializer.Deserialize<AwarenessState>(
                update.State.GetRawText()) ?? new AwarenessState();
        }
        catch (JsonException)
        {
            await connection.SendErrorAsync("Invalid awareness state format");
            return;
        }

        // Store awareness
        await _awarenessStore.SetAsync(
            update.DocumentId,
            update.ClientId ?? connection.ClientId ?? connection.Id,
            state,
            update.Clock);

        _logger.LogDebug(
            "Updated awareness for {ClientId} in {DocumentId}",
            update.ClientId, update.DocumentId);

        // Broadcast to other document subscribers
        var broadcastMessage = new AwarenessUpdateMessage
        {
            Id = MessageIdGenerator.Generate(),
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            DocumentId = update.DocumentId,
            ClientId = update.ClientId ?? connection.ClientId ?? connection.Id,
            State = update.State,
            Clock = update.Clock
        };

        await _connectionManager.BroadcastToDocumentAsync(
            update.DocumentId,
            broadcastMessage,
            excludeConnectionId: connection.Id);
    }
}
```

#### Acceptance Criteria

- [ ] Auth required for awareness
- [ ] Must be subscribed to document
- [ ] State stored with clock
- [ ] Broadcast to other subscribers
- [ ] Sender excluded from broadcast
- [ ] Invalid state format handled

---

### W5-04: Implement Awareness Subscribe Handler

**Priority:** P0  
**Estimate:** 3 hours  
**Dependencies:** W5-02

#### Description

Handle AWARENESS_SUBSCRIBE to send current awareness state for a document.

#### Implementation

```csharp
// SyncKit.Server/WebSocket/Handlers/AwarenessSubscribeHandler.cs
public class AwarenessSubscribeHandler : IMessageHandler
{
    private readonly AuthGuard _authGuard;
    private readonly IAwarenessStore _awarenessStore;
    private readonly ILogger<AwarenessSubscribeHandler> _logger;

    public MessageType[] HandledTypes => new[] { MessageType.AwarenessSubscribe };

    public AwarenessSubscribeHandler(
        AuthGuard authGuard,
        IAwarenessStore awarenessStore,
        ILogger<AwarenessSubscribeHandler> logger)
    {
        _authGuard = authGuard;
        _awarenessStore = awarenessStore;
        _logger = logger;
    }

    public async Task HandleAsync(Connection connection, IMessage message)
    {
        var subscribe = (AwarenessSubscribeMessage)message;

        // Check permissions
        if (!await _authGuard.RequireAwarenessAsync(connection))
        {
            return;
        }

        // Get all current awareness for document
        var entries = await _awarenessStore.GetAllAsync(subscribe.DocumentId);

        var states = entries.Select(e => new AwarenessStateEntry
        {
            ClientId = e.ClientId,
            State = e.State,
            Clock = e.Clock
        }).ToList();

        _logger.LogDebug(
            "Sending {Count} awareness states for {DocumentId} to {ConnectionId}",
            states.Count, subscribe.DocumentId, connection.Id);

        await connection.SendAsync(new AwarenessStateMessage
        {
            Id = MessageIdGenerator.Generate(),
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            DocumentId = subscribe.DocumentId,
            States = states
        });
    }
}

public class AwarenessStateEntry
{
    public string ClientId { get; set; } = null!;
    public AwarenessState State { get; set; } = null!;
    public long Clock { get; set; }
}
```

#### Acceptance Criteria

- [ ] Auth required for awareness subscribe
- [ ] Returns all active awareness for document
- [ ] Expired entries not included
- [ ] AWARENESS_STATE message format correct

---

### W5-05: Add Awareness Cleanup on Disconnect

**Priority:** P0  
**Estimate:** 2 hours  
**Dependencies:** W5-02, P2-08

#### Description

Clean up awareness state and notify other clients when a connection closes.

#### Implementation

```csharp
// Add to ConnectionManager
public async Task RemoveConnectionAsync(string connectionId)
{
    if (_connections.TryRemove(connectionId, out var connection))
    {
        // Get subscribed documents before disposing
        var subscriptions = connection.GetSubscriptions().ToList();
        
        await connection.DisposeAsync();
        
        // Clean up awareness
        await _awarenessStore.RemoveAllForConnectionAsync(connectionId);
        
        // Notify other subscribers of this client going offline
        foreach (var documentId in subscriptions)
        {
            // Send awareness removal to document subscribers
            await BroadcastToDocumentAsync(documentId, new AwarenessUpdateMessage
            {
                Id = MessageIdGenerator.Generate(),
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                DocumentId = documentId,
                ClientId = connection.ClientId ?? connectionId,
                State = JsonDocument.Parse("null").RootElement, // null state = offline
                Clock = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            });
        }
        
        _logger.LogInformation(
            "Connection removed: {ConnectionId}. Total: {Count}",
            connectionId, _connections.Count);
    }
}
```

#### Acceptance Criteria

- [ ] Awareness removed on disconnect
- [ ] Other clients notified of offline status
- [ ] Null state indicates offline
- [ ] All subscribed documents notified

---

### W5-06: Add Awareness Expiration Timer

**Priority:** P1  
**Estimate:** 2 hours  
**Dependencies:** W5-02

#### Description

Add background timer to prune expired awareness entries and notify subscribers.

#### Implementation

```csharp
// SyncKit.Server/Awareness/AwarenessCleanupService.cs
public class AwarenessCleanupService : BackgroundService
{
    private readonly IAwarenessStore _awarenessStore;
    private readonly IConnectionManager _connectionManager;
    private readonly ILogger<AwarenessCleanupService> _logger;
    private readonly TimeSpan _interval = TimeSpan.FromSeconds(10);

    public AwarenessCleanupService(
        IAwarenessStore awarenessStore,
        IConnectionManager connectionManager,
        ILogger<AwarenessCleanupService> logger)
    {
        _awarenessStore = awarenessStore;
        _connectionManager = connectionManager;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Awareness cleanup service starting");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(_interval, stoppingToken);
                
                // Get expired entries before pruning
                var expired = await _awarenessStore.GetExpiredAsync();
                
                if (expired.Count > 0)
                {
                    _logger.LogDebug("Pruning {Count} expired awareness entries", expired.Count);
                    
                    // Notify subscribers of each expired entry
                    foreach (var entry in expired)
                    {
                        await _connectionManager.BroadcastToDocumentAsync(
                            entry.DocumentId,
                            new AwarenessUpdateMessage
                            {
                                Id = MessageIdGenerator.Generate(),
                                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                                DocumentId = entry.DocumentId,
                                ClientId = entry.ClientId,
                                State = JsonDocument.Parse("null").RootElement,
                                Clock = entry.Clock + 1 // Increment to ensure it's applied
                            });
                    }
                    
                    await _awarenessStore.PruneExpiredAsync();
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in awareness cleanup");
            }
        }

        _logger.LogInformation("Awareness cleanup service stopped");
    }
}
```

#### Registration

```csharp
// Program.cs
builder.Services.AddHostedService<AwarenessCleanupService>();
```

#### Acceptance Criteria

- [ ] Background service runs periodically
- [ ] Expired entries pruned
- [ ] Subscribers notified of expiration
- [ ] Graceful shutdown

---

### W5-07: Awareness Unit Tests

**Priority:** P0  
**Estimate:** 4 hours  
**Dependencies:** W5-01 through W5-06

#### Description

Comprehensive unit tests for awareness protocol.

#### Test Examples

```csharp
public class AwarenessStoreTests
{
    [Fact]
    public async Task SetAsync_NewEntry_Stored()
    {
        var store = CreateStore();
        var state = new AwarenessState { UserId = "user-1" };
        
        await store.SetAsync("doc-1", "client-1", state, 1);
        
        var entry = await store.GetAsync("doc-1", "client-1");
        Assert.NotNull(entry);
        Assert.Equal("user-1", entry.State.UserId);
    }

    [Fact]
    public async Task SetAsync_OlderClock_Ignored()
    {
        var store = CreateStore();
        var state1 = new AwarenessState { UserId = "user-1" };
        var state2 = new AwarenessState { UserId = "user-2" };
        
        await store.SetAsync("doc-1", "client-1", state1, 5);
        await store.SetAsync("doc-1", "client-1", state2, 3); // Older clock
        
        var entry = await store.GetAsync("doc-1", "client-1");
        Assert.Equal("user-1", entry!.State.UserId); // Should still be state1
    }

    [Fact]
    public async Task GetAllAsync_ExcludesExpired()
    {
        var store = CreateStore(timeout: TimeSpan.FromMilliseconds(1));
        var state = new AwarenessState { UserId = "user-1" };
        
        await store.SetAsync("doc-1", "client-1", state, 1);
        await Task.Delay(10); // Let it expire
        
        var entries = await store.GetAllAsync("doc-1");
        Assert.Empty(entries);
    }

    [Fact]
    public async Task PruneExpiredAsync_RemovesExpired()
    {
        var store = CreateStore(timeout: TimeSpan.FromMilliseconds(1));
        var state = new AwarenessState { UserId = "user-1" };
        
        await store.SetAsync("doc-1", "client-1", state, 1);
        await Task.Delay(10);
        await store.PruneExpiredAsync();
        
        var entry = await store.GetAsync("doc-1", "client-1");
        Assert.Null(entry);
    }
}

public class AwarenessUpdateHandlerTests
{
    [Fact]
    public async Task HandleAsync_ValidUpdate_StoresAndBroadcasts()
    {
        var handler = CreateHandler();
        var connection = CreateAuthenticatedConnection();
        connection.AddSubscription("doc-1");
        
        var message = new AwarenessUpdateMessage
        {
            Id = "msg-1",
            DocumentId = "doc-1",
            ClientId = "client-1",
            State = JsonDocument.Parse("""{"userId":"user-1"}""").RootElement,
            Clock = 1
        };

        await handler.HandleAsync(connection, message);

        // Verify stored and broadcast
    }

    [Fact]
    public async Task HandleAsync_NotSubscribed_SendsError()
    {
        var handler = CreateHandler();
        var connection = CreateAuthenticatedConnection();
        // Not subscribed
        
        var message = new AwarenessUpdateMessage
        {
            Id = "msg-1",
            DocumentId = "doc-1",
            ClientId = "client-1",
            State = JsonDocument.Parse("{}").RootElement,
            Clock = 1
        };

        await handler.HandleAsync(connection, message);

        // Verify error sent
    }
}

public class AwarenessCleanupServiceTests
{
    [Fact]
    public async Task ExecuteAsync_PrunesAndNotifies()
    {
        // Test that cleanup service prunes expired entries
        // and broadcasts offline notifications
    }
}
```

#### Acceptance Criteria

- [ ] Store operations tested
- [ ] Clock ordering tested
- [ ] Expiration tested
- [ ] Handler logic tested
- [ ] Cleanup service tested
- [ ] Disconnect cleanup tested

---

## Phase 5 Summary

| ID | Title | Priority | Est (h) | Status |
|----|-------|----------|---------|--------|
| W5-01 | Create awareness state model | P0 | 3 | ⬜ |
| W5-02 | Create awareness store | P0 | 4 | ⬜ |
| W5-03 | Implement awareness update handler | P0 | 4 | ⬜ |
| W5-04 | Implement awareness subscribe handler | P0 | 3 | ⬜ |
| W5-05 | Add awareness cleanup on disconnect | P0 | 2 | ⬜ |
| W5-06 | Add awareness expiration timer | P1 | 2 | ⬜ |
| W5-07 | Awareness unit tests | P0 | 4 | ⬜ |
| **Total** | | | **22** | |

**Legend:** ⬜ Not Started | 🔄 In Progress | ✅ Complete

---

## Phase 5 Validation

After completing Phase 5, the following should work:

1. **Awareness Update**
   ```json
   // Client A sends awareness:
   > {"type":"awareness_update","id":"1","timestamp":0,"documentId":"doc-1","clientId":"clientA","state":{"userId":"alice","cursor":{"x":100,"y":200}},"clock":1}
   
   // Client B receives:
   < {"type":"awareness_update","id":"2","timestamp":0,"documentId":"doc-1","clientId":"clientA","state":{"userId":"alice","cursor":{"x":100,"y":200}},"clock":1}
   ```

2. **Awareness Subscribe**
   ```json
   > {"type":"awareness_subscribe","id":"1","timestamp":0,"documentId":"doc-1"}
   < {"type":"awareness_state","id":"2","timestamp":0,"documentId":"doc-1","states":[{"clientId":"clientA","state":{...},"clock":1}]}
   ```

3. **Disconnect Notification**
   ```json
   // When Client A disconnects, Client B receives:
   < {"type":"awareness_update","id":"3","timestamp":0,"documentId":"doc-1","clientId":"clientA","state":null,"clock":2}
   ```

4. **Expiration Notification**
   - Client stops sending awareness updates
   - After 30 seconds, other clients notified of offline status
