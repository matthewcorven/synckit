#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)

SERVER_TYPE=${1:-typescript}
SERVER_PORT=${SERVER_PORT:-}

# Ensure port is free before starting
ensure_port_free() {
  local port=$1
  if lsof -ti:"$port" >/dev/null 2>&1; then
    echo "Port $port is in use. Attempting to free it..."
    lsof -ti:"$port" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
}

if [[ "$SERVER_TYPE" == "csharp" ]]; then
  SERVER_PORT=${SERVER_PORT:-8090}
  ensure_port_free "$SERVER_PORT"
  echo "Starting C# server on port ${SERVER_PORT}..."
  (
    cd "${ROOT_DIR}/server/csharp/src/SyncKit.Server"
    ASPNETCORE_URLS="http://localhost:${SERVER_PORT}" \
    SYNCKIT_SERVER_URL="http://localhost:${SERVER_PORT}" \
    SYNCKIT_AUTH_REQUIRED=false \
    JWT_SECRET='test-secret-key-for-integration-tests-only-32-chars' \
    dotnet run --configuration Release --no-build
  ) &
  SERVER_PID=$!
else
  SERVER_TYPE="typescript"
  SERVER_PORT=${SERVER_PORT:-8080}
  ensure_port_free "$SERVER_PORT"
  echo "Starting TypeScript server on port ${SERVER_PORT}..."
  (
    cd "${ROOT_DIR}/server/typescript"
    PORT="${SERVER_PORT}" HOST=0.0.0.0 SYNCKIT_AUTH_REQUIRED=false bun src/index.ts
  ) &
  SERVER_PID=$!
fi

cleanup() {
  echo "Stopping server (PID ${SERVER_PID})..."
  kill "${SERVER_PID}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Waiting for server health..."
for i in {1..60}; do
  if curl -s "http://localhost:${SERVER_PORT}/health" >/dev/null 2>&1; then
    echo "Server is healthy."
    break
  fi
  echo "  Waiting for health... ($i/60)"
  sleep 1
  if [[ $i -eq 60 ]]; then
    echo "Server did not become healthy in time."
    echo "Checking if server process is still running..."
    ps aux | grep -E "(dotnet|bun)" | grep -v grep || echo "No server process found"
    exit 1
  fi
  done

(
  cd "${SCRIPT_DIR}"
  SERVER_TYPE="${SERVER_TYPE}" \
  SERVER_PORT="${SERVER_PORT}" \
  SERVER_PID="${SERVER_PID}" \
  bun run perf/capture-all.ts
  bun run perf/update-perf-table.ts
)
