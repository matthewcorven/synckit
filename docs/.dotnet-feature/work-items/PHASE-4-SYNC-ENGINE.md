# Phase 4: Sync Engine - Detailed Work Items

**Phase Duration:** 2 weeks (Weeks 7-8)  
**Phase Goal:** Document sync with CRDT operations, vector clocks, and LWW merge

> **Critical:** This phase implements the core synchronization logic. The server mediates sync but does NOT own CRDT operations - it broadcasts deltas to subscribed clients who apply them locally.

---

## Work Item Details

### S4-01: Implement Vector Clock

**Priority:** P0  
**Estimate:** 4 hours  
**Dependencies:** None

#### Description

Implement vector clocks for causality tracking and conflict detection.

#### Tasks

1. Create `VectorClock.cs` class
2. Implement increment operation
3. Implement merge operation
4. Implement comparison (concurrent, happens-before)
5. Support serialization/deserialization

#### Implementation

```csharp
// SyncKit.Server/Sync/VectorClock.cs
public class VectorClock : IEquatable<VectorClock>
{
    private readonly Dictionary<string, long> _entries;

    public VectorClock()
    {
        _entries = new Dictionary<string, long>();
    }

    public VectorClock(Dictionary<string, long> entries)
    {
        _entries = new Dictionary<string, long>(entries);
    }

    public IReadOnlyDictionary<string, long> Entries => _entries;

    /// <summary>
    /// Increment the clock for the given client
    /// </summary>
    public VectorClock Increment(string clientId)
    {
        var newEntries = new Dictionary<string, long>(_entries);
        newEntries[clientId] = Get(clientId) + 1;
        return new VectorClock(newEntries);
    }

    /// <summary>
    /// Get the clock value for a client (0 if not present)
    /// </summary>
    public long Get(string clientId)
    {
        return _entries.GetValueOrDefault(clientId, 0);
    }

    /// <summary>
    /// Merge with another clock (take max of each entry)
    /// </summary>
    public VectorClock Merge(VectorClock other)
    {
        var merged = new Dictionary<string, long>(_entries);
        
        foreach (var (clientId, value) in other._entries)
        {
            merged[clientId] = Math.Max(merged.GetValueOrDefault(clientId, 0), value);
        }
        
        return new VectorClock(merged);
    }

    /// <summary>
    /// Check if this clock causally precedes (happens-before) another
    /// </summary>
    public bool HappensBefore(VectorClock other)
    {
        // A happens-before B iff A[i] ≤ B[i] for all i, and A[j] < B[j] for some j
        var allLessOrEqual = true;
        var someLess = false;

        var allKeys = _entries.Keys.Union(other._entries.Keys);
        
        foreach (var key in allKeys)
        {
            var thisValue = Get(key);
            var otherValue = other.Get(key);

            if (thisValue > otherValue)
            {
                allLessOrEqual = false;
                break;
            }
            
            if (thisValue < otherValue)
            {
                someLess = true;
            }
        }

        return allLessOrEqual && someLess;
    }

    /// <summary>
    /// Check if this clock is concurrent with another
    /// </summary>
    public bool IsConcurrent(VectorClock other)
    {
        return !HappensBefore(other) && !other.HappensBefore(this) && !Equals(other);
    }

    public bool Equals(VectorClock? other)
    {
        if (other is null) return false;
        if (ReferenceEquals(this, other)) return true;
        
        var allKeys = _entries.Keys.Union(other._entries.Keys);
        return allKeys.All(k => Get(k) == other.Get(k));
    }

    public override bool Equals(object? obj) => Equals(obj as VectorClock);

    public override int GetHashCode()
    {
        var hash = new HashCode();
        foreach (var (key, value) in _entries.OrderBy(e => e.Key))
        {
            hash.Add(key);
            hash.Add(value);
        }
        return hash.ToHashCode();
    }

    public Dictionary<string, long> ToDict() => new(_entries);

    public static VectorClock FromDict(Dictionary<string, long>? dict)
    {
        return dict == null ? new VectorClock() : new VectorClock(dict);
    }
}
```

