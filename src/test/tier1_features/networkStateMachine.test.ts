import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NetworkStateMachine } from '@/services/networkManager'

describe('Tier 1: F15 Network State Machine & Telemetry Engine', () => {
  let network: NetworkStateMachine

  beforeEach(() => {
    vi.useFakeTimers()
    network = new NetworkStateMachine({ maxRetries: 5, initialLatencyMs: 14 })
  })

  afterEach(() => {
    network.destroy()
    vi.useRealTimers()
  })

  it('1. Initializes in ONLINE state with 0 retry attempts and expected default latency', () => {
    expect(network.getState()).toBe('ONLINE')
    expect(network.getRetryAttempts()).toBe(0)
    expect(network.getMaxRetries()).toBe(5)
    expect(network.getLatency()).toBe(14)
  })

  it('2. Transitions from ONLINE to RECONNECTING on handleDisconnect()', () => {
    network.handleDisconnect()
    expect(network.getState()).toBe('RECONNECTING')
    expect(network.getRetryAttempts()).toBe(1)
  })

  it('3. Transitions from RECONNECTING back to ONLINE on handleReconnectSuccess()', () => {
    network.handleDisconnect()
    expect(network.getState()).toBe('RECONNECTING')

    network.handleReconnectSuccess()
    expect(network.getState()).toBe('ONLINE')
    expect(network.getRetryAttempts()).toBe(0)
  })

  it('4. Transitions to OFFLINE once consecutive retries reach maxRetries (5)', () => {
    for (let i = 0; i < 5; i++) {
      network.handleDisconnect()
    }
    expect(network.getState()).toBe('OFFLINE')
    expect(network.getRetryAttempts()).toBe(5)
  })

  it('5. Transitions immediately to OFFLINE on forceOffline() regardless of attempts', () => {
    expect(network.getState()).toBe('ONLINE')
    network.forceOffline()
    expect(network.getState()).toBe('OFFLINE')
  })

  it('6. reconnectNow() resets attempts, transitions to RECONNECTING, and fires callbacks', () => {
    const reconnectCallback = vi.fn()
    network.subscribeToReconnect(reconnectCallback)

    // Force offline first
    network.forceOffline()
    expect(network.getState()).toBe('OFFLINE')

    // Trigger manual reconnect
    network.reconnectNow()
    expect(network.getState()).toBe('RECONNECTING')
    expect(network.getRetryAttempts()).toBe(0)
    expect(reconnectCallback).toHaveBeenCalledTimes(1)
  })

  it('7. Calculates deterministic exponential backoff (1s, 2s, 4s, 8s, 16s) when jitter is disabled', () => {
    const opts = { jitter: false, baseDelayMs: 1000, factor: 2, maxDelayMs: 16000 }
    expect(network.calculateBackoff(0, opts)).toBe(1000)
    expect(network.calculateBackoff(1, opts)).toBe(2000)
    expect(network.calculateBackoff(2, opts)).toBe(4000)
    expect(network.calculateBackoff(3, opts)).toBe(8000)
    expect(network.calculateBackoff(4, opts)).toBe(16000)
    // Capped at maxDelay
    expect(network.calculateBackoff(5, opts)).toBe(16000)
  })

  it('8. Applies bounded jitter within ±25% range of calculated exponential backoff', () => {
    const mockRandomMin = () => 0 // Minimum jitter
    const mockRandomMax = () => 1 // Maximum jitter

    const delayMin = network.calculateBackoff(1, {
      baseDelayMs: 1000,
      factor: 2,
      jitter: true,
      jitterRatio: 0.25,
      randomFn: mockRandomMin,
    })
    const delayMax = network.calculateBackoff(1, {
      baseDelayMs: 1000,
      factor: 2,
      jitter: true,
      jitterRatio: 0.25,
      randomFn: mockRandomMax,
    })

    // For attempt 1 base is 2000ms. ±25% => [1500, 2500]
    expect(delayMin).toBe(1500)
    expect(delayMax).toBe(2500)
  })

  it('9. Smooths transport latency samples using Exponential Moving Average', () => {
    // Initial latency = 14ms
    // New sample = 50ms => round(14 * 0.75 + 50 * 0.25) = round(10.5 + 12.5) = 23ms
    const smoothed1 = network.recordLatency(50)
    expect(smoothed1).toBe(23)
    expect(network.getLatency()).toBe(23)

    // Rejects non-finite or negative latency inputs safely
    const unmutated = network.recordLatency(-10)
    expect(unmutated).toBe(23)
  })

  it('10. Handles browser online event by triggering reconnect and resetting retries', () => {
    const reconnectCallback = vi.fn()
    network.subscribeToReconnect(reconnectCallback)

    network.handleBrowserOffline()
    expect(network.getState()).toBe('OFFLINE')

    network.handleBrowserOnline()
    expect(network.getState()).toBe('RECONNECTING')
    expect(network.getRetryAttempts()).toBe(0)
    expect(reconnectCallback).toHaveBeenCalledTimes(1)
  })

  it('11. Handles browser offline event by immediately entering OFFLINE state', () => {
    network.handleBrowserOffline()
    expect(network.getState()).toBe('OFFLINE')
    expect(network.getSnapshot().isBrowserOnline).toBe(false)
  })

  it('12. Emits snapshots to subscribers on every state and latency transition', () => {
    const subscriber = vi.fn()
    const unsubscribe = network.subscribe(subscriber)

    // Initial snapshot call
    expect(subscriber).toHaveBeenCalledTimes(1)

    network.handleDisconnect()
    expect(subscriber).toHaveBeenCalledTimes(2)
    expect(subscriber.mock.calls[1][0].state).toBe('RECONNECTING')

    network.recordLatency(30)
    expect(subscriber).toHaveBeenCalledTimes(3)

    unsubscribe()
    network.handleReconnectSuccess()
    // No more calls after unsubscribe
    expect(subscriber).toHaveBeenCalledTimes(3)
  })

  it('13. Decrements countdown timer during RECONNECTING phase and auto-fires reconnect callbacks', () => {
    const reconnectCallback = vi.fn()
    network.subscribeToReconnect(reconnectCallback)

    network.handleDisconnect()
    expect(network.getState()).toBe('RECONNECTING')
    expect(network.getCountdownSec()).toBeGreaterThan(0)

    // Fast-forward fake timers past countdown
    vi.advanceTimersByTime(3000)
    expect(reconnectCallback).toHaveBeenCalled()
  })

  it('14. Destroys listeners and timers cleanly on destroy()', () => {
    const subscriber = vi.fn()
    network.subscribe(subscriber)
    network.destroy()

    network.handleDisconnect()
    // Should not trigger destroyed subscriber
    expect(subscriber).toHaveBeenCalledTimes(1) // only initial subscribe call
  })
})
