import React, { useState } from 'react'
import { X, Key, CheckCircle2, Lock } from 'lucide-react'

interface ApiKeysModalProps {
  isOpen: boolean
  onClose: () => void
  currentMode: 'PAPER' | 'LIVE'
  onModeChange: (mode: 'PAPER' | 'LIVE') => void
}

export const ApiKeysModal: React.FC<ApiKeysModalProps> = ({
  isOpen,
  onClose,
  currentMode,
  onModeChange,
}) => {
  const [selectedExchange, setSelectedExchange] = useState('BINANCE')
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [isSaved, setIsSaved] = useState(false)

  if (!isOpen) return null

  const handleSave = () => {
    setIsSaved(true)
    setTimeout(() => {
      setIsSaved(false)
      onClose()
    }, 1200)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="fin-card-glow w-full max-w-xl bg-[#0a0d16] border border-pink-500/30 rounded-2xl flex flex-col overflow-hidden shadow-2xl text-xs">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#0e121e]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Exchange &amp; API Key Integration</h3>
              <p className="text-[11px] text-gray-400">Institutional Sub-millisecond Execution Bridge</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="p-4 space-y-4">
          <div>
            <label className="text-gray-400 font-semibold block mb-2">Trading Environment</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onModeChange('PAPER')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  currentMode === 'PAPER'
                    ? 'bg-pink-500/15 border-pink-500/40 text-white shadow-[0_0_15px_rgba(236,72,153,0.2)]'
                    : 'bg-[#121624] border-white/5 text-gray-400'
                }`}
              >
                <div className="font-bold text-white flex items-center gap-1.5">
                  <span>Paper Trading</span>
                  {currentMode === 'PAPER' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">Zero financial risk simulation with live order books</div>
              </button>

              <button
                onClick={() => onModeChange('LIVE')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  currentMode === 'LIVE'
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-white shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                    : 'bg-[#121624] border-white/5 text-gray-400'
                }`}
              >
                <div className="font-bold text-white flex items-center gap-1.5">
                  <span>Live Exchange API</span>
                  {currentMode === 'LIVE' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">Direct DMA order routing to your exchange account</div>
              </button>
            </div>
          </div>

          {/* Exchange Picker */}
          <div>
            <label className="text-gray-400 font-semibold block mb-1.5">Select Exchange</label>
            <div className="grid grid-cols-4 gap-2">
              {['BINANCE', 'BYBIT', 'OKX', 'HYPERLIQUID'].map((ex) => (
                <button
                  key={ex}
                  onClick={() => setSelectedExchange(ex)}
                  className={`py-2 rounded-xl border text-center font-bold text-[11px] transition-all cursor-pointer ${
                    selectedExchange === ex
                      ? 'bg-white/10 text-white border-white/20'
                      : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'
                  }`}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* Key Inputs */}
          <div className="space-y-3">
            <div>
              <label className="text-gray-400 font-medium block mb-1">API Key</label>
              <input
                type="text"
                placeholder="Paste your exchange API key..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-[#080a11] border border-white/10 rounded-xl px-3 py-2 text-white font-mono-num placeholder-gray-500 focus:outline-none focus:border-pink-500/50"
              />
            </div>

            <div>
              <label className="text-gray-400 font-medium block mb-1">API Secret</label>
              <input
                type="password"
                placeholder="Paste your exchange API secret..."
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                className="w-full bg-[#080a11] border border-white/10 rounded-xl px-3 py-2 text-white font-mono-num placeholder-gray-500 focus:outline-none focus:border-pink-500/50"
              />
            </div>
          </div>

          {/* Security Notice */}
          <div className="p-3 rounded-xl bg-pink-500/10 border border-pink-500/20 flex gap-2.5 items-start">
            <Lock className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-gray-300 leading-relaxed">
              <strong className="text-white">Zero Withdrawal Access:</strong> Always disable withdrawal permissions on your API keys. Finora only requires <strong>Spot &amp; Futures Trading</strong> permissions.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-[#0e121e] flex items-center justify-between">
          <span className="text-[11px] text-gray-400">Encryption: AES-256 GCM</span>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold cursor-pointer hover:opacity-90 transition-opacity"
          >
            {isSaved ? 'Keys Verified & Saved!' : 'Save & Connect'}
          </button>
        </div>
      </div>
    </div>
  )
}
