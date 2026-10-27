import { describe, it, expect, vi } from 'vitest'
import {
  ErrorBoundary,
  BoundedCandleBuffer,
  NetworkStateMachine,
} from '@/components/ErrorBoundary'
import React from 'react'

describe('Tier 1: F14-F15 Error Boundaries & Production SaaS Hardening', () => {
  it('F14: ErrorBoundary state machine captures widget errors and exposes reset', () => {
    const errorState = ErrorBoundary.getDerivedStateFromError(new Error('Market stream dropped'))
    expect(errorState.hasError).toBe(true)
    expect(errorState.error?.message).toBe('Market stream dropped')

    const boundary = new ErrorBoundary({ children: null })
    boundary.state = errorState
    expect(boundary.state.hasError).toBe(true)

    // Resetting should restore healthy state
    boundary.reset()
    expect(boundary.state.hasError).toBe(false)
    expect(boundary.state.error).toBeNull()
  })

  it('F14: ErrorBoundary triggers onError callback reporting diagnostics', () => {
    const onErrorMock = vi.fn()
    const boundary = new ErrorBoundary({
      children: null,
      onError: onErrorMock,
    })

    const testError = new Error('Division by zero in chart scaling')
    const errorInfo: React.ErrorInfo = { componentStack: 'at ChartWidget\nat TradingDashboard' }

    boundary.componentDidCatch(testError, errorInfo)
    expect(onErrorMock).toHaveBeenCalledWith(testError, errorInfo)
  })

  it('F14: BoundedCandleBuffer bounds candle series to MAX_CANDLES (100) preventing memory leaks', () => {
    const maxCandles = 100
    const buffer = new BoundedCandleBuffer<number>(maxCandles)

    // Push 250 incoming ticks/candles
    for (let i = 1; i <= 250; i++) {
      buffer.push(i)
    }

    // Buffer length must strictly not exceed 100
    expect(buffer.length).toBe(100)
    expect(buffer.maxSize).toBe(100)

    // Oldest items (1..150) should be cleanly evicted; newest (151..250) retained
    const items = buffer.getAll()
    expect(items[0]).toBe(151)
    expect(items[items.length - 1]).toBe(250)
  })

  it('F14: BoundedCandleBuffer clear() flushes accumulated data on symbol switch', () => {
    const buffer = new BoundedCandleBuffer<string>(50)
    buffer.push('BTC_1')
    buffer.push('BTC_2')
    expect(buffer.length).toBe(2)

    buffer.clear()
    expect(buffer.length).toBe(0)
    expect(buffer.getAll()).toEqual([])
  })

  it('F15: NetworkStateMachine manages 3-state transitions (ONLINE -> RECONNECTING -> OFFLINE)', () => {
    const network = new NetworkStateMachine()
    expect(network.getState()).toBe('ONLINE')

    // On disconnect, transitions to RECONNECTING
    network.handleDisconnect()
    expect(network.getState()).toBe('RECONNECTING')

    // If reconnect succeeds, transitions back to ONLINE
    network.handleReconnectSuccess()
    expect(network.getState()).toBe('ONLINE')

    // If consecutive retries exceed max limit, transitions to OFFLINE
    for (let i = 0; i < 5; i++) {
      network.handleDisconnect()
    }
    expect(network.getState()).toBe('OFFLINE')
  })
})
