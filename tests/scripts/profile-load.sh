#!/usr/bin/env bash
# Simple load generator for profiling: burst then sustained
# Usage: profile-load.sh --burst-conns 200 --burst-duration 10 --sustain-conns 100 --sustain-duration 120 --sustain-interval-ms 50 --payload-bytes 256

set -euo pipefail

BURST_CONNS=200
BURST_DURATION=10
SUSTAIN_CONNS=100
SUSTAIN_DURATION=120
SUSTAIN_INTERVAL_MS=50
PAYLOAD_BYTES=256
SERVER_URL="${SYNCKIT_SERVER_URL:-http://localhost:8090}"

while [[ $# -gt 0 ]]; do
  case $1 in
    --burst-conns) BURST_CONNS=$2; shift 2;;
    --burst-duration) BURST_DURATION=$2; shift 2;;
    --sustain-conns) SUSTAIN_CONNS=$2; shift 2;;
    --sustain-duration) SUSTAIN_DURATION=$2; shift 2;;
    --sustain-interval-ms) SUSTAIN_INTERVAL_MS=$2; shift 2;;
    --payload-bytes) PAYLOAD_BYTES=$2; shift 2;;
    *) echo "Unknown arg: $1"; exit 1;;
  esac
done

echo "Profile load: burst ${BURST_CONNS} conns for ${BURST_DURATION}s, sustain ${SUSTAIN_CONNS} for ${SUSTAIN_DURATION}s @ ${SUSTAIN_INTERVAL_MS}ms"

# Use node (bun) or simple websocket clients in background
if command -v bun >/dev/null 2>&1; then
  echo "Using bun for clients"
  node_cmd=bun
elif command -v node >/dev/null 2>&1; then
  echo "Using node for clients"
  node_cmd=node
else
  echo "No node or bun runtime found; skipping load generation"
  exit 0
fi

TMPDIR=$(mktemp -d)
PAYLOAD=$(head -c ${PAYLOAD_BYTES} /dev/urandom | base64 | tr -d '\n')

cat > "$TMPDIR/client.js" <<'JS'
const WebSocket = require('ws');
const url = process.argv[2];
const messages = parseInt(process.argv[3]);
const intervalMs = parseInt(process.argv[4]);
const durationMs = parseInt(process.argv[5]);
const payload = process.argv[6];

const ws = new WebSocket(url);
ws.on('open', () => {
  let sent = 0;
  const t = setInterval(() => {
    ws.send(JSON.stringify({ type: 'Delta', id: Date.now().toString(), delta: payload }));
    sent++;
  }, intervalMs);

  setTimeout(() => {
    clearInterval(t);
    ws.close();
  }, durationMs);
});

ws.on('message', (data) => {});
ws.on('close', () => process.exit(0));
JS

# Burst phase: quickly start BURST_CONNS clients that send as many messages as they can for BURST_DURATION
for i in $(seq 1 $BURST_CONNS); do
  $node_cmd "$TMPDIR/client.js" "$SERVER_URL/ws" 0 10 1000 "$PAYLOAD" &
  sleep $(bc -l <<< "(1/($BURST_CONNS/($BURST_DURATION)))")
done

sleep $BURST_DURATION

# Sustained phase: start SUSTAIN_CONNS clients that send a message every SUSTAIN_INTERVAL_MS for SUSTAIN_DURATION
for i in $(seq 1 $SUSTAIN_CONNS); do
  $node_cmd "$TMPDIR/client.js" "$SERVER_URL/ws" 0 $SUSTAIN_INTERVAL_MS $(($SUSTAIN_DURATION*1000)) "$PAYLOAD" &
  sleep 0.01
done

# Wait for sustain duration
sleep $SUSTAIN_DURATION

# Cleanup
pkill -f "$TMPDIR/client.js" || true
rm -rf "$TMPDIR"

exit 0
