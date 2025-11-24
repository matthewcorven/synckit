/**
 * Network State Tracker
 *
 * Tracks online/offline state and notifies listeners when connectivity changes.
 * Uses browser's navigator.onLine and online/offline events.
 *
 * @module sync/network-state
 */

import type { Unsubscribe } from '../types'

// ====================
// Types
// ====================

export type NetworkState = 'online' | 'offline' | 'unknown'

// ====================
// Network State Tracker
// ====================

export class NetworkStateTracker {
  private state: NetworkState
  private listeners: Set<(state: NetworkState) => void> = new Set()

  constructor() {
    // Initialize state based on browser's navigator.onLine
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      this.state = navigator.onLine ? 'online' : 'offline'
    } else {
      // Fallback for environments without navigator (e.g., Node.js during tests)
      this.state = 'unknown'
    }

    // Set up event listeners if in browser environment
    if (typeof window !== 'undefined') {
      this.setupEventListeners()
    }
  }

  /**
   * Get current network state
   */
  getState(): NetworkState {
    return this.state
  }

  /**
   * Check if currently online
   */
  isOnline(): boolean {
    return this.state === 'online'
  }

  /**
   * Check if currently offline
   */
  isOffline(): boolean {
    return this.state === 'offline'
  }

  /**
   * Listen for state changes
   *
   * @param callback - Called when network state changes
   * @returns Unsubscribe function
   *
   * @example
   * ```ts
   * const tracker = new NetworkStateTracker()
   *
   * const unsubscribe = tracker.onChange((state) => {
   *   console.log('Network state:', state)
   * })
   *
   * // Later
   * unsubscribe()
   * ```
   */
  onChange(callback: (state: NetworkState) => void): Unsubscribe {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  /**
   * Manually update network state
   * Useful for testing or forced offline mode
   *
   * @param state - New network state
   */
  setState(state: NetworkState): void {
    if (this.state !== state) {
      this.state = state
      this.notifyListeners()
    }
  }

  /**
   * Dispose network state tracker
   * Removes all event listeners
   */
  dispose(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline)
      window.removeEventListener('offline', this.handleOffline)
    }
    this.listeners.clear()
  }

  // ====================
  // Private Methods
  // ====================

  /**
   * Set up browser event listeners
   */
  private setupEventListeners(): void {
    window.addEventListener('online', this.handleOnline)
    window.addEventListener('offline', this.handleOffline)
  }

  /**
   * Handle online event
   */
  private handleOnline = (): void => {
    if (this.state !== 'online') {
      this.state = 'online'
      this.notifyListeners()
    }
  }

  /**
   * Handle offline event
   */
  private handleOffline = (): void => {
    if (this.state !== 'offline') {
      this.state = 'offline'
      this.notifyListeners()
    }
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state)
      } catch (error) {
        console.error('Network state listener error:', error)
      }
    }
  }
}
