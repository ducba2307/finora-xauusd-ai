import React, { useState } from 'react'
import {
  Grid2X2,
  Square,
  Columns,
  TrendingUp,
  TrendingDown,
  BarChart2
} from 'lucide-react'
import type { CryptoAsset } from '../../types/trading'
import type { MultiChartLayout } from '../../types/aiCharting'
import { GENERATE_CANDLESTICK_SERIES } from '../../data/mockData'
import { TradingViewChart } from '../TradingViewChart'
import { formatPercent } from '../../utils/formatters'

interface MultiChartGridProps {
  assets: CryptoAsset[]
  onOpenCopilot?: () => void
  onOpenAlerts?: (symbol: string, price: number) => void
}

interface PaneConfig {
  id: string
  assetSymbol: string
  timeframe: string
}

export const MultiChartGrid: React.FC<MultiChartGridProps> = ({
  assets,
  onOpenAlerts,
}) => {
  const [layout, setLayout] = useState<MultiChartLayout>('2x2')
  const [panes, setPanes] = useState<PaneConfig[]>([
    { id: 'p1', assetSymbol: 'NVDA', timeframe: '1H' },
    { id: 'p2', assetSymbol: 'TSLA', timeframe: '1H' },
    { id: 'p3', assetSymbol: 'AAPL', timeframe: '1H' },
    { id: 'p4', assetSymbol: 'BTC', timeframe: '1H' },
  ])

  const handleUpdatePaneSymbol = (paneId: string, newSymbol: string) => {
    setPanes((prev) =>
      prev.map((p) => (p.id === paneId ? { ...p, assetSymbol: newSymbol } : p))
    )
  }

  const handleUpdatePaneTimeframe = (paneId: string, newTf: string) => {
    setPanes((prev) =>
      prev.map((p) => (p.id === paneId ? { ...p, timeframe: newTf } : p))
    )
  }

  // How many panes to display based on layout
  const displayedPanes =
    layout === '1x1'
      ? panes.slice(0, 1)
      : layout === '1x2'
      ? panes.slice(0, 2)
      : panes.slice(0, 4)

  const getGridClasses = () => {
    switch (layout) {
      case '1x1':
        return 'grid-cols-1'
      case '1x2':
        return 'grid-cols-1 lg:grid-cols-2'
      case '2x2':
        return 'grid-cols-1 md:grid-cols-2'
      case '4x4':
        return 'grid-cols-2 md:grid-cols-4'
      default:
        return 'grid-cols-1 md:grid-cols-2'
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Multi-Chart Header & Layout Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#0a0d17] border border-white/10 rounded-xl">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-pink-400" />
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Institutional Multi-Chart Layouts</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                Unlimited Free Pro Tier
              </span>
            </h3>
            <span className="text-xs text-gray-400">
              Synchronized 1x1, 1x2, 2x2, and 4x4 matrix view across Stocks, Crypto &amp; Forex
            </span>
          </div>
        </div>

        {/* Layout Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-[#101423] border border-white/10 rounded-xl text-xs">
          <button
            onClick={() => setLayout('1x1')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold transition-all cursor-pointer ${
              layout === '1x1'
                ? 'bg-pink-500 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Square className="w-3.5 h-3.5" />
            <span>1x1 Single</span>
          </button>
          <button
            onClick={() => setLayout('1x2')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold transition-all cursor-pointer ${
              layout === '1x2'
                ? 'bg-pink-500 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>1x2 Split</span>
          </button>
          <button
            onClick={() => setLayout('2x2')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold transition-all cursor-pointer ${
              layout === '2x2'
                ? 'bg-pink-500 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Grid2X2 className="w-3.5 h-3.5" />
            <span>2x2 Quad</span>
          </button>
        </div>
      </div>

      {/* Grid of Chart Panes */}
      <div className={`grid gap-4 ${getGridClasses()}`}>
        {displayedPanes.map((pane) => {
          const matchedAsset =
            assets.find((a) => a.symbol === pane.assetSymbol || a.id === pane.assetSymbol.toLowerCase()) ||
            assets[0]
          const candles = GENERATE_CANDLESTICK_SERIES(matchedAsset.symbol, pane.timeframe, 60)
          const isUp = matchedAsset.change24h >= 0

          return (
            <div
              key={pane.id}
              className="bg-[#07090f] border border-white/10 rounded-2xl overflow-hidden shadow-xl flex flex-col"
            >
              {/* Pane Control Header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#0b0e19] border-b border-white/10 text-xs">
                {/* Asset Select Dropdown */}
                <div className="flex items-center gap-2">
                  <select
                    value={matchedAsset.symbol}
                    onChange={(e) => handleUpdatePaneSymbol(pane.id, e.target.value)}
                    className="bg-[#101423] text-white border border-white/10 rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none focus:border-pink-500"
                  >
                    {assets.map((ast) => (
                      <option key={ast.symbol} value={ast.symbol}>
                        {ast.symbol} - {ast.name}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-white font-bold">${matchedAsset.price.toFixed(2)}</span>
                    <span
                      className={`text-[11px] font-semibold flex items-center ${
                        isUp ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isUp ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                      {formatPercent(matchedAsset.change24h)}
                    </span>
                  </div>
                </div>

                {/* Timeframe Switcher */}
                <div className="flex items-center gap-1">
                  {['5m', '15m', '1H', '4H', '1D'].map((tf) => (
                    <button
                      key={tf}
                      onClick={() => handleUpdatePaneTimeframe(pane.id, tf)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                        pane.timeframe === tf
                          ? 'bg-pink-500 text-white font-bold'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart Body */}
              <div className="p-2 flex-1">
                <TradingViewChart
                  symbol={matchedAsset.symbol}
                  currentPrice={matchedAsset.price}
                  change24h={matchedAsset.change24h}
                  candles={candles}
                  timeframe={pane.timeframe}
                  onTimeframeChange={(tf) => handleUpdatePaneTimeframe(pane.id, tf)}
                  showAiSignals={true}
                  onToggleAiSignals={() => {}}
                  onOpenAlerts={() => onOpenAlerts && onOpenAlerts(matchedAsset.symbol, matchedAsset.price)}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
