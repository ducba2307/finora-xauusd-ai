import React, { useState, useEffect } from 'react'
import { Sparkles, Bot, Key, Grid2X2, Square } from 'lucide-react'
import type { CryptoAsset, TradeOrder, AIBotStrategy, UserPortfolio, Position, OrderBook, PublicTrade, AccountBalanceSheet } from '../types/trading'
import { formatCurrency, formatPercent } from '../utils/formatters'
import { TradingViewChart } from './TradingViewChart'
import { MultiChartGrid } from './charting/MultiChartGrid'
import { OrderBookWidget } from './OrderBookWidget'
import { OrderEntryWidget, type PresetSetup } from './OrderEntryWidget'
import { PositionsTable } from './PositionsTable'
import { SwapWidget } from './SwapWidget'
import { AISwarmConsensusWidget } from './AISwarmConsensusWidget'
import { ErrorBoundary, WidgetErrorFallback } from './ErrorBoundary'
import { useLiveMarketFeed } from '../hooks/useLiveMarketFeed'
import { GENERATE_ORDER_BOOK, INITIAL_PUBLIC_TRADES, GENERATE_AI_SWARM_SIGNAL } from '../data/mockData'

interface TradingDashboardProps {
  assets: CryptoAsset[]
  portfolio: UserPortfolio
  trades: TradeOrder[]
  bots: AIBotStrategy[]
  positions: Position[]
  onOpenCopilot: () => void
  onOpenBotManager: () => void
  onOpenApiKeys: () => void
  onOpenAlerts?: (symbol: string, price: number) => void
  onExecuteSwap: (fromToken: string, toToken: string, fromAmount: number, toAmount: number) => void
  onOrderPlaced: (newPosition: Position) => void
  onClosePosition: (positionId: string) => void
  tradingMode: 'PAPER' | 'LIVE'
  balanceSheet?: AccountBalanceSheet
}

