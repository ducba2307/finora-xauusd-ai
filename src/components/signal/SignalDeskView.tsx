// oxlint-disable react/set-state-in-effect
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Sparkles,
  Activity,
  TrendingUp,
  TrendingDown,
  Zap,
  CheckCircle2,
  Play,
  History,
} from 'lucide-react'
import type { Position, AccountBalanceSheet } from '../../types/trading'
import { useLiveMarketFeed } from '../../hooks/useLiveMarketFeed'
import { TradingViewChart } from '../TradingViewChart'
import { HeroSignalCard } from './HeroSignalCard'
import { ConfluenceGaugeWidget } from './ConfluenceGaugeWidget'
import { MacroNewsSafetyBanner } from './MacroNewsSafetyBanner'
import { SignalHistoryLedger } from './SignalHistoryLedger'
import {
  evaluateTechnicalConfluence,
  type TechnicalConfluenceReport,
} from '../../quant/confluenceEngine'
import { getOrGenerateAIScenario } from '../../services/aiScenarioEngine'
import type { AIScenarioResult } from '../../services/apiThrottleCacheService'
import {
  signalLifecycleManager,
  type TrackedSignal,
  type SignalLedgerStats,
} from '../../services/signalLifecycleManager'
import { checkNewsBlackoutStatus, calculatePositionLotSize } from '../../engine/riskEngine'
import { playOrderFilledSound, playClickSound } from '../../utils/soundEffects'
import { formatCurrency, formatPercent } from '../../utils/formatters'

interface SignalDeskViewProps {
  currentGoldPrice?: number
  onOrderPlaced?: (position: Position) => void
  balanceSheet?: AccountBalanceSheet
}

