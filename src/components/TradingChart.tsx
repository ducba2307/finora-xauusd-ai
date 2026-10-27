import React, { useState, useMemo } from 'react'
import { formatCurrency, formatPercent } from '../utils/formatters'
import type { ChartDataPoint } from '../types/trading'
import { Sparkles, TrendingUp, BarChart2, ShieldCheck } from 'lucide-react'

interface TradingChartProps {
  symbol: string
  currentPrice: number
  change24h: number
  dataPoints: ChartDataPoint[]
  timeframe: string
  onTimeframeChange: (tf: string) => void
  showAiSignals: boolean
  onToggleAiSignals: () => void
}

export const TradingChart: React.FC<TradingChartProps> = ({
  symbol,
  currentPrice,
  change24h,
  dataPoints,
  timeframe,
  onTimeframeChange,
  showAiSignals,
  onToggleAiSignals,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const timeframes = ['1D', '7D', '1M', '3M', '1Y', 'All']

  const { minPrice, maxPrice, pointsSvg, areaSvg, coords } = useMemo(() => {
    if (!dataPoints.length) {
      return { minPrice: 0, maxPrice: 0, pointsSvg: '', areaSvg: '', coords: [] }
    }
    const prices = dataPoints.map((d) => d.price)
    const min = Math.min(...prices) * 0.992
    const max = Math.max(...prices) * 1.008

    const width = 800
    const height = 280

    const mappedCoords = dataPoints.map((d, index) => {
      const denom = Math.max(1, dataPoints.length - 1)
      const range = max - min || 1
      const x = (index / denom) * width
      const y = height - ((d.price - min) / range) * (height - 30) - 15
      return { x, y, data: d }
    })


    const linePath = mappedCoords.reduce((acc, curr, idx) => {
      if (idx === 0) return `M ${curr.x} ${curr.y}`
      return `${acc} L ${curr.x} ${curr.y}`
    }, '')

    const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`

    return { minPrice: min, maxPrice: max, pointsSvg: linePath, areaSvg: areaPath, coords: mappedCoords }
  }, [dataPoints])

  const activePoint = hoverIndex !== null ? coords[hoverIndex] : coords[coords.length - 1]
  const displayPrice = activePoint ? activePoint.data.price : currentPrice
  const isPositive = change24h >= 0

  return (
    <div className="fin-card p-5 relative overflow-hidden flex flex-col justify-between">
      {/* Chart Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs border border-amber-500/30">
              ₿
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              {symbol} <span className="text-sm font-normal text-gray-400">({symbol === 'BTC' ? 'Bitcoin' : symbol})</span>
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-mono-num font-semibold border border-emerald-500/30 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Live Feed
            </span>
          </div>

          <div className="flex items-baseline gap-3 mt-1.5">
            <span className="text-3xl font-extrabold tracking-tight text-white font-mono-num">
              {formatCurrency(displayPrice)}
            </span>
            <span
              className={`text-sm font-bold font-mono-num flex items-center gap-1 ${
                isPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isPositive ? '▲' : '▼'} {formatPercent(change24h)}
              <span className="text-xs text-gray-400 font-normal ml-1">
                ({isPositive ? '+' : ''}${Math.abs(currentPrice * (change24h / 100)).toFixed(2)})
              </span>
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* AI Signal Overlay Toggle */}
          <button
            onClick={onToggleAiSignals}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              showAiSignals
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.4)]'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/5'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Alpha Signals</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          </button>

          {/* Timeframe Selector matching Coinza */}
          <div className="flex items-center bg-[#07090f] p-1 rounded-xl border border-white/10">
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => onTimeframeChange(tf)}
                className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-all cursor-pointer ${
                  timeframe === tf
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SVG Interactive Chart Canvas */}
      <div className="relative w-full h-[280px] select-none my-2">
        {/* Background Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
          <div className="border-b border-white/15 w-full flex justify-between text-[10px] text-gray-400 font-mono-num">
            <span>{formatCurrency(maxPrice)}</span>
          </div>
          <div className="border-b border-white/15 w-full"></div>
          <div className="border-b border-white/15 w-full"></div>
          <div className="border-b border-white/15 w-full flex justify-between text-[10px] text-gray-400 font-mono-num">
            <span>{formatCurrency(minPrice)}</span>
          </div>
        </div>

        {/* SVG Drawing */}
        <svg
          viewBox="0 0 800 280"
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="chartGradientGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
              <stop offset="85%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="chartGradientPink" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ec4899" stopOpacity="0.35" />
              <stop offset="85%" stopColor="#ec4899" stopOpacity="0.0" />
            </linearGradient>
            <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#10b981" floodOpacity="0.8" />
            </filter>
          </defs>

          {/* Area fill */}
          <path
            d={areaSvg}
            fill="url(#chartGradientGreen)"
          />

          {/* Line stroke */}
          <path
            d={pointsSvg}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#neonGlow)"
          />

          {/* AI Signal Markers Overlay */}
          {showAiSignals &&
            coords.map((c, i) => {
              if (!c.data.signal) return null
              const isBuy = c.data.signal === 'BUY'
              return (
                <g key={`signal-${i}`} transform={`translate(${c.x}, ${c.y})`}>
                  {/* Vertical dashed line */}
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2={280 - c.y}
                    stroke={isBuy ? '#10b981' : '#ec4899'}
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity="0.6"
                  />
                  {/* Signal marker bubble */}
                  <circle
                    cx="0"
                    cy="0"
                    r="6"
                    fill={isBuy ? '#10b981' : '#ec4899'}
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="animate-pulse"
                  />
                  {/* Signal label tag */}
                  <rect
                    x="-60"
                    y={isBuy ? "-34" : "12"}
                    width="120"
                    height="22"
                    rx="6"
                    fill="#0b0d14"
                    stroke={isBuy ? '#10b981' : '#ec4899'}
                    strokeWidth="1.2"
                  />
                  <text
                    x="0"
                    y={isBuy ? "-20" : "26"}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="9.5"
                    fontWeight="bold"
                    fontFamily="Plus Jakarta Sans"
                  >
                    {isBuy ? '⚡ AI STRONG BUY' : '🎯 TAKE PROFIT'}
                  </text>
                </g>
              )
            })}

          {/* Active Hover Crosshair Point */}
          {activePoint && (
            <g transform={`translate(${activePoint.x}, ${activePoint.y})`}>
              <line
                x1="0"
                y1={-activePoint.y}
                x2="0"
                y2={280 - activePoint.y}
                stroke="rgba(255, 255, 255, 0.4)"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <circle cx="0" cy="0" r="7" fill="#ffffff" stroke="#10b981" strokeWidth="3" />
              <circle cx="0" cy="0" r="14" fill="#10b981" opacity="0.3" className="animate-ping" />
            </g>
          )}

          {/* Invisible hover detector bars */}
          {coords.map((c, i) => (
            <rect
              key={`detector-${i}`}
              x={c.x - (800 / coords.length) / 2}
              y="0"
              width={800 / coords.length}
              height="280"
              fill="transparent"
              className="cursor-crosshair"
              onMouseEnter={() => setHoverIndex(i)}
            />
          ))}
        </svg>

        {/* Floating Tooltip Box matching Image 3 style */}
        {activePoint && (
          <div
            className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-full transition-all duration-75"
            style={{
              left: `${(activePoint.x / 800) * 100}%`,
              top: `${Math.max(15, activePoint.y - 12)}px`,
            }}
          >
            <div className="bg-[#0b0e14]/95 border border-white/20 px-3 py-1.5 rounded-xl shadow-2xl backdrop-blur-md text-center min-w-[120px]">
              <div className="text-[10px] text-gray-400 font-medium">
                {activePoint.data.timestamp}
              </div>
              <div className="text-xs font-bold text-white font-mono-num">
                {formatCurrency(activePoint.data.price)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chart Footer Indicator Bar */}
      <div className="flex flex-wrap items-center justify-between pt-3 border-t border-white/5 text-xs text-gray-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-gray-300">
            <BarChart2 className="w-3.5 h-3.5 text-pink-400" />
            24h Vol: <strong className="text-white font-mono-num">$18.74B</strong>
          </span>
          <span className="flex items-center gap-1.5 text-gray-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            AI Confidence: <strong className="text-emerald-400 font-mono-num">96.4%</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400">Model:</span>
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 text-pink-300 border border-pink-500/20 font-mono-num font-semibold">
            Finora Transformer-v4.8
          </span>
        </div>
      </div>
    </div>
  )
}
