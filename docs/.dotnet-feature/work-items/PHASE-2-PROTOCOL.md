# Phase 2: Protocol - Detailed Work Items

**Phase Duration:** 2 weeks (Weeks 3-4)  
**Phase Goal:** WebSocket endpoint with dual protocol support (JSON + Binary)

> **Critical:** This phase implements the maintainer's key requirement - automatic protocol detection between JSON (test suite) and Binary (SDK clients).

---

## Work Item Details

### P2-01: Create WebSocket Middleware

**Priority:** P0  
**Estimate:** 6 hours  
**Dependencies:** F1-04

#### Description

Create ASP.NET Core middleware to handle WebSocket upgrade requests at `/ws` endpoint.

#### Tasks

1. Create `SyncWebSocketMiddleware.cs`
2. Configure WebSocket options (buffer sizes, keep-alive)
3. Handle upgrade requests
4. Integrate with ConnectionManager
5. Add request logging

#### Implementation

```csharp
// SyncKit.Server/WebSocket/SyncWebSocketMiddleware.cs
public class SyncWebSocketMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IConnectionManager _connectionManager;
    private readonly ILogger<SyncWebSocketMiddleware> _logger;

    public SyncWebSocketMiddleware(
        RequestDelegate next,
        IConnectionManager connectionManager,
        ILogger<SyncWebSocketMiddleware> logger)
    {
        _next = next;
        _connectionManager = connectionManager;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Path == "/ws")
        {
            if (context.WebSockets.IsWebSocketRequest)
            {
                var webSocket = await context.WebSockets.AcceptWebSocketAsync();
                var connection = await _connectionManager.CreateConnectionAsync(webSocket);
                
                _logger.LogInformation("WebSocket connection established: {ConnectionId}", 
                    connection.Id);
                
                try
                {
                    await connection.ProcessMessagesAsync();
                }
                catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
                {
                    // Client disconnected - not an error
                    _logger.LogDebug("Client {ConnectionId} disconnected", connection.Id);
                }
                catch (WebSocketException ex) when (ex.WebSocketErrorCode == WebSocketError.ConnectionClosedPrematurely)
                {
                    // Client closed connection abruptly - common, not an error
                    _logger.LogDebug("Client {ConnectionId} closed connection", connection.Id);
                }
                catch (Exception ex)
                {
                    // Unexpected error - log but don't expose to client
                    _logger.LogError(ex, "Unhandled exception for connection {ConnectionId}", connection.Id);
                }
                finally
                {
                    await _connectionManager.RemoveConnectionAsync(connection.Id);
                }
            }
            else
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
            }
        }
        else
        {
            await _next(context);
        }
    }
}
```

#### Registration

```csharp
// Program.cs
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<IConnectionManager, ConnectionManager>();

var app = builder.Build();

app.UseWebSockets(new WebSocketOptions
{
    KeepAliveInterval = TimeSpan.FromSeconds(30)
});

app.UseMiddleware<SyncWebSocketMiddleware>();
```

#### Acceptance Criteria

- [ ] WebSocket upgrade at `/ws` succeeds
- [ ] Non-WebSocket requests to `/ws` return 400
- [ ] Connection ID logged on connect
- [ ] WebSocket options configurable
- [ ] Graceful handling of client disconnects (no error logs)
- [ ] Unhandled exceptions logged but not exposed to client

---

### P2-02: Implement Connection Class

**Priority:** P0  
**Estimate:** 4 hours  
**Dependencies:** P2-01

#### Description

Create the Connection class that manages individual WebSocket connection state, protocol detection, and message handling.

#### Tasks

1. Create `Connection.cs`
2. Implement connection state enum
3. Add protocol type tracking
4. Implement message receive loop
5. Add message send method
6. Handle disconnection cleanup

#### Connection States

```csharp
public enum ConnectionState
{
    Connecting,
    Authenticating,
    Authenticated,
    Disconnecting,
    Disconnected
}
```

#### Implementation

> **Best Practice:** Use `ArrayPool<byte>` for WebSocket buffers to reduce GC pressure under high connection loads. This follows Microsoft's [ASP.NET Core performance best practices](https://learn.microsoft.com/en-us/aspnet/core/performance/performance-best-practices) for memory management.