#### Acceptance Criteria

- [ ] Increment increases client's entry by 1
- [ ] Merge takes max of all entries
- [ ] HappensBefore correctly identifies causality
- [ ] IsConcurrent correctly identifies concurrency
- [ ] Equality comparison works
- [ ] Serialization round-trip works

---

### S4-02: Create Document Class

**Priority:** P0  
**Estimate:** 4 hours  
**Dependencies:** S4-01

#### Description

Create the Document class that tracks document state and pending deltas.

#### Tasks

1. Create `Document.cs` class
2. Track document metadata
3. Store pending deltas
4. Track vector clock
5. Support subscribed clients

#### Implementation

```csharp
// SyncKit.Server/Sync/Document.cs
public class Document
{
    public string Id { get; }
    public VectorClock VectorClock { get; private set; }
    public DateTime CreatedAt { get; }
    public DateTime UpdatedAt { get; private set; }
    
    private readonly List<StoredDelta> _deltas = new();
    private readonly HashSet<string> _subscribedConnections = new();
    private readonly object _lock = new();

    public Document(string id)
    {
        Id = id;
        VectorClock = new VectorClock();
        CreatedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public Document(string id, VectorClock vectorClock, IEnumerable<StoredDelta> deltas)
    {
        Id = id;
        VectorClock = vectorClock;
        _deltas = deltas.ToList();
        CreatedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void AddDelta(StoredDelta delta)
    {
        lock (_lock)
        {
            _deltas.Add(delta);
            VectorClock = VectorClock.Merge(delta.VectorClock);
            UpdatedAt = DateTime.UtcNow;
        }
    }

    public IReadOnlyList<StoredDelta> GetDeltasSince(VectorClock? since)
    {
        lock (_lock)
        {
            if (since == null)
            {
                return _deltas.ToList();
            }

            // Return deltas that the client hasn't seen
            return _deltas
                .Where(d => !d.VectorClock.HappensBefore(since) && 
                           !d.VectorClock.Equals(since))
                .ToList();
        }
    }

    public void Subscribe(string connectionId)
    {
        lock (_lock)
        {
            _subscribedConnections.Add(connectionId);
        }
    }

    public void Unsubscribe(string connectionId)
    {
        lock (_lock)
        {
            _subscribedConnections.Remove(connectionId);
        }
    }

    public IReadOnlySet<string> GetSubscribers()
    {
        lock (_lock)
        {
            return _subscribedConnections.ToHashSet();
        }
    }

    public int SubscriberCount
    {
        get
        {
            lock (_lock)
            {
                return _subscribedConnections.Count;
            }
        }
    }
}

public class StoredDelta
{
    public string Id { get; init; } = null!;
    public string ClientId { get; init; } = null!;
    public long Timestamp { get; init; }
    public JsonElement Data { get; init; }
    public VectorClock VectorClock { get; init; } = null!;
}
```

#### Acceptance Criteria

- [ ] Document tracks vector clock
- [ ] Deltas can be added
- [ ] GetDeltasSince filters correctly
- [ ] Subscription management works
- [ ] Thread-safe operations

---

### S4-03: Create Document Store

**Priority:** P0  
**Estimate:** 4 hours  
**Dependencies:** S4-02

#### Description

Create in-memory document store for managing documents.

#### Tasks

1. Create `IDocumentStore.cs` interface
2. Create `InMemoryDocumentStore.cs`
3. Implement CRUD operations
4. Add thread-safe access
5. Support document cleanup

#### Implementation

