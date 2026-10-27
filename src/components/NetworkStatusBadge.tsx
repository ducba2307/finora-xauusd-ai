import React from 'react'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { useNetworkState } from '../hooks/useNetworkState'
import { playClickSound } from '../utils/soundEffects'

interface NetworkStatusBadgeProps {
  className?: string
  compact?: boolean
}

export const NetworkStatusBadge: React.FC<NetworkStatusBadgeProps> = ({
  className = '',
  compact = false,
}) => {
  const { state, latencyMs, retryAttempts, maxRetries, countdownSec, reconnectNow } = useNetworkState()

  const handleManualReconnect = (e: React.MouseEvent) => {
    e.stopPropagation()
    playClickSound()
    reconnectNow()
  }

  // --- ONLINE STATE ---
  if (state === 'ONLINE') {
    return (
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold select-none shadow-sm transition-all hover:bg-emerald-500/15 ${className}`}
        title={`Institutional Feed Active · Transport Ping: ${latencyMs}ms`}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <Wifi className="w-3.5 h-3.5" />
        {!compact && (
          <>
            <span className="hidden sm:inline">Online</span>
            <span className="text-[10px] font-mono font-bold text-emerald-400/80">({latencyMs}ms)</span>
          </>
        )}
      </div>
    )
  }

  // --- RECONNECTING STATE ---
  if (state === 'RECONNECTING') {
    return (
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold select-none shadow-sm transition-all ${className}`}
        title={`Connection Interrupted · Retrying attempt ${retryAttempts} of ${maxRetries}`}
      >
        <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
        {!compact && (
          <>
            <span>Reconnecting</span>
            <span className="text-[10px] font-mono text-amber-400/90 font-bold">
              ({retryAttempts}/{maxRetries}) {countdownSec > 0 ? `${countdownSec}s` : ''}
            </span>
          </>
        )}
        <button
          onClick={handleManualReconnect}
          className="ml-1 px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[10px] font-extrabold uppercase tracking-wide cursor-pointer"
          title="Retry Connection Immediately"
        >
          Now
        </button>
      </div>
    )
  }

  // --- OFFLINE STATE ---
  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold select-none shadow-[0_0_15px_rgba(244,63,94,0.25)] transition-all ${className}`}
      title="Connection Severed. Click to manually reconnect."
    >
      <WifiOff className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
      {!compact && <span>Offline</span>}
      <button
        onClick={handleManualReconnect}
        className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
      >
        <RefreshCw className="w-2.5 h-2.5" />
        <span>Reconnect Now</span>
      </button>
    </div>
  )
}