```csharp
// SyncKit.Server/WebSocket/Connection.cs
using System.Buffers;

public class Connection : IAsyncDisposable
{
    private const int BufferSize = 4096;
    
    public string Id { get; }
    public ConnectionState State { get; private set; }
    public ProtocolType Protocol { get; private set; } = ProtocolType.Unknown;
    public string? UserId { get; set; }
    public string? ClientId { get; set; }
    public TokenPayload? TokenPayload { get; set; }
    
    private readonly WebSocket _webSocket;
    private readonly IProtocolHandler _jsonHandler;
    private readonly IProtocolHandler _binaryHandler;
    private readonly ILogger<Connection> _logger;
    private readonly CancellationTokenSource _cts = new();
    private readonly HashSet<string> _subscribedDocuments = new();
    private DateTime _lastActivity;
    private bool _isAlive = true;
    private byte[]? _rentedBuffer;

    public Connection(
        WebSocket webSocket,
        IProtocolHandler jsonHandler,
        IProtocolHandler binaryHandler,
        ILogger<Connection> logger)
    {
        Id = Guid.NewGuid().ToString("N")[..16];
        _webSocket = webSocket;
        _jsonHandler = jsonHandler;
        _binaryHandler = binaryHandler;
        _logger = logger;
        _lastActivity = DateTime.UtcNow;
        State = ConnectionState.Connecting;
    }

    public async Task ProcessMessagesAsync()
    {
        // Rent buffer from ArrayPool to reduce GC pressure
        _rentedBuffer = ArrayPool<byte>.Shared.Rent(BufferSize);
        var buffer = _rentedBuffer;
        
        try
        {
            while (_webSocket.State == WebSocketState.Open && !_cts.Token.IsCancellationRequested)
            {
                var result = await _webSocket.ReceiveAsync(
                    new ArraySegment<byte>(buffer), 
                    _cts.Token);

                if (result.MessageType == WebSocketMessageType.Close)
                {
                    await CloseAsync(WebSocketCloseStatus.NormalClosure, "Client initiated close");
                    break;
                }

                _lastActivity = DateTime.UtcNow;
                
                var messageBytes = new ReadOnlyMemory<byte>(buffer, 0, result.Count);
                await HandleMessageAsync(messageBytes);
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogDebug("Connection {ConnectionId} cancelled", Id);
        }
        catch (WebSocketException ex)
        {
            _logger.LogWarning(ex, "WebSocket error on connection {ConnectionId}", Id);
        }
        finally
        {
            State = ConnectionState.Disconnected;
        }
    }

    private async Task HandleMessageAsync(ReadOnlyMemory<byte> data)
    {
        // Protocol auto-detection on first message
        if (Protocol == ProtocolType.Unknown)
        {
            DetectProtocol(data.Span);
            _logger.LogDebug("Connection {ConnectionId} detected protocol: {Protocol}", 
                Id, Protocol);
        }

        var handler = Protocol == ProtocolType.Json ? _jsonHandler : _binaryHandler;
        var message = handler.Parse(data);
        
        if (message == null)
        {
            _logger.LogWarning("Failed to parse message on connection {ConnectionId}", Id);
            await SendErrorAsync("Invalid message format");
            return;
        }

        // Emit message event for handlers
        OnMessageReceived?.Invoke(this, message);
    }

    private void DetectProtocol(ReadOnlySpan<byte> data)
    {
        // JSON messages start with '{' (0x7B) or whitespace before '{'
        if (data.Length > 0 && (data[0] == 0x7B || char.IsWhiteSpace((char)data[0])))
        {
            Protocol = ProtocolType.Json;
        }
        else
        {
            Protocol = ProtocolType.Binary;
        }
    }

    public async Task SendAsync(IMessage message)
    {
        if (_webSocket.State != WebSocketState.Open) return;

        var handler = Protocol == ProtocolType.Json ? _jsonHandler : _binaryHandler;
        var data = handler.Serialize(message);
        
        await _webSocket.SendAsync(
            data,
            Protocol == ProtocolType.Json ? WebSocketMessageType.Text : WebSocketMessageType.Binary,
            true,
            _cts.Token);
    }

    public async Task SendErrorAsync(string error, object? details = null)
    {
        await SendAsync(new ErrorMessage
        {
            Id = MessageIdGenerator.Generate(),
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            Error = error,
            Details = details
        });
    }

    public async Task CloseAsync(WebSocketCloseStatus status, string description)
    {
        if (_webSocket.State == WebSocketState.Open)
        {
            State = ConnectionState.Disconnecting;
            await _webSocket.CloseAsync(status, description, _cts.Token);
        }
        State = ConnectionState.Disconnected;
    }

    public void AddSubscription(string documentId) => _subscribedDocuments.Add(documentId);
    public void RemoveSubscription(string documentId) => _subscribedDocuments.Remove(documentId);
    public IReadOnlySet<string> GetSubscriptions() => _subscribedDocuments;
    
    public bool IsAlive => _isAlive;
    public void MarkDead() => _isAlive = false;
    public void MarkAlive() => _isAlive = true;
    
    public TimeSpan IdleTime => DateTime.UtcNow - _lastActivity;

    public event EventHandler<IMessage>? OnMessageReceived;

    public async ValueTask DisposeAsync()
    {
        _cts.Cancel();
        _cts.Dispose();
        _webSocket.Dispose();
        
        // Return rented buffer to pool
        if (_rentedBuffer is not null)
        {
            ArrayPool<byte>.Shared.Return(_rentedBuffer);
            _rentedBuffer = null;
        }
    }
}
```

