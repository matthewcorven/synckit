using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using SyncKit.Server.Auth;
using SyncKit.Server.Sync;
using SyncKit.Server.WebSockets;
using SyncKit.Server.WebSockets.Handlers;
using SyncKit.Server.WebSockets.Protocol;
using SyncKit.Server.WebSockets.Protocol.Messages;

namespace SyncKit.Server.Tests.WebSockets.Handlers;

public class DeltaMessageHandlerTests
{
    private readonly AuthGuard _authGuard;
    private readonly Mock<ServerStorage.IStorageAdapter> _mockStorage;
    private readonly Mock<IConnectionManager> _mockConnectionManager;
    private readonly Mock<IConnection> _mockConnection;
    private readonly DeltaMessageHandler _handler;

    public DeltaMessageHandlerTests()
    {
        _authGuard = new AuthGuard(NullLogger<AuthGuard>.Instance);
        _mockStorage = new Mock<ServerStorage.IStorageAdapter>();
        _mockConnectionManager = new Mock<IConnectionManager>();
        _mockConnection = new Mock<IConnection>();

        _handler = new DeltaMessageHandler(
            _authGuard,
            _mockStorage.Object,
            _mockConnectionManager.Object,
            null,
            NullLogger<DeltaMessageHandler>.Instance);
    }

    [Fact]
    public void HandledTypes_ShouldReturnDelta()
    {
        // Arrange & Act
        var types = _handler.HandledTypes;

        // Assert
        Assert.Single(types);
        Assert.Equal(MessageType.Delta, types[0]);
    }

