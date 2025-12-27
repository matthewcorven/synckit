# Storage Layer Documentation

## Overview

The storage layer provides production-ready data persistence and multi-server coordination for SyncKit. It consists of:

1. **PostgreSQL** - Durable document and vector clock persistence
2. **Redis Pub/Sub** - Real-time coordination across server instances
3. **Storage Interface** - Abstract API for swappable storage backends

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    SyncCoordinator                      │
│  (In-Memory State + WASM Documents + Vector Clocks)     │
└────────────┬────────────────────────────┬───────────────┘
             │                            │
             │ Persists                   │ Broadcasts
             │                            │
     ┌───────▼────────┐          ┌────────▼─────────┐
     │   PostgreSQL   │          │  Redis Pub/Sub   │
     │   (Storage)    │          │ (Coordination)   │
     └────────────────┘          └──────────────────┘
          • Documents                 • Delta events
          • Vector Clocks             • Server presence
          • Deltas (audit)            • Cross-server sync
          • Sessions (optional)
```

---

## Quick Start

Migrations are provided in `src/storage/migrations/` and are applied by the migration runner (`src/storage/migrate.ts`).

You can check migration status or apply them manually:

```bash
# Apply migrations
bun run db:migrate

# Check schema status (returns exit code 0 if schema present)
bun run db:migrate:status
```

### 1. Setup Database

```bash
# Create PostgreSQL database
createdb synckit

# Set environment variables
export DATABASE_URL="postgresql://localhost:5432/synckit"
export REDIS_URL="redis://localhost:6379"

# Run migrations
bun run db:migrate
```

### 2. Initialize Storage in Code

```typescript
import { PostgresAdapter } from './storage/postgres';
import { RedisPubSub } from './storage/redis';
import { SyncCoordinator } from './sync/coordinator';

// Create storage adapter
const storage = new PostgresAdapter({
  connectionString: process.env.DATABASE_URL,
  poolMin: 2,
  poolMax: 10,
});

// Create Redis pub/sub
const pubsub = new RedisPubSub(
  process.env.REDIS_URL,
  'synckit:' // channel prefix
);

// Connect
await storage.connect();
await pubsub.connect();

// Initialize coordinator with persistence
const coordinator = new SyncCoordinator({
  storage,
  pubsub,
  serverId: 'server-1',
});
```

---

## Database Schema

### Tables

#### `documents`
Stores document states with JSONB for flexible schema.

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(255) PRIMARY KEY | Document ID |
| state | JSONB | Document state (fields) |
| version | BIGINT | Monotonic version number |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update time |

#### `vector_clocks`
Tracks vector clock values for causality.

| Column | Type | Description |
|--------|------|-------------|
| document_id | VARCHAR(255) | Foreign key to documents |
| client_id | VARCHAR(255) | Client identifier |
| clock_value | BIGINT | Lamport timestamp |
| updated_at | TIMESTAMP | Last update |

PRIMARY KEY: (document_id, client_id)

#### `deltas` (Optional - Audit Trail)
Stores operation history for debugging and replication.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PRIMARY KEY | Delta ID |
| document_id | VARCHAR(255) | Document being modified |
| client_id | VARCHAR(255) | Client making change |
| operation_type | VARCHAR(50) | 'set', 'delete', or 'merge' |
| field_path | VARCHAR(500) | Path to field |
| value | JSONB | Field value |
| clock_value | BIGINT | Vector clock at operation |
| timestamp | TIMESTAMP | When operation occurred |

#### `sessions` (Optional - Connection Tracking)
Tracks active WebSocket sessions.

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(255) PRIMARY KEY | Session ID |
| user_id | VARCHAR(255) | User identifier |
| client_id | VARCHAR(255) | Client identifier |
| connected_at | TIMESTAMP | Connection time |
| last_seen | TIMESTAMP | Last activity |
| metadata | JSONB | Custom metadata |

### Views

#### `documents_with_clocks`
Convenient view joining documents with their vector clocks.

---

## Storage Interface

### Core Operations

```typescript
interface StorageAdapter {
  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  healthCheck(): Promise<boolean>;

