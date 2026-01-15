import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { captureEnvironment } from './capture-environment';
import { discoverMaxConnections } from './discover-max-connections';
import { discoverMaxOps } from './discover-max-ops';
import { discoverLatencyCeiling } from './discover-latency-ceiling';
import { discoverMemoryStability } from './discover-memory-stability';
import { getServerType, getServerUrl } from '../helpers/server';

export interface PerfResult {
  serverType: 'typescript' | 'csharp';
  timestamp: string;
  environment: ReturnType<typeof captureEnvironment>;
  metrics: {
    maxConcurrentConnections: number;
    maxOpsPerSecSingleClient: number;
    maxOpsPerSecAggregate: number;
    p95LatencyMs: number;
    memoryGrowthMbPerMin: number;
  };
  details: {
    connections: Awaited<ReturnType<typeof discoverMaxConnections>>;
    ops: Awaited<ReturnType<typeof discoverMaxOps>>;
    latency: Awaited<ReturnType<typeof discoverLatencyCeiling>>;
    memory: Awaited<ReturnType<typeof discoverMemoryStability>>;
  };
}

function resolveOutputDir(): string {
  const override = process.env.PERF_OUTPUT_DIR;
  if (override) return override;
  return path.resolve(process.cwd(), 'results');
}

const VERBOSE = process.env.PERF_VERBOSE === 'true';

function log(message: string): void {
  if (VERBOSE) console.log(`[perf] ${message}`);
}

async function main(): Promise<void> {
  const serverType = getServerType();
  const serverUrl = getServerUrl();
  const timestamp = new Date().toISOString();

  log(`Starting perf discovery for ${serverType} at ${serverUrl}`);

  const environment = captureEnvironment();

  log('Discovering max connections...');
  const connections = await discoverMaxConnections(serverUrl);
  log(`Max connections: ${connections.maxConnections}`);

  log('Discovering max ops/sec...');
  const ops = await discoverMaxOps(serverUrl);
  log(`Max ops (single): ${ops.singleClientMax}, aggregate: ${ops.aggregateMax}`);

  log('Discovering latency ceiling...');
  const latency = await discoverLatencyCeiling(serverUrl, { maxOpsPerSec: ops.aggregateMax });
  log(`P95 latency at max: ${latency.p95AtMax}ms`);

  log('Discovering memory stability...');
  const memory = await discoverMemoryStability(serverUrl);
  log(`Memory growth: ${memory.growthMbPerMin.toFixed(2)} MB/min`);

  const result: PerfResult = {
    serverType,
    timestamp,
    environment,
    metrics: {
      maxConcurrentConnections: connections.maxConnections,
      maxOpsPerSecSingleClient: ops.singleClientMax,
      maxOpsPerSecAggregate: ops.aggregateMax,
      p95LatencyMs: latency.p95AtMax,
      memoryGrowthMbPerMin: memory.growthMbPerMin,
    },
    details: {
      connections,
      ops,
      latency,
      memory,
    },
  };

  const outputDir = resolveOutputDir();
  await mkdir(outputDir, { recursive: true });
  const fileName = `perf-${serverType}-${timestamp.replace(/[:.]/g, '-')}.json`;
  const filePath = path.join(outputDir, fileName);
  await writeFile(filePath, JSON.stringify(result, null, 2));

  console.log(`Saved ${filePath}`);
}

if (import.meta.main) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
