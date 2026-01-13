using Microsoft.Extensions.Logging;
using Moq;
using SyncKit.Server.Awareness;
using SyncKit.Server.WebSockets;
using SyncKit.Server.WebSockets.Protocol;
using SyncKit.Server.WebSockets.Protocol.Messages;
using System.Text.Json;

namespace SyncKit.Server.Tests.Awareness;

public class AwarenessCleanupServiceTests
{
    [Fact]
    public void Constructor_WithNullDependencies_Throws()
    {
        var logger = new Mock<ILogger<AwarenessCleanupService>>().Object;
        var store = new Mock<IAwarenessStore>().Object;
        var cm = new Mock<IConnectionManager>().Object;

        Assert.Throws<ArgumentNullException>(() => new AwarenessCleanupService(null!, cm, logger));
        Assert.Throws<ArgumentNullException>(() => new AwarenessCleanupService(store, null!, logger));
        Assert.Throws<ArgumentNullException>(() => new AwarenessCleanupService(store, cm, null!));
    }

    [Fact]
    public async Task RunCleanupOnceAsync_BroadcastsAndPrunesExpiredEntries()
    {
        // Arrange
        var documentId = "doc-1";
        var clientId = "conn-1";

        var state = AwarenessState.Create(clientId, TestHelpers.ToNullableJsonElement(new { cursor = new { x = 1 } }), 5);
        var entry = AwarenessEntry.FromState(documentId, state, timeoutMs: 1);
        // force it to be expired
        entry.ExpiresAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - 1000;

        var mockStore = new Mock<IAwarenessStore>();
        mockStore.Setup(s => s.GetExpiredAsync()).ReturnsAsync(new List<AwarenessEntry> { entry });
        mockStore.Setup(s => s.PruneExpiredAsync()).Returns(Task.CompletedTask);

var mockConnManager = new Mock<IConnectionManager>();
        mockConnManager.Setup(cm => cm.BroadcastToDocumentAsync(It.IsAny<string>(), It.IsAny<IMessage>(), It.IsAny<string?>())).ReturnsAsync((IReadOnlyList<string>)Array.Empty<string>());


        var logger = new Mock<ILogger<AwarenessCleanupService>>().Object;

        var service = new AwarenessCleanupService(mockStore.Object, mockConnManager.Object, logger, TimeSpan.FromMilliseconds(10));

        await service.StartAsync(CancellationToken.None);
        // Let it run a few iterations
        await Task.Delay(100);
        await service.StopAsync(CancellationToken.None);

        // Verify broadcast happened at least once and prune called
        mockConnManager.Verify(cm => cm.BroadcastToDocumentAsync(documentId, It.IsAny<IMessage>(), null), Times.AtLeastOnce);
        mockStore.Verify(s => s.PruneExpiredAsync(), Times.AtLeastOnce);
    }

    [Fact]
    public async Task ExecuteAsync_GracefulShutdownStopsService()
    {
        var mockStore = new Mock<IAwarenessStore>();
        mockStore.Setup(s => s.GetExpiredAsync()).ReturnsAsync(new List<AwarenessEntry>());

        var mockConnManager = new Mock<IConnectionManager>();
        var logger = new Mock<ILogger<AwarenessCleanupService>>().Object;

        var service = new AwarenessCleanupService(mockStore.Object, mockConnManager.Object, logger, TimeSpan.FromSeconds(1)); // long interval

        await service.StartAsync(CancellationToken.None);

        var sw = System.Diagnostics.Stopwatch.StartNew();
        await service.StopAsync(CancellationToken.None);
        sw.Stop();

        Assert.True(sw.ElapsedMilliseconds < 500, $"StopAsync took too long: {sw.ElapsedMilliseconds}ms");
    }
}
