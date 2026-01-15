import { readFile, readdir, writeFile } from 'fs/promises';
import path from 'path';

interface PerfResult {
  serverType: 'typescript' | 'csharp';
  timestamp: string;
  environment: {
    os: string;
    cpu: string;
    ramGb: number;
    runtime: string;
    timestamp: string;
  };
  metrics: {
    maxConcurrentConnections: number;
    maxOpsPerSecSingleClient: number;
    maxOpsPerSecAggregate: number;
    p95LatencyMs: number;
    memoryGrowthMbPerMin: number;
  };
}

const PERF_TABLE_START = '<!-- PERF_TABLE_START -->';
const PERF_TABLE_END = '<!-- PERF_TABLE_END -->';
const PERF_ENV_START = '<!-- PERF_ENV_START -->';
const PERF_ENV_END = '<!-- PERF_ENV_END -->';

function resolveResultsDir(): string {
  return process.env.PERF_OUTPUT_DIR
    ? path.resolve(process.env.PERF_OUTPUT_DIR)
    : path.resolve(process.cwd(), 'results');
}

function formatNumber(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString();
}

function formatDecimal(value: number | undefined, digits: number = 2): string {
  if (value === undefined || Number.isNaN(value)) return '—';
  return value.toFixed(digits);
}

async function loadResults(): Promise<PerfResult[]> {
  const dir = resolveResultsDir();
  let files: string[] = [];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const results: PerfResult[] = [];
  for (const file of files) {
    if (!file.startsWith('perf-') || !file.endsWith('.json')) continue;
    const content = await readFile(path.join(dir, file), 'utf8');
    try {
      results.push(JSON.parse(content));
    } catch {
      // ignore invalid
    }
  }

  return results;
}

function latestByType(results: PerfResult[]): Record<'typescript' | 'csharp', PerfResult | null> {
  const latest: Record<'typescript' | 'csharp', PerfResult | null> = {
    typescript: null,
    csharp: null,
  };

  for (const result of results) {
    const existing = latest[result.serverType];
    if (!existing || new Date(result.timestamp) > new Date(existing.timestamp)) {
      latest[result.serverType] = result;
    }
  }

  return latest;
}

function buildTable(latest: Record<'typescript' | 'csharp', PerfResult | null>): string {
  const ts = latest.typescript;
  const cs = latest.csharp;

  const lines = [
    PERF_TABLE_START,
    '| Metric | TypeScript | C# | Unit |',
    '|--------|------------|-----|------|',
    `| Max Concurrent Connections | ${formatNumber(ts?.metrics.maxConcurrentConnections)} | ${formatNumber(cs?.metrics.maxConcurrentConnections)} | connections |`,
    `| Max Ops/Sec (Single Client) | ${formatNumber(ts?.metrics.maxOpsPerSecSingleClient)} | ${formatNumber(cs?.metrics.maxOpsPerSecSingleClient)} | ops/sec |`,
    `| Max Ops/Sec (Aggregate) | ${formatNumber(ts?.metrics.maxOpsPerSecAggregate)} | ${formatNumber(cs?.metrics.maxOpsPerSecAggregate)} | ops/sec |`,
    `| P95 Latency | ${formatNumber(ts?.metrics.p95LatencyMs)} | ${formatNumber(cs?.metrics.p95LatencyMs)} | ms |`,
    `| Memory Growth | ${formatDecimal(ts?.metrics.memoryGrowthMbPerMin)} | ${formatDecimal(cs?.metrics.memoryGrowthMbPerMin)} | MB/min |`,
    '',
    `*Last updated: ${(ts?.timestamp || cs?.timestamp || new Date().toISOString())}*`,
    PERF_TABLE_END,
  ];

  return lines.join('\n');
}

function buildEnvironment(latest: Record<'typescript' | 'csharp', PerfResult | null>): string {
  const rows = [
    PERF_ENV_START,
    '| Server | OS | CPU | RAM (GB) | Runtime | Captured |',
    '|--------|----|-----|----------|---------|----------|',
  ];

  const typescript = latest.typescript;
  const csharp = latest.csharp;

  const formatRow = (label: string, result: PerfResult | null) => {
    if (!result) {
      return `| ${label} | — | — | — | — | — |`;
    }
    return `| ${label} | ${result.environment.os} | ${result.environment.cpu} | ${formatNumber(result.environment.ramGb)} | ${result.environment.runtime} | ${result.environment.timestamp} |`;
  };

  rows.push(formatRow('TypeScript', typescript));
  rows.push(formatRow('C#', csharp));
  rows.push(PERF_ENV_END);

  return rows.join('\n');
}

async function updateDocument(): Promise<void> {
  const results = await loadResults();
  const latest = latestByType(results);

  const docPath = path.resolve(process.cwd(), '../docs/architecture/SERVER_PERFORMANCE.md');
  const content = await readFile(docPath, 'utf8');

  const updatedTable = buildTable(latest);
  const updatedEnv = buildEnvironment(latest);

  const withEnv = content.replace(new RegExp(`${PERF_ENV_START}[\s\S]*?${PERF_ENV_END}`), updatedEnv);
  const withTable = withEnv.replace(new RegExp(`${PERF_TABLE_START}[\s\S]*?${PERF_TABLE_END}`), updatedTable);

  await writeFile(docPath, withTable);
  console.log(`Updated ${docPath}`);
}

if (import.meta.main) {
  updateDocument().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
