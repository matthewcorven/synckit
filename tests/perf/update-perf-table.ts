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

function parseNumber(value: string): number | undefined {
  if (!value || value === '—') return undefined;
  // Remove commas from formatted numbers like "30,001"
  const cleaned = value.replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

/**
 * Parse existing results from SERVER_PERFORMANCE.md markdown tables.
 * This preserves results for servers that don't have fresh JSON files.
 */
function parseExistingResults(content: string): Record<'typescript' | 'csharp', PerfResult | null> {
  const results: Record<'typescript' | 'csharp', PerfResult | null> = {
    typescript: null,
    csharp: null,
  };

  // Parse environment table
  const envMatch = content.match(/<!-- PERF_ENV_START -->([\s\S]*?)<!-- PERF_ENV_END -->/);
  if (envMatch) {
    const envTable = envMatch[1];
    const tsEnvMatch = envTable.match(/\| TypeScript \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|/);
    const csEnvMatch = envTable.match(/\| C# \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|/);

    if (tsEnvMatch && tsEnvMatch[1].trim() !== '—') {
      results.typescript = {
        serverType: 'typescript',
        timestamp: tsEnvMatch[5].trim(),
        environment: {
          os: tsEnvMatch[1].trim(),
          cpu: tsEnvMatch[2].trim(),
          ramGb: parseNumber(tsEnvMatch[3].trim()) || 0,
          runtime: tsEnvMatch[4].trim(),
          timestamp: tsEnvMatch[5].trim(),
        },
        metrics: {
          maxConcurrentConnections: 0,
          maxOpsPerSecSingleClient: 0,
          maxOpsPerSecAggregate: 0,
          p95LatencyMs: 0,
          memoryGrowthMbPerMin: 0,
        },
      };
    }

    if (csEnvMatch && csEnvMatch[1].trim() !== '—') {
      results.csharp = {
        serverType: 'csharp',
        timestamp: csEnvMatch[5].trim(),
        environment: {
          os: csEnvMatch[1].trim(),
          cpu: csEnvMatch[2].trim(),
          ramGb: parseNumber(csEnvMatch[3].trim()) || 0,
          runtime: csEnvMatch[4].trim(),
          timestamp: csEnvMatch[5].trim(),
        },
        metrics: {
          maxConcurrentConnections: 0,
          maxOpsPerSecSingleClient: 0,
          maxOpsPerSecAggregate: 0,
          p95LatencyMs: 0,
          memoryGrowthMbPerMin: 0,
        },
      };
    }
  }

  // Parse metrics table
  const tableMatch = content.match(/<!-- PERF_TABLE_START -->([\s\S]*?)<!-- PERF_TABLE_END -->/);
  if (tableMatch) {
    const table = tableMatch[1];
    const lines = table.split('\n').filter(line => line.includes('|'));

    for (const line of lines) {
      const cols = line.split('|').map(c => c.trim());
      if (cols.length < 5) continue;

      const metric = cols[1];
      const tsVal = cols[2];
      const csVal = cols[3];

      if (metric.includes('Max Concurrent Connections')) {
        if (results.typescript) results.typescript.metrics.maxConcurrentConnections = parseNumber(tsVal) || 0;
        if (results.csharp) results.csharp.metrics.maxConcurrentConnections = parseNumber(csVal) || 0;
      } else if (metric.includes('Max Ops/Sec (Single Client)')) {
        if (results.typescript) results.typescript.metrics.maxOpsPerSecSingleClient = parseNumber(tsVal) || 0;
        if (results.csharp) results.csharp.metrics.maxOpsPerSecSingleClient = parseNumber(csVal) || 0;
      } else if (metric.includes('Max Ops/Sec (Aggregate)')) {
        if (results.typescript) results.typescript.metrics.maxOpsPerSecAggregate = parseNumber(tsVal) || 0;
        if (results.csharp) results.csharp.metrics.maxOpsPerSecAggregate = parseNumber(csVal) || 0;
      } else if (metric.includes('P95 Latency')) {
        if (results.typescript) results.typescript.metrics.p95LatencyMs = parseNumber(tsVal) || 0;
        if (results.csharp) results.csharp.metrics.p95LatencyMs = parseNumber(csVal) || 0;
      } else if (metric.includes('Memory Growth')) {
        if (results.typescript) results.typescript.metrics.memoryGrowthMbPerMin = parseNumber(tsVal) || 0;
        if (results.csharp) results.csharp.metrics.memoryGrowthMbPerMin = parseNumber(csVal) || 0;
      }
    }
  }

  return results;
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
  const docPath = path.resolve(process.cwd(), '../docs/architecture/SERVER_PERFORMANCE.md');
  const content = await readFile(docPath, 'utf8');

  // First, parse existing results from the markdown file
  // This preserves results for servers that don't have fresh JSON files
  const existingResults = parseExistingResults(content);
  console.log(`Existing TypeScript in markdown: ${existingResults.typescript?.timestamp || 'none'}`);
  console.log(`Existing C# in markdown: ${existingResults.csharp?.timestamp || 'none'}`);

  // Load fresh results from JSON files
  const results = await loadResults();
  console.log(`Found ${results.length} JSON result files`);
  const freshResults = latestByType(results);
  console.log(`Fresh TypeScript JSON: ${freshResults.typescript?.timestamp || 'none'}`);
  console.log(`Fresh C# JSON: ${freshResults.csharp?.timestamp || 'none'}`);

  // Merge: use the most recent result for each server type (compare timestamps)
  const pickLatest = (
    fresh: PerfResult | null,
    existing: PerfResult | null
  ): PerfResult | null => {
    if (!fresh && !existing) return null;
    if (!fresh) return existing;
    if (!existing) return fresh;
    // Compare timestamps - use the newer one
    const freshTime = new Date(fresh.timestamp).getTime();
    const existingTime = new Date(existing.timestamp).getTime();
    return freshTime >= existingTime ? fresh : existing;
  };

  const mergedResults: Record<'typescript' | 'csharp', PerfResult | null> = {
    typescript: pickLatest(freshResults.typescript, existingResults.typescript),
    csharp: pickLatest(freshResults.csharp, existingResults.csharp),
  };
  console.log(`Merged TypeScript: ${mergedResults.typescript?.timestamp || 'none'}`);
  console.log(`Merged C#: ${mergedResults.csharp?.timestamp || 'none'}`);

  const updatedTable = buildTable(mergedResults);
  const updatedEnv = buildEnvironment(mergedResults);

  // Use simpler string-based replacement
  const envStartIdx = content.indexOf(PERF_ENV_START);
  const envEndIdx = content.indexOf(PERF_ENV_END) + PERF_ENV_END.length;
  const tableStartIdx = content.indexOf(PERF_TABLE_START);
  const tableEndIdx = content.indexOf(PERF_TABLE_END) + PERF_TABLE_END.length;

  let updated = content;
  if (envStartIdx !== -1 && envEndIdx > envStartIdx) {
    updated = updated.substring(0, envStartIdx) + updatedEnv + updated.substring(envEndIdx);
  }
  
  // Re-find indices after first replacement
  const newTableStartIdx = updated.indexOf(PERF_TABLE_START);
  const newTableEndIdx = updated.indexOf(PERF_TABLE_END) + PERF_TABLE_END.length;
  if (newTableStartIdx !== -1 && newTableEndIdx > newTableStartIdx) {
    updated = updated.substring(0, newTableStartIdx) + updatedTable + updated.substring(newTableEndIdx);
  }

  await writeFile(docPath, updated);
  console.log(`Updated ${docPath}`);
}

if (import.meta.main) {
  updateDocument().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
