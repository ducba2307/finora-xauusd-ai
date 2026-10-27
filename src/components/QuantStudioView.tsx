import React, { useState } from 'react'
import { Play, Sliders, RefreshCw } from 'lucide-react'
import { GENERATE_CANDLESTICK_SERIES } from '../data/mockData'
import { formatCurrency } from '../utils/formatters'
import { runBacktest } from '../quant/backtestEngine'
import type { BacktestResult, AccountBalanceSheet } from '../types/trading'

const INITIAL_CANDLES = GENERATE_CANDLESTICK_SERIES('BTC', '1H', 120)
const INITIAL_BACKTEST_RESULT: BacktestResult = runBacktest({
  symbol: 'BTC/USDT',
  candles: INITIAL_CANDLES,
  initialCapital: 100000,
  leverage: 10,
  confidenceThreshold: 85,
  strategyType: 'SMA_CROSSOVER',
  smaFast: 5,
  smaSlow: 15,
  spreadPips: 2.0,
  slippagePct: 0.0005,
  commissionPerLotUsd: 5.0,
})

interface QuantStudioViewProps {
  balanceSheet?: AccountBalanceSheet
}

export const QuantStudioView: React.FC<QuantStudioViewProps> = ({ balanceSheet }) => {
  const [selectedModel, setSelectedModel] = useState('Transformer Attention v4.8')
  const [confidenceThreshold, setConfidenceThreshold] = useState(85)
  const [leverage, setLeverage] = useState(10)
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(100)
  const [result, setResult] = useState<BacktestResult>(INITIAL_BACKTEST_RESULT)

  const handleRunBacktest = () => {
    setIsRunning(true)
    setProgress(15)

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval)
          return 95
        }
        return prev + 25
      })
    }, 200)

    setTimeout(() => {
      clearInterval(interval)
      setProgress(100)
      setIsRunning(false)

      const candles = GENERATE_CANDLESTICK_SERIES('BTC', '1H', 120)
      const strategyType = selectedModel.includes('Sequence') || selectedModel.includes('Transformer')
        ? 'SMA_CROSSOVER'
        : selectedModel.includes('Mean Reversion')
        ? 'RSI_REVERSAL'
        : 'SMA_CROSSOVER'

      const backtestRes = runBacktest({
        symbol: 'BTC/USDT',
        candles,
        initialCapital: 100000,
        leverage,
        confidenceThreshold,
        strategyType,
        smaFast: 5,
        smaSlow: 15,
        spreadPips: 2.0,
        slippagePct: 0.0005,
        commissionPerLotUsd: 5.0,
      })
      setResult(backtestRes)
    }, 1000)
  }

  // Safe SVG calculation immune to length <= 1 and max === min
  const eqPoints = result.equityCurve && result.equityCurve.length > 0
    ? result.equityCurve
    : [{ timestamp: '2026-10-11T00:00:00.000Z', strategy: 100000, benchmark: 100000 }]

  const allValues = eqPoints.flatMap((e) => [e.strategy, e.benchmark].filter(Number.isFinite))
  const rawMax = allValues.length > 0 ? Math.max(...allValues) : 100000
  const rawMin = allValues.length > 0 ? Math.min(...allValues) : 100000
  const maxEquity = rawMax === rawMin ? rawMax + 1000 : rawMax
  const minEquity = rawMax === rawMin ? Math.max(0, rawMin - 1000) : rawMin
  const eqSpan = maxEquity - minEquity > 0 ? maxEquity - minEquity : 1
  const width = 800
  const height = 240
  const denom = eqPoints.length > 1 ? eqPoints.length - 1 : 1

  const strategyPoints = eqPoints
    .map((e, idx) => {
      const x = (idx / denom) * width
      const y = height - ((e.strategy - minEquity) / eqSpan) * (height - 30) - 15
      const safeX = Number.isFinite(x) ? Number(x.toFixed(1)) : 0
      const safeY = Number.isFinite(y) ? Number(y.toFixed(1)) : height / 2
      return `${safeX},${safeY}`
    })
    .join(' ')

  const benchmarkPoints = eqPoints
    .map((e, idx) => {
      const x = (idx / denom) * width
      const y = height - ((e.benchmark - minEquity) / eqSpan) * (height - 30) - 15
      const safeX = Number.isFinite(x) ? Number(x.toFixed(1)) : 0
      const safeY = Number.isFinite(y) ? Number(y.toFixed(1)) : height / 2
      return `${safeX},${safeY}`
    })
    .join(' ')

  const benchmarkReturnPct = eqPoints.length > 0 && eqPoints[0].benchmark > 0
    ? Number((((eqPoints[eqPoints.length - 1].benchmark - eqPoints[0].benchmark) / eqPoints[0].benchmark) * 100).toFixed(1))
    : 0

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <span>Finora Quant</span>
            <span>&gt;</span>
            <span className="text-pink-400 font-medium">Strategy &amp; Backtest Studio</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <span>AI Quantitative Lab</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-pink-500/15 text-pink-300 border border-pink-500/30 font-semibold font-mono-num">
              Institutional Backtester v4.2
            </span>
          </h1>
        </div>

        <button
          onClick={handleRunBacktest}
          disabled={isRunning}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white font-bold text-xs shadow-[0_0_20px_rgba(236,72,153,0.5)] flex items-center gap-2 transition-all cursor-pointer"
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Running Neural Simulation ({progress}%)...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Run Backtest Simulation</span>
            </>
          )}
        </button>
      </div>

      {/* Two Column Layout: Parameters & Scorecard */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Parameter Configuration */}
        <div className="lg:col-span-1 fin-card p-5 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <Sliders className="w-4 h-4 text-pink-400" />
            <h3 className="text-sm font-bold text-white">Model Parameters</h3>
          </div>

          {/* Model Selector */}
          <div>
            <label className="text-xs text-gray-400 block mb-2 font-medium">Core AI Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-[#080a11] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-pink-500/50 cursor-pointer"
            >
              <option value="Transformer Attention v4.8">Transformer Attention v4.8 (Order Flow)</option>
              <option value="LSTM Deep Sequence">LSTM Deep Sequence (Trend Breakout)</option>
              <option value="Reinforcement Learning PPO">RL PPO (Adaptive Market Maker)</option>
              <option value="Bayesian Mean Reversion">Bayesian Mean Reversion (Statistical Arb)</option>
            </select>
          </div>

          {/* Confidence Slider */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-400 font-medium">Signal Confidence Cutoff</span>
              <span className="text-pink-400 font-bold font-mono-num">{confidenceThreshold}%</span>
            </div>
            <input
              type="range"
              min="60"
              max="98"
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(parseInt(e.target.value))}
              className="w-full accent-pink-500 cursor-pointer"
            />
            <span className="text-[10px] text-gray-500 block mt-1">Filters out trades below confidence target</span>
          </div>

          {/* Leverage Slider */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-400 font-medium">Strategy Leverage</span>
              <span className="text-emerald-400 font-bold font-mono-num">{leverage}x</span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              value={leverage}
              onChange={(e) => setLeverage(parseInt(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* Circuit Breaker */}
          <div className="bg-[#080a11] p-3 rounded-xl border border-white/5 space-y-2 text-xs">
            <span className="font-bold text-white block">Risk Controls:</span>
            <div className="flex justify-between text-[11px] text-gray-400">
              <span>Max Daily Drawdown:</span>
              <span className="text-rose-400 font-bold font-mono-num flex items-center gap-1">
                -4.5% Hard Stop
                {balanceSheet && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-extrabold ${balanceSheet.isCircuitBreakerTripped ? 'bg-rose-500/20 text-rose-400 animate-pulse' : 'bg-emerald-500/15 text-emerald-400'}`}>
                    {balanceSheet.isCircuitBreakerTripped ? 'TRIPPED' : `ACTIVE (${balanceSheet.dailyDrawdownPct.toFixed(1)}%)`}
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-gray-400">
              <span>Kelly Criterion:</span>
              <span className="text-indigo-400 font-bold font-mono-num">Half-Kelly (0.50)</span>
            </div>
          </div>
        </div>

        {/* Right 3 Columns: Backtest Performance Scorecard & Chart */}
        <div className="lg:col-span-3 space-y-6">
          {/* Institutional Metric Scorecard Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="fin-card p-4">
              <div className="text-[11px] text-gray-400">Sharpe Ratio</div>
              <div className="text-2xl font-extrabold text-emerald-400 font-mono-num mt-1">
                {result.sharpeRatio.toFixed(2)}
              </div>
              <div className="text-[10px] text-gray-500 mt-1">Sortino: {result.sortinoRatio.toFixed(2)}</div>
            </div>

            <div className="fin-card p-4">
              <div className="text-[11px] text-gray-400">Calmar Ratio</div>
              <div className="text-2xl font-extrabold text-cyan-400 font-mono-num mt-1">
                {(result.calmarRatio ?? 0).toFixed(2)}
              </div>
              <div className="text-[10px] text-gray-500 mt-1">CAGR / |MDD|</div>
            </div>

            <div className="fin-card p-4">
              <div className="text-[11px] text-gray-400">Win Rate</div>
              <div className="text-2xl font-extrabold text-white font-mono-num mt-1">
                {result.winRate.toFixed(1)}%
              </div>
              <div className="text-[10px] text-gray-500 mt-1">{result.totalTrades} Closed Fills</div>
            </div>

            <div className="fin-card p-4">
              <div className="text-[11px] text-gray-400">Profit Factor</div>
              <div className="text-2xl font-extrabold text-pink-400 font-mono-num mt-1">
                {result.profitFactor.toFixed(2)}
              </div>
              <div className="text-[10px] text-gray-500 mt-1">Win / Loss Ratio</div>
            </div>

            <div className="fin-card p-4">
              <div className="text-[11px] text-gray-400">Max Drawdown</div>
              <div className="text-2xl font-extrabold text-rose-400 font-mono-num mt-1">
                {result.maxDrawdown.toFixed(2)}%
              </div>
              <div className="text-[10px] text-emerald-400 mt-1">Peak-to-Trough</div>
            </div>

            <div className="fin-card p-4">
              <div className="text-[11px] text-gray-400">Total Net Profit</div>
              <div className="text-2xl font-extrabold text-white font-mono-num mt-1">
                {result.netProfitPct >= 0 ? '+' : ''}{result.netProfitPct.toFixed(1)}%
              </div>
              <div className="text-[10px] text-emerald-400 font-mono-num mt-1">
                {formatCurrency(result.netProfitUsd, true)}
              </div>
            </div>
          </div>

          {/* Equity Curve Comparison */}
          <div className="fin-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Cumulative Strategy Equity Curve</h3>
                <p className="text-xs text-gray-400 mt-0.5">Finora AI Quant Strategy vs Buy &amp; Hold Benchmark</p>
              </div>

              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-pink-400">
                  <span className="w-3 h-1 bg-pink-500 rounded"></span> Finora AI Model ({result.netProfitPct >= 0 ? '+' : ''}{result.netProfitPct.toFixed(1)}%)
                </span>
                <span className="flex items-center gap-1.5 text-gray-400">
                  <span className="w-3 h-1 bg-gray-500 rounded"></span> Buy &amp; Hold Benchmark ({benchmarkReturnPct >= 0 ? '+' : ''}{benchmarkReturnPct.toFixed(1)}%)
                </span>
              </div>
            </div>

            {/* SVG Curve Canvas */}
            <div className="h-[240px] w-full relative">
              <svg viewBox="0 0 800 240" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="eqPink" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ec4899" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#ec4899" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Benchmark Line */}
                <polyline
                  fill="none"
                  stroke="#6b7280"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  points={benchmarkPoints}
                />

                {/* Strategy Area & Line */}
                <path
                  d={`M 0 240 L 0 ${height} L ${strategyPoints.replace(/ /g, ' L ')} L 800 240 Z`}
                  fill="url(#eqPink)"
                />
                <polyline
                  fill="none"
                  stroke="#ec4899"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={strategyPoints}
                />
              </svg>
            </div>
          </div>

          {/* Monthly Returns Heatmap Matrix */}
          <div className="fin-card p-5">
            <h4 className="text-sm font-bold text-white mb-3">Monthly Returns Performance Heatmap</h4>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 text-center text-xs">
              {result.monthlyReturns.map((m, idx) => (
                <div
                  key={idx}
                  className={`${
                    m.returnPct >= 0 ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400' : 'bg-rose-500/15 border-rose-500/25 text-rose-400'
                  } border p-2 rounded-xl`}
                >
                  <div className="text-[10px] text-gray-400 font-semibold">{m.month}</div>
                  <div className="text-xs font-bold font-mono-num mt-1">
                    {m.returnPct >= 0 ? '+' : ''}{m.returnPct.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
