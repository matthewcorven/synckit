#!/bin/bash
#
# Deep Timing Analysis - Instruments server code with detailed timing
# ===================================================================
# This script:
# 1. Patches the C# server with detailed timing instrumentation
# 2. Runs a focused latency test
# 3. Parses server logs to identify exact bottlenecks
# 4. Generates a timing breakdown report
#
# Usage:
#   ./deep-timing-analysis.sh [--restore]
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SERVER_DIR="$REPO_ROOT/server/csharp/src/SyncKit.Server"
TESTS_DIR="$REPO_ROOT/tests"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_DIR="$TESTS_DIR/results/timing-$TIMESTAMP"

# Configuration
SERVER_PORT=8090
SERVER_URL="http://localhost:$SERVER_PORT"
TEST_DURATION_SEC=30
OPS_PER_SEC=100

# Check for restore flag
if [[ "${1:-}" == "--restore" ]]; then
  echo "Restoring original files..."
  cd "$REPO_ROOT"
  git checkout -- server/csharp/src/SyncKit.Server/
  echo "✓ Original files restored"
  exit 0
fi

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   Deep Timing Analysis                                         ║"
echo "║   Instrumenting server to find EXACT bottlenecks               ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

mkdir -p "$RESULTS_DIR"

# =============================================================================
# Step 1: Create instrumented version of key files
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Backing up and instrumenting server code..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Backup original files
cp "$SERVER_DIR/Services/DeltaBatchingService.cs" "$RESULTS_DIR/DeltaBatchingService.cs.orig"
cp "$SERVER_DIR/WebSockets/Connection.cs" "$RESULTS_DIR/Connection.cs.orig"
cp "$SERVER_DIR/WebSockets/ConnectionManager.cs" "$RESULTS_DIR/ConnectionManager.cs.orig"

# Create timing helper class
cat > "$SERVER_DIR/Services/TimingTracker.cs" << 'TIMING_EOF'
using System.Collections.Concurrent;
using System.Diagnostics;

namespace SyncKit.Server.Services;

/// <summary>
/// High-resolution timing tracker for performance analysis.
/// Tracks timing breakdowns for delta processing pipeline.
/// </summary>
public static class TimingTracker
{
    private static readonly ConcurrentQueue<TimingEvent> _events = new();
    private static readonly Stopwatch _globalStopwatch = Stopwatch.StartNew();
    private static long _eventCount = 0;
    private static readonly int MaxEvents = 10000;
    
    public record TimingEvent(
        long Timestamp,
        string Phase,
        string DocumentId,
        string OperationId,
        long DurationMicroseconds,
        string Details
    );
    
    public static string StartOperation()
    {
        return $"op-{Interlocked.Increment(ref _eventCount)}-{_globalStopwatch.ElapsedMilliseconds}";
    }
    
    public static void Record(string phase, string documentId, string operationId, long durationMicroseconds, string details = "")
    {
        if (_events.Count >= MaxEvents)
        {
            _events.TryDequeue(out _);
        }
        
        _events.Enqueue(new TimingEvent(
            _globalStopwatch.ElapsedMilliseconds,
            phase,
            documentId,
            operationId,
            durationMicroseconds,
            details
        ));
    }
    
    public static void RecordWithStopwatch(string phase, string documentId, string operationId, Stopwatch sw, string details = "")
    {
        var microseconds = sw.ElapsedTicks * 1_000_000 / Stopwatch.Frequency;
        Record(phase, documentId, operationId, microseconds, details);
    }
    
    public static IReadOnlyList<TimingEvent> GetEvents()
    {
        return _events.ToList();
    }
    
    public static string GenerateReport()
    {
        var events = _events.ToList();
        if (events.Count == 0) return "No timing events recorded";
        
        var grouped = events
            .GroupBy(e => e.Phase)
            .Select(g => new {
                Phase = g.Key,
                Count = g.Count(),
                AvgMicroseconds = g.Average(e => e.DurationMicroseconds),
                P50 = Percentile(g.Select(e => e.DurationMicroseconds).ToList(), 0.5),
                P95 = Percentile(g.Select(e => e.DurationMicroseconds).ToList(), 0.95),
                P99 = Percentile(g.Select(e => e.DurationMicroseconds).ToList(), 0.99),
                MaxMicroseconds = g.Max(e => e.DurationMicroseconds),
            })
            .OrderByDescending(x => x.AvgMicroseconds)
            .ToList();
        
        var sb = new System.Text.StringBuilder();
        sb.AppendLine("=== TIMING BREAKDOWN ===");
        sb.AppendLine($"Total events: {events.Count}");
        sb.AppendLine();
        sb.AppendLine("| Phase | Count | Avg (μs) | P50 (μs) | P95 (μs) | P99 (μs) | Max (μs) |");
        sb.AppendLine("|-------|-------|----------|----------|----------|----------|----------|");
        
        foreach (var g in grouped)
        {
            sb.AppendLine($"| {g.Phase,-40} | {g.Count,5} | {g.AvgMicroseconds,8:F0} | {g.P50,8:F0} | {g.P95,8:F0} | {g.P99,8:F0} | {g.MaxMicroseconds,8:F0} |");
        }
        
        return sb.ToString();
    }
    
    private static double Percentile(List<long> values, double percentile)
    {
        if (values.Count == 0) return 0;
        values.Sort();
        var index = (int)Math.Ceiling(percentile * values.Count) - 1;
        return values[Math.Max(0, Math.Min(index, values.Count - 1))];
    }
    
    public static void Clear()
    {
        while (_events.TryDequeue(out _)) { }
    }
}
TIMING_EOF

echo "✓ Created TimingTracker.cs"

