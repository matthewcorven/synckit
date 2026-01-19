import { PerfClient, createClients, connectClients, disconnectClients } from '../helpers/client';
import { sleep } from '../helpers/metrics';

export interface OpsMeasurement {
  sent: number;
  convergedWithin1s: number;
  convergenceRate: number;
  latenciesMs: number[];
}

export interface OpsMeasurementOptions {
  serverUrl: string;
  senderCount: number;
  receiverCount: number;
  opsPerSec: number;
  durationSec: number;
  documentId?: string;
}

function createDocumentId(): string {
  return `perf-doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function runOpsMeasurement(options: OpsMeasurementOptions): Promise<OpsMeasurement> {
  const documentId = options.documentId ?? createDocumentId();
  const senders = await createClients(options.senderCount, options.serverUrl);
  const receivers = await createClients(options.receiverCount, options.serverUrl);
  const allClients = [...senders, ...receivers];

  const sentAt = new Map<string, number>();
  const latenciesMs: number[] = [];
  const converged = new Set<string>();

  await connectClients(allClients);
  await Promise.all(allClients.map(client => client.sync(documentId)));

  receivers.forEach(receiver => {
    receiver.onDelta(message => {
      // Handle both SDK format (field/value) and delta object format (batched)
      const fields: string[] = [];
      
      if (message.field) {
        // SDK format: single field per message
        fields.push(message.field);
      } else if (message.delta) {
        // Batched format: multiple fields in single message
        // Process ALL keys, not just the first one
        const keys = Object.keys(message.delta);
        fields.push(...keys);
      }

      // Track convergence for all fields in this message
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

  const totalOps = Math.floor(options.opsPerSec * options.durationSec);
  if (totalOps === 0) {
    await disconnectClients(allClients);
    return { sent: 0, convergedWithin1s: 0, convergenceRate: 1, latenciesMs: [] };
  }

  const opsPerSender = Math.ceil(totalOps / options.senderCount);
  const intervalMs = 1000 / (options.opsPerSec / options.senderCount);

  let sent = 0;
  const sendPromises = senders.map(async (sender, senderIndex) => {
    for (let i = 0; i < opsPerSender; i += 1) {
      if (sent >= totalOps) break;
      const field = `op-${senderIndex}-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      sentAt.set(field, Date.now());
      sent += 1;
      await sender.sendDelta(documentId, { [field]: sent });
      await sleep(intervalMs);
    }
  });

  await Promise.all(sendPromises);
  await sleep(1200);

  await disconnectClients(allClients);

  const convergedWithin1s = converged.size;
  const convergenceRate = sent === 0 ? 1 : convergedWithin1s / sent;

  return {
    sent,
    convergedWithin1s,
    convergenceRate,
    latenciesMs,
  };
}
