/**
 * Network State Tracker Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NetworkStateTracker } from '../../sync/network-state'

describe('NetworkStateTracker', () => {
  let tracker: NetworkStateTracker
  let mockNavigator: { onLine: boolean }
  let mockWindow: {
    addEventListener: ReturnType<typeof vi.fn>
    removeEventListener: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    // Mock navigator
    mockNavigator = { onLine: true }
    vi.stubGlobal('navigator', mockNavigator)

    // Mock window
    mockWindow = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('window', mockWindow)
  })

  afterEach(() => {
    if (tracker) {
      tracker.dispose()
    }
    vi.unstubAllGlobals()
  })

  describe('Initialization', () => {
    it('initializes with online state when navigator.onLine is true', () => {
      mockNavigator.onLine = true
      tracker = new NetworkStateTracker()

      expect(tracker.getState()).toBe('online')
      expect(tracker.isOnline()).toBe(true)
      expect(tracker.isOffline()).toBe(false)
    })

    it('initializes with offline state when navigator.onLine is false', () => {
      mockNavigator.onLine = false
      tracker = new NetworkStateTracker()

      expect(tracker.getState()).toBe('offline')
      expect(tracker.isOnline()).toBe(false)
      expect(tracker.isOffline()).toBe(true)
    })

    it('sets up event listeners', () => {
      tracker = new NetworkStateTracker()

      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        'online',
        expect.any(Function)
      )
      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        'offline',
        expect.any(Function)
      )
    })
  })

  describe('State Management', () => {
    beforeEach(() => {
      mockNavigator.onLine = true
      tracker = new NetworkStateTracker()
    })

    it('manually updates state', () => {
      tracker.setState('offline')
      expect(tracker.getState()).toBe('offline')
      expect(tracker.isOffline()).toBe(true)
    })

    it('does not emit change when state is same', () => {
      const listener = vi.fn()
      tracker.onChange(listener)

      tracker.setState('online') // Already online
      expect(listener).not.toHaveBeenCalled()
    })

    it('emits change when state changes', () => {
      const listener = vi.fn()
      tracker.onChange(listener)

      tracker.setState('offline')
      expect(listener).toHaveBeenCalledWith('offline')
    })
  })

  describe('Change Listeners', () => {
    beforeEach(() => {
      tracker = new NetworkStateTracker()
    })

    it('calls listener when state changes', () => {
      const listener = vi.fn()
      tracker.onChange(listener)

      tracker.setState('offline')

      expect(listener).toHaveBeenCalledWith('offline')
    })

    it('calls multiple listeners', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      tracker.onChange(listener1)
      tracker.onChange(listener2)

      tracker.setState('offline')

      expect(listener1).toHaveBeenCalledWith('offline')
      expect(listener2).toHaveBeenCalledWith('offline')
    })

    it('removes listener with unsubscribe', () => {
      const listener = vi.fn()
      const unsubscribe = tracker.onChange(listener)

      unsubscribe()
      tracker.setState('offline')

      expect(listener).not.toHaveBeenCalled()
    })

    it('handles listener errors gracefully', () => {
      const errorListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error')
      })
      const goodListener = vi.fn()

      tracker.onChange(errorListener)
      tracker.onChange(goodListener)

      tracker.setState('offline')

      // Both listeners should be called, error handled
      expect(errorListener).toHaveBeenCalled()
      expect(goodListener).toHaveBeenCalled()
    })
  })

  describe('Browser Events', () => {
    it('handles online event', () => {
      mockNavigator.onLine = false
      tracker = new NetworkStateTracker()

      const listener = vi.fn()
      tracker.onChange(listener)

      // Get the online event handler
      const onlineHandler = mockWindow.addEventListener.mock.calls.find(
        (call) => call[0] === 'online'
      )?.[1] as Function

      // Simulate online event
      if (onlineHandler) {
        onlineHandler()
      }

      expect(tracker.getState()).toBe('online')
      expect(listener).toHaveBeenCalledWith('online')
    })

    it('handles offline event', () => {
      mockNavigator.onLine = true
      tracker = new NetworkStateTracker()

      const listener = vi.fn()
      tracker.onChange(listener)

      // Get the offline event handler
      const offlineHandler = mockWindow.addEventListener.mock.calls.find(
        (call) => call[0] === 'offline'
      )?.[1] as Function

      // Simulate offline event
      if (offlineHandler) {
        offlineHandler()
      }

      expect(tracker.getState()).toBe('offline')
      expect(listener).toHaveBeenCalledWith('offline')
    })

    it('does not emit duplicate events', () => {
      tracker = new NetworkStateTracker()

      const listener = vi.fn()
      tracker.onChange(listener)

      // Get the online event handler
      const onlineHandler = mockWindow.addEventListener.mock.calls.find(
        (call) => call[0] === 'online'
      )?.[1] as Function

      // Trigger online event multiple times
      if (onlineHandler) {
        onlineHandler()
        onlineHandler()
        onlineHandler()
      }

      // Should only emit once (already online)
      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('Dispose', () => {
    it('removes event listeners', () => {
      tracker = new NetworkStateTracker()
      tracker.dispose()

      expect(mockWindow.removeEventListener).toHaveBeenCalledWith(
        'online',
        expect.any(Function)
      )
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith(
        'offline',
        expect.any(Function)
      )
    })

    it('clears all listeners', () => {
      tracker = new NetworkStateTracker()

      const listener = vi.fn()
      tracker.onChange(listener)

      tracker.dispose()
      tracker.setState('offline')

      // Listener should not be called after dispose
      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('State Queries', () => {
    beforeEach(() => {
      tracker = new NetworkStateTracker()
    })

    it('isOnline returns true when online', () => {
      tracker.setState('online')
      expect(tracker.isOnline()).toBe(true)
    })

    it('isOnline returns false when offline', () => {
      tracker.setState('offline')
      expect(tracker.isOnline()).toBe(false)
    })

    it('isOffline returns true when offline', () => {
      tracker.setState('offline')
      expect(tracker.isOffline()).toBe(true)
    })

    it('isOffline returns false when online', () => {
      tracker.setState('online')
      expect(tracker.isOffline()).toBe(false)
    })
  })
})
