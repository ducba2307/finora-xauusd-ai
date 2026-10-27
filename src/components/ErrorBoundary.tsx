// oxlint-disable react/only-export-components, react/no-direct-mutation-state
/**
 * Finora Institutional Error Boundary & SaaS Buffer Management System
 * Conforms to F14 & F15 requirements from PROJECT.md and ORIGINAL_REQUEST.md (R4).
 */

import React, { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, RotateCcw, ShieldAlert, Terminal, Layers } from 'lucide-react'

// Re-export Network State Machine and contracts from dedicated service
export {
  NetworkStateMachine,
  type NetworkState,
  type NetworkSnapshot,
  defaultNetworkManager,
} from '../services/networkManager'

// ==========================================
// 1. Error Boundary Contracts & Component
// ==========================================

export interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode)
  fallbackType?: 'root' | 'view' | 'widget'
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  onReset?: () => void
  name?: string
  viewName?: string
  widgetName?: string
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
    this.state = { ...this.state, errorInfo }
    if ((this as any)._reactInternals || (this as any)._reactInternalFiber) {
      try {
        this.setState({ errorInfo })
      } catch {
        // safety fallback
      }
    }
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  reset = () => {
    this.state = { hasError: false, error: null, errorInfo: null }
    if ((this as any)._reactInternals || (this as any)._reactInternalFiber) {
      try {
        this.setState({ hasError: false, error: null, errorInfo: null })
      } catch {
        // safety fallback
      }
    }
    if (this.props.onReset) {
      this.props.onReset()
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

      if (this.props.fallbackType === 'root') {
        return <RootErrorFallback error={currentError} reset={this.reset} />
      }

      if (this.props.fallbackType === 'view') {
        return (
          <ViewErrorFallback
            viewName={this.props.name || this.props.viewName || 'Active View'}
            error={currentError}
            reset={this.reset}
            onNavigate={this.props.onReset}
          />
        )
      }

      if (this.props.fallbackType === 'widget') {
        return (
          <WidgetErrorFallback
            widgetName={this.props.name || this.props.widgetName || 'Trading Widget'}
            error={currentError}
            reset={this.reset}
          />
        )
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
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  const handlePurgeAndRecover = () => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.clear()
      if (typeof sessionStorage !== 'undefined') sessionStorage.clear()
    } catch {
      // ignore storage access errors
    }
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
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

  get(): T[] {
    return [...this.buffer]
  }

  get length(): number {
    return this.buffer.length
  }

  size(): number {
    return this.buffer.length
  }

  clear(): void {
    this.buffer = []
  }
}
