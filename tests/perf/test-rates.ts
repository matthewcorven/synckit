import { runOpsMeasurement } from './ops-utils';
import { computeLatencyStats } from '../helpers/metrics';

const serverUrl = process.env.SYNCKIT_SERVER_URL || 'http://localhost:8090';

interface SendTiming {
  samples: number;
  avgSerializeUs: number;
  maxSerializeUs: number;
  avgSemaphoreWaitUs: number;
  maxSemaphoreWaitUs: number;
  avgWebSocketSendUs: number;
  maxWebSocketSendUs: number;
  pendingSends: number;
  maxPendingSends: number;
}

interface ServerMetrics {
  sendTiming?: SendTiming;
  send?: {
    attempts: number;
    successes: number;
    dropped: number;
  };
  deltas?: {
    received: number;
    broadcast: number;
    dropped: number;
    convergence: number;
  };
}

async function fetchServerMetrics(): Promise<ServerMetrics | null> {
  try {
    const resp = await fetch(`${serverUrl}/metrics`);
    if (resp.ok) {
      return await resp.json() as ServerMetrics;
    }
  } catch {
    // Server might not support metrics endpoint
  }
  return null;
}

async function resetServerMetrics(): Promise<void> {
  try {
    await fetch(`${serverUrl}/metrics/reset`, { method: 'POST' });
  } catch {
    // Server might not support metrics endpoint
  }
}

async function testRate(opsPerSec: number, label: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing at ${opsPerSec} ops/sec (${label})...`);
  console.log('='.repeat(60));
  
  // Reset metrics before test
  await resetServerMetrics();
  
  const result = await runOpsMeasurement({
    serverUrl,
    senderCount: 4,
    receiverCount: 2,
    opsPerSec,
    durationSec: 8,
  });
  
  const stats = computeLatencyStats(result.latenciesMs);
  console.log(`\n📊 Client-side Results:`);
  console.log(`  Sent: ${result.sent}, Converged: ${result.convergedWithin1s} (${(result.convergenceRate * 100).toFixed(1)}%)`);
  console.log(`  P50: ${stats.p50}ms, P95: ${stats.p95}ms, P99: ${stats.p99}ms`);
  
  // Fetch server-side metrics
  const metrics = await fetchServerMetrics();
  if (metrics?.sendTiming) {
    const st = metrics.sendTiming;
    console.log(`\n🔧 Server-side Send Timing (${st.samples} samples):`);
    console.log(`  Serialize:       avg=${st.avgSerializeUs}µs, max=${st.maxSerializeUs}µs`);
    console.log(`  Semaphore Wait:  avg=${st.avgSemaphoreWaitUs}µs, max=${st.maxSemaphoreWaitUs}µs`);
    console.log(`  WebSocket Send:  avg=${st.avgWebSocketSendUs}µs, max=${st.maxWebSocketSendUs}µs`);
    console.log(`  Pending Sends:   current=${st.pendingSends}, max=${st.maxPendingSends}`);
    
    // Calculate total and breakdown percentages
    const totalAvgUs = st.avgSerializeUs + st.avgSemaphoreWaitUs + st.avgWebSocketSendUs;
    if (totalAvgUs > 0) {
      const serPct = ((st.avgSerializeUs / totalAvgUs) * 100).toFixed(1);
      const semPct = ((st.avgSemaphoreWaitUs / totalAvgUs) * 100).toFixed(1);
      const wsPct = ((st.avgWebSocketSendUs / totalAvgUs) * 100).toFixed(1);
      console.log(`  Breakdown:       ${serPct}% serialize, ${semPct}% semaphore, ${wsPct}% websocket (total avg: ${(totalAvgUs/1000).toFixed(2)}ms)`);
    }
  }
  
  if (metrics?.send) {
    const s = metrics.send;
    console.log(`\n📤 Server Send Stats:`);
    console.log(`  Attempts: ${s.attempts}, Successes: ${s.successes}, Dropped: ${s.dropped}`);
  }
  
  return stats.p95;
}

async function main() {
  console.log(`\n🚀 Performance Rate Test`);
  console.log(`Server: ${serverUrl}`);
  console.log(`Date: ${new Date().toISOString()}`);
  
  // Check if server is up
  try {
    const health = await fetch(`${serverUrl}/health`);
    if (!health.ok) {
      console.error('Server health check failed');
      process.exit(1);
    }
    console.log('Server health: OK');
  } catch (e) {
    console.error(`Cannot connect to server at ${serverUrl}`);
    process.exit(1);
  }
  
  const results: { rate: number; label: string; p95: number }[] = [];
  
  for (const [rate, label] of [
    [1000, '50% of max'],
    [1600, '80% of max'],
    [2000, 'max'],
    [3000, '150% of max'],
    [4000, '200% of max'],
  ] as [number, string][]) {
    const p95 = await testRate(rate, label);
    results.push({ rate, label, p95 });
  }
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📈 SUMMARY');
  console.log('='.repeat(60));
  console.log('Rate (ops/s) | Label        | P95 (ms)');
  console.log('-'.repeat(40));
  for (const r of results) {
    console.log(`${r.rate.toString().padStart(12)} | ${r.label.padEnd(12)} | ${r.p95}`);
  }
}

main().catch(console.error);
