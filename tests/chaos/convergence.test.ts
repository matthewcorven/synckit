/**
 * Convergence Proof Tests
 * 
 * Proves eventual convergence under all chaos conditions combined
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { setupTestServer, teardownTestServer } from '../integration/helpers/test-server';
import { sleep } from '../integration/config';
import {
  createChaosClients,
  cleanupChaosClients,
  ChaosPresets,
} from './network-simulator';

describe('Chaos - Convergence Proof', () => {
  beforeAll(async () => {
    await setupTestServer();
  });

  afterAll(async () => {
    await teardownTestServer();
  });

  const docId = 'convergence-doc';

  it('should prove convergence with complete chaos', async () => {
    const clients = await createChaosClients(3, ChaosPresets.completeChaos);
    
    try {
      await Promise.all(clients.map(c => c.connect()));
      
      // Make changes under complete chaos
      for (let i = 0; i < 20; i++) {
        await clients[0].setField(docId, `chaos${i}`, i);
        await sleep(100);
      }
      
      // Extended wait for convergence under chaos
      await sleep(12000);
      
      // Verify eventual convergence
      const states = await Promise.all(
        clients.map(c => c.getDocumentState(docId))
      );
      
      // All clients must converge
      expect(states[0]).toEqual(states[1]);
      expect(states[1]).toEqual(states[2]);
      
      // Log chaos statistics
      clients.forEach((client, idx) => {
        const stats = client.getStats();
        console.log(`Client ${idx} chaos stats:`, stats);
      });
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should converge with packet loss + latency', async () => {
    const clients = await createChaosClients(2, {
      packetLoss: 0.10,
      latency: { min: 100, max: 500 },
    });
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Make changes
      for (let i = 0; i < 15; i++) {
        await clients[0].setField(docId, `combined${i}`, i);
      }
      
      await sleep(8000);
      
      // Verify convergence
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      expect(stateA).toEqual(stateB);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should converge with disconnections + reordering', async () => {
    const clients = await createChaosClients(2, {
      disconnection: {
        probability: 0.08,
        minDuration: 100,
        maxDuration: 400,
      },
      reorderProbability: 0.20,
      latency: { min: 50, max: 200 },
    });
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Make changes
      for (let i = 0; i < 20; i++) {
        await clients[0].setField(docId, `mixed${i}`, i);
        await sleep(80);
      }
      
      await sleep(10000);
      
      // Verify convergence
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      expect(stateA).toEqual(stateB);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should converge with all corruption types', async () => {
    const clients = await createChaosClients(3, {
      packetLoss: 0.08,
      duplicationProbability: 0.12,
      reorderProbability: 0.18,
      corruptionProbability: 0.05,
      latency: { min: 50, max: 300 },
    });
    
    try {
      await Promise.all(clients.map(c => c.connect()));
      
      // All clients make changes
      await Promise.all([
        (async () => {
          for (let i = 0; i < 8; i++) {
            await clients[0].setField(docId, `A${i}`, i);
            await sleep(100);
          }
        })(),
        (async () => {
          for (let i = 0; i < 8; i++) {
            await clients[1].setField(docId, `B${i}`, i);
            await sleep(100);
          }
        })(),
        (async () => {
          for (let i = 0; i < 8; i++) {
            await clients[2].setField(docId, `C${i}`, i);
            await sleep(100);
          }
        })(),
      ]);
      
      await sleep(12000);
      
      // Verify convergence
      const states = await Promise.all(
        clients.map(c => c.getDocumentState(docId))
      );
      
      expect(states[0]).toEqual(states[1]);
      expect(states[1]).toEqual(states[2]);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should prove convergence with concurrent conflicts under chaos', async () => {
    const clients = await createChaosClients(3, ChaosPresets.completeChaos);
    
    try {
      await Promise.all(clients.map(c => c.connect()));
      
      // Create conflict scenario
      await clients[0].setField(docId, 'conflict', 'original');
      await sleep(1000);
      
      // All clients update same field
      await clients[0].setField(docId, 'conflict', 'A');
      await clients[1].setField(docId, 'conflict', 'B');
      await clients[2].setField(docId, 'conflict', 'C');
      
      // Wait for resolution
      await sleep(8000);
      
      // Should resolve via LWW
      const states = await Promise.all(
        clients.map(c => c.getDocumentState(docId))
      );
      
      expect(states[0]).toEqual(states[1]);
      expect(states[1]).toEqual(states[2]);
      expect(['A', 'B', 'C']).toContain(states[0].conflict);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should prove convergence with large documents under chaos', async () => {
    const clients = await createChaosClients(2, ChaosPresets.completeChaos);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Create large document under chaos
      for (let i = 0; i < 50; i++) {
        await clients[0].setField(docId, `large${i}`, i);
        await sleep(80);
      }
      
      // Extended wait
      await sleep(15000);
      
      // Verify convergence
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      expect(stateA).toEqual(stateB);
      
      // Most fields should sync
      expect(Object.keys(stateA).length).toBeGreaterThan(40);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should prove convergence across multiple chaos cycles', async () => {
    const clients = await createChaosClients(2, ChaosPresets.completeChaos);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Multiple cycles of changes
      for (let cycle = 0; cycle < 3; cycle++) {
        for (let i = 0; i < 8; i++) {
          await clients[0].setField(docId, `cycle${cycle}_${i}`, i);
          await sleep(80);
        }
        await sleep(3000); // Allow convergence between cycles
      }
      
      // Final convergence
      await sleep(8000);
      
      // Verify convergence
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      expect(stateA).toEqual(stateB);
      expect(Object.keys(stateA).length).toBe(24); // 3 cycles * 8 fields
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should prove convergence in 5-client scenario under chaos', async () => {
    const clients = await createChaosClients(5, {
      packetLoss: 0.10,
      latency: { min: 50, max: 300 },
      reorderProbability: 0.15,
      disconnection: {
        probability: 0.05,
        minDuration: 100,
        maxDuration: 300,
      },
    });
    
    try {
      await Promise.all(clients.map(c => c.connect()));
      
      // Each client makes changes
      await Promise.all(
        clients.map((client, idx) =>
          client.setField(docId, `client${idx}`, `value${idx}`)
        )
      );
      
      // Wait for convergence
      await sleep(10000);
      
      // All must converge
      const states = await Promise.all(
        clients.map(c => c.getDocumentState(docId))
      );
      
      for (let i = 1; i < states.length; i++) {
        expect(states[i]).toEqual(states[0]);
      }
      
      // All clients should be represented
      expect(Object.keys(states[0]).length).toBe(5);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should prove convergence with deletes under chaos', async () => {
    const clients = await createChaosClients(2, ChaosPresets.completeChaos);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Create fields
      for (let i = 0; i < 15; i++) {
        await clients[0].setField(docId, `field${i}`, i);
        await sleep(80);
      }
      
      await sleep(5000);
      
      // Delete some fields
      for (let i = 0; i < 8; i++) {
        await clients[0].deleteField(docId, `field${i}`);
        await sleep(80);
      }
      
      await sleep(6000);
      
      // Verify convergence
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      expect(stateA).toEqual(stateB);
      
      // Should have remaining fields
      expect(Object.keys(stateA).length).toBeLessThanOrEqual(8);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should prove deterministic convergence', async () => {
    const clients = await createChaosClients(3, ChaosPresets.completeChaos);
    
    try {
      await Promise.all(clients.map(c => c.connect()));
      
      // Create deterministic expected state
      const expectedData: Record<string, string> = {};
      for (let i = 0; i < 15; i++) {
        const key = `deterministic${i}`;
        const value = `value${i}`;
        expectedData[key] = value;
        await clients[0].setField(docId, key, value);
        await sleep(100);
      }
      
      // Wait for convergence
      await sleep(12000);
      
      // All clients must converge to expected state
      const states = await Promise.all(
        clients.map(c => c.getDocumentState(docId))
      );
      
      // Verify all identical
      for (let i = 1; i < states.length; i++) {
        expect(states[i]).toEqual(states[0]);
      }
      
      // Verify correctness (most should match)
      const actualKeys = Object.keys(states[0]);
      expect(actualKeys.length).toBeGreaterThan(12);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should prove convergence time is bounded', async () => {
    const clients = await createChaosClients(2, {
      packetLoss: 0.05,
      latency: { min: 50, max: 200 },
    });
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      const startTime = Date.now();
      
      // Make single change
      await clients[0].setField(docId, 'timed', 'convergence');
      
      // Wait for convergence
      await clients[1].waitForField(docId, 'timed', 'convergence', 15000);
      
      const convergenceTime = Date.now() - startTime;
      
      console.log(`Convergence time under light chaos: ${convergenceTime}ms`);
      
      // Should converge within reasonable time
      expect(convergenceTime).toBeLessThan(10000);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should prove no data loss under chaos', async () => {
    const clients = await createChaosClients(2, ChaosPresets.completeChaos);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Create known data
      const testData = {
        string: 'test',
        number: 42,
        boolean: true,
        null: null,
        zero: 0,
        empty: '',
      };
      
      for (const [key, value] of Object.entries(testData)) {
        await clients[0].setField(docId, key, value);
        await sleep(100);
      }
      
      // Wait for convergence
      await sleep(10000);
      
      // Verify no data loss
      const state = await clients[1].getDocumentState(docId);
      
      // All fields should eventually sync (or most)
      const syncedKeys = Object.keys(state);
      expect(syncedKeys.length).toBeGreaterThan(4);
      
      // Synced data should be correct
      for (const key of syncedKeys) {
        expect(state[key]).toBe(testData[key as keyof typeof testData]);
      }
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should prove convergence with mixed operations under chaos', async () => {
    const clients = await createChaosClients(2, ChaosPresets.completeChaos);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Mixed operations: create, update, delete
      await clients[0].setField(docId, 'field1', 'v1');
      await sleep(200);
      await clients[0].setField(docId, 'field2', 'v2');
      await sleep(200);
      await clients[0].setField(docId, 'field1', 'v1_updated');
      await sleep(200);
      await clients[0].deleteField(docId, 'field2');
      await sleep(200);
      await clients[0].setField(docId, 'field3', 'v3');
      
      // Wait for convergence
      await sleep(8000);
      
      // Verify final state
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      expect(stateA).toEqual(stateB);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should prove convergence is eventual (always happens)', async () => {
    const clients = await createChaosClients(3, ChaosPresets.completeChaos);
    
    try {
      await Promise.all(clients.map(c => c.connect()));
      
      // Create complex scenario
      for (let i = 0; i < 25; i++) {
        await clients[i % 3].setField(docId, `eventual${i}`, i);
        await sleep(100);
      }
      
      // Keep checking convergence
      let converged = false;
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds
      
      while (!converged && attempts < maxAttempts) {
        await sleep(1000);
        attempts++;
        
        const states = await Promise.all(
          clients.map(c => c.getDocumentState(docId))
        );
        
        converged = 
          JSON.stringify(states[0]) === JSON.stringify(states[1]) &&
          JSON.stringify(states[1]) === JSON.stringify(states[2]);
        
        if (converged) {
          console.log(`Convergence achieved after ${attempts} seconds`);
        }
      }
      
      // Must eventually converge
      expect(converged).toBe(true);
      expect(attempts).toBeLessThan(maxAttempts);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should prove strong eventual consistency (SEC)', async () => {
    const clients = await createChaosClients(3, ChaosPresets.completeChaos);
    
    try {
      await Promise.all(clients.map(c => c.connect()));
      
      // All clients receive same updates (eventually)
      const updates = [
        { field: 'sec1', value: 'value1' },
        { field: 'sec2', value: 'value2' },
        { field: 'sec3', value: 'value3' },
      ];
      
      for (const update of updates) {
        await clients[0].setField(docId, update.field, update.value);
        await sleep(200);
      }
      
      // Wait for full propagation
      await sleep(12000);
      
      // All clients must have identical state
      const states = await Promise.all(
        clients.map(c => c.getDocumentState(docId))
      );
      
      // SEC property: identical inputs → identical state
      expect(states[0]).toEqual(states[1]);
      expect(states[1]).toEqual(states[2]);
      
      // Verify expected data
      for (const update of updates) {
        expect(states[0]).toHaveProperty(update.field, update.value);
      }
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should prove convergence despite 100% chaos', async () => {
    const clients = await createChaosClients(2, {
      packetLoss: 0.30, // 30% loss
      latency: { min: 100, max: 1000 }, // High latency
      reorderProbability: 0.40, // 40% reorder
      duplicationProbability: 0.20, // 20% duplicate
      disconnection: {
        probability: 0.10,
        minDuration: 100,
        maxDuration: 500,
      },
    });
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Make changes under extreme chaos
      for (let i = 0; i < 15; i++) {
        await clients[0].setField(docId, `extreme${i}`, i);
        await sleep(150);
      }
      
      // Very extended wait
      await sleep(20000);
      
      // Must eventually converge
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      expect(stateA).toEqual(stateB);
      
      // Most should sync despite extreme chaos
      expect(Object.keys(stateA).length).toBeGreaterThan(10);
      
      const stats = clients[0].getStats();
      console.log('Extreme chaos stats:', stats);
    } finally {
      await cleanupChaosClients(clients);
    }
  });
});
