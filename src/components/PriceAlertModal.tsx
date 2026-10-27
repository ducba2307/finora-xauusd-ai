import React, { useState } from 'react'
import { Bell, Plus, Trash2, CheckCircle2, AlertTriangle, Volume2, X } from 'lucide-react'
import type { PriceAlert } from '../types/trading'
import { formatCurrency } from '../utils/formatters'
import { playAlertPingSound, playClickSound } from '../utils/soundEffects'

interface PriceAlertModalProps {
  isOpen: boolean
  onClose: () => void
  currentSymbol: string
  currentPrice: number
  alerts: PriceAlert[]
  onAddAlert: (newAlert: Omit<PriceAlert, 'id' | 'createdAt' | 'triggered'>) => void
  onRemoveAlert: (alertId: string) => void
}

export const PriceAlertModal: React.FC<PriceAlertModalProps> = ({
  isOpen,
  onClose,
  currentSymbol,
  currentPrice,
  alerts,
  onAddAlert,
  onRemoveAlert,
}) => {
  const [targetPrice, setTargetPrice] = useState<string>(
    (currentPrice * 1.02).toFixed(currentPrice < 10 ? 4 : 2)
  )
  const [condition, setCondition] = useState<'ABOVE' | 'BELOW'>('ABOVE')

  if (!isOpen) return null

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    const parsedPrice = parseFloat(targetPrice)
    if (!parsedPrice || parsedPrice <= 0) return

    playClickSound()
    onAddAlert({
      symbol: currentSymbol,
      targetPrice: parsedPrice,
      condition,
    })

    // Reset default
    setTargetPrice((currentPrice * 1.02).toFixed(currentPrice < 10 ? 4 : 2))
  }

  const handleQuickPercent = (pct: number) => {
    playClickSound()
    const newPrice = currentPrice * (1 + pct / 100)
    setTargetPrice(newPrice.toFixed(currentPrice < 10 ? 4 : 2))
    setCondition(pct >= 0 ? 'ABOVE' : 'BELOW')
  }

  const symbolAlerts = alerts.filter(
    (a) => a.symbol.replace(/[^a-zA-Z]/g, '') === currentSymbol.replace(/[^a-zA-Z]/g, '')
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="fin-card w-full max-w-lg p-6 border border-pink-500/30 bg-[#0d101d] shadow-[0_0_50px_rgba(236,72,153,0.15)] relative">
        {/* Close Button */}
        <button
          onClick={() => {
            playClickSound()
            onClose()
          }}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.3)]">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Price Alerts Manager
              <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-mono-num font-bold">
                {currentSymbol}
              </span>
            </h3>
            <p className="text-xs text-gray-400">
              Live market streaming triggers audio alarms &amp; desk notifications
            </p>
          </div>
        </div>

        {/* Current Reference Price Banner */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-[#080a11] border border-white/5 mb-5 text-xs">
          <span className="text-gray-400">Current Reference Price:</span>
          <div className="flex items-center gap-2">
            <span className="font-mono-num font-extrabold text-white text-sm">
              {formatCurrency(currentPrice)}
            </span>
            <button
              onClick={() => playAlertPingSound()}
              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
              title="Test audio chime"
            >
              <Volume2 className="w-3 h-3 text-pink-400" />
              <span>Test Audio</span>
            </button>
          </div>
        </div>

        {/* New Alert Form */}
        <form onSubmit={handleCreate} className="space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1.5">
                Trigger Condition
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#080a11] rounded-xl border border-white/10 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    playClickSound()
                    setCondition('ABOVE')
                  }}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                    condition === 'ABOVE'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  &ge; Price Above
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playClickSound()
                    setCondition('BELOW')
                  }}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                    condition === 'BELOW'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  &le; Price Below
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1.5">
                Target Threshold ($)
              </label>
              <input
                type="number"
                step="any"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="w-full bg-[#080a11] border border-white/10 focus:border-pink-500/50 rounded-xl px-3 py-1.5 text-xs text-white font-mono-num font-bold outline-none"
                placeholder="Target Price"
                required
              />
            </div>
          </div>

          {/* Quick Target Offset Buttons */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-500 font-semibold mr-1">Quick Set:</span>
            {[-5, -2, -1, 1, 2, 5].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => handleQuickPercent(pct)}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono-num font-bold border transition-colors cursor-pointer ${
                  pct > 0
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                }`}
              >
                {pct > 0 ? `+${pct}%` : `${pct}%`}
              </button>
            ))}
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white text-xs font-bold transition-all shadow-[0_0_20px_rgba(236,72,153,0.4)] flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Instant Price Alert</span>
          </button>
        </form>

        {/* Existing Alerts List */}
        <div>
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2 font-semibold">
            <span>Active Alerts for {currentSymbol} ({symbolAlerts.length})</span>
            <span>Status</span>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
            {symbolAlerts.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#080a11] border border-white/5 text-center text-xs text-gray-500">
                No active price alerts set for {currentSymbol}. Create one above!
              </div>
            ) : (
              symbolAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-2.5 rounded-xl bg-[#080a11] border border-white/5 flex items-center justify-between text-xs hover:border-white/10 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono-num ${
                        alert.condition === 'ABOVE'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {alert.condition === 'ABOVE' ? '≥' : '≤'}
                    </span>
                    <span className="font-mono-num font-bold text-white text-xs">
                      {formatCurrency(alert.targetPrice)}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {alert.triggered ? (
                      <span className="flex items-center gap-1 text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                        <CheckCircle2 className="w-3 h-3 text-amber-400" />
                        Triggered
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        <AlertTriangle className="w-3 h-3 text-emerald-400" />
                        Arming
                      </span>
                    )}

                    <button
                      onClick={() => {
                        playClickSound()
                        onRemoveAlert(alert.id)
                      }}
                      className="text-gray-500 hover:text-rose-400 p-1 rounded hover:bg-white/5 transition-colors cursor-pointer"
                      title="Delete alert"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
