/**
 * Offline Queue
 *
 * Queues operations when offline and replays them when connection is restored.
 * Persists queue to storage for durability across page reloads.
 *
 * @module sync/queue
 */

import type { StorageAdapter, Unsubscribe } from '../types'
import { SyncKitError } from '../types'

// ====================
// Configuration Types
// ====================

export interface OfflineQueueConfig {
  /** Storage adapter for persistence */
  storage: StorageAdapter

  /** Maximum queue size (default: 10000) */
  maxSize?: number

  /** Maximum retries per operation (default: 5) */
  maxRetries?: number

  /** Initial retry delay in ms (default: 1000) */
  retryDelay?: number

  /** Retry backoff multiplier (default: 2.0) */
  retryBackoff?: number
}

// ====================
// Operation Types
// ====================

export interface VectorClock {
  [clientId: string]: number
}

export interface Operation {
  type: 'set' | 'delete'
  documentId: string
  field?: string
  value?: unknown
  clock: VectorClock
  clientId: string
  timestamp: number
}

export interface QueuedOperation {
  /** Unique operation ID */
  id: string

  /** Document ID */
  documentId: string

  /** Operation type */
  type: 'set' | 'delete'

  /** Field path (for set operations) */
  field?: string

  /** Value (for set operations) */
  value?: unknown

  /** Vector clock */
  clock: VectorClock

  /** Client ID */
  clientId: string

  /** Timestamp */
  timestamp: number

  /** Number of retry attempts */
  retries: number

  /** When operation was enqueued */
  enqueuedAt: number
}

// ====================
// Stats Types
// ====================

export interface QueueStats {
  /** Total operations in queue */
  size: number

  /** Operations currently being replayed */
  replaying: number

  /** Failed operations (max retries exceeded) */
  failed: number

  /** Oldest operation timestamp */
  oldestOperation: number | null
}

// ====================
// Error Types
// ====================

export class QueueFullError extends SyncKitError {
  constructor(message: string) {
    super(message, 'QUEUE_FULL')
    this.name = 'QueueFullError'
  }
}

// ====================
// Offline Queue
// ====================

export class OfflineQueue {
  private queue: QueuedOperation[] = []
  private failedQueue: QueuedOperation[] = []
  private isReplaying = false
  private replayingCount = 0
  private listeners = new Set<(stats: QueueStats) => void>()

  private readonly config: Required<OfflineQueueConfig>
  private readonly storage: StorageAdapter
  private readonly STORAGE_KEY_PREFIX = 'synckit:queue:'
  private readonly FAILED_KEY_PREFIX = 'synckit:queue:failed:'

  constructor(config: OfflineQueueConfig) {
    this.storage = config.storage
    this.config = {
      storage: config.storage,
      maxSize: config.maxSize ?? 10000,
      maxRetries: config.maxRetries ?? 5,
      retryDelay: config.retryDelay ?? 1000,
      retryBackoff: config.retryBackoff ?? 2.0,
    }
  }

  /**
   * Initialize queue (loads from storage)
   */
  async init(): Promise<void> {
    await this.loadQueue()
  }

  /**
   * Enqueue operation
   * Persists to storage immediately
   *
   * @throws {QueueFullError} if queue at max capacity
   */
  async enqueue(operation: Operation): Promise<void> {
    // Check size limit
    if (this.queue.length >= this.config.maxSize) {
      throw new QueueFullError(
        `Queue full (${this.config.maxSize} operations). ` +
          `Clear failed operations or increase maxSize.`
      )
    }

    // Check for duplicate operation
    const duplicate = this.findDuplicate(operation)
    if (duplicate) {
      // Update timestamp to latest
      duplicate.timestamp = operation.timestamp
      await this.persistOperation(duplicate)
      this.emitChange()
      return
    }

    // Create queued operation
    const queued: QueuedOperation = {
      id: this.generateOperationId(),
      documentId: operation.documentId,
      type: operation.type,
      field: operation.field,
      value: operation.value,
      clock: operation.clock,
      clientId: operation.clientId,
      timestamp: operation.timestamp,
      retries: 0,
      enqueuedAt: Date.now(),
    }

    // Add to in-memory queue
    this.queue.push(queued)

    // Persist to storage
    await this.persistOperation(queued)

    // Emit change event
    this.emitChange()
  }

