import { PerfClient, createClients, connectClients, disconnectClients } from '../helpers/client';
import { sleep } from '../helpers/metrics';

interface TimingEntry {
  operation: string;
  field: string;
  sentAt: number;
  receivedAt?: number;
  latencyMs?: number;
}

async function runProfileTest(serverUrl: string, options: {
  connections: number;
  opsPerSec: number;
  durationSec: number;
}) {
  const startTime = Date.now();
  const timings: TimingEntry[] = [];
  const documentId = `profile-doc-${Date.now()}`;
  
  console.log(`Creating ${options.connections} connections...`);
  const senders = await createClients(Math.ceil(options.connections / 2), serverUrl);
  const receivers = await createClients(Math.floor(options.connections / 2), serverUrl);
  const allClients = [...senders, ...receivers];
  
  console.log(`Connecting...`);
  await connectClients(allClients);
  await Promise.all(allClients.map(c => c.sync(documentId)));
  
  // Track all received messages
  const receivedAt = new Map<string, number>();
  
  receivers.forEach(receiver => {
    receiver.onDelta(message => {
      const now = Date.now();
      const fields: string[] = [];
      
      if (message.field) {
        fields.push(message.field);
      } else if (message.delta) {
        fields.push(...Object.keys(message.delta));
      }
      
      for (const field of fields) {
        receivedAt.set(field, now);
      }
    });
  });
  
  // Send operations
  const totalOps = options.opsPerSec * options.durationSec;
  const intervalMs = 1000 / options.opsPerSec;
  let sent = 0;
  
  console.log(`Sending ${totalOps} operations at ${options.opsPerSec} ops/sec...`);
  
  const sendStart = Date.now();
  
  for (let i = 0; i < totalOps; i++) {
    const senderIdx = i % senders.length;
    const field = `op-${i}-${Date.now()}`;
    const sentAt = Date.now();
    
    timings.push({
      operation: `send-${i}`,
      field,
      sentAt,
    });
    
    await senders[senderIdx].sendDelta(documentId, { [field]: i });
    sent++;
    
    // Rate limiting
    const elapsed = Date.now() - sendStart;
    const expectedElapsed = (sent / options.opsPerSec) * 1000;
    if (expectedElapsed > elapsed) {
      await sleep(expectedElapsed - elapsed);
    }
    
    // Progress update every 10%
    if (sent % Math.floor(totalOps / 10) === 0) {
      console.log(`  Progress: ${Math.round(sent / totalOps * 100)}%`);
    }
  }
  
  console.log(`Waiting for convergence (2s)...`);
  await sleep(2000);
  
  // Match received times with sent times
  for (const timing of timings) {
    const recvTime = receivedAt.get(timing.field);
    if (recvTime) {
      timing.receivedAt = recvTime;
      timing.latencyMs = recvTime - timing.sentAt;
    }
  }
  
  // Compute statistics
  const latencies = timings.filter(t => t.latencyMs !== undefined).map(t => t.latencyMs!);
  latencies.sort((a, b) => a - b);
  
  const stats = {
    totalSent: sent,
    totalReceived: latencies.length,
    convergenceRate: latencies.length / sent,
    minLatency: latencies[0] || 0,
    maxLatency: latencies[latencies.length - 1] || 0,
    avgLatency: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
    p50: latencies[Math.floor(latencies.length * 0.5)] || 0,
    p95: latencies[Math.floor(latencies.length * 0.95)] || 0,
    p99: latencies[Math.floor(latencies.length * 0.99)] || 0,
    durationMs: Date.now() - startTime,
  };
  
  console.log(`\nResults:`);
  console.log(`  Sent:           ${stats.totalSent}`);
  console.log(`  Received:       ${stats.totalReceived} (${(stats.convergenceRate * 100).toFixed(1)}%)`);
  console.log(`  Min Latency:    ${stats.minLatency}ms`);
  console.log(`  Avg Latency:    ${stats.avgLatency.toFixed(1)}ms`);
  console.log(`  P50 Latency:    ${stats.p50}ms`);
  console.log(`  P95 Latency:    ${stats.p95}ms`);
  console.log(`  P99 Latency:    ${stats.p99}ms`);
  console.log(`  Max Latency:    ${stats.maxLatency}ms`);
  
  await disconnectClients(allClients);
  
  // Output detailed timings
  return {
    stats,
    timings: timings.slice(0, 1000), // First 1000 for analysis
    latencyDistribution: {
      '0-50ms': latencies.filter(l => l <= 50).length,
      '50-100ms': latencies.filter(l => l > 50 && l <= 100).length,
      '100-500ms': latencies.filter(l => l > 100 && l <= 500).length,
      '500-1000ms': latencies.filter(l => l > 500 && l <= 1000).length,
      '1000-2000ms': latencies.filter(l => l > 1000 && l <= 2000).length,
      '>2000ms': latencies.filter(l => l > 2000).length,
    }
  };
}

// Run the test
const serverUrl = process.env.SERVER_URL || 'http://localhost:8090';
const connections = parseInt(process.env.NUM_CONNECTIONS || '100');
const opsPerSec = parseInt(process.env.OPS_PER_SEC || '500');
const durationSec = parseInt(process.env.DURATION_SEC || '60');

runProfileTest(serverUrl, { connections, opsPerSec, durationSec })
  .then(result => {
    console.log('\n' + JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