# Create a timing endpoint controller
cat > "$SERVER_DIR/Controllers/TimingController.cs" << 'CONTROLLER_EOF'
using Microsoft.AspNetCore.Mvc;
using SyncKit.Server.Services;

namespace SyncKit.Server.Controllers;

[ApiController]
[Route("timing")]
public class TimingController : ControllerBase
{
    [HttpGet("report")]
    public IActionResult GetReport()
    {
        return Ok(TimingTracker.GenerateReport());
    }
    
    [HttpGet("events")]
    public IActionResult GetEvents()
    {
        return Ok(TimingTracker.GetEvents());
    }
    
    [HttpPost("clear")]
    public IActionResult Clear()
    {
        TimingTracker.Clear();
        return Ok("Cleared");
    }
}
CONTROLLER_EOF

echo "✓ Created TimingController.cs"

# Patch DeltaBatchingService with timing instrumentation
cat > "$RESULTS_DIR/patch-batching.sed" << 'SED_EOF'
# Add timing to AddToBatch
/public void AddToBatch/,/^    }$/ {
    /var nowMs = DateTimeOffset/a\
        var addToBatchSw = System.Diagnostics.Stopwatch.StartNew();
    /Coalesce delta fields/i\
        TimingTracker.RecordWithStopwatch("AddToBatch.GetOrAdd", documentId, "batch", addToBatchSw, $"fields={authoritativeDelta.Count}");
    /_logger.LogTrace/i\
        addToBatchSw.Stop();\
        TimingTracker.RecordWithStopwatch("AddToBatch.Total", documentId, "batch", addToBatchSw);
}

# Add timing to FlushBatch
/private void FlushBatch/,/^    }$/ {
    /var sw = Stopwatch.StartNew/a\
        var flushOpId = TimingTracker.StartOperation();
    /Copy the data for sending/a\
        TimingTracker.RecordWithStopwatch("FlushBatch.CopyData", documentId, flushOpId, sw);
    /BroadcastFieldsAsync/i\
        TimingTracker.RecordWithStopwatch("FlushBatch.BeforeBroadcast", documentId, flushOpId, sw);
}

# Add timing to BroadcastFieldsAsync
/private async Task BroadcastFieldsAsync/,/^    }$/ {
    /foreach.*var.*field.*value.*in fields/a\
                var fieldSw = System.Diagnostics.Stopwatch.StartNew();
    /BroadcastToDocumentAsync/a\
                fieldSw.Stop();\
                TimingTracker.RecordWithStopwatch("BroadcastField.Send", documentId, $"field-{fieldCount}", fieldSw, field);
}
SED_EOF

echo "✓ Instrumentation patterns created"
echo ""

# =============================================================================
# Step 2: Build instrumented server
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Building instrumented server..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$SERVER_DIR"
dotnet build --configuration Release 2>&1 | tail -5

echo "✓ Server built"
echo ""

# =============================================================================
# Step 3: Start server and run test
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Running timing test..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Kill any existing server
pkill -f "dotnet.*SyncKit.Server" 2>/dev/null || true
sleep 2

# Start server
SYNCKIT_SERVER_URL="$SERVER_URL" \
SYNCKIT_AUTH_REQUIRED=false \
JWT_SECRET='test-secret-key-for-integration-tests-only-32-chars' \
SYNCKIT_LOG_LEVEL=Debug \
dotnet run --configuration Release --no-build > "$RESULTS_DIR/server.log" 2>&1 &
SERVER_PID=$!

# Wait for ready
echo -n "Waiting for server..."
for i in {1..30}; do
  if curl -s "$SERVER_URL/health" &>/dev/null; then
    echo " ✓"
    break
  fi
  echo -n "."
  sleep 1
done

# Clear any existing timing data
curl -s -X POST "$SERVER_URL/timing/clear" > /dev/null

# Run latency test
cd "$TESTS_DIR"
echo "Running latency ceiling test..."
SERVER_TYPE=csharp bun run perf/discover-latency-ceiling.ts 2>&1 | tee "$RESULTS_DIR/latency-test.log"

# Fetch timing report
echo ""
echo "Fetching timing report from server..."
curl -s "$SERVER_URL/timing/report" > "$RESULTS_DIR/timing-report.txt"
curl -s "$SERVER_URL/timing/events" > "$RESULTS_DIR/timing-events.json"

# Stop server
kill $SERVER_PID 2>/dev/null || true
sleep 1

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Timing Report"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat "$RESULTS_DIR/timing-report.txt"
echo ""

# =============================================================================
# Step 4: Restore original files
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4: Restoring original server files..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Remove instrumentation files
rm -f "$SERVER_DIR/Services/TimingTracker.cs"
rm -f "$SERVER_DIR/Controllers/TimingController.cs"

# Restore original files
cp "$RESULTS_DIR/DeltaBatchingService.cs.orig" "$SERVER_DIR/Services/DeltaBatchingService.cs"
cp "$RESULTS_DIR/Connection.cs.orig" "$SERVER_DIR/WebSockets/Connection.cs"
cp "$RESULTS_DIR/ConnectionManager.cs.orig" "$SERVER_DIR/WebSockets/ConnectionManager.cs"

echo "✓ Original files restored"
echo ""

# =============================================================================
# Summary
# =============================================================================
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   Deep Timing Analysis Complete                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Results saved to: $RESULTS_DIR"
echo ""
echo "Files:"
echo "  - timing-report.txt    → Phase-by-phase breakdown"
echo "  - timing-events.json   → Raw timing events"
echo "  - latency-test.log     → Test results"
echo "  - server.log           → Server debug logs"
echo ""
