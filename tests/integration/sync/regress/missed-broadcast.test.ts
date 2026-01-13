import { describe, it, expect } from 'bun:test';
import {
  setupTestSuite,
  createClients,
  assertEventualConvergence,
  sleep,
} from '../../setup';
import { generateTestId } from '../../config';

describe('Regression - Missed Broadcast', () => {
  setupTestSuite();

  it('clients that disconnect and reconnect receive authoritative state', async () => {
    const docId = generateTestId('missed-broadcast');
    const clients = await createClients(3);

    // Connect all clients
    await Promise.all(clients.map(c => c.connect()));

    // Client 0 makes an update and then client 1 disconnects immediately to simulate a missed broadcast
    await clients[0].setField(docId, 'k', 'v1');

    // Disconnect client 1 to simulate it missing the next broadcasts
    await clients[1].disconnect();

    // Client 0 does another update while client 1 is disconnected
    await clients[0].setField(docId, 'k', 'v2');

    // Short wait to allow server to process broadcasts
    await sleep(200);

    // Reconnect client 1 (it should sync up automatically)
    await clients[1].connect();

    // Wait for eventual convergence across all clients
    const state = await assertEventualConvergence(clients, docId);

    expect(state).toEqual({ k: 'v2' });
  });
});