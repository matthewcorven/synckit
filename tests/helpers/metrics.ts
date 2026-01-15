import os from 'os';

export interface LatencyStats {
  p50: number;
  p95: number;
  p99: number;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

export function computeLatencyStats(values: number[]): LatencyStats {
  return {
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
  };
}

export function linearRegressionSlope(samples: Array<{ x: number; y: number }>): number {
  if (samples.length < 2) return 0;
  const n = samples.length;
  const sumX = samples.reduce((acc, s) => acc + s.x, 0);
  const sumY = samples.reduce((acc, s) => acc + s.y, 0);
  const sumXY = samples.reduce((acc, s) => acc + s.x * s.y, 0);
  const sumXX = samples.reduce((acc, s) => acc + s.x * s.x, 0);
  const numerator = n * sumXY - sumX * sumY;
  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return 0;
  return numerator / denominator;
}

export function formatRuntime(): string {
  const runtime = typeof Bun !== 'undefined' ? `Bun ${Bun.version}` : `Node ${process.version}`;
  return runtime;
}

export function getOsLabel(): string {
  const platform = process.platform;
  const release = os.release();
  if (platform === 'darwin') return `macOS ${release}`;
  if (platform === 'win32') return `Windows ${release}`;
  return `${platform} ${release}`;
}
