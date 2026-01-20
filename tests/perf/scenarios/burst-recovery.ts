/**
 * Scenario C: Burst + Recovery
 *
 * Tests how the server handles burst traffic and recovers afterward.
 * This scenario measures queue depth behavior and recovery time.
 *
 * Configuration:
 * - 50 clients × 10 documents × 100-op bursts + 20s tail
 * - Phase 1: 10s burst at 5,000 ops/sec
 * - Phase 2: 20s tail at reduced rate to measure recovery
 *
 * Measures:
 * - Peak latency during burst
 * - Recovery latency after burst
 * - Queue depth behavior
 */

import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import {
  PerfClient,
  createClients,
  connectClients,
  disconnectClients,
  DeltaMessage,
} from '../../helpers/client';
import { computeLatencyStats, sleep } from '../../helpers/metrics';
import { getServerUrl } from '../../helpers/server';

export interface BurstRecoveryResult {
  scenario: 'burst-recovery';
  config: {
    clients: number;
    documents: number;
    burstOpsPerSecPerClient: number;
    burstDurationSec: number;
    tailDurationSec: number;
    peakOpsPerSec: number;
  };
  metrics: {
    burstOpsSent: number;
    tailOpsSent: number;
    totalOpsSent: number;
    totalOpsReceived: number;
    convergenceRate: number;
    burstLatencyP95Ms: number;
    tailLatencyP95Ms: number;
    overallLatencyP95Ms: number;
    recoveryTimeMs: number;
  };
  raw: {
    burstLatenciesMs: number[];
    tailLatenciesMs: number[];
  };
}

const CONFIG = {
  clients: 50,
  documents: 10,
  burstOpsPerSecPerClient: 100,
  burstDurationSec: 10,
  tailDurationSec: 20,
  tailOpsPerSecPerClient: 10, // Reduced rate during recovery
};

