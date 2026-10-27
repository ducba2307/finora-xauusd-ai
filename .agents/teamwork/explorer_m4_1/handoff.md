# Handoff Report: Feature F14 — Multi-Level Error Boundaries & Bounded Memory Buffers

**Agent**: `explorer_m4_1`  
**Working Directory**: `d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m4_1`  
**Target Milestone**: Milestone 4 (Production Reliability, Error Boundaries & SaaS Hardening)  
**Feature Scope**: F14 (Multi-Level Error Boundaries & Bounded Memory Buffers)  
**Date**: 2026-10-11T21:15:00Z  

---

## 1. Observation

Direct code examination and testing across `d:\VIBECODE\finora-trading-ai` revealed the following:

### 1.1 Existing Error Boundary & Fallback Gaps
- **Missing Production `ErrorBoundary.tsx`**: `src/components/ErrorBoundary.tsx` does not exist in `src/components/`. Currently, the test suite relies on `src/test/contracts/components/ErrorBoundary.tsx` via `vitest.config.ts` fallback resolver (`contractFallbackPlugin`). Production build (`tsc -b && vite build`) will not find `src/components/ErrorBoundary.tsx` if imported by production source code without creating it in `src/components/`.
- **Root Layer (`src/main.tsx`)**: Lines 6–10 render `<App />` directly inside `<StrictMode>` with zero error boundary protection:
  ```tsx
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  ```
  Any uncaught error during initial rendering causes an unhandled React crash, rendering a blank white screen.
- **View Layer (`src/App.tsx`)**: Lines 454–507 render views directly via condition checks without error boundary isolation:
  ```tsx
  <main className="flex-1">
    {currentView === 'landing' && <LandingPage ... />}
    {currentView === 'terminal' && <TradingDashboard ... />}
    {currentView === 'quant_studio' && <QuantStudioView ... />}
    {currentView === 'journal' && <TradingJournalView ... />}
    {currentView === 'ai_intel' && <AIIntelligenceView />}
    {currentView === 'trader_tools' && <TraderToolsView ... />}
    {currentView === 'whale_radar' && <WhaleRadarView />}
    {currentView === 'portfolio' && <PortfolioView ... />}
  </main>
  ```
  An error in one view (such as SVG rendering or chart initialization in `QuantStudioView` or `TradingJournalView`) cascades up and crashes the entire application shell, killing background bot loops and disconnecting live WebSocket streams.
- **Widget Layer (`src/components/TradingDashboard.tsx`)**:
  - `TradingViewChart` (lines 280–293)
  - `AISwarmConsensusWidget` (lines 296–307)
  - `PositionsTable` & Tabs (lines 344–440)
  - `OrderBookWidget` (lines 445–452)
  - `OrderEntryWidget` (lines 456–466)
  - `SwapWidget` (lines 468–473)
  All 6 critical trading widgets are rendered without widget-level error boundaries. A rendering exception in the canvas chart or order book unmounts the entire terminal desk.

### 1.2 Memory Buffering & Bounded Cache Status
- **Test Invariant (`src/test/tier1_features/errorBoundaries.test.ts`)**:
  - Lines 39–56 verify `BoundedCandleBuffer<T>(maxCandles = 100)` strictly evicts oldest candles when `length > 100`, retaining the newest 100 items.
  - Lines 58–67 verify `BoundedCandleBuffer.clear()` flushes accumulated data on symbol switch.
  - Lines 69–86 verify `NetworkStateMachine` transitions: `ONLINE` -> `RECONNECTING` (up to 5 retries) -> `OFFLINE`, and recovers to `ONLINE` on success.
- **Bot Engine (`src/engine/botEngine.ts`)**:
  - Line 269 defines `public readonly MAX_HISTORY_LEN = 100`.
  - Lines 357–360 strictly enforce `if (history.length > this.MAX_HISTORY_LEN) { history.shift() }`.
  - Verified by `src/test/unit/botEngine.test.ts` and `src/test/adversarial_challenger_m3.test.ts` (passing 50,000 rapid ticks).
