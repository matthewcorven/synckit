# Phase 6: Storage - Detailed Work Items

**Phase Duration:** 1.5 weeks (Weeks 10-11)  
**Phase Goal:** Persistent storage with PostgreSQL and horizontal scaling with Redis pub/sub

> **Note:** This phase makes the server production-ready with persistent document storage and multi-instance support.

---

## Prerequisites

PostgreSQL and Redis are **required** for this phase. You have two options for running these dependencies:

### Option 1: Aspire Orchestration (Recommended)

The Aspire AppHost provides a unified way to start all dependencies with proper configuration:

```bash
# Navigate to orchestration directory
cd orchestration/aspire

# Start with PostgreSQL + Redis + C# backend
dotnet run --project SyncKit.AppHost --launch-profile "C# Backend + PostgreSQL"
```

This automatically:
- Starts PostgreSQL container with persistent volume
- Starts Redis container with persistent volume
- Configures connection strings via environment variables
- Waits for dependencies to be healthy before starting the server

See [orchestration/aspire/README.md](../../../orchestration/aspire/README.md) for full configuration options.

### Option 2: Docker Compose (Manual)

For standalone testing without Aspire:

```bash
# Start storage dependencies
cd server/csharp
docker compose -f docker-compose.test.yml up -d postgres redis

# Verify services are healthy
docker compose -f docker-compose.test.yml ps
```

### Connection Strings

| Service | Aspire Environment Variable | Manual Connection String |
|---------|----------------------------|--------------------------|
| PostgreSQL | `ConnectionStrings__synckit` (auto-injected) | `Host=localhost;Port=5432;Database=synckit_test;Username=synckit;Password=synckit_test` |
| Redis | `ConnectionStrings__redis` (auto-injected) | `localhost:6379` |

