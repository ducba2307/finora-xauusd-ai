import React from 'react'
import { X, Cpu, Power, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { AIBotStrategy, AccountBalanceSheet } from '../types/trading'
import { formatCurrency } from '../utils/formatters'

interface BotControlModalProps {
  isOpen: boolean
  onClose: () => void
  bots: AIBotStrategy[]
  onToggleBot: (botId: string) => void
  balanceSheet?: AccountBalanceSheet
}

export const BotControlModal: React.FC<BotControlModalProps> = ({
  isOpen,
  onClose,
  bots,
  onToggleBot,
  balanceSheet,
}) => {
  if (!isOpen) return null

  const activeBotsCount = bots.filter((b) => b.status === 'ACTIVE').length
  const totalBotCapital = bots
    .filter((b) => b.status === 'ACTIVE')
    .reduce((sum, b) => sum + b.allocationUsd, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="fin-card-glow w-full max-w-3xl bg-[#0a0d16] border border-pink-500/30 rounded-2xl flex flex-col max-h-[85vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#0e121e]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30 flex items-center justify-center shadow-lg">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-lg">Autonomous AI Bots Orchestrator</h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-mono-num font-semibold border border-emerald-500/30">
                  {activeBotsCount} OF {bots.length} ACTIVE
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Multi-agent hedge engine executing algorithmic trades 24/7 with zero human latency
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Global Summary Bar */}
        <div className="grid grid-cols-3 gap-3 p-4 bg-[#080a12] border-b border-white/5">
          <div className="bg-[#121624] p-3 rounded-xl border border-white/5">
            <div className="text-[11px] text-gray-400">Total Capital Deployed</div>
            <div className="text-lg font-bold text-white font-mono-num">
              {formatCurrency(totalBotCapital)}
            </div>
          </div>
          <div className="bg-[#121624] p-3 rounded-xl border border-white/5">
            <div className="text-[11px] text-gray-400">Avg Model Win Rate</div>
            <div className="text-lg font-bold text-emerald-400 font-mono-num">
              89.7%
            </div>
          </div>
          <div className="bg-[#121624] p-3 rounded-xl border border-white/5">
            <div className="text-[11px] text-gray-400">Circuit Breaker Protection</div>
            {balanceSheet?.isCircuitBreakerTripped ? (
              <div className="text-lg font-bold text-rose-400 font-mono-num flex items-center gap-1 animate-pulse">
                <AlertTriangle className="w-4 h-4 text-rose-400" /> LOCKED (-{balanceSheet.dailyDrawdownPct.toFixed(1)}%)
              </div>
            ) : (
              <div className="text-lg font-bold text-emerald-400 font-mono-num flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> ACTIVE ({balanceSheet ? balanceSheet.dailyDrawdownPct.toFixed(1) : '0.0'}% / 4.5%)
              </div>
            )}
          </div>
        </div>

        {/* Bots List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
          {bots.map((bot) => {
            const isActive = bot.status === 'ACTIVE'
            const isLockedByCb = bot.status === 'LOCKED_BY_CIRCUIT_BREAKER'
            return (
              <div
                key={bot.id}
                className={`p-4 rounded-xl border transition-all ${
                  isLockedByCb
                    ? 'bg-[#180e14] border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                    : isActive
                    ? 'bg-[#101422] border-pink-500/25 shadow-[0_0_15px_rgba(236,72,153,0.1)]'
                    : 'bg-[#0c0f18] border-white/5 opacity-75'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                        isLockedByCb
                          ? 'bg-rose-500 text-white shadow-md'
                          : isActive
                          ? 'bg-gradient-to-tr from-pink-500 to-rose-500 text-white shadow-md'
                          : 'bg-white/5 text-gray-500'
                      }`}
                    >
                      AI
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-sm">{bot.name}</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-pink-300 font-mono-num border border-pink-500/20">
                          {bot.model}
                        </span>
                        {isLockedByCb && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-mono-num border border-rose-500/40 font-bold">
                            CB LOCKED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{bot.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs font-bold text-white font-mono-num">
                        {formatCurrency(bot.allocationUsd)}
                      </div>
                      <div className="text-[10px] text-gray-400">Allocated</div>
                    </div>

                    <button
                      onClick={() => !isLockedByCb && onToggleBot(bot.id)}
                      disabled={isLockedByCb}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isLockedByCb
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 cursor-not-allowed opacity-80'
                          : isActive
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                          : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      {isLockedByCb ? 'CB LOCKED' : isActive ? 'ACTIVE' : 'PAUSED'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-3 mt-2 border-t border-white/5 text-xs">
                  <div>
                    <span className="text-gray-500 text-[11px] block">Win Rate</span>
                    <span className="font-bold text-emerald-400 font-mono-num">{bot.winRate}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[11px] block">Total Trades</span>
                    <span className="font-bold text-white font-mono-num">{bot.tradesCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[11px] block">Realized APY</span>
                    <span className="font-bold text-pink-400 font-mono-num">+{bot.profitPct}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[11px] block">Risk Profile</span>
                    <span
                      className={`font-bold font-mono-num text-[11px] px-1.5 py-0.5 rounded inline-block ${
                        bot.riskLevel === 'LOW'
                          ? 'bg-blue-500/20 text-blue-400'
                          : bot.riskLevel === 'MEDIUM'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {bot.riskLevel}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
