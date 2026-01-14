#!/usr/bin/env bash
# Run profiling locally against the csharp server. Similar to CI profiling-run job.
set -euo pipefail

DURATION=${1:-120}
TOOLS_OK=0

if ! command -v dotnet-trace >/dev/null 2>&1; then
  echo "dotnet-trace not found. Install with: dotnet tool install --global dotnet-trace --version 9.0.661903"
else
  echo "dotnet-trace: $(dotnet-trace --version)"
  TOOLS_OK=1
fi

if ! command -v dotnet-counters >/dev/null 2>&1; then
  echo "dotnet-counters not found. Install with: dotnet tool install --global dotnet-counters --version 9.0.661903"
else
  echo "dotnet-counters: $(dotnet-counters --version)"
  TOOLS_OK=$((TOOLS_OK+1))
fi

if [ "$TOOLS_OK" -ne 2 ]; then
  echo "Install both tools before running this script. Quitting."
  exit 1
fi

mkdir -p tests/docs/tuning-results

# Start server in background
pushd server/csharp/src/SyncKit.Server
SYNCKIT_SERVER_URL=http://localhost:8090 SYNCKIT_AUTH_REQUIRED=false JWT_SECRET='test-secret-key-for-integration-tests-only-32-chars' dotnet run > "${PWD}/../../../tests/docs/tuning-results/server-local.log" 2>&1 &
PID=$!
popd

# Wait for health
for i in {1..30}; do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8090/health || echo "000")
  if [ "$HTTP" = "200" ]; then
    echo "Server ready"
    break
  fi
  sleep 1
done

# Start collectors
timeout ${DURATION}s dotnet-counters collect --process-id $PID System.Runtime --format Json --output tests/docs/tuning-results/counters-local.json &
C1=$!

dotnet-trace collect --process-id $PID --format NetTrace --providers "Microsoft-Windows-DotNETRuntime:0x1:5" --duration 00:02:00 -o tests/docs/tuning-results/trace-local.nettrace &
T1=$!

# Run load generator
bash tests/scripts/profile-load.sh --burst-conns 200 --burst-duration 10 --sustain-conns 100 --sustain-duration 120 --sustain-interval-ms 50 --payload-bytes 256 || true

wait $T1 || true
wait $C1 || true

# Convert trace to Speedscope
dotnet-trace convert tests/docs/tuning-results/trace-local.nettrace --format Speedscope -o tests/docs/tuning-results/trace-local.speedscope.json || true

# Stop server
kill $PID || true

echo "Artifacts in tests/docs/tuning-results/"