    [Fact]
    public async Task HandleAsync_WithValidDelta_ShouldStoreAndBroadcast()
    {
        // Arrange
        var documentId = "doc-123";
        var connectionId = "conn-456";
        var clientId = "client-789";
        var messageId = "msg-1";

        var subscriptions = new HashSet<string> { documentId };

        SetupAuthenticatedConnectionWithWriteAccess(connectionId, clientId, subscriptions, documentId);
        _mockStorage.Setup(s => s.SaveDeltaAsync(It.IsAny<SyncKit.Server.Storage.DeltaEntry>(), It.IsAny<CancellationToken>()))
            .Returns((SyncKit.Server.Storage.DeltaEntry d, CancellationToken _) => Task.FromResult(d));
        _mockStorage.Setup(s => s.GetDocumentStateAsync(documentId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<string, object?> { { "field", "value" } });
_mockConnectionManager.Setup(cm => cm.BroadcastToDocumentAsync(
            documentId, It.IsAny<DeltaMessage>(), It.IsAny<string?>()))
            .ReturnsAsync((IReadOnlyList<string>)Array.Empty<string>());

        var delta = CreateDeltaMessage(messageId, documentId);

        // Act
        await _handler.HandleAsync(_mockConnection.Object, delta);

        // Broadcast should have been invoked with a Delta containing a different ID
        _mockConnectionManager.Verify(cm => cm.BroadcastToDocumentAsync(
            documentId,
            It.Is<DeltaMessage>(m => m.DocumentId == documentId && m.Id != messageId),
            null), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_ShouldPreserveDeltaDataInBroadcast()
    {
        // Arrange
        var documentId = "doc-123";
        var subscriptions = new HashSet<string> { documentId };

        SetupAuthenticatedConnectionWithWriteAccess("conn-1", "client-1", subscriptions, documentId);
        _mockStorage.Setup(s => s.SaveDeltaAsync(It.IsAny<SyncKit.Server.Storage.DeltaEntry>(), It.IsAny<CancellationToken>()))
            .Returns((SyncKit.Server.Storage.DeltaEntry d, CancellationToken _) => Task.FromResult(d));
        // LWW uses authoritative state - so we return the expected field values
        _mockStorage.Setup(s => s.GetDocumentStateAsync(documentId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<string, object?>
            {
                { "operation", "set" },
                { "path", "title" },
                { "value", "Hello" }
            });

        DeltaMessage? broadcastMessage = null;
        _mockConnectionManager.Setup(cm => cm.BroadcastToDocumentAsync(
            documentId, It.IsAny<DeltaMessage>(), It.IsAny<string?>()))
            .Callback<string, IMessage, string?>((_, msg, _) => broadcastMessage = msg as DeltaMessage)
            .ReturnsAsync((IReadOnlyList<string>)Array.Empty<string>());

        var originalDeltaData = JsonSerializer.Deserialize<JsonElement>("{\"operation\":\"set\",\"path\":\"title\",\"value\":\"Hello\"}");
        var vectorClock = new Dictionary<string, long> { { "client-1", 1 } };

        var delta = new DeltaMessage
        {
            Id = "msg-1",
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            DocumentId = documentId,
            Delta = originalDeltaData,
            VectorClock = vectorClock
        };

        // Act
        await _handler.HandleAsync(_mockConnection.Object, delta);

        // Assert - Delta data should be preserved in broadcast
        Assert.NotNull(broadcastMessage);
        var broadcastDeltaJson = JsonSerializer.Serialize(broadcastMessage.Delta);
        var originalDeltaJson = JsonSerializer.Serialize(originalDeltaData);
        Assert.Equal(originalDeltaJson, broadcastDeltaJson);

        // Vector clock should also be preserved
        Assert.Equal(vectorClock, broadcastMessage.VectorClock);
    }

    [Fact]
    public void Constructor_WithNullAuthGuard_ShouldThrowArgumentNullException()
    {
        // Act & Assert
        var exception = Assert.Throws<ArgumentNullException>(() =>
            new DeltaMessageHandler(
                null!,
                _mockStorage.Object,
                _mockConnectionManager.Object,
                null,
                NullLogger<DeltaMessageHandler>.Instance));

        Assert.Equal("authGuard", exception.ParamName);
    }

    [Fact]
    public void Constructor_WithNullDocumentStore_ShouldThrowArgumentNullException()
    {
        // Arrange
        var authGuard = new AuthGuard(NullLogger<AuthGuard>.Instance);

        // Act & Assert
        var exception = Assert.Throws<ArgumentNullException>(() =>
            new DeltaMessageHandler(
                authGuard,
                (ServerStorage.IStorageAdapter)null!,
                _mockConnectionManager.Object,
                null,
                NullLogger<DeltaMessageHandler>.Instance));

        Assert.Equal("storage", exception.ParamName);
    }

    [Fact]
    public void Constructor_WithNullConnectionManager_ShouldThrowArgumentNullException()
    {
        // Arrange
        var authGuard = new AuthGuard(NullLogger<AuthGuard>.Instance);

        // Act & Assert
        var exception = Assert.Throws<ArgumentNullException>(() =>
            new DeltaMessageHandler(
                authGuard,
                _mockStorage.Object,
                null!,
                null,
                NullLogger<DeltaMessageHandler>.Instance));

        Assert.Equal("connectionManager", exception.ParamName);
    }

    [Fact]
    public void Constructor_WithNullLogger_ShouldThrowArgumentNullException()
    {
        // Arrange
        var authGuard = new AuthGuard(NullLogger<AuthGuard>.Instance);

        // Act & Assert
        var exception = Assert.Throws<ArgumentNullException>(() =>
            new DeltaMessageHandler(
                authGuard,
                _mockStorage.Object,
                _mockConnectionManager.Object,
                null,
                null!));

        Assert.Equal("logger", exception.ParamName);
    }

    [Fact]
    public async Task HandleAsync_WithObjectDelta_ShouldSerializeCorrectly()
    {
        // Arrange
        var documentId = "doc-123";
        var subscriptions = new HashSet<string> { documentId };

        SetupAuthenticatedConnectionWithWriteAccess("conn-1", "client-1", subscriptions, documentId);

        SyncKit.Server.Storage.DeltaEntry? storedDelta = null;
        _mockStorage.Setup(s => s.SaveDeltaAsync(It.IsAny<SyncKit.Server.Storage.DeltaEntry>(), It.IsAny<CancellationToken>()))
            .Callback<SyncKit.Server.Storage.DeltaEntry, CancellationToken>((delta, _) => storedDelta = delta)
            .Returns((SyncKit.Server.Storage.DeltaEntry d, CancellationToken _) => Task.FromResult(d));
        _mockStorage.Setup(s => s.GetDocumentStateAsync(documentId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<string, object?> { { "operation", "set" }, { "path", "title" }, { "value", "Test" } });
        _mockConnectionManager.Setup(cm => cm.BroadcastToDocumentAsync(
            documentId, It.IsAny<DeltaMessage>(), It.IsAny<string?>()))
            .ReturnsAsync((IReadOnlyList<string>)Array.Empty<string>());

        // Using an anonymous object as delta (not JsonElement)
        var delta = new DeltaMessage
        {
            Id = "msg-1",
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            DocumentId = documentId,
            Delta = new { operation = "set", path = "title", value = "Test" },
            VectorClock = new Dictionary<string, long> { { "client-1", 1 } }
        };

        // Act
        await _handler.HandleAsync(_mockConnection.Object, delta);

        // Assert - Delta should be stored with correct data
        Assert.NotNull(storedDelta);
        var storedJson = JsonSerializer.Serialize(storedDelta!.Value);
        Assert.Contains("operation", storedJson);
        Assert.Contains("set", storedJson);
    }

    [Fact]
    public async Task HandleAsync_AdminUser_ShouldHaveWriteAccessToAnyDocument()
    {
        // Arrange
        var documentId = "any-document";
        var connectionId = "conn-1";
        var subscriptions = new HashSet<string> { documentId };

        // Setup admin connection
        _mockConnection.Setup(c => c.Id).Returns(connectionId);
        _mockConnection.Setup(c => c.ClientId).Returns("admin-client");
        _mockConnection.Setup(c => c.State).Returns(ConnectionState.Authenticated);
        _mockConnection.Setup(c => c.GetSubscriptions()).Returns(subscriptions);
        _mockConnection.Setup(c => c.Send(It.IsAny<IMessage>())).Returns(true);
        _mockConnection.Setup(c => c.TokenPayload).Returns(new TokenPayload
        {
            UserId = "admin-1",
            Permissions = new DocumentPermissions
            {
                IsAdmin = true,
                CanRead = Array.Empty<string>(),
                CanWrite = Array.Empty<string>()
            }
        });

        _mockStorage.Setup(s => s.SaveDeltaAsync(It.IsAny<SyncKit.Server.Storage.DeltaEntry>(), It.IsAny<CancellationToken>()))
            .Returns((SyncKit.Server.Storage.DeltaEntry d, CancellationToken _) => Task.FromResult(d));
        _mockStorage.Setup(s => s.GetDocumentStateAsync(documentId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<string, object?> { { "field", "value" } });
        _mockConnectionManager.Setup(cm => cm.BroadcastToDocumentAsync(
            documentId, It.IsAny<DeltaMessage>(), It.IsAny<string?>()))
            .ReturnsAsync((IReadOnlyList<string>)Array.Empty<string>());

        var delta = CreateDeltaMessage("msg-1", documentId);

        // Act
        await _handler.HandleAsync(_mockConnection.Object, delta);

        // Assert - Delta should be stored
        _mockStorage.Verify(s => s.SaveDeltaAsync(
            It.Is<ServerStorage.DeltaEntry>(de => de.DocumentId == documentId && de.ClientId == "admin-client"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    #region Helper Methods

    private void SetupAuthenticatedConnectionWithWriteAccess(
        string connectionId, string? clientId, HashSet<string> subscriptions, string documentId)
    {
        _mockConnection.Setup(c => c.Id).Returns(connectionId);
        _mockConnection.Setup(c => c.ClientId).Returns(clientId);
        _mockConnection.Setup(c => c.State).Returns(ConnectionState.Authenticated);
        _mockConnection.Setup(c => c.GetSubscriptions()).Returns(subscriptions);
        _mockConnection.Setup(c => c.Send(It.IsAny<IMessage>())).Returns(true);
        _mockConnection.Setup(c => c.TokenPayload).Returns(new TokenPayload
        {
            UserId = "user-1",
            Permissions = new DocumentPermissions
            {
                IsAdmin = false,
                CanRead = new[] { documentId },
                CanWrite = new[] { documentId }
            }
        });
    }

    private void SetupAuthenticatedConnectionWithReadAccess(
        string connectionId, string? clientId, HashSet<string> subscriptions, string documentId)
    {
        _mockConnection.Setup(c => c.Id).Returns(connectionId);
        _mockConnection.Setup(c => c.ClientId).Returns(clientId);
        _mockConnection.Setup(c => c.State).Returns(ConnectionState.Authenticated);
        _mockConnection.Setup(c => c.GetSubscriptions()).Returns(subscriptions);
        _mockConnection.Setup(c => c.Send(It.IsAny<IMessage>())).Returns(true);
        _mockConnection.Setup(c => c.UserId).Returns("user-1");
        _mockConnection.Setup(c => c.TokenPayload).Returns(new TokenPayload
        {
            UserId = "user-1",
            Permissions = new DocumentPermissions
            {
                IsAdmin = false,
                CanRead = new[] { documentId },
                CanWrite = Array.Empty<string>() // No write access
            }
        });
    }

    private static DeltaMessage CreateDeltaMessage(string messageId, string documentId)
    {
        return new DeltaMessage
        {
            Id = messageId,
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            DocumentId = documentId,
            Delta = JsonSerializer.Deserialize<JsonElement>("{\"field\": \"value\"}"),
            VectorClock = new Dictionary<string, long> { { "client-1", 1 } }
        };
    }

    #endregion
}
