using System.Diagnostics;

namespace SyncKit.Server.Health;

/// <summary>
/// Service for collecting and providing server statistics.
/// </summary>
public interface IServerStatsService
{
    /// <summary>
    /// Gets the current uptime in seconds.
    /// </summary>
    long GetUptimeSeconds();

    /// <summary>
    /// Gets current server statistics.
    /// </summary>
    HealthStats GetStats();

    /// <summary>
    /// Increments the connection count.
    /// </summary>
    void IncrementConnections();

    /// <summary>
    /// Decrements the connection count.
    /// </summary>
    void DecrementConnections();

    /// <summary>
    /// Increments the document count.
    /// </summary>
    void IncrementDocuments();

    /// <summary>
    /// Decrements the document count.
    /// </summary>
    void DecrementDocuments();

    /// <summary>
    /// Sets the document count.
    /// </summary>
    void SetDocumentCount(int count);

    /// <summary>
    /// Sets the connection count.
    /// </summary>
    void SetConnectionCount(int count);
}

/// <summary>
/// Default implementation of server statistics service.
/// Thread-safe for concurrent access from WebSocket handlers.
/// </summary>
public class ServerStatsService : IServerStatsService
{
    private readonly Stopwatch _uptimeStopwatch;
    private int _connectionCount;
    private int _documentCount;

    public ServerStatsService()
    {
        _uptimeStopwatch = Stopwatch.StartNew();
    }

    /// <inheritdoc />
    public long GetUptimeSeconds()
    {
        return (long)_uptimeStopwatch.Elapsed.TotalSeconds;
    }

    /// <inheritdoc />
    public HealthStats GetStats()
    {
        var stats = new HealthStats
        {
            Connections = _connectionCount,
            Documents = _documentCount,
            MemoryUsage = GetMemoryUsage(),
            GcGen0Collections = GC.CollectionCount(0),
            GcGen1Collections = GC.CollectionCount(1),
            GcGen2Collections = GC.CollectionCount(2)
        };

        ThreadPool.GetAvailableThreads(out var worker, out var io);
        ThreadPool.GetMaxThreads(out var maxWorker, out var maxIo);

        // Convert CPU times to milliseconds (Process.TotalProcessorTime is TimeSpan)
        var cpuTotalMs = Process.GetCurrentProcess().TotalProcessorTime.TotalMilliseconds;

        // Aggregate connection-level metrics if ConnectionManager is available
        long totalEnqueued = 0, totalSent = 0, totalReceived = 0;
        int totalSendQueueDepth = 0;

        try
        {
            // Attempt to fetch the ConnectionManager from the global service provider
            var provider = Program.ServiceProvider;
            var connManager = provider?.GetService<SyncKit.Server.WebSockets.IConnectionManager>();
            if (connManager is SyncKit.Server.WebSockets.ConnectionManager cm)
            {
                var conns = cm.GetAllConnections();
                foreach (var c in conns)
                {
                    if (c is SyncKit.Server.WebSockets.Connection concrete)
                    {
                        totalEnqueued += concrete.MessagesEnqueued;
                        totalSent += concrete.MessagesSent;
                        totalReceived += concrete.MessagesReceived;
                        totalSendQueueDepth += concrete.SendQueueDepth;
                    }
                }
            }
        }
        catch
        {
            // Best-effort only; do not crash health check if diagnostics fail
        }

        return stats with
        {
            ThreadPoolAvailableWorkerThreads = worker,
            ThreadPoolAvailableCompletionPortThreads = io,
            ThreadPoolMaxWorkerThreads = maxWorker,
            ThreadPoolMaxCompletionPortThreads = maxIo,
            ProcessCpuTotalMs = cpuTotalMs,
            TotalMessagesEnqueued = totalEnqueued,
            TotalMessagesSent = totalSent,
            TotalMessagesReceived = totalReceived,
            TotalSendQueueDepth = totalSendQueueDepth
        };
    }

    /// <inheritdoc />
    public void IncrementConnections()
    {
        Interlocked.Increment(ref _connectionCount);
    }

    /// <inheritdoc />
    public void DecrementConnections()
    {
        Interlocked.Decrement(ref _connectionCount);
    }

    /// <inheritdoc />
    public void IncrementDocuments()
    {
        Interlocked.Increment(ref _documentCount);
    }

    /// <inheritdoc />
    public void DecrementDocuments()
    {
        Interlocked.Decrement(ref _documentCount);
    }

    /// <inheritdoc />
    public void SetDocumentCount(int count)
    {
        Interlocked.Exchange(ref _documentCount, count);
    }

    /// <inheritdoc />
    public void SetConnectionCount(int count)
    {
        Interlocked.Exchange(ref _connectionCount, count);
    }

    private static long GetMemoryUsage()
    {
        // Get total memory allocated to the managed heap
        // This includes Gen0, Gen1, Gen2, and LOH
        return GC.GetTotalMemory(forceFullCollection: false);
    }
}
