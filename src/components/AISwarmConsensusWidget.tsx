import React, { useState } from 'react'
import { 
  Zap, ShieldCheck, ArrowUpRight, Check, ChevronDown, ChevronUp
} from 'lucide-react'
import type { AISwarmSignal } from '../types/trading'
import { formatCurrency } from '../utils/formatters'
import { playOrderFilledSound, playClickSound } from '../utils/soundEffects'

interface AISwarmConsensusWidgetProps {
  signal: AISwarmSignal
  onApplySignal: (signal: AISwarmSignal) => void
}

export const AISwarmConsensusWidget: React.FC<AISwarmConsensusWidgetProps> = ({
  signal,
  onApplySignal,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true)
  const [applied, setApplied] = useState<boolean>(false)

  const handleApply = () => {
    playOrderFilledSound()
    setApplied(true)
    onApplySignal(signal)
    setTimeout(() => setApplied(false), 2500)
  }

  const toggleExpand = () => {
    playClickSound()
    setIsExpanded(!isExpanded)
  }

  return (
    <div className="fin-card p-4 border border-pink-500/30 bg-gradient-to-b from-[#0d101d] via-[#080a12] to-[#07080c] relative overflow-hidden text-xs">
      {/* Background Neon Halo Ambient */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-pink-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-white/5 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-pink-500 to-rose-600 flex items-center justify-center text-white shadow-[0_0_12px_rgba(236,72,153,0.5)]">
            <Zap className="w-4 h-4 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">
                AI Multi-Agent Swarm Consensus
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold font-mono-num animate-pulse">
                {signal.bias.replace('_', ' ')} &bull; {signal.consensusScore}%
              </span>
            </div>
            <span className="text-[10px] text-gray-400">
              4 Autonomous Institutional Quantitative Models Voting Live
            </span>
          </div>
        </div>

        <button
          onClick={toggleExpand}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer transition-colors"
          title={isExpanded ? 'Collapse Analysis' : 'Expand Analysis'}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Body */}
      {isExpanded && (
        <div className="space-y-4 pt-3.5 relative z-10">
          {/* 4 Agent Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {signal.agentsAnalysis.map((agent) => (
              <div
                key={agent.id}
                className="p-3 rounded-xl bg-[#080b14]/80 border border-white/5 hover:border-pink-500/20 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-white flex items-center gap-1.5 text-[11px]">
                      <span>{agent.icon}</span>
                      <span>{agent.name}</span>
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 font-mono-num font-bold">
                      {agent.conviction}% Conviction
                    </span>
                  </div>
                  <div className="text-[10px] text-pink-400/80 mb-1 font-semibold">{agent.role}</div>
                  <p className="text-[11px] text-gray-300 leading-relaxed">
                    {agent.rationale}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Execution Blueprint Strip & Action Button */}
          <div className="p-3.5 rounded-xl bg-[#0a0e1c] border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] flex-1">
              <div>
                <span className="text-gray-400 text-[10px] block">Entry Level</span>
                <span className="text-white font-mono-num font-bold text-xs">
                  {formatCurrency(signal.entryPrice)}
                </span>
              </div>
              <div>
                <span className="text-rose-400 text-[10px] block font-semibold">Stop Loss (SL)</span>
                <span className="text-rose-300 font-mono-num font-bold text-xs">
                  {formatCurrency(signal.slPrice)}
                </span>
              </div>
              <div>
                <span className="text-emerald-400 text-[10px] block font-semibold">Take Profit (TP1)</span>
                <span className="text-emerald-300 font-mono-num font-bold text-xs">
                  {formatCurrency(signal.tpPrice)} ({signal.riskReward}R)
                </span>
              </div>
              <div>
                <span className="text-pink-400 text-[10px] block font-semibold">Runner Target (TP2)</span>
                <span className="text-pink-300 font-mono-num font-bold text-xs">
                  {formatCurrency(signal.tp2Price)}
                </span>
              </div>
            </div>

            {/* Quick 1-Click Action to Terminal Order Desk */}
            <button
              onClick={handleApply}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-lg ${
                applied
                  ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.5)]'
                  : 'bg-gradient-to-r from-pink-600 via-rose-600 to-fuchsia-600 hover:brightness-110 text-white shadow-[0_0_20px_rgba(236,72,153,0.4)]'
              }`}
            >
              {applied ? (
                <>
                  <Check className="w-4 h-4 animate-bounce" />
                  <span>Applied to DMA Desk!</span>
                </>
              ) : (
                <>
                  <ArrowUpRight className="w-4 h-4" />
                  <span>⚡ Apply Setup to Execution Desk</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center justify-between text-[10px] text-gray-500 px-1 font-mono-num">
            <span>Aggregated Model: Finora Deep Multi-Agent Transformer v5.2</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Zero Conflict Consensus Verified
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