export const SignalDeskView: React.FC<SignalDeskViewProps> = ({
  currentGoldPrice = 4155.50,
  onOrderPlaced,
  balanceSheet,
}) => {
  const [timeframe, setTimeframe] = useState<string>('15m')
  const [mobileTab, setMobileTab] = useState<'SIGNALS' | 'CHART' | 'HISTORY'>('SIGNALS')
  const [isLoadingScenario, setIsLoadingScenario] = useState<boolean>(false)
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0)
  const [activeScenario, setActiveScenario] = useState<AIScenarioResult | null>(null)
  const [orderLots, setOrderLots] = useState<number>(0.5)
  const [orderFeedback, setOrderFeedback] = useState<string | null>(null)

  // Live real-time market data feed for Spot Gold (XAU/USD)
  const liveMarket = useLiveMarketFeed('XAU/USD', timeframe, 'FOREX', currentGoldPrice)
  const { currentPrice, candles, change24h, connectionStatus, latencyMs, tickDirection } = liveMarket

  // Tracked signals and performance stats from the Signal Lifecycle Manager
  const [signals, setSignals] = useState<TrackedSignal[]>(() => signalLifecycleManager.getSignals())
  const [stats, setStats] = useState<SignalLedgerStats>(() => signalLifecycleManager.getStats())

  // News Blackout status
  const newsStatus = useMemo(() => checkNewsBlackoutStatus(), [])

  // Subscribe to signal state changes
  useEffect(() => {
    const unsubscribe = signalLifecycleManager.subscribe((updatedSignals, updatedStats) => {
      setSignals(updatedSignals)
      setStats(updatedStats)
    })
    return unsubscribe
  }, [])

  // Cooldown timer interval for anti-spam protection
  useEffect(() => {
    if (cooldownSeconds <= 0) return
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldownSeconds])

  // Process price ticks into signal lifecycle (triggers TP, BE, SL)
  useEffect(() => {
    if (currentPrice > 0 && candles.length > 0) {
      const lastCandleTime = candles[candles.length - 1].time
      signalLifecycleManager.processPriceTick('XAU/USD', currentPrice, lastCandleTime)
    }
  }, [currentPrice, candles])

  // Evaluate Technical Confluence (Layer 1 deterministic quantitative engine)
  const confluenceReport = useMemo<TechnicalConfluenceReport | null>(() => {
    if (!candles || candles.length < 20) return null
    return evaluateTechnicalConfluence(candles, currentPrice, 'XAU/USD', timeframe)
  }, [candles, currentPrice, timeframe])

  // Fetch or generate AI Scenario (Layer 2 9Router AI + Layer 3 Risk Management)
  const runAnalysis = useCallback(
    async (forceFresh: boolean = false) => {
      if (candles.length < 20 || isLoadingScenario) return

      setIsLoadingScenario(true)
      try {
        const report = confluenceReport ?? evaluateTechnicalConfluence(candles, currentPrice, 'XAU/USD', timeframe)
        const scenario = await getOrGenerateAIScenario(report, forceFresh)
        setActiveScenario(scenario)

        // Register into the lifecycle state machine if tradeable recommendation
        if (scenario.recommendation !== 'WAIT') {
          signalLifecycleManager.registerSignal(scenario, timeframe)
        }
      } catch (err) {
        console.error('Error generating AI scenario:', err)
      } finally {
        setIsLoadingScenario(false)
      }
    },
    [candles, currentPrice, timeframe, isLoadingScenario, confluenceReport]
  )

  // Initial load trigger on candle availability
  useEffect(() => {
    if (candles && candles.length >= 20 && !activeScenario && !isLoadingScenario) {
      void runAnalysis(false)
    }
  }, [candles, activeScenario, isLoadingScenario, runAnalysis])

  // Manual Refresh Handler with 60s anti-spam cooldown
  const handleManualRefresh = () => {
    if (cooldownSeconds > 0 || isLoadingScenario) return
    playClickSound()
    setCooldownSeconds(60)
    void runAnalysis(true)
  }

  // Handle direct 1-click execution into Paper Trading
  const handleExecuteTrade = () => {
    if (!activeScenario || activeScenario.recommendation === 'WAIT') return

    playClickSound()
    const side = activeScenario.recommendation === 'BUY' ? 'LONG' : 'SHORT'
    const entryPrice = activeScenario.execution_plan.entry_price || currentPrice
    const stopLoss = activeScenario.execution_plan.stop_loss
    const takeProfit1 = activeScenario.execution_plan.take_profit_1

    const newPos: Position = {
      id: `pos-${Date.now()}`,
      symbol: 'XAU/USD',
      side,
      size: orderLots * 100,
      lots: orderLots,
      entryPrice,
      markPrice: currentPrice,
      liquidationPrice: side === 'LONG' ? stopLoss * 0.95 : stopLoss * 1.05,
      leverage: 100,
      margin: (orderLots * 100 * currentPrice) / 100,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      slPrice: stopLoss,
      tpPrice: takeProfit1,
      market: 'FOREX',
    }

    if (onOrderPlaced) {
      onOrderPlaced(newPos)
    }
    playOrderFilledSound()
    setOrderFeedback(`Đã khớp lệnh ${side} ${orderLots} lots XAU/USD tại $${newPos.entryPrice.toFixed(2)}!`)
    setTimeout(() => setOrderFeedback(null), 4000)
  }

  // Calculate dynamic suggested lot size based on account balance & risk (1% account equity)
  const suggestedLotSize = useMemo(() => {
    if (!activeScenario || !activeScenario.execution_plan?.stop_loss || !balanceSheet) return 0.5
    const equity = balanceSheet.equity || 50000
    const calculation = calculatePositionLotSize(
      equity,
      1.0,
      activeScenario.execution_plan.entry_price,
      activeScenario.execution_plan.stop_loss,
      'XAU/USD'
    )
    return calculation.lots
  }, [activeScenario, balanceSheet])

  const isBuy = activeScenario?.recommendation === 'BUY'

  return (
    <div className="space-y-3 sm:space-y-4 max-w-7xl mx-auto px-2 sm:px-4 pb-28 lg:pb-12 pt-1 animate-fadeIn overflow-x-hidden">
      {/* Top Ticker Header - Responsive Desktop & Mobile */}
      <div className="bg-[#080b14] border border-white/10 rounded-2xl p-3 sm:p-4 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Row 1: Symbol, Category & Realtime Price */}
          <div className="flex items-center justify-between lg:justify-start gap-3 sm:gap-4 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm shadow-inner shrink-0">
                Au
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h1 className="font-black text-white text-base sm:text-lg tracking-tight">XAU/USD</h1>
                  <span className="text-[9px] sm:text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-bold uppercase">
                    Gold Spot
                  </span>
                  <span className="hidden sm:inline-block text-[9px] sm:text-[10px] bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.2 rounded font-mono">
                    Fix 4173
                  </span>
                </div>
                <div className="text-[10px] sm:text-[11px] text-gray-400 truncate">Hệ Thống Phân Tích Định Lượng &amp; AI 24/7</div>
              </div>
            </div>

            {/* Price & 24h Change */}
            <div className="flex items-center gap-3 border-l border-white/10 pl-3 sm:pl-4 ml-auto lg:ml-0">
              <div>
                <div className="text-[9px] text-gray-500 uppercase font-semibold">Giá Hiện Tại</div>
                <div
                  className={`text-base sm:text-xl font-black font-mono tracking-tight tabular-nums flex items-center gap-1 transition-colors duration-200 ${
                    tickDirection === 'up'
                      ? 'text-emerald-400'
                      : tickDirection === 'down'
                      ? 'text-rose-400'
                      : 'text-white'
                  }`}
                >
                  ${currentPrice.toFixed(2)}
                  {tickDirection === 'up' && <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
                  {tickDirection === 'down' && <TrendingDown className="w-3.5 h-3.5 text-rose-400" />}
                </div>
              </div>

              <div>
                <div className="text-[9px] text-gray-500 uppercase font-semibold">24h Change</div>
                <div
                  className={`text-xs sm:text-sm font-bold font-mono tabular-nums ${
                    change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {formatPercent(change24h)}
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Timeframe Pills & Network Telemetry */}
          <div className="flex items-center justify-between lg:justify-end gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-white/5">
            {/* Timeframe Buttons */}
            <div className="flex items-center bg-[#0d1222] p-1 rounded-xl border border-white/5 overflow-x-auto no-scrollbar">
              {['5m', '15m', '1H', '4H'].map((tf) => (
                <button
                  key={tf}
                  onClick={() => {
                    setTimeframe(tf)
                    playClickSound()
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    timeframe === tf
                      ? 'bg-cyan-500 text-black font-bold shadow-md'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            {/* Connection Status */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-[10px] sm:text-[11px] font-mono shrink-0">
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'LIVE_WS'
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-amber-400'
                }`}
              />
              <span className="text-gray-300">
                {connectionStatus === 'LIVE_WS' ? 'WS Live' : 'Feed Chuẩn'}
              </span>
              <span className="text-gray-500 font-mono-num">({latencyMs}ms)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Safety Banner (Macro Economic News Blackout Check) */}
      <MacroNewsSafetyBanner
        isBlackoutActive={newsStatus.isBlackoutActive}
        message={newsStatus.message}
        nextNewsTitle={newsStatus.activeEventTitle}
        minutesUntilNextNews={newsStatus.minutesDelta}
      />

      {/* Mobile 3-Segment Switcher (Visible on < 1024px) */}
      <div className="flex lg:hidden bg-[#0c101d] p-1 rounded-2xl border border-white/10 shadow-lg">
        <button
          onClick={() => {
            setMobileTab('SIGNALS')
            playClickSound()
          }}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            mobileTab === 'SIGNALS'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Tín Hiệu AI</span>
        </button>

        <button
          onClick={() => {
            setMobileTab('CHART')
            playClickSound()
          }}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            mobileTab === 'CHART'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span>Biểu Đồ</span>
        </button>

        <button
          onClick={() => {
            setMobileTab('HISTORY')
            playClickSound()
          }}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            mobileTab === 'HISTORY'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5 text-pink-400" />
          <span>Sổ Cái Lệnh</span>
        </button>
      </div>

      {/* Main Grid: Responsive 12 columns on Desktop, Switchable Tabs on Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Interactive Chart + Quick Order Panel (7 Cols on Desktop) */}
        <div
          className={`lg:col-span-7 space-y-4 ${
            mobileTab === 'CHART' ? 'block' : 'hidden lg:block'
          }`}
        >
          {/* Chart Wrapper with clean height */}
          <div className="bg-[#080b14] border border-white/10 rounded-2xl p-2 sm:p-4 shadow-xl">
            <div className="h-[380px] sm:h-[460px] lg:h-[520px] w-full">
              <TradingViewChart
                symbol="XAU/USD"
                currentPrice={currentPrice}
                change24h={change24h}
                candles={candles}
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
                showAiSignals={true}
                onToggleAiSignals={() => {}}
                connectionStatus={connectionStatus}
                latencyMs={latencyMs}
              />
            </div>
          </div>

          {/* Quick Trade Execution Action Bar (Desktop Dock) */}
          <div className="bg-[#080b14] border border-white/10 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-white text-xs uppercase tracking-wider">
                  Khớp Lệnh Nhanh Theo Tín Hiệu AI (Paper Trading)
                </h3>
              </div>
              <div className="text-[11px] text-gray-400 font-mono">
                Số dư: <span className="text-white font-bold tabular-nums">{formatCurrency(balanceSheet?.equity ?? 50819.20)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3">
              {/* Lot selector */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400 font-medium">Khối lượng:</span>
                <div className="flex items-center bg-[#0d1222] p-1 rounded-xl border border-white/5">
                  {[0.1, 0.25, 0.5, 1.0].map((l) => (
                    <button
                      key={l}
                      onClick={() => setOrderLots(l)}
                      className={`px-2.5 py-1 text-xs font-mono tabular-nums rounded-lg transition-all cursor-pointer ${
                        orderLots === l
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {l} Lot
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-gray-500 italic hidden sm:inline tabular-nums">
                  (Khuyên dùng: {suggestedLotSize} Lot = 1% rủi ro)
                </span>
              </div>

              {/* Action Button */}
              <button
                onClick={handleExecuteTrade}
                disabled={!activeScenario || activeScenario.recommendation === 'WAIT'}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black shadow-lg transition-all cursor-pointer ${
                  !activeScenario || activeScenario.recommendation === 'WAIT'
                    ? 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                    : isBuy
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black hover:brightness-110 shadow-emerald-500/25'
                    : 'bg-gradient-to-r from-rose-500 to-red-600 text-white hover:brightness-110 shadow-rose-500/25'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span className="tabular-nums">
                  {activeScenario?.recommendation === 'BUY'
                    ? `MUA ${orderLots} LOT NGAY ($${activeScenario.execution_plan.entry_price.toFixed(2)})`
                    : activeScenario?.recommendation === 'SELL'
                    ? `BÁN ${orderLots} LOT NGAY ($${activeScenario.execution_plan.entry_price.toFixed(2)})`
                    : 'ĐANG CHỜ TÍN HIỆU'}
                </span>
              </button>
            </div>

            {orderFeedback && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-3 py-2 rounded-xl flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{orderFeedback}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Signal Hero Card, Confluence Gauge, Signal History (5 Cols on Desktop) */}
        <div
          className={`lg:col-span-5 space-y-4 ${
            mobileTab === 'SIGNALS' || mobileTab === 'HISTORY' ? 'block' : 'hidden lg:block'
          }`}
        >
          {/* Hero Signal Card (Visible on Desktop or when mobileTab === 'SIGNALS') */}
          <div className={mobileTab === 'HISTORY' ? 'hidden lg:block' : 'block'}>
            <HeroSignalCard
              scenario={activeScenario}
              currentPrice={currentPrice}
              onManualRefresh={handleManualRefresh}
              cooldownSeconds={cooldownSeconds}
              isLoading={isLoadingScenario}
            />
          </div>

          {/* Confluence Gauge Widget */}
          <div className={mobileTab === 'HISTORY' ? 'hidden lg:block' : 'block'}>
            <ConfluenceGaugeWidget report={confluenceReport} />
          </div>

          {/* Signal History & Realized Win-Rate Ledger (Visible on Desktop or when mobileTab === 'HISTORY') */}
          <div className={mobileTab === 'SIGNALS' ? 'hidden lg:block' : 'block'}>
            <SignalHistoryLedger signals={signals} stats={stats} />
          </div>
        </div>
      </div>

      {/* Sticky Bottom Execution Bar on Mobile (< 1024px) - Institutional Mobile Ergonomics */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-[#070914]/95 backdrop-blur-2xl border-t border-white/10 px-3 pt-2.5 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
        <div className="flex items-center justify-between gap-2 max-w-md mx-auto">
          {/* Quick Lot selector pills */}
          <div className="flex items-center bg-[#0d1222] p-0.5 rounded-xl border border-white/10 shrink-0">
            {[0.1, 0.5, 1.0].map((l) => (
              <button
                key={l}
                onClick={() => {
                  setOrderLots(l)
                  playClickSound()
                }}
                className={`px-2 py-1.5 text-[11px] font-mono tabular-nums rounded-lg transition-all cursor-pointer ${
                  orderLots === l
                    ? 'bg-amber-500/25 text-amber-300 font-bold border border-amber-500/40'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {l}L
              </button>
            ))}
          </div>

          {/* Full-width 48px touch-target execution button */}
          <button
            onClick={handleExecuteTrade}
            disabled={!activeScenario || activeScenario.recommendation === 'WAIT'}
            className={`flex-1 h-11 px-4 rounded-xl text-xs font-black shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              !activeScenario || activeScenario.recommendation === 'WAIT'
                ? 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                : isBuy
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black hover:brightness-110 shadow-emerald-500/25'
                : 'bg-gradient-to-r from-rose-500 to-red-600 text-white hover:brightness-110 shadow-rose-500/25'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span className="tabular-nums truncate font-bold">
              {activeScenario?.recommendation === 'BUY'
                ? `MUA ${orderLots}L ($${activeScenario.execution_plan.entry_price.toFixed(2)})`
                : activeScenario?.recommendation === 'SELL'
                ? `BÁN ${orderLots}L ($${activeScenario.execution_plan.entry_price.toFixed(2)})`
                : 'CHỜ TÍN HIỆU'}
            </span>
          </button>
        </div>

        {orderFeedback && (
          <div className="mt-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] px-2.5 py-1.5 rounded-xl flex items-center justify-center gap-1.5 animate-fadeIn">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">{orderFeedback}</span>
          </div>
        )}
      </div>
    </div>
  )
}
