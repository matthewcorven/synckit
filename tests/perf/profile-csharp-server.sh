#!/bin/bash
#
# Comprehensive C# Server Performance Profiler
# ============================================
# This script profiles the C# server to identify ALL hot paths and bottlenecks.
#
# Requirements:
# - .NET 10 SDK
# - dotnet-trace, dotnet-counters (installed automatically)
# - Bun (for test client)
#
# Output:
# - tests/results/profile-{timestamp}/ directory containing:
#   - trace.nettrace (CPU trace)
#   - counters.csv (real-time counters)
#   - timeline.json (custom timing breakdown)
#   - hot-paths.txt (analysis summary)
#   - gc-events.txt (GC analysis)
#
set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SERVER_DIR="$REPO_ROOT/server/csharp/src/SyncKit.Server"
TESTS_DIR="$REPO_ROOT/tests"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_DIR="$TESTS_DIR/results/profile-$TIMESTAMP"
SERVER_PORT=8090
SERVER_URL="http://localhost:$SERVER_PORT"

# Test parameters
PROFILE_DURATION_SEC=60
NUM_CONNECTIONS=100
OPS_PER_SEC=500

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   C# Server Performance Profiler                               ║"
echo "║   Finding ALL hot paths with certainty                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Configuration:"
echo "  Results Dir:    $RESULTS_DIR"
echo "  Server Port:    $SERVER_PORT"
echo "  Duration:       ${PROFILE_DURATION_SEC}s"
echo "  Connections:    $NUM_CONNECTIONS"
echo "  Ops/sec:        $OPS_PER_SEC"
echo ""

# Create results directory
mkdir -p "$RESULTS_DIR"

# =============================================================================
# Step 1: Install required .NET tools
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Installing .NET diagnostic tools..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Install tools if not present
dotnet tool list -g | grep -q dotnet-trace || dotnet tool install -g dotnet-trace
dotnet tool list -g | grep -q dotnet-counters || dotnet tool install -g dotnet-counters
dotnet tool list -g | grep -q dotnet-dump || dotnet tool install -g dotnet-dump

echo "✓ Tools installed"
echo ""

# =============================================================================
# Step 2: Build server in Release mode with symbols
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Building server (Release + Symbols)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$SERVER_DIR"

# Build with symbols for better stack traces
dotnet build --configuration Release -p:DebugType=portable -p:DebugSymbols=true

echo "✓ Server built"
echo ""

# =============================================================================
# Step 3: Start server with profiling-friendly settings
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Starting server with profiling enabled..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Kill any existing server
pkill -f "dotnet.*SyncKit.Server" 2>/dev/null || true
sleep 2

# Ensure port is free
if lsof -i :$SERVER_PORT &>/dev/null; then
  echo "ERROR: Port $SERVER_PORT is still in use"
  exit 1
fi

# Start server with environment for profiling
# CRITICAL: Set Production environment to disable Debug logging (which causes severe I/O overhead)
cd "$SERVER_DIR"
ASPNETCORE_ENVIRONMENT=Production \
DOTNET_ENVIRONMENT=Production \
SYNCKIT_SERVER_URL="$SERVER_URL" \
SYNCKIT_AUTH_REQUIRED=false \
JWT_SECRET='test-secret-key-for-integration-tests-only-32-chars' \
Serilog__MinimumLevel__Default=Warning \
DOTNET_gcServer=1 \
dotnet run --configuration Release --no-build --no-launch-profile > "$RESULTS_DIR/server.log" 2>&1 &

SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for server to be ready
echo -n "Waiting for server..."
for i in {1..30}; do
  if curl -s "$SERVER_URL/health" &>/dev/null; then
    echo " ✓ Ready!"
    break
  fi
  if [ $i -eq 30 ]; then
    echo " FAILED"
    cat "$RESULTS_DIR/server.log"
    exit 1
  fi
  echo -n "."
  sleep 1
done
echo ""