```csharp
// SyncKit.Server/Sync/IDocumentStore.cs
(obsolete) `IDocumentStore` has been removed; use `IStorageAdapter`
{
    Task<Document> GetOrCreateAsync(string documentId);
    Task<Document?> GetAsync(string documentId);
    Task<bool> ExistsAsync(string documentId);
    Task DeleteAsync(string documentId);
    Task<IReadOnlyList<string>> GetDocumentIdsAsync();
    Task AddDeltaAsync(string documentId, StoredDelta delta);
    Task<IReadOnlyList<StoredDelta>> GetDeltasSinceAsync(string documentId, VectorClock? since);
}

// SyncKit.Server/Sync/InMemoryDocumentStore.cs
public class InMemoryDocumentStore : InMemoryStorageAdapter // obsolete wrapper for compatibility
{
    private readonly ConcurrentDictionary<string, Document> _documents = new();
    private readonly ILogger<InMemoryDocumentStore> _logger;

    public InMemoryDocumentStore(ILogger<InMemoryDocumentStore> logger)
    {
        _logger = logger;
    }

    public Task<Document> GetOrCreateAsync(string documentId)
    {
        var document = _documents.GetOrAdd(documentId, id =>
        {
            _logger.LogDebug("Creating new document: {DocumentId}", id);
            return new Document(id);
        });
        return Task.FromResult(document);
    }

    public Task<Document?> GetAsync(string documentId)
    {
        _documents.TryGetValue(documentId, out var document);
        return Task.FromResult(document);
    }

    public Task<bool> ExistsAsync(string documentId)
    {
        return Task.FromResult(_documents.ContainsKey(documentId));
    }

    public Task DeleteAsync(string documentId)
    {
        if (_documents.TryRemove(documentId, out _))
        {
            _logger.LogDebug("Deleted document: {DocumentId}", documentId);
        }
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<string>> GetDocumentIdsAsync()
    {
        return Task.FromResult<IReadOnlyList<string>>(_documents.Keys.ToList());
    }

    public async Task AddDeltaAsync(string documentId, StoredDelta delta)
    {
        var document = await GetOrCreateAsync(documentId);
        document.AddDelta(delta);
        _logger.LogDebug(
            "Added delta {DeltaId} to document {DocumentId}",
            delta.Id, documentId);
    }

    public async Task<IReadOnlyList<StoredDelta>> GetDeltasSinceAsync(
        string documentId, 
        VectorClock? since)
    {
        var document = await GetAsync(documentId);
        if (document == null)
        {
            return Array.Empty<StoredDelta>();
        }
        return document.GetDeltasSince(since);
    }
}
```

#### Acceptance Criteria

- [ ] GetOrCreate creates on first access
- [ ] Get returns null for missing documents
- [ ] Delete removes documents
- [ ] AddDelta persists deltas
- [ ] GetDeltasSince returns filtered deltas
- [ ] Thread-safe operations

---

### S4-04: Implement Subscribe Handler

**Priority:** P0  
**Estimate:** 4 hours  
**Dependencies:** S4-03, A3-06

#### Description

Handle SUBSCRIBE messages to add connections to document subscriptions.

#### Tasks

1. Create `SubscribeMessageHandler.cs`
2. Validate permissions
3. Add connection to document subscribers
4. Add document to connection's subscriptions
5. Send initial state via SYNC_RESPONSE

#### Implementation

