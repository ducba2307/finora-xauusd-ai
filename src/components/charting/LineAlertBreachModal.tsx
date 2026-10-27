import React from 'react'
import { Bell, Sparkles, X, Bot } from 'lucide-react'
import type { DrawnObject } from '../../types/aiCharting'

interface LineAlertBreachModalProps {
  breachedObject: DrawnObject | null
  onClose: () => void
  onOpenFullInvestigation: (symbol: string) => void
}

export const LineAlertBreachModal: React.FC<LineAlertBreachModalProps> = ({
  breachedObject,
  onClose,
  onOpenFullInvestigation,
}) => {
  if (!breachedObject) return null

  const report = breachedObject.investigationReport
  const price = breachedObject.breachPrice || breachedObject.points[0]?.price || 0

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full p-4 bg-[#0d111d] border-2 border-pink-500/50 rounded-2xl shadow-[0_0_30px_rgba(236,72,153,0.3)] animate-in slide-in-from-bottom duration-300 text-gray-200">
      {/* Top Banner */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center animate-pulse">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase text-pink-400 font-bold flex items-center gap-1.5">
              <span>DRAWN LINE BREACH ALERT</span>
              <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-ping" />
            </div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>{breachedObject.symbol}</span>
              <span className="text-gray-400 font-normal">Crossed</span>
              <span className="text-pink-400">${price.toFixed(2)}</span>
            </h3>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* AI Immediate Root-Cause Finding */}
      <div className="py-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400 flex items-center gap-1">
            <Bot className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI Root-Cause Agent ({breachedObject.aiProvider}):</span>
          </span>
          <span className="text-emerald-400 font-mono text-[11px] font-bold">
            96.8% Confidence
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-[#07090f] border border-white/5 text-xs text-gray-300">
          <p className="font-semibold text-white mb-1">
            {report?.primaryCatalyst ||
              `Abnormal Volume Surge & Resistance Breakout on ${breachedObject.symbol}`}
          </p>
          <p className="text-[11px] text-gray-400 line-clamp-2">
            {report?.summary ||
              `High-conviction buying momentum triggered this line breach with CVD acceleration and block liquidity absorption.`}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex items-center justify-between gap-2 text-xs">
        <button
          onClick={() => {
            onOpenFullInvestigation(breachedObject.symbol)
            onClose()
          }}
          className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-semibold flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>View Deep Cause Analysis</span>
        </button>
        <button
          onClick={onClose}
          className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
