import React from 'react'
import { CheckCircle2, CircleDot, Activity, Zap, Clock } from 'lucide-react'
import type { TechnicalConfluenceReport } from '../../quant/confluenceEngine'

interface ConfluenceGaugeWidgetProps {
  report: TechnicalConfluenceReport | null
}

export const ConfluenceGaugeWidget: React.FC<ConfluenceGaugeWidgetProps> = ({ report }) => {
  if (!report) return null

  const score = report.confluenceScore
  const isHighConfluence = score >= 75
  const isModerate = score >= 55 && score < 75

  const scoreColor = isHighConfluence
    ? 'text-emerald-400'
    : isModerate
    ? 'text-cyan-400'
    : 'text-amber-400'

  const scoreBg = isHighConfluence
    ? 'bg-emerald-500'
    : isModerate
    ? 'bg-cyan-500'
    : 'bg-amber-500'

  return (
    <div className="fin-card bg-[#080b14] border border-white/5 rounded-2xl p-4 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <h3 className="font-bold text-white text-xs uppercase tracking-wider">
            Đồng Thuận 4 Hệ Kỹ Thuật (Confluence)
          </h3>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="text-gray-400">Tổng điểm:</span>
          <span className={`font-black text-sm ${scoreColor}`}>{score}/100</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-white/5">
        <div
          className={`h-full transition-all duration-500 ${scoreBg}`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* 4 Methods Badges Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {/* 1. Price Action */}
        <div className="bg-[#0e1322] border border-white/5 p-2.5 rounded-xl space-y-1">
          <div className="text-[10px] text-gray-400 flex items-center justify-between">
            <span>Price Action</span>
            <CheckCircle2
              className={`w-3 h-3 ${
                report.priceAction.candlePattern !== 'NONE' ? 'text-emerald-400' : 'text-gray-500'
              }`}
            />
          </div>
          <div className="font-semibold text-gray-200 text-[11px] truncate">
            {report.priceAction.candlePattern.replace(/_/g, ' ')}
          </div>
        </div>

        {/* 2. SMC & ICT */}
        <div className="bg-[#0e1322] border border-white/5 p-2.5 rounded-xl space-y-1">
          <div className="text-[10px] text-gray-400 flex items-center justify-between">
            <span>SMC &amp; ICT</span>
            <Zap
              className={`w-3 h-3 ${
                report.smcAnalysis.summary.lastBreakType ? 'text-cyan-400' : 'text-gray-500'
              }`}
            />
          </div>
          <div className="font-semibold text-gray-200 text-[11px] truncate">
            {report.smcAnalysis.summary.lastBreakType || 'Scanning Pools...'}
          </div>
        </div>

        {/* 3. RSI Divergence */}
        <div className="bg-[#0e1322] border border-white/5 p-2.5 rounded-xl space-y-1">
          <div className="text-[10px] text-gray-400 flex items-center justify-between">
            <span>RSI Momentum</span>
            <CircleDot
              className={`w-3 h-3 ${
                report.rsiAnalysis.type !== 'NONE' ? 'text-emerald-400' : 'text-gray-500'
              }`}
            />
          </div>
          <div className="font-semibold text-gray-200 text-[11px] truncate">
            RSI {report.rsiAnalysis.currentRsi.toFixed(1)}{' '}
            {report.rsiAnalysis.type !== 'NONE' ? '• Phân Kỳ' : ''}
          </div>
        </div>

        {/* 4. ICT Killzone */}
        <div className="bg-[#0e1322] border border-white/5 p-2.5 rounded-xl space-y-1">
          <div className="text-[10px] text-gray-400 flex items-center justify-between">
            <span>Session Killzone</span>
            <Clock className="w-3 h-3 text-amber-400" />
          </div>
          <div className="font-semibold text-gray-200 text-[11px] truncate">
            {report.killzone.replace(/_/g, ' ')}
          </div>
        </div>
      </div>
    </div>
  )
}
