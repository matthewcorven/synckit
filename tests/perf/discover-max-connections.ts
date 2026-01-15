import { createClients, connectClients, disconnectClients } from '../helpers/client';
import { sleep } from '../helpers/metrics';
import { getServerUrl } from '../helpers/server';

export interface ConnectionResult {
  maxConnections: number;
  degradationPoint: number;
  connectTimeAtMax: number;
}

interface ConnectionTestResult {
  stable: boolean;
  connectTimeMs: number;
}

const STABILITY_DURATION_MS = 10_000;
const MAX_CONNECTION_CEILING = Number(process.env.PERF_MAX_CONNECTIONS || 5000);

function log(message: string): void {
  console.log(`[connections] ${message}`);
}

async function testConnectionCount(count: number, serverUrl: string): Promise<ConnectionTestResult> {
  log(`Testing ${count} concurrent connections (ceiling: ${MAX_CONNECTION_CEILING})...`);
  const clients = await createClients(count, serverUrl);
  const start = Date.now();
  try {
    await connectClients(clients, 200);
    const connectTimeMs = Date.now() - start;
    log(`  Connected ${count} in ${connectTimeMs}ms, holding for ${STABILITY_DURATION_MS / 1000}s...`);
    await sleep(STABILITY_DURATION_MS);
    log(`  ✓ Stable at ${count} connections`);
    return { stable: true, connectTimeMs };
  } catch (err) {
    const connectTimeMs = Date.now() - start;
    log(`  ✗ Failed at ${count} connections: ${err}`);
    return { stable: false, connectTimeMs };
  } finally {
    log(`  Disconnecting ${count} clients...`);
    await disconnectClients(clients);
  }
}

export async function discoverMaxConnections(serverUrl: string): Promise<ConnectionResult> {
  log(`Starting connection discovery (ceiling: ${MAX_CONNECTION_CEILING})`);
  let low = 100;
  let high = MAX_CONNECTION_CEILING;
  let maxStable = 0;
  let degradationPoint = high;
  let connectTimeAtMax = 0;

  log('Phase 1: Doubling until failure or ceiling...');
  let current = low;
  while (current <= high) {
    const result = await testConnectionCount(current, serverUrl);
    if (result.stable) {
      maxStable = current;
      connectTimeAtMax = result.connectTimeMs;
      // Stop if we've reached the ceiling
      if (current >= high) {
        log(`Reached ceiling (${high}), skipping to phase 2`);
        break;
      }
      current = Math.min(current * 2, high);
    } else {
      degradationPoint = current;
      break;
    }
  }

  log(`Phase 2: Binary search between ${maxStable + 1} and ${degradationPoint - 1}...`);
  let left = maxStable + 1;
  let right = Math.max(left, degradationPoint === high ? high : degradationPoint - 1);

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const result = await testConnectionCount(mid, serverUrl);
    if (result.stable) {
      maxStable = mid;
      connectTimeAtMax = result.connectTimeMs;
      left = mid + 1;
    } else {
      degradationPoint = Math.min(degradationPoint, mid);
      right = mid - 1;
    }
  }

  log(`Discovery complete: max stable = ${maxStable}, degradation at ${degradationPoint}`);
  return {
    maxConnections: maxStable,
    degradationPoint,
    connectTimeAtMax,
  };
}

if (import.meta.main) {
  const serverUrl = getServerUrl();
  discoverMaxConnections(serverUrl).then(result => {
    console.log(JSON.stringify(result, null, 2));
  });
}
