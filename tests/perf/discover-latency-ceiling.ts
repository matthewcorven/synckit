import { computeLatencyStats } from '../helpers/metrics';
import { getServerUrl } from '../helpers/server';
import { runOpsMeasurement } from './ops-utils';
import { discoverMaxOps } from './discover-max-ops';

export interface LatencyResult {
  p95AtIdle: number;
  p95At50Pct: number;
  p95At80Pct: number;
  p95AtMax: number;
}

export async function discoverLatencyCeiling(
  serverUrl: string,
  options: { maxOpsPerSec?: number } = {}
): Promise<LatencyResult> {
  let maxOpsPerSec = options.maxOpsPerSec;
  if (!maxOpsPerSec) {
    const opsResult = await discoverMaxOps(serverUrl);
    maxOpsPerSec = opsResult.aggregateMax;
  }

  const idle = await runOpsMeasurement({
    serverUrl,
    senderCount: 1,
    receiverCount: 1,
    opsPerSec: 0,
    durationSec: 3,
  });

  const half = await runOpsMeasurement({
    serverUrl,
    senderCount: 2,
    receiverCount: 1,
    opsPerSec: Math.max(1, Math.floor(maxOpsPerSec * 0.5)),
    durationSec: 8,
  });

  const eighty = await runOpsMeasurement({
    serverUrl,
    senderCount: 3,
    receiverCount: 1,
    opsPerSec: Math.max(1, Math.floor(maxOpsPerSec * 0.8)),
    durationSec: 8,
  });

  const full = await runOpsMeasurement({
    serverUrl,
    senderCount: 4,
    receiverCount: 2,
    opsPerSec: Math.max(1, Math.floor(maxOpsPerSec)),
    durationSec: 8,
  });

  return {
    p95AtIdle: computeLatencyStats(idle.latenciesMs).p95,
    p95At50Pct: computeLatencyStats(half.latenciesMs).p95,
    p95At80Pct: computeLatencyStats(eighty.latenciesMs).p95,
    p95AtMax: computeLatencyStats(full.latenciesMs).p95,
  };
}

if (import.meta.main) {
  const serverUrl = getServerUrl();
  discoverLatencyCeiling(serverUrl).then(result => {
    console.log(JSON.stringify(result, null, 2));
  });
}
