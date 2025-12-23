using System.Net.WebSockets;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using SyncKit.Server.Configuration;
using SyncKit.Server.WebSockets;
using SyncKit.Server.WebSockets.Protocol;
using Xunit;

namespace SyncKit.Server.Tests.WebSockets;

/// <summary>
/// Tests for authentication timeout functionality.
/// Validates that unauthenticated connections are terminated after the configured timeout.
/// </summary>
public class AuthTimeoutTests : IDisposable
{
    private readonly Mock<WebSocket> _webSocket;
    private readonly Mock<IProtocolHandler> _jsonHandler;
    private readonly Mock<IProtocolHandler> _binaryHandler;
    private readonly Mock<ILogger<Connection>> _logger;
    private readonly SyncKitConfig _config;
    private Connection? _connection;

    public AuthTimeoutTests()
    {
        _webSocket = new Mock<WebSocket>();
        _jsonHandler = new Mock<IProtocolHandler>();
        _binaryHandler = new Mock<IProtocolHandler>();
        _logger = new Mock<ILogger<Connection>>();

        // Default config with short timeout for faster tests
        _config = new SyncKitConfig
        {
            AuthRequired = true,
            AuthTimeoutMs = 1000, // 1 second for tests
            WsHeartbeatInterval = 30000,
            WsHeartbeatTimeout = 60000
        };

        _webSocket.Setup(ws => ws.State).Returns(WebSocketState.Open);
    }

    public void Dispose()
    {
        if (_connection != null)
        {
            _connection.DisposeAsync().AsTask().Wait();
        }
    }

    private Connection CreateConnection()
    {
        var options = Options.Create(_config);
        return new Connection(
            _webSocket.Object,
            "test-conn-1",
            _jsonHandler.Object,
            _binaryHandler.Object,
            options,
            _logger.Object);
    }

