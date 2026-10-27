import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  NetworkStateMachine,
  defaultNetworkManager,
  type NetworkSnapshot,
} from '@/services/networkManager'
import { NetworkStatusBadge } from '@/components/NetworkStatusBadge'

describe('Tier 5 Adversarial: Feature F15 Network State Machine & Telemetry Empirical Stress', () => {
  let network: NetworkStateMachine

  beforeEach(() => {
    vi.useFakeTimers()
    network = new NetworkStateMachine({ maxRetries: 5, initialLatencyMs: 14 })
  })

  afterEach(() => {
    network.destroy()
    vi.useRealTimers()
  })

  // =========================================================================
  // 1. Flapping Connection & Rapid Burst Stress
  // =========================================================================
  describe('1. Flapping Connection & Rapid Disconnect/Reconnect Bursts', () => {
    it('survives 1,000 rapid disconnect/reconnect transitions without timer leakage or state corruption', () => {
      const stateHistory: string[] = []
      const unsubscribe = network.subscribe((snap) => {
        stateHistory.push(snap.state)
      })

      // Simulate 500 disconnect-reconnect cycles (1,000 transitions)
      for (let i = 0; i < 500; i++) {
        network.handleDisconnect()
        expect(['RECONNECTING', 'OFFLINE']).toContain(network.getState())
        network.handleReconnectSuccess()
        expect(network.getState()).toBe('ONLINE')
        expect(network.getRetryAttempts()).toBe(0)
      }

      // After 500 cycles, state should be strictly ONLINE with 0 retries
      expect(network.getState()).toBe('ONLINE')
      expect(network.getRetryAttempts()).toBe(0)
      expect(network.getCountdownSec()).toBe(0)
      expect(stateHistory.length).toBe(1001) // 1 initial + 1000 transitions

      unsubscribe()
    })

    it('handles rapid alternating bursts of 4 disconnects followed by successful reconnect 50 times', () => {
      for (let cycle = 0; cycle < 50; cycle++) {
        // 4 consecutive disconnects (retries 1, 2, 3, 4 - still under maxRetries=5)
        for (let d = 1; d <= 4; d++) {
          network.handleDisconnect()
          expect(network.getState()).toBe('RECONNECTING')
          expect(network.getRetryAttempts()).toBe(d)
        }
        // Then success resets retries to 0
        network.handleReconnectSuccess()
        expect(network.getState()).toBe('ONLINE')
        expect(network.getRetryAttempts()).toBe(0)
      }
    })

    it('does not accumulate stacked countdown timers during rapid disconnect flapping', () => {
      const reconnectCb = vi.fn()
      network.subscribeToReconnect(reconnectCb)

      // Rapidly trigger 4 disconnects without waiting for timers
      network.handleDisconnect()
      network.handleDisconnect()
      network.handleDisconnect()
      network.handleDisconnect()

      expect(network.getState()).toBe('RECONNECTING')
      expect(network.getRetryAttempts()).toBe(4)

      // Fast forward by 100 seconds: callback should fire once for the active countdown, not 4 separate times
      vi.advanceTimersByTime(100000)
      expect(reconnectCb).toHaveBeenCalledTimes(1)
    })
  })

  // =========================================================================
  // 2. Max Retry Limits & OFFLINE Transitions
  // =========================================================================
  describe('2. Max Retry Limits & Transition to OFFLINE', () => {
    it('transitions to OFFLINE exactly on the 5th failure with default maxRetries', () => {
      expect(network.getState()).toBe('ONLINE')

      for (let i = 1; i <= 4; i++) {
        network.handleDisconnect()
        expect(network.getState()).toBe('RECONNECTING')
        expect(network.getRetryAttempts()).toBe(i)
        expect(network.getCountdownSec()).toBeGreaterThan(0)
      }

      // 5th failure trips maxRetries
      network.handleDisconnect()
      expect(network.getState()).toBe('OFFLINE')
      expect(network.getRetryAttempts()).toBe(5)
      expect(network.getCountdownSec()).toBe(0)
    })

    it('remains in OFFLINE state upon further consecutive disconnects past maxRetries (e.g. 6 to 50)', () => {
      for (let i = 0; i < 5; i++) {
        network.handleDisconnect()
      }
      expect(network.getState()).toBe('OFFLINE')

      // 45 more disconnects
      for (let i = 6; i <= 50; i++) {
        network.handleDisconnect()
        expect(network.getState()).toBe('OFFLINE')
        expect(network.getRetryAttempts()).toBe(i)
        expect(network.getCountdownSec()).toBe(0)
      }
    })

    it('respects custom maxRetries = 1: immediately transitions to OFFLINE on first failure', () => {
      const strictNet = new NetworkStateMachine({ maxRetries: 1 })
      expect(strictNet.getState()).toBe('ONLINE')

      strictNet.handleDisconnect()
      expect(strictNet.getState()).toBe('OFFLINE')
      expect(strictNet.getRetryAttempts()).toBe(1)
      expect(strictNet.getCountdownSec()).toBe(0)

      strictNet.destroy()
    })

    it('respects custom maxRetries = 10: stays in RECONNECTING until exactly attempt 10', () => {
      const resilientNet = new NetworkStateMachine({ maxRetries: 10 })

      for (let i = 1; i <= 9; i++) {
        resilientNet.handleDisconnect()
        expect(resilientNet.getState()).toBe('RECONNECTING')
        expect(resilientNet.getRetryAttempts()).toBe(i)
      }

      resilientNet.handleDisconnect()
      expect(resilientNet.getState()).toBe('OFFLINE')
      expect(resilientNet.getRetryAttempts()).toBe(10)

      resilientNet.destroy()
    })

    it('cancels countdown timer and prevents auto-reconnect when entering OFFLINE', () => {
      const reconnectCb = vi.fn()
      network.subscribeToReconnect(reconnectCb)

      // Reach OFFLINE
      for (let i = 0; i < 5; i++) {
        network.handleDisconnect()
      }
      expect(network.getState()).toBe('OFFLINE')
      expect(network.getCountdownSec()).toBe(0)

      // Fast forward time by 1 hour
      vi.advanceTimersByTime(3600 * 1000)
      // Auto reconnect should NOT fire when OFFLINE
      expect(reconnectCb).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // 3. Exponential Backoff Delays & Bounded Jitter Mathematics
  // =========================================================================
  describe('3. Exponential Backoff Delays & Bounded Jitter Mathematics', () => {
    it('computes exact deterministic binary exponential sequence (1s, 2s, 4s, 8s, 16s) without jitter', () => {
      const opts = { jitter: false, baseDelayMs: 1000, factor: 2, maxDelayMs: 16000 }
      const expected = [1000, 2000, 4000, 8000, 16000]

      for (let attempt = 0; attempt < 5; attempt++) {
        const delay = network.calculateBackoff(attempt, opts)
        expect(delay).toBe(expected[attempt])
      }
    })

    it('caps exponential delays strictly at maxDelayMs (16,000ms) for high attempt counts', () => {
      const opts = { jitter: false, baseDelayMs: 1000, factor: 2, maxDelayMs: 16000 }
      expect(network.calculateBackoff(5, opts)).toBe(16000)
      expect(network.calculateBackoff(10, opts)).toBe(16000)
      expect(network.calculateBackoff(50, opts)).toBe(16000)
      expect(network.calculateBackoff(100, opts)).toBe(16000)
    })

    it('safely handles negative or invalid attempt indexes by falling back to attempt 0', () => {
      const opts = { jitter: false, baseDelayMs: 1000, factor: 2, maxDelayMs: 16000 }
      expect(network.calculateBackoff(-1, opts)).toBe(1000)
      expect(network.calculateBackoff(-999, opts)).toBe(1000)
    })

    it('strictly enforces ±25% jitter bounds across all attempts', () => {
      const minRandom = () => 0.0
      const maxRandom = () => 1.0
      const midRandom = () => 0.5

      const testCases = [
        { attempt: 0, base: 1000, minExpected: 750, maxExpected: 1250 },
        { attempt: 1, base: 2000, minExpected: 1500, maxExpected: 2500 },
        { attempt: 2, base: 4000, minExpected: 3000, maxExpected: 5000 },
        { attempt: 3, base: 8000, minExpected: 6000, maxExpected: 10000 },
        // Attempt 4: capped at 16,000ms, upper bound is min(16000, 16000 + 4000) = 16000ms
        { attempt: 4, base: 16000, minExpected: 12000, maxExpected: 16000 },
      ]

      for (const tc of testCases) {
        const delayMin = network.calculateBackoff(tc.attempt, {
          baseDelayMs: 1000,
          factor: 2,
          maxDelayMs: 16000,
          jitter: true,
          jitterRatio: 0.25,
          randomFn: minRandom,
        })
        const delayMax = network.calculateBackoff(tc.attempt, {
          baseDelayMs: 1000,
          factor: 2,
          maxDelayMs: 16000,
          jitter: true,
          jitterRatio: 0.25,
          randomFn: maxRandom,
        })
        const delayMid = network.calculateBackoff(tc.attempt, {
          baseDelayMs: 1000,
          factor: 2,
          maxDelayMs: 16000,
          jitter: true,
          jitterRatio: 0.25,
          randomFn: midRandom,
        })

        expect(delayMin).toBe(tc.minExpected)
        expect(delayMax).toBe(tc.maxExpected)
        expect(delayMid).toBe(tc.base)
      }
    })

    it('Monte Carlo Fuzzing: 5,000 random jitter executions produce integer delays strictly within bounds', () => {
      for (let i = 0; i < 5000; i++) {
        const attempt = i % 10
        const delay = network.calculateBackoff(attempt)

        expect(Number.isInteger(delay)).toBe(true)
        expect(Number.isFinite(delay)).toBe(true)
        expect(delay).toBeGreaterThanOrEqual(500) // baseDelay * 0.5
        expect(delay).toBeLessThanOrEqual(16000) // maxDelayMs
      }
    })
  })

  // =========================================================================
  // 4. Transport Latency Telemetry (EMA Smoothing) Robustness
  // =========================================================================
  describe('4. Transport Latency Telemetry (EMA Smoothing) Robustness', () => {
    it('initializes with default institutional latency (14ms)', () => {
      expect(network.getLatency()).toBe(14)
    })

    it('rejects non-positive, zero, NaN, and Infinity samples without altering state', () => {
      const initial = network.getLatency()

      expect(network.recordLatency(0)).toBe(initial)
      expect(network.recordLatency(-1)).toBe(initial)
      expect(network.recordLatency(-5000)).toBe(initial)
      expect(network.recordLatency(NaN)).toBe(initial)
      expect(network.recordLatency(Infinity)).toBe(initial)
      expect(network.recordLatency(-Infinity)).toBe(initial)

      expect(network.getLatency()).toBe(initial)
    })

    it('smooths latency correctly using 75% previous + 25% new sample', () => {
      // 14 * 0.75 + 50 * 0.25 = 10.5 + 12.5 = 23
      expect(network.recordLatency(50)).toBe(23)
      // 23 * 0.75 + 100 * 0.25 = 17.25 + 25 = 42.25 => round = 42
      expect(network.recordLatency(100)).toBe(42)
      // 42 * 0.75 + 10 * 0.25 = 31.5 + 2.5 = 34
      expect(network.recordLatency(10)).toBe(34)
    })

    it('clamps pathological high delay spikes to 2,000ms max without producing NaN or Infinity', () => {
      // Spikes of 10,000ms, 1,000,000ms should be bounded to 2,000ms
      // 14 * 0.75 + 2000 * 0.25 = 10.5 + 500 = 510.5 => 511
      const smoothed = network.recordLatency(1_000_000)
      expect(smoothed).toBe(511)
      expect(smoothed).toBeLessThanOrEqual(2000)
      expect(Number.isFinite(smoothed)).toBe(true)
      expect(Number.isNaN(smoothed)).toBe(false)

      // Repeated extreme spikes converge monotonically towards 2000ms (1999ms fixed point) without overflowing
      for (let i = 0; i < 50; i++) {
        const val = network.recordLatency(9999999)
        expect(Number.isFinite(val)).toBe(true)
        expect(Number.isNaN(val)).toBe(false)
        expect(val).toBeLessThanOrEqual(2000)
      }
      expect(network.getLatency()).toBeGreaterThanOrEqual(1990)
      expect(network.getLatency()).toBeLessThanOrEqual(2000)
    })

    it('clamps tiny sub-millisecond positive delays to 1ms min without producing NaN or zero', () => {
      const net = new NetworkStateMachine({ initialLatencyMs: 10 })
      // 10 * 0.75 + 1 * 0.25 = 7.5 + 0.25 = 7.75 => 8
      expect(net.recordLatency(0.00001)).toBe(8)

      // Repeated sub-millisecond samples converge monotonically towards 1ms (3ms fixed point) without hitting 0 or negative
      for (let i = 0; i < 50; i++) {
        const val = net.recordLatency(0.0001)
        expect(Number.isFinite(val)).toBe(true)
        expect(Number.isNaN(val)).toBe(false)
        expect(val).toBeGreaterThanOrEqual(1)
      }
      expect(net.getLatency()).toBeGreaterThanOrEqual(1)
      expect(net.getLatency()).toBeLessThanOrEqual(5)
      net.destroy()
    })

    it('handles floating point sample rounding cleanly across 1,000 random samples', () => {
      for (let i = 0; i < 1000; i++) {
        const sample = Math.random() * 500 + 0.1
        const result = network.recordLatency(sample)
        expect(Number.isInteger(result)).toBe(true)
        expect(Number.isFinite(result)).toBe(true)
        expect(result).toBeGreaterThanOrEqual(1)
        expect(result).toBeLessThanOrEqual(2000)
      }
    })
  })

  // =========================================================================
  // 5. Browser Online / Offline Events & Backoff Suspension
  // =========================================================================
  describe('5. Browser Online / Offline Events & Backoff Suspension', () => {
    it('suspends countdown and immediately transitions to OFFLINE when browser goes offline', () => {
      const reconnectCb = vi.fn()
      network.subscribeToReconnect(reconnectCb)

      // Disconnect once to enter RECONNECTING
      network.handleDisconnect()
      expect(network.getState()).toBe('RECONNECTING')
      expect(network.getCountdownSec()).toBeGreaterThan(0)

      // Browser loses connection
      network.handleBrowserOffline()
      expect(network.getState()).toBe('OFFLINE')
      expect(network.getSnapshot().isBrowserOnline).toBe(false)
      expect(network.getCountdownSec()).toBe(0)

      // Advance time by 30 seconds: reconnect should NOT fire
      vi.advanceTimersByTime(30000)
      expect(reconnectCb).not.toHaveBeenCalled()
    })

    it('triggers immediate reconnectNow() and resets retries when browser comes back online', () => {
      const reconnectCb = vi.fn()
      network.subscribeToReconnect(reconnectCb)

      network.handleBrowserOffline()
      expect(network.getState()).toBe('OFFLINE')

      // Browser connection restored
      network.handleBrowserOnline()
      expect(network.getState()).toBe('RECONNECTING')
      expect(network.getRetryAttempts()).toBe(0)
      expect(network.getSnapshot().isBrowserOnline).toBe(true)
      expect(reconnectCb).toHaveBeenCalledTimes(1)
    })

    it('preserves offline state when forceOffline() is invoked explicitly', () => {
      network.forceOffline()
      expect(network.getState()).toBe('OFFLINE')
      expect(network.getCountdownSec()).toBe(0)
    })
  })

  // =========================================================================
  // 6. Manual reconnectNow() Action & Reset Mechanics
  // =========================================================================
  describe('6. Manual reconnectNow() Action & Reset Mechanics', () => {
    it('resets retry attempts to 0 and immediately triggers reconnect callbacks from OFFLINE', () => {
      const reconnectCb = vi.fn()
      network.subscribeToReconnect(reconnectCb)

      for (let i = 0; i < 5; i++) {
        network.handleDisconnect()
      }
      expect(network.getState()).toBe('OFFLINE')
      expect(network.getRetryAttempts()).toBe(5)

      network.reconnectNow()
      expect(network.getState()).toBe('RECONNECTING')
      expect(network.getRetryAttempts()).toBe(0)
      expect(network.getCountdownSec()).toBe(0)
      expect(reconnectCb).toHaveBeenCalledTimes(1)
    })

    it('cancels active countdown timer when reconnectNow() is invoked mid-countdown', () => {
      const reconnectCb = vi.fn()
      network.subscribeToReconnect(reconnectCb)

      network.handleDisconnect()
      expect(network.getState()).toBe('RECONNECTING')
      expect(network.getCountdownSec()).toBeGreaterThan(0)

      // User presses "Now" button
      network.reconnectNow()
      expect(network.getState()).toBe('RECONNECTING')
      expect(network.getRetryAttempts()).toBe(0)
      expect(network.getCountdownSec()).toBe(0)
      expect(reconnectCb).toHaveBeenCalledTimes(1)

      // Fast forward past countdown: should not double trigger
      vi.advanceTimersByTime(10000)
      expect(reconnectCb).toHaveBeenCalledTimes(1)
    })

    it('handles 100 consecutive rapid reconnectNow() invocations safely without error', () => {
      const reconnectCb = vi.fn()
      network.subscribeToReconnect(reconnectCb)

      for (let i = 0; i < 100; i++) {
        network.reconnectNow()
        expect(network.getState()).toBe('RECONNECTING')
        expect(network.getRetryAttempts()).toBe(0)
      }

      expect(reconnectCb).toHaveBeenCalledTimes(100)
    })
  })

  // =========================================================================
  // 7. Subscriber Isolation & Error Resilience
  // =========================================================================
  describe('7. Subscriber Isolation & Error Resilience', () => {
    it('isolates subscriber errors during notify so that other subscribers still receive notifications', () => {
      let callCount = 0
      const faultySubscriber = vi.fn().mockImplementation(() => {
        callCount++
        if (callCount > 1) {
          throw new Error('Crashing subscriber on update!')
        }
      })
      const healthySubscriber = vi.fn()

      const unsub1 = network.subscribe(faultySubscriber)
      const unsub2 = network.subscribe(healthySubscriber)

      expect(callCount).toBe(1)
      expect(healthySubscriber).toHaveBeenCalledTimes(1)

      // State transition triggers notify()
      network.handleDisconnect()

      expect(faultySubscriber).toHaveBeenCalledTimes(2)
      expect(healthySubscriber).toHaveBeenCalledTimes(2)

      unsub1()
      unsub2()
    })

    it('isolates reconnect callback errors so that other callbacks still execute', () => {
      const faultyCb = vi.fn().mockImplementation(() => {
        throw new Error('Crashing reconnect callback!')
      })
      const healthyCb = vi.fn()

      const unsub1 = network.subscribeToReconnect(faultyCb)
      const unsub2 = network.subscribeToReconnect(healthyCb)

      network.reconnectNow()

      expect(faultyCb).toHaveBeenCalledTimes(1)
      expect(healthyCb).toHaveBeenCalledTimes(1)

      unsub1()
      unsub2()
    })
  })

  // =========================================================================
  // 8. Singleton Integrity & Snapshot Schema Conformance
  // =========================================================================
  describe('8. Singleton Integrity & Snapshot Schema Conformance', () => {
    it('verifies defaultNetworkManager singleton conforms to NetworkSnapshot interface', () => {
      const snap: NetworkSnapshot = defaultNetworkManager.getSnapshot()

      expect(['ONLINE', 'RECONNECTING', 'OFFLINE']).toContain(snap.state)
      expect(typeof snap.latencyMs).toBe('number')
      expect(typeof snap.retryAttempts).toBe('number')
      expect(typeof snap.maxRetries).toBe('number')
      expect(typeof snap.countdownSec).toBe('number')
      expect(typeof snap.isBrowserOnline).toBe('boolean')
      expect(snap.maxRetries).toBe(5)
      expect(Number.isFinite(snap.latencyMs)).toBe(true)
    })
  })

  // =========================================================================
  // 9. NetworkStatusBadge UI Component Render Invariants
  // =========================================================================
  describe('9. NetworkStatusBadge UI Component Render Invariants', () => {
    afterEach(() => {
      defaultNetworkManager.handleReconnectSuccess()
    })

    it('renders ONLINE status badge with ping telemetry cleanly without crashing', () => {
      defaultNetworkManager.handleReconnectSuccess()
      const lat = defaultNetworkManager.getLatency()

      const html = renderToStaticMarkup(React.createElement(NetworkStatusBadge, {}))
      expect(html).toContain('Online')
      expect(html).toContain(`(${lat}ms)`)
      expect(html).toContain('bg-emerald-500/10')
    })

    it('renders RECONNECTING status badge with countdown and Now action button', () => {
      defaultNetworkManager.handleDisconnect()

      const html = renderToStaticMarkup(React.createElement(NetworkStatusBadge, {}))
      expect(html).toContain('Reconnecting')
      expect(html).toContain('Now')
      expect(html).toContain('bg-amber-500/10')
    })

    it('renders OFFLINE status badge with Reconnect Now button', () => {
      defaultNetworkManager.forceOffline()

      const html = renderToStaticMarkup(React.createElement(NetworkStatusBadge, {}))
      expect(html).toContain('Offline')
      expect(html).toContain('Reconnect Now')
      expect(html).toContain('bg-rose-500/15')
    })

    it('renders compact mode without text labels across all states', () => {
      defaultNetworkManager.handleReconnectSuccess()
      const htmlOnlineCompact = renderToStaticMarkup(
        React.createElement(NetworkStatusBadge, { compact: true })
      )
      expect(htmlOnlineCompact).not.toContain('>Online<')

      defaultNetworkManager.forceOffline()
      const htmlOfflineCompact = renderToStaticMarkup(
        React.createElement(NetworkStatusBadge, { compact: true })
      )
      expect(htmlOfflineCompact).not.toContain('>Offline<')
    })
  })
})