```csharp
// SyncKit.Server/WebSocket/Handlers/SubscribeMessageHandler.cs
public class SubscribeMessageHandler : IMessageHandler
{
    private readonly AuthGuard _authGuard;
    private readonly IStorageAdapter _storage;
    private readonly ILogger<SubscribeMessageHandler> _logger;

    public MessageType[] HandledTypes => new[] { MessageType.Subscribe };

    public SubscribeMessageHandler(
        AuthGuard authGuard,
        IStorageAdapter storage,
        ILogger<SubscribeMessageHandler> logger)
    {
        _authGuard = authGuard;
        _storage = storage;
        _logger = logger;
    }

    public async Task HandleAsync(Connection connection, IMessage message)
    {
        var subscribe = (SubscribeMessage)message;

        // Check permissions
        if (!await _authGuard.RequireReadAsync(connection, subscribe.DocumentId))
        {
            return;
        }

        _logger.LogDebug(
            "Connection {ConnectionId} subscribing to document {DocumentId}",
            connection.Id, subscribe.DocumentId);

        // Get or create document
        var document = await _documentStore.GetOrCreateAsync(subscribe.DocumentId);

        // Add subscription
        document.Subscribe(connection.Id);
        connection.AddSubscription(subscribe.DocumentId);

        // Send current state
        var deltas = document.GetDeltasSince(null);
        
        await connection.SendAsync(new SyncResponseMessage
        {
            Id = MessageIdGenerator.Generate(),
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            RequestId = subscribe.Id,
            DocumentId = subscribe.DocumentId,
            State = document.VectorClock.ToDict(),
            Deltas = deltas.Select(d => new DeltaPayload
            {
                Delta = d.Data,
                VectorClock = d.VectorClock.ToDict()
            }).ToList()
        });

        _logger.LogInformation(
            "Connection {ConnectionId} subscribed to {DocumentId} with {DeltaCount} deltas",
            connection.Id, subscribe.DocumentId, deltas.Count);
    }
}
```

#### Acceptance Criteria

- [ ] Auth required for subscribe
- [ ] Read permission required
- [ ] Document created if not exists
- [ ] Connection added to document subscribers
- [ ] SYNC_RESPONSE sent with current state
- [ ] Existing deltas included in response

---

### S4-05: Implement Unsubscribe Handler

**Priority:** P0  
**Estimate:** 2 hours  
**Dependencies:** S4-04

#### Description

Handle UNSUBSCRIBE messages to remove connections from document subscriptions.

#### Implementation

```csharp
// SyncKit.Server/WebSocket/Handlers/UnsubscribeMessageHandler.cs
public class UnsubscribeMessageHandler : IMessageHandler
{
    private readonly IStorageAdapter _storage;
    private readonly ILogger<UnsubscribeMessageHandler> _logger;

    public MessageType[] HandledTypes => new[] { MessageType.Unsubscribe };

    public UnsubscribeMessageHandler(
        IStorageAdapter storage,
        ILogger<UnsubscribeMessageHandler> logger)
    {
        _storage = storage;
        _logger = logger;
    }

    public async Task HandleAsync(Connection connection, IMessage message)
    {
        var unsubscribe = (UnsubscribeMessage)message;

        // Remove document from connection's subscriptions (no legacy Document operations)
        connection.RemoveSubscription(unsubscribe.DocumentId);
        
        connection.RemoveSubscription(unsubscribe.DocumentId);

        _logger.LogDebug(
            "Connection {ConnectionId} unsubscribed from document {DocumentId}",
            connection.Id, unsubscribe.DocumentId);

        // Send ACK
        await connection.SendAsync(new AckMessage
        {
            Id = MessageIdGenerator.Generate(),
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            MessageId = unsubscribe.Id
        });
    }
}
```

#### Acceptance Criteria

- [ ] Connection removed from document subscribers
- [ ] Document removed from connection's subscriptions
- [ ] ACK sent after unsubscribe
- [ ] No error if document doesn't exist

---

### S4-06: Implement Delta Handler

**Priority:** P0  
**Estimate:** 6 hours  
**Dependencies:** S4-03, A3-06

#### Description

Handle DELTA messages - validate, store, and broadcast to other subscribers.

#### Tasks

1. Create `DeltaMessageHandler.cs`
2. Validate permissions
3. Validate vector clock
4. Store delta
5. Broadcast to other subscribers
6. Send ACK to sender

#### Implementation