  // Documents
  getDocument(id: string): Promise<DocumentState | null>;
  saveDocument(id: string, state: any): Promise<DocumentState>;
  updateDocument(id: string, state: any): Promise<DocumentState>;
  deleteDocument(id: string): Promise<boolean>;
  listDocuments(limit?: number, offset?: number): Promise<DocumentState[]>;

  // Vector Clocks
  getVectorClock(documentId: string): Promise<Record<string, bigint>>;
  updateVectorClock(documentId: string, clientId: string, clockValue: bigint): Promise<void>;
  mergeVectorClock(documentId: string, clock: Record<string, bigint>): Promise<void>;

  // Deltas (Audit)
  saveDelta(delta: Omit<DeltaEntry, 'id' | 'timestamp'>): Promise<DeltaEntry>;
  getDeltas(documentId: string, limit?: number): Promise<DeltaEntry[]>;

  // Sessions
  saveSession(session: Omit<SessionEntry, 'connectedAt' | 'lastSeen'>): Promise<SessionEntry>;
  updateSession(sessionId: string, lastSeen: Date, metadata?: Record<string, any>): Promise<void>;
  deleteSession(sessionId: string): Promise<boolean>;
  getSessions(userId: string): Promise<SessionEntry[]>;

  // Maintenance
  cleanup(options?: { oldSessionsHours?: number; oldDeltasDays?: number; }): Promise<{
    sessionsDeleted: number;
    deltasDeleted: number;
  }>;
}
```

---

## Redis Pub/Sub

### Channels

#### Document Channels
Each document has its own channel for delta broadcasts:
- Format: `synckit:doc:{documentId}`
- Purpose: Sync deltas across server instances

#### Broadcast Channel
Global channel for server-wide events:
- Format: `synckit:broadcast`
- Purpose: Configuration updates, cache invalidation

#### Presence Channel
Server coordination and health:
- Format: `synckit:presence`
- Purpose: Track active servers, announce startup/shutdown

### API

```typescript
const pubsub = new RedisPubSub(redisUrl, 'synckit:');

// Document sync
await pubsub.publishDelta(documentId, deltaMessage);
await pubsub.subscribeToDocument(documentId, (delta) => {
  // Handle delta from another server
});

// Broadcast events
await pubsub.publishBroadcast('config_update', { key: 'value' });
await pubsub.subscribeToBroadcast((event, data) => {
  // Handle broadcast event
});

// Server presence
await pubsub.announcePresence(serverId, { metadata });
await pubsub.subscribeToPresence((event, serverId, metadata) => {
  if (event === 'online') {
    console.log(`Server ${serverId} came online`);
  } else {
    console.log(`Server ${serverId} went offline`);
  }
});
```

---

## Error Handling

### Error Types

```typescript
import {
  StorageError,
  ConnectionError,
  QueryError,
  NotFoundError,
  ConflictError,
} from './storage';

try {
  await storage.getDocument('doc-1');
} catch (error) {
  if (error instanceof NotFoundError) {
    // Document doesn't exist
  } else if (error instanceof ConnectionError) {
    // Database connection failed
  } else if (error instanceof QueryError) {
    // SQL query error
  }
}
```

### Graceful Degradation

The storage layer is **optional**. If PostgreSQL or Redis fail to connect:
- Server continues in **memory-only mode**
- All sync features work (but not persisted)
- Cross-server coordination disabled (single instance)
- Warning logged but server remains operational

---

## Performance

### Connection Pooling

PostgreSQL adapter uses connection pooling:
- Min: 2 connections (configurable)
- Max: 10 connections (configurable)
- Idle timeout: 30 seconds
- Connection timeout: 5 seconds

### Indexes

All critical queries are indexed:
- `documents.updated_at` (DESC) - Efficient listing
- `vector_clocks.document_id` - Fast clock lookups
- `deltas.document_id, timestamp` (DESC) - Audit queries
- `sessions.user_id` - User session lookups

### Query Optimization

- JSONB fields use GIN indexes
- Vector clock merges use UPSERT (ON CONFLICT)
- Bulk operations use transactions
- Read replicas supported (via connection string)

---

## Maintenance

### Cleanup Old Data

```typescript
// Manually trigger cleanup
await storage.cleanup({
  oldSessionsHours: 24,   // Delete sessions older than 24h
  oldDeltasDays: 30,      // Delete deltas older than 30 days
});
```

### Cron Job

Set up a cron job to run cleanup regularly:

```bash
# Add to crontab (runs daily at 3 AM)
0 3 * * * bun run cleanup
```

### Monitoring

Check health status:

```typescript
const healthy = await storage.healthCheck();
const redisHealthy = await pubsub.healthCheck();

