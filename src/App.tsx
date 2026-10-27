import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Navbar, type NavView } from './components/Navbar'
import { LandingPage } from './components/LandingPage'
import { TradingDashboard } from './components/TradingDashboard'
import { QuantStudioView } from './components/QuantStudioView'
import { WhaleRadarView } from './components/WhaleRadarView'
import { PortfolioView } from './components/PortfolioView'
import { AIIntelligenceView } from './components/AIIntelligenceView'
import { TraderToolsView } from './components/TraderToolsView'
import { AICopilotModal } from './components/AICopilotModal'
import { BotControlModal } from './components/BotControlModal'
import { ApiKeysModal } from './components/ApiKeysModal'
import { PriceAlertModal } from './components/PriceAlertModal'
import { TradingJournalView } from './components/TradingJournalView'
import { ErrorBoundary, ViewErrorFallback } from './components/ErrorBoundary'
import { NewsTradingDeskView } from './components/NewsTradingDeskView'
import { SignalDeskView } from './components/signal/SignalDeskView'
import { Footer } from './components/Footer'
import { 
  INITIAL_ASSETS, 
  INITIAL_PORTFOLIO, 
  INITIAL_AI_BOTS, 
  INITIAL_TRADES,
  INITIAL_POSITIONS
} from './data/mockData'
import type { CryptoAsset, UserPortfolio, AIBotStrategy, TradeOrder, Position, PriceAlert, AccountBalanceSheet } from './types/trading'
import { playOrderFilledSound, playTakeProfitSound, playStopLossSound } from './utils/soundEffects'
import { defaultMarketStore } from './stores/marketStore'
import { recalculateBalanceSheet, evaluateOrderRisk, calculatePositionPnl } from './engine/riskEngine'
import { checkPositionExitTriggers, updateTrailingStop, processOrderPipeline, settlePositionExit, isForexSymbol, type ExitReason } from './engine/orderLifecycle'
import { defaultBotEngine } from './engine/botEngine'

const INITIAL_ALERTS: PriceAlert[] = [
  {
    id: 'alt-1',
    symbol: 'BTC/USDT',
    targetPrice: 118000,
    condition: 'ABOVE',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    triggered: false,
  },
  {
    id: 'alt-2',
    symbol: 'XAU/USD',
    targetPrice: 2750,
    condition: 'ABOVE',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    triggered: false,
  },
  {
    id: 'alt-3',
    symbol: 'ETH/USDT',
    targetPrice: 3100,
    condition: 'BELOW',
    createdAt: new Date(Date.now() - 10800000).toISOString(),
    triggered: false,
  },
]