```csharp
// SyncKit.Server/WebSocket/Handlers/DeltaMessageHandler.cs
public class DeltaMessageHandler : IMessageHandler
{
    private readonly AuthGuard _authGuard;
    private readonly IStorageAdapter _storage;
    private readonly IConnectionManager _connectionManager;
    private readonly ILogger<DeltaMessageHandler> _logger;

    public MessageType[] HandledTypes => new[] { MessageType.Delta };

    public DeltaMessageHandler(
        AuthGuard authGuard,
        IStorageAdapter storage,
        IConnectionManager connectionManager,
        ILogger<DeltaMessageHandler> logger)
    {
        _authGuard = authGuard;
        _storage = storage;
        _connectionManager = connectionManager;
        _logger = logger;
    }

    public async Task HandleAsync(Connection connection, IMessage message)
    {
        var delta = (DeltaMessage)message;

        // Check permissions
        if (!await _authGuard.RequireWriteAsync(connection, delta.DocumentId))
        {
            return;
        }

        // Verify subscription
        if (!connection.GetSubscriptions().Contains(delta.DocumentId))
        {
            _logger.LogWarning(
                "Connection {ConnectionId} sent delta for unsubscribed document {DocumentId}",
                connection.Id, delta.DocumentId);
            await connection.SendErrorAsync("Not subscribed to document", 
                new { documentId = delta.DocumentId });
            return;
        }

        // Create stored delta
        var storedDelta = new StoredDelta
        {
            Id = delta.Id,
            ClientId = connection.ClientId ?? connection.Id,
            Timestamp = delta.Timestamp,
            Data = delta.Delta,
            VectorClock = VectorClock.FromDict(delta.VectorClock)
        };

        // Store delta
        await _documentStore.AddDeltaAsync(delta.DocumentId, storedDelta);

        _logger.LogDebug(
            "Stored delta {DeltaId} for document {DocumentId} from {ClientId}",
            delta.Id, delta.DocumentId, connection.ClientId);

        // Broadcast to other subscribers
        var broadcastMessage = new DeltaMessage
        {
            Id = MessageIdGenerator.Generate(),
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            DocumentId = delta.DocumentId,
            Delta = delta.Delta,
            VectorClock = delta.VectorClock
        };

        await _connectionManager.BroadcastToDocumentAsync(
            delta.DocumentId,
            broadcastMessage,
            excludeConnectionId: connection.Id);

        // ACK to sender
        await connection.SendAsync(new AckMessage
        {
            Id = MessageIdGenerator.Generate(),
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            MessageId = delta.Id
        });
    }
}
```

#### Acceptance Criteria

- [ ] Auth required for delta
- [ ] Write permission required
- [ ] Must be subscribed to document
- [ ] Delta stored with vector clock
- [ ] Delta broadcast to other subscribers
- [ ] Sender excluded from broadcast
- [ ] ACK sent to sender

---

### S4-07: Implement Sync Request Handler

**Priority:** P0  
**Estimate:** 4 hours  
**Dependencies:** S4-03

#### Description

Handle SYNC_REQUEST messages for clients requesting missed updates.

#### Implementation

