import os from 'os';
import { formatRuntime, getOsLabel } from '../helpers/metrics';

export interface EnvironmentInfo {
  os: string;
  cpu: string;
  ramGb: number;
  runtime: string;
  timestamp: string;
}

export function captureEnvironment(): EnvironmentInfo {
  const cpus = os.cpus();
  const cpuModel = cpus[0]?.model ?? 'Unknown CPU';
  const cpuCount = cpus.length;

  return {
    os: getOsLabel(),
    cpu: `${cpuModel} (${cpuCount} cores)`,
    ramGb: Math.round(os.totalmem() / (1024 ** 3)),
    runtime: formatRuntime(),
    timestamp: new Date().toISOString(),
  };
}

if (import.meta.main) {
  console.log(JSON.stringify(captureEnvironment(), null, 2));
}