if (!healthy) {
  console.error('Storage unhealthy!');
}
```

---

## Multi-Server Deployment

### Setup

1. **PostgreSQL** - Single shared database for all servers
2. **Redis** - Shared Redis instance for pub/sub
3. **Load Balancer** - Distribute WebSocket connections

### Configuration

Each server needs:
- Unique `serverId` (auto-generated by default)
- Same `DATABASE_URL` (shared database)
- Same `REDIS_URL` (shared Redis)

### How It Works

1. **Server A** receives delta from Client 1
2. **Server A** persists to PostgreSQL
3. **Server A** publishes delta to Redis channel
4. **Server B** receives delta from Redis
5. **Server B** broadcasts to its connected clients

### Presence Tracking

Servers announce their presence on startup:
```
Server-1 ONLINE → Server-2 logs "Server-1 joined"
Server-1 OFFLINE → Server-2 logs "Server-1 left"
```

---

## Security

### SQL Injection

All queries use parameterized statements:
```typescript
// ✅ SAFE
await pool.query('SELECT * FROM documents WHERE id = $1', [id]);

// ❌ NEVER DO THIS
await pool.query(`SELECT * FROM documents WHERE id = '${id}'`);
```

### Connection Security

Use SSL for production:
```
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
REDIS_URL=rediss://user:pass@host:6379  # Note: rediss:// for TLS
```

---

## Testing

### Integration Tests

```typescript
import { PostgresAdapter } from './storage/postgres';

describe('PostgreSQL Storage', () => {
  let storage: PostgresAdapter;

  beforeAll(async () => {
    storage = new PostgresAdapter({
      connectionString: process.env.TEST_DATABASE_URL,
    });
    await storage.connect();
  });

  afterAll(async () => {
    await storage.disconnect();
  });

  it('should save and retrieve document', async () => {
    await storage.saveDocument('test-1', { foo: 'bar' });
    const doc = await storage.getDocument('test-1');
    expect(doc.state.foo).toBe('bar');
  });
});
```

---

## Troubleshooting

### Connection Pool Exhausted

**Symptom**: "remaining connection slots are reserved"

**Solution**:
- Increase `poolMax` in config
- Check for connection leaks
- Use transactions properly

### Redis Memory Issues

**Symptom**: Redis OOM errors

**Solution**:
- Set maxmemory policy: `maxmemory-policy allkeys-lru`
- Monitor channel subscriptions
- Reduce message retention

### Slow Queries

**Symptom**: High database CPU

**Solution**:
- Check EXPLAIN plans
- Add missing indexes
- Use pagination for large result sets

---

## Migration from Memory-Only

To migrate from memory-only to persistent storage:

1. Deploy database (PostgreSQL + Redis)
2. Run migrations: `bun run db:migrate`
3. Update config with connection strings
4. Restart servers (one by one for zero downtime)
5. Existing in-memory state persists on first write

No data migration needed - storage layer is write-through cache.

---

## Next Steps

- **Sub-Phase 7.6**: Testing & Benchmarks
- **Sub-Phase 7.7**: Docker deployment
- **Phase 8**: Comprehensive testing
- **Phase 9**: Documentation & examples

---

**Storage Layer Status**: ✅ **COMPLETE**  
**Ready for**: Integration testing and production deployment