```csharp
// SyncKit.Server/WebSocket/Handlers/SyncRequestMessageHandler.cs
public class SyncRequestMessageHandler : IMessageHandler
{
    private readonly AuthGuard _authGuard;
    private readonly IStorageAdapter _storage;
    private readonly ILogger<SyncRequestMessageHandler> _logger;

    public MessageType[] HandledTypes => new[] { MessageType.SyncRequest };

    public SyncRequestMessageHandler(
        AuthGuard authGuard,
        IStorageAdapter storage,
        ILogger<SyncRequestMessageHandler> logger)
    {
        _authGuard = authGuard;
        _storage = storage;
        _logger = logger;
    }

    public async Task HandleAsync(Connection connection, IMessage message)
    {
        var request = (SyncRequestMessage)message;

        // Check permissions
        if (!_authGuard.RequireRead(connection, request.DocumentId))
        {
            return;
        }

        var docState = await _storage.GetDocumentAsync(request.DocumentId);
        if (docState == null)
        {
            // Document doesn't exist - send empty response
            await connection.SendAsync(new SyncResponseMessage
            {
                Id = MessageIdGenerator.Generate(),
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                RequestId = request.Id,
                DocumentId = request.DocumentId,
                State = new Dictionary<string, long>(),
                Deltas = new List<DeltaPayload>()
            });
            return;
        }

        // Get deltas since client's vector clock
        var clientClock = request.VectorClock != null 
            ? VectorClock.FromDict(request.VectorClock) 
            : null;
        
        var deltas = await _storage.GetDeltasSinceViaAdapterAsync(request.DocumentId, clientClock);

        _logger.LogDebug(
            "Sync request for {DocumentId}: returning {DeltaCount} deltas since {Clock}",
            request.DocumentId, deltas.Count, request.VectorClock);

        await connection.SendAsync(new SyncResponseMessage
        {
            Id = MessageIdGenerator.Generate(),
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            RequestId = request.Id,
            DocumentId = request.DocumentId,
            State = await _storage.GetVectorClockAsync(request.DocumentId),
            Deltas = deltas.Select(d => new DeltaPayload
            {
                Delta = d.Data,
                VectorClock = d.VectorClock.ToDict()
            }).ToList()
        });
    }
}

public class DeltaPayload
{
    public JsonElement Delta { get; set; }
    public Dictionary<string, long> VectorClock { get; set; } = new();
}
```

#### Acceptance Criteria

- [ ] Auth required for sync request
- [ ] Read permission required
- [ ] Returns deltas since client's vector clock
- [ ] Empty response for non-existent documents
- [ ] Current server state returned

---

### S4-08: Wire Up Message Handlers

**Priority:** P0  
**Estimate:** 3 hours  
**Dependencies:** S4-04 through S4-07, A3-03

#### Description

Create message dispatcher and register all handlers.

#### Tasks

1. Create `IMessageDispatcher.cs` interface
2. Create `MessageDispatcher.cs` implementation
3. Register all handlers in DI
4. Wire into ConnectionManager

#### Implementation

```csharp
// SyncKit.Server/WebSocket/IMessageDispatcher.cs
public interface IMessageDispatcher
{
    Task DispatchAsync(Connection connection, IMessage message);
}

// SyncKit.Server/WebSocket/MessageDispatcher.cs
public class MessageDispatcher : IMessageDispatcher
{
    private readonly Dictionary<MessageType, IMessageHandler> _handlers;
    private readonly ILogger<MessageDispatcher> _logger;

    public MessageDispatcher(
        IEnumerable<IMessageHandler> handlers,
        ILogger<MessageDispatcher> logger)
    {
        _logger = logger;
        _handlers = new Dictionary<MessageType, IMessageHandler>();

        foreach (var handler in handlers)
        {
            foreach (var type in handler.HandledTypes)
            {
                _handlers[type] = handler;
                _logger.LogDebug("Registered handler for {MessageType}: {HandlerType}",
                    type, handler.GetType().Name);
            }
        }
    }

    public async Task DispatchAsync(Connection connection, IMessage message)
    {
        if (!_handlers.TryGetValue(message.Type, out var handler))
        {
            _logger.LogWarning("No handler for message type: {Type}", message.Type);
            await connection.SendErrorAsync($"Unknown message type: {message.Type}");
            return;
        }

        try
        {
            await handler.HandleAsync(connection, message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling {Type} message", message.Type);
            await connection.SendErrorAsync("Internal server error");
        }
    }
}
```

#### DI Registration

