## Plan: C# Server Performance Bottleneck Remediation

The C# server's poor metrics (10x fewer connections, 26x worse latency) stem from **6 critical anti-patterns**: `async void` message handling, coarse document locking, O(n) connection filtering, double semaphore throttling, reflection-based JSON serialization, and hot-path allocations. This plan prioritizes fixes by impact.

### Steps

- [ ] 1. **Replace `async void HandleMessage` with bounded Channel pipeline** in [WebSocketMiddleware.cs](/Users/core/git/matthewcorven/synckit/server/csharp/src/SyncKit.Server/WebSocket/WebSocketMiddleware.cs#L175)—use `Channel<T>.CreateBounded` with backpressure, `await` message processing to prevent thread pool exhaustion.

- [ ] 2. **Replace coarse `lock` with `ReaderWriterLockSlim`** in [Document.cs](/Users/core/git/matthewcorven/synckit/server/csharp/src/SyncKit.Server/Storage/Document.cs)—allow concurrent reads for `BuildState()` and `GetDeltasSince()`, only exclusive-lock on `AddDelta()`.

- [ ] 3. **Add document→connection index** in [DefaultConnectionManager.cs](/Users/core/git/matthewcorven/synckit/server/csharp/src/SyncKit.Server/WebSocket/DefaultConnectionManager.cs)—maintain `ConcurrentDictionary<string, ConcurrentBag<IConnection>>` for O(1) document subscriber lookups instead of O(n) filtering.

- [ ] 4. **Remove double semaphore throttling**—eliminate redundant semaphore in either middleware accept or connection creation; increase limits from 100→5000 concurrent accepts.

- [ ] 5. **Implement JSON source generators** in [JsonProtocolHandler.cs](/Users/core/git/matthewcorven/synckit/server/csharp/src/SyncKit.Server/Protocol/JsonProtocolHandler.cs)—add `[JsonSerializable]` context for all message types to eliminate reflection overhead.

- [ ] 6. **Pool byte arrays with `ArrayPool<byte>`** in [BinaryProtocolHandler.cs](/Users/core/git/matthewcorven/synckit/server/csharp/src/SyncKit.Server/Protocol/BinaryProtocolHandler.cs)—rent/return buffers instead of `new byte[]` allocations in hot paths.

### Further Considerations

- [ ] 1. **Thread-safe subscriptions?** The `HashSet<string>` in `WebSocketConnection._subscribedDocuments` has race conditions—replace with `ConcurrentDictionary<string, byte>` or add locking.

- [ ] 2. **Parallel broadcast sends?** Current sequential `foreach` in `BroadcastToDocumentAsync` could use `Parallel.ForEachAsync` or `Task.WhenAll` for concurrent WebSocket sends.

- [ ] 3. **Unbounded send queue?** [WebSocketConnection.cs](/Users/core/git/matthewcorven/synckit/server/csharp/src/SyncKit.Server/WebSocket/WebSocketConnection.cs#L85) uses `Channel.CreateUnbounded`—consider bounded channel with `BoundedChannelFullMode.DropOldest` to prevent memory exhaustion under load.
