/**
 * Offline Queue Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  OfflineQueue,
  QueueFullError,
  type Operation,
  type QueuedOperation,
} from '../../sync/queue'
import type { StorageAdapter } from '../../types'

// Mock storage adapter
class MockStorage implements StorageAdapter {
  private data = new Map<string, any>()

  async init(): Promise<void> {}

  async get(key: string): Promise<any | null> {
    return this.data.get(key) || null
  }

  async set(key: string, value: any): Promise<void> {
    this.data.set(key, value)
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key)
  }

  async list(): Promise<string[]> {
    return Array.from(this.data.keys())
  }

  async clear(): Promise<void> {
    this.data.clear()
  }
}

describe('OfflineQueue', () => {
  let storage: MockStorage
  let queue: OfflineQueue

  beforeEach(async () => {
    storage = new MockStorage()
    await storage.init()

    queue = new OfflineQueue({
      storage,
      maxSize: 100,
      maxRetries: 3,
      retryDelay: 10,
      retryBackoff: 2.0,
    })

    await queue.init()
  })

  describe('Initialization', () => {
    it('initializes with empty queue', () => {
      const stats = queue.getStats()
      expect(stats.size).toBe(0)
      expect(stats.failed).toBe(0)
    })

    it('loads queue from storage', async () => {
      // Add operation to storage before initialization
      const operation: QueuedOperation = {
        id: 'op-1',
        documentId: 'doc-1',
        type: 'set',
        field: 'title',
        value: 'Test',
        clock: { 'client-1': 1 },
        clientId: 'client-1',
        timestamp: Date.now(),
        retries: 0,
        enqueuedAt: Date.now(),
      }

      await storage.set('synckit:queue:op-1', operation)

      // Create new queue instance
      const newQueue = new OfflineQueue({ storage })
      await newQueue.init()

      const stats = newQueue.getStats()
      expect(stats.size).toBe(1)
    })
  })

  describe('Enqueue', () => {
    it('enqueues operation', async () => {
      const operation: Operation = {
        type: 'set',
        documentId: 'doc-1',
        field: 'title',
        value: 'Test',
        clock: { 'client-1': 1 },
        clientId: 'client-1',
        timestamp: Date.now(),
      }

      await queue.enqueue(operation)

      const stats = queue.getStats()
      expect(stats.size).toBe(1)
    })

    it('persists operation to storage', async () => {
      const operation: Operation = {
        type: 'set',
        documentId: 'doc-1',
        field: 'title',
        value: 'Test',
        clock: { 'client-1': 1 },
        clientId: 'client-1',
        timestamp: Date.now(),
      }

      await queue.enqueue(operation)

      const keys = await storage.list()
      const queueKeys = keys.filter((k) => k.startsWith('synckit:queue:'))
      expect(queueKeys.length).toBe(1)
    })

    it('throws when queue is full', async () => {
      // Create queue with small max size
      const smallQueue = new OfflineQueue({
        storage,
        maxSize: 2,
      })
      await smallQueue.init()

      const operation1: Operation = {
        type: 'set',
        documentId: 'doc-1',
        field: 'title',
        value: 'Test',
        clock: { 'client-1': 1 },
        clientId: 'client-1',
        timestamp: Date.now(),
      }

      const operation2: Operation = {
        type: 'set',
        documentId: 'doc-1',
        field: 'description', // Different field to avoid deduplication
        value: 'Test 2',
        clock: { 'client-1': 2 },
        clientId: 'client-1',
        timestamp: Date.now() + 1,
      }

      const operation3: Operation = {
        type: 'set',
        documentId: 'doc-1',
        field: 'author', // Different field to avoid deduplication
        value: 'Test 3',
        clock: { 'client-1': 3 },
        clientId: 'client-1',
        timestamp: Date.now() + 2,
      }

      await smallQueue.enqueue(operation1)
      await smallQueue.enqueue(operation2)

      await expect(
        smallQueue.enqueue(operation3)
      ).rejects.toThrow(QueueFullError)
    })

    it('deduplicates identical operations', async () => {
      const operation: Operation = {
        type: 'set',
        documentId: 'doc-1',
        field: 'title',
        value: 'Test',
        clock: { 'client-1': 1 },
        clientId: 'client-1',
        timestamp: Date.now(),
      }

      await queue.enqueue(operation)
      await queue.enqueue(operation)

      const stats = queue.getStats()
      expect(stats.size).toBe(1)
    })

    it('updates timestamp on duplicate', async () => {
      const operation1: Operation = {
        type: 'set',
        documentId: 'doc-1',
        field: 'title',
        value: 'Test',
        clock: { 'client-1': 1 },
        clientId: 'client-1',
        timestamp: 1000,
      }

      const operation2: Operation = {
        ...operation1,
        timestamp: 2000,
      }

      await queue.enqueue(operation1)
      await queue.enqueue(operation2)

      const stats = queue.getStats()
      expect(stats.size).toBe(1)
    })
  })

  describe('Replay', () => {
    it('replays operations successfully', async () => {
      const operation: Operation = {
        type: 'set',
        documentId: 'doc-1',
        field: 'title',
        value: 'Test',
        clock: { 'client-1': 1 },
        clientId: 'client-1',
        timestamp: Date.now(),
      }

      await queue.enqueue(operation)

      const sender = vi.fn().mockResolvedValue(undefined)
      const count = await queue.replay(sender)

      expect(count).toBe(1)
      expect(sender).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'set',
          documentId: 'doc-1',
          field: 'title',
          value: 'Test',
        })
      )

      const stats = queue.getStats()
      expect(stats.size).toBe(0)
    })

    it('replays multiple operations in order', async () => {
      const operations: Operation[] = [
        {
          type: 'set',
          documentId: 'doc-1',
          field: 'title',
          value: 'First',
          clock: { 'client-1': 1 },
          clientId: 'client-1',
          timestamp: Date.now(),
        },
        {
          type: 'set',
          documentId: 'doc-1',
          field: 'title',
          value: 'Second',
          clock: { 'client-1': 2 },
          clientId: 'client-1',
          timestamp: Date.now() + 1,
        },
        {
          type: 'set',
          documentId: 'doc-1',
          field: 'title',
          value: 'Third',
          clock: { 'client-1': 3 },
          clientId: 'client-1',
          timestamp: Date.now() + 2,
        },
      ]

      for (const op of operations) {
        await queue.enqueue(op)
      }

      const sender = vi.fn().mockResolvedValue(undefined)
      const count = await queue.replay(sender)

      expect(count).toBe(3)
      expect(sender).toHaveBeenCalledTimes(3)
      expect(sender.mock.calls[0][0].value).toBe('First')
      expect(sender.mock.calls[1][0].value).toBe('Second')
      expect(sender.mock.calls[2][0].value).toBe('Third')
    })

    it('retries failed operations', async () => {
      const operation: Operation = {
        type: 'set',
        documentId: 'doc-1',
        field: 'title',
        value: 'Test',
        clock: { 'client-1': 1 },
        clientId: 'client-1',
        timestamp: Date.now(),
      }

      await queue.enqueue(operation)

      let attempts = 0
      const sender = vi.fn().mockImplementation(() => {
        attempts++
        if (attempts < 2) {
          return Promise.reject(new Error('Send failed'))
        }
        return Promise.resolve()
      })

      const count = await queue.replay(sender)

      expect(count).toBe(1)
      expect(sender).toHaveBeenCalledTimes(2)
    })

    it('moves to failed queue after max retries', async () => {
      const operation: Operation = {
        type: 'set',
        documentId: 'doc-1',
        field: 'title',
        value: 'Test',
        clock: { 'client-1': 1 },
        clientId: 'client-1',
        timestamp: Date.now(),
      }

      await queue.enqueue(operation)

      const sender = vi.fn().mockRejectedValue(new Error('Always fail'))
      const count = await queue.replay(sender)

      expect(count).toBe(0)
      expect(sender).toHaveBeenCalledTimes(3) // maxRetries = 3

      const stats = queue.getStats()
      expect(stats.size).toBe(0)
      expect(stats.failed).toBe(1)
    })

    it('throws if replay already in progress', async () => {
      const operation: Operation = {
        type: 'set',
        documentId: 'doc-1',
        field: 'title',
        value: 'Test',
        clock: { 'client-1': 1 },
        clientId: 'client-1',
        timestamp: Date.now(),
      }

      await queue.enqueue(operation)

      const sender = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => setTimeout(resolve, 100))
      })

      // Start first replay (don't await)
      const replay1 = queue.replay(sender)

      // Try to start second replay
      await expect(queue.replay(sender)).rejects.toThrow(
        'Replay already in progress'
      )

      await replay1
    })
  })

  describe('Stats', () => {
    it('reports correct queue size', async () => {
      const operation: Operation = {
        type: 'set',
        documentId: 'doc-1',
        field: 'title',
        value: 'Test',
        clock: { 'client-1': 1 },
        clientId: 'client-1',
        timestamp: Date.now(),
      }

      await queue.enqueue(operation)
      await queue.enqueue({ ...operation, field: 'description' })

      const stats = queue.getStats()
      expect(stats.size).toBe(2)
    })

    it('reports oldest operation', async () => {
      const now = Date.now()

      // Enqueue first operation
      await queue.enqueue({
        type: 'set',
        documentId: 'doc-1',
        field: 'title',
        value: 'Test',
        clock: { 'client-1': 1 },
        clientId: 'client-1',
        timestamp: now,
      })

      const stats1 = queue.getStats()
      expect(stats1.oldestOperation).toBeGreaterThanOrEqual(now)

      // Enqueue second operation
      await queue.enqueue({
        type: 'set',
        documentId: 'doc-1',
        field: 'description',
        value: 'Test 2',
        clock: { 'client-1': 2 },
        clientId: 'client-1',
        timestamp: now + 1000,
      })

      const stats2 = queue.getStats()
      // Oldest should still be first operation
      expect(stats2.oldestOperation).toBe(stats1.oldestOperation)
    })

    it('reports null for oldest when queue empty', () => {
      const stats = queue.getStats()
      expect(stats.oldestOperation).toBeNull()
    })
  })

  describe('Clear', () => {
    it('clears all operations', async () => {
      const operation: Operation = {
        type: 'set',
        documentId: 'doc-1',
        field: 'title',
        value: 'Test',
        clock: { 'client-1': 1 },
        clientId: 'client-1',
        timestamp: Date.now(),
      }

      await queue.enqueue(operation)
      await queue.enqueue({ ...operation, field: 'description' })

      await queue.clear()

      const stats = queue.getStats()
      expect(stats.size).toBe(0)
    })

    it('removes operations from storage', async () => {
      const operation: Operation = {
        type: 'set',
        documentId: 'doc-1',
        field: 'title',
        value: 'Test',
        clock: { 'client-1': 1 },
        clientId: 'client-1',
        timestamp: Date.now(),
      }

      await queue.enqueue(operation)
      await queue.clear()

      const keys = await storage.list()
      const queueKeys = keys.filter((k) => k.startsWith('synckit:queue:'))
      expect(queueKeys.length).toBe(0)
    })

    it('clears failed operations', async () => {
      const operation: Operation = {
        type: 'set',
        documentId: 'doc-1',
        field: 'title',
        value: 'Test',
        clock: { 'client-1': 1 },
        clientId: 'client-1',
        timestamp: Date.now(),
      }

      await queue.enqueue(operation)

      const sender = vi.fn().mockRejectedValue(new Error('Always fail'))
      await queue.replay(sender)

      await queue.clear()

      const stats = queue.getStats()
      expect(stats.failed).toBe(0)
    })
  })

  describe('Change Listeners', () => {
    it('emits change on enqueue', async () => {
      const listener = vi.fn()
      queue.onChange(listener)

      const operation: Operation = {
        type: 'set',
        documentId: 'doc-1',
        field: 'title',
        value: 'Test',
        clock: { 'client-1': 1 },
        clientId: 'client-1',
        timestamp: Date.now(),
      }

      await queue.enqueue(operation)

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          size: 1,
        })
      )
    })

    it('emits change on replay', async () => {
      const operation: Operation = {
        type: 'set',
        documentId: 'doc-1',
        field: 'title',
        value: 'Test',
        clock: { 'client-1': 1 },
        clientId: 'client-1',
        timestamp: Date.now(),
      }

      await queue.enqueue(operation)

      const listener = vi.fn()
      queue.onChange(listener)

      const sender = vi.fn().mockResolvedValue(undefined)
      await queue.replay(sender)

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          size: 0,
        })
      )
    })

    it('removes listener with unsubscribe', async () => {
      const listener = vi.fn()
      const unsubscribe = queue.onChange(listener)

      unsubscribe()

      const operation: Operation = {
        type: 'set',
        documentId: 'doc-1',
        field: 'title',
        value: 'Test',
        clock: { 'client-1': 1 },
        clientId: 'client-1',
        timestamp: Date.now(),
      }

      await queue.enqueue(operation)

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('Failed Operations', () => {
    it('persists failed operations', async () => {
      const operation: Operation = {
        type: 'set',
        documentId: 'doc-1',
        field: 'title',
        value: 'Test',
        clock: { 'client-1': 1 },
        clientId: 'client-1',
        timestamp: Date.now(),
      }

      await queue.enqueue(operation)

      const sender = vi.fn().mockRejectedValue(new Error('Always fail'))
      await queue.replay(sender)

      const keys = await storage.list()
      const failedKeys = keys.filter((k) => k.startsWith('synckit:queue:failed:'))
      expect(failedKeys.length).toBe(1)
    })

    it('clearFailed removes failed operations', async () => {
      const operation: Operation = {
        type: 'set',
        documentId: 'doc-1',
        field: 'title',
        value: 'Test',
        clock: { 'client-1': 1 },
        clientId: 'client-1',
        timestamp: Date.now(),
      }

      await queue.enqueue(operation)

      const sender = vi.fn().mockRejectedValue(new Error('Always fail'))
      await queue.replay(sender)

      await queue.clearFailed()

      const stats = queue.getStats()
      expect(stats.failed).toBe(0)

      const keys = await storage.list()
      const failedKeys = keys.filter((k) => k.startsWith('synckit:queue:failed:'))
      expect(failedKeys.length).toBe(0)
    })
  })
})
