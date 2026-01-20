/**
 * Scenario B: Multi-Doc Distribution
 *
 * Tests overhead when operations are distributed across many documents.
 * This scenario measures baseline overhead without lock contention.
 *
 * Configuration:
 * - 100 clients × 100 documents × 10 ops/sec (30s)
 * - Total: 1,000 ops/sec distributed across 100 documents
 * - Duration: 30 seconds
 *
 * Measures:
 * - Overhead without lock contention
 * - Connection/document management overhead
 * - P95 latency in distributed scenario
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

export interface MultiDocDistributionResult {
  scenario: 'multi-doc-distribution';
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
  clients: 100,
  documents: 100,
  opsPerSecPerClient: 10,
  durationSec: 30,
};

export async function runMultiDocDistribution(
  serverUrl: string
): Promise<MultiDocDistributionResult> {
  const documentIds = Array.from(
    { length: CONFIG.documents },
    (_, i) => `dist-doc-${Date.now()}-${i}`
  );
  const totalOpsPerSec = CONFIG.clients * CONFIG.opsPerSecPerClient;

  console.log(`[multi-doc-distribution] Starting scenario:`);
  console.log(`  Clients: ${CONFIG.clients}`);
  console.log(`  Documents: ${CONFIG.documents}`);
  console.log(`  Ops/sec/client: ${CONFIG.opsPerSecPerClient}`);
  console.log(`  Total ops/sec: ${totalOpsPerSec}`);
  console.log(`  Duration: ${CONFIG.durationSec}s`);

  // Create clients - 80% senders, 20% receivers
  const senderCount = Math.floor(CONFIG.clients * 0.8);
  const receiverCount = CONFIG.clients - senderCount;
  const senders = await createClients(senderCount, serverUrl);
  const receivers = await createClients(receiverCount, serverUrl);
  const allClients = [...senders, ...receivers];

  const sentAt = new Map<string, number>();
  const latenciesMs: number[] = [];
  const converged = new Set<string>();
  let totalOpsReceived = 0;

  // Connect all clients in batches
  console.log(`  Connecting ${allClients.length} clients...`);
  await connectClients(allClients, 50);

  // Each client subscribes to a subset of documents (round-robin)
  console.log(`  Syncing clients to documents...`);
  await Promise.all(
    allClients.map(async (client, idx) => {
      // Each client subscribes to ~10 documents
      const docSubset = documentIds.filter((_, docIdx) => docIdx % 10 === idx % 10);
      for (const docId of docSubset) {
        await client.sync(docId);
      }
    })
  );

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

  // Run senders in parallel, each sender targets different documents
  console.log(`  Running ${CONFIG.durationSec}s load test...`);
  const sendPromises = senders.map(async (sender, senderIdx) => {
    for (let i = 0; i < opsPerSender; i++) {
      if (totalOpsSent >= totalOps) break;

      // Round-robin across documents
      const docIdx = (senderIdx + i) % CONFIG.documents;
      const documentId = documentIds[docIdx];
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

  const result: MultiDocDistributionResult = {
    scenario: 'multi-doc-distribution',
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

  console.log(`[multi-doc-distribution] Results:`);
  console.log(`  Sent: ${result.metrics.totalOpsSent}`);
  console.log(`  Convergence: ${(result.metrics.convergenceRate * 100).toFixed(1)}%`);
  console.log(`  P95 Latency: ${result.metrics.latencyP95Ms}ms`);
  console.log(`  Throughput: ${result.metrics.avgThroughputOpsPerSec} ops/sec`);

  return result;
}

if (import.meta.main) {
  const serverUrl = getServerUrl();
  runMultiDocDistribution(serverUrl)
    .then(async (result) => {
      const outputDir = process.env.PERF_OUTPUT_DIR || 'results';
      await mkdir(outputDir, { recursive: true });
      const fileName = `scenario-multi-doc-distribution-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const filePath = path.join(outputDir, fileName);
      await writeFile(filePath, JSON.stringify(result, null, 2));
      console.log(`\nSaved: ${filePath}`);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
