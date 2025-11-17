/**
 * Packet Loss Chaos Tests
 * 
 * Tests sync behavior under packet loss conditions (5%, 10%, 25%)
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { setupTestServer, teardownTestServer } from '../integration/helpers/test-server';
import { sleep } from '../integration/config';
import {
  ChaosNetworkSimulator,
  createChaosClients,
  cleanupChaosClients,
  ChaosPresets,
} from './network-simulator';

describe('Chaos - Packet Loss', () => {
  beforeAll(async () => {
    await setupTestServer();
  });

  afterAll(async () => {
    await teardownTestServer();
  });

  const docId = 'packet-loss-doc';

  it('should converge with 5% packet loss', async () => {
    const clients = await createChaosClients(2, ChaosPresets.lightPacketLoss);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Make changes from both clients
      for (let i = 0; i < 20; i++) {
        await clients[0].setField(docId, `fieldA${i}`, i);
        await clients[1].setField(docId, `fieldB${i}`, i);
      }
      
      // Wait for convergence (extended timeout for packet loss)
      await sleep(3000);
      
      // Verify eventual convergence
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      // Should eventually converge despite packet loss
      expect(stateA).toEqual(stateB);
      
      // Check stats
      const stats = clients[0].getStats();
      console.log('5% packet loss stats:', stats);
      expect(stats.messagesDropped).toBeGreaterThan(0);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should converge with 10% packet loss', async () => {
    const clients = await createChaosClients(2, ChaosPresets.moderatePacketLoss);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Make changes
      for (let i = 0; i < 30; i++) {
        await clients[0].setField(docId, `field${i}`, i);
      }
      
      // Wait for convergence
      await sleep(4000);
      
      // Verify convergence
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      expect(stateA).toEqual(stateB);
      expect(Object.keys(stateA).length).toBeGreaterThan(20); // Most should sync
      
      const stats = clients[0].getStats();
      console.log('10% packet loss stats:', stats);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should converge with 25% packet loss (extreme)', async () => {
    const clients = await createChaosClients(2, ChaosPresets.heavyPacketLoss);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Make fewer changes but verify they eventually sync
      for (let i = 0; i < 15; i++) {
        await clients[0].setField(docId, `field${i}`, i);
        await sleep(100); // Space out to improve sync chances
      }
      
      // Extended wait for convergence under heavy packet loss
      await sleep(6000);
      
      // Verify eventual convergence
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      expect(stateA).toEqual(stateB);
      
      const stats = clients[0].getStats();
      console.log('25% packet loss stats:', stats);
      expect(stats.messagesDropped).toBeGreaterThan(0);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should handle packet loss with concurrent updates', async () => {
    const clients = await createChaosClients(3, ChaosPresets.moderatePacketLoss);
    
    try {
      await Promise.all(clients.map(c => c.connect()));
      
      // All clients make concurrent changes
      await Promise.all([
        (async () => {
          for (let i = 0; i < 10; i++) {
            await clients[0].setField(docId, `A${i}`, i);
          }
        })(),
        (async () => {
          for (let i = 0; i < 10; i++) {
            await clients[1].setField(docId, `B${i}`, i);
          }
        })(),
        (async () => {
          for (let i = 0; i < 10; i++) {
            await clients[2].setField(docId, `C${i}`, i);
          }
        })(),
      ]);
      
      // Wait for convergence
      await sleep(5000);
      
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

  it('should handle packet loss with deletes', async () => {
    const clients = await createChaosClients(2, ChaosPresets.lightPacketLoss);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Create fields
      for (let i = 0; i < 10; i++) {
        await clients[0].setField(docId, `field${i}`, i);
      }
      
      await sleep(2000);
      
      // Delete some fields
      for (let i = 0; i < 5; i++) {
        await clients[0].deleteField(docId, `field${i}`);
      }
      
      // Wait for sync
      await sleep(2000);
      
      // Verify deletes synced
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      expect(stateA).toEqual(stateB);
      expect(Object.keys(stateA).length).toBe(5); // Only 5 remaining
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should maintain data integrity under packet loss', async () => {
    const clients = await createChaosClients(2, ChaosPresets.moderatePacketLoss);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Create known data
      await clients[0].setField(docId, 'string', 'test');
      await clients[0].setField(docId, 'number', 42);
      await clients[0].setField(docId, 'boolean', true);
      await clients[0].setField(docId, 'null', null);
      
      // Wait for sync
      await sleep(3000);
      
      // Verify integrity
      const state = await clients[1].getDocumentState(docId);
      
      expect(state.string).toBe('test');
      expect(state.number).toBe(42);
      expect(state.boolean).toBe(true);
      expect(state.null).toBe(null);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should handle packet loss with rapid updates', async () => {
    const clients = await createChaosClients(2, ChaosPresets.lightPacketLoss);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Rapid updates to same field
      for (let i = 0; i < 50; i++) {
        await clients[0].setField(docId, 'counter', i);
      }
      
      // Wait for convergence
      await sleep(3000);
      
      // Final value should sync
      const valueA = await clients[0].getField(docId, 'counter');
      const valueB = await clients[1].getField(docId, 'counter');
      
      expect(valueA).toBe(valueB);
      expect(valueA).toBe(49); // Last value
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should recover from burst packet loss', async () => {
    const clients = await createChaosClients(2, {
      packetLoss: 0.50, // 50% loss for burst simulation
    });
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Make changes during burst loss
      for (let i = 0; i < 10; i++) {
        await clients[0].setField(docId, `burst${i}`, i);
      }
      
      // Wait for recovery
      await sleep(5000);
      
      // Should eventually converge
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      expect(stateA).toEqual(stateB);
      
      const stats = clients[0].getStats();
      console.log('Burst packet loss stats:', stats);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should handle packet loss with conflicting updates', async () => {
    const clients = await createChaosClients(2, ChaosPresets.moderatePacketLoss);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Initial value
      await clients[0].setField(docId, 'conflict', 'original');
      await sleep(1500);
      
      // Both update same field
      await clients[0].setField(docId, 'conflict', 'fromA');
      await clients[1].setField(docId, 'conflict', 'fromB');
      
      // Wait for convergence
      await sleep(3000);
      
      // Should resolve via LWW
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      expect(stateA).toEqual(stateB);
      expect(['fromA', 'fromB']).toContain(stateA.conflict);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should track packet loss statistics', async () => {
    const clients = await createChaosClients(1, ChaosPresets.lightPacketLoss);
    
    try {
      await clients[0].connect();
      
      clients[0].resetStats();
      
      // Make many changes
      for (let i = 0; i < 100; i++) {
        await clients[0].setField(docId, `field${i}`, i);
      }
      
      const stats = clients[0].getStats();
      
      // Should have dropped some packets (around 5)
      expect(stats.messagesDropped).toBeGreaterThan(0);
      expect(stats.messagesDropped).toBeLessThan(20);
      
      console.log(`Dropped ${stats.messagesDropped} out of 100 messages (${stats.messagesDropped}%)`);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should handle packet loss in multi-client scenario', async () => {
    const clients = await createChaosClients(5, ChaosPresets.lightPacketLoss);
    
    try {
      await Promise.all(clients.map(c => c.connect()));
      
      // Each client makes unique changes
      await Promise.all(
        clients.map((client, idx) => 
          client.setField(docId, `client${idx}`, `value${idx}`)
        )
      );
      
      // Wait for convergence
      await sleep(4000);
      
      // All should have all changes
      const states = await Promise.all(
        clients.map(c => c.getDocumentState(docId))
      );
      
      // All states should be identical
      for (let i = 1; i < states.length; i++) {
        expect(states[i]).toEqual(states[0]);
      }
      
      // All clients should be represented
      expect(Object.keys(states[0]).length).toBe(5);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should handle packet loss with empty values', async () => {
    const clients = await createChaosClients(2, ChaosPresets.moderatePacketLoss);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Set various empty/falsy values
      await clients[0].setField(docId, 'emptyString', '');
      await clients[0].setField(docId, 'zero', 0);
      await clients[0].setField(docId, 'false', false);
      await clients[0].setField(docId, 'null', null);
      
      // Wait for sync
      await sleep(3000);
      
      // Verify all values synced correctly
      const state = await clients[1].getDocumentState(docId);
      
      expect(state.emptyString).toBe('');
      expect(state.zero).toBe(0);
      expect(state.false).toBe(false);
      expect(state.null).toBe(null);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should handle packet loss with large documents', async () => {
    const clients = await createChaosClients(2, ChaosPresets.lightPacketLoss);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Create large document
      for (let i = 0; i < 100; i++) {
        await clients[0].setField(docId, `field${i}`, i);
      }
      
      // Wait for convergence
      await sleep(6000);
      
      // Verify all fields synced
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      expect(stateA).toEqual(stateB);
      expect(Object.keys(stateA).length).toBeGreaterThan(90); // Most should sync
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should eventually achieve 100% convergence despite packet loss', async () => {
    const clients = await createChaosClients(3, ChaosPresets.moderatePacketLoss);
    
    try {
      await Promise.all(clients.map(c => c.connect()));
      
      // Create deterministic data
      const expectedData: Record<string, number> = {};
      for (let i = 0; i < 20; i++) {
        expectedData[`field${i}`] = i;
        await clients[0].setField(docId, `field${i}`, i);
      }
      
      // Wait for convergence
      await sleep(5000);
      
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