export const TradingDashboard: React.FC<TradingDashboardProps> = ({
  assets,
  portfolio,
  trades,
  bots,
  positions,
  onOpenCopilot,
  onOpenBotManager,
  onOpenApiKeys,
  onOpenAlerts,
  onExecuteSwap,
  onOrderPlaced,
  onClosePosition,
  tradingMode,
  balanceSheet,
}) => {
  const [selectedAsset, setSelectedAsset] = useState<CryptoAsset>(assets[0])
  const [timeframe, setTimeframe] = useState<string>('1H')
  const [showAiSignals, setShowAiSignals] = useState<boolean>(true)
  const [activeTab, setActiveTab] = useState<'positions' | 'market' | 'ai_orders'>('positions')
  const [presetSetup, setPresetSetup] = useState<PresetSetup | null>(null)
  const [orderBook, setOrderBook] = useState<OrderBook>(() => GENERATE_ORDER_BOOK(assets[0].price, assets[0].symbol))
  const [publicTrades, setPublicTrades] = useState<PublicTrade[]>(INITIAL_PUBLIC_TRADES)

  // Live Multi-Market WebSocket / Tick Stream
  const liveFeed = useLiveMarketFeed(
    selectedAsset.symbol,
    timeframe,
    selectedAsset.category,
    selectedAsset.price
  )

  const currentPrice = liveFeed.currentPrice
  const tickState = liveFeed.tickDirection

  // Sync order book and trade tape on incoming live ticks (throttled to 150ms to eliminate UI jitter)
  const lastOrderBookUpdateRef = React.useRef<number>(0)
  useEffect(() => {
    const now = Date.now()
    if (now - lastOrderBookUpdateRef.current < 150) {
      return
    }
    lastOrderBookUpdateRef.current = now
    setOrderBook(GENERATE_ORDER_BOOK(liveFeed.currentPrice, selectedAsset.symbol))
    const newTrade: PublicTrade = {
      id: `t-${now}`,
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      price: liveFeed.currentPrice,
      size: Number((0.1 + Math.random() * 1.5).toFixed(3)),
      side: liveFeed.tickDirection === 'up' ? 'BUY' : 'SELL',
    }
    setPublicTrades((pt) => [newTrade, ...pt.slice(0, 15)])
  }, [liveFeed.currentPrice, liveFeed.tickDirection, selectedAsset.symbol])

  // Switch timeframe
  const handleTimeframeChange = (tf: string) => {
    setTimeframe(tf)
  }

  const [marketFilter, setMarketFilter] = useState<'ALL' | 'FOREX' | 'CRYPTO' | 'STOCKS'>('ALL')
  const [chartLayoutMode, setChartLayoutMode] = useState<'SINGLE' | 'MULTI_GRID'>('SINGLE')

  const displayedAssets = assets.filter((a) => marketFilter === 'ALL' || a.category === marketFilter)

  const activeBots = bots.filter((b) => b.status === 'ACTIVE')

  // AI Swarm Signal throttled to symbol changes or significant price movements (>= 0.1%)
  const lastSignalPriceRef = React.useRef<{ symbol: string; price: number }>({
    symbol: selectedAsset.symbol,
    price: selectedAsset.price,
  })
  const [aiSignal, setAiSignal] = useState(() =>
    GENERATE_AI_SWARM_SIGNAL(selectedAsset.symbol, selectedAsset.price)
  )

  useEffect(() => {
    const prev = lastSignalPriceRef.current
    const priceDiff = prev.price > 0 ? Math.abs(liveFeed.currentPrice - prev.price) / prev.price : 1
    if (prev.symbol !== selectedAsset.symbol || priceDiff >= 0.001) {
      lastSignalPriceRef.current = { symbol: selectedAsset.symbol, price: liveFeed.currentPrice }
      setAiSignal(GENERATE_AI_SWARM_SIGNAL(selectedAsset.symbol, liveFeed.currentPrice))
    }
  }, [selectedAsset.symbol, liveFeed.currentPrice])

  return (
    <div className="max-w-[1720px] mx-auto px-2 sm:px-4 py-4 min-h-[calc(100vh-72px)] flex flex-col gap-4">
      {/* Top Ticker Bar with Market Selector & Live Stream */}
      <div className="fin-card px-3 py-2 flex items-center justify-between overflow-x-auto gap-4 no-scrollbar">
        <div className="flex items-center gap-3 shrink-0">
          {/* Quick Market Filter Pill */}
          <div className="flex items-center gap-1 bg-[#080a11] p-1 rounded-xl border border-white/10 text-[11px]">
            <button
              onClick={() => setMarketFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                marketFilter === 'ALL'
                  ? 'bg-white/15 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              All ({assets.length})
            </button>
            <button
              onClick={() => setMarketFilter('STOCKS')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                marketFilter === 'STOCKS'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span>💼 Stocks (NVDA)</span>
            </button>
            <button
              onClick={() => setMarketFilter('FOREX')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                marketFilter === 'FOREX'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span>🏆 Forex &amp; Gold</span>
            </button>
            <button
              onClick={() => setMarketFilter('CRYPTO')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                marketFilter === 'CRYPTO'
                  ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 shadow-[0_0_10px_rgba(236,72,153,0.2)]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span>₿ Crypto</span>
            </button>
          </div>

          <div className="h-5 w-px bg-white/10 mx-1"></div>

          {/* Asset Tickers */}
          {displayedAssets.map((asset) => {
            const isUp = asset.change24h >= 0
            const isSelected = selectedAsset.id === asset.id
            const displayP = asset.id === selectedAsset.id ? currentPrice : asset.price

            return (
              <div
                key={asset.id}
                onClick={() => {
                  setSelectedAsset(asset)
                  setOrderBook(GENERATE_ORDER_BOOK(asset.price, asset.symbol))
                }}
                className={`flex items-center gap-2 py-1 px-2.5 rounded-lg cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-pink-500/15 border border-pink-500/30'
                    : 'hover:bg-white/5 opacity-80 hover:opacity-100'
                }`}
              >
                <img src={asset.icon} alt={asset.name} className="w-4 h-4 rounded-full" />
                <span className="font-bold text-white text-xs">{asset.symbol}</span>
                <span className="font-mono-num font-bold text-xs text-white">
                  {formatCurrency(displayP)}
                </span>
                <span
                  className={`text-[10px] font-mono-num font-semibold ${
                    isUp ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {formatPercent(asset.change24h)}
                </span>
              </div>
            )
          })}
        </div>

        {/* Global Connection Telemetry Indicator & Fast Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Chart Layout Switcher (Single vs 4x4 Multi-Chart) */}
          <div className="flex items-center gap-1 bg-[#080a11] p-1 rounded-xl border border-white/10 text-[11px]">
            <button
              onClick={() => setChartLayoutMode('SINGLE')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                chartLayoutMode === 'SINGLE'
                  ? 'bg-pink-500 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Single Pro Chart View"
            >
              <Square className="w-3 h-3" />
              <span className="hidden sm:inline">Single</span>
            </button>
            <button
              onClick={() => setChartLayoutMode('MULTI_GRID')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                chartLayoutMode === 'MULTI_GRID'
                  ? 'bg-pink-500 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="4x4 Multi-Chart Grid View"
            >
              <Grid2X2 className="w-3 h-3" />
              <span className="hidden sm:inline">4x4 Multi</span>
            </button>
          </div>

          <button
            onClick={onOpenCopilot}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-pink-500/20 text-gray-300 hover:text-pink-400 transition-colors cursor-pointer flex items-center gap-1 text-xs"
            title="Open AI Copilot"
          >
            <Sparkles className="w-3.5 h-3.5 text-pink-400" />
            <span className="hidden sm:inline">AI Copilot</span>
          </button>

          <button
            onClick={onOpenBotManager}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-xs"
            title="Configure Bots"
          >
            <Bot className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline font-mono-num">{activeBots.length} Bots</span>
          </button>

          <button
            onClick={onOpenApiKeys}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
              tradingMode === 'PAPER'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            }`}
          >
            <Key className="w-3 h-3" />
            <span>{tradingMode === 'PAPER' ? 'Paper Simulation' : 'Live API DMA'}</span>
          </button>
        </div>
      </div>

      {/* 4 Financial Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={`fin-card p-3.5 relative overflow-hidden ${tickState === 'up' ? 'tick-flash-up' : tickState === 'down' ? 'tick-flash-down' : ''}`}>
          <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
            <span>Total Equity</span>
            <span className="text-emerald-400 font-bold font-mono-num">
              Cash: {formatCurrency(balanceSheet ? balanceSheet.cashBalance : portfolio.totalBalance)}
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-white font-mono-num">
            {formatCurrency(balanceSheet ? balanceSheet.equity : portfolio.totalBalance)}
          </div>
        </div>

        <div className="fin-card p-3.5">
          <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
            <span>Margin In Use</span>
            <span className="text-cyan-400 font-bold font-mono-num">
              Free: {formatCurrency(balanceSheet ? balanceSheet.freeMargin : (portfolio.totalBalance - portfolio.tradeCapital))}
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-white font-mono-num">
            {formatCurrency(balanceSheet ? balanceSheet.marginUsed : portfolio.tradeCapital)}
          </div>
        </div>

        <div className="fin-card p-3.5">
          <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
            <span>Daily Drawdown</span>
            {balanceSheet?.isCircuitBreakerTripped ? (
              <span className="text-rose-400 font-bold font-mono-num animate-pulse">LOCKED</span>
            ) : (
              <span className="text-emerald-400 font-bold font-mono-num">PROTECTED</span>
            )}
          </div>
          <div className={`text-xl sm:text-2xl font-extrabold font-mono-num ${balanceSheet?.isCircuitBreakerTripped ? 'text-rose-400' : 'text-white'}`}>
            -{balanceSheet ? balanceSheet.dailyDrawdownPct.toFixed(2) : '0.00'}%
          </div>
        </div>

        <div className="fin-card p-3.5">
          <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
            <span>Net Realized Profit</span>
            <span className="text-emerald-400 font-bold font-mono-num">+38.9% ↗</span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-400 font-mono-num">
            {formatCurrency(portfolio.realizedProfit)}
          </div>
        </div>
      </div>

      {/* MAIN TRADING DESK LAYOUT */}
      {chartLayoutMode === 'MULTI_GRID' ? (
        <div className="space-y-4">
          <MultiChartGrid
            assets={assets}
            onOpenCopilot={onOpenCopilot}
            onOpenAlerts={onOpenAlerts}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* CENTER LEFT: Interactive Live Chart (7 Columns) */}
          <div className="lg:col-span-7 space-y-4">
          <ErrorBoundary
            widgetName="TradingView Chart"
            fallback={(error, reset) => (
              <WidgetErrorFallback widgetName="TradingView Chart" error={error} reset={reset} />
            )}
          >
            <TradingViewChart
              symbol={selectedAsset.symbol}
              currentPrice={liveFeed.currentPrice}
              change24h={liveFeed.change24h}
              candles={liveFeed.candles}
              timeframe={timeframe}
              onTimeframeChange={handleTimeframeChange}
              showAiSignals={showAiSignals}
              onToggleAiSignals={() => setShowAiSignals(!showAiSignals)}
              connectionStatus={liveFeed.connectionStatus}
              latencyMs={liveFeed.latencyMs}
              activePositions={positions}
              onOpenAlerts={() => onOpenAlerts?.(selectedAsset.symbol, liveFeed.currentPrice)}
              onExecuteSmcSetup={(setup) => {
                if (setup.direction === 'NONE') return
                const isBuy = setup.direction === 'BUY'
                const isForex = selectedAsset.category === 'FOREX'
                const notionalMult = isForex ? (selectedAsset.symbol.includes('XAU') ? 100 : 100000) : 1
                const size = isForex ? 0.5 : 0.05
                const margin = Number(((size * notionalMult * setup.entryPrice) / 20).toFixed(2))
                const newPos: Position = {
                  id: `pos_smc_${Date.now()}`,
                  symbol: selectedAsset.symbol,
                  side: isBuy ? 'LONG' : 'SHORT',
                  size,
                  entryPrice: setup.entryPrice,
                  markPrice: currentPrice,
                  liquidationPrice: isBuy ? setup.entryPrice * 0.95 : setup.entryPrice * 1.05,
                  leverage: 20,
                  margin,
                  unrealizedPnl: 0,
                  unrealizedPnlPct: 0,
                  tpPrice: setup.takeProfit,
                  slPrice: setup.stopLoss,
                  market: selectedAsset.category,
                  lots: isForex ? size : undefined,
                }
                onOrderPlaced(newPos)
              }}
            />
          </ErrorBoundary>

          {/* AI Multi-Agent Swarm Consensus Panel */}
          <ErrorBoundary
            widgetName="AI Swarm Consensus"
            fallback={(error, reset) => (
              <WidgetErrorFallback widgetName="AI Swarm Consensus" error={error} reset={reset} />
            )}
          >
            <AISwarmConsensusWidget
              signal={aiSignal}
              onApplySignal={(sig) => {
                setPresetSetup({
                  side: sig.side === 'BUY' ? 'LONG' : 'SHORT',
                  entryPrice: sig.entryPrice,
                  slPrice: sig.slPrice,
                  tpPrice: sig.tpPrice,
                  size: sig.recommendedLotsOrSize,
                })
              }}
            />
          </ErrorBoundary>

          {/* Bottom Positions & Orders Desk Tabs */}
          <ErrorBoundary
            widgetName="Positions & Orders Desk"
            fallback={(error, reset) => (
              <WidgetErrorFallback widgetName="Positions & Orders Desk" error={error} reset={reset} />
            )}
          >
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2 text-xs">
                <button
                  onClick={() => setActiveTab('positions')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    activeTab === 'positions'
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Open Positions ({positions.length})
                </button>
                <button
                  onClick={() => setActiveTab('market')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    activeTab === 'market'
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Watchlist &amp; Sparklines
                </button>
                <button
                  onClick={() => setActiveTab('ai_orders')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    activeTab === 'ai_orders'
                      ? 'bg-pink-500/20 text-pink-300'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  AI Fills Log ({trades.length})
                </button>
              </div>

              {activeTab === 'positions' && (
                <PositionsTable
                  positions={positions}
                  onClosePosition={onClosePosition}
                />
              )}

              {activeTab === 'market' && (
                <div className="fin-card p-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/5 text-gray-400 font-semibold">
                        <th className="pb-2.5 pl-2">Asset</th>
                        <th className="pb-2.5 text-right">Price</th>
                        <th className="pb-2.5 text-right">24h Change</th>
                        <th className="pb-2.5 text-center">Trend</th>
                        <th className="pb-2.5 text-right pr-2">AI Signal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {assets.map((asset) => {
                        const isUp = asset.change24h >= 0
                        return (
                          <tr
                            key={asset.id}
                            onClick={() => {
                              setSelectedAsset(asset)
                              setOrderBook(GENERATE_ORDER_BOOK(asset.price, asset.symbol))
                            }}
                            className="hover:bg-white/5 cursor-pointer"
                          >
                            <td className="py-2.5 pl-2">
                              <div className="flex items-center gap-2">
                                <img src={asset.icon} alt={asset.name} className="w-5 h-5 rounded-full" />
                                <span className="font-bold text-white">{asset.name}</span>
                                <span className="text-[10px] text-gray-400 uppercase font-mono-num">{asset.symbol}</span>
                              </div>
                            </td>
                            <td className="py-2.5 text-right font-bold text-white font-mono-num">
                              {formatCurrency(asset.price)}
                            </td>
                            <td className={`py-2.5 text-right font-mono-num font-bold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {formatPercent(asset.change24h)}
                            </td>
                            <td className="py-2.5 text-center">
                              <div className="inline-block w-16 h-5">
                                <svg className="w-full h-full" viewBox="0 0 100 30">
                                  <polyline
                                    fill="none"
                                    stroke={isUp ? '#10b981' : '#f43f5e'}
                                    strokeWidth="2"
                                    points={asset.sparkline
                                      .map((p, idx) => {
                                        const min = Math.min(...asset.sparkline)
                                        const max = Math.max(...asset.sparkline)
                                        const x = (idx / Math.max(1, asset.sparkline.length - 1)) * 100
                                        const y = 30 - ((p - min) / (max - min || 1)) * 26 - 2
                                        return `${x},${y}`
                                      })
                                      .join(' ')}
                                  />
                                </svg>
                              </div>
                            </td>
                            <td className="py-2.5 text-right pr-2">
                              <span className="text-[10px] px-2 py-0.5 rounded font-bold font-mono-num bg-pink-500/20 text-pink-300 border border-pink-500/30">
                                {asset.aiSignal}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'ai_orders' && (
                <div className="fin-card p-4 space-y-2">
                  {trades.map((trade) => (
                    <div key={trade.id} className="p-2.5 rounded-lg bg-[#080a11] border border-white/5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${trade.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                          {trade.type}
                        </span>
                        <span className="font-bold text-white">{trade.amount} {trade.assetSymbol}</span>
                        <span className="text-gray-400 font-mono-num">@ {formatCurrency(trade.price)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-emerald-400 font-mono-num font-bold">+${trade.pnl?.toFixed(2)}</span>
                        <span className="text-[10px] text-gray-500 block">{trade.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ErrorBoundary>
        </div>

        {/* CENTER RIGHT: Order Book (2.5 Columns) */}
        <div className="lg:col-span-2">
          <ErrorBoundary
            widgetName="Order Book Depth"
            fallback={(error, reset) => (
              <WidgetErrorFallback widgetName="Order Book Depth" error={error} reset={reset} />
            )}
          >
            <OrderBookWidget
              symbol={selectedAsset.symbol}
              orderBook={orderBook}
              trades={publicTrades}
              currentPrice={currentPrice}
              onSelectPrice={() => {}}
            />
          </ErrorBoundary>
        </div>

        {/* FAR RIGHT: Advanced Order Execution Desk & Swap (3 Columns) */}
        <div className="lg:col-span-3 space-y-4">
          <ErrorBoundary
            widgetName="Order Execution Desk"
            fallback={(error, reset) => (
              <WidgetErrorFallback widgetName="Order Execution Desk" error={error} reset={reset} />
            )}
          >
            <OrderEntryWidget
              currentPrice={currentPrice}
              symbol={selectedAsset.symbol}
              category={selectedAsset.category}
              userUsdtBalance={portfolio.balances.USDT ?? 0}
              freeMargin={balanceSheet?.freeMargin}
              isCircuitBreakerTripped={balanceSheet?.isCircuitBreakerTripped}
              circuitBreakerReason={balanceSheet?.circuitBreakerReason}
              onOrderPlaced={onOrderPlaced}
              presetSetup={presetSetup}
            />
          </ErrorBoundary>

          <ErrorBoundary
            widgetName="Optimal Route Swap"
            fallback={(error, reset) => (
              <WidgetErrorFallback widgetName="Optimal Route Swap" error={error} reset={reset} />
            )}
          >
            <SwapWidget
              onSwapSuccess={onExecuteSwap}
              userEthBalance={portfolio.balances.ETH ?? 0}
              userUsdtBalance={portfolio.balances.USDT ?? 0}
              balances={portfolio.balances}
            />
          </ErrorBoundary>
        </div>
      </div>
      )}
    </div>
  )
}
