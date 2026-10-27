import React, { useState } from 'react'
import {
  ShieldCheck,
  Zap,
  Target,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Lock,
} from 'lucide-react'
import type { SMCAnalysisResult, SMCTradeSetup } from '../../quant/smartMoneyConcepts'

interface SMCOverlayPanelProps {
  smcResult: SMCAnalysisResult | null
  visible: boolean
  onExecuteSetup?: (setup: SMCTradeSetup) => void
}

export const SMCOverlayPanel: React.FC<SMCOverlayPanelProps> = ({
  smcResult,
  visible,
  onExecuteSetup,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [executed, setExecuted] = useState(false)

  if (!visible || !smcResult) return null

  const { activeSetup, summary, symbol } = smcResult
  const isGatePass = activeSetup.gateStatus === 'GATE_PASS'
  const isBuy = activeSetup.direction === 'BUY'

  const handleExecute = () => {
    if (!onExecuteSetup || !isGatePass) return
    onExecuteSetup(activeSetup)
    setExecuted(true)
    setTimeout(() => setExecuted(false), 3000)
  }

  return (
    <div className="absolute top-14 left-4 z-20 max-w-sm w-80 font-sans pointer-events-auto">
      <div className="bg-slate-900/90 backdrop-blur-md border border-cyan-500/30 rounded-xl shadow-2xl overflow-hidden transition-all duration-300">
        {/* Header matching video: SMC DESKTOP */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/60 px-3.5 py-2.5 flex items-center justify-between border-b border-cyan-500/20">
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isGatePass ? 'bg-emerald-400' : 'bg-cyan-400'
              }`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isGatePass ? 'bg-emerald-500' : 'bg-cyan-500'
              }`} />
            </span>
            <span className="text-xs font-black tracking-wider text-cyan-300 uppercase">
              SMC DESKTOP
            </span>
            <span className="text-[10px] bg-cyan-950 text-cyan-400 font-mono px-1.5 py-0.5 rounded border border-cyan-800/60">
              {symbol}
            </span>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800/50 transition-colors"
              title={isCollapsed ? 'Mở rộng HUD' : 'Thu gọn HUD'}
            >
              {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <div className="p-3.5 space-y-3">
            {/* Gate Status Badge */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Institutional Gate
              </span>
              <div
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                  isGatePass
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/20 animate-pulse'
                    : activeSetup.gateStatus === 'WAITING_CONFIRMATION'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {isGatePass ? (
                  <>
                    <ShieldCheck size={13} className="text-emerald-400" />
                    <span>GATE PASS ⚡</span>
                  </>
                ) : activeSetup.gateStatus === 'WAITING_CONFIRMATION' ? (
                  <>
                    <AlertCircle size={13} className="text-amber-400" />
                    <span>WAITING RE-TEST</span>
                  </>
                ) : (
                  <>
                    <Lock size={13} className="text-slate-500" />
                    <span>SCANNING POOLS</span>
                  </>
                )}
              </div>
            </div>

            {/* Trade Bracket Cards (Entry / SL / TP / R:R) */}
            {activeSetup.direction !== 'NONE' ? (
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                  <div className="flex items-center space-x-1.5">
                    {isBuy ? (
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                        <TrendingUp size={14} /> BUY / LONG
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-rose-400 flex items-center gap-1">
                        <TrendingDown size={14} /> SELL / SHORT
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-mono">
                      {activeSetup.setupType.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono font-bold text-cyan-300 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/40">
                    R:R 1:{activeSetup.riskRewardRatio}
                  </div>
                </div>

                {/* Entry / SL / TP Grid */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                  <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
                    <div className="text-[10px] text-slate-400">ENTRY</div>
                    <div className="font-mono font-bold text-cyan-300">
                      ${activeSetup.entryPrice.toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-slate-900/80 p-1.5 rounded border border-rose-950/40">
                    <div className="text-[10px] text-rose-400">STOP LOSS</div>
                    <div className="font-mono font-bold text-rose-300">
                      ${activeSetup.stopLoss.toFixed(2)}
                    </div>
                    <div className="text-[9px] text-rose-400/80 font-mono">
                      -{activeSetup.riskPips} pips
                    </div>
                  </div>
                  <div className="bg-slate-900/80 p-1.5 rounded border border-emerald-950/40">
                    <div className="text-[10px] text-emerald-400">TAKE PROFIT</div>
                    <div className="font-mono font-bold text-emerald-300">
                      ${activeSetup.takeProfit.toFixed(2)}
                    </div>
                    <div className="text-[9px] text-emerald-400/80 font-mono">
                      +{activeSetup.rewardPips} pips
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-300 leading-relaxed bg-slate-900/40 p-1.5 rounded border border-slate-800/50">
                  <span className="text-cyan-400 font-semibold">Alpha Rationale:</span> {activeSetup.reason}
                </div>

                {/* Instant Order Execution Button */}
                {onExecuteSetup && (
                  <button
                    onClick={handleExecute}
                    disabled={!isGatePass || executed}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-all duration-200 flex items-center justify-center space-x-1.5 ${
                      executed
                        ? 'bg-emerald-600 text-white cursor-default'
                        : isGatePass
                        ? isBuy
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-900/40'
                          : 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-lg shadow-rose-900/40'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    }`}
                  >
                    {executed ? (
                      <>
                        <CheckCircle2 size={14} />
                        <span>ORDER TRANSMITTED 🚀</span>
                      </>
                    ) : (
                      <>
                        <Zap size={14} />
                        <span>
                          {isGatePass
                            ? `EXECUTE ${isBuy ? 'LONG' : 'SHORT'} (ICT GATE PASS)`
                            : 'AWAITING STRUCTURE RE-TEST'}
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-4 bg-slate-950/40 rounded-lg border border-slate-800/50">
                <Target size={24} className="mx-auto text-slate-500 mb-1.5 opacity-60" />
                <div className="text-xs text-slate-300 font-medium">Scanning Liquidity Pools</div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Engine is monitoring BSL / SSL sweeps & CHoCH confirmation.
                </div>
              </div>
            )}

            {/* Live SMC Structure Statistics Matrix */}
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800/80">
              <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                <div className="text-[10px] text-slate-400">Market Bias</div>
                <div
                  className={`font-bold flex items-center gap-1 mt-0.5 ${
                    summary.marketBias === 'BULLISH'
                      ? 'text-emerald-400'
                      : summary.marketBias === 'BEARISH'
                      ? 'text-rose-400'
                      : 'text-slate-400'
                  }`}
                >
                  {summary.marketBias === 'BULLISH' && <TrendingUp size={12} />}
                  {summary.marketBias === 'BEARISH' && <TrendingDown size={12} />}
                  {summary.marketBias}
                </div>
              </div>

              <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                <div className="text-[10px] text-slate-400">Structure Break</div>
                <div className="font-bold text-cyan-300 font-mono mt-0.5">
                  {summary.lastBreakType || 'Scanning...'}
                </div>
              </div>

              <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                <div className="text-[10px] text-slate-400">Active Order Blocks</div>
                <div className="font-mono text-[11px] text-slate-300 mt-0.5">
                  <span className="text-emerald-400 font-bold">{summary.activeBullishOBsCount} Bull</span>
                  {' / '}
                  <span className="text-rose-400 font-bold">{summary.activeBearishOBsCount} Bear</span>
                </div>
              </div>

              <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                <div className="text-[10px] text-slate-400">Unfilled FVGs</div>
                <div className="font-mono text-[11px] text-amber-300 font-bold mt-0.5">
                  {summary.activeFvgCount} Imbalances
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
