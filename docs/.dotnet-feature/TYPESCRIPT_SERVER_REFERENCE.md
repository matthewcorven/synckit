# TypeScript Server Implementation Reference

> **Purpose:** Complete trace of the TypeScript reference server implementation for comparison with the C# implementation.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Startup Flow](#startup-flow)
3. [Configuration](#configuration)
4. [WebSocket Lifecycle](#websocket-lifecycle)
5. [Message Protocol](#message-protocol)
6. [Message Handlers](#message-handlers)
7. [Sync Coordinator](#sync-coordinator)
8. [Authentication & Authorization](#authentication--authorization)
9. [Storage Layer](#storage-layer)
10. [Connection Management](#connection-management)
11. [Data Structures](#data-structures)
12. [Error Handling](#error-handling)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TypeScript Server                            │
├─────────────────────────────────────────────────────────────────────┤
│  index.ts (Entry Point)                                             │
│    └─> Hono HTTP Server                                             │
│         ├─> /health (Health Check)                                  │
│         ├─> /auth/* (Auth Routes)                                   │
│         └─> WebSocket Server (/ws)                                  │
├─────────────────────────────────────────────────────────────────────┤
│  WebSocket Layer                                                    │
│    ├─> SyncWebSocketServer (server.ts)                              │
│    │     ├─> Connection lifecycle                                   │
│    │     ├─> Message routing                                        │
│    │     └─> ACK tracking / Delta batching                          │
│    ├─> Connection (connection.ts)                                   │
│    │     ├─> Protocol detection (binary/JSON)                       │
│    │     ├─> Heartbeat management                                   │
│    │     └─> Message send/receive                                   │
│    ├─> ConnectionRegistry (registry.ts)                             │
│    │     └─> Connection tracking by ID/user/client                  │
│    └─> Protocol (protocol.ts)                                       │
│          ├─> Binary wire format                                     │
│          └─> JSON format (legacy)                                   │
├─────────────────────────────────────────────────────────────────────┤
│  Sync Layer                                                         │
│    └─> SyncCoordinator (coordinator.ts)                             │
│          ├─> In-memory document state                               │
│          ├─> Vector clock management                                │
│          ├─> LWW conflict resolution                                │
│          └─> Awareness state tracking                               │
├─────────────────────────────────────────────────────────────────────┤
│  Storage Layer (Optional)                                           │
│    ├─> PostgresAdapter (postgres.ts)                                │
│    │     └─> Document/Delta/Session persistence                     │
│    └─> RedisPubSub (redis.ts)                                       │
│          └─> Multi-server coordination                              │
├─────────────────────────────────────────────────────────────────────┤
│  Auth Layer                                                         │
│    ├─> JWT (jwt.ts)                                                 │
│    │     └─> Token generation/verification                          │
│    └─> RBAC (rbac.ts)                                               │
│          └─> Document permission checks                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Startup Flow

**File:** `src/index.ts`

### Sequence

```
1. Create Hono HTTP app
2. Add middleware (logger, CORS)
3. Mount /auth routes
4. Add /health endpoint
5. Add / info endpoint
6. Initialize PostgreSQL (if configured, non-localhost)
7. Initialize Redis (if configured, non-localhost)
8. Create HTTP server with @hono/node-server
9. Create SyncWebSocketServer with storage/pubsub options
10. Setup graceful shutdown handlers (SIGTERM, SIGINT)
```

### Key Code Patterns

```typescript
// Storage initialization (optional - graceful degradation)
if (config.databaseUrl && !config.databaseUrl.includes('localhost')) {
  storage = new PostgresAdapter({...});
  try {
    await storage.connect();
    storageConnected = true;
  } catch (error) {
    storage = undefined;  // Fall back to memory-only
  }
}

// WebSocket server creation
const wsServer = new SyncWebSocketServer(server, {
  storage: storageConnected ? storage : undefined,
  pubsub: redisConnected ? pubsub : undefined,
});

// Graceful shutdown
const shutdown = async () => {
  await wsServer.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000);  // Force exit after 10s
};
```

---

## Configuration

**File:** `src/config.ts`

### Schema (Zod validation)

| Property | Type | Default | Env Var |
|----------|------|---------|---------|
| `port` | number | 8080 | `PORT` |
| `host` | string | "0.0.0.0" | `HOST` |
| `nodeEnv` | enum | "development" | `NODE_ENV` |
| `databaseUrl` | string | localhost | `DATABASE_URL` |
| `databasePoolMin` | number | 2 | `DB_POOL_MIN` |
| `databasePoolMax` | number | 10 | `DB_POOL_MAX` |
| `redisUrl` | string | localhost | `REDIS_URL` |
| `redisChannelPrefix` | string | "synckit:" | `REDIS_CHANNEL_PREFIX` |
| `jwtSecret` | string | dev-secret | `JWT_SECRET` |
| `jwtExpiresIn` | string | "24h" | `JWT_EXPIRES_IN` |
| `jwtRefreshExpiresIn` | string | "7d" | `JWT_REFRESH_EXPIRES_IN` |
| `wsHeartbeatInterval` | number | 30000 | `WS_HEARTBEAT_INTERVAL` |
| `wsHeartbeatTimeout` | number | 60000 | `WS_HEARTBEAT_TIMEOUT` |
| `wsMaxConnections` | number | 10000 | `WS_MAX_CONNECTIONS` |
| `syncBatchSize` | number | 100 | `SYNC_BATCH_SIZE` |
| `syncBatchDelay` | number | 50 | `SYNC_BATCH_DELAY` |

### Special Behavior

- **Auth bypass:** When `SYNCKIT_AUTH_REQUIRED=false`, connections are auto-authenticated as anonymous admin
- **Storage fallback:** If `DATABASE_URL` contains "localhost", PostgreSQL is not initialized (memory-only mode)
- **Redis fallback:** If `REDIS_URL` contains "localhost", Redis is not initialized (single-server mode)

---

## WebSocket Lifecycle

**File:** `src/websocket/server.ts`

### Connection Establishment

```
Client connects to ws://host:port/ws
        │
        ▼
┌───────────────────────────────────────┐
│ SyncWebSocketServer.handleConnection  │
└───────────────────────────────────────┘
        │
        ├─> Check connection limit (wsMaxConnections)
        │     If exceeded: close(1008, "Server at maximum capacity")
        │
        ├─> Generate connection ID: "conn-{counter}"
        │
        ├─> Create Connection instance
        │     - Wraps ws.WebSocket
        │     - State: CONNECTING
        │
        ├─> Add to ConnectionRegistry
        │
        ├─> Start heartbeat (ping every 30s)
        │
        ├─> Check SYNCKIT_AUTH_REQUIRED
        │     If false:
        │       - State = AUTHENTICATED
        │       - userId = "anonymous"
        │       - tokenPayload.permissions.isAdmin = true
        │       - Link to registry
        │
        └─> Setup event handlers
              ├─> on('message') -> handleMessage()
              └─> on('close') -> handleDisconnect()
```

### Message Reception Flow

```
WebSocket receives data
        │
        ▼
┌───────────────────────────────┐
│ Connection.handleMessage()    │
└───────────────────────────────┘
        │
        ├─> Detect protocol (first message)
        │     - If string: JSON protocol
        │     - If Buffer: Binary protocol
        │
        ├─> Parse message: parseMessage(data)
        │     - Binary: parseBinaryMessage()
        │     - JSON: parseJsonMessage()
        │
        ├─> Validate message structure
        │     - Must have: type, id, timestamp
        │
        ├─> Handle PING internally
        │     - Send PONG response
        │
        └─> Emit 'message' event to server
              │
              ▼
        ┌───────────────────────────┐
        │ SyncWebSocketServer       │
        │   .handleMessage()        │
        └───────────────────────────┘
              │
              └─> Route by message.type
                    - AUTH -> handleAuth()
                    - SUBSCRIBE -> handleSubscribe()
                    - DELTA -> handleDelta()
                    - etc.
```

### Connection Teardown

```
Client disconnects or error
        │
        ▼
┌───────────────────────────────┐
│ SyncWebSocketServer           │
│   .handleDisconnect()         │
└───────────────────────────────┘
        │
        ├─> Get all document subscriptions
        │     for each documentId:
        │       coordinator.unsubscribe(documentId, connectionId)
        │
        ├─> Clean awareness subscriptions
        │     for each documentId with awareness:
        │       coordinator.unsubscribeFromAwareness(documentId, connectionId)
        │
        ├─> Clean pending ACKs
        │     for each pendingAck where targetConnectionId == connectionId:
        │       clearTimeout(ack.timeout)
        │       pendingAcks.delete(key)
        │
        └─> ConnectionRegistry removes connection (via close event)
```

---

## Message Protocol

**File:** `src/websocket/protocol.ts`

### Binary Wire Format

```
┌─────────────┬──────────────┬───────────────┬──────────────┐
│ Type (1B)   │ Timestamp    │ Payload Len   │ Payload      │
│ uint8       │ int64 BE     │ uint32 BE     │ JSON UTF-8   │
└─────────────┴──────────────┴───────────────┴──────────────┘
  Byte 0       Bytes 1-8      Bytes 9-12      Bytes 13+
```

### Type Codes

| Code | MessageType | Purpose |
|------|-------------|---------|
| 0x01 | AUTH | Client authentication request |
| 0x02 | AUTH_SUCCESS | Server auth success response |
| 0x03 | AUTH_ERROR | Server auth failure response |
| 0x10 | SUBSCRIBE | Subscribe to document |
| 0x11 | UNSUBSCRIBE | Unsubscribe from document |
| 0x12 | SYNC_REQUEST | Request document state |
| 0x13 | SYNC_RESPONSE | Server sends document state |
| 0x20 | DELTA | Document change |
| 0x21 | ACK | Message acknowledgment |
| 0x30 | PING | Keepalive ping |
| 0x31 | PONG | Keepalive pong |
| 0x40 | AWARENESS_UPDATE | Presence update |
| 0x41 | AWARENESS_SUBSCRIBE | Subscribe to awareness |
| 0x42 | AWARENESS_STATE | Full awareness state |
| 0xFF | ERROR | Error response |

### Message Type String Names

```typescript
enum MessageType {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  PING = 'ping',
  PONG = 'pong',
  AUTH = 'auth',
  AUTH_SUCCESS = 'auth_success',
  AUTH_ERROR = 'auth_error',
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  SYNC_REQUEST = 'sync_request',
  SYNC_RESPONSE = 'sync_response',
  DELTA = 'delta',
  ACK = 'ack',
  AWARENESS_UPDATE = 'awareness_update',
  AWARENESS_SUBSCRIBE = 'awareness_subscribe',
  AWARENESS_STATE = 'awareness_state',
  ERROR = 'error',
}
```

### Protocol Detection Logic

```typescript
// In Connection.handleMessage()
if (typeof data === 'string' && this.protocolType === 'binary') {
  this.protocolType = 'json';  // Switch to JSON if string received
}

// In parseBinaryMessage()
// First byte determines type code
const typeCode = data.readUInt8(0);
const type = TYPE_CODE_TO_NAME[typeCode];
```

### Binary Parsing

```typescript
function parseBinaryMessage(data: Buffer): Message | null {
  // Minimum size check: 13 bytes header
  if (data.length < 13) return null;

  // Read header (big-endian)
  const typeCode = data.readUInt8(0);
  const timestamp = Number(data.readBigInt64BE(1));
  const payloadLength = data.readUInt32BE(9);

  // Validate payload length
  if (data.length < 13 + payloadLength) return null;

  // Read payload
  const payloadBytes = data.subarray(13, 13 + payloadLength);
  const payloadJson = payloadBytes.toString('utf8');
  const payload = JSON.parse(payloadJson);

  // Get message type name
  const type = TYPE_CODE_TO_NAME[typeCode];

  // Construct message (exclude 'type' from payload)
  const { type: _payloadType, ...payloadWithoutType } = payload;
  return {
    type,
    id: payload.id || createMessageId(),
    timestamp,
    ...payloadWithoutType,
  };
}
```

### Binary Serialization

```typescript
function serializeBinaryMessage(message: Message): Buffer {
  const typeCode = TYPE_NAME_TO_CODE[message.type];
  
  // Create payload (exclude type, it's in header)
  const { type, timestamp, ...payloadData } = message;
  const payloadJson = JSON.stringify(payloadData);
  const payloadBytes = Buffer.from(payloadJson, 'utf8');

  // Allocate buffer: 13 bytes header + payload
  const buffer = Buffer.allocUnsafe(13 + payloadBytes.length);

  // Write header (big-endian)
  buffer.writeUInt8(typeCode, 0);
  buffer.writeBigInt64BE(BigInt(timestamp), 1);
  buffer.writeUInt32BE(payloadBytes.length, 9);

  // Write payload
  payloadBytes.copy(buffer, 13);

  return buffer;
}
```

---

## Message Handlers

**File:** `src/websocket/server.ts`

### AUTH Handler

```typescript
async handleAuth(connection: Connection, message: AuthMessage) {
  // 1. Verify JWT token (if provided)
  if (message.token) {
    const decoded = await verifyToken(message.token);
    if (!decoded) throw new Error('Invalid token');
    userId = decoded.userId;
    tokenPayload = decoded;
  } else if (message.apiKey) {
    // API key auth not implemented
  } else {
    // Anonymous with admin permissions (test mode)
    userId = 'anonymous';
    tokenPayload = { userId: 'anonymous', permissions: { isAdmin: true, ... } };
  }

  // 2. Update connection state
  connection.state = ConnectionState.AUTHENTICATED;
  connection.userId = userId;
  connection.tokenPayload = tokenPayload;

  // 3. Link to registry
  registry.linkUser(connection.id, userId);

  // 4. Send success response
  connection.send({
    type: MessageType.AUTH_SUCCESS,
    id: createMessageId(),
    timestamp: Date.now(),
    userId,
    permissions: tokenPayload.permissions,
  });
}
```

### SUBSCRIBE Handler

```typescript
async handleSubscribe(connection: Connection, message: SubscribeMessage) {
  const { documentId } = message;

  // 1. Check authentication
  if (connection.state !== ConnectionState.AUTHENTICATED) {
    connection.sendError('Not authenticated');
    return;
  }

  // 2. Check read permission
  if (!canReadDocument(connection.tokenPayload, documentId)) {
    connection.sendError('Permission denied', { documentId });
    return;
  }

  // 3. Load document from storage (if available)
  await coordinator.getDocument(documentId);

  // 4. Subscribe connection to document updates
  coordinator.subscribe(documentId, connection.id);
  connection.addSubscription(documentId);

  // 5. Get current state and vector clock
  const state = coordinator.getDocumentState(documentId);
  const vectorClock = coordinator.getVectorClock(documentId);

  // 6. Send sync response
  connection.send({
    type: MessageType.SYNC_RESPONSE,
    id: createMessageId(),
    timestamp: Date.now(),
    requestId: message.id,
    documentId,
    state,
    deltas: [],
    clock: vectorClock,  // SDK uses 'clock' not 'vectorClock'
  });
}
```

### DELTA Handler (Most Complex)

```typescript
async handleDelta(connection: Connection, message: DeltaMessage) {
  const { documentId } = message;

  // 1. Normalize payload (SDK vs server format)
  let delta = message.delta;
  let vectorClock = message.vectorClock;

  // Handle SDK field/value format
  if (!delta && message.field !== undefined) {
    delta = { [message.field]: message.value };
  }

  // Handle clock vs vectorClock naming
  if (!vectorClock && message.clock) {
    vectorClock = message.clock;
  }

  // 2. Validate delta
  if (!delta || Object.keys(delta).length === 0) {
    connection.sendError('Invalid delta message');
    return;
  }

  // 3. Check authentication
  if (connection.state !== ConnectionState.AUTHENTICATED) {
    connection.sendError('Not authenticated');
    return;
  }

  // 4. Check write permission
  if (!canWriteDocument(connection.tokenPayload, documentId)) {
    connection.sendError('Permission denied', { documentId });
    return;
  }

  // 5. Ensure document loaded
  await coordinator.getDocument(documentId);

  // 6. Auto-subscribe to document
  coordinator.subscribe(documentId, connection.id);
  connection.addSubscription(documentId);

  // 7. Apply delta changes with LWW conflict resolution
  const clientId = connection.clientId || connection.id;
  const authoritativeDelta: Record<string, any> = {};

  for (const [field, value] of Object.entries(delta)) {
    const isTombstone = value?.__deleted === true;

    if (isTombstone) {
      // Delete operation
      const result = await coordinator.deleteField(documentId, field, clientId, message.timestamp);
      authoritativeDelta[field] = result === null ? { __deleted: true } : result;
    } else {
      // Set operation
      const result = await coordinator.setField(documentId, field, value, clientId, message.timestamp);
      authoritativeDelta[field] = result;
    }
  }

  // 8. Merge vector clock
  coordinator.mergeVectorClock(documentId, vectorClock);

  // 9. Add to batch (coalesce rapid updates)
  addToBatch(documentId, authoritativeDelta);

  // 10. Send ACK to sender
  const originalMessageId = message.messageId || message.id;
  connection.send({
    type: MessageType.ACK,
    id: createMessageId(),
    timestamp: Date.now(),
    messageId: originalMessageId,
  });
}
```

### Delta Batching

```typescript
// Constants
const BATCH_INTERVAL = 50; // 50ms batching window

// Add delta to batch
private addToBatch(documentId: string, delta: Record<string, any>) {
  let batch = pendingBatches.get(documentId);

  if (!batch) {
    batch = {
      delta: {},
      timer: setTimeout(() => flushBatch(documentId), BATCH_INTERVAL),
    };
    pendingBatches.set(documentId, batch);
  }

  // Merge delta into batch (later updates override earlier ones)
  Object.assign(batch.delta, delta);
}

// Flush batched deltas
private flushBatch(documentId: string) {
  const batch = pendingBatches.get(documentId);
  if (!batch) return;

  clearTimeout(batch.timer);
  pendingBatches.delete(documentId);

  if (Object.keys(batch.delta).length > 0) {
    const vectorClock = coordinator.getVectorClock(documentId);

    // Send individual field updates (SDK format)
    for (const [field, value] of Object.entries(batch.delta)) {
      const subscribers = coordinator.getSubscribers(documentId);

      for (const connectionId of subscribers) {
        const connection = registry.get(connectionId);
        if (!connection || connection.state !== ConnectionState.AUTHENTICATED) continue;

        connection.send({
          type: MessageType.DELTA,
          id: createMessageId(),
          timestamp: Date.now(),
          documentId,
          field,
          value,
          clock: vectorClock,
          clientId: 'server',
        });
      }
    }
  }
}
```

### ACK Handler

```typescript
private handleAck(connection: Connection, message: AckMessage) {
  const { messageId } = message;

  // Construct ack key (connectionId + messageId)
  const ackKey = `${connection.id}-${messageId}`;

  const pendingAck = pendingAcks.get(ackKey);
  if (!pendingAck) return;  // Already acknowledged

  // Verify ACK from correct client
  if (pendingAck.targetConnectionId !== connection.id) {
    console.warn(`ACK from wrong client`);
    return;
  }

  // Clear timeout and remove from pending
  clearTimeout(pendingAck.timeout);
  pendingAcks.delete(ackKey);
}
```

### AWARENESS_SUBSCRIBE Handler

```typescript
async handleAwarenessSubscribe(connection: Connection, message: AwarenessSubscribeMessage) {
  const { documentId } = message;

  // 1. Subscribe to awareness updates
  coordinator.subscribeToAwareness(documentId, connection.id);

  // 2. Get current awareness states
  const awarenessStates = coordinator.getAwarenessStates(documentId);

  // 3. Send current state to client
  connection.send({
    type: MessageType.AWARENESS_STATE,
    id: createMessageId(),
    timestamp: Date.now(),
    documentId,
    states: awarenessStates.map(client => ({
      clientId: client.clientId,
      state: client.state,
      clock: client.clock,
    })),
  });
}
```

### AWARENESS_UPDATE Handler

```typescript
async handleAwarenessUpdate(connection: Connection, message: AwarenessUpdateMessage) {
  const { documentId, clientId, state, clock } = message;

  // 1. Update awareness state in coordinator
  coordinator.setAwarenessState(documentId, clientId, state, clock);

  // 2. Broadcast to all awareness subscribers (including sender)
  const subscribers = coordinator.getAwarenessSubscribers(documentId);

  const updateMessage = {
    type: MessageType.AWARENESS_UPDATE,
    id: createMessageId(),
    timestamp: Date.now(),
    documentId,
    clientId,
    state,
    clock,
  };

  for (const connectionId of subscribers) {
    const targetConnection = registry.get(connectionId);
    if (targetConnection?.state === ConnectionState.AUTHENTICATED) {
      targetConnection.send(updateMessage);
    }
  }
}
```

---

## Sync Coordinator

**File:** `src/sync/coordinator.ts`

### Data Structures

```typescript
interface DocumentState {
  documentId: string;
  wasmDoc: WasmDocument;      // Mock object in test mode
  vectorClock: WasmVectorClock; // Mock object in test mode
  subscribers: Set<string>;   // Connection IDs
  lastModified: number;
}

interface AwarenessClient {
  clientId: string;
  state: Record<string, unknown> | null;
  clock: number;
  lastUpdated: number;
}

interface AwarenessDocumentState {
  documentId: string;
  clients: Map<string, AwarenessClient>;
  subscribers: Set<string>;
}
```

### Document Management

```typescript
class SyncCoordinator {
  private documents: Map<string, DocumentState> = new Map();
  private awarenessStates: Map<string, AwarenessDocumentState> = new Map();
  private storage?: StorageAdapter;
  private pubsub?: RedisPubSub;
  private serverId: string;

  // Get or create document (with storage loading)
  async getDocument(documentId: string): Promise<DocumentState> {
    let state = documents.get(documentId);

    if (!state) {
      // Try load from storage
      if (storage) {
        const stored = await storage.getDocument(documentId);
        if (stored) {
          // Restore from storage
          state = createDocumentFromStorage(stored);
          documents.set(documentId, state);
          return state;
        }
      }

      // Create new document
      state = getDocumentSync(documentId);
    }

    return state;
  }

  // Sync version (creates mock WASM objects)
  getDocumentSync(documentId: string): DocumentState {
    let state = documents.get(documentId);

    if (!state) {
      state = {
        documentId,
        wasmDoc: createMockWasmDoc(documentId),
        vectorClock: createMockVectorClock(),
        subscribers: new Set(),
        lastModified: Date.now(),
      };
      documents.set(documentId, state);
    }

    return state;
  }
}
```

### LWW Conflict Resolution (setField)

```typescript
async setField(
  documentId: string,
  path: string,
  value: any,
  clientId: string,
  timestamp?: number
): Promise<any> {
  const state = getDocumentSync(documentId);

  // Increment vector clock for this client
  state.vectorClock.tick(clientId);
  const newClock = state.vectorClock.get(clientId);

  const writeTimestamp = timestamp || Date.now();

  // Apply with LWW conflict resolution in mock wasmDoc
  state.wasmDoc.setField(path, JSON.stringify(value), newClock, clientId);
  state.lastModified = writeTimestamp;

  // Get authoritative value after LWW
  const fieldValue = state.wasmDoc.getField(path);
  const authoritativeValue = fieldValue ? JSON.parse(fieldValue) : value;

  // Persist to storage (if available)
  if (storage) {
    await storage.saveDocument(documentId, JSON.parse(state.wasmDoc.toJSON()));
    await storage.updateVectorClock(documentId, clientId, newClock);
    await storage.saveDelta({ documentId, clientId, operationType: 'set', fieldPath: path, value: authoritativeValue, clockValue: newClock });
  }

  return authoritativeValue;
}
```

### Mock WasmDoc LWW Implementation

```typescript
const mockWasmDoc = {
  documentId,
  fields: new Map<string, any>(),

  setField(path: string, valueJson: string, clock: bigint, clientId: string, timestamp?: number): any {
    const value = JSON.parse(valueJson);
    const writeTimestamp = timestamp || Date.now();
    const existing = this.fields.get(path);

    if (existing) {
      // Multi-level LWW comparison:
      // 1. Timestamp (wall-clock) - later writes win
      // 2. Vector clock counter - higher counter wins (same timestamp)
      // 3. ClientId (lexicographic) - deterministic tiebreaker
      const timestampWins = writeTimestamp > (existing.timestamp || 0);
      const timestampTie = writeTimestamp === (existing.timestamp || 0);
      const clockWins = clock > (existing.clock || 0n);
      const clockTie = clock === (existing.clock || 0n);

      if (timestampWins ||
          (timestampTie && clockWins) ||
          (timestampTie && clockTie && clientId > existing.clientId)) {
        this.fields.set(path, { value, clock, clientId, timestamp: writeTimestamp });
        return value;
      }
      return existing.value;  // Existing wins
    } else {
      this.fields.set(path, { value, clock, clientId, timestamp: writeTimestamp });
      return value;
    }
  },

  getField(path: string): string | null {
    const field = this.fields.get(path);
    return field ? JSON.stringify(field.value) : null;
  },

  toJSON(): string {
    const obj: any = {};
    for (const [key, field] of this.fields.entries()) {
      obj[key] = field.value;
    }
    return JSON.stringify({ id: this.documentId, fields: obj });
  },
};
```

### Mock VectorClock Implementation

```typescript
const mockVectorClock = {
  clocks: new Map<string, bigint>(),

  tick(clientId: string): bigint {
    const current = this.clocks.get(clientId) || 0n;
    const next = current + 1n;
    this.clocks.set(clientId, next);
    return next;
  },

  get(clientId: string): bigint {
    return this.clocks.get(clientId) || 0n;
  },

  update(clientId: string, value: bigint) {
    const current = this.clocks.get(clientId) || 0n;
    if (value > current) {
      this.clocks.set(clientId, value);
    }
  },

  toJSON(): string {
    const obj: any = {};
    for (const [key, value] of this.clocks.entries()) {
      obj[key] = Number(value);
    }
    return JSON.stringify(obj);
  },
};
```

### Subscription Management

```typescript
// Subscribe connection to document
subscribe(documentId: string, connectionId: string) {
  const state = getDocumentSync(documentId);
  state.subscribers.add(connectionId);
}

// Unsubscribe connection
unsubscribe(documentId: string, connectionId: string) {
  const state = documents.get(documentId);
  if (state) {
    state.subscribers.delete(connectionId);
  }
}

// Get subscribers
getSubscribers(documentId: string): string[] {
  const state = documents.get(documentId);
  return state ? Array.from(state.subscribers) : [];
}
```

### Awareness Management

```typescript
setAwarenessState(documentId: string, clientId: string, state: Record<string, unknown> | null, clock: number) {
  const awarenessState = getAwarenessState(documentId);

  if (state === null) {
    awarenessState.clients.delete(clientId);  // Client leaving
  } else {
    awarenessState.clients.set(clientId, {
      clientId,
      state,
      clock,
      lastUpdated: Date.now(),
    });
  }
}

getAwarenessStates(documentId: string): AwarenessClient[] {
  const awarenessState = awarenessStates.get(documentId);
  return awarenessState ? Array.from(awarenessState.clients.values()) : [];
}

removeStaleAwarenessClients(documentId: string, timeoutMs: number = 30000): string[] {
  const awarenessState = awarenessStates.get(documentId);
  if (!awarenessState) return [];

  const now = Date.now();
  const removedClients: string[] = [];

  for (const [clientId, client] of awarenessState.clients.entries()) {
    if (now - client.lastUpdated > timeoutMs) {
      awarenessState.clients.delete(clientId);
      removedClients.push(clientId);
    }
  }

  return removedClients;
}
```

---

## Authentication & Authorization

### JWT Structure

**File:** `src/auth/jwt.ts`

```typescript
interface TokenPayload {
  userId: string;
  email?: string;
  permissions: DocumentPermissions;
  iat?: number;  // Issued at
  exp?: number;  // Expiration
}

interface DocumentPermissions {
  canRead: string[];   // Document IDs
  canWrite: string[];  // Document IDs
  isAdmin: boolean;    // Access to all documents
}
```

### Token Operations

```typescript
// Generate access token
function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,  // Default: 24h
  });
}

// Generate refresh token
function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId }, config.jwtSecret, {
    expiresIn: config.jwtRefreshExpiresIn,  // Default: 7d
  });
}

// Verify token
function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as TokenPayload;
  } catch (error) {
    return null;
  }
}
```

### RBAC Checks

**File:** `src/auth/rbac.ts`

```typescript
function canReadDocument(payload: TokenPayload, documentId: string): boolean {
  if (payload.permissions.isAdmin) return true;
  return payload.permissions.canRead.includes(documentId);
}

function canWriteDocument(payload: TokenPayload, documentId: string): boolean {
  if (payload.permissions.isAdmin) return true;
  return payload.permissions.canWrite.includes(documentId);
}
```

### Auth Bypass Mode

When `SYNCKIT_AUTH_REQUIRED=false`:

```typescript
// In handleConnection()
if (!authRequired) {
  connection.state = ConnectionState.AUTHENTICATED;
  connection.userId = 'anonymous';
  connection.tokenPayload = {
    userId: 'anonymous',
    permissions: {
      canRead: [],
      canWrite: [],
      isAdmin: true,  // Full access
    },
  };
  registry.linkUser(connection.id, 'anonymous');
}
```

---

## Storage Layer

### Interface

**File:** `src/storage/interface.ts`

```typescript
interface StorageAdapter {
  // Connection lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  healthCheck(): Promise<boolean>;

  // Document operations
  getDocument(id: string): Promise<DocumentState | null>;
  saveDocument(id: string, state: any): Promise<DocumentState>;
  updateDocument(id: string, state: any): Promise<DocumentState>;
  deleteDocument(id: string): Promise<boolean>;
  listDocuments(limit?: number, offset?: number): Promise<DocumentState[]>;

  // Vector clock operations
  getVectorClock(documentId: string): Promise<Record<string, bigint>>;
  updateVectorClock(documentId: string, clientId: string, clockValue: bigint): Promise<void>;
  mergeVectorClock(documentId: string, clock: Record<string, bigint>): Promise<void>;

  // Delta operations (audit trail)
  saveDelta(delta: DeltaEntry): Promise<DeltaEntry>;
  getDeltas(documentId: string, limit?: number): Promise<DeltaEntry[]>;

  // Session operations
  saveSession(session: SessionEntry): Promise<SessionEntry>;
  updateSession(sessionId: string, lastSeen: Date, metadata?: Record<string, any>): Promise<void>;
  deleteSession(sessionId: string): Promise<boolean>;
  getSessions(userId: string): Promise<SessionEntry[]>;

  // Maintenance
  cleanup(options?: { oldSessionsHours?: number; oldDeltasDays?: number }): Promise<{ sessionsDeleted: number; deltasDeleted: number }>;
}
```

### PostgreSQL Implementation

**File:** `src/storage/postgres.ts`

- Uses `pg.Pool` for connection pooling
- UPSERT pattern for saveDocument: `ON CONFLICT (id) DO UPDATE`
- GREATEST for vector clock merge: `GREATEST(vector_clocks.clock_value, $3)`
- Transaction support for atomic operations

### Redis PubSub

**File:** `src/storage/redis.ts`

```typescript
class RedisPubSub {
  private publisher: Redis;    // For publishing
  private subscriber: Redis;   // For subscribing (separate connection)
  private handlers: Map<string, Set<(message: any) => void>>;

  // Channel naming
  getDocumentChannel(documentId: string): string {
    return `${channelPrefix}doc:${documentId}`;
  }

  getBroadcastChannel(): string {
    return `${channelPrefix}broadcast`;
  }

  getPresenceChannel(): string {
    return `${channelPrefix}presence`;
  }

  // Operations
  async publishDelta(documentId: string, delta: Message): Promise<void>;
  async subscribeToDocument(documentId: string, handler: (delta: Message) => void): Promise<void>;
  async announcePresence(serverId: string, metadata: any): Promise<void>;
  async announceShutdown(serverId: string): Promise<void>;
}
```

---

## Connection Management

**File:** `src/websocket/connection.ts`

### Connection State

```typescript
enum ConnectionState {
  CONNECTING = 'connecting',
  AUTHENTICATING = 'authenticating',
  AUTHENTICATED = 'authenticated',
  DISCONNECTING = 'disconnecting',
  DISCONNECTED = 'disconnected',
}
```

### Connection Class

```typescript
class Connection {
  public readonly id: string;
  public state: ConnectionState;
  public userId?: string;
  public clientId?: string;
  public tokenPayload?: TokenPayload;
  public protocolType: 'binary' | 'json' = 'binary';

  private ws: WebSocket;
  private heartbeatInterval?: Timer;
  private isAlive: boolean = true;
  private subscribedDocuments: Set<string> = new Set();
  private handlers: Map<string, Function[]> = new Map();

  // Message handling
  private handleMessage(data: Buffer | string) {
    // Detect protocol from first message
    if (typeof data === 'string' && this.protocolType === 'binary') {
      this.protocolType = 'json';
    }

    const message = parseMessage(data);
    if (!message) {
      this.sendError('Invalid message format');
      return;
    }

    this.emit('message', message);

    // Handle PING internally
    if (message.type === MessageType.PING) {
      this.sendPong(message.id);
    }
  }

  // Sending
  send(message: Message): boolean {
    if (this.ws.readyState !== 1) return false;  // 1 = OPEN

    const useBinary = this.protocolType === 'binary';
    const data = serializeMessage(message, useBinary);
    this.ws.send(data);
    return true;
  }

  // Heartbeat
  startHeartbeat(intervalMs: number = 30000) {
    this.heartbeatInterval = setInterval(() => {
      if (!this.isAlive) {
        return this.terminate();
      }
      this.isAlive = false;
      this.ws.ping();
    }, intervalMs);
  }

  private handlePong() {
    this.isAlive = true;
  }

  // Subscriptions
  addSubscription(documentId: string) {
    this.subscribedDocuments.add(documentId);
  }

  getSubscriptions(): string[] {
    return Array.from(this.subscribedDocuments);
  }
}
```

### Connection Registry

**File:** `src/websocket/registry.ts`

```typescript
class ConnectionRegistry {
  private connections: Map<string, Connection> = new Map();
  private userConnections: Map<string, Set<string>> = new Map();  // userId -> connectionIds
  private clientConnections: Map<string, string> = new Map();      // clientId -> connectionId

  add(connection: Connection) {
    this.connections.set(connection.id, connection);
    connection.on('close', () => this.remove(connection.id));
  }

  remove(connectionId: string) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove from user connections
    if (connection.userId) {
      const userConns = this.userConnections.get(connection.userId);
      if (userConns) {
        userConns.delete(connectionId);
        if (userConns.size === 0) this.userConnections.delete(connection.userId);
      }
    }

    // Remove from client connections
    if (connection.clientId) {
      this.clientConnections.delete(connection.clientId);
    }

    this.connections.delete(connectionId);
  }

  get(connectionId: string): Connection | undefined {
    return this.connections.get(connectionId);
  }

  linkUser(connectionId: string, userId: string) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.userId = userId;
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connectionId);
  }

  count(): number {
    return this.connections.size;
  }

  getMetrics() {
    return {
      totalConnections: this.connections.size,
      totalUsers: this.userConnections.size,
      totalClients: this.clientConnections.size,
    };
  }
}
```

---

## Data Structures

### In-Memory Document State

```typescript
// Document state in SyncCoordinator
Map<documentId, {
  documentId: string,
  wasmDoc: {
    fields: Map<path, { value, clock, clientId, timestamp }>,
    setField(path, valueJson, clock, clientId, timestamp): value,
    getField(path): json | null,
    toJSON(): json,
  },
  vectorClock: {
    clocks: Map<clientId, bigint>,
    tick(clientId): newValue,
    get(clientId): value,
    update(clientId, value): void,
    toJSON(): json,
  },
  subscribers: Set<connectionId>,
  lastModified: timestamp,
}>
```

### Awareness State

```typescript
// Awareness state in SyncCoordinator
Map<documentId, {
  documentId: string,
  clients: Map<clientId, {
    clientId: string,
    state: Record<string, unknown> | null,
    clock: number,
    lastUpdated: timestamp,
  }>,
  subscribers: Set<connectionId>,
}>
```

### Pending ACKs

```typescript
// In SyncWebSocketServer
Map<`${connectionId}-${messageId}`, {
  messageId: string,
  documentId: string,
  message: DeltaMessage,
  targetConnectionId: string,
  attempts: number,
  timeout: NodeJS.Timeout,
  sentAt: timestamp,
}>
```

### Pending Batches

```typescript
// In SyncWebSocketServer
Map<documentId, {
  delta: Record<field, value>,  // Merged deltas
  timer: NodeJS.Timeout,        // Flush timer (50ms)
}>
```

---

## Error Handling

### Connection Errors

```typescript
// Invalid message format
connection.sendError('Invalid message format');

// Not authenticated
connection.sendError('Not authenticated');

// Permission denied
connection.sendError('Permission denied', { documentId });

// Operation failed
connection.sendError('Subscribe failed', { documentId });
connection.sendError('Delta application failed', { documentId });
```

### Error Message Format

```typescript
sendError(error: string, details?: any) {
  this.send({
    type: MessageType.ERROR,
    id: createMessageId(),
    timestamp: Date.now(),
    error,
    details,
  });
}
```

### Storage Errors

```typescript
class StorageError extends Error {
  constructor(message: string, public code?: string, public cause?: Error) {
    super(message);
    this.name = 'StorageError';
  }
}

class ConnectionError extends StorageError { code = 'CONNECTION_ERROR'; }
class QueryError extends StorageError { code = 'QUERY_ERROR'; }
class NotFoundError extends StorageError { code = 'NOT_FOUND'; }
class ConflictError extends StorageError { code = 'CONFLICT'; }
```

---

## Health Check Endpoint

```typescript
app.get('/health', (c) => {
  const stats = wsServer?.getStats();

  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    uptime: process.uptime(),
    connections: stats?.connections || { totalConnections: 0, totalUsers: 0, totalClients: 0 },
    documents: stats?.documents || { totalDocuments: 0, documents: [] },
  });
});
```

---

## Graceful Shutdown

```typescript
const shutdown = async () => {
  console.log('Shutdown signal received...');

  // Close WebSocket server
  await wsServer.close();
  // - Stops awareness cleanup timer
  // - Closes all connections with code 1001
  // - Disposes coordinator resources
  // - Closes WebSocketServer

  // Close HTTP server
  server.close(() => process.exit(0));

  // Force exit after 10s
  setTimeout(() => process.exit(1), 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

---

## Key Behavioral Notes for C# Comparison

1. **Protocol Detection:** First message determines protocol (binary vs JSON) for entire connection
2. **Auth Bypass:** `SYNCKIT_AUTH_REQUIRED=false` auto-authenticates with admin permissions
3. **Auto-Subscribe:** Delta handler auto-subscribes sender to document
4. **Delta Format Normalization:** Handles both SDK `field/value` format and server `delta` object format
5. **Batching:** Deltas are batched for 50ms before broadcast to reduce message volume
6. **LWW Resolution:** 3-level tiebreaker: timestamp > vector clock counter > clientId (lexicographic)
7. **ACK Tracking:** Uses `${connectionId}-${messageId}` as key for pending ACKs
8. **Awareness Cleanup:** Runs every 30s, removes clients not updated in 30s
9. **Subscriber Broadcast:** Broadcasts to ALL subscribers including sender (for convergence)
10. **Error Responses:** Always include `error` string, optionally `details` object

---

## Performance-Relevant Patterns

| Pattern | TypeScript Implementation | Notes |
|---------|--------------------------|-------|
| **Message Parsing** | `JSON.parse()` on UTF-8 string | V8 JIT optimizes hot paths |
| **Message Serialization** | `JSON.stringify()` + `Buffer.from()` | Single allocation per message |
| **Broadcast** | Sequential `for...of` with individual `send()` | No parallel broadcast |
| **Delta Batching** | 50ms window with `setTimeout` | Coalesces rapid updates |
| **Document Storage** | `Map<string, DocumentState>` | O(1) lookup |
| **Subscriber Tracking** | `Set<string>` per document | O(1) membership check |
| **Vector Clock** | `Map<string, bigint>` | Uses BigInt for precision |
| **LWW Comparison** | Inline in setField() | No separate function call |
