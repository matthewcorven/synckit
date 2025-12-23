#!/bin/bash
# Manual test script for A3-05: Auth Timeout
#
# This script demonstrates the auth timeout feature.
# Run in one terminal: Start the server with a 3-second timeout
# Run in another terminal: This test script

echo "🧪 Manual Auth Timeout Test (A3-05)"
echo "=================================="
echo ""
echo "Prerequisites:"
echo "  1. Server must be running with AUTH_TIMEOUT_MS=3000"
echo "  2. Start server with:"
echo "     cd server/csharp/src/SyncKit.Server"
echo "     JWT_SECRET='test-secret-key-for-development-32-chars' \\"
echo "     AUTH_TIMEOUT_MS=3000 \\"
echo "     SYNCKIT_AUTH_APIKEYS='sk_test_valid_key' \\"
echo "     dotnet run"
echo ""
echo "Press Enter when server is ready..."
read

SERVER_URL=${SERVER_URL:-ws://localhost:5188/ws}

echo ""
echo "Test 1: Connection without auth should timeout after 3 seconds"
echo "---------------------------------------------------------------"
echo "Connecting to $SERVER_URL..."
echo "Waiting 4 seconds without sending auth..."
echo ""

# Use websocat if available, otherwise provide instructions
if command -v websocat &> /dev/null; then
    timeout 5 websocat "$SERVER_URL" &
    WS_PID=$!
    sleep 4
    if ps -p $WS_PID > /dev/null 2>&1; then
        echo "❌ FAIL: Connection still open after 4 seconds"
        kill $WS_PID 2>/dev/null
    else
        echo "✅ PASS: Connection was closed (likely due to timeout)"
    fi
else
    echo "⚠️  websocat not installed. Manual test instructions:"
    echo ""
    echo "1. In a new terminal, run:"
    echo "   websocat $SERVER_URL"
    echo ""
    echo "2. Do NOT send any message"
    echo ""
    echo "3. After ~3 seconds, the connection should close with:"
    echo "   'websocat: WebSocketError: WebSocketError: Connection closed'"
    echo ""
    echo "Install websocat with: brew install websocat (macOS)"
fi

echo ""
echo "Test 2: Connection with valid auth should NOT timeout"
echo "--------------------------------------------------------"
echo "Connecting and authenticating..."
echo ""

if command -v websocat &> /dev/null; then
    # Send auth message and keep connection alive
    (sleep 0.5 && echo '{"type":"AUTH","id":"test-1","timestamp":1234567890,"apiKey":"sk_test_valid_key"}' && sleep 4) | timeout 6 websocat "$SERVER_URL" &
    WS_PID=$!
    sleep 5
    if ps -p $WS_PID > /dev/null 2>&1; then
        echo "✅ PASS: Authenticated connection still open after 5 seconds"
        kill $WS_PID 2>/dev/null
    else
        echo "❌ FAIL: Authenticated connection was closed"
    fi
else
    echo "⚠️  websocat not installed. Manual test instructions:"
    echo ""
    echo "1. In a new terminal, run:"
    echo "   websocat $SERVER_URL"
    echo ""
    echo "2. Send this message (copy/paste):"
    echo '   {"type":"AUTH","id":"test-1","timestamp":1234567890,"apiKey":"sk_test_valid_key"}'
    echo ""
    echo "3. You should receive an AUTH_SUCCESS message"
    echo ""
    echo "4. Wait more than 3 seconds - connection should stay open"
    echo ""
    echo "Install websocat with: brew install websocat (macOS)"
fi

echo ""
echo "=================================="
echo "Manual test complete!"
