# C# Server Implementation Reference

> **Purpose:** Complete trace of the C# server implementation for comparison with the TypeScript reference implementation.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Startup Flow](#startup-flow)
3. [Configuration](#configuration)
4. [WebSocket Lifecycle](#websocket-lifecycle)
5. [Message Protocol](#message-protocol)
6. [Message Handlers](#message-handlers)
7. [Sync/Document Layer](#syncdocument-layer)
8. [Authentication & Authorization](#authentication--authorization)
9. [Storage Layer](#storage-layer)
10. [Connection Management](#connection-management)
11. [Awareness Layer](#awareness-layer)
12. [Data Structures](#data-structures)
13. [Error Handling](#error-handling)
14. [PubSub Layer](#pubsub-layer)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          C# Server                                  │
├─────────────────────────────────────────────────────────────────────┤
│  Program.cs (Entry Point)                                           │
│    └─> ASP.NET Core / Kestrel HTTP Server                           │
│         ├─> /health, /health/live, /health/ready (Health Checks)    │
│         ├─> /auth/* (Auth Controller Routes)                        │
│         └─> /ws (WebSocket Middleware)                              │
├─────────────────────────────────────────────────────────────────────┤
│  WebSocket Layer                                                    │
│    ├─> SyncWebSocketMiddleware                                      │
│    │     ├─> WebSocket accept (throttled via SemaphoreSlim)         │
│    │     ├─> Connection creation via ConnectionManager              │
│    │     └─> Message dispatch via Channel<T> pipeline               │
│    ├─> Connection                                                   │
│    │     ├─> Protocol detection (binary/JSON)                       │
│    │     ├─> Heartbeat management (Timer)                           │
│    │     ├─> Send queue (Channel<T>, bounded, DropOldest)           │
│    │     └─> Fragment accumulation (MemoryStream)                   │
│    ├─> ConnectionManager                                            │
│    │     ├─> ConcurrentDictionary<connectionId, Connection>         │
│    │     ├─> Document subscription tracking                         │
│    │     └─> Broadcast (Parallel.ForEach)                           │
│    └─> Protocol Handlers                                            │
│          ├─> BinaryProtocolHandler                                  │
│          └─> JsonProtocolHandler                                    │
├─────────────────────────────────────────────────────────────────────┤
│  Message Dispatch Layer                                             │
│    ├─> MessageDispatcher                                            │
│    │     └─> Routes by MessageType to IMessageHandler               │
│    └─> Handlers                                                     │
│          ├─> AuthMessageHandler                                     │
│          ├─> SubscribeMessageHandler                                │
│          ├─> DeltaMessageHandler                                    │
│          ├─> AwarenessUpdateMessageHandler                          │
│          └─> PingMessageHandler, AckMessageHandler, etc.            │
├─────────────────────────────────────────────────────────────────────┤
│  Sync Layer                                                         │
│    ├─> Document                                                     │
│    │     ├─> List<StoredDelta> (deltas)                             │
│    │     ├─> VectorClock (causality tracking)                       │
│    │     ├─> ReaderWriterLockSlim (thread safety)                   │
│    │     └─> BuildState() (LWW conflict resolution)                 │
│    └─> VectorClock                                                  │
│          └─> Immutable, Dictionary<string, long>                    │
├─────────────────────────────────────────────────────────────────────┤
│  Storage Layer                                                      │
│    ├─> IStorageAdapter interface                                    │
│    ├─> InMemoryStorageAdapter                                       │
│    │     └─> ConcurrentDictionary<docId, Document>                  │
│    └─> PostgresStorageAdapter (optional)                            │
├─────────────────────────────────────────────────────────────────────┤
│  Awareness Layer                                                    │
│    ├─> IAwarenessStore interface                                    │
│    ├─> InMemoryAwarenessStore                                       │
│    │     └─> ConcurrentDictionary<docId, Dict<clientId, Entry>>     │
│    └─> RedisAwarenessStore (optional)                               │
├─────────────────────────────────────────────────────────────────────┤
│  PubSub Layer (Optional)                                            │
│    ├─> IRedisPubSub interface                                       │
│    ├─> NoopRedisPubSub (default)                                    │
│    └─> RedisPubSubProvider (StackExchange.Redis)                    │
├─────────────────────────────────────────────────────────────────────┤
│  Auth Layer                                                         │
│    ├─> JwtValidator (HS256, Microsoft.IdentityModel.Tokens)         │
│    ├─> JwtGenerator                                                 │
│    ├─> ApiKeyValidator                                              │
│    ├─> Rbac (static helper methods)                                 │
│    └─> AuthGuard (middleware for handlers)                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Startup Flow

**File:** `Program.cs`

### Sequence

```
1. Create bootstrap Serilog logger
2. Create WebApplicationBuilder
3. Parse SYNCKIT_SERVER_URL env var for port/address
4. Configure Kestrel:
   - Set listen address/port
   - Set MaxConcurrentConnections = 50000
   - Set MaxConcurrentUpgradedConnections = 50000
   - Set RequestHeadersTimeout = 30s
   - Set KeepAliveTimeout = 2 min
5. Add global exception handler for macOS socket race condition
6. Check for Aspire orchestration (OTEL_EXPORTER_OTLP_ENDPOINT)
   - If present: AddServiceDefaults()
7. Configure Serilog from appsettings.json
8. Add services:
   - AddOpenApi()
   - AddControllers()
   - AddSyncKitConfiguration()
   - AddSyncKitStorage()
   - AddSyncKitAuth()
   - AddSyncKitHealthChecks()
   - AddSyncKitWebSockets()
   - AddHostedService<AwarenessCleanupService>()
9. Build app
10. Configure middleware:
    - UseSerilogRequestLogging()
    - MapControllers() (including /auth routes)
    - MapSyncKitHealthEndpoints()
    - Map /_test/clear (development only)
    - UseSyncKitWebSockets()
    - MapDefaultEndpoints() (if Aspire)
11. Connect storage provider
12. Mark server as ready (SyncKitReadinessHealthCheck.SetReady(true))
13. app.Run()
```

### Key Code Patterns

```csharp
// Kestrel configuration for high connections
builder.WebHost.ConfigureKestrel((context, serverOptions) =>
{
    serverOptions.Listen(address, port, listenOptions =>
    {
        listenOptions.UseConnectionLogging();
    });
    
    serverOptions.Limits.MaxConcurrentConnections = 50000;
    serverOptions.Limits.MaxConcurrentUpgradedConnections = 50000;
    serverOptions.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(30);
    serverOptions.Limits.KeepAliveTimeout = TimeSpan.FromMinutes(2);
});

// Storage initialization with fail-fast
var storage = app.Services.GetRequiredService<IStorageAdapter>();
await storage.ConnectAsync();

// Graceful shutdown is handled by ASP.NET Core host shutdown
```

---

## Configuration

**File:** `Configuration/SyncKitConfig.cs`

### Schema (Data Annotations validation)

| Property | Type | Default | Env Var |
|----------|------|---------|---------|
| `Port` | int | 8080 | `PORT` |
| `Host` | string | "0.0.0.0" | `HOST` |
| `Environment` | string | "Development" | `ASPNETCORE_ENVIRONMENT` |
| `DatabaseUrl` | string? | null | `DATABASE_URL` |
| `DatabasePoolMin` | int | 2 | `DB_POOL_MIN` |
| `DatabasePoolMax` | int | 10 | `DB_POOL_MAX` |
| `RedisUrl` | string? | null | `REDIS_URL` |
| `RedisChannelPrefix` | string | "synckit:" | `REDIS_CHANNEL_PREFIX` |
| `JwtSecret` | string | (required) | `JWT_SECRET` |
| `JwtExpiresIn` | string | "24h" | `JWT_EXPIRES_IN` |
| `JwtRefreshExpiresIn` | string | "7d" | `JWT_REFRESH_EXPIRES_IN` |
| `JwtIssuer` | string? | null | `JWT_ISSUER` |
| `JwtAudience` | string? | null | `JWT_AUDIENCE` |
| `WsHeartbeatInterval` | int | 30000 | `WS_HEARTBEAT_INTERVAL` |
| `WsHeartbeatTimeout` | int | 60000 | `WS_HEARTBEAT_TIMEOUT` |
| `WsMaxConnections` | int | 10000 | `WS_MAX_CONNECTIONS` |
| `AwarenessTimeoutMs` | int | 30000 | `AWARENESS_TIMEOUT_MS` |
| `WsAcceptConcurrency` | int | 5000 | `WS_ACCEPT_CONCURRENCY` |
| `WsConnectionCreationConcurrency` | int | 0 | `WS_CONNECTION_CREATION_CONCURRENCY` |
| `SyncBatchSize` | int | 100 | `SYNC_BATCH_SIZE` |
| `SyncBatchDelay` | int | 50 | `SYNC_BATCH_DELAY` |
| `AuthRequired` | bool | true | `SYNCKIT_AUTH_REQUIRED` |
| `ApiKeys` | string[] | [] | `SYNCKIT_AUTH_APIKEYS` |

### Special Behavior

- **Auth bypass:** When `SYNCKIT_AUTH_REQUIRED=false`, connections are auto-authenticated as anonymous admin
- **Storage selection:** Based on `Storage:Provider` config or `DATABASE_URL` presence
- **Semaphore throttling:** `WsAcceptConcurrency > 0` enables connection accept throttling

---

## WebSocket Lifecycle

**File:** `WebSockets/SyncWebSocketMiddleware.cs`

### Connection Establishment

```
Client connects to ws://host:port/ws
        │
        ▼
┌───────────────────────────────────────┐
│ SyncWebSocketMiddleware.InvokeAsync   │
└───────────────────────────────────────┘
        │
        ├─> Check path == "/ws"
        │
        ├─> Check context.WebSockets.IsWebSocketRequest
        │     If not: return 400 Bad Request
        │
        ▼
┌───────────────────────────────────────┐
│ HandleWebSocketAsync()                │
└───────────────────────────────────────┘
        │
        ├─> Acquire _acceptSemaphore (if throttling enabled)
        │
        ├─> Accept WebSocket: context.WebSockets.AcceptWebSocketAsync()
        │
        ├─> Release _acceptSemaphore
        │
        ├─> Create Connection via ConnectionManager.CreateConnectionAsync()
        │     - Generates ID: "conn_{counter}_{timestamp}"
        │     - Creates JsonProtocolHandler, BinaryProtocolHandler
        │     - Checks max connections limit
        │     - Starts heartbeat timer
        │     - Auto-authenticates if AuthRequired=false
        │
        ├─> Create bounded Channel<(IConnection, IMessage)>
        │     Capacity: 1024, SingleReader, FullMode=Wait
        │
        ├─> Start dispatch task: ProcessMessageChannelAsync()
        │
        ├─> Subscribe to connection.MessageReceived event
        │     -> Enqueue to channel
        │
        └─> Call connection.ProcessMessagesAsync()
              (blocks until connection closes)
```

### Message Reception Flow

**File:** `WebSockets/Connection.cs`

```
WebSocket receives data
        │
        ▼
┌───────────────────────────────┐
│ Connection.ProcessMessagesAsync()   │
└───────────────────────────────┘
        │
        ├─> Rent buffer from ArrayPool<byte>.Shared (8KB)
        │
        ├─> Loop while WebSocket.State == Open:
        │     │
        │     ├─> ReceiveAsync() into buffer
        │     │
        │     ├─> If Close message: CloseAsync() and break
        │     │
        │     ├─> Update LastActivity, IsAlive = true
        │     │
        │     ├─> Accumulate to _messageBuffer (MemoryStream)
        │     │
        │     ├─> If !EndOfMessage: continue (wait for fragments)
        │     │
        │     ├─> Check MaxMessageSize (10MB)
        │     │
        │     ├─> Detect protocol (first message only):
        │     │     - 0x7B '{', 0x5B '[', whitespace → JSON
        │     │     - Otherwise → Binary
        │     │
        │     └─> HandleMessageAsync()
        │           │
        │           ├─> Select handler: JSON or Binary
        │           │
        │           ├─> Parse message: handler.Parse()
        │           │
        │           └─> Raise MessageReceived event
        │
        └─> Return rented buffer to pool
```

### Message Dispatch Pipeline

```
MessageReceived event fires
        │
        ▼
┌───────────────────────────────┐
│ EnqueueMessageAsync()         │
│ (in middleware)               │
└───────────────────────────────┘
        │
        ├─> Write to Channel<(connection, message)>
        │
        ▼
┌───────────────────────────────┐
│ ProcessMessageChannelAsync()  │
│ (background task)             │
└───────────────────────────────┘
        │
        ├─> await foreach from channel reader
        │
        └─> Call MessageDispatcher.DispatchAsync()
              │
              ├─> Lookup handler by message.Type
              │
              └─> handler.HandleAsync(connection, message)
```

### Send Queue Pipeline

**File:** `WebSockets/Connection.cs`

```csharp
// Bounded channel for send queue
_sendQueue = Channel.CreateBounded<(IMessage, WebSocketMessageType, ReadOnlyMemory<byte>)>(
    new BoundedChannelOptions(SendQueueCapacity)  // 10,000
    {
        SingleReader = true,
        SingleWriter = false,
        FullMode = BoundedChannelFullMode.DropOldest  // Drop old messages when full
    });

// Background send task
private async Task ProcessSendQueueAsync(CancellationToken cancellationToken)
{
    await foreach (var (message, messageType, data) in _sendQueue.Reader.ReadAllAsync(cancellationToken))
    {
        if (_webSocket.State != WebSocketState.Open) break;
        
        await _webSocket.SendAsync(data, messageType, true, cancellationToken);
    }
}
```

### Connection Teardown

```
Client disconnects or error
        │
        ▼
┌───────────────────────────────┐
│ Finally block in middleware   │
└───────────────────────────────┘
        │
        ├─> Unsubscribe from MessageReceived event
        │
        ├─> Complete channel writer
        │
        ├─> Await dispatch task
        │
        └─> ConnectionManager.RemoveConnectionAsync()
              │
              ├─> Remove from _connections dictionary
              │
              ├─> Unsubscribe subscription handler
              │
              ├─> For each subscribed document:
              │     ├─> Get existing awareness entry
              │     ├─> Remove from awarenessStore
              │     ├─> Broadcast leave message (state: null)
              │     └─> Remove from document subscriptions
              │
              └─> connection.DisposeAsync()
                    ├─> StopHeartbeat()
                    ├─> Complete send queue writer
                    ├─> Wait for send task (5s timeout)
                    ├─> Cancel CancellationTokenSource
                    ├─> Close WebSocket
                    └─> Return buffer to ArrayPool
```

---

## Message Protocol

**File:** `WebSockets/Protocol/BinaryProtocolHandler.cs`

### Binary Wire Format

```
┌─────────────┬──────────────┬───────────────┬──────────────┐
│ Type (1B)   │ Timestamp    │ Payload Len   │ Payload      │
│ uint8       │ int64 BE     │ uint32 BE     │ JSON UTF-8   │
└─────────────┴──────────────┴───────────────┴──────────────┘
  Byte 0       Bytes 1-8      Bytes 9-12      Bytes 13+
```

### Type Codes

**File:** `WebSockets/Protocol/MessageTypeCode.cs`

| Code | MessageTypeCode | MessageType |
|------|-----------------|-------------|
| 0x01 | AUTH | Auth |
| 0x02 | AUTH_SUCCESS | AuthSuccess |
| 0x03 | AUTH_ERROR | AuthError |
| 0x10 | SUBSCRIBE | Subscribe |
| 0x11 | UNSUBSCRIBE | Unsubscribe |
| 0x12 | SYNC_REQUEST | SyncRequest |
| 0x13 | SYNC_RESPONSE | SyncResponse |
| 0x20 | DELTA | Delta |
| 0x21 | ACK | Ack |
| 0x30 | PING | Ping |
| 0x31 | PONG | Pong |
| 0x40 | AWARENESS_UPDATE | AwarenessUpdate |
| 0x41 | AWARENESS_SUBSCRIBE | AwarenessSubscribe |
| 0x42 | AWARENESS_STATE | AwarenessState |
| 0xFF | ERROR | Error |

### MessageType Enum (String Names)

**File:** `WebSockets/Protocol/MessageType.cs`

```csharp
public enum MessageType
{
    Connect,
    Disconnect,
    Ping,
    Pong,
    Auth,
    AuthSuccess,
    AuthError,
    Subscribe,
    Unsubscribe,
    SyncRequest,
    SyncResponse,
    Delta,
    Ack,
    AwarenessUpdate,
    AwarenessSubscribe,
    AwarenessState,
    Error
}
```

### Protocol Detection Logic

```csharp
// In Connection.DetectProtocol()
var firstByte = data[0];

// Check for JSON indicators
if (firstByte == 0x7B ||  // '{'
    firstByte == 0x5B ||  // '['
    firstByte == 0x20 ||  // space
    firstByte == 0x09 ||  // tab
    firstByte == 0x0A ||  // newline
    firstByte == 0x0D)    // carriage return
{
    Protocol = ProtocolType.Json;
}
else
{
    Protocol = ProtocolType.Binary;
}
```

### Binary Parsing

```csharp
public IMessage? Parse(ReadOnlyMemory<byte> data)
{
    // Validate minimum size (13 bytes header)
    if (data.Length < HeaderSize) return null;

    var span = data.Span;

    // Read header (big-endian)
    var typeCode = (MessageTypeCode)span[0];
    var timestamp = BinaryPrimitives.ReadInt64BigEndian(span.Slice(1, 8));
    var payloadLength = BinaryPrimitives.ReadUInt32BigEndian(span.Slice(9, 4));

    // Validate total length
    if (data.Length < HeaderSize + payloadLength) return null;

    // Map type code to MessageType
    if (!CodeToType.TryGetValue(typeCode, out var messageType)) return null;

    // Extract and parse JSON payload
    var payloadBytes = data.Slice(HeaderSize, (int)payloadLength);
    var json = Encoding.UTF8.GetString(payloadBytes.Span);

    // Deserialize to specific message type
    IMessage? message = messageType switch
    {
        MessageType.Auth => JsonSerializer.Deserialize<AuthMessage>(json, JsonOptions),
        MessageType.Delta => JsonSerializer.Deserialize<DeltaMessage>(json, JsonOptions),
        // ... etc
    };

    // Override timestamp from header
    message.Timestamp = timestamp;

    return message;
}
```

### Binary Serialization

```csharp
public ReadOnlyMemory<byte> Serialize(IMessage message)
{
    // Get type code
    if (!TypeToCode.TryGetValue(message.Type, out var typeCode))
        return ReadOnlyMemory<byte>.Empty;

    // Serialize payload as JSON
    var json = JsonSerializer.Serialize(message, message.GetType(), JsonOptions);
    var payloadByteCount = Encoding.UTF8.GetByteCount(json);

    // Rent buffer from pool (header + payload)
    var totalSize = HeaderSize + payloadByteCount;
    var rentedBuffer = ArrayPool<byte>.Shared.Rent(totalSize);
    var span = rentedBuffer.AsSpan(0, totalSize);

    // Write header (big-endian)
    span[0] = (byte)typeCode;
    BinaryPrimitives.WriteInt64BigEndian(span.Slice(1, 8), message.Timestamp);
    BinaryPrimitives.WriteUInt32BigEndian(span.Slice(9, 4), (uint)payloadByteCount);

    // Write payload
    Encoding.UTF8.GetBytes(json, span.Slice(HeaderSize));

    // Copy to result (return buffer to pool)
    var result = span.ToArray();
    ArrayPool<byte>.Shared.Return(rentedBuffer);

    return result;
}
```

---

## Message Handlers

**File:** `WebSockets/Handlers/`

### Handler Registration

```csharp
// In WebSocketExtensions.AddSyncKitWebSockets()
services.AddSingleton<IMessageHandler, PingMessageHandler>();
services.AddSingleton<IMessageHandler, PongMessageHandler>();
services.AddSingleton<IMessageHandler, AuthMessageHandler>();
services.AddSingleton<IMessageHandler, SubscribeMessageHandler>();
services.AddSingleton<IMessageHandler, UnsubscribeMessageHandler>();
services.AddSingleton<IMessageHandler, DeltaMessageHandler>();
services.AddSingleton<IMessageHandler, SyncRequestMessageHandler>();
services.AddSingleton<IMessageHandler, AckMessageHandler>();
services.AddSingleton<IMessageHandler, AwarenessSubscribeMessageHandler>();
services.AddSingleton<IMessageHandler, AwarenessUpdateMessageHandler>();
```

### AUTH Handler

**File:** `Handlers/AuthMessageHandler.cs`

```csharp
public async Task HandleAsync(IConnection connection, IMessage message)
{
    var auth = message as AuthMessage;

    // If already authenticated, send success
    if (connection.State == ConnectionState.Authenticated)
    {
        SendAuthSuccess(connection);
        return;
    }

    TokenPayload? payload = null;

    // 1. Try JWT token
    if (!string.IsNullOrEmpty(auth.Token))
    {
        payload = _jwtValidator.Validate(auth.Token);
    }

    // 2. Fall back to API key
    if (payload == null && !string.IsNullOrEmpty(auth.ApiKey))
    {
        payload = _apiKeyValidator.Validate(auth.ApiKey);
    }

    // 3. Allow anonymous if auth not required
    if (payload == null && !_config.AuthRequired)
    {
        payload = new TokenPayload
        {
            UserId = "anonymous",
            Permissions = new DocumentPermissions
            {
                CanRead = [],
                CanWrite = [],
                IsAdmin = true  // Admin for test/dev mode
            }
        };
    }

    // Auth failed
    if (payload == null)
    {
        connection.Send(new AuthErrorMessage { Error = "Authentication failed" });
        await connection.CloseAsync(WebSocketCloseStatus.PolicyViolation, "Authentication failed");
        return;
    }

    // Auth succeeded
    connection.UserId = payload.UserId;
    connection.ClientId = payload.UserId;
    connection.TokenPayload = payload;
    connection.State = ConnectionState.Authenticated;

    SendAuthSuccess(connection);
}
```

### SUBSCRIBE Handler

**File:** `Handlers/SubscribeMessageHandler.cs`

```csharp
public async Task HandleAsync(IConnection connection, IMessage message)
{
    var subscribe = message as SubscribeMessage;

    // 1. Enforce read permission
    if (!_authGuard.RequireRead(connection, subscribe.DocumentId))
        return;

    // 2. Get or create document
    var document = await _storage.GetOrCreateDocumentAsync(subscribe.DocumentId);

    // 3. Add subscription (both document and connection track this)
    document.Subscribe(connection.Id);
    connection.AddSubscription(subscribe.DocumentId);

    // 4. Subscribe to Redis channels (if configured and first local subscriber)
    if (_redis != null)
    {
        var localSubs = _connectionManager.GetConnectionsByDocument(subscribe.DocumentId).Count;
        if (localSubs == 1)
        {
            await _redis.SubscribeAsync(subscribe.DocumentId, async (msg) =>
            {
                await _connectionManager.BroadcastToDocumentAsync(subscribe.DocumentId, msg);
            });
        }
    }

    // 5. Get all deltas for initial sync
    var deltas = await _storage.GetDeltasSinceViaAdapterAsync(subscribe.DocumentId, null);

    // 6. Build delta payloads
    var deltaPayloads = deltas.Select(d => new DeltaPayload
    {
        Delta = d.Data,
        VectorClock = d.VectorClock?.ToDict() ?? new Dictionary<string, long>()
    }).ToList();

    // 7. Send SYNC_RESPONSE
    connection.Send(new SyncResponseMessage
    {
        RequestId = subscribe.Id,
        DocumentId = subscribe.DocumentId,
        State = await _storage.GetDocumentStateAsync(subscribe.DocumentId),
        Deltas = deltaPayloads
    });
}
```

### DELTA Handler (Most Complex)

**File:** `Handlers/DeltaMessageHandler.cs`

```csharp
public async Task HandleAsync(IConnection connection, IMessage message)
{
    var delta = message as DeltaMessage;

    // 1. Validate delta
    if (delta.Delta == null)
    {
        connection.SendError("Invalid delta message: missing or empty delta");
        return;
    }

    // 2. Enforce write permission
    if (!_authGuard.RequireWrite(connection, delta.DocumentId))
        return;

    // 3. Auto-subscribe if not already subscribed
    if (!connection.GetSubscriptions().Contains(delta.DocumentId))
    {
        connection.AddSubscription(delta.DocumentId);
    }

    // 4. Convert delta to JsonElement
    JsonElement deltaData;
    if (delta.Delta is JsonElement jsonElement)
        deltaData = jsonElement;
    else
    {
        var jsonString = JsonSerializer.Serialize(delta.Delta);
        deltaData = JsonSerializer.Deserialize<JsonElement>(jsonString);
    }

    // 5. Create storage delta entry
    var deltaEntry = new DeltaEntry
    {
        Id = delta.Id,
        DocumentId = delta.DocumentId,
        ClientId = connection.ClientId ?? connection.Id,
        OperationType = "set",
        FieldPath = string.Empty,
        Value = deltaData,
        ClockValue = delta.VectorClock.Values.DefaultIfEmpty(0).Max(),
        Timestamp = DateTimeOffset.FromUnixTimeMilliseconds(delta.Timestamp).UtcDateTime,
        VectorClock = delta.VectorClock
    };

    // 6. Store delta (applies LWW internally)
    await _storage.SaveDeltaAsync(deltaEntry);

    // 7. Get current state after LWW resolution
    var currentState = await _storage.GetDocumentStateAsync(delta.DocumentId);

    // 8. Build authoritative delta
    var authoritativeDelta = new Dictionary<string, object?>();
    foreach (var property in deltaData.EnumerateObject())
    {
        var fieldName = property.Name;
        var isTombstone = IsTombstone(property.Value);
        var fieldExistsInCurrentState = currentState?.ContainsKey(fieldName) == true;

        if (isTombstone)
        {
            // Delete operation
            if (!fieldExistsInCurrentState)
                authoritativeDelta[fieldName] = new Dictionary<string, object> { { "__deleted", true } };
            else
                authoritativeDelta[fieldName] = currentState![fieldName];
        }
        else
        {
            // Set operation
            if (fieldExistsInCurrentState)
                authoritativeDelta[fieldName] = currentState![fieldName];
            else
                authoritativeDelta[fieldName] = new Dictionary<string, object> { { "__deleted", true } };
        }
    }

    // 9. Broadcast to ALL subscribers (including sender!)
    var broadcastMessage = new DeltaMessage
    {
        DocumentId = delta.DocumentId,
        Delta = authoritativeDelta,
        VectorClock = delta.VectorClock
    };

    await _connectionManager.BroadcastToDocumentAsync(
        delta.DocumentId,
        broadcastMessage,
        excludeConnectionId: null);  // Don't exclude anyone!

    // 10. Publish to Redis
    if (_redis != null)
    {
        await _redis.PublishDeltaAsync(delta.DocumentId, broadcastMessage);
    }

    // 11. Send ACK to sender
    connection.Send(new AckMessage { MessageId = delta.Id });
}
```

### ACK Handler

**File:** `Handlers/AckMessageHandler.cs`

```csharp
public Task HandleAsync(IConnection connection, IMessage message)
{
    // Currently a no-op - ACK tracking not implemented
    // Could track pending messages and clear timeouts here
    _logger.LogDebug("Received ACK from {ConnectionId} for message {MessageId}",
        connection.Id, (message as AckMessage).MessageId);

    return Task.CompletedTask;
}
```

### AWARENESS_UPDATE Handler

**File:** `Handlers/AwarenessUpdateMessageHandler.cs`

```csharp
public async Task HandleAsync(IConnection connection, IMessage message)
{
    var update = message as AwarenessUpdateMessage;

    // 1. Enforce awareness permission (authentication)
    if (!_authGuard.RequireAwareness(connection))
        return;

    // 2. Verify subscribed to document
    if (!connection.GetSubscriptions().Contains(update.DocumentId))
    {
        connection.SendError("Not subscribed to document");
        return;
    }

    // 3. Validate state format
    if (update.State.HasValue &&
        update.State.Value.ValueKind != JsonValueKind.Object &&
        update.State.Value.ValueKind != JsonValueKind.Null)
    {
        connection.SendError("Invalid awareness state format");
        return;
    }

    // 4. Store awareness update (returns true if applied)
    var applied = await _awarenessStore.SetAsync(
        update.DocumentId, update.ClientId,
        AwarenessState.Create(update.ClientId, update.State, update.Clock),
        update.Clock);

    if (!applied) return;  // Stale update ignored

    // 5. Broadcast to other subscribers (excluding sender)
    await _connectionManager.BroadcastToDocumentAsync(
        update.DocumentId,
        new AwarenessUpdateMessage
        {
            DocumentId = update.DocumentId,
            ClientId = update.ClientId,
            State = update.State,
            Clock = update.Clock
        },
        excludeConnectionId: connection.Id);

    // 6. Publish to Redis
    if (_redis != null)
    {
        await _redis.PublishAwarenessAsync(update.DocumentId, update);
    }
}
```

### PING Handler

**File:** `Handlers/PingMessageHandler.cs`

```csharp
public Task HandleAsync(IConnection connection, IMessage message)
{
    // Send PONG response
    connection.Send(new PongMessage
    {
        Id = Guid.NewGuid().ToString(),
        Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
    });

    return Task.CompletedTask;
}
```

---

## Sync/Document Layer

**File:** `Sync/Document.cs`

### Document Class

```csharp
public class Document
{
    private readonly ReaderWriterLockSlim _stateLock = new(LockRecursionPolicy.NoRecursion);
    private readonly List<StoredDelta> _deltas = new();
    private readonly ConcurrentDictionary<string, byte> _subscribedConnections = new();

    public string Id { get; }
    public VectorClock VectorClock { get; private set; }
    public long CreatedAt { get; }
    public long UpdatedAt { get; private set; }

    // Thread-safe delta addition
    public void AddDelta(StoredDelta delta)
    {
        _stateLock.EnterWriteLock();
        try
        {
            _deltas.Add(delta);
            VectorClock = VectorClock.Merge(delta.VectorClock);
            UpdatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        }
        finally
        {
            _stateLock.ExitWriteLock();
        }
    }

    // Atomic increment-and-add (prevents race conditions)
    public StoredDelta AddDeltaWithIncrementedClock(string clientId, JsonElement data, string? deltaId = null)
    {
        _stateLock.EnterWriteLock();
        try
        {
            var incrementedClock = VectorClock.Increment(clientId);

            var stored = new StoredDelta
            {
                Id = deltaId ?? Guid.NewGuid().ToString(),
                ClientId = clientId,
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                Data = data,
                VectorClock = incrementedClock
            };

            _deltas.Add(stored);
            VectorClock = incrementedClock;
            UpdatedAt = stored.Timestamp;

            return stored;
        }
        finally
        {
            _stateLock.ExitWriteLock();
        }
    }
}
```

### LWW Conflict Resolution (BuildState)

```csharp
public Dictionary<string, object?> BuildState()
{
    _stateLock.EnterReadLock();
    try
    {
        var state = new Dictionary<string, object?>();
        // Track: (Timestamp, ClockCounter, ClientId) for LWW resolution
        var lastWriteInfo = new Dictionary<string, (long Timestamp, long ClockCounter, string ClientId)>();

        foreach (var delta in _deltas)
        {
            if (delta.Data.ValueKind == JsonValueKind.Object)
            {
                foreach (var property in delta.Data.EnumerateObject())
                {
                    var fieldName = property.Name;
                    var deltaTs = delta.Timestamp;
                    var clientId = delta.ClientId ?? string.Empty;
                    var clockCounter = delta.VectorClock.Get(clientId);
                    var isTombstone = IsTombstone(property.Value);

                    if (!lastWriteInfo.TryGetValue(fieldName, out var last))
                    {
                        // First write for this field
                        if (isTombstone)
                            state.Remove(fieldName);
                        else
                            state[fieldName] = ConvertJsonElement(property.Value);

                        lastWriteInfo[fieldName] = (deltaTs, clockCounter, clientId);
                    }
                    else
                    {
                        // Multi-level LWW comparison:
                        // 1. Timestamp wins
                        var timestampWins = deltaTs > last.Timestamp;
                        var timestampTie = deltaTs == last.Timestamp;

                        // 2. Clock counter wins (for same timestamp)
                        var clockWins = clockCounter > last.ClockCounter;
                        var clockTie = clockCounter == last.ClockCounter;

                        // 3. Client ID wins (lexicographic tiebreaker)
                        var clientIdWins = string.Compare(clientId, last.ClientId, StringComparison.Ordinal) > 0;

                        var thisWins = timestampWins ||
                                      (timestampTie && clockWins) ||
                                      (timestampTie && clockTie && clientIdWins);

                        if (thisWins)
                        {
                            if (isTombstone)
                                state.Remove(fieldName);
                            else
                                state[fieldName] = ConvertJsonElement(property.Value);

                            lastWriteInfo[fieldName] = (deltaTs, clockCounter, clientId);
                        }
                    }
                }
            }
        }

        return state;
    }
    finally
    {
        _stateLock.ExitReadLock();
    }
}
```

### VectorClock Class

**File:** `Sync/VectorClock.cs`

```csharp
public class VectorClock : IEquatable<VectorClock>
{
    private readonly Dictionary<string, long> _entries;

    public VectorClock() => _entries = new Dictionary<string, long>();
    public VectorClock(Dictionary<string, long> entries) => _entries = new Dictionary<string, long>(entries);

    public IReadOnlyDictionary<string, long> Entries => _entries;

    // Returns NEW VectorClock (immutable pattern)
    public VectorClock Increment(string clientId)
    {
        var newEntries = new Dictionary<string, long>(_entries)
        {
            [clientId] = Get(clientId) + 1
        };
        return new VectorClock(newEntries);
    }

    public long Get(string clientId) => _entries.GetValueOrDefault(clientId, 0);

    // Returns NEW VectorClock (immutable pattern)
    public VectorClock Merge(VectorClock other)
    {
        var merged = new Dictionary<string, long>(_entries);
        foreach (var (clientId, value) in other._entries)
        {
            merged[clientId] = Math.Max(merged.GetValueOrDefault(clientId, 0), value);
        }
        return new VectorClock(merged);
    }

    // A happens-before B iff:
    // - A[i] ≤ B[i] for all i
    // - A[j] < B[j] for some j
    public bool HappensBefore(VectorClock other)
    {
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

    public bool IsConcurrent(VectorClock other)
    {
        return !HappensBefore(other) && !other.HappensBefore(this) && !Equals(other);
    }

    public Dictionary<string, long> ToDict() => new(_entries);
}
```

---

## Authentication & Authorization

### JWT Structure

**File:** `Auth/TokenPayload.cs`

```csharp
public class TokenPayload
{
    public string UserId { get; set; } = null!;
    public string? Email { get; set; }
    public DocumentPermissions Permissions { get; set; } = new();
    public long? Iat { get; set; }  // Unix epoch seconds
    public long? Exp { get; set; }  // Unix epoch seconds
}

public class DocumentPermissions
{
    public string[] CanRead { get; set; } = Array.Empty<string>();
    public string[] CanWrite { get; set; } = Array.Empty<string>();
    public bool IsAdmin { get; set; }
}
```

### JWT Validation

**File:** `Auth/JwtValidator.cs`

```csharp
public TokenPayload? Validate(string token)
{
    var validationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(_secretBytes),
        ValidateIssuer = !string.IsNullOrEmpty(_issuer),
        ValidIssuer = _issuer,
        ValidateAudience = !string.IsNullOrEmpty(_audience),
        ValidAudience = _audience,
        ValidateLifetime = true,
        RequireExpirationTime = true,
        RequireSignedTokens = true,
        ClockSkew = TimeSpan.Zero,
        ValidAlgorithms = new[] { SecurityAlgorithms.HmacSha256 }
    };

    var principal = _tokenHandler.ValidateToken(token, validationParameters, out var validatedToken);
    
    // Extract userId from sub claim
    var userId = (validatedToken as JwtSecurityToken)?.Subject;
    
    // Extract permissions from JSON claim
    var permissions = ExtractPermissions(jwt);

    return new TokenPayload
    {
        UserId = userId,
        Email = email,
        Permissions = permissions,
        Iat = iat,
        Exp = exp
    };
}
```

### RBAC Checks

**File:** `Auth/Rbac.cs`

```csharp
public static class Rbac
{
    public static bool CanReadDocument(TokenPayload? payload, string? documentId)
    {
        if (IsAdmin(payload)) return true;
        if (string.IsNullOrWhiteSpace(documentId)) return false;
        return payload?.Permissions?.CanRead?.Contains(documentId) == true;
    }

    public static bool CanWriteDocument(TokenPayload? payload, string? documentId)
    {
        if (IsAdmin(payload)) return true;
        if (string.IsNullOrWhiteSpace(documentId)) return false;
        return payload?.Permissions?.CanWrite?.Contains(documentId) == true;
    }

    public static bool IsAdmin(TokenPayload? payload)
    {
        return payload?.Permissions?.IsAdmin == true;
    }
}
```

### AuthGuard

**File:** `WebSockets/AuthGuard.cs`

```csharp
public class AuthGuard
{
    public bool RequireAuth(IConnection connection)
    {
        if (connection.State != ConnectionState.Authenticated || connection.TokenPayload == null)
        {
            connection.SendError("Not authenticated");
            return false;
        }
        return true;
    }

    public bool RequireRead(IConnection connection, string documentId)
    {
        if (!RequireAuth(connection)) return false;
        if (!Rbac.CanReadDocument(connection.TokenPayload, documentId))
        {
            connection.SendError("Permission denied", new { documentId });
            return false;
        }
        return true;
    }

    public bool RequireWrite(IConnection connection, string documentId)
    {
        if (!RequireAuth(connection)) return false;
        if (!Rbac.CanWriteDocument(connection.TokenPayload, documentId))
        {
            connection.SendError("Permission denied", new { documentId });
            return false;
        }
        return true;
    }

    public bool RequireAwareness(IConnection connection)
    {
        return RequireAuth(connection);
    }
}
```

### Auth Bypass Mode

```csharp
// In ConnectionManager.CreateConnectionAsync()
if (!_config.AuthRequired)
{
    connection.State = ConnectionState.Authenticated;
    connection.UserId = "anonymous";
    connection.ClientId = "anonymous";
    connection.TokenPayload = new TokenPayload
    {
        UserId = "anonymous",
        Permissions = new DocumentPermissions
        {
            CanRead = [],
            CanWrite = [],
            IsAdmin = true  // Full access
        }
    };
}
```

---

## Storage Layer

### Interface

**File:** `Storage/IStorageAdapter.cs`

```csharp
public interface IStorageAdapter
{
    // Connection Lifecycle
    Task ConnectAsync(CancellationToken ct = default);
    Task DisconnectAsync(CancellationToken ct = default);
    bool IsConnected { get; }
    Task<bool> HealthCheckAsync(CancellationToken ct = default);

    // Document Operations
    Task<DocumentState?> GetDocumentAsync(string id, CancellationToken ct = default);
    Task<DocumentState> SaveDocumentAsync(string id, JsonElement state, CancellationToken ct = default);
    Task<DocumentState> UpdateDocumentAsync(string id, JsonElement state, CancellationToken ct = default);
    Task<bool> DeleteDocumentAsync(string id, CancellationToken ct = default);
    Task<IReadOnlyList<DocumentState>> ListDocumentsAsync(int limit = 100, int offset = 0, CancellationToken ct = default);
    Task<Dictionary<string, object?>> GetDocumentStateAsync(string documentId, CancellationToken ct = default);

    // Vector Clock Operations
    Task<Dictionary<string, long>> GetVectorClockAsync(string documentId, CancellationToken ct = default);
    Task UpdateVectorClockAsync(string documentId, string clientId, long clockValue, CancellationToken ct = default);
    Task MergeVectorClockAsync(string documentId, Dictionary<string, long> clock, CancellationToken ct = default);

    // Delta Operations
    Task<DeltaEntry> SaveDeltaAsync(DeltaEntry delta, CancellationToken ct = default);
    Task<IReadOnlyList<DeltaEntry>> GetDeltasAsync(string documentId, int limit = 100, CancellationToken ct = default);
    Task<IReadOnlyList<DeltaEntry>> GetDeltasSinceAsync(string documentId, long? sinceMaxClock, CancellationToken ct = default);

    // Session Operations
    Task<SessionEntry> SaveSessionAsync(SessionEntry session, CancellationToken ct = default);
    Task UpdateSessionAsync(string sessionId, DateTime lastSeen, Dictionary<string, object>? metadata = null, CancellationToken ct = default);
    Task<bool> DeleteSessionAsync(string sessionId, CancellationToken ct = default);
    Task<IReadOnlyList<SessionEntry>> GetSessionsAsync(string userId, CancellationToken ct = default);

    // Maintenance
    Task<CleanupResult> CleanupAsync(CleanupOptions? options = null, CancellationToken ct = default);
    Task ClearAllAsync(CancellationToken ct = default);
}
```

### InMemoryStorageAdapter

**File:** `Storage/InMemoryStorageAdapter.cs`

```csharp
public class InMemoryStorageAdapter : IStorageAdapter
{
    private readonly ConcurrentDictionary<string, Document> _documents = new();
    private readonly ConcurrentDictionary<string, SessionEntry> _sessions = new();

    public Task<DeltaEntry> SaveDeltaAsync(DeltaEntry delta, CancellationToken ct = default)
    {
        var document = _documents.GetOrAdd(delta.DocumentId, id => new Document(id));

        StoredDelta stored;

        if (delta.VectorClock != null && delta.VectorClock.Count > 0)
        {
            // Use provided vector clock (test scenario)
            stored = new StoredDelta
            {
                Id = delta.Id ?? Guid.NewGuid().ToString(),
                ClientId = delta.ClientId,
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                Data = delta.Value ?? JsonDocument.Parse("{}").RootElement,
                VectorClock = VectorClock.FromDict(delta.VectorClock)
            };
            document.AddDelta(stored);
        }
        else
        {
            // Atomic increment-and-add for proper ordering
            stored = document.AddDeltaWithIncrementedClock(
                delta.ClientId,
                delta.Value ?? JsonDocument.Parse("{}").RootElement,
                delta.Id);
        }

        // Return with server-assigned clock value
        var result = delta with {
            Id = stored.Id,
            Timestamp = DateTimeOffset.FromUnixTimeMilliseconds(stored.Timestamp).UtcDateTime,
            MaxClockValue = stored.VectorClock.Get(delta.ClientId),
            VectorClock = stored.VectorClock.ToDict()
        };

        return Task.FromResult(result);
    }

    public Task<Dictionary<string, object?>> GetDocumentStateAsync(string documentId, CancellationToken ct = default)
    {
        _documents.TryGetValue(documentId, out var doc);
        if (doc == null)
            return Task.FromResult(new Dictionary<string, object?>());
        
        var state = doc.BuildState();  // Applies LWW resolution
        return Task.FromResult(state);
    }
}
```

---

## Connection Management

**File:** `WebSockets/ConnectionManager.cs`

### Data Structures

```csharp
public class ConnectionManager : IConnectionManager
{
    private readonly ConcurrentDictionary<string, IConnection> _connections = new();
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, IConnection>> _documentSubscriptions = new();
    private readonly ConcurrentDictionary<string, Action<string, bool>> _subscriptionHandlers = new();
    private int _connectionCounter;
    private readonly SemaphoreSlim? _connectionSemaphore;
}
```

### Connection Creation

```csharp
public async Task<IConnection> CreateConnectionAsync(WebSocket webSocket, CancellationToken cancellationToken = default)
{
    // Throttle if enabled
    if (_connectionSemaphore is not null)
        await _connectionSemaphore.WaitAsync(cancellationToken);

    try
    {
        // Check max connections
        if (_connections.Count >= _config.WsMaxConnections)
        {
            await webSocket.CloseAsync(WebSocketCloseStatus.PolicyViolation, "Server connection limit reached");
            throw new InvalidOperationException("Maximum connection limit reached");
        }

        // Generate ID: "conn_{counter}_{timestamp}"
        var connectionId = GenerateConnectionId();

        // Create protocol handlers
        var jsonHandler = new JsonProtocolHandler(...);
        var binaryHandler = new BinaryProtocolHandler(...);

        // Create connection
        var connection = new Connection(webSocket, connectionId, jsonHandler, binaryHandler, logger);

        // Track connection
        _connections.TryAdd(connectionId, connection);

        // Start heartbeat
        connection.StartHeartbeat(_config.WsHeartbeatInterval, _config.WsHeartbeatTimeout);

        // Auto-authenticate if auth disabled
        if (!_config.AuthRequired)
        {
            connection.State = ConnectionState.Authenticated;
            connection.UserId = "anonymous";
            connection.TokenPayload = new TokenPayload { ... IsAdmin = true };
        }

        // Track subscription changes
        TrackConnectionSubscriptions(connection);

        return connection;
    }
    finally
    {
        _connectionSemaphore?.Release();
    }
}
```

### Broadcast

```csharp
public Task BroadcastToDocumentAsync(string documentId, IMessage message, string? excludeConnectionId = null)
{
    if (!_documentSubscriptions.TryGetValue(documentId, out var connections))
        return Task.CompletedTask;

    // Parallel sends for better throughput
    // Connection.Send() is non-blocking (queues to async send loop)
    Parallel.ForEach(connections.Values, connection =>
    {
        if (excludeConnectionId != null && connection.Id == excludeConnectionId)
            return;

        connection.Send(message);
    });

    return Task.CompletedTask;
}
```

---

## Awareness Layer

### Interface

**File:** `Awareness/IAwarenessStore.cs`

```csharp
public interface IAwarenessStore
{
    Task<AwarenessEntry?> GetAsync(string documentId, string clientId);
    Task<IReadOnlyList<AwarenessEntry>> GetAllAsync(string documentId);
    Task<bool> SetAsync(string documentId, string clientId, AwarenessState state, long clock);
    Task RemoveAsync(string documentId, string clientId);
    Task RemoveAllForConnectionAsync(string connectionId);
    Task<IReadOnlyList<AwarenessEntry>> GetExpiredAsync();
    Task PruneExpiredAsync();
}
```

### AwarenessState

**File:** `Awareness/AwarenessState.cs`

```csharp
public class AwarenessState
{
    public required string ClientId { get; init; }
    public JsonElement? State { get; set; }
    public long Clock { get; set; }
    public long LastUpdated { get; set; }

    public static AwarenessState Create(string clientId, JsonElement? state, long clock)
    {
        return new AwarenessState
        {
            ClientId = clientId,
            State = state?.Clone(),
            Clock = clock,
            LastUpdated = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        };
    }

    public bool IsStale(int timeoutMs = 30000)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        return (now - LastUpdated) > timeoutMs;
    }

    public bool TryUpdate(JsonElement? newState, long newClock)
    {
        if (newClock <= Clock) return false;  // Reject stale

        State = newState?.Clone();
        Clock = newClock;
        LastUpdated = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        return true;
    }
}
```

### InMemoryAwarenessStore

**File:** `Awareness/InMemoryAwarenessStore.cs`

```csharp
public class InMemoryAwarenessStore : IAwarenessStore
{
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, AwarenessEntry>> _store = new();
    private readonly int _timeoutMs;

    public Task<bool> SetAsync(string documentId, string clientId, AwarenessState state, long clock)
    {
        var docStore = _store.GetOrAdd(documentId, _ => new ConcurrentDictionary<string, AwarenessEntry>());

        if (docStore.TryGetValue(clientId, out var existing))
        {
            // Reject stale updates
            if (clock <= existing.Clock)
                return Task.FromResult(false);
        }

        var entry = AwarenessEntry.Create(documentId, clientId, state?.State, clock, _timeoutMs);
        docStore[clientId] = entry;

        return Task.FromResult(true);
    }

    public Task<IReadOnlyList<AwarenessEntry>> GetAllAsync(string documentId)
    {
        if (_store.TryGetValue(documentId, out var docStore))
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var active = docStore.Values.Where(e => e.ExpiresAt > now).ToList();
            return Task.FromResult<IReadOnlyList<AwarenessEntry>>(active);
        }
        return Task.FromResult<IReadOnlyList<AwarenessEntry>>(Array.Empty<AwarenessEntry>());
    }

    public Task PruneExpiredAsync()
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        foreach (var (docId, docStore) in _store)
        {
            var expired = docStore.Values.Where(e => e.IsExpired()).Select(e => e.ClientId).ToList();
            foreach (var clientId in expired)
                docStore.TryRemove(clientId, out _);
        }
        return Task.CompletedTask;
    }
}
```

---

## Data Structures

### In-Memory Document State

```csharp
// Document storage
ConcurrentDictionary<documentId, Document>

// Document internals
Document {
    string Id;
    VectorClock VectorClock;  // Immutable, replaced on update
    List<StoredDelta> _deltas;  // Protected by ReaderWriterLockSlim
    ConcurrentDictionary<connectionId, byte> _subscribedConnections;
    long CreatedAt;
    long UpdatedAt;
}

// StoredDelta
StoredDelta {
    string Id;
    string ClientId;
    long Timestamp;
    JsonElement Data;
    VectorClock VectorClock;
}
```

### Connection State

```csharp
// Connection manager
ConcurrentDictionary<connectionId, IConnection> _connections
ConcurrentDictionary<documentId, ConcurrentDictionary<connectionId, IConnection>> _documentSubscriptions

// Connection internals
Connection {
    string Id;
    ConnectionState State;
    ProtocolType Protocol;  // Json or Binary
    string? UserId;
    string? ClientId;
    TokenPayload? TokenPayload;
    DateTime LastActivity;
    bool IsAlive;
    ConcurrentDictionary<documentId, byte> _subscribedDocuments;
    Channel<(IMessage, WebSocketMessageType, ReadOnlyMemory<byte>)> _sendQueue;  // Bounded, DropOldest
    MemoryStream _messageBuffer;  // For fragment accumulation
}
```

### Awareness State

```csharp
// Awareness store
ConcurrentDictionary<documentId, ConcurrentDictionary<clientId, AwarenessEntry>>

// AwarenessEntry
AwarenessEntry {
    string DocumentId;
    string ClientId;
    AwarenessState State;
    long Clock;
    long ExpiresAt;
}
```

---

## Error Handling

### Error Extension Method

**File:** `WebSockets/WebSocketExtensions.cs`

```csharp
public static void SendError(this IConnection connection, string error, object? details = null)
{
    var errorMessage = new ErrorMessage
    {
        Id = Guid.NewGuid().ToString(),
        Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
        Error = error,
        Details = details
    };

    connection.Send(errorMessage);
}
```

### ErrorMessage Structure

```csharp
public class ErrorMessage : BaseMessage
{
    public override MessageType Type => MessageType.Error;
    public required string Error { get; set; }
    public object? Details { get; set; }
}
```

### Exception Handling in MessageDispatcher

```csharp
public async Task DispatchAsync(IConnection connection, IMessage message)
{
    if (!_handlers.TryGetValue(message.Type, out var handler))
    {
        connection.SendError($"Unknown message type: {message.Type}");
        return;
    }

    try
    {
        await handler.HandleAsync(connection, message);
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error in handler {HandlerName}", handler.GetType().Name);

        try
        {
            connection.SendError("Internal server error");
        }
        catch { /* Ignore send failures */ }
    }
}
```

---

## PubSub Layer

### Interface

**File:** `PubSub/IRedisPubSub.cs`

```csharp
public interface IRedisPubSub
{
    Task PublishDeltaAsync(string documentId, DeltaMessage delta);
    Task PublishAwarenessAsync(string documentId, AwarenessUpdateMessage update);
    Task SubscribeAsync(string documentId, Func<IMessage, Task> handler);
    Task UnsubscribeAsync(string documentId);
    Task<bool> IsConnectedAsync();
}
```

### RedisPubSubProvider

**File:** `PubSub/RedisPubSubProvider.cs`

```csharp
public class RedisPubSubProvider : IRedisPubSub
{
    private readonly IConnectionMultiplexer _conn;
    private readonly ISubscriber _sub;
    private readonly ConcurrentDictionary<string, Func<IMessage, Task>> _handlers = new();
    private readonly ConcurrentDictionary<string, int> _subscriptionRefCount = new();
    private readonly ConcurrentDictionary<string, long> _publishedMessageIds = new();  // Loop prevention

    private string GetDeltaChannel(string documentId) => $"{_config.RedisChannelPrefix}delta:{documentId}";
    private string GetAwarenessChannel(string documentId) => $"{_config.RedisChannelPrefix}awareness:{documentId}";

    public async Task PublishDeltaAsync(string documentId, DeltaMessage delta)
    {
        var channel = GetDeltaChannel(documentId);
        var json = JsonSerializer.Serialize(delta, _jsonOptions);
        
        // Track to prevent echo on same instance
        _publishedMessageIds[delta.Id] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        
        await _sub.PublishAsync(RedisChannel.Literal(channel), json);
    }

    public async Task SubscribeAsync(string documentId, Func<IMessage, Task> handler)
    {
        _handlers[documentId] = handler;
        _subscriptionRefCount.AddOrUpdate(documentId, 1, (_, v) => v + 1);

        if (_subscriptionRefCount[documentId] == 1)
        {
            await _sub.SubscribeAsync(RedisChannel.Literal(GetDeltaChannel(documentId)),
                (ch, val) => OnMessageReceived(documentId, val));
            await _sub.SubscribeAsync(RedisChannel.Literal(GetAwarenessChannel(documentId)),
                (ch, val) => OnMessageReceived(documentId, val));
        }
    }

    private void OnMessageReceived(string documentId, RedisValue value)
    {
        var json = value.ToString();
        var message = ParseMessage(json);
        
        // Skip messages published by this instance
        if (_publishedMessageIds.ContainsKey(message.Id))
        {
            _publishedMessageIds.TryRemove(message.Id, out _);
            return;
        }

        if (_handlers.TryGetValue(documentId, out var handler))
        {
            _ = handler.Invoke(message);
        }
    }
}
```

---

## Health Check Endpoints

**File:** `Health/HealthExtensions.cs`

```csharp
app.MapGet("/health", (IServerStatsService statsService) =>
{
    var response = new HealthResponse
    {
        Status = "healthy",
        Version = "1.0.0",
        Timestamp = DateTime.UtcNow.ToString("o"),
        Uptime = statsService.GetUptimeSeconds(),
        Stats = statsService.GetStats()
    };
    return Results.Ok(response);
});

// Kubernetes probes
app.MapHealthChecks("/health/live", new HealthCheckOptions { ... });
app.MapHealthChecks("/health/ready", new HealthCheckOptions { ... });
```

---

## Key Behavioral Notes for TypeScript Comparison

1. **Protocol Detection:** First byte determines protocol - JSON indicators (0x7B, 0x5B, whitespace) vs Binary
2. **Auth Bypass:** `SYNCKIT_AUTH_REQUIRED=false` auto-authenticates with admin permissions on connection creation
3. **Auto-Subscribe:** Delta handler auto-subscribes sender to document
4. **LWW Resolution:** 3-level tiebreaker: timestamp > clock counter > clientId (lexicographic)
5. **Broadcast:** Broadcasts to ALL subscribers including sender using `Parallel.ForEach`
6. **Send Queue:** Bounded Channel with `DropOldest` policy (10,000 capacity)
7. **Fragment Handling:** Uses `MemoryStream` to accumulate WebSocket fragments
8. **ACK Tracking:** Currently no-op (not implemented)
9. **Awareness Cleanup:** Background `AwarenessCleanupService` prunes expired entries
10. **Delta Format:** Uses `JsonElement` throughout, converts to dictionary only for LWW comparison

---

## Performance-Relevant Patterns

| Pattern | C# Implementation | Notes |
|---------|-------------------|-------|
| **Message Parsing** | `System.Text.Json` with `JsonSerializer` | Runtime reflection-based (not AOT) |
| **Message Serialization** | `JsonSerializer.Serialize()` + `Encoding.UTF8.GetBytes()` | Allocates on each call |
| **Buffer Management** | `ArrayPool<byte>.Shared.Rent/Return` | Used in protocol handlers |
| **Broadcast** | `Parallel.ForEach` with `Connection.Send()` | Send is non-blocking (queued) |
| **Delta Batching** | **NOT IMPLEMENTED** | TS batches 50ms; C# sends immediately |
| **Document Storage** | `ConcurrentDictionary<docId, Document>` | O(1) lookup |
| **Document Lock** | `ReaderWriterLockSlim` per Document | Read-write separation |
| **Subscriber Tracking** | `ConcurrentDictionary<docId, ConcurrentDictionary<...>>` | Nested dictionaries |
| **Vector Clock** | Immutable `Dictionary<string, long>` | Creates new on each update |
| **LWW Comparison** | In `BuildState()`, iterates all deltas | No caching of resolved state |
| **Send Queue** | `Channel<T>` bounded, DropOldest | Backpressure handling |
| **Connection Throttling** | `SemaphoreSlim` for accept/creation | macOS race condition mitigation |
