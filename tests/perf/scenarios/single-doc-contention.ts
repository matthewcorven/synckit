/**
 * Scenario A: Single-Doc Contention
 *
 * Tests lock contention behavior when multiple clients simultaneously update
 * a single document. This scenario stresses the synchronization mechanism.
 *
 * Configuration:
 * - 10 clients × 1 document × 100 ops/sec (30s)
 * - Total: 1,000 ops/sec to a single document
 * - Duration: 30 seconds
 *
 * Measures:
 * - Lock contention impact on latency
 * - P95 latency under high contention
 * - Throughput sustainability
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

export interface SingleDocContentionResult {
  scenario: 'single-doc-contention';
  config: {
    clients: number;
    documents: number;
    opsPerSecPerClient: number;
    durationSec: number;
    totalOpsPerSec: number;
  };
  metrics: {
    totalOpsSent: number;
    totalOpsReceived: number;
    convergenceRate: number;
    latencyP50Ms: number;
    latencyP95Ms: number;
    latencyP99Ms: number;
    avgThroughputOpsPerSec: number;
  };
  raw: {
    latenciesMs: number[];
  };
}

const CONFIG = {
  clients: 10,
  documents: 1,
  opsPerSecPerClient: 100,
  durationSec: 30,
};

export async function runSingleDocContention(
  serverUrl: string
): Promise<SingleDocContentionResult> {
  const documentId = `contention-${Date.now()}`;
  const totalOpsPerSec = CONFIG.clients * CONFIG.opsPerSecPerClient;

  console.log(`[single-doc-contention] Starting scenario:`);
  console.log(`  Clients: ${CONFIG.clients}`);
  console.log(`  Document: ${documentId}`);
  console.log(`  Ops/sec/client: ${CONFIG.opsPerSecPerClient}`);
  console.log(`  Total ops/sec: ${totalOpsPerSec}`);
  console.log(`  Duration: ${CONFIG.durationSec}s`);

  // Create clients - all senders except one receiver
  const senderCount = CONFIG.clients - 1;
  const receiverCount = 1;
  const senders = await createClients(senderCount, serverUrl);
  const receivers = await createClients(receiverCount, serverUrl);
  const allClients = [...senders, ...receivers];

  const sentAt = new Map<string, number>();
  const latenciesMs: number[] = [];
  const converged = new Set<string>();
  let totalOpsReceived = 0;

  await connectClients(allClients);
  await Promise.all(allClients.map((client) => client.sync(documentId)));

  // Setup receivers to track latencies
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
          latenciesMs.push(latency);
          if (latency <= 1000) {
            converged.add(field);
          }
        }
      }
    });
  });

  // Calculate timing
  const totalOps = totalOpsPerSec * CONFIG.durationSec;
  const opsPerSender = Math.ceil(totalOps / senderCount);
  const intervalMs = 1000 / CONFIG.opsPerSecPerClient;

  let totalOpsSent = 0;
  const startTime = Date.now();

  // Run senders in parallel
  const sendPromises = senders.map(async (sender, senderIdx) => {
    for (let i = 0; i < opsPerSender; i++) {
      if (totalOpsSent >= totalOps) break;

      const field = `op-${senderIdx}-${i}-${Date.now()}`;
      sentAt.set(field, Date.now());
      totalOpsSent++;

      await sender.sendDelta(documentId, { [field]: totalOpsSent });
      await sleep(intervalMs);
    }
  });

  await Promise.all(sendPromises);
  const elapsed = Date.now() - startTime;

  // Wait for convergence
  await sleep(2000);

  await disconnectClients(allClients);

  const stats = computeLatencyStats(latenciesMs);
  const avgThroughput = (totalOpsSent / elapsed) * 1000;

  const result: SingleDocContentionResult = {
    scenario: 'single-doc-contention',
    config: {
      clients: CONFIG.clients,
      documents: CONFIG.documents,
      opsPerSecPerClient: CONFIG.opsPerSecPerClient,
      durationSec: CONFIG.durationSec,
      totalOpsPerSec,
    },
    metrics: {
      totalOpsSent,
      totalOpsReceived,
      convergenceRate: totalOpsSent === 0 ? 1 : converged.size / totalOpsSent,
      latencyP50Ms: stats.p50,
      latencyP95Ms: stats.p95,
      latencyP99Ms: stats.p99,
      avgThroughputOpsPerSec: Math.round(avgThroughput),
    },
    raw: {
      latenciesMs,
    },
  };

  console.log(`[single-doc-contention] Results:`);
  console.log(`  Sent: ${result.metrics.totalOpsSent}`);
  console.log(`  Convergence: ${(result.metrics.convergenceRate * 100).toFixed(1)}%`);
  console.log(`  P95 Latency: ${result.metrics.latencyP95Ms}ms`);
  console.log(`  Throughput: ${result.metrics.avgThroughputOpsPerSec} ops/sec`);

  return result;
}

if (import.meta.main) {
  const serverUrl = getServerUrl();
  runSingleDocContention(serverUrl)
    .then(async (result) => {
      const outputDir = process.env.PERF_OUTPUT_DIR || 'results';
      await mkdir(outputDir, { recursive: true });
      const fileName = `scenario-single-doc-contention-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const filePath = path.join(outputDir, fileName);
      await writeFile(filePath, JSON.stringify(result, null, 2));
      console.log(`\nSaved: ${filePath}`);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