export default function App() {
  const [currentView, setCurrentView] = useState<NavView>('signal_desk')
  const [assets] = useState<CryptoAsset[]>(INITIAL_ASSETS)
  const [portfolio, setPortfolio] = useState<UserPortfolio>(INITIAL_PORTFOLIO)
  const [bots, setBots] = useState<AIBotStrategy[]>(INITIAL_AI_BOTS)
  const [trades, setTrades] = useState<TradeOrder[]>(INITIAL_TRADES)
  const [positions, setPositions] = useState<Position[]>(INITIAL_POSITIONS)
  const [alerts, setAlerts] = useState<PriceAlert[]>(INITIAL_ALERTS)
  const [tradingMode, setTradingMode] = useState<'PAPER' | 'LIVE'>('PAPER')

  const [isCopilotOpen, setIsCopilotOpen] = useState(false)
  const [isBotManagerOpen, setIsBotManagerOpen] = useState(false)
  const [isApiKeysOpen, setIsApiKeysOpen] = useState(false)
  const [isAlertsOpen, setIsAlertsOpen] = useState(false)
  const [alertTarget, setAlertTarget] = useState<{ symbol: string; price: number }>({ symbol: 'BTC/USDT', price: 114884 })
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 4500)
  }, [])

  // Memory-bounded history thresholds (F14)
  const MAX_TRADE_HISTORY = 100
  const MAX_ALERT_HISTORY = 50

  // Milestone 3: Daily Equity & Balance Sheet Tracking
  const INITIAL_DAILY_START = 50819.20
  const [dailyStartEquity] = useState<number>(INITIAL_DAILY_START)
  const [peakDailyEquity, setPeakDailyEquity] = useState<number>(INITIAL_DAILY_START)

  // Derived dynamic Account Balance Sheet
  const balanceSheet = useMemo<AccountBalanceSheet>(() => {
    return recalculateBalanceSheet(positions, portfolio.totalBalance, peakDailyEquity, dailyStartEquity)
  }, [positions, portfolio.totalBalance, peakDailyEquity, dailyStartEquity])

  // Ratchet peakDailyEquity during render when account equity reaches a new high
  if (balanceSheet.equity > peakDailyEquity) {
    setPeakDailyEquity(balanceSheet.equity)
  }

  // Synchronize Bot Instance status during render on circuit breaker state transitions
  const [prevTrippedState, setPrevTrippedState] = useState(false)
  if (balanceSheet.isCircuitBreakerTripped !== prevTrippedState) {
    setPrevTrippedState(balanceSheet.isCircuitBreakerTripped)
    if (balanceSheet.isCircuitBreakerTripped) {
      setBots((prev) =>
        prev.map((b) => (b.status === 'ACTIVE' ? { ...b, status: 'LOCKED_BY_CIRCUIT_BREAKER' } : b))
      )
    } else {
      setBots((prev) =>
        prev.map((b) => (b.status === 'LOCKED_BY_CIRCUIT_BREAKER' ? { ...b, status: 'ACTIVE' } : b))
      )
    }
  }

  // Circuit breaker trip monitor: trigger external engine lock/unlock, audio and toast
  const prevTrippedRef = useRef(false)
  useEffect(() => {
    if (balanceSheet.isCircuitBreakerTripped) {
      defaultBotEngine.lockAllBots()
      if (!prevTrippedRef.current) {
        prevTrippedRef.current = true
        playStopLossSound()
        showToast(
          `CRITICAL RISK ALERT: Daily Drawdown Circuit Breaker Tripped at ${balanceSheet.dailyDrawdownPct.toFixed(2)}%! Trading locked.`
        )
      }
    } else {
      if (prevTrippedRef.current) {
        prevTrippedRef.current = false
        defaultBotEngine.unlockAllBots()
        showToast('Risk Alert: Daily Drawdown recovered within safe threshold. Trading unlocked.')
      }
    }
  }, [balanceSheet.isCircuitBreakerTripped, balanceSheet.dailyDrawdownPct, showToast])


  // Subscribe to autonomous AI Bot Execution Engine signals
  useEffect(() => {
    defaultBotEngine.start(defaultMarketStore)
    const unsubBotSignals = defaultBotEngine.subscribeSignals((signal) => {
      const result = processOrderPipeline(signal, balanceSheet)
      if (result.status === 'FILLED' && result.positionCreated) {
        playOrderFilledSound()
        setPositions((prev) => [result.positionCreated!, ...prev])
        setPortfolio((prev) => ({
          ...prev,
          tradeCapital: Number((prev.tradeCapital + result.positionCreated!.margin).toFixed(2)),
        }))
        if (result.executedTrade) {
          setTrades((prev) => [result.executedTrade!, ...prev].slice(0, MAX_TRADE_HISTORY))
        }
        showToast(`AI Bot Executed: ${result.positionCreated.side} ${result.positionCreated.size} ${result.positionCreated.symbol} (${result.executedTrade?.aiStrategy ?? 'Bot'})`)
      }
    })

    return () => {
      unsubBotSignals()
      defaultBotEngine.stop()
    }
  }, [balanceSheet, showToast])

  // Dynamic Live Position PnL, Trailing Stop Ratchet, and Automated Exit Triggers via MarketDataStore
  useEffect(() => {
    if (!defaultMarketStore.isFeedActive()) {
      defaultMarketStore.startGlobalFeed()
    }

    const unsubscribe = defaultMarketStore.subscribeAll((tickers) => {
      setPositions((prevPositions) => {
        let hasChanges = false
        const remainingPositions: Position[] = []

        for (const pos of prevPositions) {
          const ticker = tickers[pos.symbol]
          const mark = ticker?.midPrice ?? pos.markPrice

          // Stage 5: Trailing stop ratchet if configured
          let currentPos = pos
          if (pos.slPrice && pos.slPrice > 0) {
            const isGold = pos.symbol.includes('XAU')
            const isForex = isForexSymbol(pos.symbol)

            const trailDist = isGold
              ? 8.0
              : isForex
              ? Math.max(0.00001, Number((pos.entryPrice * 0.003).toFixed(5)))
              : Math.max(0.01, Number((pos.entryPrice * 0.003).toFixed(2)))

            const trailingUpdate = updateTrailingStop(currentPos, mark, trailDist)
            if (trailingUpdate.wasRatchetUpdated) {
              hasChanges = true
              currentPos = { ...currentPos, slPrice: trailingUpdate.updatedSlPrice }
            }
          }

          // Stage 6: Exit Trigger Evaluation
          const exitCheck = checkPositionExitTriggers(currentPos, mark)
          if (exitCheck.shouldExit) {
            hasChanges = true
            const exitReason: ExitReason = exitCheck.exitReason ?? 'MANUAL_CLOSE'
            const settlement = settlePositionExit(currentPos, exitCheck.exitPrice, exitReason)
            const realizedPnl = settlement.realizedPnl
            const pnlFormatted = `${realizedPnl >= 0 ? '+' : ''}${realizedPnl.toFixed(2)} USD`

            if (exitCheck.exitReason === 'TP_HIT') {
              playTakeProfitSound()
              showToast(`Take Profit Hit: ${currentPos.symbol} closed at $${exitCheck.exitPrice.toLocaleString()} (${pnlFormatted})`)
            } else if (exitCheck.exitReason === 'SL_HIT') {
              playStopLossSound()
              showToast(`Stop Loss Hit: ${currentPos.symbol} closed at $${exitCheck.exitPrice.toLocaleString()} (${pnlFormatted})`)
            } else {
              playStopLossSound()
              showToast(`Liquidation Triggered: ${currentPos.symbol} closed at $${exitCheck.exitPrice.toLocaleString()} (${pnlFormatted})`)
            }

            setPortfolio((prev) => ({
              ...prev,
              totalBalance: Number((prev.totalBalance + settlement.realizedPnl).toFixed(2)),
              realizedProfit: Number((prev.realizedProfit + settlement.realizedPnl).toFixed(2)),
              tradeCapital: Math.max(0, Number((prev.tradeCapital - settlement.releasedMargin).toFixed(2))),
            }))

            setTrades((prev) => [settlement.closedTrade, ...prev].slice(0, MAX_TRADE_HISTORY))
            continue
          }

          // Point-in-time mark price update
          if (ticker && ticker.midPrice && Math.abs(ticker.midPrice - currentPos.markPrice) >= 0.000001) {
            hasChanges = true
            const pnlData = calculatePositionPnl(currentPos, mark)
            remainingPositions.push({
              ...currentPos,
              markPrice: mark,
              unrealizedPnl: pnlData.unrealizedPnl,
              unrealizedPnlPct: pnlData.unrealizedPnlPct,
            })
          } else {
            remainingPositions.push(currentPos)
          }
        }

        return hasChanges ? remainingPositions : prevPositions
      })
    })

    return () => {
      unsubscribe()
    }
  }, [showToast])

  // Bot toggle handler
  const handleToggleBot = (botId: string) => {
    defaultBotEngine.toggleBot(botId)
    const engineBot = defaultBotEngine.getBot(botId)
    const newStatus = engineBot ? engineBot.status : 'ACTIVE'
    setBots((prev) =>
      prev.map((b) =>
        b.id === botId
          ? { ...b, status: newStatus }
          : b
      )
    )
  }

  // Helper for USD asset valuation
  const getTokenPriceUsd = (tok: string): number => {
    if (tok === 'USDT' || tok === 'USD') return 1.0
    if (tok === 'ETH') return defaultMarketStore.getTicker('ETH/USDT')?.midPrice ?? 3248.30
    if (tok === 'SOL') return defaultMarketStore.getTicker('SOL/USDT')?.midPrice ?? 194.25
    if (tok === 'BTC') return defaultMarketStore.getTicker('BTC/USDT')?.midPrice ?? 114884.00
    if (tok === 'XAU') return defaultMarketStore.getTicker('XAU/USD')?.midPrice ?? 2734.50
    return 1.0
  }

  // Institutional Swap Execution Handler with Strict Balance Guards & Sound Accounting
  const handleExecuteSwap = (
    fromToken: string,
    toToken: string,
    fromAmount: number,
    toAmount: number
  ) => {
    // 1. Validate inputs
    if (
      !Number.isFinite(fromAmount) ||
      !Number.isFinite(toAmount) ||
      fromAmount <= 0 ||
      toAmount <= 0 ||
      fromToken === toToken
    ) {
      showToast('Swap rejected: Invalid token pair or non-positive amount')
      return
    }

    // 2. Pre-execution balance check
    const currentFromBalance = portfolio.balances[fromToken] ?? 0
    if (fromAmount > currentFromBalance) {
      showToast(
        `Swap rejected: Insufficient ${fromToken} balance (requested: ${fromAmount}, available: ${currentFromBalance.toFixed(4)})`
      )
      return
    }

    // 3. Mark-to-market valuation and transaction cost calculation
    const fromPriceUsd = getTokenPriceUsd(fromToken)
    const toPriceUsd = getTokenPriceUsd(toToken)
    const fromUsdValue = fromAmount * fromPriceUsd
    const toUsdValue = toAmount * toPriceUsd
    // True transaction cost (fee + slippage incurred):
    const swapCostUsd = Number((toUsdValue - fromUsdValue).toFixed(2))

    let executionSuccess = false

    // 4. Atomic portfolio state update
    setPortfolio((prev) => {
      const liveBalance = prev.balances[fromToken] ?? 0
      if (fromAmount > liveBalance || fromAmount <= 0) {
        return prev
      }

      executionSuccess = true
      const updatedBalances = { ...prev.balances }
      updatedBalances[fromToken] = Number((liveBalance - fromAmount).toFixed(8))
      updatedBalances[toToken] = Number(((updatedBalances[toToken] ?? 0) + toAmount).toFixed(8))

      return {
        ...prev,
        balances: updatedBalances,
        // Total balance adjusts strictly by the transaction friction (fee & slippage)
        totalBalance: Math.max(0, Number((prev.totalBalance + swapCostUsd).toFixed(2))),
        // tradeCapital remains untouched because spot swaps do not deploy leveraged margin
        tradeCapital: prev.tradeCapital,
      }
    })

    if (!executionSuccess) {
      showToast(`Swap failed: Insufficient ${fromToken} balance`)
      return
    }

    // 5. Append Trade Order with verified execution metrics
    const newTrade: TradeOrder = {
      id: `tx-${Date.now()}`,
      assetSymbol: `${fromToken}/${toToken}`,
      type: 'SELL',
      amount: fromAmount,
      price: toAmount / (fromAmount || 1),
      total: fromUsdValue,
      time: 'Just now',
      status: 'COMPLETED',
      pnl: swapCostUsd,
      aiStrategy: 'AI Optimal Route Swap',
      market: 'CRYPTO',
    }

    setTrades((prev) => [newTrade, ...prev].slice(0, MAX_TRADE_HISTORY))
    showToast(
      `Successfully swapped ${fromAmount} ${fromToken} to ${toAmount.toFixed(toToken === 'USDT' || toToken === 'USD' ? 2 : 4)} ${toToken}`
    )
  }

  // Position opened handler with pre-flight risk checks
  const handleOrderPlaced = (newPos: Position) => {
    const riskCheck = evaluateOrderRisk(
      {
        symbol: newPos.symbol,
        side: newPos.side === 'LONG' ? 'BUY' : 'SELL',
        size: newPos.size,
        price: newPos.entryPrice,
        leverage: newPos.leverage,
        marginRequired: newPos.margin,
        currentOpenPositionsCount: positions.length,
      },
      balanceSheet
    )

    if (!riskCheck.allowed) {
      playStopLossSound()
      showToast(`Order Rejected: ${riskCheck.reason}`)
      return
    }

    playOrderFilledSound()
    setPositions((prev) => [newPos, ...prev])
    setPortfolio((prev) => ({
      ...prev,
      tradeCapital: Number((prev.tradeCapital + newPos.margin).toFixed(2)),
    }))
    showToast(`Order Filled: ${newPos.side} ${newPos.size} ${newPos.symbol} @ $${newPos.entryPrice.toLocaleString()}`)
  }

  // Position closed handler
  const handleClosePosition = (positionId: string) => {
    const target = positions.find((p) => p.id === positionId)
    if (!target) return

    const settlement = settlePositionExit(target, target.markPrice, 'MANUAL_CLOSE')
    const realizedPnl = settlement.realizedPnl

    if (realizedPnl >= 0) {
      playTakeProfitSound()
    } else {
      playStopLossSound()
    }

    setPositions((prev) => prev.filter((p) => p.id !== positionId))
    setPortfolio((prev) => ({
      ...prev,
      totalBalance: Number((prev.totalBalance + settlement.realizedPnl).toFixed(2)),
      realizedProfit: Number((prev.realizedProfit + settlement.realizedPnl).toFixed(2)),
      tradeCapital: Math.max(0, Number((prev.tradeCapital - settlement.releasedMargin).toFixed(2))),
    }))

    const closeTrade: TradeOrder = {
      ...settlement.closedTrade,
      aiStrategy: 'Manual Position Close',
    }

    setTrades((prev) => [closeTrade, ...prev].slice(0, MAX_TRADE_HISTORY))
    showToast(`Position Closed: Realized PnL ${realizedPnl >= 0 ? '+' : ''}$${realizedPnl.toFixed(2)}`)
  }

  const handleAddAlert = (newAlert: Omit<PriceAlert, 'id' | 'createdAt' | 'triggered'>) => {
    const created: PriceAlert = {
      ...newAlert,
      id: `alt-${Date.now()}`,
      createdAt: new Date().toISOString(),
      triggered: false,
    }
    setAlerts((prev) => [created, ...prev].slice(0, MAX_ALERT_HISTORY))
    showToast(`Price Alert Armed: ${created.symbol} ${created.condition} $${created.targetPrice.toLocaleString()}`)
  }


  const handleRemoveAlert = (alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId))
  }

  const activeBotsCount = bots.filter((b) => b.status === 'ACTIVE').length
  const activeAlertsCount = alerts.filter((a) => !a.triggered).length

  return (
    <div className="min-h-screen bg-[#07080c] text-[#f3f4f6] flex flex-col selection:bg-pink-500/30 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-[#121624] border border-pink-500/40 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top duration-300">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></div>
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Navigation */}
      <Navbar
        currentView={currentView}
        onNavigate={setCurrentView}
        onOpenCopilot={() => setIsCopilotOpen(true)}
        onOpenBotManager={() => setIsBotManagerOpen(true)}
        onOpenApiKeys={() => setIsApiKeysOpen(true)}
        onOpenAlerts={() => setIsAlertsOpen(true)}
        activeAlertsCount={activeAlertsCount}
        activeBotsCount={activeBotsCount}
        totalBalance={portfolio.totalBalance}
        tradingMode={tradingMode}
        balanceSheet={balanceSheet}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {currentView === 'landing' && (
          <ErrorBoundary
            viewName="Landing Page"
            fallback={(error, reset) => (
              <ViewErrorFallback viewName="Landing Page" error={error} reset={reset} onNavigate={() => setCurrentView('terminal')} />
            )}
          >
            <LandingPage
              onLaunchApp={() => setCurrentView('terminal')}
              onOpenCopilot={() => setIsCopilotOpen(true)}
            />
          </ErrorBoundary>
        )}

        {currentView === 'terminal' && (
          <ErrorBoundary
            viewName="Terminal Desk"
            fallback={(error, reset) => (
              <ViewErrorFallback viewName="Terminal Desk" error={error} reset={reset} onNavigate={() => setCurrentView('terminal')} />
            )}
          >
            <TradingDashboard
              assets={assets}
              portfolio={portfolio}
              trades={trades}
              bots={bots}
              positions={positions}
              onOpenCopilot={() => setIsCopilotOpen(true)}
              onOpenBotManager={() => setIsBotManagerOpen(true)}
              onOpenApiKeys={() => setIsApiKeysOpen(true)}
              onOpenAlerts={(sym, p) => {
                setAlertTarget({ symbol: sym, price: p })
                setIsAlertsOpen(true)
              }}
              onExecuteSwap={handleExecuteSwap}
              onOrderPlaced={handleOrderPlaced}
              onClosePosition={handleClosePosition}
              tradingMode={tradingMode}
              balanceSheet={balanceSheet}
            />
          </ErrorBoundary>
        )}

        {currentView === 'signal_desk' && (
          <ErrorBoundary
            viewName="XAU/USD AI Signal Desk"
            fallback={(error, reset) => (
              <ViewErrorFallback viewName="XAU/USD AI Signal Desk" error={error} reset={reset} onNavigate={() => setCurrentView('terminal')} />
            )}
          >
            <SignalDeskView
              currentGoldPrice={assets.find((a) => a.symbol === 'XAU/USD')?.price ?? 4155.50}
              onOrderPlaced={handleOrderPlaced}
              balanceSheet={balanceSheet}
            />
          </ErrorBoundary>
        )}

        {currentView === 'news_trading' && (
          <ErrorBoundary
            viewName="News Trading Desk"
            fallback={(error, reset) => (
              <ViewErrorFallback viewName="News Trading Desk" error={error} reset={reset} onNavigate={() => setCurrentView('terminal')} />
            )}
          >
            <NewsTradingDeskView
              currentGoldPrice={assets.find((a) => a.symbol === 'XAU/USD')?.price ?? 4155.50}
              onOrderPlaced={handleOrderPlaced}
              balanceSheet={balanceSheet}
            />
          </ErrorBoundary>
        )}

        {currentView === 'quant_studio' && (
          <ErrorBoundary
            viewName="Quant Studio"
            fallback={(error, reset) => (
              <ViewErrorFallback viewName="Quant Studio" error={error} reset={reset} onNavigate={() => setCurrentView('terminal')} />
            )}
          >
            <QuantStudioView balanceSheet={balanceSheet} />
          </ErrorBoundary>
        )}

        {currentView === 'journal' && (
          <ErrorBoundary
            viewName="Trading Journal"
            fallback={(error, reset) => (
              <ViewErrorFallback viewName="Trading Journal" error={error} reset={reset} onNavigate={() => setCurrentView('terminal')} />
            )}
          >
            <TradingJournalView currentAccountBalance={portfolio.totalBalance} />
          </ErrorBoundary>
        )}

        {currentView === 'ai_intel' && (
          <ErrorBoundary
            viewName="AI Market Intel"
            fallback={(error, reset) => (
              <ViewErrorFallback viewName="AI Market Intel" error={error} reset={reset} onNavigate={() => setCurrentView('terminal')} />
            )}
          >
            <AIIntelligenceView />
          </ErrorBoundary>
        )}

        {currentView === 'trader_tools' && (
          <ErrorBoundary
            viewName="Trader Tools"
            fallback={(error, reset) => (
              <ViewErrorFallback viewName="Trader Tools" error={error} reset={reset} onNavigate={() => setCurrentView('terminal')} />
            )}
          >
            <TraderToolsView currentAccountBalance={portfolio.totalBalance} />
          </ErrorBoundary>
        )}

        {currentView === 'whale_radar' && (
          <ErrorBoundary
            viewName="Whale Radar"
            fallback={(error, reset) => (
              <ViewErrorFallback viewName="Whale Radar" error={error} reset={reset} onNavigate={() => setCurrentView('terminal')} />
            )}
          >
            <WhaleRadarView />
          </ErrorBoundary>
        )}

        {currentView === 'portfolio' && (
          <ErrorBoundary
            viewName="Portfolio Overview"
            fallback={(error, reset) => (
              <ViewErrorFallback viewName="Portfolio Overview" error={error} reset={reset} onNavigate={() => setCurrentView('terminal')} />
            )}
          >
            <PortfolioView portfolio={portfolio} balanceSheet={balanceSheet} />
          </ErrorBoundary>
        )}
      </main>


      {/* Footer */}
      <Footer />

      {/* Modals */}
      <AICopilotModal
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
      />

      <BotControlModal
        isOpen={isBotManagerOpen}
        onClose={() => setIsBotManagerOpen(false)}
        bots={bots}
        onToggleBot={handleToggleBot}
        balanceSheet={balanceSheet}
      />

      <ApiKeysModal
        isOpen={isApiKeysOpen}
        onClose={() => setIsApiKeysOpen(false)}
        currentMode={tradingMode}
        onModeChange={setTradingMode}
      />

      <PriceAlertModal
        isOpen={isAlertsOpen}
        onClose={() => setIsAlertsOpen(false)}
        currentSymbol={alertTarget.symbol}
        currentPrice={alertTarget.price}
        alerts={alerts}
        onAddAlert={handleAddAlert}
        onRemoveAlert={handleRemoveAlert}
      />
    </div>
  )
}