- **Streaming Candle Feed (`src/hooks/useLiveMarketFeed.ts`)**:
  - Line 54 initializes `GENERATE_CANDLESTICK_SERIES(symbol, timeframe, 80)` (80 candles).
  - Line 209 (GBM fallback) pushes new bars via `updated.push(...)` without an upper bound check.
  - Line 332 (Binance WebSocket) pushes new bars via `updated.push(...)` without an upper bound check.
  - **Memory Leak Vulnerability**: Long-running browser sessions continuously append new bars, leading to unbounded array growth.
- **Account Trades & Alerts (`src/App.tsx`)**:
  - Trade order array `trades` accumulates new items on bot executions (line 138), position settlements (line 211), swap executions (line 343), and manual closures (line 406) via `setTrades((prev) => [newTrade, ...prev])` without `.slice(0, MAX_TRADES)`.
  - Alerts array `alerts` appends without cap via `setAlerts((prev) => [created, ...prev])` (line 417).

### 1.3 Baseline Test Status
- `pnpm test` executed across all 30 test files: **276/276 tests passing** (0 failures).
- `pnpm test src/test/tier1_features/errorBoundaries.test.ts`: **5/5 tests passing**.
- `pnpm build` (`tsc -b && vite build`): Succeeded in 365ms.

---

## 2. Logic Chain

1. **Hierarchy Isolation Principle**:
   - Web application failures must be isolated to the lowest possible scope to maximize SaaS availability.
   - A widget error (e.g. malformed L2 depth level) should only disable that widget with an inline "Retry" button.
   - A view error (e.g. SVG path calculation error in Trading Journal) should only disable that tab with a "Reset View" or "Return to Terminal" button, leaving `<Navbar>`, active bots, and notifications intact.
   - A root error (e.g. fatal initialization failure in React tree) must show an institutional recovery screen with diagnostic telemetry and hard reload / soft reset controls rather than a blank white screen.

2. **Drop-in Component Compatibility**:
   - `src/components/ErrorBoundary.tsx` must be placed in `src/components/` and export:
     1. `ErrorBoundary` (class component with `getDerivedStateFromError`, `componentDidCatch`, `reset`, and `render`)
     2. `RootErrorFallback`, `ViewErrorFallback`, `WidgetErrorFallback` (specialized UI)
     3. `BoundedCandleBuffer<T>` (memory-safe queue with eviction at `maxSize = 100`)
     4. `NetworkStateMachine` (3-state connection supervisor)
   - This satisfies both the Vitest unit tests in `src/test/tier1_features/errorBoundaries.test.ts` and the production Vite bundle compiler.

3. **Memory Bounding Principle**:
   - By enforcing `MAX_CANDLES = 100` in `useLiveMarketFeed.ts`, incoming closed candles evict the oldest candle with `if (updated.length > 100) updated.shift()`.
   - By capping `trades` to `MAX_TRADE_HISTORY = 100` and `alerts` to `MAX_ALERT_HISTORY = 50` in `App.tsx`, memory footprint remains strictly $O(1)$ throughout continuous multi-hour streaming.

---

## 3. Caveats

- **NetworkStateMachine Integration**: While `NetworkStateMachine` is tested and verified as an exported class in `ErrorBoundary.tsx`, its visual indicator in Navbar is part of Feature F15 (`Network State Machine & Active Alerts`). The blueprint exports `NetworkStateMachine` and `NetworkState` so F15 can wire it immediately.
- **SVG Coordinate Safety**: Milestone 2 already secured SVG denominators in `QuantStudioView.tsx` (`eqDenom = length > 1 ? length - 1 : 1`) and `TradingJournalView.tsx`. In `TradingDashboard.tsx` line 399 and `TradingChart.tsx` line 43, `(dataPoints.length - 1)` should also use `Math.max(1, dataPoints.length - 1)` for defense-in-depth.
- **Read-Only Explorer Constraint**: In accordance with the Explorer archetype instructions, no source files were mutated. All blueprints below are complete, copy-paste drop-in implementations for the implementer agent.