export async function runBurstRecovery(
  serverUrl: string
): Promise<BurstRecoveryResult> {
  const documentIds = Array.from(
    { length: CONFIG.documents },
    (_, i) => `burst-doc-${Date.now()}-${i}`
  );
  const peakOpsPerSec = CONFIG.clients * CONFIG.burstOpsPerSecPerClient;

  console.log(`[burst-recovery] Starting scenario:`);
  console.log(`  Clients: ${CONFIG.clients}`);
  console.log(`  Documents: ${CONFIG.documents}`);
  console.log(`  Burst: ${CONFIG.burstDurationSec}s at ${peakOpsPerSec} ops/sec`);
  console.log(`  Tail: ${CONFIG.tailDurationSec}s at reduced rate`);

  // Create clients - 40 senders, 10 receivers
  const senderCount = 40;
  const receiverCount = 10;
  const senders = await createClients(senderCount, serverUrl);
  const receivers = await createClients(receiverCount, serverUrl);
  const allClients = [...senders, ...receivers];

  const sentAt = new Map<string, number>();
  const burstLatenciesMs: number[] = [];
  const tailLatenciesMs: number[] = [];
  const converged = new Set<string>();
  let totalOpsReceived = 0;
  let burstEndTime = 0;

  // Connect all clients
  console.log(`  Connecting ${allClients.length} clients...`);
  await connectClients(allClients, 25);

  // Each client subscribes to all documents
  console.log(`  Syncing clients to documents...`);
  await Promise.all(
    allClients.flatMap((client) =>
      documentIds.map((docId) => client.sync(docId))
    )
  );

  // Setup receivers to track latencies (burst vs tail)
  receivers.forEach((receiver) => {
    receiver.onDelta((message: DeltaMessage) => {
      totalOpsReceived++;
      const fields: string[] = [];
      if (message.field) {
        fields.push(message.field);
      } else if (message.delta) {
        fields.push(...Object.keys(message.delta));
      }

      for (const field of fields) {
        const timestamp = sentAt.get(field);
        if (timestamp && !converged.has(field)) {
          const latency = Date.now() - timestamp;
          // Classify as burst or tail based on when it was sent
          if (burstEndTime === 0 || timestamp <= burstEndTime) {
            burstLatenciesMs.push(latency);
          } else {
            tailLatenciesMs.push(latency);
          }
          if (latency <= 2000) {
            converged.add(field);
          }
        }
      }
    });
  });

  // Phase 1: Burst
  console.log(`  Phase 1: Burst (${CONFIG.burstDurationSec}s)...`);
  const burstOps = peakOpsPerSec * CONFIG.burstDurationSec;
  const opsPerSenderBurst = Math.ceil(burstOps / senderCount);
  const burstIntervalMs = 1000 / CONFIG.burstOpsPerSecPerClient;

  let burstOpsSent = 0;
  const burstStartTime = Date.now();

  const burstPromises = senders.map(async (sender, senderIdx) => {
    for (let i = 0; i < opsPerSenderBurst; i++) {
      if (burstOpsSent >= burstOps) break;

      const docIdx = (senderIdx + i) % CONFIG.documents;
      const documentId = documentIds[docIdx];
      const field = `burst-${senderIdx}-${i}-${Date.now()}`;
      sentAt.set(field, Date.now());
      burstOpsSent++;

      await sender.sendDelta(documentId, { [field]: burstOpsSent });
      await sleep(burstIntervalMs);
    }
  });

  await Promise.all(burstPromises);
  burstEndTime = Date.now();
  const burstDuration = burstEndTime - burstStartTime;
  console.log(`    Burst completed: ${burstOpsSent} ops in ${burstDuration}ms`);

  // Phase 2: Tail (recovery)
  console.log(`  Phase 2: Tail/Recovery (${CONFIG.tailDurationSec}s)...`);
  const tailOpsPerSec = CONFIG.clients * CONFIG.tailOpsPerSecPerClient;
  const tailOps = tailOpsPerSec * CONFIG.tailDurationSec;
  const opsPerSenderTail = Math.ceil(tailOps / senderCount);
  const tailIntervalMs = 1000 / CONFIG.tailOpsPerSecPerClient;

  let tailOpsSent = 0;
  const tailStartTime = Date.now();
  let recoveryTime = 0;
  let recoveryDetected = false;

  const tailPromises = senders.map(async (sender, senderIdx) => {
    for (let i = 0; i < opsPerSenderTail; i++) {
      if (tailOpsSent >= tailOps) break;

      const docIdx = (senderIdx + i) % CONFIG.documents;
      const documentId = documentIds[docIdx];
      const field = `tail-${senderIdx}-${i}-${Date.now()}`;
      sentAt.set(field, Date.now());
      tailOpsSent++;

      await sender.sendDelta(documentId, { [field]: tailOpsSent });

      // Check for recovery (P95 drops below 100ms)
      if (!recoveryDetected && tailLatenciesMs.length >= 10) {
        const recentStats = computeLatencyStats(tailLatenciesMs.slice(-10));
        if (recentStats.p95 < 100) {
          recoveryTime = Date.now() - burstEndTime;
          recoveryDetected = true;
        }
      }

      await sleep(tailIntervalMs);
    }
  });

  await Promise.all(tailPromises);

  // Wait for final convergence
  await sleep(3000);

  await disconnectClients(allClients);

  // Calculate recovery time if not detected during tail
  if (!recoveryDetected && tailLatenciesMs.length > 0) {
    recoveryTime = Date.now() - burstEndTime;
  }

  const burstStats = computeLatencyStats(burstLatenciesMs);
  const tailStats = computeLatencyStats(tailLatenciesMs);
  const allLatencies = [...burstLatenciesMs, ...tailLatenciesMs];
  const overallStats = computeLatencyStats(allLatencies);

  const totalOpsSent = burstOpsSent + tailOpsSent;

  const result: BurstRecoveryResult = {
    scenario: 'burst-recovery',
    config: {
      clients: CONFIG.clients,
      documents: CONFIG.documents,
      burstOpsPerSecPerClient: CONFIG.burstOpsPerSecPerClient,
      burstDurationSec: CONFIG.burstDurationSec,
      tailDurationSec: CONFIG.tailDurationSec,
      peakOpsPerSec,
    },
    metrics: {
      burstOpsSent,
      tailOpsSent,
      totalOpsSent,
      totalOpsReceived,
      convergenceRate: totalOpsSent === 0 ? 1 : converged.size / totalOpsSent,
      burstLatencyP95Ms: burstStats.p95,
      tailLatencyP95Ms: tailStats.p95,
      overallLatencyP95Ms: overallStats.p95,
      recoveryTimeMs: recoveryTime,
    },
    raw: {
      burstLatenciesMs,
      tailLatenciesMs,
    },
  };

  console.log(`[burst-recovery] Results:`);
  console.log(`  Burst Sent: ${result.metrics.burstOpsSent}`);
  console.log(`  Tail Sent: ${result.metrics.tailOpsSent}`);
  console.log(`  Convergence: ${(result.metrics.convergenceRate * 100).toFixed(1)}%`);
  console.log(`  Burst P95: ${result.metrics.burstLatencyP95Ms}ms`);
  console.log(`  Tail P95: ${result.metrics.tailLatencyP95Ms}ms`);
  console.log(`  Recovery Time: ${result.metrics.recoveryTimeMs}ms`);

  return result;
}

if (import.meta.main) {
  const serverUrl = getServerUrl();
  runBurstRecovery(serverUrl)
    .then(async (result) => {
      const outputDir = process.env.PERF_OUTPUT_DIR || 'results';
      await mkdir(outputDir, { recursive: true });
      const fileName = `scenario-burst-recovery-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const filePath = path.join(outputDir, fileName);
      await writeFile(filePath, JSON.stringify(result, null, 2));
      console.log(`\nSaved: ${filePath}`);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
