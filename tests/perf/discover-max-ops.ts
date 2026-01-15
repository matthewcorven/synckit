import { getServerUrl } from '../helpers/server';
import { runOpsMeasurement } from './ops-utils';

export interface OpsResult {
  singleClientMax: number;
  aggregateMax: number;
  clientsAtAggregate: number;
}

async function rampUntilFailure(
  serverUrl: string,
  senderCount: number,
  receiverCount: number,
  startRate: number,
  step: number,
  maxRate: number
): Promise<{ maxStable: number; failurePoint: number } > {
  let current = startRate;
  let maxStable = 0;
  let failurePoint = maxRate;

  while (current <= maxRate) {
    const measurement = await runOpsMeasurement({
      serverUrl,
      senderCount,
      receiverCount,
      opsPerSec: current,
      durationSec: 8,
    });
    if (measurement.convergenceRate >= 0.8) {
      maxStable = current;
      current += step;
    } else {
      failurePoint = current;
      break;
    }
  }

  return { maxStable, failurePoint };
}

async function binarySearchRate(
  serverUrl: string,
  senderCount: number,
  receiverCount: number,
  low: number,
  high: number
): Promise<number> {
  let maxStable = low;
  let left = low;
  let right = high;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const measurement = await runOpsMeasurement({
      serverUrl,
      senderCount,
      receiverCount,
      opsPerSec: mid,
      durationSec: 8,
    });

    if (measurement.convergenceRate >= 0.8) {
      maxStable = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return maxStable;
}

export async function discoverMaxOps(serverUrl: string): Promise<OpsResult> {
  const singleRamp = await rampUntilFailure(serverUrl, 1, 1, 10, 20, 1000);
  const singleClientMax = await binarySearchRate(
    serverUrl,
    1,
    1,
    singleRamp.maxStable,
    singleRamp.failurePoint
  );

  const aggregateClients = 6;
  const aggregateRamp = await rampUntilFailure(serverUrl, 4, 2, 50, 50, 2000);
  const aggregateMax = await binarySearchRate(
    serverUrl,
    4,
    2,
    aggregateRamp.maxStable,
    aggregateRamp.failurePoint
  );

  return {
    singleClientMax,
    aggregateMax,
    clientsAtAggregate: aggregateClients,
  };
}

if (import.meta.main) {
  const serverUrl = getServerUrl();
  discoverMaxOps(serverUrl).then(result => {
    console.log(JSON.stringify(result, null, 2));
  });
}
