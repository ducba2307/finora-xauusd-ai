/**
 * Institutional Network State Machine & Telemetry Manager (F15)
 * 
 * Manages:
 * - 3-State Connection Lifecycle: ONLINE | RECONNECTING | OFFLINE
 * - Exponential backoff with bounded jitter (1s -> 2s -> 4s -> 8s -> 16s)
 * - Browser online/offline window event listeners
 * - Live transport latency smoothing (EMA)
 * - 1Hz Reconnection countdown timer
 * - Pub/Sub subscription model for UI and WebSockets
 */

export type NetworkState = 'ONLINE' | 'RECONNECTING' | 'OFFLINE'

export interface BackoffOptions {
  baseDelayMs?: number
  factor?: number
  maxDelayMs?: number
  jitter?: boolean
  jitterRatio?: number
  randomFn?: () => number
}

export interface NetworkSnapshot {
  state: NetworkState
  latencyMs: number
  retryAttempts: number
  maxRetries: number
  countdownSec: number
  isBrowserOnline: boolean
  lastConnectedTimestamp: number | null
}

export type NetworkListener = (snapshot: NetworkSnapshot) => void
export type ReconnectCallback = () => void

export class NetworkStateMachine {
  private currentState: NetworkState = 'ONLINE'
  private retryAttempts: number = 0
  private maxRetries: number = 5
  private latencyMs: number = 14
  private countdownSec: number = 0
  private lastConnectedTimestamp: number | null = Date.now()
  private isBrowserOnline: boolean = true

  // Timers
  private countdownTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null

  // Listeners
  private listeners: Set<NetworkListener> = new Set()
  private reconnectCallbacks: Set<ReconnectCallback> = new Set()

  // Window event listener references for cleanup
  private windowOnlineHandler: (() => void) | null = null
  private windowOfflineHandler: (() => void) | null = null

  constructor(options?: { maxRetries?: number; initialLatencyMs?: number }) {
    if (options?.maxRetries !== undefined) {
      this.maxRetries = options.maxRetries
    }
    if (options?.initialLatencyMs !== undefined) {
      this.latencyMs = options.initialLatencyMs
    }

    this.initBrowserListeners()
  }