#### Acceptance Criteria

- [ ] Connection manages WebSocket lifecycle
- [ ] Protocol detected on first message
- [ ] Messages parsed with correct handler
- [ ] Send works for both protocols
- [ ] Clean disposal of resources
- [ ] ArrayPool used for receive buffers (returned on dispose)

---

### P2-03: Define Message Types

**Priority:** P0  
**Estimate:** 3 hours  
**Dependencies:** None

#### Description

Define all message types and codes exactly matching the TypeScript implementation.

#### Tasks

1. Create `MessageType.cs` enum
2. Create `MessageTypeCode.cs` enum
3. Create base `IMessage` interface
4. Create message DTOs for each type
5. Add JSON serialization attributes

#### Message Type Enum

```csharp
// SyncKit.Server/WebSocket/Protocol/MessageType.cs
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

#### Message Type Codes

```csharp
// SyncKit.Server/WebSocket/Protocol/MessageTypeCode.cs
public enum MessageTypeCode : byte
{
    AUTH = 0x01,
    AUTH_SUCCESS = 0x02,
    AUTH_ERROR = 0x03,
    SUBSCRIBE = 0x10,
    UNSUBSCRIBE = 0x11,
    SYNC_REQUEST = 0x12,
    SYNC_RESPONSE = 0x13,
    DELTA = 0x20,
    ACK = 0x21,
    PING = 0x30,
    PONG = 0x31,
    AWARENESS_UPDATE = 0x40,
    AWARENESS_SUBSCRIBE = 0x41,
    AWARENESS_STATE = 0x42,
    ERROR = 0xFF
}
```

#### Base Interface

```csharp
// SyncKit.Server/WebSocket/Protocol/Messages/IMessage.cs
public interface IMessage
{
    MessageType Type { get; }
    string Id { get; set; }
    long Timestamp { get; set; }
}
```

#### Message DTOs

```csharp
// Example: AuthMessage
public record AuthMessage : IMessage
{
    public MessageType Type => MessageType.Auth;
    public string Id { get; set; } = null!;
    public long Timestamp { get; set; }
    public string? Token { get; set; }
    public string? ApiKey { get; set; }
}

