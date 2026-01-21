import { computeLatencyStats } from '../helpers/metrics';
import { getServerUrl } from '../helpers/server';
import { runOpsMeasurement } from './ops-utils';
import { discoverMaxOps } from './discover-max-ops';

export interface SendTimingMetrics {
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

export interface LatencyResult {
  p95AtIdle: number;
  p95At50Pct: number;
  p95At80Pct: number;
  p95AtMax: number;
  // Server-side timing breakdown (if available)
  sendTimingAt50Pct?: SendTimingMetrics;
  sendTimingAt80Pct?: SendTimingMetrics;
  sendTimingAtMax?: SendTimingMetrics;
}

async function fetchServerMetrics(serverUrl: string): Promise<{ sendTiming?: SendTimingMetrics } | null> {
  try {
    const resp = await fetch(`${serverUrl}/metrics`);
    if (resp.ok) {
      return await resp.json();
    }
  } catch {
    // Server might not support metrics endpoint
  }
  return null;
}

async function resetServerMetrics(serverUrl: string): Promise<void> {
  try {
    await fetch(`${serverUrl}/metrics/reset`, { method: 'POST' });
  } catch {
    // Server might not support metrics endpoint
  }
}

function logSendTiming(label: string, timing: SendTimingMetrics): void {
  const totalAvgUs = timing.avgSerializeUs + timing.avgSemaphoreWaitUs + timing.avgWebSocketSendUs;
  console.log(`\n[${label}] Server-side Send Timing (${timing.samples} samples):`);
  console.log(`  Serialize:       avg=${timing.avgSerializeUs}us, max=${timing.maxSerializeUs}us`);
  console.log(`  Semaphore Wait:  avg=${timing.avgSemaphoreWaitUs}us, max=${timing.maxSemaphoreWaitUs}us`);
  console.log(`  WebSocket Send:  avg=${timing.avgWebSocketSendUs}us, max=${timing.maxWebSocketSendUs}us`);
  console.log(`  Pending Sends:   current=${timing.pendingSends}, max=${timing.maxPendingSends}`);
  if (totalAvgUs > 0) {
    const serPct = ((timing.avgSerializeUs / totalAvgUs) * 100).toFixed(1);
    const semPct = ((timing.avgSemaphoreWaitUs / totalAvgUs) * 100).toFixed(1);
    const wsPct = ((timing.avgWebSocketSendUs / totalAvgUs) * 100).toFixed(1);
    console.log(`  Breakdown:       ${serPct}% serialize, ${semPct}% semaphore, ${wsPct}% websocket (total avg: ${(totalAvgUs/1000).toFixed(2)}ms)`);
  }
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

  // Reset metrics before 50% test
  await resetServerMetrics(serverUrl);
  
  const half = await runOpsMeasurement({
    serverUrl,
    senderCount: 2,
    receiverCount: 1,
    opsPerSec: Math.max(1, Math.floor(maxOpsPerSec * 0.5)),
    durationSec: 8,
  });
  
  const metrics50 = await fetchServerMetrics(serverUrl);
  const sendTiming50 = metrics50?.sendTiming;
  if (sendTiming50) {
    logSendTiming('50% load', sendTiming50);
  }

  // Reset metrics before 80% test
  await resetServerMetrics(serverUrl);

  const eighty = await runOpsMeasurement({
    serverUrl,
    senderCount: 3,
    receiverCount: 1,
    opsPerSec: Math.max(1, Math.floor(maxOpsPerSec * 0.8)),
    durationSec: 8,
  });

  const metrics80 = await fetchServerMetrics(serverUrl);
  const sendTiming80 = metrics80?.sendTiming;
  if (sendTiming80) {
    logSendTiming('80% load', sendTiming80);
  }

  // Reset metrics before max test
  await resetServerMetrics(serverUrl);

  const full = await runOpsMeasurement({
    serverUrl,
    senderCount: 4,
    receiverCount: 2,
    opsPerSec: Math.max(1, Math.floor(maxOpsPerSec)),
    durationSec: 8,
  });

  const metricsMax = await fetchServerMetrics(serverUrl);
  const sendTimingMax = metricsMax?.sendTiming;
  if (sendTimingMax) {
    logSendTiming('Max load', sendTimingMax);
  }

  return {
    p95AtIdle: computeLatencyStats(idle.latenciesMs).p95,
    p95At50Pct: computeLatencyStats(half.latenciesMs).p95,
    p95At80Pct: computeLatencyStats(eighty.latenciesMs).p95,
    p95AtMax: computeLatencyStats(full.latenciesMs).p95,
    sendTimingAt50Pct: sendTiming50,
    sendTimingAt80Pct: sendTiming80,
    sendTimingAtMax: sendTimingMax,
  };
}

if (import.meta.main) {
  const serverUrl = getServerUrl();
  discoverLatencyCeiling(serverUrl).then(result => {
    console.log(JSON.stringify(result, null, 2));
  });
}
