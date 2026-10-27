import React from 'react'
import { CheckCircle2, XCircle, Clock, Award } from 'lucide-react'
import type { TrackedSignal, SignalLedgerStats } from '../../services/signalLifecycleManager'

interface SignalHistoryLedgerProps {
  signals: TrackedSignal[]
  stats: SignalLedgerStats
}

export const SignalHistoryLedger: React.FC<SignalHistoryLedgerProps> = ({ signals, stats }) => {
  return (
    <div className="fin-card bg-[#080b14] border border-white/5 rounded-2xl p-4 sm:p-5 space-y-4">
      {/* Header & Stats Banner */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-400" />
          <h3 className="font-bold text-white text-xs uppercase tracking-wider">
            Nhật Ký Tín Hiệu &amp; Thống Kê Minh Bạch
          </h3>
        </div>
        <div className="text-[11px] font-mono text-gray-400">
          Tổng số: <strong className="text-white">{stats.totalSignals}</strong> lệnh
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-[#0e1322] border border-white/5 p-2 rounded-xl">
          <span className="text-[10px] text-gray-400 block truncate">Tỷ Lệ Thắng</span>
          <span className="text-xs sm:text-sm font-black text-emerald-400 font-mono tabular-nums mt-0.5 block">
            {stats.winRatePct}%
          </span>
          <span className="text-[9px] text-gray-500 font-mono tabular-nums block">
            {stats.winCount}W / {stats.lossCount}L
          </span>
        </div>

        <div className="bg-[#0e1322] border border-white/5 p-2 rounded-xl">
          <span className="text-[10px] text-gray-400 block truncate">Lợi Nhuận R</span>
          <span className="text-xs sm:text-sm font-black text-cyan-300 font-mono tabular-nums mt-0.5 block">
            +{stats.totalRealizedR}R
          </span>
          <span className="text-[9px] text-gray-500 block truncate">R-Multiple</span>
        </div>

        <div className="bg-[#0e1322] border border-white/5 p-2 rounded-xl">
          <span className="text-[10px] text-gray-400 block truncate">R:R Trung Bình</span>
          <span className="text-xs sm:text-sm font-black text-amber-300 font-mono tabular-nums mt-0.5 block">
            1 : {stats.averageRR}
          </span>
          <span className="text-[9px] text-gray-500 block truncate">Kỳ vọng</span>
        </div>
      </div>

      {/* Signal List */}
      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {signals.map((sig) => {
          const isBuy = sig.direction === 'BUY'
          const isWin = sig.status === 'FULL_TP_HIT' || sig.status === 'TP1_HIT'
          const isLoss = sig.status === 'STOPPED_OUT'
          const isPending = sig.status === 'PENDING_RETEST' || sig.status === 'ACTIVE_TRIGGERED'

          return (
            <div
              key={sig.id}
              className="bg-[#0b0e1b] border border-white/5 hover:border-white/10 p-2.5 rounded-xl flex items-center justify-between gap-2 text-xs transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono shrink-0 ${
                    isBuy ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {sig.direction}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-gray-200 text-[11px] truncate">
                    {sig.setupName}
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono tabular-nums truncate">
                    Entry: ${sig.entryPrice.toFixed(2)} <span className="text-gray-700">|</span> SL: ${sig.stopLoss.toFixed(2)} <span className="text-gray-700">|</span> TP: ${sig.takeProfit1.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                    isWin
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : isLoss
                      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  }`}
                >
                  {isWin && <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />}
                  {isLoss && <XCircle className="w-2.5 h-2.5 shrink-0" />}
                  {isPending && <Clock className="w-2.5 h-2.5 shrink-0" />}
                  <span className="whitespace-nowrap">
                    {sig.status === 'FULL_TP_HIT'
                      ? `+${sig.realizedR}R ĐẠT TP2`
                      : sig.status === 'TP1_HIT'
                      ? `+${sig.realizedR}R ĐÃ TP1`
                      : sig.status === 'STOPPED_OUT'
                      ? `${sig.realizedR}R DÍNH SL`
                      : 'CHỜ ENTRY'}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
