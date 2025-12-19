# Phase 6: Storage - Detailed Work Items

**Phase Duration:** 1.5 weeks (Weeks 10-11)  
**Phase Goal:** Persistent storage with PostgreSQL and horizontal scaling with Redis pub/sub

> **Note:** This phase makes the server production-ready with persistent document storage and multi-instance support.

---

## Prerequisites

PostgreSQL and Redis are **required** for this phase. Both are provided via Docker Compose:

```bash
# Start storage dependencies
cd server/csharp
docker compose -f docker-compose.test.yml up -d postgres redis

# Verify services are healthy
docker compose -f docker-compose.test.yml ps
```

**Connection Strings:**
| Service | Connection String |
|---------|------------------|
| PostgreSQL | `Host=localhost;Port=5432;Database=synckit_test;Username=synckit;Password=synckit_test` |
| Redis | `localhost:6379` |

See [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md#test-dependencies-setup) for full Docker Compose configuration.

---

## Work Item Details

### T6-01: Define Storage Abstractions

**Priority:** P0  
**Estimate:** 2 hours  
**Dependencies:** S4-03

#### Description

Ensure storage interfaces support multiple implementations (in-memory, PostgreSQL).

#### Tasks

1. Review `IDocumentStore` interface
2. Add missing methods for persistence
3. Create `IStorageProvider` abstraction
4. Support async enumeration

#### Updated Interfaces

```csharp
// SyncKit.Server/Storage/IStorageProvider.cs
public interface IStorageProvider
{
    IDocumentStore Documents { get; }
    IAwarenessStore Awareness { get; }
    Task InitializeAsync(CancellationToken ct = default);
    Task<HealthCheckResult> CheckHealthAsync(CancellationToken ct = default);
}

// SyncKit.Server/Sync/IDocumentStore.cs (updated)
public interface IDocumentStore
{
    Task<Document> GetOrCreateAsync(string documentId);
    Task<Document?> GetAsync(string documentId);
    Task<bool> ExistsAsync(string documentId);
    Task DeleteAsync(string documentId);
    Task<IReadOnlyList<string>> GetDocumentIdsAsync(int limit = 1000, string? cursor = null);
    Task AddDeltaAsync(string documentId, StoredDelta delta);
    Task<IReadOnlyList<StoredDelta>> GetDeltasSinceAsync(string documentId, VectorClock? since);
    Task<VectorClock> GetVectorClockAsync(string documentId);
    
    // New: for persistence
    Task SaveSnapshotAsync(string documentId, byte[] snapshot, VectorClock clock);
    Task<(byte[]? Snapshot, VectorClock Clock)?> GetSnapshotAsync(string documentId);
    Task CompactDeltasAsync(string documentId, VectorClock upToClock);
}
```

#### Acceptance Criteria

- [ ] IStorageProvider defined
- [ ] IDocumentStore supports snapshots
- [ ] Compaction interface defined
- [ ] Health check supported

---

### T6-02: Create PostgreSQL Document Store

**Priority:** P0  
**Estimate:** 8 hours  
**Dependencies:** T6-01

#### Description

Implement document storage with PostgreSQL using Npgsql.

#### Database Schema

```sql
-- migrations/001_initial_schema.sql
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(255) PRIMARY KEY,
    vector_clock JSONB NOT NULL DEFAULT '{}',
    snapshot BYTEA,
    snapshot_clock JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deltas (
    id VARCHAR(255) PRIMARY KEY,
    document_id VARCHAR(255) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    client_id VARCHAR(255) NOT NULL,
    data JSONB NOT NULL,
    vector_clock JSONB NOT NULL,
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deltas_document_id ON deltas(document_id);
CREATE INDEX idx_deltas_timestamp ON deltas(document_id, timestamp);
```

#### Implementation

```csharp
// SyncKit.Server/Storage/PostgreSqlDocumentStore.cs
public class PostgreSqlDocumentStore : IDocumentStore
{
    private readonly NpgsqlDataSource _dataSource;
    private readonly ILogger<PostgreSqlDocumentStore> _logger;

    public PostgreSqlDocumentStore(
        NpgsqlDataSource dataSource,
        ILogger<PostgreSqlDocumentStore> logger)
    {
        _dataSource = dataSource;
        _logger = logger;
    }

    public async Task<Document> GetOrCreateAsync(string documentId)
    {
        await using var conn = await _dataSource.OpenConnectionAsync();
        
        // Try to get existing
        await using var selectCmd = conn.CreateCommand();
        selectCmd.CommandText = @"
            SELECT vector_clock, snapshot, snapshot_clock 
            FROM documents 
            WHERE id = @id";
        selectCmd.Parameters.AddWithValue("id", documentId);

        await using var reader = await selectCmd.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            var clockJson = reader.GetString(0);
            var clock = JsonSerializer.Deserialize<Dictionary<string, long>>(clockJson) ?? new();
            
            // Load deltas
            var deltas = await GetDeltasAsync(documentId);
            
            return new Document(documentId, VectorClock.FromDict(clock), deltas);
        }
        await reader.CloseAsync();

        // Create new
        await using var insertCmd = conn.CreateCommand();
        insertCmd.CommandText = @"
            INSERT INTO documents (id, vector_clock) 
            VALUES (@id, '{}')
            ON CONFLICT (id) DO NOTHING";
        insertCmd.Parameters.AddWithValue("id", documentId);
        await insertCmd.ExecuteNonQueryAsync();

        _logger.LogDebug("Created new document: {DocumentId}", documentId);
        return new Document(documentId);
    }

    public async Task<Document?> GetAsync(string documentId)
    {
        await using var conn = await _dataSource.OpenConnectionAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT vector_clock FROM documents WHERE id = @id";
        cmd.Parameters.AddWithValue("id", documentId);

        var result = await cmd.ExecuteScalarAsync();
        if (result == null)
        {
            return null;
        }

        var clockJson = (string)result;
        var clock = JsonSerializer.Deserialize<Dictionary<string, long>>(clockJson) ?? new();
        var deltas = await GetDeltasAsync(documentId);
        
        return new Document(documentId, VectorClock.FromDict(clock), deltas);
    }

    public async Task AddDeltaAsync(string documentId, StoredDelta delta)
    {
        await using var conn = await _dataSource.OpenConnectionAsync();
        await using var transaction = await conn.BeginTransactionAsync();

        try
        {
            // Insert delta
            await using var deltaCmd = conn.CreateCommand();
            deltaCmd.Transaction = transaction;
            deltaCmd.CommandText = @"
                INSERT INTO deltas (id, document_id, client_id, data, vector_clock, timestamp)
                VALUES (@id, @docId, @clientId, @data::jsonb, @clock::jsonb, @ts)";
            deltaCmd.Parameters.AddWithValue("id", delta.Id);
            deltaCmd.Parameters.AddWithValue("docId", documentId);
            deltaCmd.Parameters.AddWithValue("clientId", delta.ClientId);
            deltaCmd.Parameters.AddWithValue("data", delta.Data.GetRawText());
            deltaCmd.Parameters.AddWithValue("clock", JsonSerializer.Serialize(delta.VectorClock.ToDict()));
            deltaCmd.Parameters.AddWithValue("ts", delta.Timestamp);
            await deltaCmd.ExecuteNonQueryAsync();

            // Update document vector clock
            await using var docCmd = conn.CreateCommand();
            docCmd.Transaction = transaction;
            docCmd.CommandText = @"
                UPDATE documents 
                SET vector_clock = @clock::jsonb, updated_at = NOW()
                WHERE id = @id";
            
            // Merge clocks - would need to fetch and merge
            var existingClock = await GetVectorClockInternalAsync(conn, transaction, documentId);
            var mergedClock = existingClock.Merge(delta.VectorClock);
            
            docCmd.Parameters.AddWithValue("clock", JsonSerializer.Serialize(mergedClock.ToDict()));
            docCmd.Parameters.AddWithValue("id", documentId);
            await docCmd.ExecuteNonQueryAsync();

            await transaction.CommitAsync();
            
            _logger.LogDebug("Added delta {DeltaId} to document {DocumentId}", delta.Id, documentId);
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<IReadOnlyList<StoredDelta>> GetDeltasSinceAsync(string documentId, VectorClock? since)
    {
        var allDeltas = await GetDeltasAsync(documentId);
        
        if (since == null)
        {
            return allDeltas;
        }

        return allDeltas
            .Where(d => !d.VectorClock.HappensBefore(since) && !d.VectorClock.Equals(since))
            .ToList();
    }

    private async Task<List<StoredDelta>> GetDeltasAsync(string documentId)
    {
        await using var conn = await _dataSource.OpenConnectionAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            SELECT id, client_id, data, vector_clock, timestamp 
            FROM deltas 
            WHERE document_id = @docId 
            ORDER BY timestamp";
        cmd.Parameters.AddWithValue("docId", documentId);

        var deltas = new List<StoredDelta>();
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var clockJson = reader.GetString(3);
            var clockDict = JsonSerializer.Deserialize<Dictionary<string, long>>(clockJson) ?? new();
            
            deltas.Add(new StoredDelta
            {
                Id = reader.GetString(0),
                ClientId = reader.GetString(1),
                Data = JsonDocument.Parse(reader.GetString(2)).RootElement,
                VectorClock = VectorClock.FromDict(clockDict),
                Timestamp = reader.GetInt64(4)
            });
        }
        return deltas;
    }

    public async Task SaveSnapshotAsync(string documentId, byte[] snapshot, VectorClock clock)
    {
        await using var conn = await _dataSource.OpenConnectionAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            UPDATE documents 
            SET snapshot = @snapshot, snapshot_clock = @clock::jsonb, updated_at = NOW()
            WHERE id = @id";
        cmd.Parameters.AddWithValue("snapshot", snapshot);
        cmd.Parameters.AddWithValue("clock", JsonSerializer.Serialize(clock.ToDict()));
        cmd.Parameters.AddWithValue("id", documentId);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task CompactDeltasAsync(string documentId, VectorClock upToClock)
    {
        // Delete deltas that are included in snapshot
        await using var conn = await _dataSource.OpenConnectionAsync();
        await using var cmd = conn.CreateCommand();
        
        // This is a simplification - real implementation would check vector clock ordering
        cmd.CommandText = @"
            DELETE FROM deltas 
            WHERE document_id = @docId 
            AND timestamp <= @maxTs";
        
        // Get max timestamp from upToClock entries
        var maxTimestamp = upToClock.Entries.Values.DefaultIfEmpty(0).Max();
        cmd.Parameters.AddWithValue("docId", documentId);
        cmd.Parameters.AddWithValue("maxTs", maxTimestamp);
        
        var deleted = await cmd.ExecuteNonQueryAsync();
        _logger.LogInformation(
            "Compacted {Count} deltas for document {DocumentId}", 
            deleted, documentId);
    }

    // ... other methods (Delete, Exists, etc.)
}
```

#### Acceptance Criteria

- [ ] Documents stored in PostgreSQL
- [ ] Deltas stored with vector clocks
- [ ] Snapshot storage works
- [ ] Compaction removes old deltas
- [ ] Connection pooling used
- [ ] Transactions for consistency

---

### T6-03: Add Database Migrations

**Priority:** P0  
**Estimate:** 3 hours  
**Dependencies:** T6-02

#### Description

Set up database migration system for schema management.

#### Tasks

1. Create migrations folder structure
2. Implement migration runner
3. Create initial schema migration
4. Add startup migration execution

#### Implementation

```csharp
// SyncKit.Server/Storage/Migrations/IMigrationRunner.cs
public interface IMigrationRunner
{
    Task RunMigrationsAsync(CancellationToken ct = default);
}

// SyncKit.Server/Storage/Migrations/MigrationRunner.cs
public class MigrationRunner : IMigrationRunner
{
    private readonly NpgsqlDataSource _dataSource;
    private readonly ILogger<MigrationRunner> _logger;

    public MigrationRunner(NpgsqlDataSource dataSource, ILogger<MigrationRunner> logger)
    {
        _dataSource = dataSource;
        _logger = logger;
    }

    public async Task RunMigrationsAsync(CancellationToken ct = default)
    {
        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        
        // Create migrations table
        await using var createTableCmd = conn.CreateCommand();
        createTableCmd.CommandText = @"
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(255) PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )";
        await createTableCmd.ExecuteNonQueryAsync(ct);

        // Get applied migrations
        await using var getAppliedCmd = conn.CreateCommand();
        getAppliedCmd.CommandText = "SELECT version FROM schema_migrations";
        var applied = new HashSet<string>();
        await using var reader = await getAppliedCmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            applied.Add(reader.GetString(0));
        }
        await reader.CloseAsync();

        // Get migration files (embedded resources or from disk)
        var migrations = GetMigrations();

        foreach (var (version, sql) in migrations.OrderBy(m => m.Version))
        {
            if (applied.Contains(version))
            {
                continue;
            }

            _logger.LogInformation("Applying migration: {Version}", version);

            await using var transaction = await conn.BeginTransactionAsync(ct);
            try
            {
                await using var migrationCmd = conn.CreateCommand();
                migrationCmd.Transaction = transaction;
                migrationCmd.CommandText = sql;
                await migrationCmd.ExecuteNonQueryAsync(ct);

                await using var recordCmd = conn.CreateCommand();
                recordCmd.Transaction = transaction;
                recordCmd.CommandText = "INSERT INTO schema_migrations (version) VALUES (@v)";
                recordCmd.Parameters.AddWithValue("v", version);
                await recordCmd.ExecuteNonQueryAsync(ct);

                await transaction.CommitAsync(ct);
                _logger.LogInformation("Applied migration: {Version}", version);
            }
            catch
            {
                await transaction.RollbackAsync(ct);
                throw;
            }
        }
    }

    private IEnumerable<(string Version, string Sql)> GetMigrations()
    {
        // Load from embedded resources
        var assembly = typeof(MigrationRunner).Assembly;
        var prefix = "SyncKit.Server.Storage.Migrations.Scripts.";

        foreach (var name in assembly.GetManifestResourceNames()
            .Where(n => n.StartsWith(prefix) && n.EndsWith(".sql"))
            .OrderBy(n => n))
        {
            using var stream = assembly.GetManifestResourceStream(name)!;
            using var reader = new StreamReader(stream);
            var sql = reader.ReadToEnd();
            var version = name.Replace(prefix, "").Replace(".sql", "");
            yield return (version, sql);
        }
    }
}
```

#### Migration Files

```
SyncKit.Server/
  Storage/
    Migrations/
      Scripts/
        001_initial_schema.sql
        002_add_indexes.sql
```

#### Acceptance Criteria

- [ ] Migrations tracked in database
- [ ] Only unapplied migrations run
- [ ] Migrations run in order
- [ ] Rollback on failure
- [ ] Startup migration execution

---

### T6-04: Create Redis Pub/Sub Provider

**Priority:** P0  
**Estimate:** 6 hours  
**Dependencies:** S4-06, W5-03

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
        services.AddSingleton<IDocumentStore, InMemoryDocumentStore>();
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
        services.AddSingleton<IDocumentStore, PostgreSqlDocumentStore>();
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
1. **Docker Compose services** (recommended for CI/CD and full validation)
2. **Testcontainers** (for isolated unit-style integration tests)

#### Prerequisites

Start test dependencies via Docker Compose before running storage tests:

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
| T6-01 | Define storage abstractions | P0 | 2 | ⬜ |
| T6-02 | Create PostgreSQL document store | P0 | 8 | ⬜ |
| T6-03 | Add database migrations | P0 | 3 | ⬜ |
| T6-04 | Create Redis pub/sub provider | P0 | 6 | ⬜ |
| T6-05 | Create storage provider factory | P0 | 3 | ⬜ |
| T6-06 | Add health checks for storage | P1 | 2 | ⬜ |
| T6-07 | Storage integration tests | P0 | 6 | ⬜ |
| **Total** | | | **30** | |

**Legend:** ⬜ Not Started | 🔄 In Progress | ✅ Complete

---

## Phase 6 Validation

After completing Phase 6, the following should work:

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

3. **Health Checks**
   ```bash
   curl http://localhost:8080/health/ready
   # {"status":"Healthy","results":{"postgresql":{"status":"Healthy"},"redis":{"status":"Healthy"}}}
   ```