    [Fact]
    public async Task StartAuthTimeout_AuthRequired_StartsTimeout()
    {
        // Arrange
        _connection = CreateConnection();

        // Act
        _connection.StartAuthTimeout();

        // Assert - wait slightly longer than timeout
        await Task.Delay(_config.AuthTimeoutMs + 200);

        // Verify connection was closed due to timeout
        _webSocket.Verify(ws => ws.CloseAsync(
            WebSocketCloseStatus.PolicyViolation,
            It.Is<string>(s => s.Contains("timeout")),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task StartAuthTimeout_AuthNotRequired_DoesNotStartTimeout()
    {
        // Arrange
        _config.AuthRequired = false;
        _connection = CreateConnection();

        // Act
        _connection.StartAuthTimeout();

        // Assert - wait for would-be timeout
        await Task.Delay(_config.AuthTimeoutMs + 200);

        // Verify connection was NOT closed
        _webSocket.Verify(ws => ws.CloseAsync(
            It.IsAny<WebSocketCloseStatus>(),
            It.IsAny<string>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task StartAuthTimeout_AlreadyAuthenticated_DoesNotStartTimeout()
    {
        // Arrange
        _connection = CreateConnection();
        _connection.State = ConnectionState.Authenticated;

        // Act
        _connection.StartAuthTimeout();

        // Assert - wait for would-be timeout
        await Task.Delay(_config.AuthTimeoutMs + 200);

        // Verify connection was NOT closed
        _webSocket.Verify(ws => ws.CloseAsync(
            It.IsAny<WebSocketCloseStatus>(),
            It.IsAny<string>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CancelAuthTimeout_BeforeTimeout_PreventsClose()
    {
        // Arrange
        _connection = CreateConnection();
        _connection.StartAuthTimeout();

        // Act - cancel before timeout expires
        await Task.Delay(_config.AuthTimeoutMs / 2);
        _connection.CancelAuthTimeout();

        // Wait past the original timeout
        await Task.Delay(_config.AuthTimeoutMs);

        // Assert - connection should NOT be closed
        _webSocket.Verify(ws => ws.CloseAsync(
            It.IsAny<WebSocketCloseStatus>(),
            It.IsAny<string>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task AuthenticateAfterTimeout_DoesNotPreventClose()
    {
        // Arrange
        _connection = CreateConnection();
        _connection.StartAuthTimeout();

        // Act - authenticate after timeout expires
        await Task.Delay(_config.AuthTimeoutMs + 200);
        _connection.State = ConnectionState.Authenticated;
        _connection.CancelAuthTimeout();

        // Assert - connection should have been closed already
        _webSocket.Verify(ws => ws.CloseAsync(
            WebSocketCloseStatus.PolicyViolation,
            It.Is<string>(s => s.Contains("timeout")),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task AuthTimeout_WithAuthentication_DoesNotClose()
    {
        // Arrange
        _connection = CreateConnection();
        _connection.StartAuthTimeout();

        // Act - authenticate before timeout
        await Task.Delay(_config.AuthTimeoutMs / 2);
        _connection.State = ConnectionState.Authenticated;
        _connection.CancelAuthTimeout();

        // Wait past timeout
        await Task.Delay(_config.AuthTimeoutMs);

        // Assert - connection should NOT be closed
        _webSocket.Verify(ws => ws.CloseAsync(
            It.IsAny<WebSocketCloseStatus>(),
            It.IsAny<string>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task MultipleAuthTimeouts_OnlyCancelsOnce()
    {
        // Arrange
        _connection = CreateConnection();

        // Act - start timeout multiple times
        _connection.StartAuthTimeout();
        _connection.StartAuthTimeout(); // Should be no-op if already authenticated

        await Task.Delay(100);

        // Cancel multiple times
        _connection.CancelAuthTimeout();
        _connection.CancelAuthTimeout(); // Should be safe to call multiple times

        await Task.Delay(_config.AuthTimeoutMs);

        // Assert - should not throw and connection should be closed once
        _webSocket.Verify(ws => ws.CloseAsync(
            It.IsAny<WebSocketCloseStatus>(),
            It.IsAny<string>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Dispose_CancelsAuthTimeout()
    {
        // Arrange
        _connection = CreateConnection();
        _connection.StartAuthTimeout();

        // Act - dispose before timeout
        await Task.Delay(_config.AuthTimeoutMs / 2);
        await _connection.DisposeAsync();
        _connection = null; // Prevent double dispose in cleanup

        // Wait past timeout
        await Task.Delay(_config.AuthTimeoutMs);

        // Assert - dispose should have cleaned up, only one close call
        _webSocket.Verify(ws => ws.CloseAsync(
            It.IsAny<WebSocketCloseStatus>(),
            It.IsAny<string>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task AuthTimeout_LogsWarning_OnExpiry()
    {
        // Arrange
        _connection = CreateConnection();

        // Act
        _connection.StartAuthTimeout();
        await Task.Delay(_config.AuthTimeoutMs + 200);

        // Assert - verify warning log was called
        _logger.Verify(
            x => x.Log(
                LogLevel.Warning,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) =>
                    v.ToString()!.Contains("failed to authenticate") &&
                    v.ToString()!.Contains("terminating")),
                It.IsAny<Exception>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [Fact]
    public async Task AuthTimeout_CustomTimeout_RespectsValue()
    {
        // Arrange - use longer timeout
        _config.AuthTimeoutMs = 2000; // 2 seconds
        _connection = CreateConnection();

        // Act
        _connection.StartAuthTimeout();

        // Wait less than timeout
        await Task.Delay(1000);

        // Assert - should NOT be closed yet
        _webSocket.Verify(ws => ws.CloseAsync(
            It.IsAny<WebSocketCloseStatus>(),
            It.IsAny<string>(),
            It.IsAny<CancellationToken>()), Times.Never);

        // Wait for timeout to expire
        await Task.Delay(1200);

        // Assert - should be closed now
        _webSocket.Verify(ws => ws.CloseAsync(
            WebSocketCloseStatus.PolicyViolation,
            It.Is<string>(s => s.Contains("timeout")),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task AuthTimeout_CloseStatus_IsPolicyViolation()
    {
        // Arrange
        _connection = CreateConnection();

        // Act
        _connection.StartAuthTimeout();
        await Task.Delay(_config.AuthTimeoutMs + 200);

        // Assert - verify exact close status
        _webSocket.Verify(ws => ws.CloseAsync(
            WebSocketCloseStatus.PolicyViolation,
            It.IsAny<string>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task AuthTimeout_CloseDescription_ContainsTimeout()
    {
        // Arrange
        _connection = CreateConnection();

        // Act
        _connection.StartAuthTimeout();
        await Task.Delay(_config.AuthTimeoutMs + 200);

        // Assert - verify close description mentions timeout
        _webSocket.Verify(ws => ws.CloseAsync(
            It.IsAny<WebSocketCloseStatus>(),
            It.Is<string>(s => s.ToLower().Contains("timeout") || s.ToLower().Contains("authentication")),
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
