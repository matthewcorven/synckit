#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)

SERVER_TYPE=${1:-typescript}
SERVER_PORT=${SERVER_PORT:-}

if [[ "$SERVER_TYPE" == "csharp" ]]; then
  SERVER_PORT=${SERVER_PORT:-8090}
  echo "Starting C# server on port ${SERVER_PORT}..."
  (
    cd "${ROOT_DIR}/server/csharp/src/SyncKit.Server"
    SYNCKIT_SERVER_URL="http://localhost:${SERVER_PORT}" \
    SYNCKIT_AUTH_REQUIRED=false \
    JWT_SECRET='test-secret-key-for-integration-tests-only-32-chars' \
    dotnet run --no-build
  ) &
  SERVER_PID=$!
else
  SERVER_TYPE="typescript"
  SERVER_PORT=${SERVER_PORT:-8080}
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
for i in {1..30}; do
  if curl -s "http://localhost:${SERVER_PORT}/health" >/dev/null 2>&1; then
    echo "Server is healthy."
    break
  fi
  sleep 1
  if [[ $i -eq 30 ]]; then
    echo "Server did not become healthy in time."
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
