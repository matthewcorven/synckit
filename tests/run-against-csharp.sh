#!/bin/bash
# tests/run-against-csharp.sh
#
# Run integration tests against the .NET SyncKit server.
# 
# Usage:
#   ./run-against-csharp.sh                    # Run all integration tests
#   ./run-against-csharp.sh sync               # Run only sync tests
#   ./run-against-csharp.sh --with-server      # Start server automatically
#
# Prerequisites:
#   - Docker Compose running (postgres + redis)
#   - .NET server running on port 8090 (unless --with-server)
#
# Environment Variables (when running server automatically):
#   JWT_SECRET                    - JWT signing key (default: test key)
#   SYNCKIT_AUTH_REQUIRED         - Enable auth (default: false)
#   SYNCKIT_SERVER_URL            - Server base URL (default: http://localhost:8090)
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_PID=""
TEST_PATTERN="${1:-}"
START_SERVER=false
SERVER_PORT=8090

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --with-server)
            START_SERVER=true
            shift
            ;;
        --port)
            SERVER_PORT="$2"
            shift 2
            ;;
        *)
            TEST_PATTERN="$1"
            shift
            ;;
    esac
done

cleanup() {
    if [ -n "$SERVER_PID" ] && [ "$START_SERVER" = true ]; then
        echo "Stopping .NET server (PID: $SERVER_PID)..."
        kill "$SERVER_PID" 2>/dev/null || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi
}

trap cleanup EXIT

# Check if server is responding
check_server() {
    curl -s -o /dev/null -w "%{http_code}" "http://localhost:${SERVER_PORT}/health" 2>/dev/null || echo "000"
}

# Start server if requested
if [ "$START_SERVER" = true ]; then
    echo "Starting .NET server..."
    
    cd "$SCRIPT_DIR/../server/csharp/src/SyncKit.Server"
    
    export SYNCKIT_SERVER_URL="${SYNCKIT_SERVER_URL:-http://localhost:${SERVER_PORT}}"
    export SYNCKIT_AUTH_REQUIRED="${SYNCKIT_AUTH_REQUIRED:-false}"
    export JWT_SECRET="${JWT_SECRET:-test-secret-key-for-integration-tests-only-32-chars}"
    
    dotnet run &
    SERVER_PID=$!
    
    echo "Waiting for server to be ready..."
    for i in {1..30}; do
        HTTP_CODE=$(check_server)
        if [ "$HTTP_CODE" = "200" ]; then
            echo "✓ Server ready on port ${SERVER_PORT}!"
            break
        fi
        if [ $i -eq 30 ]; then
            echo "✗ Server failed to start within 30 seconds"
            exit 1
        fi
        echo "  Waiting for server... ($i/30)"
        sleep 1
    done
else
    # Verify server is running
    HTTP_CODE=$(check_server)
    if [ "$HTTP_CODE" != "200" ]; then
        echo "✗ Server not responding on port ${SERVER_PORT}"
        echo "  Start the .NET server first, or use --with-server flag"
        echo ""
        echo "  To start the server manually:"
        echo "    cd server/csharp/src/SyncKit.Server"
        echo "    SYNCKIT_SERVER_URL=http://localhost:8090 \\"
        echo "    SYNCKIT_AUTH_REQUIRED=false \\"
        echo "    JWT_SECRET='test-secret-key-for-integration-tests-only-32-chars' \\"
        echo "    dotnet run"
        exit 1
    fi
    echo "✓ Server responding on port ${SERVER_PORT}"
fi

cd "$SCRIPT_DIR"

# Set test environment variables
export TEST_SERVER_TYPE=external
export TEST_SERVER_PORT="$SERVER_PORT"

# Build test pattern argument
TEST_ARGS="integration"
if [ -n "$TEST_PATTERN" ] && [ "$TEST_PATTERN" != "--with-server" ]; then
    TEST_ARGS="integration/$TEST_PATTERN"
fi

echo ""
echo "Running integration tests against .NET server..."
echo "  Pattern: ${TEST_ARGS}"
echo "  Server: http://localhost:${SERVER_PORT}"
echo ""

# Run tests with extended timeout for sync operations
bun test "$TEST_ARGS" --timeout 60000

echo ""
echo "✓ Tests completed"
