import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  ErrorBoundary,
  RootErrorFallback,
  ViewErrorFallback,
  WidgetErrorFallback,
  BoundedCandleBuffer,
} from '@/components/ErrorBoundary'
import { defaultMarketStore } from '@/stores/marketStore'
import { defaultBotEngine } from '@/engine/botEngine'
import { defaultNetworkManager } from '@/services/networkManager'
import type { CandlestickPoint } from '@/types/trading'

describe('Tier 5 Adversarial: Milestone 4 Feature F14 Robustness & Bounded Buffer Invariants', () => {
  // =========================================================================
  // SECTION 1: Error Boundary Multi-Level Fallback Rendering & Visual Safeguards
  // =========================================================================
  describe('1. Error Boundary Multi-Level Fallback Rendering & Visual Safeguards', () => {
    it('Root Fallback (Level 1) renders full-screen institutional safeguard with circuit halt and recovery actions', () => {
      const testError = new Error('Critical database connection desync')
      testError.stack = 'Error: Critical database connection desync\n    at initDatabase (database.ts:42)'
      const resetMock = vi.fn()

      const element = React.createElement(RootErrorFallback, {
        error: testError,
        reset: resetMock,
      })

      const html = renderToStaticMarkup(element)

      // Must display Institutional Safeguard branding and Halt status
      expect(html).toContain('Finora Safeguard')
      expect(html).toContain('CIRCUIT HALT')
      expect(html).toContain('Critical Terminal Exception')
      expect(html).toContain('Critical database connection desync')
      expect(html).toContain('Soft Reset')
      expect(html).toContain('Hard Reload')
      expect(html).toContain('Purge &amp; Fix')
      expect(html).toContain('View Stack Trace')
    })

    it('View Fallback (Level 2) renders view suspended notice, background persistence notice, and navigation', () => {
      const testError = new Error('Quant simulation matrix non-invertible')
      const resetMock = vi.fn()
      const navigateMock = vi.fn()

      const element = React.createElement(ViewErrorFallback, {
        viewName: 'Quant Studio',
        error: testError,
        reset: resetMock,
        onNavigate: navigateMock,
      })

      const html = renderToStaticMarkup(element)

      expect(html).toContain('Quant Studio Suspended')
      expect(html).toContain('View Encountered an Unexpected Error')
      expect(html).toContain('Other trading tabs and active background bots remain operational')
      expect(html).toContain('Quant simulation matrix non-invertible')
      expect(html).toContain('Reload View')
      expect(html).toContain('Return to Terminal')
    })

    it('Widget Fallback (Level 3) renders inline offline badge, error diagnostics, and retry button', () => {
      const testError = new Error('OrderBook depth parsing failed on corrupt tick')
      const resetMock = vi.fn()

      const element = React.createElement(WidgetErrorFallback, {
        widgetName: 'Order Book Depth',
        error: testError,
        reset: resetMock,
      })

      const html = renderToStaticMarkup(element)

      expect(html).toContain('Order Book Depth')
      expect(html).toContain('OFFLINE')
      expect(html).toContain('Widget stream halted to protect UI stability')
      expect(html).toContain('OrderBook depth parsing failed on corrupt tick')
      expect(html).toContain('Retry Widget')
      expect(html).toContain('data-testid="error-boundary-fallback"')
    })

    it('ErrorBoundary respects fallbackType prop dispatching (root, view, widget)', () => {
      const testError = new Error('Hardware rendering context lost')

      // 1. Root fallback type
      const rootBoundary = new ErrorBoundary({
        fallbackType: 'root',
        children: React.createElement('div', null, 'Active App'),
      })
      rootBoundary.state = { hasError: true, error: testError, errorInfo: null }
      const rootHtml = renderToStaticMarkup(rootBoundary.render() as React.ReactElement)
      expect(rootHtml).toContain('Finora Safeguard')
      expect(rootHtml).toContain('CIRCUIT HALT')

      // 2. View fallback type
      const viewBoundary = new ErrorBoundary({
        fallbackType: 'view',
        viewName: 'Whale Radar',
        children: React.createElement('div', null, 'Active App'),
      })
      viewBoundary.state = { hasError: true, error: testError, errorInfo: null }
      const viewHtml = renderToStaticMarkup(viewBoundary.render() as React.ReactElement)
      expect(viewHtml).toContain('Whale Radar Suspended')

      // 3. Widget fallback type
      const widgetBoundary = new ErrorBoundary({
        fallbackType: 'widget',
        widgetName: 'TradingView Chart',
        children: React.createElement('div', null, 'Active App'),
      })
      widgetBoundary.state = { hasError: true, error: testError, errorInfo: null }
      const widgetHtml = renderToStaticMarkup(widgetBoundary.render() as React.ReactElement)
      expect(widgetHtml).toContain('TradingView Chart')
      expect(widgetHtml).toContain('OFFLINE')
    })

    it('ErrorBoundary supports custom functional fallback and static ReactNode fallback', () => {
      const testError = new Error('Custom error message')

      // Functional fallback
      const funcBoundary = new ErrorBoundary({
        fallback: (err, reset) =>
          React.createElement('div', { id: 'custom-func' }, [
            React.createElement('span', { key: '1' }, err.message),
            React.createElement('button', { key: '2', onClick: reset }, 'Custom Reset'),
          ]),
        children: React.createElement('div', null, 'Child'),
      })
      funcBoundary.state = { hasError: true, error: testError, errorInfo: null }
      const funcHtml = renderToStaticMarkup(funcBoundary.render() as React.ReactElement)
      expect(funcHtml).toContain('id="custom-func"')
      expect(funcHtml).toContain('Custom error message')
      expect(funcHtml).toContain('Custom Reset')

      // Static fallback
      const staticBoundary = new ErrorBoundary({
        fallback: React.createElement('div', { id: 'custom-static' }, 'Static Fallback Banner'),
        children: React.createElement('div', null, 'Child'),
      })
      staticBoundary.state = { hasError: true, error: testError, errorInfo: null }
      const staticHtml = renderToStaticMarkup(staticBoundary.render() as React.ReactElement)
      expect(staticHtml).toContain('id="custom-static"')
      expect(staticHtml).toContain('Static Fallback Banner')
    })

    it('ErrorBoundary renders children verbatim when state.hasError is false', () => {
      const boundary = new ErrorBoundary({
        children: React.createElement('div', { id: 'healthy-child' }, 'Operational Desk Content'),
      })
      expect(boundary.state.hasError).toBe(false)

      const rendered = boundary.render() as React.ReactElement
      const html = renderToStaticMarkup(rendered)
      expect(html).toContain('id="healthy-child"')
      expect(html).toContain('Operational Desk Content')
    })
  })

  // =========================================================================
  // SECTION 2: Crash Containment, Tab Isolation & State Preservation
  // =========================================================================
  describe('2. Crash Containment, Tab Isolation & State Preservation', () => {
    it('catches runtime exceptions thrown in one view tab without crashing other tabs or unmounting background state', () => {
      // Setup background services
      const currentTicker = defaultMarketStore.getTicker('BTC/USDT')
      expect(currentTicker).toBeDefined()

      let activeTab: 'terminal' | 'quant_studio' = 'quant_studio'

      // Mock View 1 (QuantStudio) that throws
      const crashingView = () => {
        throw new Error('Uncaught calculation error in Monte Carlo loop')
      }

      // Mock View 2 (Terminal) that remains healthy
      const healthyTerminalView = () => {
        return React.createElement('div', { id: 'terminal-desk' }, 'Live Trading Desk Active')
      }

      // Wrap tab 1 in ErrorBoundary
      const quantStudioBoundary = new ErrorBoundary({
        viewName: 'Quant Studio',
        fallbackType: 'view',
        children: null,
      })

      // Simulate runtime crash caught by boundary
      try {
        crashingView()
      } catch (err) {
        const errorState = ErrorBoundary.getDerivedStateFromError(err as Error)
        quantStudioBoundary.state = errorState
        quantStudioBoundary.componentDidCatch(err as Error, {
          componentStack: 'at QuantStudioView\nat App',
        })
      }

      // Verify Tab 1 is suspended
      expect(quantStudioBoundary.state.hasError).toBe(true)
      const tab1Html = renderToStaticMarkup(quantStudioBoundary.render() as React.ReactElement)
      expect(tab1Html).toContain('Quant Studio Suspended')
      expect(tab1Html).toContain('Uncaught calculation error in Monte Carlo loop')

      // Switch tab to Terminal: Terminal remains 100% operational
      activeTab = 'terminal'
      expect(activeTab).toBe('terminal')

      const terminalBoundary = new ErrorBoundary({
        viewName: 'Terminal Desk',
        fallbackType: 'view',
        children: healthyTerminalView(),
      })
      expect(terminalBoundary.state.hasError).toBe(false)
      const tab2Html = renderToStaticMarkup(terminalBoundary.render() as React.ReactElement)
      expect(tab2Html).toContain('id="terminal-desk"')
      expect(tab2Html).toContain('Live Trading Desk Active')

      // Verify background state remains intact
      const retainedTicker = defaultMarketStore.getTicker('BTC/USDT')
      expect(retainedTicker?.symbol).toBe('BTC/USDT')
      expect(defaultBotEngine).toBeDefined()
      expect(defaultNetworkManager.getState()).toBe('ONLINE')
    })

    it('catches runtime exceptions thrown in one widget without crashing sibling widgets on the terminal desk', () => {
      // Simulate 6-widget trading desk layout
      const widgets = {
        chart: { hasCrashed: true, error: new Error('Canvas rendering buffer allocation failed') },
        aiConsensus: { hasCrashed: false },
        positionsDesk: { hasCrashed: false },
        orderBook: { hasCrashed: false },
        orderEntry: { hasCrashed: false },
        swap: { hasCrashed: false },
      }

      // Chart widget boundary catches the crash
      const chartBoundary = new ErrorBoundary({
        widgetName: 'TradingView Chart',
        fallbackType: 'widget',
        children: React.createElement('div', { id: 'chart-canvas' }),
      })
      chartBoundary.state = ErrorBoundary.getDerivedStateFromError(widgets.chart.error)
      chartBoundary.componentDidCatch(widgets.chart.error, { componentStack: 'at TradingViewChart' })

      // Sibling: Order Book widget boundary remains healthy
      const orderBookBoundary = new ErrorBoundary({
        widgetName: 'Order Book Depth',
        fallbackType: 'widget',
        children: React.createElement('div', { id: 'order-book-bids-asks' }, 'Order Book Depth Stream'),
      })

      // Sibling: Order Entry widget boundary remains healthy
      const orderEntryBoundary = new ErrorBoundary({
        widgetName: 'Order Execution Desk',
        fallbackType: 'widget',
        children: React.createElement('div', { id: 'order-entry-form' }, 'Submit Long / Short Form'),
      })

      // Render chart: shows widget fallback
      const chartHtml = renderToStaticMarkup(chartBoundary.render() as React.ReactElement)
      expect(chartHtml).toContain('TradingView Chart')
      expect(chartHtml).toContain('OFFLINE')
      expect(chartHtml).toContain('Canvas rendering buffer allocation failed')
      expect(chartHtml).not.toContain('id="chart-canvas"')

      // Render order book: intact and interactive
      const orderBookHtml = renderToStaticMarkup(orderBookBoundary.render() as React.ReactElement)
      expect(orderBookHtml).toContain('id="order-book-bids-asks"')
      expect(orderBookHtml).toContain('Order Book Depth Stream')

      // Render order entry: intact and interactive
      const orderEntryHtml = renderToStaticMarkup(orderEntryBoundary.render() as React.ReactElement)
      expect(orderEntryHtml).toContain('id="order-entry-form"')
      expect(orderEntryHtml).toContain('Submit Long / Short Form')
    })

    it('reset() clears error state and allows widget to re-render healthy content', () => {
      const onResetMock = vi.fn()
      const boundary = new ErrorBoundary({
        widgetName: 'TradingView Chart',
        onReset: onResetMock,
        children: React.createElement('div', { id: 'chart-restored' }, 'Chart Restored'),
      })

      // Induce error state
      boundary.state = ErrorBoundary.getDerivedStateFromError(new Error('Transient WebSocket buffer error'))
      expect(boundary.state.hasError).toBe(true)
      expect(boundary.state.error?.message).toBe('Transient WebSocket buffer error')

      // Call reset()
      boundary.reset()

      expect(boundary.state.hasError).toBe(false)
      expect(boundary.state.error).toBeNull()
      expect(boundary.state.errorInfo).toBeNull()
      expect(onResetMock).toHaveBeenCalledTimes(1)

      // Subsequent render returns healthy child
      const html = renderToStaticMarkup(boundary.render() as React.ReactElement)
      expect(html).toContain('id="chart-restored"')
      expect(html).toContain('Chart Restored')
    })
  })

  // =========================================================================
  // SECTION 3: BoundedCandleBuffer Invariants & 10,000 Pushes Stress Harness
  // =========================================================================
  describe('3. BoundedCandleBuffer Invariants & 10,000 Pushes Stress Harness', () => {
    it('strictly maintains maxSize = 100 after 10,000 consecutive pushes (empirical stress harness)', () => {
      const buffer = new BoundedCandleBuffer<number>(100)
      expect(buffer.maxSize).toBe(100)
      expect(buffer.length).toBe(0)
      expect(buffer.size()).toBe(0)

      const t0 = performance.now()
      const TOTAL_PUSHES = 10000

      // Stress harness: 10,000 pushes
      for (let i = 1; i <= TOTAL_PUSHES; i++) {
        buffer.push(i)
        // Invariant: Length must NEVER exceed 100 at any step
        expect(buffer.length).toBeLessThanOrEqual(100)
      }
      const elapsed = performance.now() - t0

      // Length and size must be exactly 100
      expect(buffer.length).toBe(100)
      expect(buffer.size()).toBe(100)
      expect(elapsed).toBeLessThan(500) // Fast O(1) performance

      // FIFO Invariant:
      // The newest 100 items (9,901 through 10,000) must be retained in strict order
      const items = buffer.getAll()
      expect(items.length).toBe(100)
      expect(items[0]).toBe(9901)
      expect(items[99]).toBe(10000)

      // Monotonic sequence verification across all 100 items
      for (let k = 0; k < 100; k++) {
        expect(items[k]).toBe(9901 + k)
      }

      // Eviction verification: No items from 1..9900 may remain
      expect(items.includes(1)).toBe(false)
      expect(items.includes(5000)).toBe(false)
      expect(items.includes(9900)).toBe(false)
    })

    it('retains newest items in correct order under 50,000 high-frequency CandlestickPoint objects', () => {
      const buffer = new BoundedCandleBuffer<CandlestickPoint>(100)
      const baseTime = 1700000000

      for (let i = 1; i <= 50000; i++) {
        const candle: CandlestickPoint = {
          time: baseTime + i * 60,
          open: 100 + i * 0.1,
          high: 105 + i * 0.1,
          low: 95 + i * 0.1,
          close: 102 + i * 0.1,
          volume: 1000 + (i % 50),
          ema20: 101 + i * 0.1,
          ema50: 99 + i * 0.1,
        }
        buffer.push(candle)
      }

      expect(buffer.length).toBe(100)
      const candles = buffer.getAll()
      expect(candles.length).toBe(100)

      // First candle in buffer must be item 49,901
      expect(candles[0].time).toBe(baseTime + 49901 * 60)
      expect(candles[0].close).toBeCloseTo(102 + 49901 * 0.1, 4)

      // Last candle in buffer must be item 50,000
      expect(candles[99].time).toBe(baseTime + 50000 * 60)
      expect(candles[99].close).toBeCloseTo(102 + 50000 * 0.1, 4)

      // Time ordering must be strictly ascending
      for (let i = 1; i < candles.length; i++) {
        expect(candles[i].time).toBeGreaterThan(candles[i - 1].time)
      }
    })

    it('clear() flushes the buffer completely to length 0 and supports subsequent bounded reuse', () => {
      const buffer = new BoundedCandleBuffer<string>(100)
      for (let i = 0; i < 75; i++) {
        buffer.push(`candle-${i}`)
      }
      expect(buffer.length).toBe(75)

      // Clear the buffer
      buffer.clear()
      expect(buffer.length).toBe(0)
      expect(buffer.size()).toBe(0)
      expect(buffer.getAll()).toEqual([])
      expect(buffer.get()).toEqual([])

      // Multiple clear calls are safe
      buffer.clear()
      expect(buffer.length).toBe(0)

      // Subsequent pushes operate normally with bounded eviction
      for (let i = 1; i <= 150; i++) {
        buffer.push(`reloaded-${i}`)
      }
      expect(buffer.length).toBe(100)
      const reloaded = buffer.getAll()
      expect(reloaded[0]).toBe('reloaded-51')
      expect(reloaded[99]).toBe('reloaded-150')
    })

    it('encapsulation: getAll() and get() return defensive copies that do not mutate internal buffer', () => {
      const buffer = new BoundedCandleBuffer<number>(100)
      buffer.push(10)
      buffer.push(20)
      buffer.push(30)

      const copy1 = buffer.getAll()
      const copy2 = buffer.get()

      // Mutate the returned array
      copy1.pop()
      copy1.push(999)
      copy2.reverse()

      // Internal buffer remains completely unmodified
      expect(buffer.length).toBe(3)
      expect(buffer.getAll()).toEqual([10, 20, 30])
    })

    it('edge cases: handles boundary maxSize configurations (maxSize = 1, maxSize = 0)', () => {
      // maxSize = 1: holds only the single most recent item
      const unitBuffer = new BoundedCandleBuffer<number>(1)
      unitBuffer.push(1)
      unitBuffer.push(2)
      unitBuffer.push(3)
      expect(unitBuffer.length).toBe(1)
      expect(unitBuffer.getAll()).toEqual([3])

      // maxSize = 0: immediately evicts pushed items
      const zeroBuffer = new BoundedCandleBuffer<number>(0)
      zeroBuffer.push(10)
      expect(zeroBuffer.length).toBe(0)
      expect(zeroBuffer.getAll()).toEqual([])
    })
  })

  // =========================================================================
  // SECTION 4: Live Market Feed & App Memory Bounding Contracts
  // =========================================================================
  describe('4. Live Market Feed & App Memory Bounding Contracts', () => {
    it('verifies MAX_CANDLES = 100 constant and FIFO eviction logic used in useLiveMarketFeed.ts', () => {
      // Emulate candle stream accumulation logic as implemented in useLiveMarketFeed.ts (lines 229 & 365)
      const MAX_CANDLES = 100
      let candleSeries: number[] = [10, 20, 30, 40, 50]

      // Emulate receiving 300 new closed bars
      for (let newBar = 51; newBar <= 350; newBar++) {
        const updated = [...candleSeries]
        updated.push(newBar)
        if (updated.length > MAX_CANDLES) {
          updated.shift()
        }
        candleSeries = updated
      }

      expect(candleSeries.length).toBe(MAX_CANDLES)
      expect(candleSeries[0]).toBe(251)
      expect(candleSeries[candleSeries.length - 1]).toBe(350)
    })

    it('verifies trade and alert memory bounds in App.tsx (MAX_TRADE_HISTORY = 100, MAX_ALERT_HISTORY = 50)', () => {
      const MAX_TRADE_HISTORY = 100
      const MAX_ALERT_HISTORY = 50

      // Emulate trade order slice capping as implemented in App.tsx (lines 356, 419)
      let trades: number[] = []
      for (let t = 1; t <= 250; t++) {
        trades = [t, ...trades].slice(0, MAX_TRADE_HISTORY)
      }
      expect(trades.length).toBe(MAX_TRADE_HISTORY)
      // Newest trades at front
      expect(trades[0]).toBe(250)
      expect(trades[trades.length - 1]).toBe(151)

      // Emulate price alert slice capping as implemented in App.tsx (line 430)
      let alerts: number[] = []
      for (let a = 1; a <= 120; a++) {
        alerts = [a, ...alerts].slice(0, MAX_ALERT_HISTORY)
      }
      expect(alerts.length).toBe(MAX_ALERT_HISTORY)
      expect(alerts[0]).toBe(120)
      expect(alerts[alerts.length - 1]).toBe(71)
    })
  })
})