  private initBrowserListeners(): void {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      this.isBrowserOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
      if (!this.isBrowserOnline) {
        this.currentState = 'OFFLINE'
      }

      this.windowOnlineHandler = () => this.handleBrowserOnline()
      this.windowOfflineHandler = () => this.handleBrowserOffline()

      window.addEventListener('online', this.windowOnlineHandler)
      window.addEventListener('offline', this.windowOfflineHandler)
    }
  }

  // --- Core State Machine API (Matches Contract & Tests) ---

  getState(): NetworkState {
    return this.currentState
  }

  getRetryAttempts(): number {
    return this.retryAttempts
  }

  getMaxRetries(): number {
    return this.maxRetries
  }

  getLatency(): number {
    return this.latencyMs
  }

  getCountdownSec(): number {
    return this.countdownSec
  }

  getSnapshot(): NetworkSnapshot {
    return {
      state: this.currentState,
      latencyMs: this.latencyMs,
      retryAttempts: this.retryAttempts,
      maxRetries: this.maxRetries,
      countdownSec: this.countdownSec,
      isBrowserOnline: this.isBrowserOnline,
      lastConnectedTimestamp: this.lastConnectedTimestamp,
    }
  }

  handleDisconnect(): void {
    this.retryAttempts++
    if (this.retryAttempts >= this.maxRetries) {
      this.currentState = 'OFFLINE'
      this.stopCountdown()
    } else {
      this.currentState = 'RECONNECTING'
      this.startCountdownForAttempt(this.retryAttempts - 1)
    }
    this.notify()
  }

  handleReconnectSuccess(): void {
    this.currentState = 'ONLINE'
    this.retryAttempts = 0
    this.lastConnectedTimestamp = Date.now()
    this.stopCountdown()
    this.notify()
  }

  forceOffline(): void {
    this.currentState = 'OFFLINE'
    this.stopCountdown()
    this.notify()
  }

  // --- Exponential Backoff with Bounded Jitter ---

  calculateBackoff(attempt: number, options?: BackoffOptions): number {
    const baseDelay = options?.baseDelayMs ?? 1000
    const factor = options?.factor ?? 2
    const maxDelay = options?.maxDelayMs ?? 16000
    const applyJitter = options?.jitter ?? true
    const jitterRatio = options?.jitterRatio ?? 0.25
    const randomFn = options?.randomFn ?? Math.random

    const safeAttempt = Math.max(0, attempt)
    const exponential = baseDelay * Math.pow(factor, safeAttempt)
    const capped = Math.min(maxDelay, exponential)

    if (!applyJitter) {
      return capped
    }

    // Bounded jitter: capped ± (jitterRatio * capped)
    const jitterMagnitude = capped * jitterRatio
    const jitterNoise = (randomFn() * 2 - 1) * jitterMagnitude
    const result = Math.max(baseDelay * 0.5, capped + jitterNoise)
    return Math.round(Math.min(maxDelay, result))
  }

  private startCountdownForAttempt(attemptIdx: number): void {
    this.stopCountdown()
    const delayMs = this.calculateBackoff(attemptIdx)
    this.countdownSec = Math.max(1, Math.ceil(delayMs / 1000))

    this.countdownTimer = setInterval(() => {
      this.countdownSec--
      if (this.countdownSec <= 0) {
        this.stopCountdown()
        this.fireReconnectCallbacks()
      }
      this.notify()
    }, 1000)
  }

  private stopCountdown(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer)
      this.countdownTimer = null
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    this.countdownSec = 0
  }

  // --- Manual & Automated Reconnection Actions ---

  reconnectNow(): void {
    this.stopCountdown()
    this.retryAttempts = 0
    this.currentState = 'RECONNECTING'
    this.countdownSec = 0
    this.notify()
    this.fireReconnectCallbacks()
  }

  subscribeToReconnect(callback: ReconnectCallback): () => void {
    this.reconnectCallbacks.add(callback)
    return () => {
      this.reconnectCallbacks.delete(callback)
    }
  }

  private fireReconnectCallbacks(): void {
    this.reconnectCallbacks.forEach((cb) => {
      try {
        cb()
      } catch {
        // Guard callback errors
      }
    })
  }

  // --- Browser Events Integration ---

  handleBrowserOnline(): void {
    this.isBrowserOnline = true
    this.reconnectNow()
  }

  handleBrowserOffline(): void {
    this.isBrowserOnline = false
    this.forceOffline()
  }

  // --- Transport Latency Telemetry (EMA Smoothing) ---

  recordLatency(sampleMs: number): number {
    if (!Number.isFinite(sampleMs) || sampleMs <= 0) {
      return this.latencyMs
    }

    // Bounded sample (1ms to 2000ms)
    const boundedSample = Math.max(1, Math.min(2000, sampleMs))
    // EMA smoothing: 75% previous + 25% new sample
    this.latencyMs = Math.round(this.latencyMs * 0.75 + boundedSample * 0.25)
    this.notify()
    return this.latencyMs
  }

  // --- Subscription Pub/Sub ---

  subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener)
    listener(this.getSnapshot())
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    const snap = this.getSnapshot()
    this.listeners.forEach((fn) => {
      try {
        fn(snap)
      } catch {
        // Guard listener errors
      }
    })
  }

  destroy(): void {
    this.stopCountdown()
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      if (this.windowOnlineHandler) {
        window.removeEventListener('online', this.windowOnlineHandler)
      }
      if (this.windowOfflineHandler) {
        window.removeEventListener('offline', this.windowOfflineHandler)
      }
    }
    this.listeners.clear()
    this.reconnectCallbacks.clear()
  }
}

/**
 * Global singleton network manager instance for Finora platform
 */
export const defaultNetworkManager = new NetworkStateMachine()