See [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md#test-dependencies-setup) for full Docker Compose configuration.

---

## Work Item Details

### T6-01: Define Storage Abstractions

**Priority:** P0  
**Estimate:** 2 hours  
**Dependencies:** S4-03

#### Description

Define `IStorageAdapter` interface with exact method name alignment to TypeScript `StorageAdapter` (`server/typescript/src/storage/interface.ts`).

#### Tasks

1. `IDocumentStore` removed; use `IStorageAdapter` (matches TypeScript)
2. Use exact same method names with `Async` suffix
3. Add connection lifecycle methods (`ConnectAsync`, `DisconnectAsync`, `IsConnected`)
4. Add all session operations (matches TS)
5. Add `max_clock_value` column to deltas for SQL-level filtering

#### Updated Interface

```csharp
// SyncKit.Server/Storage/IStorageAdapter.cs
// Exact alignment with TypeScript StorageAdapter interface

public interface IStorageAdapter
{
    // === Connection Lifecycle (matches TS) ===
    Task ConnectAsync(CancellationToken ct = default);
    Task DisconnectAsync(CancellationToken ct = default);
    bool IsConnected { get; }
    Task<bool> HealthCheckAsync(CancellationToken ct = default);

    // === Document Operations (matches TS) ===
    Task<DocumentState?> GetDocumentAsync(string id, CancellationToken ct = default);
    Task<DocumentState> SaveDocumentAsync(string id, JsonElement state, CancellationToken ct = default);
    Task<DocumentState> UpdateDocumentAsync(string id, JsonElement state, CancellationToken ct = default);
    Task<bool> DeleteDocumentAsync(string id, CancellationToken ct = default);
    Task<IReadOnlyList<DocumentState>> ListDocumentsAsync(int limit = 100, int offset = 0, CancellationToken ct = default);

    // === Vector Clock Operations (matches TS) ===
    Task<Dictionary<string, long>> GetVectorClockAsync(string documentId, CancellationToken ct = default);
    Task UpdateVectorClockAsync(string documentId, string clientId, long clockValue, CancellationToken ct = default);
    Task MergeVectorClockAsync(string documentId, Dictionary<string, long> clock, CancellationToken ct = default);

    // === Delta Operations (matches TS) ===
    Task<DeltaEntry> SaveDeltaAsync(DeltaEntry delta, CancellationToken ct = default);
    Task<IReadOnlyList<DeltaEntry>> GetDeltasAsync(string documentId, int limit = 100, CancellationToken ct = default);
    Task<IReadOnlyList<DeltaEntry>> GetDeltasSinceAsync(string documentId, long? sinceMaxClock, CancellationToken ct = default);

    // === Session Operations (matches TS) ===
    Task<SessionEntry> SaveSessionAsync(SessionEntry session, CancellationToken ct = default);
    Task UpdateSessionAsync(string sessionId, DateTime lastSeen, Dictionary<string, object>? metadata = null, CancellationToken ct = default);
    Task<bool> DeleteSessionAsync(string sessionId, CancellationToken ct = default);
    Task<IReadOnlyList<SessionEntry>> GetSessionsAsync(string userId, CancellationToken ct = default);

    // === Maintenance (matches TS) ===
    Task<CleanupResult> CleanupAsync(CleanupOptions? options = null, CancellationToken ct = default);
}
```

#### Acceptance Criteria

- [ ] Interface renamed to `IStorageAdapter` (matches TS `StorageAdapter`)
- [ ] All method names match TypeScript exactly (with `Async` suffix)
- [ ] Connection lifecycle: `ConnectAsync()`, `DisconnectAsync()`, `IsConnected`
- [ ] Document ops: `GetDocumentAsync()`, `SaveDocumentAsync()`, `UpdateDocumentAsync()`, `DeleteDocumentAsync()`, `ListDocumentsAsync()`
- [ ] Vector clock ops: `GetVectorClockAsync()`, `UpdateVectorClockAsync()`, `MergeVectorClockAsync()`
- [ ] Delta ops: `SaveDeltaAsync()`, `GetDeltasAsync()`, `GetDeltasSinceAsync()`
- [ ] Session ops: `SaveSessionAsync()`, `UpdateSessionAsync()`, `DeleteSessionAsync()`, `GetSessionsAsync()`
- [ ] Maintenance: `CleanupAsync()`

---

### T6-02: Create PostgreSQL Storage Adapter

**Priority:** P0  
**Estimate:** 6 hours  
**Dependencies:** T6-01, T6-03 (schema must exist)

#### Description

Implement `PostgresStorageAdapter` that operates against the **existing shared schema**. The C# server does **NOT** manage schema creation—the schema is owned by shared migration tooling (T6-03).

#### Key Design Decision: Shared Infrastructure

Since both TypeScript and C# servers share the same PostgreSQL instance:

1. **Schema is managed externally** - by shared migration tooling (T6-03)
2. **C# adapter assumes schema exists** - no inline schema creation
3. **C# validates schema on startup** - ensures required tables exist
4. **Both servers are protocol-compatible** - same table structures, same data formats

#### Schema Validation (Not Creation)

```csharp
// SyncKit.Server/Storage/SchemaValidator.cs
public class SchemaValidator
{
    private static readonly string[] RequiredTables = 
    {
        "documents", "vector_clocks", "deltas", "sessions"
    };

    public async Task<bool> ValidateSchemaAsync(CancellationToken ct = default)
    {
        // Query information_schema.tables
        // Return false with clear error if any required table is missing
        // Log success if all tables exist
    }
}
```

#### Expected Schema (Reference Only)

The C# adapter expects this schema to exist (created by T6-03):

```sql
-- Reference: server/typescript/src/storage/schema.sql
-- DO NOT create from C# - use shared migration tooling

-- documents: id, state (JSONB), version, created_at, updated_at
-- vector_clocks: document_id, client_id, clock_value, updated_at
-- deltas: id (UUID), document_id, client_id, operation_type, field_path, value, clock_value, timestamp
-- sessions: id, user_id, client_id, connected_at, last_seen, metadata
```

#### Implementation (Exact Method Name Alignment)

```csharp
// SyncKit.Server/Storage/PostgresAdapter.cs
// Implements IStorageAdapter with exact TypeScript method name alignment
public class PostgresAdapter : IStorageAdapter
{
    private readonly NpgsqlDataSource _dataSource;
    private readonly ILogger<PostgresAdapter> _logger;
    private bool _isConnected;

    public PostgresAdapter(NpgsqlDataSource dataSource, ILogger<PostgresAdapter> logger)
    {
        _dataSource = dataSource;
        _logger = logger;
    }

    // === Connection Lifecycle (matches TS) ===
    
    public bool IsConnected => _isConnected;

    public async Task ConnectAsync(CancellationToken ct = default)
    {
        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        _isConnected = true;
        _logger.LogInformation("✅ PostgreSQL connected");
    }

    public async Task DisconnectAsync(CancellationToken ct = default)
    {
        _isConnected = false;
        _logger.LogInformation("PostgreSQL disconnected");
        await Task.CompletedTask;
    }

    public async Task<bool> HealthCheckAsync(CancellationToken ct = default)
    {
        try
        {
            await using var conn = await _dataSource.OpenConnectionAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT 1";
            await cmd.ExecuteScalarAsync(ct);
            return true;
        }
        catch
        {
            return false;
        }
    }

    // === Document Operations (matches TS) ===
    
    public async Task<DocumentState?> GetDocumentAsync(string id, CancellationToken ct = default)
    {
        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            SELECT id, state, version, created_at, updated_at 
            FROM documents WHERE id = @id";
        cmd.Parameters.AddWithValue("id", id);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (await reader.ReadAsync(ct))
        {
            return new DocumentState(
                reader.GetString(0),
                JsonDocument.Parse(reader.GetString(1)).RootElement,
                reader.GetInt64(2),
                reader.GetDateTime(3),
                reader.GetDateTime(4)
            );
        }
        return null;
    }

    public async Task<DocumentState> SaveDocumentAsync(string id, JsonElement state, CancellationToken ct = default)
    {
        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO documents (id, state, version)
            VALUES (@id, @state::jsonb, 1)
            ON CONFLICT (id) DO UPDATE
            SET state = @state::jsonb, updated_at = NOW()
            RETURNING id, state, version, created_at, updated_at";
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("state", state.GetRawText());

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        await reader.ReadAsync(ct);
        return new DocumentState(
            reader.GetString(0),
            JsonDocument.Parse(reader.GetString(1)).RootElement,
            reader.GetInt64(2),
            reader.GetDateTime(3),
            reader.GetDateTime(4)
        );
    }

    public async Task<DocumentState> UpdateDocumentAsync(string id, JsonElement state, CancellationToken ct = default)
    {
        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            UPDATE documents 
            SET state = @state::jsonb, updated_at = NOW()
            WHERE id = @id
            RETURNING id, state, version, created_at, updated_at";
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("state", state.GetRawText());

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
            throw new KeyNotFoundException($"Document not found: {id}");
            
        return new DocumentState(
            reader.GetString(0),
            JsonDocument.Parse(reader.GetString(1)).RootElement,
            reader.GetInt64(2),
            reader.GetDateTime(3),
            reader.GetDateTime(4)
        );
    }

    public async Task<bool> DeleteDocumentAsync(string id, CancellationToken ct = default)
    {
        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM documents WHERE id = @id";
        cmd.Parameters.AddWithValue("id", id);
        return await cmd.ExecuteNonQueryAsync(ct) > 0;
    }

    public async Task<IReadOnlyList<DocumentState>> ListDocumentsAsync(int limit = 100, int offset = 0, CancellationToken ct = default)
    {
        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            SELECT id, state, version, created_at, updated_at 
            FROM documents ORDER BY updated_at DESC LIMIT @limit OFFSET @offset";
        cmd.Parameters.AddWithValue("limit", limit);
        cmd.Parameters.AddWithValue("offset", offset);

        var results = new List<DocumentState>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            results.Add(new DocumentState(
                reader.GetString(0),
                JsonDocument.Parse(reader.GetString(1)).RootElement,
                reader.GetInt64(2),
                reader.GetDateTime(3),
                reader.GetDateTime(4)
            ));
        }
        return results;
    }

    // === Vector Clock Operations (matches TS) ===
    
    public async Task<Dictionary<string, long>> GetVectorClockAsync(string documentId, CancellationToken ct = default)
    {
        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT client_id, clock_value FROM vector_clocks WHERE document_id = @docId";
        cmd.Parameters.AddWithValue("docId", documentId);

        var clock = new Dictionary<string, long>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            clock[reader.GetString(0)] = reader.GetInt64(1);
        }
        return clock;
    }

    public async Task UpdateVectorClockAsync(string documentId, string clientId, long clockValue, CancellationToken ct = default)
    {
        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO vector_clocks (document_id, client_id, clock_value, updated_at)
            VALUES (@docId, @clientId, @clockValue, NOW())
            ON CONFLICT (document_id, client_id)
            DO UPDATE SET clock_value = @clockValue, updated_at = NOW()";
        cmd.Parameters.AddWithValue("docId", documentId);
        cmd.Parameters.AddWithValue("clientId", clientId);
        cmd.Parameters.AddWithValue("clockValue", clockValue);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task MergeVectorClockAsync(string documentId, Dictionary<string, long> clock, CancellationToken ct = default)
    {
        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var transaction = await conn.BeginTransactionAsync(ct);

        try
        {
            foreach (var (clientId, clockValue) in clock)
            {
                await using var cmd = conn.CreateCommand();
                cmd.Transaction = transaction;
                cmd.CommandText = @"
                    INSERT INTO vector_clocks (document_id, client_id, clock_value, updated_at)
                    VALUES (@docId, @clientId, @clockValue, NOW())
                    ON CONFLICT (document_id, client_id)
                    DO UPDATE SET 
                        clock_value = GREATEST(vector_clocks.clock_value, @clockValue),
                        updated_at = NOW()";
                cmd.Parameters.AddWithValue("docId", documentId);
                cmd.Parameters.AddWithValue("clientId", clientId);
                cmd.Parameters.AddWithValue("clockValue", clockValue);
                await cmd.ExecuteNonQueryAsync(ct);
            }
            await transaction.CommitAsync(ct);
        }
        catch
        {
            await transaction.RollbackAsync(ct);
            throw;
        }
    }

    // === Delta Operations (matches TS) ===
    
    public async Task<DeltaEntry> SaveDeltaAsync(DeltaEntry delta, CancellationToken ct = default)
    {
        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO deltas (document_id, client_id, operation_type, field_path, value, clock_value, max_clock_value, timestamp)
            VALUES (@docId, @clientId, @opType, @fieldPath, @value::jsonb, @clockValue, @maxClockValue, NOW())
            RETURNING id, timestamp";
        cmd.Parameters.AddWithValue("docId", delta.DocumentId);
        cmd.Parameters.AddWithValue("clientId", delta.ClientId);
        cmd.Parameters.AddWithValue("opType", delta.OperationType);
        cmd.Parameters.AddWithValue("fieldPath", delta.FieldPath);
        cmd.Parameters.AddWithValue("value", delta.Value?.GetRawText() ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("clockValue", delta.ClockValue);
        cmd.Parameters.AddWithValue("maxClockValue", delta.MaxClockValue);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        await reader.ReadAsync(ct);
        return delta with { Id = reader.GetGuid(0).ToString(), Timestamp = reader.GetDateTime(1) };
    }

    public async Task<IReadOnlyList<DeltaEntry>> GetDeltasAsync(string documentId, int limit = 100, CancellationToken ct = default)
    {
        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            SELECT id, document_id, client_id, operation_type, field_path, value, clock_value, max_clock_value, timestamp 
            FROM deltas WHERE document_id = @docId ORDER BY timestamp DESC LIMIT @limit";
        cmd.Parameters.AddWithValue("docId", documentId);
        cmd.Parameters.AddWithValue("limit", limit);
        return await ReadDeltasAsync(cmd, ct);
    }

    public async Task<IReadOnlyList<DeltaEntry>> GetDeltasSinceAsync(string documentId, long? sinceMaxClock, CancellationToken ct = default)
    {
        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        
        cmd.CommandText = sinceMaxClock == null
            ? @"SELECT id, document_id, client_id, operation_type, field_path, value, clock_value, max_clock_value, timestamp 
                FROM deltas WHERE document_id = @docId ORDER BY timestamp"
            : @"SELECT id, document_id, client_id, operation_type, field_path, value, clock_value, max_clock_value, timestamp 
                FROM deltas WHERE document_id = @docId AND max_clock_value > @sinceMaxClock ORDER BY timestamp";
        
        cmd.Parameters.AddWithValue("docId", documentId);
        if (sinceMaxClock != null) cmd.Parameters.AddWithValue("sinceMaxClock", sinceMaxClock.Value);
        return await ReadDeltasAsync(cmd, ct);
    }

    // === Session Operations (matches TS) ===
    
    public async Task<SessionEntry> SaveSessionAsync(SessionEntry session, CancellationToken ct = default)
    {
        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO sessions (id, user_id, client_id, connected_at, last_seen, metadata)
            VALUES (@id, @userId, @clientId, NOW(), NOW(), @metadata::jsonb)
            ON CONFLICT (id) DO UPDATE SET last_seen = NOW(), metadata = @metadata::jsonb
            RETURNING connected_at, last_seen";
        cmd.Parameters.AddWithValue("id", session.Id);
        cmd.Parameters.AddWithValue("userId", session.UserId);
        cmd.Parameters.AddWithValue("clientId", session.ClientId ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("metadata", JsonSerializer.Serialize(session.Metadata ?? new()));

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        await reader.ReadAsync(ct);
        return session with { ConnectedAt = reader.GetDateTime(0), LastSeen = reader.GetDateTime(1) };
    }

    public async Task UpdateSessionAsync(string sessionId, DateTime lastSeen, Dictionary<string, object>? metadata = null, CancellationToken ct = default)
    {
        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"UPDATE sessions SET last_seen = @lastSeen, metadata = COALESCE(@metadata::jsonb, metadata) WHERE id = @id";
        cmd.Parameters.AddWithValue("id", sessionId);
        cmd.Parameters.AddWithValue("lastSeen", lastSeen);
        cmd.Parameters.AddWithValue("metadata", metadata != null ? JsonSerializer.Serialize(metadata) : (object)DBNull.Value);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<bool> DeleteSessionAsync(string sessionId, CancellationToken ct = default)
    {
        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM sessions WHERE id = @id";
        cmd.Parameters.AddWithValue("id", sessionId);
        return await cmd.ExecuteNonQueryAsync(ct) > 0;
    }

    public async Task<IReadOnlyList<SessionEntry>> GetSessionsAsync(string userId, CancellationToken ct = default)
    {
        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"SELECT id, user_id, client_id, connected_at, last_seen, metadata FROM sessions WHERE user_id = @userId ORDER BY last_seen DESC";
        cmd.Parameters.AddWithValue("userId", userId);

        var results = new List<SessionEntry>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            results.Add(new SessionEntry
            {
                Id = reader.GetString(0),
                UserId = reader.GetString(1),
                ClientId = reader.IsDBNull(2) ? null : reader.GetString(2),
                ConnectedAt = reader.GetDateTime(3),
                LastSeen = reader.GetDateTime(4),
                Metadata = JsonSerializer.Deserialize<Dictionary<string, object>>(reader.GetString(5))
            });
        }
        return results;
    }

    // === Maintenance (matches TS cleanup()) ===
    
    public async Task<CleanupResult> CleanupAsync(CleanupOptions? options = null, CancellationToken ct = default)
    {
        options ??= new CleanupOptions();
        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        
        await using var sessionsCmd = conn.CreateCommand();
        sessionsCmd.CommandText = $"DELETE FROM sessions WHERE last_seen < NOW() - INTERVAL '{options.OldSessionsHours} hours'";
        var sessionsDeleted = await sessionsCmd.ExecuteNonQueryAsync(ct);

        await using var deltasCmd = conn.CreateCommand();
        deltasCmd.CommandText = $"DELETE FROM deltas WHERE timestamp < NOW() - INTERVAL '{options.OldDeltasDays} days'";
        var deltasDeleted = await deltasCmd.ExecuteNonQueryAsync(ct);

        _logger.LogInformation("Cleanup: {Sessions} sessions, {Deltas} deltas deleted", sessionsDeleted, deltasDeleted);
        return new CleanupResult(sessionsDeleted, deltasDeleted);
    }

    // Helper
    private async Task<IReadOnlyList<DeltaEntry>> ReadDeltasAsync(NpgsqlCommand cmd, CancellationToken ct)
    {
        var deltas = new List<DeltaEntry>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            var clockValue = reader.GetInt64(5);
            
            deltas.Add(new StoredDelta
            {
                Id = reader.GetGuid(0).ToString(),
                DocumentId = "", // Set by caller if needed
                ClientId = clientId,
                OperationType = reader.GetString(2),
                FieldPath = reader.GetString(3),
                Value = reader.IsDBNull(4) ? null : JsonDocument.Parse(reader.GetString(4)).RootElement,
                VectorClock = new VectorClock(new Dictionary<string, long> { [clientId] = clockValue }),
                Timestamp = reader.GetDateTime(7).Ticks
            });
        }
        return deltas;
    }

    // ... other methods (Delete, Exists, GetDocumentIdsAsync, etc.)
}
```

#### Acceptance Criteria

- [ ] `SchemaValidator` checks for required tables on startup
- [ ] Startup fails fast with clear error if schema is missing
- [ ] All `IStorageAdapter` methods implemented
- [ ] Operations compatible with TypeScript schema
- [ ] Connection pooling via `NpgsqlDataSource`
- [ ] Transactions for multi-table consistency
- [ ] **No schema creation code** - schema managed by T6-03

---

### T6-03: Shared Database Migration Tooling

**Priority:** P0  
**Estimate:** 4 hours  
**Dependencies:** T6-01

#### Description

Create standalone migration tooling that manages the shared PostgreSQL schema for both TypeScript and C# servers. Migrations run as a separate step **before** starting either server.

#### Background: Shared Infrastructure

Since both servers share the same PostgreSQL instance via Aspire:

| Approach | Problem |
|----------|---------|
| ❌ Each server manages own migrations | Race conditions, duplicate schemas |
| ✅ **Shared migration tooling** | Single source of truth, runs before servers |

#### Architecture

```
Aspire Orchestration
        │
        ▼
┌───────────────────┐
│  Migration Runner │  ◄── Runs FIRST
│  (TypeScript/Bun) │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│    PostgreSQL     │
│  (schema created) │
└─────────┬─────────┘
          │
    ┌─────┴─────┐
    ▼           ▼
 TS Server   C# Server
(validates)  (validates)
```

#### Implementation Options

**Option A: Enhance existing TypeScript migration**

Leverage `server/typescript/src/storage/migrate.ts` - already exists and works.

**Option B: Aspire integration**

Add migration as a pre-start resource that both servers wait for:

```csharp
// AppHost.cs
var migrations = builder.AddExecutable("synckit-migrations", "bun", tsServerPath, 
        "run", "src/storage/migrate.ts")
    .WithEnvironment("DATABASE_URL", syncKitDb.Resource.ConnectionStringExpression)
    .WaitFor(syncKitDb);

// Both servers wait for migrations
tsBackend.WaitFor(migrations);
csharpBackend.WaitFor(migrations);
```

#### Acceptance Criteria

- [ ] Single canonical schema location (`server/typescript/src/storage/schema.sql`)
- [ ] Migration runs as separate step before servers start
- [ ] Aspire orchestration runs migrations automatically
- [ ] Both servers validate schema on startup (don't create)
- [ ] Clear error messages when schema is missing
- [ ] Idempotent execution (safe to run multiple times)

---

### T6-04: Create Redis Pub/Sub Provider

**Priority:** P0  
**Estimate:** 6 hours  
**Dependencies:** T6-01, S4-06, W5-03

#### Description

Implement Redis pub/sub for broadcasting messages across multiple server instances.

#### Tasks

1. Create `IRedisPubSub.cs` interface
2. Create `RedisPubSubProvider.cs`
3. Subscribe to document channels
4. Publish delta and awareness updates
5. Handle reconnection

#### Implementation

```csharp
// SyncKit.Server/PubSub/IRedisPubSub.cs
public interface IRedisPubSub
{
    Task PublishDeltaAsync(string documentId, DeltaMessage delta);
    Task PublishAwarenessAsync(string documentId, AwarenessUpdateMessage update);
    Task SubscribeAsync(string documentId, Func<IMessage, Task> handler);
    Task UnsubscribeAsync(string documentId);
    Task<bool> IsConnectedAsync();
}

// SyncKit.Server/PubSub/RedisPubSubProvider.cs
public class RedisPubSubProvider : IRedisPubSub, IAsyncDisposable
{
    private readonly IConnectionMultiplexer _redis;
    private readonly ISubscriber _subscriber;
    private readonly ConcurrentDictionary<string, Func<IMessage, Task>> _handlers = new();
    private readonly ILogger<RedisPubSubProvider> _logger;
    private readonly JsonProtocolHandler _jsonHandler = new();

    public RedisPubSubProvider(
        IConnectionMultiplexer redis,
        ILogger<RedisPubSubProvider> logger)
    {
        _redis = redis;
        _subscriber = redis.GetSubscriber();
        _logger = logger;
    }

    public async Task PublishDeltaAsync(string documentId, DeltaMessage delta)
    {
        var channel = $"synckit:delta:{documentId}";
        var data = _jsonHandler.Serialize(delta);
        await _subscriber.PublishAsync(channel, data.ToArray());
        
        _logger.LogDebug("Published delta to {Channel}", channel);
    }

    public async Task PublishAwarenessAsync(string documentId, AwarenessUpdateMessage update)
    {
        var channel = $"synckit:awareness:{documentId}";
        var data = _jsonHandler.Serialize(update);
        await _subscriber.PublishAsync(channel, data.ToArray());
        
        _logger.LogDebug("Published awareness to {Channel}", channel);
    }

    public async Task SubscribeAsync(string documentId, Func<IMessage, Task> handler)
    {
        _handlers[documentId] = handler;

        // Subscribe to both delta and awareness channels
        var deltaChannel = $"synckit:delta:{documentId}";
        var awarenessChannel = $"synckit:awareness:{documentId}";

        await _subscriber.SubscribeAsync(deltaChannel, async (channel, value) =>
        {
            await HandleMessage(documentId, value);
        });

        await _subscriber.SubscribeAsync(awarenessChannel, async (channel, value) =>
        {
            await HandleMessage(documentId, value);
        });

        _logger.LogDebug("Subscribed to channels for {DocumentId}", documentId);
    }

    public async Task UnsubscribeAsync(string documentId)
    {
        _handlers.TryRemove(documentId, out _);

        await _subscriber.UnsubscribeAsync($"synckit:delta:{documentId}");
        await _subscriber.UnsubscribeAsync($"synckit:awareness:{documentId}");

        _logger.LogDebug("Unsubscribed from channels for {DocumentId}", documentId);
    }

    private async Task HandleMessage(string documentId, byte[] data)
    {
        if (!_handlers.TryGetValue(documentId, out var handler))
        {
            return;
        }

        try
        {
            var message = _jsonHandler.Parse(data);
            if (message != null)
            {
                await handler(message);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling pub/sub message for {DocumentId}", documentId);
        }
    }

    public Task<bool> IsConnectedAsync()
    {
        return Task.FromResult(_redis.IsConnected);
    }

    public async ValueTask DisposeAsync()
    {
        await _subscriber.UnsubscribeAllAsync();
    }
}
```

#### Integration with Handlers

```csharp
// Update DeltaMessageHandler to publish to Redis
public async Task HandleAsync(Connection connection, IMessage message)
{
    // ... existing code ...

    // Broadcast to local subscribers
    await _connectionManager.BroadcastToDocumentAsync(
        delta.DocumentId,
        broadcastMessage,
        excludeConnectionId: connection.Id);

    // Publish to Redis for other server instances
    if (_redisPubSub != null)
    {
        await _redisPubSub.PublishDeltaAsync(delta.DocumentId, broadcastMessage);
    }
}
```

#### Acceptance Criteria

- [ ] Delta messages published to Redis
- [ ] Awareness messages published to Redis
- [ ] Subscriptions managed per document
- [ ] Messages from Redis forwarded to local connections
- [ ] Reconnection handled
- [ ] Graceful shutdown

---

### T6-05: Create Storage Provider Factory

**Priority:** P0  
**Estimate:** 3 hours  
**Dependencies:** T6-02, T6-04

#### Description

Create factory to instantiate correct storage providers based on configuration.

#### Configuration

```json
{
  "Storage": {
    "Provider": "postgresql",  // "inmemory" | "postgresql"
    "PostgreSql": {
      "ConnectionString": "Host=localhost;Database=synckit;..."
    },
    "Redis": {
      "ConnectionString": "localhost:6379",
      "Enabled": true
    }
  }
}
```

#### Implementation

```csharp
// SyncKit.Server/Storage/StorageProviderFactory.cs
public static class StorageProviderFactory
{
    public static IServiceCollection AddSyncKitStorage(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var storageConfig = configuration.GetSection("Storage");
        var provider = storageConfig.GetValue<string>("Provider") ?? "inmemory";

        switch (provider.ToLowerInvariant())
        {
            case "postgresql":
            case "postgres":
                services.AddPostgreSqlStorage(storageConfig);
                break;
            case "inmemory":
            default:
                services.AddInMemoryStorage();
                break;
        }

        // Redis pub/sub (optional)
        if (storageConfig.GetValue<bool>("Redis:Enabled"))
        {
            services.AddRedisPubSub(storageConfig);
        }

        return services;
    }

    private static void AddInMemoryStorage(this IServiceCollection services)
    {
        // Register in-memory adapter implementation
        services.AddSingleton<Storage.IStorageAdapter, Storage.InMemoryStorageAdapter>();
        services.AddSingleton<IAwarenessStore, InMemoryAwarenessStore>();
    }

    private static void AddPostgreSqlStorage(
        this IServiceCollection services, 
        IConfigurationSection config)
    {
        var connectionString = config.GetValue<string>("PostgreSql:ConnectionString")
            ?? throw new InvalidOperationException("PostgreSQL connection string required");

        services.AddNpgsqlDataSource(connectionString);
        services.AddSingleton<IMigrationRunner, MigrationRunner>();
        // Register PostgreSQL-backed storage adapter
        services.AddSingleton<Storage.IStorageAdapter, PostgreSqlStorageAdapter>();
        services.AddSingleton<IAwarenessStore, InMemoryAwarenessStore>(); // Awareness stays in-memory
    }

    private static void AddRedisPubSub(
        this IServiceCollection services,
        IConfigurationSection config)
    {
        var connectionString = config.GetValue<string>("Redis:ConnectionString")
            ?? "localhost:6379";

        services.AddSingleton<IConnectionMultiplexer>(_ =>
            ConnectionMultiplexer.Connect(connectionString));
        services.AddSingleton<IRedisPubSub, RedisPubSubProvider>();
    }
}
```

#### Acceptance Criteria

- [ ] In-memory storage works by default
- [ ] PostgreSQL configurable
- [ ] Redis pub/sub optional
- [ ] Connection strings from config
- [ ] Factory validates configuration

---

### T6-06: Add Health Checks for Storage

**Priority:** P1  
**Estimate:** 2 hours  
**Dependencies:** T6-02, T6-04

#### Description

Add health check endpoints for PostgreSQL and Redis.

#### Implementation

```csharp
// SyncKit.Server/Storage/PostgreSqlHealthCheck.cs
public class PostgreSqlHealthCheck : IHealthCheck
{
    private readonly NpgsqlDataSource _dataSource;

    public PostgreSqlHealthCheck(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken ct = default)
    {
        try
        {
            await using var conn = await _dataSource.OpenConnectionAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT 1";
            await cmd.ExecuteScalarAsync(ct);
            return HealthCheckResult.Healthy("PostgreSQL connection successful");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("PostgreSQL connection failed", ex);
        }
    }
}

// SyncKit.Server/PubSub/RedisHealthCheck.cs
public class RedisHealthCheck : IHealthCheck
{
    private readonly IConnectionMultiplexer _redis;

    public RedisHealthCheck(IConnectionMultiplexer redis)
    {
        _redis = redis;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken ct = default)
    {
        try
        {
            var db = _redis.GetDatabase();
            var latency = await db.PingAsync();
            
            return HealthCheckResult.Healthy($"Redis connected, latency: {latency.TotalMilliseconds}ms");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Redis connection failed", ex);
        }
    }
}
```

#### Registration

```csharp
// Program.cs
builder.Services.AddHealthChecks()
    .AddCheck<PostgreSqlHealthCheck>("postgresql", tags: new[] { "db", "ready" })
    .AddCheck<RedisHealthCheck>("redis", tags: new[] { "cache", "ready" });
```

#### Acceptance Criteria

- [ ] PostgreSQL health check works
- [ ] Redis health check works
- [ ] Health checks tagged appropriately
- [ ] Latency reported for Redis

---

### T6-07: Storage Integration Tests

**Priority:** P0  
**Estimate:** 6 hours  
**Dependencies:** T6-02 through T6-06

#### Description

Integration tests for storage providers. Tests can run against:
1. **Aspire Orchestration** (recommended for development and full validation)
2. **Docker Compose services** (for CI/CD pipelines)
3. **Testcontainers** (for isolated unit-style integration tests)

#### Prerequisites

**Option 1: Aspire Orchestration (Recommended for Development)**

```bash
# Start PostgreSQL + Redis via Aspire
cd orchestration/aspire
dotnet run --project SyncKit.AppHost --launch-profile "C# Backend + PostgreSQL"

# Connection strings are automatically configured
# View in Aspire Dashboard: https://localhost:17235
```

**Option 2: Docker Compose (CI/CD)**

```bash
cd server/csharp
docker compose -f docker-compose.test.yml up -d postgres redis
```

#### Test Setup (Testcontainers Alternative)

For isolated tests that spin up their own containers:

```csharp
// SyncKit.Server.Tests/Storage/PostgreSqlFixture.cs
public class PostgreSqlFixture : IAsyncLifetime
{
    private PostgreSqlContainer _container = null!;
    public string ConnectionString => _container.GetConnectionString();

    public async Task InitializeAsync()
    {
        _container = new PostgreSqlBuilder()
            .WithImage("postgres:15-alpine")
            .Build();
        
        await _container.StartAsync();
    }

    public async Task DisposeAsync()
    {
        await _container.DisposeAsync();
    }
}

// SyncKit.Server.Tests/Storage/RedisFixture.cs  
public class RedisFixture : IAsyncLifetime
{
    private RedisContainer _container = null!;
    public string ConnectionString => _container.GetConnectionString();

    public async Task InitializeAsync()
    {
        _container = new RedisBuilder()
            .WithImage("redis:7-alpine")
            .Build();
        
        await _container.StartAsync();
    }

    public async Task DisposeAsync()
    {
        await _container.DisposeAsync();
    }
}
```

#### Test Examples

```csharp
public class PostgreSqlDocumentStoreTests : IClassFixture<PostgreSqlFixture>
{
    private readonly PostgreSqlFixture _fixture;
    private readonly PostgreSqlDocumentStore _store;

    public PostgreSqlDocumentStoreTests(PostgreSqlFixture fixture)
    {
        _fixture = fixture;
        var dataSource = NpgsqlDataSource.Create(fixture.ConnectionString);
        _store = new PostgreSqlDocumentStore(dataSource, NullLogger<PostgreSqlDocumentStore>.Instance);
        
        // Run migrations
        var runner = new MigrationRunner(dataSource, NullLogger<MigrationRunner>.Instance);
        runner.RunMigrationsAsync().GetAwaiter().GetResult();
    }

    [Fact]
    public async Task GetOrCreateAsync_NewDocument_CreatesInDatabase()
    {
        var doc = await _store.GetOrCreateAsync("test-doc-1");
        
        Assert.NotNull(doc);
        Assert.Equal("test-doc-1", doc.Id);
        
        // Verify in database
        var fetched = await _store.GetAsync("test-doc-1");
        Assert.NotNull(fetched);
    }

    [Fact]
    public async Task AddDeltaAsync_PersistsDelta()
    {
        await _store.GetOrCreateAsync("test-doc-2");
        var delta = new StoredDelta
        {
            Id = "delta-1",
            ClientId = "client-1",
            Data = JsonDocument.Parse("""{"test":"value"}""").RootElement,
            VectorClock = new VectorClock(new() { ["client-1"] = 1 }),
            Timestamp = 1234567890
        };
        
        await _store.AddDeltaAsync("test-doc-2", delta);
        
        var deltas = await _store.GetDeltasSinceAsync("test-doc-2", null);
        Assert.Single(deltas);
        Assert.Equal("delta-1", deltas[0].Id);
    }

    [Fact]
    public async Task SaveSnapshotAsync_PersistsSnapshot()
    {
        await _store.GetOrCreateAsync("test-doc-3");
        var snapshot = Encoding.UTF8.GetBytes("snapshot data");
        var clock = new VectorClock(new() { ["client-1"] = 5 });
        
        await _store.SaveSnapshotAsync("test-doc-3", snapshot, clock);
        
        var result = await _store.GetSnapshotAsync("test-doc-3");
        Assert.NotNull(result);
        Assert.Equal(snapshot, result.Value.Snapshot);
    }
}

public class RedisPubSubTests : IClassFixture<RedisFixture>
{
    private readonly RedisFixture _fixture;

    public RedisPubSubTests(RedisFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task PublishDeltaAsync_SubscriberReceivesMessage()
    {
        var redis = await ConnectionMultiplexer.ConnectAsync(_fixture.ConnectionString);
        var pubsub = new RedisPubSubProvider(redis, NullLogger<RedisPubSubProvider>.Instance);

        IMessage? received = null;
        var tcs = new TaskCompletionSource<bool>();

        await pubsub.SubscribeAsync("doc-1", msg =>
        {
            received = msg;
            tcs.SetResult(true);
            return Task.CompletedTask;
        });

        var delta = new DeltaMessage
        {
            Id = "msg-1",
            DocumentId = "doc-1",
            Delta = JsonDocument.Parse("{}").RootElement,
            VectorClock = new() { ["client-1"] = 1 }
        };

        await pubsub.PublishDeltaAsync("doc-1", delta);
        
        await Task.WhenAny(tcs.Task, Task.Delay(5000));
        
        Assert.NotNull(received);
        Assert.Equal(MessageType.Delta, received.Type);
    }
}
```

#### Acceptance Criteria

- [ ] Tests run against Docker Compose services (primary)
- [ ] Testcontainers available as alternative for isolated tests
- [ ] All CRUD operations tested
- [ ] Migration execution tested
- [ ] Pub/sub messaging tested
- [ ] Tests isolated and repeatable
- [ ] CI/CD uses `docker-compose.test.yml`

---

## Phase 6 Summary

| ID | Title | Priority | Est (h) | Status |
|----|-------|----------|---------|--------|
| T6-01 | Define storage abstractions + migrate existing code | P0 | 4 | ⬜ |
| T6-02 | Create PostgreSQL storage adapter | P0 | 6 | ⬜ |
| T6-03 | Shared database migration tooling | P0 | 4 | ⬜ |
| T6-04 | Create Redis pub/sub provider | P0 | 6 | ⬜ |
| T6-05 | Create storage provider factory | P0 | 3 | ⬜ |
| T6-06 | Add health checks for storage | P1 | 2 | ⬜ |
| T6-07 | Storage integration tests | P0 | 6 | ⬜ |
| T6-08 | Redis-backed Awareness Store | P0 | 4 | ⬜ |
| T6-09 | PostgreSQL-backed Awareness Store | P0 | 6 | ⬜ |
| **Total** | | | **41** | |

> **Note:** T6-03 (migrations) runs **before** T6-02 (adapter), since the adapter assumes schema exists.

**Legend:** ⬜ Not Started | 🔄 In Progress | ✅ Complete

---

## Phase 6 Validation

After completing Phase 6, the following should work:

### Using Aspire Orchestration (Recommended)

1. **PostgreSQL Persistence with Aspire**
   ```bash
   # Start with Aspire - PostgreSQL + Redis auto-configured
   cd orchestration/aspire
   dotnet run --project SyncKit.AppHost --launch-profile "C# Backend + PostgreSQL"
   
   # Aspire Dashboard shows all services at https://localhost:17235
   # Data persists across restarts (persistent volumes)
   ```

2. **Multi-Instance Testing with Aspire**
   ```bash
   # Start both TypeScript and C# backends against same PostgreSQL/Redis
   cd orchestration/aspire
   dotnet run --project SyncKit.AppHost --launch-profile "Full Stack (Both Backends + PostgreSQL)"
   
   # TypeScript backend: http://localhost:3000
   # C# backend: http://localhost:5000
   # Both share the same PostgreSQL and Redis instances
   # Deltas sent to one backend appear on the other via Redis pub/sub
   ```

### Using Manual Configuration

1. **PostgreSQL Persistence**
   ```bash
   # Start with PostgreSQL
   STORAGE__PROVIDER=postgresql \
   STORAGE__POSTGRESQL__CONNECTIONSTRING="Host=localhost;Database=synckit;..." \
   dotnet run
   
   # Data persists across restarts
   ```

2. **Multi-Instance with Redis**
   ```bash
   # Instance 1
   STORAGE__REDIS__ENABLED=true \
   STORAGE__REDIS__CONNECTIONSTRING=localhost:6379 \
   dotnet run --urls=http://localhost:8080
   
   # Instance 2
   STORAGE__REDIS__ENABLED=true \
   STORAGE__REDIS__CONNECTIONSTRING=localhost:6379 \
   dotnet run --urls=http://localhost:8081
   
   # Deltas sent to instance 1 appear on instance 2
   ```

### Health Checks

```bash
# Via Aspire Dashboard or direct curl
curl http://localhost:5000/health/ready
# {"status":"Healthy","results":{"postgresql":{"status":"Healthy"},"redis":{"status":"Healthy"}}}
```