---

## 4. Conclusion & Blueprints

### Blueprint 1: `src/components/ErrorBoundary.tsx`
Create this complete file at `d:\VIBECODE\finora-trading-ai\src\components\ErrorBoundary.tsx`:

```tsx
/**
 * Finora Institutional Error Boundary & SaaS Buffer Management System
 * Conforms to F14 & F15 requirements from PROJECT.md and ORIGINAL_REQUEST.md (R4).
 */

import React, { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, RotateCcw, ShieldAlert, Terminal, Layers } from 'lucide-react'

// ==========================================
// 1. Error Boundary Contracts & Component
// ==========================================

export interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode)
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  name?: string
}

export interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo?: React.ErrorInfo | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo })
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  reset = () => {
    this.state = { hasError: false, error: null, errorInfo: null }
    // Safe setState execution if mounted in active React DOM fiber
    if ((this as any)._reactInternals || (this as any).updater?.isMounted?.(this)) {
      this.setState({ hasError: false, error: null, errorInfo: null })
    }
  }

  render() {
    if (this.state.hasError) {
      const currentError = this.state.error || new Error('Unknown runtime error')

      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(currentError, this.reset)
      }
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default widget fallback compliant with errorBoundaries.test.ts
      return (
        <div
          data-testid="error-boundary-fallback"
          className="p-4 border border-rose-500/30 rounded-xl bg-[#120a10] text-rose-300 shadow-lg"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <p className="font-semibold text-xs tracking-wide uppercase text-rose-300">
              {this.props.name ? `${this.props.name} Module Error` : 'Widget Error'}
            </p>
          </div>
          <p className="text-xs text-rose-400 font-mono mt-1 break-all bg-black/40 p-2 rounded-lg border border-rose-500/10">
            {currentError.message}
          </p>
          <button
            onClick={this.reset}
            className="mt-3 px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-md"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Widget</span>
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

// ==========================================
// 2. Specialized Fallback Components
// ==========================================

/**
 * Root / Global Error Fallback UI (Level 1)
 */
export function RootErrorFallback({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  const handleHardReload = () => {
    window.location.reload()
  }

  const handlePurgeAndRecover = () => {
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {
      // ignore storage access errors
    }
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-[#07080c] text-white flex flex-col items-center justify-center p-6 select-none">
      <div className="max-w-xl w-full bg-[#0d101a] border border-rose-500/30 rounded-3xl p-8 shadow-[0_0_80px_rgba(244,63,94,0.15)] relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-pink-500 to-indigo-500" />
        
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-inner">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold tracking-widest uppercase text-rose-400">Finora Safeguard</span>
              <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/30 font-mono">CIRCUIT HALT</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white mt-0.5">Critical Terminal Exception</h1>
          </div>
        </div>

        <p className="text-xs text-gray-300 leading-relaxed mb-4">
          The Finora Execution Safeguard halted the rendering cycle to prevent corrupted orders, stale pricing, or desynchronized balance sheet states.
        </p>

        <div className="bg-black/50 border border-white/10 rounded-2xl p-4 mb-6 text-xs font-mono text-rose-300 overflow-x-auto max-h-40">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 font-sans">Diagnostic Message:</div>
          <div className="break-all">{error.message || 'Unknown runtime error'}</div>
          {error.stack && (
            <details className="mt-2 text-[10px] text-gray-500">
              <summary className="cursor-pointer hover:text-gray-400">View Stack Trace</summary>
              <pre className="mt-2 whitespace-pre-wrap leading-tight">{error.stack}</pre>
            </details>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={reset}
            className="px-4 py-2.5 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-pink-600/20"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Soft Reset</span>
          </button>
          <button
            onClick={handleHardReload}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all border border-white/10"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Hard Reload</span>
          </button>
          <button
            onClick={handlePurgeAndRecover}
            className="px-4 py-2.5 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all border border-rose-500/20"
          >
            <span>Purge &amp; Fix</span>
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * View-Level Error Fallback UI (Level 2)
 */
export function ViewErrorFallback({
  viewName,
  error,
  reset,
  onNavigate,
}: {
  viewName: string
  error: Error
  reset: () => void
  onNavigate?: () => void
}) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4 shadow-xl">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <span className="text-xs font-mono font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20 mb-2">
        {viewName} Suspended
      </span>
      <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">View Encountered an Unexpected Error</h2>
      <p className="text-sm text-gray-400 max-w-md mb-4">
        Other trading tabs and active background bots remain operational. You can restart this view or navigate back to the Terminal desk.
      </p>
      
      <div className="bg-[#0b0e17] border border-rose-500/20 rounded-xl p-3 max-w-lg w-full mb-6 text-xs text-rose-300 font-mono text-left break-all">
        {error.message}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="px-4 py-2.5 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer transition-all shadow-md shadow-pink-600/20"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reload View</span>
        </button>
        {onNavigate && (
          <button
            onClick={onNavigate}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer transition-all border border-white/10"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Return to Terminal</span>
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Widget-Level Error Fallback UI (Level 3)
 */
export function WidgetErrorFallback({
  widgetName,
  error,
  reset,
}: {
  widgetName: string
  error: Error
  reset: () => void
}) {
  return (
    <div
      data-testid="error-boundary-fallback"
      className="fin-card p-5 border border-rose-500/30 bg-[#100a12] text-rose-200 flex flex-col justify-between h-full min-h-[220px]"
    >
      <div>
        <div className="flex items-center justify-between pb-2 border-b border-rose-500/20 mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-rose-400" />
            <span className="font-bold text-xs uppercase tracking-wide text-white">{widgetName}</span>
          </div>
          <span className="text-[10px] font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
            OFFLINE
          </span>
        </div>
        <p className="text-xs text-gray-300 mb-2">Widget stream halted to protect UI stability.</p>
        <div className="bg-black/60 p-2.5 rounded-lg border border-rose-500/20 text-[11px] font-mono text-rose-300 break-all mb-4">
          {error.message}
        </div>
      </div>

      <button
        onClick={reset}
        className="w-full py-2 bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Retry Widget</span>
      </button>
    </div>
  )
}

// ==========================================
// 3. Bounded Candle Buffer Manager (F14)
// ==========================================

export class BoundedCandleBuffer<T> {
  private buffer: T[] = []
  readonly maxSize: number

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize
  }

  push(item: T): void {
    this.buffer.push(item)
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift() // Evict oldest candle
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

// ==========================================
// 4. 3-State Network State Machine (F15)
// ==========================================

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
```

