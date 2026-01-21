import { runOpsMeasurement } from './ops-utils';
import { computeLatencyStats } from '../helpers/metrics';

const serverUrl = process.env.SYNCKIT_SERVER_URL || 'http://localhost:8090';

async function main() {
  console.log(`Testing at 2000 ops/sec against ${serverUrl}...`);
  
  const result = await runOpsMeasurement({
    serverUrl,
    senderCount: 4,
    receiverCount: 2,
    opsPerSec: 2000,
    durationSec: 8,
  });
  
  const stats = computeLatencyStats(result.latenciesMs);
  console.log('Results:');
  console.log('  Sent:', result.sent);
  console.log('  Converged:', result.convergedWithin1s);
  console.log('  Convergence Rate:', (result.convergenceRate * 100).toFixed(1) + '%');
  console.log('  P50:', stats.p50 + 'ms');
  console.log('  P95:', stats.p95 + 'ms');
  console.log('  P99:', stats.p99 + 'ms');
}

main().catch(console.error);