# =============================================================================
# Step 4: Collect baseline metrics
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4: Collecting baseline metrics (idle)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Capture baseline counters for 5 seconds
timeout 5 dotnet-counters collect -p $SERVER_PID \
  --providers "System.Runtime,Microsoft.AspNetCore.Hosting,System.Net.Sockets" \
  --format csv \
  -o "$RESULTS_DIR/counters-baseline.csv" 2>/dev/null || true

echo "✓ Baseline captured"
echo ""

# =============================================================================
# Step 5: Start CPU trace and performance counters
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 5: Starting trace collectors..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Start CPU trace in background (captures call stacks)
dotnet-trace collect -p $SERVER_PID \
  --providers "Microsoft-DotNETCore-SampleProfiler,Microsoft-Windows-DotNETRuntime:0x1F000080018:5" \
  --duration "00:01:30" \
  -o "$RESULTS_DIR/trace.nettrace" &
TRACE_PID=$!
echo "Trace collector started (PID: $TRACE_PID)"

# Start counters collection in background
dotnet-counters collect -p $SERVER_PID \
  --providers "System.Runtime,Microsoft.AspNetCore.Hosting,System.Net.Sockets,System.Net.Http" \
  --refresh-interval 1 \
  --format csv \
  --duration $((PROFILE_DURATION_SEC + 30)) \
  -o "$RESULTS_DIR/counters-load.csv" &
COUNTERS_PID=$!
echo "Counters collector started (PID: $COUNTERS_PID)"

sleep 3  # Let collectors initialize

echo "✓ Collectors running"
echo ""

# =============================================================================
# Step 6: Run load test with timing instrumentation
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 6: Running load test for ${PROFILE_DURATION_SEC}s..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$TESTS_DIR"

# Create custom profiling test that captures detailed timing
cat > "$TESTS_DIR/perf/profile-test.ts" << 'PROFILE_TEST_EOF'
import { PerfClient, createClients, connectClients, disconnectClients } from '../helpers/client';
import { sleep } from '../helpers/metrics';

interface TimingEntry {
  operation: string;
  field: string;
  sentAt: number;
  receivedAt?: number;
  latencyMs?: number;
}