---

### Blueprint 2: `src/main.tsx` Integration (Level 1 Root)
Wrap `<App />` with `<ErrorBoundary fallback={(err, reset) => <RootErrorFallback error={err} reset={reset} />}>`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary, RootErrorFallback } from './components/ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallback={(error, reset) => <RootErrorFallback error={error} reset={reset} />}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
```

---

### Blueprint 3: `src/App.tsx` Integration (Level 2 Views & Bounded History)

In `src/App.tsx`:
1. Import `ErrorBoundary` and `ViewErrorFallback`:
   ```tsx
   import { ErrorBoundary, ViewErrorFallback } from './components/ErrorBoundary'
   ```
2. Define history buffer size constants:
   ```tsx
   const MAX_TRADE_HISTORY = 100
   const MAX_ALERT_HISTORY = 50
   ```
3. Wrap all view router cases in `<main>`:
   ```tsx
   {/* Main View Router */}
   <main className="flex-1">
     {currentView === 'landing' && (
       <ErrorBoundary
         name="Landing Page"
         fallback={(err, reset) => (
           <ViewErrorFallback viewName="Landing Page" error={err} reset={reset} onNavigate={() => setCurrentView('terminal')} />
         )}
       >
         <LandingPage
           onLaunchApp={() => setCurrentView('terminal')}
           onOpenCopilot={() => setIsCopilotOpen(true)}
         />
       </ErrorBoundary>
     )}

     {currentView === 'terminal' && (
       <ErrorBoundary
         name="Terminal Desk"
         fallback={(err, reset) => (
           <ViewErrorFallback viewName="Trading Terminal" error={err} reset={reset} onNavigate={() => setCurrentView('terminal')} />
         )}
       >
         <TradingDashboard
           assets={assets}
           portfolio={portfolio}
           trades={trades}
           bots={bots}
           positions={positions}
           onOpenCopilot={() => setIsCopilotOpen(true)}
           onOpenBotManager={() => setIsBotManagerOpen(true)}
           onOpenApiKeys={() => setIsApiKeysOpen(true)}
           onOpenAlerts={(sym, p) => {
             setAlertTarget({ symbol: sym, price: p })
             setIsAlertsOpen(true)
           }}
           onExecuteSwap={handleExecuteSwap}
           onOrderPlaced={handleOrderPlaced}
           onClosePosition={handleClosePosition}
           tradingMode={tradingMode}
           balanceSheet={balanceSheet}
         />
       </ErrorBoundary>
     )}

     {currentView === 'quant_studio' && (
       <ErrorBoundary
         name="Quant Studio"
         fallback={(err, reset) => (
           <ViewErrorFallback viewName="AI Quant Studio" error={err} reset={reset} onNavigate={() => setCurrentView('terminal')} />
         )}
       >
         <QuantStudioView balanceSheet={balanceSheet} />
       </ErrorBoundary>
     )}

     {currentView === 'journal' && (
       <ErrorBoundary
         name="Trading Journal"
         fallback={(err, reset) => (
           <ViewErrorFallback viewName="Trading Journal" error={err} reset={reset} onNavigate={() => setCurrentView('terminal')} />
         )}
       >
         <TradingJournalView currentAccountBalance={portfolio.totalBalance} />
       </ErrorBoundary>
     )}

     {currentView === 'ai_intel' && (
       <ErrorBoundary
         name="AI Intelligence"
         fallback={(err, reset) => (
           <ViewErrorFallback viewName="AI Market Intelligence" error={err} reset={reset} onNavigate={() => setCurrentView('terminal')} />
         )}
       >
         <AIIntelligenceView />
       </ErrorBoundary>
     )}

     {currentView === 'trader_tools' && (
       <ErrorBoundary
         name="Trader Tools"
         fallback={(err, reset) => (
           <ViewErrorFallback viewName="Trader Tools" error={err} reset={reset} onNavigate={() => setCurrentView('terminal')} />
         )}
       >
         <TraderToolsView currentAccountBalance={portfolio.totalBalance} />
       </ErrorBoundary>
     )}

     {currentView === 'whale_radar' && (
       <ErrorBoundary
         name="Whale Radar"
         fallback={(err, reset) => (
           <ViewErrorFallback viewName="Whale Radar" error={err} reset={reset} onNavigate={() => setCurrentView('terminal')} />
         )}
       >
         <WhaleRadarView />
       </ErrorBoundary>
     )}

     {currentView === 'portfolio' && (
       <ErrorBoundary
         name="Portfolio"
         fallback={(err, reset) => (
           <ViewErrorFallback viewName="Portfolio Desk" error={err} reset={reset} onNavigate={() => setCurrentView('terminal')} />
         )}
       >
         <PortfolioView portfolio={portfolio} balanceSheet={balanceSheet} />
       </ErrorBoundary>
     )}
   </main>
   ```
4. Bound `trades` state updates:
   - Line 138 (bot fills):
     `setTrades((prev) => [result.executedTrade!, ...prev].slice(0, MAX_TRADE_HISTORY))`
   - Line 211 (TP/SL/Liquidation settlement):
     `setTrades((prev) => [settlement.closedTrade, ...prev].slice(0, MAX_TRADE_HISTORY))`
   - Line 343 (swap completion):
     `setTrades((prev) => [newTrade, ...prev].slice(0, MAX_TRADE_HISTORY))`
   - Line 406 (manual close):
     `setTrades((prev) => [closeTrade, ...prev].slice(0, MAX_TRADE_HISTORY))`
5. Bound `alerts` state updates:
   - Line 417 (new alert):
     `setAlerts((prev) => [created, ...prev].slice(0, MAX_ALERT_HISTORY))`

---

### Blueprint 4: `src/components/TradingDashboard.tsx` Integration (Level 3 Widgets)

In `src/components/TradingDashboard.tsx`:
1. Import `ErrorBoundary` and `WidgetErrorFallback`:
   ```tsx
   import { ErrorBoundary, WidgetErrorFallback } from './ErrorBoundary'
   ```
2. Wrap `TradingViewChart` (lines 280–293):
   ```tsx
   <ErrorBoundary
     name="Interactive Trading Chart"
     fallback={(err, reset) => (
       <WidgetErrorFallback widgetName="Interactive Trading Chart" error={err} reset={reset} />
     )}
   >
     <TradingViewChart
       symbol={selectedAsset.symbol}
       currentPrice={liveFeed.currentPrice}
       change24h={liveFeed.change24h}
       candles={liveFeed.candles}
       timeframe={timeframe}
       onTimeframeChange={handleTimeframeChange}
       showAiSignals={showAiSignals}
       onToggleAiSignals={() => setShowAiSignals(!showAiSignals)}
       connectionStatus={liveFeed.connectionStatus}
       latencyMs={liveFeed.latencyMs}
       activePositions={positions}
       onOpenAlerts={() => onOpenAlerts?.(selectedAsset.symbol, liveFeed.currentPrice)}
     />
   </ErrorBoundary>
   ```
3. Wrap `AISwarmConsensusWidget` (lines 296–307):
   ```tsx
   <ErrorBoundary
     name="AI Swarm Consensus"
     fallback={(err, reset) => (
       <WidgetErrorFallback widgetName="AI Swarm Consensus Panel" error={err} reset={reset} />
     )}
   >
     <AISwarmConsensusWidget
       signal={aiSignal}
       onApplySignal={(sig) => {
         setPresetSetup({
           side: sig.side === 'BUY' ? 'LONG' : 'SHORT',
           entryPrice: sig.entryPrice,
           slPrice: sig.slPrice,
           tpPrice: sig.tpPrice,
           size: sig.recommendedLotsOrSize,
         })
       }}
     />
   </ErrorBoundary>
   ```
4. Wrap Desk Tabs (PositionsTable / Watchlist / Fills Log, lines 310–440):
   ```tsx
   <ErrorBoundary
     name="Positions & Orders Desk"
     fallback={(err, reset) => (
       <WidgetErrorFallback widgetName="Positions & Orders Desk" error={err} reset={reset} />
     )}
   >
     <div className="space-y-3">
       {/* Tab buttons and activeTab === 'positions' / 'market' / 'ai_orders' */}
       ...
     </div>
   </ErrorBoundary>
   ```
5. Wrap `OrderBookWidget` (lines 445–452):
   ```tsx
   <ErrorBoundary
     name="L2 Order Book"
     fallback={(err, reset) => (
       <WidgetErrorFallback widgetName="Order Book (L2)" error={err} reset={reset} />
     )}
   >
     <OrderBookWidget
       symbol={selectedAsset.symbol}
       orderBook={orderBook}
       trades={publicTrades}
       currentPrice={currentPrice}
       onSelectPrice={() => {}}
     />
   </ErrorBoundary>
   ```
6. Wrap `OrderEntryWidget` (lines 456–466):
   ```tsx
   <ErrorBoundary
     name="Order Entry Desk"
     fallback={(err, reset) => (
       <WidgetErrorFallback widgetName="Order Entry Desk" error={err} reset={reset} />
     )}
   >
     <OrderEntryWidget
       currentPrice={currentPrice}
       symbol={selectedAsset.symbol}
       category={selectedAsset.category}
       userUsdtBalance={portfolio.balances.USDT ?? 0}
       freeMargin={balanceSheet?.freeMargin}
       isCircuitBreakerTripped={balanceSheet?.isCircuitBreakerTripped}
       circuitBreakerReason={balanceSheet?.circuitBreakerReason}
       onOrderPlaced={onOrderPlaced}
       presetSetup={presetSetup}
     />
   </ErrorBoundary>
   ```
7. Wrap `SwapWidget` (lines 468–473):
   ```tsx
   <ErrorBoundary
     name="Spot Swap"
     fallback={(err, reset) => (
       <WidgetErrorFallback widgetName="Spot Swap Desk" error={err} reset={reset} />
     )}
   >
     <SwapWidget
       onSwapSuccess={onExecuteSwap}
       userEthBalance={portfolio.balances.ETH ?? 0}
       userUsdtBalance={portfolio.balances.USDT ?? 0}
       balances={portfolio.balances}
     />
   </ErrorBoundary>
   ```

---

### Blueprint 5: `src/hooks/useLiveMarketFeed.ts` Bounded Candle Buffer (`MAX_CANDLES = 100`)

In `src/hooks/useLiveMarketFeed.ts`:
1. Define constant:
   ```ts
   const MAX_CANDLES = 100
   ```
2. In fallback GBM simulation (line 209):
   ```ts
   updated.push({
     time: alignedNow,
     open: nextClose,
     high: nextClose,
     low: nextClose,
     close: nextClose,
     volume: Math.round(10 + Math.random() * 20),
     ema20: newEma20,
     ema50: newEma50,
   })
   // Enforce strict bounded candle queue (F14)
   if (updated.length > MAX_CANDLES) {
     updated.shift()
   }
   ```
3. In Binance WebSocket tick handler (line 332):
   ```ts
   updated.push({
     time: candleTime,
     open: openP,
     high: highP,
     low: lowP,
     close: closeP,
     volume: vol,
     ema20: provEma20,
     ema50: provEma50,
   })
   // Enforce strict bounded candle queue (F14)
   if (updated.length > MAX_CANDLES) {
     updated.shift()
   }
   ```

---

## 5. Verification Method

To independently verify the drop-in blueprints:

1. **Vitest Feature & Contract Test**:
   ```bash
   pnpm test src/test/tier1_features/errorBoundaries.test.ts
   ```
   **Expected**: 5/5 tests passing in under 20ms, verifying ErrorBoundary state machine, `onError` callbacks, `BoundedCandleBuffer` 100 limit, eviction behavior, `clear()`, and `NetworkStateMachine` transitions.

2. **Full Regression Test Suite**:
   ```bash
   pnpm test
   ```
   **Expected**: 30/30 test files passing (276/276 tests passing).

3. **Production TypeScript & Vite Compilation**:
   ```bash
   pnpm build
   ```
   **Expected**: Exit code 0, clean build with zero TypeScript errors.

4. **Invalidation Conditions**:
   - `ErrorBoundary.getDerivedStateFromError` failing to return `{ hasError: true, error }`.
   - `boundary.reset()` failing to restore `state.hasError = false` and `state.error = null`.
   - `BoundedCandleBuffer.length` exceeding 100 after 250 pushes.
   - Any unhandled exceptions unmounting the top-level Navbar when child widgets throw.
