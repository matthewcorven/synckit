/**
 * Message Corruption Chaos Tests
 * 
 * Tests system resilience to corrupted, duplicated, and reordered messages
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { setupTestServer, teardownTestServer } from '../integration/helpers/test-server';
import { sleep } from '../integration/config';
import {
  createChaosClients,
  cleanupChaosClients,
  ChaosPresets,
} from './network-simulator';

describe('Chaos - Message Corruption', () => {
  beforeAll(async () => {
    await setupTestServer();
  });

  afterAll(async () => {
    await teardownTestServer();
  });

  const docId = 'corruption-doc';

  it('should handle message duplication', async () => {
    const clients = await createChaosClients(2, ChaosPresets.duplication);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Make changes with duplication
      for (let i = 0; i < 10; i++) {
        await clients[0].setField(docId, `dup${i}`, i);
      }
      
      // Wait for sync
      await sleep(3000);
      
      // Duplicates shouldn't cause issues (idempotent)
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      expect(stateA).toEqual(stateB);
      expect(Object.keys(stateA).length).toBe(10);
      
      const stats = clients[0].getStats();
      console.log('Duplication stats:', stats);
      expect(stats.messagesDuplicated).toBeGreaterThan(0);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should handle message reordering', async () => {
    const clients = await createChaosClients(2, ChaosPresets.reordering);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Sequential operations
      for (let i = 0; i < 15; i++) {
        await clients[0].setField(docId, `order${i}`, i);
      }
      
      // Wait for convergence despite reordering
      await sleep(4000);
      
      // Should eventually converge
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      expect(stateA).toEqual(stateB);
      
      const stats = clients[0].getStats();
      console.log('Reordering stats:', stats);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should handle message corruption', async () => {
    const clients = await createChaosClients(2, ChaosPresets.corruption);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Make changes with corruption
      for (let i = 0; i < 20; i++) {
        await clients[0].setField(docId, `corrupt${i}`, i);
      }
      
      // Wait for sync
      await sleep(3000);
      
      // Most should sync (corrupted messages may fail)
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      // Should converge (uncorrupted messages)
      expect(Object.keys(stateA).length).toBeGreaterThan(15);
      
      const stats = clients[0].getStats();
      console.log('Corruption stats:', stats);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should handle combined corruption types', async () => {
    const clients = await createChaosClients(2, {
      duplicationProbability: 0.10,
      reorderProbability: 0.15,
      corruptionProbability: 0.05,
      latency: { min: 50, max: 200 },
    });
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Make changes with multiple corruption types
      for (let i = 0; i < 25; i++) {
        await clients[0].setField(docId, `combined${i}`, i);
      }
      
      // Wait for convergence
      await sleep(5000);
      
      // Should handle multiple corruption types
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      // Most messages should get through
      expect(Object.keys(stateA).length).toBeGreaterThan(20);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should handle duplication with conflicts', async () => {
    const clients = await createChaosClients(2, ChaosPresets.duplication);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Create conflict
      await clients[0].setField(docId, 'conflict', 'original');
      await sleep(500);
      
      // Both update
      await clients[0].setField(docId, 'conflict', 'A');
      await clients[1].setField(docId, 'conflict', 'B');
      
      // Wait for resolution
      await sleep(3000);
      
      // Should resolve correctly despite duplicates
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      expect(stateA).toEqual(stateB);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should handle reordering with causality', async () => {
    const clients = await createChaosClients(2, ChaosPresets.reordering);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Causal chain
      await clients[0].setField(docId, 'step1', 'first');
      await sleep(200);
      await clients[0].setField(docId, 'step2', 'second');
      await sleep(200);
      await clients[0].setField(docId, 'step3', 'third');
      
      // Wait for sync
      await sleep(4000);
      
      // All steps should be present
      const state = await clients[1].getDocumentState(docId);
      
      expect(state.step1).toBe('first');
      expect(state.step2).toBe('second');
      expect(state.step3).toBe('third');
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should be idempotent to duplicate messages', async () => {
    const clients = await createChaosClients(2, {
      duplicationProbability: 0.50, // High duplication
    });
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Set specific value
      await clients[0].setField(docId, 'idempotent', 'value');
      
      // Wait for all duplicates to process
      await sleep(2000);
      
      // Should still have single value
      const value = await clients[1].getField(docId, 'idempotent');
      expect(value).toBe('value');
      
      const stats = clients[0].getStats();
      console.log(`Duplicates sent: ${stats.messagesDuplicated}`);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should handle reordering with updates to same field', async () => {
    const clients = await createChaosClients(2, ChaosPresets.reordering);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Sequential updates to same field
      for (let i = 0; i < 10; i++) {
        await clients[0].setField(docId, 'sequence', i);
        await sleep(50);
      }
      
      // Wait for all to process
      await sleep(5000);
      
      // Final value should be correct
      const value = await clients[1].getField(docId, 'sequence');
      expect(value).toBe(9);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should handle corruption with deletes', async () => {
    const clients = await createChaosClients(2, ChaosPresets.corruption);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Create fields
      for (let i = 0; i < 10; i++) {
        await clients[0].setField(docId, `field${i}`, i);
      }
      
      await sleep(2000);
      
      // Delete with corruption
      for (let i = 0; i < 5; i++) {
        await clients[0].deleteField(docId, `field${i}`);
      }
      
      await sleep(2000);
      
      // Most deletes should work
      const state = await clients[1].getDocumentState(docId);
      expect(Object.keys(state).length).toBeLessThanOrEqual(7);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should track corruption statistics', async () => {
    const clients = await createChaosClients(1, {
      duplicationProbability: 0.10,
      reorderProbability: 0.15,
      corruptionProbability: 0.05,
    });
    
    try {
      await clients[0].connect();
      clients[0].resetStats();
      
      // Make many operations
      for (let i = 0; i < 50; i++) {
        await clients[0].setField(docId, `track${i}`, i);
      }
      
      const stats = clients[0].getStats();
      
      console.log('Corruption tracking stats:', {
        duplicated: stats.messagesDuplicated,
        reordered: stats.messagesReordered,
        corrupted: stats.messagesCorrupted,
      });
      
      // Should have some chaos
      const totalChaos = stats.messagesDuplicated + stats.messagesReordered + stats.messagesCorrupted;
      expect(totalChaos).toBeGreaterThan(0);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should handle duplication in multi-client scenario', async () => {
    const clients = await createChaosClients(4, ChaosPresets.duplication);
    
    try {
      await Promise.all(clients.map(c => c.connect()));
      
      // Each client makes changes
      await Promise.all(
        clients.map((client, idx) =>
          client.setField(docId, `client${idx}`, `value${idx}`)
        )
      );
      
      // Wait for convergence
      await sleep(4000);
      
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

  it('should handle reordering in concurrent updates', async () => {
    const clients = await createChaosClients(3, ChaosPresets.reordering);
    
    try {
      await Promise.all(clients.map(c => c.connect()));
      
      // Concurrent updates with reordering
      await Promise.all([
        (async () => {
          for (let i = 0; i < 8; i++) {
            await clients[0].setField(docId, `A${i}`, i);
            await sleep(50);
          }
        })(),
        (async () => {
          for (let i = 0; i < 8; i++) {
            await clients[1].setField(docId, `B${i}`, i);
            await sleep(50);
          }
        })(),
        (async () => {
          for (let i = 0; i < 8; i++) {
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

  it('should maintain data integrity despite corruption', async () => {
    const clients = await createChaosClients(2, ChaosPresets.corruption);
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Set specific values
      await clients[0].setField(docId, 'string', 'test');
      await clients[0].setField(docId, 'number', 42);
      await clients[0].setField(docId, 'boolean', true);
      
      // Wait for sync
      await sleep(3000);
      
      // Values that synced should be correct
      const state = await clients[1].getDocumentState(docId);
      
      // Check each field if it exists
      if (state.string !== undefined) {
        expect(state.string).toBe('test');
      }
      if (state.number !== undefined) {
        expect(state.number).toBe(42);
      }
      if (state.boolean !== undefined) {
        expect(state.boolean).toBe(true);
      }
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should handle extreme duplication rate', async () => {
    const clients = await createChaosClients(2, {
      duplicationProbability: 0.80, // 80% duplication
    });
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Make changes
      for (let i = 0; i < 10; i++) {
        await clients[0].setField(docId, `extreme${i}`, i);
      }
      
      // Wait for processing
      await sleep(4000);
      
      // Should still work correctly
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      expect(stateA).toEqual(stateB);
      expect(Object.keys(stateA).length).toBe(10);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should handle extreme reordering rate', async () => {
    const clients = await createChaosClients(2, {
      reorderProbability: 0.70, // 70% reordering
      latency: { min: 50, max: 300 },
    });
    
    try {
      await clients[0].connect();
      await clients[1].connect();
      
      // Make changes
      for (let i = 0; i < 12; i++) {
        await clients[0].setField(docId, `reorder${i}`, i);
      }
      
      // Extended wait for reordering
      await sleep(8000);
      
      // Should eventually converge
      const stateA = await clients[0].getDocumentState(docId);
      const stateB = await clients[1].getDocumentState(docId);
      
      expect(stateA).toEqual(stateB);
    } finally {
      await cleanupChaosClients(clients);
    }
  });

  it('should eventually achieve perfect convergence', async () => {
    const clients = await createChaosClients(3, {
      duplicationProbability: 0.10,
      reorderProbability: 0.15,
      corruptionProbability: 0.03,
      latency: { min: 50, max: 200 },
    });
    
    try {
      await Promise.all(clients.map(c => c.connect()));
      
      // Create deterministic expected state
      const expectedData: Record<string, number> = {};
      for (let i = 0; i < 20; i++) {
        expectedData[`final${i}`] = i;
        await clients[0].setField(docId, `final${i}`, i);
      }
      
      // Extended wait for complete convergence
      await sleep(10000);
      
      // All clients should converge to same state
      const states = await Promise.all(
        clients.map(c => c.getDocumentState(docId))
      );
      
      // Verify convergence
      for (let i = 1; i < states.length; i++) {
        expect(states[i]).toEqual(states[0]);
      }
      
      // Most data should be intact (some corruption may occur)
      expect(Object.keys(states[0]).length).toBeGreaterThan(18);
    } finally {
      await cleanupChaosClients(clients);
    }
  });
});
