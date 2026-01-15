import { PerfClient, connectClients, createClients, disconnectClients } from '../helpers/client';
import { linearRegressionSlope, sleep } from '../helpers/metrics';
import { getServerUrl } from '../helpers/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface MemoryResult {
  initialHeapMb: number;
  finalHeapMb: number;
  growthMbPerMin: number;
  stable: boolean;
}

async function getProcessRssMb(pid: number): Promise<number> {
  const { stdout } = await execAsync(`ps -o rss= -p ${pid}`);
  const rssKb = Number(stdout.trim());
  if (Number.isNaN(rssKb)) return 0;
  return rssKb / 1024;
}

function getSelfHeapMb(): number {
  return process.memoryUsage().heapUsed / (1024 * 1024);
}

async function getMemoryMb(): Promise<number> {
  const pid = process.env.SERVER_PID ? Number(process.env.SERVER_PID) : NaN;
  if (!Number.isNaN(pid)) {
    try {
      return await getProcessRssMb(pid);
    } catch {
      return getSelfHeapMb();
    }
  }
  return getSelfHeapMb();
}

async function sustainedLoad(clients: PerfClient[], documentId: string, opsPerSec: number): Promise<() => void> {
  const senders = clients;
  const perSenderRate = Math.max(1, Math.floor(opsPerSec / senders.length));
  const intervalMs = Math.max(1, Math.floor(1000 / perSenderRate));
  const timers: NodeJS.Timeout[] = [];

  senders.forEach((sender, index) => {
    let counter = 0;
    const timer = setInterval(() => {
      const field = `mem-${index}-${counter++}-${Date.now()}`;
      sender.sendDelta(documentId, { [field]: counter }).catch(() => undefined);
    }, intervalMs);
    timers.push(timer);
  });

  return () => timers.forEach(timer => clearInterval(timer));
}

export async function discoverMemoryStability(serverUrl: string): Promise<MemoryResult> {
  const durationSec = Number(process.env.PERF_MEMORY_DURATION_SEC || 300);
  const sampleIntervalSec = Number(process.env.PERF_MEMORY_SAMPLE_SEC || 10);
  const stableThreshold = Number(process.env.PERF_MEMORY_STABLE_MB_PER_MIN || 1);

  const clients = await createClients(3, serverUrl);
  await connectClients(clients);
  const documentId = `perf-mem-${Date.now()}`;
  await Promise.all(clients.map(client => client.sync(documentId)));

  const stopLoad = await sustainedLoad(clients, documentId, 150);

  const samples: Array<{ x: number; y: number }> = [];
  const start = Date.now();
  const endAt = start + durationSec * 1000;

  while (Date.now() < endAt) {
    const elapsedMin = (Date.now() - start) / 60000;
    const memoryMb = await getMemoryMb();
    samples.push({ x: elapsedMin, y: memoryMb });
    await sleep(sampleIntervalSec * 1000);
  }

  stopLoad();
  await disconnectClients(clients);

  const initialHeapMb = samples[0]?.y ?? 0;
  const finalHeapMb = samples[samples.length - 1]?.y ?? initialHeapMb;
  const growthMbPerMin = linearRegressionSlope(samples);
  const stable = growthMbPerMin <= stableThreshold;

  return {
    initialHeapMb,
    finalHeapMb,
    growthMbPerMin,
    stable,
  };
}

if (import.meta.main) {
  const serverUrl = getServerUrl();
  discoverMemoryStability(serverUrl).then(result => {
    console.log(JSON.stringify(result, null, 2));
  });
}