// Example: DeltaMessage
public record DeltaMessage : IMessage
{
    public MessageType Type => MessageType.Delta;
    public string Id { get; set; } = null!;
    public long Timestamp { get; set; }
    public string DocumentId { get; set; } = null!;
    public JsonElement Delta { get; set; }
    public Dictionary<string, long> VectorClock { get; set; } = new();
}
```

#### All Message Types Required

| Type | Properties |
|------|------------|
| AuthMessage | Token?, ApiKey? |
| AuthSuccessMessage | UserId, Permissions |
| AuthErrorMessage | Error |
| SubscribeMessage | DocumentId |
| UnsubscribeMessage | DocumentId |
| SyncRequestMessage | DocumentId, VectorClock? |
| SyncResponseMessage | RequestId, DocumentId, State?, Deltas? |
| DeltaMessage | DocumentId, Delta, VectorClock |
| AckMessage | MessageId |
| PingMessage | (base only) |
| PongMessage | (base only) |
| AwarenessUpdateMessage | DocumentId, ClientId, State, Clock |
| AwarenessSubscribeMessage | DocumentId |
| AwarenessStateMessage | DocumentId, States[] |
| ErrorMessage | Error, Details? |

#### Acceptance Criteria

- [ ] All message types defined
- [ ] Type codes match TypeScript exactly
- [ ] JSON serialization works correctly
- [ ] Messages have required properties

---

### P2-04: Implement JSON Protocol Handler

**Priority:** P0  
**Estimate:** 4 hours  
**Dependencies:** P2-03

#### Description

Implement JSON protocol handler for test suite compatibility. Must parse and serialize messages as JSON text.

#### Tasks

1. Create `IProtocolHandler.cs` interface
2. Create `JsonProtocolHandler.cs`
3. Implement Parse method
4. Implement Serialize method
5. Configure System.Text.Json options
6. Add source generator context

#### Interface

```csharp
// SyncKit.Server/WebSocket/Protocol/IProtocolHandler.cs
public interface IProtocolHandler
{
    IMessage? Parse(ReadOnlyMemory<byte> data);
    ReadOnlyMemory<byte> Serialize(IMessage message);
}
```

#### Implementation

```csharp
// SyncKit.Server/WebSocket/Protocol/JsonProtocolHandler.cs
public class JsonProtocolHandler : IProtocolHandler
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower) }
    };

    public IMessage? Parse(ReadOnlyMemory<byte> data)
    {
        try
        {
            var json = Encoding.UTF8.GetString(data.Span);
            
            // First, parse to get the type
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            
            if (!root.TryGetProperty("type", out var typeElement))
            {
                return null;
            }

            var typeStr = typeElement.GetString();
            if (!Enum.TryParse<MessageType>(typeStr, true, out var messageType))
            {
                return null;
            }

            // Deserialize to specific message type
            return messageType switch
            {
                MessageType.Auth => JsonSerializer.Deserialize<AuthMessage>(json, Options),
                MessageType.Ping => JsonSerializer.Deserialize<PingMessage>(json, Options),
                MessageType.Pong => JsonSerializer.Deserialize<PongMessage>(json, Options),
                MessageType.Subscribe => JsonSerializer.Deserialize<SubscribeMessage>(json, Options),
                MessageType.Unsubscribe => JsonSerializer.Deserialize<UnsubscribeMessage>(json, Options),
                MessageType.SyncRequest => JsonSerializer.Deserialize<SyncRequestMessage>(json, Options),
                MessageType.Delta => JsonSerializer.Deserialize<DeltaMessage>(json, Options),
                MessageType.Ack => JsonSerializer.Deserialize<AckMessage>(json, Options),
                MessageType.AwarenessUpdate => JsonSerializer.Deserialize<AwarenessUpdateMessage>(json, Options),
                MessageType.AwarenessSubscribe => JsonSerializer.Deserialize<AwarenessSubscribeMessage>(json, Options),
                _ => null
            };
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public ReadOnlyMemory<byte> Serialize(IMessage message)
    {
        var json = JsonSerializer.Serialize(message, message.GetType(), Options);
        return Encoding.UTF8.GetBytes(json);
    }
}
```

#### JSON Format Examples

```json
// Auth request
{
  "type": "auth",
  "id": "msg-123",
  "timestamp": 1702900000000,
  "token": "jwt.token.here"
}

// Delta message
{
  "type": "delta",
  "id": "msg-456",
  "timestamp": 1702900001000,
  "documentId": "doc-1",
  "delta": { "field": "value" },
  "vectorClock": { "client-1": 5 }
}
```

#### Acceptance Criteria

- [ ] Parses all message types correctly
- [ ] Serializes all message types correctly
- [ ] Handles malformed JSON gracefully
- [ ] camelCase property names
- [ ] snake_case enum values

---

### P2-05: Implement Binary Protocol Handler

**Priority:** P0  
**Estimate:** 6 hours  
**Dependencies:** P2-03

#### Description

Implement binary protocol handler for SDK client compatibility. Must match the wire format exactly.

#### Wire Format

```
┌─────────────┬──────────────┬───────────────┬──────────────┐
│ Type (1B)   │ Timestamp    │ Payload Len   │ Payload      │
│ uint8       │ int64 BE     │ uint32 BE     │ JSON UTF-8   │
└─────────────┴──────────────┴───────────────┴──────────────┘
  Byte 0       Bytes 1-8      Bytes 9-12      Bytes 13+
```

#### Tasks

1. Create `BinaryProtocolHandler.cs`
2. Implement binary header parsing
3. Implement binary header writing
4. Add type code mapping
5. Handle endianness (big-endian)
6. Add minimum size validation

#### Implementation

```csharp
// SyncKit.Server/WebSocket/Protocol/BinaryProtocolHandler.cs
public class BinaryProtocolHandler : IProtocolHandler
{
    private const int HeaderSize = 13; // 1 + 8 + 4 bytes
    
    private static readonly Dictionary<MessageTypeCode, MessageType> CodeToType = new()
    {
        [MessageTypeCode.AUTH] = MessageType.Auth,
        [MessageTypeCode.AUTH_SUCCESS] = MessageType.AuthSuccess,
        [MessageTypeCode.AUTH_ERROR] = MessageType.AuthError,
        [MessageTypeCode.SUBSCRIBE] = MessageType.Subscribe,
        [MessageTypeCode.UNSUBSCRIBE] = MessageType.Unsubscribe,
        [MessageTypeCode.SYNC_REQUEST] = MessageType.SyncRequest,
        [MessageTypeCode.SYNC_RESPONSE] = MessageType.SyncResponse,
        [MessageTypeCode.DELTA] = MessageType.Delta,
        [MessageTypeCode.ACK] = MessageType.Ack,
        [MessageTypeCode.PING] = MessageType.Ping,
        [MessageTypeCode.PONG] = MessageType.Pong,
        [MessageTypeCode.AWARENESS_UPDATE] = MessageType.AwarenessUpdate,
        [MessageTypeCode.AWARENESS_SUBSCRIBE] = MessageType.AwarenessSubscribe,
        [MessageTypeCode.AWARENESS_STATE] = MessageType.AwarenessState,
        [MessageTypeCode.ERROR] = MessageType.Error
    };

    private static readonly Dictionary<MessageType, MessageTypeCode> TypeToCode = 
        CodeToType.ToDictionary(kvp => kvp.Value, kvp => kvp.Key);

    private readonly JsonProtocolHandler _jsonHandler = new();

    public IMessage? Parse(ReadOnlyMemory<byte> data)
    {
        if (data.Length < HeaderSize)
        {
            return null;
        }

        var span = data.Span;

        // Read header
        var typeCode = (MessageTypeCode)span[0];
        var timestamp = BinaryPrimitives.ReadInt64BigEndian(span[1..9]);
        var payloadLength = BinaryPrimitives.ReadUInt32BigEndian(span[9..13]);

        // Validate
        if (data.Length < HeaderSize + payloadLength)
        {
            return null;
        }

        if (!CodeToType.TryGetValue(typeCode, out var messageType))
        {
            return null;
        }

        // Extract payload and parse as JSON
        var payloadBytes = data.Slice(HeaderSize, (int)payloadLength);
        var message = _jsonHandler.Parse(payloadBytes);

        if (message != null)
        {
            // Override timestamp from header
            message.Timestamp = timestamp;
        }

        return message;
    }

    public ReadOnlyMemory<byte> Serialize(IMessage message)
    {
        // Get type code
        if (!TypeToCode.TryGetValue(message.Type, out var typeCode))
        {
            throw new ArgumentException($"Unknown message type: {message.Type}");
        }

        // Serialize payload (excluding type, it's in header)
        var payloadJson = JsonSerializer.Serialize(message, message.GetType(), new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        });
        var payloadBytes = Encoding.UTF8.GetBytes(payloadJson);

        // Build binary message
        var buffer = new byte[HeaderSize + payloadBytes.Length];
        
        // Write header
        buffer[0] = (byte)typeCode;
        BinaryPrimitives.WriteInt64BigEndian(buffer.AsSpan(1, 8), message.Timestamp);
        BinaryPrimitives.WriteUInt32BigEndian(buffer.AsSpan(9, 4), (uint)payloadBytes.Length);
        
        // Write payload
        payloadBytes.CopyTo(buffer.AsSpan(HeaderSize));

        return buffer;
    }
}
```

#### Type Code Mapping

| Code (hex) | MessageType |
|------------|-------------|
| 0x01 | Auth |
| 0x02 | AuthSuccess |
| 0x03 | AuthError |
| 0x10 | Subscribe |
| 0x11 | Unsubscribe |
| 0x12 | SyncRequest |
| 0x13 | SyncResponse |
| 0x20 | Delta |
| 0x21 | Ack |
| 0x30 | Ping |
| 0x31 | Pong |
| 0x40 | AwarenessUpdate |
| 0x41 | AwarenessSubscribe |
| 0x42 | AwarenessState |
| 0xFF | Error |

#### Acceptance Criteria

- [ ] Parses binary messages correctly
- [ ] Serializes binary messages correctly
- [ ] Big-endian byte order for multi-byte values
- [ ] Handles undersized messages gracefully
- [ ] Type codes match TypeScript exactly

---

### P2-06: Implement Protocol Auto-Detection

**Priority:** P0  
**Estimate:** 3 hours  
**Dependencies:** P2-04, P2-05

#### Description

Implement automatic protocol detection based on the first message, matching the TypeScript behavior.

#### Tasks

1. Update Connection.DetectProtocol()
2. Add detection logging
3. Add detection tests
4. Document detection algorithm

#### Detection Algorithm

```csharp
private void DetectProtocol(ReadOnlySpan<byte> data)
{
    if (Protocol != ProtocolType.Unknown) return;
    
    // JSON starts with '{' (0x7B) possibly preceded by whitespace
    // Binary starts with type code (0x01-0x42 or 0xFF)
    
    if (data.Length == 0)
    {
        Protocol = ProtocolType.Binary; // Default to binary
        return;
    }

    var firstByte = data[0];
    
    // Check for JSON indicators
    if (firstByte == 0x7B || // '{'
        firstByte == 0x5B || // '['
        firstByte == 0x20 || // space
        firstByte == 0x09 || // tab
        firstByte == 0x0A || // newline
        firstByte == 0x0D)   // carriage return
    {
        Protocol = ProtocolType.Json;
    }
    else
    {
        Protocol = ProtocolType.Binary;
    }
    
    _logger.LogDebug(
        "Connection {ConnectionId} protocol detected: {Protocol} (first byte: 0x{FirstByte:X2})",
        Id, Protocol, firstByte);
}
```

#### Acceptance Criteria

- [ ] JSON detected when message starts with `{`
- [ ] Binary detected for all other first bytes
- [ ] Detection happens only once per connection
- [ ] Detection logged for debugging
- [ ] Same detection logic as TypeScript

---

### P2-07: Implement Heartbeat (Ping/Pong)

**Priority:** P0  
**Estimate:** 3 hours  
**Dependencies:** P2-02

#### Description

Implement WebSocket heartbeat mechanism to detect stale connections.

#### Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `WS_HEARTBEAT_INTERVAL` | 30000ms | Time between pings |
| `WS_HEARTBEAT_TIMEOUT` | 60000ms | Time to wait for pong |

#### Tasks

1. Add heartbeat timer to Connection
2. Send PING messages at interval
3. Track last PONG received
4. Terminate stale connections
5. Handle client-initiated PING

#### Implementation

```csharp
// In Connection class
private Timer? _heartbeatTimer;
private DateTime _lastPong;

public void StartHeartbeat(int intervalMs, int timeoutMs)
{
    _lastPong = DateTime.UtcNow;
    
    _heartbeatTimer = new Timer(async _ =>
    {
        // Check if connection is stale
        if ((DateTime.UtcNow - _lastPong).TotalMilliseconds > timeoutMs)
        {
            _logger.LogWarning(
                "Connection {ConnectionId} heartbeat timeout - terminating",
                Id);
            await CloseAsync(
                WebSocketCloseStatus.PolicyViolation, 
                "Heartbeat timeout");
            return;
        }

        // Send ping
        await SendAsync(new PingMessage
        {
            Id = MessageIdGenerator.Generate(),
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        });
        
    }, null, intervalMs, intervalMs);
}

public void HandlePong()
{
    _lastPong = DateTime.UtcNow;
    MarkAlive();
}

public async Task HandlePingAsync(PingMessage ping)
{
    await SendAsync(new PongMessage
    {
        Id = MessageIdGenerator.Generate(),
        Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
    });
}
```

#### Acceptance Criteria

- [ ] Server sends PING every 30s
- [ ] Server responds to client PING with PONG
- [ ] Connection terminated if no PONG within 60s
- [ ] Heartbeat interval/timeout configurable

---

### P2-08: Add ConnectionManager

**Priority:** P0  
**Estimate:** 4 hours  
**Dependencies:** P2-02

#### Description

Create a singleton service to manage all active WebSocket connections.

#### Tasks

1. Create `IConnectionManager.cs` interface
2. Create `ConnectionManager.cs` implementation
3. Add connection tracking
4. Add connection lookup methods
5. Add broadcast capabilities
6. Thread-safe implementation

#### Interface

```csharp
// SyncKit.Server/WebSocket/IConnectionManager.cs
public interface IConnectionManager
{
    Task<Connection> CreateConnectionAsync(WebSocket webSocket);
    Connection? GetConnection(string connectionId);
    IReadOnlyList<Connection> GetAllConnections();
    IReadOnlyList<Connection> GetConnectionsByDocument(string documentId);
    IReadOnlyList<Connection> GetConnectionsByUser(string userId);
    Task RemoveConnectionAsync(string connectionId);
    Task BroadcastToDocumentAsync(string documentId, IMessage message, string? excludeConnectionId = null);
    Task CloseAllAsync(WebSocketCloseStatus status, string description); // For graceful shutdown
    int ConnectionCount { get; }
}
```

#### Implementation

```csharp
// SyncKit.Server/WebSocket/ConnectionManager.cs
public class ConnectionManager : IConnectionManager
{
    private readonly ConcurrentDictionary<string, Connection> _connections = new();
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ConnectionManager> _logger;
    private readonly SyncKitConfig _config;

    public ConnectionManager(
        IServiceProvider serviceProvider,
        IOptions<SyncKitConfig> config,
        ILogger<ConnectionManager> logger)
    {
        _serviceProvider = serviceProvider;
        _config = config.Value;
        _logger = logger;
    }

    public async Task<Connection> CreateConnectionAsync(WebSocket webSocket)
    {
        if (_connections.Count >= _config.WsMaxConnections)
        {
            throw new InvalidOperationException("Maximum connections reached");
        }

        var connection = new Connection(
            webSocket,
            _serviceProvider.GetRequiredService<JsonProtocolHandler>(),
            _serviceProvider.GetRequiredService<BinaryProtocolHandler>(),
            _serviceProvider.GetRequiredService<ILogger<Connection>>());

        if (!_connections.TryAdd(connection.Id, connection))
        {
            throw new InvalidOperationException("Failed to add connection");
        }

        _logger.LogInformation(
            "Connection created: {ConnectionId}. Total: {Count}",
            connection.Id, _connections.Count);

        // Wire up events
        connection.OnMessageReceived += HandleMessage;

        // Start heartbeat
        connection.StartHeartbeat(
            _config.WsHeartbeatInterval,
            _config.WsHeartbeatTimeout);

        return connection;
    }

    public Connection? GetConnection(string connectionId)
    {
        _connections.TryGetValue(connectionId, out var connection);
        return connection;
    }

    public IReadOnlyList<Connection> GetAllConnections()
    {
        return _connections.Values.ToList();
    }

    public IReadOnlyList<Connection> GetConnectionsByDocument(string documentId)
    {
        return _connections.Values
            .Where(c => c.GetSubscriptions().Contains(documentId))
            .ToList();
    }

    public IReadOnlyList<Connection> GetConnectionsByUser(string userId)
    {
        return _connections.Values
            .Where(c => c.UserId == userId)
            .ToList();
    }

    /// <summary>
    /// Remove connection and clean up all subscriptions.
    /// Matches TypeScript handleDisconnect() behavior.
    /// </summary>
    public async Task RemoveConnectionAsync(string connectionId)
    {
        if (_connections.TryRemove(connectionId, out var connection))
        {
            // 1. Unsubscribe from all documents (matches TypeScript)
            var subscriptions = connection.GetSubscriptions();
            foreach (var documentId in subscriptions)
            {
                _coordinator.Unsubscribe(documentId, connectionId);
            }
            
            // 2. Unsubscribe from awareness updates
            foreach (var documentId in _coordinator.GetAwarenessDocumentIds())
            {
                _coordinator.UnsubscribeFromAwareness(documentId, connectionId);
            }
            
            // Note: Awareness client state cleaned up by periodic cleanup task
            // (30s timeout, matches TypeScript AWARENESS_TIMEOUT)
            
            // 3. Dispose connection resources (WebSocket, buffer pool, etc.)
            await connection.DisposeAsync();
            
            _logger.LogInformation(
                "Connection removed: {ConnectionId}. Unsubscribed from {DocCount} documents. Total: {Count}",
                connectionId, subscriptions.Count, _connections.Count);
        }
    }

    public async Task BroadcastToDocumentAsync(
        string documentId, 
        IMessage message, 
        string? excludeConnectionId = null)
    {
        var connections = GetConnectionsByDocument(documentId);
        
        var tasks = connections
            .Where(c => c.Id != excludeConnectionId && c.State == ConnectionState.Authenticated)
            .Select(c => c.SendAsync(message));

        await Task.WhenAll(tasks);
    }

    public int ConnectionCount => _connections.Count;

    /// <summary>
    /// Close all connections gracefully. Used during server shutdown.
    /// Matches TypeScript registry.closeAll() behavior.
    /// </summary>
    public async Task CloseAllAsync(WebSocketCloseStatus status, string description)
    {
        _logger.LogInformation("Closing all {Count} connections: {Reason}", 
            _connections.Count, description);
        
        var tasks = _connections.Values.Select(async c =>
        {
            try
            {
                await c.CloseAsync(status, description);
                await RemoveConnectionAsync(c.Id);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error closing connection {ConnectionId}", c.Id);
            }
        });
        
        await Task.WhenAll(tasks);
    }

    private void HandleMessage(object? sender, IMessage message)
    {
        // Dispatch to message handlers
        // This will be wired up to specific handlers in later phases
    }
}
```

#### Acceptance Criteria

- [ ] Connections tracked by ID
- [ ] Max connection limit enforced
- [ ] Lookup by document subscription works
- [ ] Lookup by user ID works
- [ ] Broadcast to document works
- [ ] Thread-safe operations
- [ ] RemoveConnectionAsync cleans up all subscriptions (document + awareness)
- [ ] CloseAllAsync closes all connections gracefully (for shutdown)

---

### P2-09: Protocol Unit Tests

**Priority:** P0  
**Estimate:** 6 hours  
**Dependencies:** P2-04, P2-05

#### Description

Comprehensive unit tests for both protocol handlers and auto-detection.

#### Test Categories

1. JSON Protocol Tests
2. Binary Protocol Tests
3. Protocol Detection Tests
4. Round-trip Tests
5. Edge Case Tests

#### Test Examples

```csharp
public class JsonProtocolHandlerTests
{
    private readonly JsonProtocolHandler _handler = new();

    [Fact]
    public void Parse_AuthMessage_Success()
    {
        var json = """{"type":"auth","id":"msg-1","timestamp":1234567890,"token":"jwt"}""";
        var bytes = Encoding.UTF8.GetBytes(json);
        
        var message = _handler.Parse(bytes);
        
        Assert.NotNull(message);
        Assert.IsType<AuthMessage>(message);
        var auth = (AuthMessage)message;
        Assert.Equal("jwt", auth.Token);
    }

    [Fact]
    public void Parse_InvalidJson_ReturnsNull()
    {
        var bytes = Encoding.UTF8.GetBytes("not json");
        
        var message = _handler.Parse(bytes);
        
        Assert.Null(message);
    }

    [Fact]
    public void Serialize_RoundTrip_Matches()
    {
        var original = new DeltaMessage
        {
            Id = "msg-1",
            Timestamp = 1234567890,
            DocumentId = "doc-1",
            VectorClock = new() { ["client-1"] = 5 }
        };

        var serialized = _handler.Serialize(original);
        var parsed = _handler.Parse(serialized);

        Assert.NotNull(parsed);
        var delta = Assert.IsType<DeltaMessage>(parsed);
        Assert.Equal(original.DocumentId, delta.DocumentId);
        Assert.Equal(original.VectorClock, delta.VectorClock);
    }
}

public class BinaryProtocolHandlerTests
{
    private readonly BinaryProtocolHandler _handler = new();

    [Fact]
    public void Parse_ValidBinaryMessage_Success()
    {
        // Build a binary AUTH message
        var payload = """{"id":"msg-1","token":"jwt"}""";
        var payloadBytes = Encoding.UTF8.GetBytes(payload);
        
        var buffer = new byte[13 + payloadBytes.Length];
        buffer[0] = 0x01; // AUTH type code
        BinaryPrimitives.WriteInt64BigEndian(buffer.AsSpan(1, 8), 1234567890);
        BinaryPrimitives.WriteUInt32BigEndian(buffer.AsSpan(9, 4), (uint)payloadBytes.Length);
        payloadBytes.CopyTo(buffer.AsSpan(13));

        var message = _handler.Parse(buffer);

        Assert.NotNull(message);
        Assert.Equal(MessageType.Auth, message.Type);
    }

    [Fact]
    public void Parse_TooShort_ReturnsNull()
    {
        var buffer = new byte[5]; // Less than header size
        
        var message = _handler.Parse(buffer);
        
        Assert.Null(message);
    }

    [Fact]
    public void Serialize_CorrectHeaderFormat()
    {
        var message = new PingMessage
        {
            Id = "msg-1",
            Timestamp = 1234567890
        };

        var bytes = _handler.Serialize(message);
        var span = bytes.Span;

        Assert.Equal(0x30, span[0]); // PING type code
        Assert.Equal(1234567890, BinaryPrimitives.ReadInt64BigEndian(span[1..9]));
    }
}

public class ProtocolDetectionTests
{
    [Theory]
    [InlineData(0x7B, ProtocolType.Json)]  // '{'
    [InlineData(0x20, ProtocolType.Json)]  // space
    [InlineData(0x01, ProtocolType.Binary)] // AUTH code
    [InlineData(0x30, ProtocolType.Binary)] // PING code
    public void DetectProtocol_FirstByte_CorrectResult(byte firstByte, ProtocolType expected)
    {
        var connection = CreateTestConnection();
        var data = new byte[] { firstByte, 0x00 };

        connection.TestDetectProtocol(data);

        Assert.Equal(expected, connection.Protocol);
    }
}
```

#### Acceptance Criteria

- [ ] All message types have parse tests
- [ ] All message types have serialize tests
- [ ] Round-trip tests pass for all types
- [ ] Edge cases handled (empty, malformed, oversized)
- [ ] Protocol detection tests pass
- [ ] Binary endianness tested

---

## Phase 2 Summary

| ID | Title | Priority | Est (h) | Status |
|----|-------|----------|---------|--------|
| P2-01 | Create WebSocket middleware | P0 | 6 | ⬜ |
| P2-02 | Implement Connection class | P0 | 4 | ⬜ |
| P2-03 | Define message types | P0 | 3 | ⬜ |
| P2-04 | Implement JSON protocol handler | P0 | 4 | ⬜ |
| P2-05 | Implement binary protocol handler | P0 | 6 | ⬜ |
| P2-06 | Implement protocol auto-detection | P0 | 3 | ⬜ |
| P2-07 | Implement heartbeat (ping/pong) | P0 | 3 | ⬜ |
| P2-08 | Add ConnectionManager | P0 | 4 | ⬜ |
| P2-09 | Protocol unit tests | P0 | 6 | ⬜ |
| **Total** | | | **39** | |

**Legend:** ⬜ Not Started | 🔄 In Progress | ✅ Complete

---

## Phase 2 Validation

After completing Phase 2, the following should work:

1. **WebSocket Connection**
   ```bash
   wscat -c ws://localhost:8080/ws
   ```

2. **JSON Protocol Echo**
   ```json
   > {"type":"ping","id":"test-1","timestamp":1234567890}
   < {"type":"pong","id":"resp-1","timestamp":1234567891}
   ```

3. **Binary Protocol Echo**
   - Connect with SDK client
   - Verify binary messages work

4. **Protocol Auto-Detection**
   - First JSON message → JSON mode
   - First binary message → Binary mode