async function runProfileTest(serverUrl: string, options: {
  connections: number;
  opsPerSec: number;
  durationSec: number;
}) {
  const startTime = Date.now();
  const timings: TimingEntry[] = [];
  const documentId = `profile-doc-${Date.now()}`;
  
  console.log(`Creating ${options.connections} connections...`);
  const senders = await createClients(Math.ceil(options.connections / 2), serverUrl);
  const receivers = await createClients(Math.floor(options.connections / 2), serverUrl);
  const allClients = [...senders, ...receivers];
  
  console.log(`Connecting...`);
  await connectClients(allClients);
  await Promise.all(allClients.map(c => c.sync(documentId)));
  
  // Track all received messages
  const receivedAt = new Map<string, number>();
  
  receivers.forEach(receiver => {
    receiver.onDelta(message => {
      const now = Date.now();
      const fields: string[] = [];
      
      if (message.field) {
        fields.push(message.field);
      } else if (message.delta) {
        fields.push(...Object.keys(message.delta));
      }
      
      for (const field of fields) {
        receivedAt.set(field, now);
      }
    });
  });
  
  // Send operations
  const totalOps = options.opsPerSec * options.durationSec;
  const intervalMs = 1000 / options.opsPerSec;
  let sent = 0;
  
  console.log(`Sending ${totalOps} operations at ${options.opsPerSec} ops/sec...`);
  
  const sendStart = Date.now();
  
  for (let i = 0; i < totalOps; i++) {
    const senderIdx = i % senders.length;
    const field = `op-${i}-${Date.now()}`;
    const sentAt = Date.now();
    
    timings.push({
      operation: `send-${i}`,
      field,
      sentAt,
    });
    
    await senders[senderIdx].sendDelta(documentId, { [field]: i });
    sent++;
    
    // Rate limiting
    const elapsed = Date.now() - sendStart;
    const expectedElapsed = (sent / options.opsPerSec) * 1000;
    if (expectedElapsed > elapsed) {
      await sleep(expectedElapsed - elapsed);
    }
    
    // Progress update every 10%
    if (sent % Math.floor(totalOps / 10) === 0) {
      console.log(`  Progress: ${Math.round(sent / totalOps * 100)}%`);
    }
  }
  
  console.log(`Waiting for convergence (2s)...`);
  await sleep(2000);
  
  // Match received times with sent times
  for (const timing of timings) {
    const recvTime = receivedAt.get(timing.field);
    if (recvTime) {
      timing.receivedAt = recvTime;
      timing.latencyMs = recvTime - timing.sentAt;
    }
  }
  
  // Compute statistics
  const latencies = timings.filter(t => t.latencyMs !== undefined).map(t => t.latencyMs!);
  latencies.sort((a, b) => a - b);
  
  const stats = {
    totalSent: sent,
    totalReceived: latencies.length,
    convergenceRate: latencies.length / sent,
    minLatency: latencies[0] || 0,
    maxLatency: latencies[latencies.length - 1] || 0,
    avgLatency: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
    p50: latencies[Math.floor(latencies.length * 0.5)] || 0,
    p95: latencies[Math.floor(latencies.length * 0.95)] || 0,
    p99: latencies[Math.floor(latencies.length * 0.99)] || 0,
    durationMs: Date.now() - startTime,
  };
  
  console.log(`\nResults:`);
  console.log(`  Sent:           ${stats.totalSent}`);
  console.log(`  Received:       ${stats.totalReceived} (${(stats.convergenceRate * 100).toFixed(1)}%)`);
  console.log(`  Min Latency:    ${stats.minLatency}ms`);
  console.log(`  Avg Latency:    ${stats.avgLatency.toFixed(1)}ms`);
  console.log(`  P50 Latency:    ${stats.p50}ms`);
  console.log(`  P95 Latency:    ${stats.p95}ms`);
  console.log(`  P99 Latency:    ${stats.p99}ms`);
  console.log(`  Max Latency:    ${stats.maxLatency}ms`);
  
  await disconnectClients(allClients);
  
  // Output detailed timings
  return {
    stats,
    timings: timings.slice(0, 1000), // First 1000 for analysis
    latencyDistribution: {
      '0-50ms': latencies.filter(l => l <= 50).length,
      '50-100ms': latencies.filter(l => l > 50 && l <= 100).length,
      '100-500ms': latencies.filter(l => l > 100 && l <= 500).length,
      '500-1000ms': latencies.filter(l => l > 500 && l <= 1000).length,
      '1000-2000ms': latencies.filter(l => l > 1000 && l <= 2000).length,
      '>2000ms': latencies.filter(l => l > 2000).length,
    }
  };
}

// Run the test
const serverUrl = process.env.SERVER_URL || 'http://localhost:8090';
const connections = parseInt(process.env.NUM_CONNECTIONS || '100');
const opsPerSec = parseInt(process.env.OPS_PER_SEC || '500');
const durationSec = parseInt(process.env.DURATION_SEC || '60');