  /**
   * Replay all queued operations
   * Sends each operation with retry logic
   * Removes from queue on success
   *
   * @param sender - Function to send operation
   * @returns Number of successfully replayed operations
   */
  async replay(sender: (op: Operation) => Promise<void>): Promise<number> {
    if (this.isReplaying) {
      throw new Error('Replay already in progress')
    }

    this.isReplaying = true
    let successCount = 0

    try {
      // Process queue in order (FIFO)
      while (this.queue.length > 0) {
        const queued = this.queue[0] // Peek first
        if (!queued) break // Safety check for TypeScript
        this.replayingCount = 1

        try {
          // Convert to regular operation
          const operation: Operation = {
            type: queued.type,
            documentId: queued.documentId,
            field: queued.field,
            value: queued.value,
            clock: queued.clock,
            clientId: queued.clientId,
            timestamp: queued.timestamp,
          }

          // Try to send
          await sender(operation)

          // Success! Remove from queue
          this.queue.shift()
          await this.removePersistedOperation(queued.id)
          successCount++

          this.emitChange()
        } catch (error) {
          // Failed, increment retry count
          queued.retries++

          if (queued.retries >= this.config.maxRetries) {
            // Max retries exceeded, move to failed
            console.error(
              `Operation ${queued.id} failed after ${queued.retries} retries:`,
              error
            )

            this.queue.shift()
            this.failedQueue.push(queued)
            await this.removePersistedOperation(queued.id)
            await this.persistFailedOperation(queued)

            this.emitChange()
          } else {
            // Retry with backoff
            const delay = this.calculateRetryDelay(queued.retries)
            await this.sleep(delay)

            // Update persisted retry count
            await this.persistOperation(queued)
          }
        }
      }

      this.replayingCount = 0
      return successCount
    } finally {
      this.isReplaying = false
      this.replayingCount = 0
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const oldestOperation =
      this.queue.length > 0 ? this.queue[0]?.enqueuedAt ?? null : null

    return {
      size: this.queue.length,
      replaying: this.replayingCount,
      failed: this.failedQueue.length,
      oldestOperation,
    }
  }

  /**
   * Clear failed operations from queue
   */
  async clearFailed(): Promise<void> {
    // Remove failed operations from storage
    for (const operation of this.failedQueue) {
      await this.removeFailedOperation(operation.id)
    }

    this.failedQueue = []
    this.emitChange()
  }

  /**
   * Clear entire queue
   * Use with caution - data loss possible
   */
  async clear(): Promise<void> {
    // Clear pending queue
    for (const operation of this.queue) {
      await this.removePersistedOperation(operation.id)
    }
    this.queue = []

    // Clear failed queue
    await this.clearFailed()

    this.emitChange()
  }

  /**
   * Listen for queue changes
   */
  onChange(callback: (stats: QueueStats) => void): Unsubscribe {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  // ====================
  // Private Methods
  // ====================

  /**
   * Load queue from storage
   */
  private async loadQueue(): Promise<void> {
    try {
      const keys = await this.storage.list()

      // Load pending operations
      const queueKeys = keys.filter((k) => k.startsWith(this.STORAGE_KEY_PREFIX))
      this.queue = []

      for (const key of queueKeys) {
        const data = await this.storage.get(key)
        if (data && this.isQueuedOperation(data)) {
          this.queue.push(data as QueuedOperation)
        }
      }

      // Sort by enqueued timestamp (FIFO)
      this.queue.sort((a, b) => a.enqueuedAt - b.enqueuedAt)

      // Load failed operations
      const failedKeys = keys.filter((k) => k.startsWith(this.FAILED_KEY_PREFIX))
      this.failedQueue = []

      for (const key of failedKeys) {
        const data = await this.storage.get(key)
        if (data && this.isQueuedOperation(data)) {
          this.failedQueue.push(data as QueuedOperation)
        }
      }
    } catch (error) {
      console.error('Failed to load queue from storage:', error)
    }
  }

  /**
   * Persist operation to storage
   */
  private async persistOperation(operation: QueuedOperation): Promise<void> {
    const key = `${this.STORAGE_KEY_PREFIX}${operation.id}`
    await this.storage.set(key, operation as any)
  }

  /**
   * Remove operation from storage
   */
  private async removePersistedOperation(id: string): Promise<void> {
    const key = `${this.STORAGE_KEY_PREFIX}${id}`
    await this.storage.delete(key)
  }

  /**
   * Persist failed operation
   */
  private async persistFailedOperation(operation: QueuedOperation): Promise<void> {
    const key = `${this.FAILED_KEY_PREFIX}${operation.id}`
    await this.storage.set(key, operation as any)
  }

  /**
   * Remove failed operation
   */
  private async removeFailedOperation(id: string): Promise<void> {
    const key = `${this.FAILED_KEY_PREFIX}${id}`
    await this.storage.delete(key)
  }

  /**
   * Find duplicate operation in queue
   */
  private findDuplicate(operation: Operation): QueuedOperation | null {
    return (
      this.queue.find(
        (queued) =>
          queued.documentId === operation.documentId &&
          queued.field === operation.field &&
          queued.type === operation.type &&
          this.isSameValue(queued.value, operation.value)
      ) || null
    )
  }

  /**
   * Check if two values are the same
   */
  private isSameValue(a: unknown, b: unknown): boolean {
    // Simple comparison using JSON stringify
    // For complex objects, this may not be perfect but is good enough
    try {
      return JSON.stringify(a) === JSON.stringify(b)
    } catch {
      return false
    }
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 15)
    return `op-${timestamp}-${random}`
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    const baseDelay = this.config.retryDelay
    const backoff = this.config.retryBackoff

    return baseDelay * Math.pow(backoff, retryCount - 1)
  }

  /**
   * Sleep for specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Type guard for queued operation
   */
  private isQueuedOperation(data: any): data is QueuedOperation {
    return (
      typeof data === 'object' &&
      data !== null &&
      typeof data.id === 'string' &&
      typeof data.documentId === 'string' &&
      (data.type === 'set' || data.type === 'delete') &&
      typeof data.clock === 'object' &&
      typeof data.clientId === 'string' &&
      typeof data.timestamp === 'number' &&
      typeof data.retries === 'number' &&
      typeof data.enqueuedAt === 'number'
    )
  }

  /**
   * Emit change event to listeners
   */
  private emitChange(): void {
    const stats = this.getStats()
    for (const listener of this.listeners) {
      try {
        listener(stats)
      } catch (error) {
        console.error('Queue stats listener error:', error)
      }
    }
  }
}
