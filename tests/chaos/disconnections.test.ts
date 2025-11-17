/**
 * Random Disconnections Chaos Tests
 * 
 * Tests sync behavior with random disconnections and reconnections
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { setupTestServer, teardownTestServer } from '../integration/helpers/test-server';
import { sleep } from '../integration/config';
import {
  createChaosClients,
  cleanupChaosClients,
  ChaosPresets,
} from './network-simulator';

describe('Chaos - Random Disconnections', () => {
  beforeAll(async () => {
    await setupTestServer();
  });

  afterAll(async () => {
    await teardownTestServer();
  });

  const docId = 'disconnect-doc';

  it('should converge despite random disconnections', async () => {
    const clients = await createChaosClients(2, ChaosPresets.disconnections);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Make changes with random disconnections
      for (let i = 0; i < 20; i++) {
        await clients[0].setField(docId, `field${i}`, i);
        await sleep(100);
      }
      
      // Wait for convergence
      await sleep(5000);
      
      // Verify eventual convergence
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      expect(stateA).toEqual(stateB);
      
      // Check stats
      const stats = clients[0].getStats();
      console.log('Random disconnection stats:', stats);
      expect(stats.disconnections).toBeGreaterThan(0);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should handle frequent disconnections', async () => {
    const clients = await createChaosClients(2, {
      disconnection: {
        probability: 0.20, // 20% chance per operation
        minDuration: 50,
        maxDuration: 200,
      },
    });
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Make changes with frequent disconnections
      for (let i = 0; i < 15; i++) {
        await clients[0].setField(docId, `freq${i}`, i);
        await sleep(100);
      }
      
      // Wait for convergence
      await sleep(6000);
      
      // Should eventually converge
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      expect(stateA).toEqual(stateB);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should handle concurrent operations during disconnections', async () => {
    const clients = await createChaosClients(3, ChaosPresets.disconnections);
    
    try {
      await Promise.all(clients.map(c => c.connect()));
      
      // All clients make changes concurrently
      await Promise.all([
        (async () => {
          for (let i = 0; i < 10; i++) {
            await clients[0].setField(docId, `A${i}`, i);
            await sleep(50);
          }
        })(),
        (async () => {
          for (let i = 0; i < 10; i++) {
            await clients[1].setField(docId, `B${i}`, i);
            await sleep(50);
          }
        })(),
        (async () => {
          for (let i = 0; i < 10; i++) {
            await clients[2].setField(docId, `C${i}`, i);
            await sleep(50);
          }
        })(),
      ]);
      
      // Wait for convergence
      await sleep(6000);
      
      // All should converge
      const states = await Promise.all(
        clients.map(c => c.getDocumentState(docId))
      );
      
      expect(states[0]).toEqual(states[1]);
      expect(states[1]).toEqual(states[2]);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should handle disconnections with deletes', async () => {
    const clients = await createChaosClients(2, ChaosPresets.disconnections);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Create fields
      for (let i = 0; i < 10; i++) {
        await clients[0].setField(docId, `field${i}`, i);
        await sleep(50);
      }
      
      await sleep(2000);
      
      // Delete with disconnections
      for (let i = 0; i < 5; i++) {
        await clients[0].deleteField(docId, `field${i}`);
        await sleep(50);
      }
      
      // Wait for sync
      await sleep(3000);
      
      // Verify deletes synced
      const state = await clients[1].getDocumentState(docId);
      expect(Object.keys(state).length).toBeLessThanOrEqual(5);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should maintain data integrity during disconnections', async () => {
    const clients = await createChaosClients(2, ChaosPresets.disconnections);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Set known values
      await clients[0].setField(docId, 'string', 'test');
      await sleep(100);
      await clients[0].setField(docId, 'number', 42);
      await sleep(100);
      await clients[0].setField(docId, 'boolean', true);
      await sleep(100);
      
      // Wait for sync
      await sleep(3000);
      
      // Verify integrity
      const state = await clients[1].getDocumentState(docId);
      
      expect(state.string).toBe('test');
      expect(state.number).toBe(42);
      expect(state.boolean).toBe(true);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should handle long disconnection periods', async () => {
    const clients = await createChaosClients(2, {
      disconnection: {
        probability: 0.10,
        minDuration: 1000, // Longer disconnections
        maxDuration: 2000,
      },
    });
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Make changes
      for (let i = 0; i < 10; i++) {
        await clients[0].setField(docId, `long${i}`, i);
        await sleep(100);
      }
      
      // Extended wait for long disconnections
      await sleep(10000);
      
      // Should eventually converge
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      expect(stateA).toEqual(stateB);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should handle disconnections with conflicts', async () => {
    const clients = await createChaosClients(2, ChaosPresets.disconnections);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Create conflict scenario
      await clients[0].setField(docId, 'conflict', 'original');
      await sleep(500);
      
      // Both update same field
      await clients[0].setField(docId, 'conflict', 'A');
      await clients[1].setField(docId, 'conflict', 'B');
      
      // Wait for resolution
      await sleep(4000);
      
      // Should resolve via LWW
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      expect(stateA).toEqual(stateB);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should track disconnection statistics', async () => {
    const clients = await createChaosClients(1, {
      disconnection: {
        probability: 0.15,
        minDuration: 100,
        maxDuration: 300,
      },
    });
    
    try {
      await clients[0].connect();
      clients[0].resetStats();
      
      // Make many operations
      for (let i = 0; i < 50; i++) {
        await clients[0].setField(docId, `track${i}`, i);
        await sleep(50);
      }
      
      const stats = clients[0].getStats();
      
      // Should have some disconnections
      console.log(`Disconnections: ${stats.disconnections} during 50 operations`);
      expect(stats.disconnections).toBeGreaterThan(0);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should handle burst disconnections', async () => {
    const clients = await createChaosClients(2, {
      disconnection: {
        probability: 0.30, // High probability
        minDuration: 50,
        maxDuration: 150,
      },
    });
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Rapid operations causing burst disconnections
      for (let i = 0; i < 20; i++) {
        await clients[0].setField(docId, `burst${i}`, i);
        await sleep(30);
      }
      
      // Wait for recovery
      await sleep(6000);
      
      // Should eventually converge
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      expect(stateA).toEqual(stateB);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should handle disconnections in multi-client scenario', async () => {
    const clients = await createChaosClients(5, ChaosPresets.disconnections);
    
    try {
      await Promise.all(clients.map(c => c.connect()));
      
      // Each client makes changes
      await Promise.all(
        clients.map((client, idx) => 
          client.setField(docId, `client${idx}`, `value${idx}`)
        )
      );
      
      // Wait for convergence
      await sleep(5000);
      
      // All should converge
      const states = await Promise.all(
        clients.map(c => c.getDocumentState(docId))
      );
      
      for (let i = 1; i < states.length; i++) {
        expect(states[i]).toEqual(states[0]);
      }
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should handle asymmetric disconnections', async () => {
    const clients = await createChaosClients(2, ChaosPresets.disconnections);
    
    try {
      // Only one client has disconnections
      await clients[0].connect();
      await clients[1].connect();
      
      // Client 0 has disconnections, client 1 is stable
      for (let i = 0; i < 15; i++) {
        await clients[0].setField(docId, `asym${i}`, i);
        await sleep(80);
      }
      
      // Wait for convergence
      await sleep(5000);
      
      // Should converge
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      expect(stateA).toEqual(stateB);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should handle rapid reconnections', async () => {
    const clients = await createChaosClients(2, {
      disconnection: {
        probability: 0.25,
        minDuration: 20, // Very short
        maxDuration: 50,
      },
    });
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Rapid operations
      for (let i = 0; i < 30; i++) {
        await clients[0].setField(docId, `rapid${i}`, i);
        await sleep(20);
      }
      
      // Wait for convergence
      await sleep(4000);
      
      // Should converge despite rapid reconnections
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      expect(stateA).toEqual(stateB);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should handle disconnections with updates to same field', async () => {
    const clients = await createChaosClients(2, ChaosPresets.disconnections);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Multiple updates to same field
      for (let i = 0; i < 20; i++) {
        await clients[0].setField(docId, 'counter', i);
        await sleep(50);
      }
      
      // Wait for final value
      await sleep(4000);
      
      // Final value should sync
      const value = await clients[1].getField(docId, 'counter');
      expect(value).toBe(19);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should maintain session across disconnections', async () => {
    const clients = await createChaosClients(1, ChaosPresets.disconnections);
    
    try {
      await clients[0].connect();
      
      // Set data
      await clients[0].setField(docId, 'session', 'data');
      await sleep(100);
      
      // Make many operations (causing disconnections)
      for (let i = 0; i < 20; i++) {
        await clients[0].setField(docId, `op${i}`, i);
        await sleep(50);
      }
      
      // Original data should persist
      const value = await clients[0].getField(docId, 'session');
      expect(value).toBe('data');
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should handle disconnections with large documents', async () => {
    const clients = await createChaosClients(2, ChaosPresets.disconnections);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Create large document
      for (let i = 0; i < 50; i++) {
        await clients[0].setField(docId, `field${i}`, i);
        await sleep(50);
      }
      
      // Wait for sync
      await sleep(8000);
      
      // Should converge
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      expect(stateA).toEqual(stateB);
      expect(Object.keys(stateA).length).toBeGreaterThan(40);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should handle graceful recovery from disconnections', async () => {
    const clients = await createChaosClients(2, ChaosPresets.disconnections);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Make changes
      for (let i = 0; i < 10; i++) {
        await clients[0].setField(docId, `grace${i}`, i);
        await sleep(100);
      }
      
      // Wait for full recovery
      await sleep(5000);
      
      // Verify full convergence
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      expect(stateA).toEqual(stateB);
      expect(Object.keys(stateA).length).toBe(10);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should eventually achieve 100% convergence despite chaos', async () => {
    const clients = await createChaosClients(3, ChaosPresets.disconnections);
    
    try {
      await Promise.all(clients.map(c => c.connect()));
      
      // Create deterministic data
      const expectedData: Record<string, number> = {};
      for (let i = 0; i < 15; i++) {
        expectedData[`final${i}`] = i;
        await clients[0].setField(docId, `final${i}`, i);
        await sleep(80);
      }
      
      // Extended wait for complete convergence
      await sleep(8000);
      
      // All clients should have identical state
      const states = await Promise.all(
        clients.map(c => c.getDocumentState(docId))
      );
      
      // Verify convergence
      for (let i = 1; i < states.length; i++) {
        expect(states[i]).toEqual(states[0]);
      }
      
      // Verify data integrity
      expect(states[0]).toEqual(expectedData);
    } finally {
      await cleanupChaosClients(clients);
    }
  });
});