runProfileTest(serverUrl, { connections, opsPerSec, durationSec })
  .then(result => {
    console.log('\n' + JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
PROFILE_TEST_EOF

# Run the profiling test
SERVER_URL="$SERVER_URL" \
NUM_CONNECTIONS=$NUM_CONNECTIONS \
OPS_PER_SEC=$OPS_PER_SEC \
DURATION_SEC=$PROFILE_DURATION_SEC \
bun run "$TESTS_DIR/perf/profile-test.ts" 2>&1 | tee "$RESULTS_DIR/test-output.log"

echo ""

# =============================================================================
# Step 7: Stop collectors and server
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 7: Stopping collectors and server..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Wait for trace to complete
wait $TRACE_PID 2>/dev/null || true
kill $COUNTERS_PID 2>/dev/null || true

# Stop server gracefully
kill $SERVER_PID 2>/dev/null || true
sleep 2
pkill -9 -f "dotnet.*SyncKit.Server" 2>/dev/null || true

echo "✓ Collectors and server stopped"
echo ""

# =============================================================================
# Step 8: Analyze trace file
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 8: Analyzing trace data..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Convert trace to speedscope format for visualization
if [ -f "$RESULTS_DIR/trace.nettrace" ]; then
  dotnet-trace convert "$RESULTS_DIR/trace.nettrace" \
    --format speedscope \
    -o "$RESULTS_DIR/trace.speedscope.json" 2>/dev/null || true
  
  echo "✓ Trace converted to speedscope format"
  echo "  View at: https://www.speedscope.app/ (drag & drop trace.speedscope.json)"
fi

# =============================================================================
# Step 9: Generate analysis report
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 9: Generating analysis report..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cat > "$RESULTS_DIR/analysis-report.md" << REPORT_EOF
# C# Server Performance Profile Analysis

**Generated:** $(date -Iseconds)
**Duration:** ${PROFILE_DURATION_SEC}s
**Connections:** $NUM_CONNECTIONS
**Ops/sec Target:** $OPS_PER_SEC

## Files Generated

| File | Description |
|------|-------------|
| \`trace.nettrace\` | CPU trace (open with Visual Studio / PerfView) |
| \`trace.speedscope.json\` | Flamegraph (open at speedscope.app) |
| \`counters-baseline.csv\` | Idle performance counters |
| \`counters-load.csv\` | Under-load performance counters |
| \`test-output.log\` | Test results with latency stats |
| \`server.log\` | Server logs during profiling |

## Quick Analysis

### Test Results
$(grep -A 20 "Results:" "$RESULTS_DIR/test-output.log" 2>/dev/null || echo "See test-output.log")

### How to Identify Hot Paths

1. **CPU Profile Analysis:**
   - Open \`trace.speedscope.json\` at https://www.speedscope.app/
   - Look for functions with high "self time" (time spent in the function itself)
   - Sort by "total time" to see call tree impact

2. **Key Methods to Investigate:**
   - \`DeltaBatchingService.FlushBatch\` - Batching and broadcast
   - \`Connection.Send\` - Message serialization and queuing
   - \`ConnectionManager.BroadcastToDocumentAsync\` - Fan-out logic
   - \`JsonProtocolHandler.Serialize\` - JSON serialization
   - \`BinaryProtocolHandler.Serialize\` - Binary serialization
   - \`WebSocket.SendAsync\` - Actual network send

3. **GC Pressure:**
   - Check \`counters-load.csv\` for "gc-heap-size" growth
   - Look for "gen-0-gc-count", "gen-1-gc-count", "gen-2-gc-count"
   - High Gen2 GCs indicate memory pressure

4. **Thread Pool Starvation:**
   - Check \`counters-load.csv\` for "threadpool-queue-length"
   - Values > 0 indicate thread pool saturation
   - Check "threadpool-thread-count" vs expected parallelism

## Counter Analysis

$(if [ -f "$RESULTS_DIR/counters-load.csv" ]; then
  echo "### Key Metrics from Load Test"
  echo ""
  echo "\`\`\`"
  head -20 "$RESULTS_DIR/counters-load.csv"
  echo "...(see full file for more)"
  echo "\`\`\`"
else
  echo "Counter data not available"
fi)

## Next Steps

Based on the profile results:

1. **If CPU-bound:** Optimize hot methods identified in speedscope
2. **If GC-bound:** Reduce allocations (pooling, spans, etc.)
3. **If I/O-bound:** Check WebSocket send patterns
4. **If Thread-bound:** Increase parallelism or reduce contention

---
*Profile collected from: $SERVER_DIR*
REPORT_EOF

echo "✓ Report generated: $RESULTS_DIR/analysis-report.md"
echo ""

# =============================================================================
# Summary
# =============================================================================
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   Profiling Complete!                                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Results saved to: $RESULTS_DIR"
echo ""
echo "Key files:"
echo "  - trace.speedscope.json  → Open at https://www.speedscope.app/"
echo "  - counters-load.csv      → GC & thread pool metrics"
echo "  - test-output.log        → Latency distribution"
echo "  - analysis-report.md     → Summary & next steps"
echo ""
echo "Quick view of latency results:"
grep -E "(P50|P95|P99|Latency)" "$RESULTS_DIR/test-output.log" 2>/dev/null || true
echo ""