```csharp
// Program.cs or ServiceCollectionExtensions.cs
public static IServiceCollection AddSyncKitHandlers(this IServiceCollection services)
{
    // Register all handlers
    services.AddSingleton<IMessageHandler, AuthMessageHandler>();
    services.AddSingleton<IMessageHandler, PingMessageHandler>();
    services.AddSingleton<IMessageHandler, SubscribeMessageHandler>();
    services.AddSingleton<IMessageHandler, UnsubscribeMessageHandler>();
    services.AddSingleton<IMessageHandler, DeltaMessageHandler>();
    services.AddSingleton<IMessageHandler, SyncRequestMessageHandler>();
    services.AddSingleton<IMessageHandler, AwarenessUpdateHandler>();
    services.AddSingleton<IMessageHandler, AwarenessSubscribeHandler>();
    
    // Register dispatcher
    services.AddSingleton<IMessageDispatcher, MessageDispatcher>();
    
    return services;
}
```

#### Acceptance Criteria

- [ ] All handlers registered
- [ ] Dispatcher routes messages correctly
- [ ] Unknown message types handled gracefully
- [ ] Handler exceptions don't crash server
- [ ] Error responses sent on failure

---

### S4-09: Sync Engine Unit Tests

**Priority:** P0  
**Estimate:** 6 hours  
**Dependencies:** S4-01 through S4-08

#### Description

Comprehensive unit tests for sync engine components.

#### Test Categories

1. Vector Clock Tests
2. Document Tests
3. Document Store Tests
4. Handler Tests
5. Integration Tests

#### Test Examples

```csharp
public class VectorClockTests
{
    [Fact]
    public void Increment_NewClient_SetsToOne()
    {
        var clock = new VectorClock();
        
        var incremented = clock.Increment("client-1");
        
        Assert.Equal(1, incremented.Get("client-1"));
    }

    [Fact]
    public void Increment_ExistingClient_IncrementsValue()
    {
        var clock = new VectorClock(new() { ["client-1"] = 5 });
        
        var incremented = clock.Increment("client-1");
        
        Assert.Equal(6, incremented.Get("client-1"));
    }

    [Fact]
    public void Merge_TakesMaxValues()
    {
        var clock1 = new VectorClock(new() { ["a"] = 1, ["b"] = 3 });
        var clock2 = new VectorClock(new() { ["a"] = 2, ["c"] = 1 });
        
        var merged = clock1.Merge(clock2);
        
        Assert.Equal(2, merged.Get("a"));
        Assert.Equal(3, merged.Get("b"));
        Assert.Equal(1, merged.Get("c"));
    }

    [Fact]
    public void HappensBefore_Causal_ReturnsTrue()
    {
        var clock1 = new VectorClock(new() { ["a"] = 1 });
        var clock2 = new VectorClock(new() { ["a"] = 2 });
        
        Assert.True(clock1.HappensBefore(clock2));
        Assert.False(clock2.HappensBefore(clock1));
    }

    [Fact]
    public void IsConcurrent_ConcurrentClocks_ReturnsTrue()
    {
        var clock1 = new VectorClock(new() { ["a"] = 2, ["b"] = 1 });
        var clock2 = new VectorClock(new() { ["a"] = 1, ["b"] = 2 });
        
        Assert.True(clock1.IsConcurrent(clock2));
        Assert.True(clock2.IsConcurrent(clock1));
    }
}

public class DocumentTests
{
    [Fact]
    public void AddDelta_UpdatesVectorClock()
    {
        var doc = new Document("test-doc");
        var delta = new StoredDelta
        {
            Id = "delta-1",
            ClientId = "client-1",
            Timestamp = 1234567890,
            VectorClock = new VectorClock(new() { ["client-1"] = 1 })
        };
        
        doc.AddDelta(delta);
        
        Assert.Equal(1, doc.VectorClock.Get("client-1"));
    }

    [Fact]
    public void GetDeltasSince_FiltersCorrectly()
    {
        var doc = new Document("test-doc");
        doc.AddDelta(new StoredDelta
        {
            Id = "delta-1",
            ClientId = "a",
            VectorClock = new VectorClock(new() { ["a"] = 1 })
        });
        doc.AddDelta(new StoredDelta
        {
            Id = "delta-2",
            ClientId = "a",
            VectorClock = new VectorClock(new() { ["a"] = 2 })
        });

        var since = new VectorClock(new() { ["a"] = 1 });
        var deltas = doc.GetDeltasSince(since);
        
        Assert.Single(deltas);
        Assert.Equal("delta-2", deltas[0].Id);
    }
}

public class DeltaMessageHandlerTests
{
    [Fact]
    public async Task HandleAsync_ValidDelta_StoresAndBroadcasts()
    {
        // Arrange
        var handler = CreateHandler();
        var connection = CreateAuthenticatedConnection();
        connection.AddSubscription("doc-1");
        
        var message = new DeltaMessage
        {
            Id = "msg-1",
            DocumentId = "doc-1",
            Delta = JsonDocument.Parse("{}").RootElement,
            VectorClock = new() { ["client-1"] = 1 }
        };

        // Act
        await handler.HandleAsync(connection, message);

        // Assert
        // Verify delta stored
        // Verify ACK sent
        // Verify broadcast to other subscribers
    }

    [Fact]
    public async Task HandleAsync_NotSubscribed_SendsError()
    {
        var handler = CreateHandler();
        var connection = CreateAuthenticatedConnection();
        // Note: not subscribed
        
        var message = new DeltaMessage
        {
            Id = "msg-1",
            DocumentId = "doc-1",
            Delta = JsonDocument.Parse("{}").RootElement,
            VectorClock = new() { ["client-1"] = 1 }
        };

        await handler.HandleAsync(connection, message);

        // Verify error sent
    }
}
```

