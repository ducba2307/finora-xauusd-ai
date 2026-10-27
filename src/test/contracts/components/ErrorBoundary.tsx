// oxlint-disable react/only-export-components, react/no-direct-mutation-state
/**
 * Production Error Boundary & SaaS Buffer Management Contract

 * Authoritative reference derived from PROJECT.md (F14, F15) and ORIGINAL_REQUEST.md (R4)
 */

import React, { Component, type ReactNode } from 'react'

export interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode)
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  reset = () => {
    this.state = { hasError: false, error: null }
    // Only call setState if component is mounted in React DOM tree
    if ((this as any)._reactInternals || (this as any).updater?.isMounted?.(this)) {
      this.setState({ hasError: false, error: null })
    }
  }

  render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error || new Error('Unknown error'), this.reset)
      }
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <div data-testid="error-boundary-fallback" className="p-4 border border-rose-500/30 rounded-lg bg-rose-500/10 text-rose-300">
          <p className="font-semibold">Something went wrong in this widget.</p>
          <p className="text-xs text-rose-400 mt-1">{this.state.error?.message}</p>
          <button
            onClick={this.reset}
            className="mt-3 px-3 py-1 bg-rose-600 text-white text-xs rounded hover:bg-rose-500 cursor-pointer"
          >
            Retry Widget
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Bounded Candle Buffer Manager (F14)
 * Prevents memory leaks by maintaining max 100 candles
 */
export class BoundedCandleBuffer<T> {
  private buffer: T[] = []
  readonly maxSize: number

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize
  }

  push(item: T): void {
    this.buffer.push(item)
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift() // Evict oldest
    }
  }

  getAll(): T[] {
    return [...this.buffer]
  }

  get length(): number {
    return this.buffer.length
  }

  clear(): void {
    this.buffer = []
  }
}

/**
 * 3-State Network State Machine (F15)
 */
export type NetworkState = 'ONLINE' | 'RECONNECTING' | 'OFFLINE'

export class NetworkStateMachine {
  private currentState: NetworkState = 'ONLINE'
  private retryAttempts: number = 0
  private maxRetries: number = 5

  getState(): NetworkState {
    return this.currentState
  }

  handleDisconnect(): void {
    this.currentState = 'RECONNECTING'
    this.retryAttempts++
    if (this.retryAttempts >= this.maxRetries) {
      this.currentState = 'OFFLINE'
    }
  }

  handleReconnectSuccess(): void {
    this.currentState = 'ONLINE'
    this.retryAttempts = 0
  }

  forceOffline(): void {
    this.currentState = 'OFFLINE'
  }
}
