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

async function testConnectionCount(count: number, serverUrl: string): Promise<ConnectionTestResult> {
  const clients = await createClients(count, serverUrl);
  const start = Date.now();
  try {
    await connectClients(clients, 200);
    const connectTimeMs = Date.now() - start;
    await sleep(STABILITY_DURATION_MS);
    return { stable: true, connectTimeMs };
  } catch {
    const connectTimeMs = Date.now() - start;
    return { stable: false, connectTimeMs };
  } finally {
    await disconnectClients(clients);
  }
}

export async function discoverMaxConnections(serverUrl: string): Promise<ConnectionResult> {
  let low = 100;
  let high = MAX_CONNECTION_CEILING;
  let maxStable = 0;
  let degradationPoint = high;
  let connectTimeAtMax = 0;

  let current = low;
  while (current <= high) {
    const result = await testConnectionCount(current, serverUrl);
    if (result.stable) {
      maxStable = current;
      connectTimeAtMax = result.connectTimeMs;
      current = Math.min(current * 2, high);
    } else {
      degradationPoint = current;
      break;
    }
  }

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