#### Acceptance Criteria

- [ ] Vector clock operations fully tested
- [ ] Document state management tested
- [ ] Document store CRUD tested
- [ ] All handlers tested
- [ ] Error cases covered
- [ ] Concurrent access tested

---

## Phase 4 Summary

| ID | Title | Priority | Est (h) | Status |
|----|-------|----------|---------|--------|
| S4-01 | Implement vector clock | P0 | 4 | ⬜ |
| S4-02 | Create document class | P0 | 4 | ⬜ |
| S4-03 | Create document store | P0 | 4 | ⬜ |
| S4-04 | Implement subscribe handler | P0 | 4 | ⬜ |
| S4-05 | Implement unsubscribe handler | P0 | 2 | ⬜ |
| S4-06 | Implement delta handler | P0 | 6 | ⬜ |
| S4-07 | Implement sync request handler | P0 | 4 | ⬜ |
| S4-08 | Wire up message handlers | P0 | 3 | ⬜ |
| S4-09 | Sync engine unit tests | P0 | 6 | ⬜ |
| **Total** | | | **37** | |

**Legend:** ⬜ Not Started | 🔄 In Progress | ✅ Complete

---

## Phase 4 Validation

After completing Phase 4, the following should work:

1. **Document Subscription**
   ```json
   > {"type":"subscribe","id":"1","timestamp":0,"documentId":"doc-1"}
   < {"type":"sync_response","id":"2","timestamp":0,"requestId":"1","documentId":"doc-1","state":{},"deltas":[]}
   ```

2. **Delta Sync**
   ```json
   // Client A sends delta:
   > {"type":"delta","id":"1","timestamp":0,"documentId":"doc-1","delta":{"field":"value"},"vectorClock":{"clientA":1}}
   < {"type":"ack","id":"2","timestamp":0,"messageId":"1"}
   
   // Client B receives:
   < {"type":"delta","id":"3","timestamp":0,"documentId":"doc-1","delta":{"field":"value"},"vectorClock":{"clientA":1}}
   ```

3. **Sync Request**
   ```json
   > {"type":"sync_request","id":"1","timestamp":0,"documentId":"doc-1","vectorClock":{"clientA":1}}
   < {"type":"sync_response","id":"2","timestamp":0,"requestId":"1","documentId":"doc-1","state":{"clientA":2},"deltas":[...]}
   ```
