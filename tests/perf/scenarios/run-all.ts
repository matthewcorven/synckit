/**
 * Run all performance experiment scenarios
 *
 * Executes all 3 scenarios in sequence and combines results
 * into a single JSON file for experiment comparison.
 */

import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { getServerUrl, getServerType } from '../../helpers/server';
import { captureEnvironment } from '../capture-environment';
import { runSingleDocContention, SingleDocContentionResult } from './single-doc-contention';
import { runMultiDocDistribution, MultiDocDistributionResult } from './multi-doc-distribution';
import { runBurstRecovery, BurstRecoveryResult } from './burst-recovery';

export interface ExperimentResults {
  experimentName: string;
  serverType: 'typescript' | 'csharp';
  timestamp: string;
  gitCommit?: string;
  environment: ReturnType<typeof captureEnvironment>;
  scenarios: {
    singleDocContention: SingleDocContentionResult;
    multiDocDistribution: MultiDocDistributionResult;
    burstRecovery: BurstRecoveryResult;
  };
  summary: {
    scenarioA_P95_ms: number;
    scenarioB_P95_ms: number;
    scenarioC_P95_ms: number;
    avgThroughput_ops_sec: number;
    avgConvergenceRate: number;
  };
}

async function getGitCommit(): Promise<string | undefined> {
  try {
    const proc = Bun.spawn(['git', 'rev-parse', '--short', 'HEAD'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const output = await new Response(proc.stdout).text();
    return output.trim() || undefined;
  } catch {
    return undefined;
  }
}

export async function runAllScenarios(
  serverUrl: string,
  experimentName: string = 'unnamed'
): Promise<ExperimentResults> {
  const serverType = getServerType();
  const timestamp = new Date().toISOString();
  const environment = captureEnvironment();
  const gitCommit = await getGitCommit();

  console.log('='.repeat(60));
  console.log(`Performance Experiment: ${experimentName}`);
  console.log(`Server: ${serverType} @ ${serverUrl}`);
  console.log(`Timestamp: ${timestamp}`);
  console.log('='.repeat(60));

  // Run Scenario A: Single-Doc Contention
  console.log('\n' + '-'.repeat(40));
  console.log('Scenario A: Single-Doc Contention');
  console.log('-'.repeat(40));
  const singleDocContention = await runSingleDocContention(serverUrl);

  // Brief pause between scenarios
  console.log('\nPausing 5s before next scenario...');
  await Bun.sleep(5000);

  // Run Scenario B: Multi-Doc Distribution
  console.log('\n' + '-'.repeat(40));
  console.log('Scenario B: Multi-Doc Distribution');
  console.log('-'.repeat(40));
  const multiDocDistribution = await runMultiDocDistribution(serverUrl);

  // Brief pause between scenarios
  console.log('\nPausing 5s before next scenario...');
  await Bun.sleep(5000);

  // Run Scenario C: Burst + Recovery
  console.log('\n' + '-'.repeat(40));
  console.log('Scenario C: Burst + Recovery');
  console.log('-'.repeat(40));
  const burstRecovery = await runBurstRecovery(serverUrl);

  // Calculate summary metrics
  const summary = {
    scenarioA_P95_ms: singleDocContention.metrics.latencyP95Ms,
    scenarioB_P95_ms: multiDocDistribution.metrics.latencyP95Ms,
    scenarioC_P95_ms: burstRecovery.metrics.overallLatencyP95Ms,
    avgThroughput_ops_sec: Math.round(
      (singleDocContention.metrics.avgThroughputOpsPerSec +
        multiDocDistribution.metrics.avgThroughputOpsPerSec) /
        2
    ),
    avgConvergenceRate:
      (singleDocContention.metrics.convergenceRate +
        multiDocDistribution.metrics.convergenceRate +
        burstRecovery.metrics.convergenceRate) /
      3,
  };

  const results: ExperimentResults = {
    experimentName,
    serverType,
    timestamp,
    gitCommit,
    environment,
    scenarios: {
      singleDocContention,
      multiDocDistribution,
      burstRecovery,
    },
    summary,
  };

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Scenario A (Single-Doc Contention) P95: ${summary.scenarioA_P95_ms}ms`);
  console.log(`Scenario B (Multi-Doc Distribution) P95: ${summary.scenarioB_P95_ms}ms`);
  console.log(`Scenario C (Burst + Recovery) P95: ${summary.scenarioC_P95_ms}ms`);
  console.log(`Avg Throughput: ${summary.avgThroughput_ops_sec} ops/sec`);
  console.log(`Avg Convergence: ${(summary.avgConvergenceRate * 100).toFixed(1)}%`);

  return results;
}

if (import.meta.main) {
  const serverUrl = getServerUrl();
  const experimentName = process.env.EXPERIMENT_NAME || 'baseline-simple-lock';

  runAllScenarios(serverUrl, experimentName)
    .then(async (results) => {
      const outputDir = process.env.PERF_OUTPUT_DIR || 'results';
      await mkdir(outputDir, { recursive: true });

      const fileName = `experiment-${results.experimentName}-${results.serverType}-${results.timestamp.replace(/[:.]/g, '-')}.json`;
      const filePath = path.join(outputDir, fileName);
      await writeFile(filePath, JSON.stringify(results, null, 2));

      console.log(`\nSaved: ${filePath}`);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
