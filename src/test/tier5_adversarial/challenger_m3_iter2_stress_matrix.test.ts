import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isForexSymbol,
  updateTrailingStop,
  checkPositionExitTriggers,
  settlePositionExit,
} from '@/engine/orderLifecycle'
import {
  recalculateBalanceSheet,
  evaluateOrderRisk,
  calculatePositionPnl,
} from '@/engine/riskEngine'
import {
  BotExecutionEngine,
} from '@/engine/botEngine'
import type { Position, TradeOrder, UserPortfolio } from '@/types/trading'


describe('Adversarial Challenge Matrix: Milestone 3 Iteration 2 Stress & Invariant Harness', () => {
  // =========================================================================
  // Dimension 1: Symbol Parsing Exhaustive Edge Cases
  // =========================================================================
  describe('Dimension 1: Symbol Parsing & Asset Multiplier Exhaustive Edge Cases', () => {
    it('properly distinguishes crypto vs forex across 25 tricky symbol patterns', () => {
      const cryptoSymbols = [
        'BTC/USDT',
        'ETH/USDT',
        'SOL/USDT',
        'BTC/USD',
        'ETH/USD',
        'SOL/USD',
        'USDT',
        'USDT/USD',
        'BTC_USDT',
        'ETH_USDT',
        'SOL_USDT',
        'DOGE/USDT',
        'SOL/BTC',
        'ETH/BTC',
      ]

      for (const sym of cryptoSymbols) {
        expect(isForexSymbol(sym), `Expected ${sym} to NOT be classified as Forex`).toBe(false)
      }

      const forexGoldSymbols = [
        'EUR/USD',
        'GBP/USD',
        'USD/JPY',
        'XAU/USD',
        'EUR/GBP',
        'EUR/JPY',
        'GBP/JPY',
        'USD/CHF',
        'USD/CAD',
        'AUD/USD',
        'NZD/USD',
      ]

      for (const sym of forexGoldSymbols) {
        expect(isForexSymbol(sym), `Expected ${sym} to be classified as Forex`).toBe(true)
      }
    })

    it('safely handles malformed, empty, and non-standard inputs without exception', () => {
      expect(isForexSymbol('')).toBe(false)
      expect(isForexSymbol('   ')).toBe(false)
      expect(isForexSymbol('///')).toBe(false)
      expect(isForexSymbol(null as unknown as string)).toBe(false)
      expect(isForexSymbol(undefined as unknown as string)).toBe(false)
      expect(isForexSymbol('UNKNOWN_ASSET')).toBe(false)
    })

    it('verifies settlePositionExit and calculatePositionPnl respect position.market === CRYPTO override', () => {
      // Even if a symbol somehow contained 'EUR' (e.g. crypto token 'NEURO/USDT'),
      // market === 'CRYPTO' must enforce unit multiplier!
      const cryptoPosWithEur: Position = {
        id: 'pos_crypto_eur',
        symbol: 'NEUR/USDT',
        side: 'LONG',
        size: 10,
        entryPrice: 5.0,
        markPrice: 5.0,
        liquidationPrice: 4.0,
        leverage: 5,
        margin: 10,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        market: 'CRYPTO',
      }

      const floating = calculatePositionPnl(cryptoPosWithEur, 6.0)
      // Gain of $1.00 on 10 units = $10.00 (NOT $1,000,000!)
      expect(floating.unrealizedPnl).toBe(10.00)

      const settled = settlePositionExit(cryptoPosWithEur, 6.0, 'TP_HIT')
      expect(settled.realizedPnl).toBe(10.00)
    })
  })

  // =========================================================================
  // Dimension 2: Rapid Tick Swings, Gap Moves & Trailing Ratchet Invariants
  // =========================================================================
  describe('Dimension 2: Rapid Tick Swings, Gap Moves & Ratchet Invariants', () => {
    it('proves trailing stop climbs strictly monotonically on LONG and never regresses during pullbacks', () => {
      const longPos: Position = {
        id: 'pos_long_ratchet',
        symbol: 'BTC/USDT',
        side: 'LONG',
        size: 0.1,
        entryPrice: 100000,
        markPrice: 100000,
        slPrice: 99000,
        liquidationPrice: 90000,
        leverage: 10,
        margin: 1000,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        market: 'CRYPTO',
      }

      const trailDist = 500 // $500 trailing distance
      let currentPos = { ...longPos }

      // Rapid sequence of rising, dipping, and gapping ticks
      const ticks = [
        100200, // +200 -> candidateSl = 99700 (> 99000) -> ratchet
        100150, // dip to 100150 -> candidateSl = 99650 (< 99700) -> NO ratchet
        100600, // surge to 100600 -> candidateSl = 100100 (> 99700) -> ratchet
        100400, // pull back -> NO ratchet
        101000, // surge to 101000 -> candidateSl = 100500 (> 100100) -> ratchet
        100800, // pull back -> NO ratchet
        100500, // hits ratcheted SL exactly!
      ]

      const slHistory: number[] = [currentPos.slPrice!]

      for (let i = 0; i < ticks.length - 1; i++) {
        const mark = ticks[i]
        const update = updateTrailingStop(currentPos, mark, trailDist)
        if (update.wasRatchetUpdated) {
          expect(update.updatedSlPrice).toBeGreaterThan(currentPos.slPrice!)
          currentPos.slPrice = update.updatedSlPrice
        }
        slHistory.push(currentPos.slPrice!)
      }

      // Assert slPrice was monotonically non-decreasing
      for (let i = 1; i < slHistory.length; i++) {
        expect(slHistory[i]).toBeGreaterThanOrEqual(slHistory[i - 1])
      }

      // Check exit trigger at last tick (100500)
      const lastTick = ticks[ticks.length - 1]
      const exitResult = checkPositionExitTriggers(currentPos, lastTick)
      expect(exitResult.shouldExit).toBe(true)
      expect(exitResult.exitReason).toBe('SL_HIT')
      expect(exitResult.exitPrice).toBe(100500) // Locked in $500 profit above 100000 entry!

      // Settle exit
      const settlement = settlePositionExit(currentPos, exitResult.exitPrice, 'SL_HIT')
      expect(settlement.realizedPnl).toBe(50.00) // 0.1 * (100500 - 100000) = $50.00
    })

    it('proves trailing stop drops strictly monotonically on SHORT and never regresses during rallies', () => {
      const shortPos: Position = {
        id: 'pos_short_ratchet',
        symbol: 'BTC/USDT',
        side: 'SHORT',
        size: 0.1,
        entryPrice: 100000,
        markPrice: 100000,
        slPrice: 101000,
        liquidationPrice: 110000,
        leverage: 10,
        margin: 1000,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        market: 'CRYPTO',
      }

      const trailDist = 500
      let currentPos = { ...shortPos }

      const ticks = [
        99700, // -300 -> candidateSl = 100200 (< 101000) -> ratchet
        99850, // rally -> candidateSl = 100350 (> 100200) -> NO ratchet
        99200, // drop -> candidateSl = 99700 (< 100200) -> ratchet
        99400, // bounce -> NO ratchet
        98500, // drop -> candidateSl = 99000 (< 99700) -> ratchet
        99000, // hits ratcheted SL
      ]

      const slHistory: number[] = [currentPos.slPrice!]

      for (let i = 0; i < ticks.length - 1; i++) {
        const mark = ticks[i]
        const update = updateTrailingStop(currentPos, mark, trailDist)
        if (update.wasRatchetUpdated) {
          expect(update.updatedSlPrice).toBeLessThan(currentPos.slPrice!)
          currentPos.slPrice = update.updatedSlPrice
        }
        slHistory.push(currentPos.slPrice!)
      }

      // Assert slPrice was monotonically non-increasing
      for (let i = 1; i < slHistory.length; i++) {
        expect(slHistory[i]).toBeLessThanOrEqual(slHistory[i - 1])
      }

      // Check exit trigger at last tick (99000)
      const lastTick = ticks[ticks.length - 1]
      const exitResult = checkPositionExitTriggers(currentPos, lastTick)
      expect(exitResult.shouldExit).toBe(true)
      expect(exitResult.exitReason).toBe('SL_HIT')
      expect(exitResult.exitPrice).toBe(99000)

      const settlement = settlePositionExit(currentPos, exitResult.exitPrice, 'SL_HIT')
      expect(settlement.realizedPnl).toBe(100.00) // 0.1 * (100000 - 99000) = $100.00
    })

    it('verifies priority ordering when a violent flash crash jumps past both SL and Liquidation in a single tick', () => {
      const longPos: Position = {
        id: 'pos_flash_crash',
        symbol: 'BTC/USDT',
        side: 'LONG',
        size: 1.0,
        entryPrice: 100000,
        markPrice: 100000,
        slPrice: 95000,
        liquidationPrice: 90000,
        tpPrice: 110000,
        leverage: 10,
        margin: 10000,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        market: 'CRYPTO',
      }

      // Flash crash to 80,000 in a single millisecond tick (breaching SL 95,000 AND Liq 90,000)
      const flashCrashResult = checkPositionExitTriggers(longPos, 80000)
      // Liquidation MUST have Priority 1
      expect(flashCrashResult.shouldExit).toBe(true)
      expect(flashCrashResult.exitReason).toBe('LIQUIDATION_TRIGGERED')
      expect(flashCrashResult.exitPrice).toBe(90000)

      // Moderate drop to 94,000 (breaching SL 95,000 but NOT Liq 90,000)
      const slResult = checkPositionExitTriggers(longPos, 94000)
      expect(slResult.shouldExit).toBe(true)
      expect(slResult.exitReason).toBe('SL_HIT')
      expect(slResult.exitPrice).toBe(95000)

      // Surge to 112,000 (breaching TP 110,000)
      const tpResult = checkPositionExitTriggers(longPos, 112000)
      expect(tpResult.shouldExit).toBe(true)
      expect(tpResult.exitReason).toBe('TP_HIT')
      expect(tpResult.exitPrice).toBe(110000)
    })
  })

  // =========================================================================
  // Dimension 3: Full Settlement Integration & Multi-Asset Math
  // =========================================================================
  describe('Dimension 3: Full Settlement Integration across Exit Paths & Currency Conversion', () => {
    it('verifies USD/JPY settlement correctly divides gross JPY PnL by exchange rate', () => {
      // 1 standard lot USD/JPY (100,000 base currency USD)
      // Long entry: 150.00, Exit: 153.00 (+3.00 JPY gain = 300 pips)
      const jpyPos: Position = {
        id: 'pos_usdjpy',
        symbol: 'USD/JPY',
        side: 'LONG',
        size: 1.0,
        lots: 1.0,
        entryPrice: 150.00,
        markPrice: 150.00,
        liquidationPrice: 147.00,
        leverage: 50,
        margin: 2000,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        market: 'FOREX',
      }

      // Raw PnL in JPY: (153.00 - 150.00) * 1.0 * 100,000 = 300,000 JPY
      // USD conversion at exit rate 153.00: 300,000 / 153.00 = 1960.7843... -> $1,960.78 USD
      const settlement = settlePositionExit(jpyPos, 153.00, 'TP_HIT')
      expect(settlement.realizedPnl).toBe(1960.78)
      expect(settlement.releasedMargin).toBe(2000)
      expect(settlement.closedTrade.pnl).toBe(1960.78)
    })

    it('verifies complete atomic portfolio transition in simulated App.tsx automated and manual exits', () => {
      const initialPortfolio: UserPortfolio = {
        totalBalance: 50000.00,
        tradeCapital: 10000.00,
        maxLoss: 5000.00,
        realizedProfit: 0.00,
        dailyChangePct: 0,
        balances: { USDT: 50000 },
      }

      const activePositions: Position[] = [
        {
          id: 'pos_btc_auto',
          symbol: 'BTC/USDT',
          side: 'LONG',
          size: 0.5,
          entryPrice: 100000,
          markPrice: 100000,
          slPrice: 98000,
          tpPrice: 104000,
          liquidationPrice: 90000,
          leverage: 10,
          margin: 5000,
          unrealizedPnl: 0,
          unrealizedPnlPct: 0,
          market: 'CRYPTO',
        },
        {
          id: 'pos_eth_manual',
          symbol: 'ETH/USDT',
          side: 'LONG',
          size: 5.0,
          entryPrice: 3000,
          markPrice: 3200,
          liquidationPrice: 2400,
          leverage: 5,
          margin: 3000,
          unrealizedPnl: 1000,
          unrealizedPnlPct: 33.33,
          market: 'CRYPTO',
        },
      ]

      let portfolio = { ...initialPortfolio }
      let trades: TradeOrder[] = []

      // Path A: Automated TP Exit for BTC position at $104,000
      const btcPos = activePositions[0]
      const autoExitCheck = checkPositionExitTriggers(btcPos, 104000)
      expect(autoExitCheck.shouldExit).toBe(true)

      const autoSettlement = settlePositionExit(btcPos, autoExitCheck.exitPrice, autoExitCheck.exitReason!)
      // Profit: 0.5 * (104,000 - 100,000) = $2,000.00
      expect(autoSettlement.realizedPnl).toBe(2000.00)

      portfolio = {
        ...portfolio,
        totalBalance: Number((portfolio.totalBalance + autoSettlement.realizedPnl).toFixed(2)),
        realizedProfit: Number((portfolio.realizedProfit + autoSettlement.realizedPnl).toFixed(2)),
        tradeCapital: Math.max(0, Number((portfolio.tradeCapital - autoSettlement.releasedMargin).toFixed(2))),
      }
      trades = [autoSettlement.closedTrade, ...trades]

      expect(portfolio.totalBalance).toBe(52000.00)
      expect(portfolio.realizedProfit).toBe(2000.00)
      expect(portfolio.tradeCapital).toBe(5000.00) // 10,000 - 5,000 released
      expect(trades.length).toBe(1)

      // Path B: Manual Close for ETH position at current mark price $3,200
      const ethPos = activePositions[1]
      const manualSettlement = settlePositionExit(ethPos, ethPos.markPrice, 'MANUAL_CLOSE')
      // Profit: 5.0 * (3,200 - 3,000) = $1,000.00
      expect(manualSettlement.realizedPnl).toBe(1000.00)

      portfolio = {
        ...portfolio,
        totalBalance: Number((portfolio.totalBalance + manualSettlement.realizedPnl).toFixed(2)),
        realizedProfit: Number((portfolio.realizedProfit + manualSettlement.realizedPnl).toFixed(2)),
        tradeCapital: Math.max(0, Number((portfolio.tradeCapital - manualSettlement.releasedMargin).toFixed(2))),
      }
      const closeTrade: TradeOrder = {
        ...manualSettlement.closedTrade,
        aiStrategy: 'Manual Position Close',
      }
      trades = [closeTrade, ...trades]

      expect(portfolio.totalBalance).toBe(53000.00)
      expect(portfolio.realizedProfit).toBe(3000.00)
      expect(portfolio.tradeCapital).toBe(2000.00) // 5,000 - 3,000 released
      expect(trades.length).toBe(2)
      expect(trades[0].aiStrategy).toBe('Manual Position Close')
    })
  })

  // =========================================================================
  // Dimension 4: Account Risk Safeguards under Severe Drawdown & Negative Equity
  // =========================================================================
  describe('Dimension 4: Account Risk Safeguards under Severe Drawdown & Negative Equity', () => {
    it('guarantees circuit breaker trips and blocks order execution on negative equity', () => {
      // Massive loss turning equity negative: Cash = 5,000, Loss = -12,000 -> Equity = -7,000
      const heavyLossPos: Position = {
        id: 'pos_heavy_loss',
        symbol: 'BTC/USDT',
        side: 'LONG',
        size: 1.0,
        entryPrice: 100000,
        markPrice: 88000,
        liquidationPrice: 80000,
        leverage: 10,
        margin: 10000,
        unrealizedPnl: -12000,
        unrealizedPnlPct: -120,
        market: 'CRYPTO',
      }

      const sheet = recalculateBalanceSheet([heavyLossPos], 5000, 50000, 50000)
      expect(sheet.equity).toBe(-7000)
      expect(sheet.freeMargin).toBe(0) // Must not be negative
      expect(sheet.isCircuitBreakerTripped).toBe(true)
      expect(sheet.circuitBreakerReason).toContain('Account equity depleted: $-7000.00 <= 0')

      // Pre-flight risk check must reject ANY order
      const orderReq = {
        symbol: 'BTC/USDT',
        side: 'BUY' as const,
        size: 0.01,
        price: 100000,
        leverage: 10,
        marginRequired: 100,
      }

      const riskResult = evaluateOrderRisk(orderReq, sheet)
      expect(riskResult.allowed).toBe(false)
      expect(riskResult.reason).toContain('CIRCUIT_BREAKER_ACTIVE')
    })

    it('guarantees circuit breaker trips when cash is 0 and equity is 0', () => {
      const sheet = recalculateBalanceSheet([], 0, 0, 0)
      expect(sheet.equity).toBe(0)
      expect(sheet.isCircuitBreakerTripped).toBe(true)
      expect(sheet.circuitBreakerReason).toContain('Account equity depleted: $0.00 <= 0')

      const riskResult = evaluateOrderRisk(
        { symbol: 'EUR/USD', side: 'BUY', size: 0.1, price: 1.0825, leverage: 50, marginRequired: 200 },
        sheet
      )
      expect(riskResult.allowed).toBe(false)
      expect(riskResult.reason).toContain('CIRCUIT_BREAKER_ACTIVE')
    })

    it('tests recovery scenario: circuit breaker disarms when equity climbs back above safety threshold', () => {
      const peak = 100000
      // 1. Drawdown reaches 5.0% (Equity = 95,000) -> TRIPPED
      const sheetTripped = recalculateBalanceSheet([], 95000, peak, peak)
      expect(sheetTripped.dailyDrawdownPct).toBe(5.00)
      expect(sheetTripped.isCircuitBreakerTripped).toBe(true)

      // 2. Account recovers to 96,500 (Drawdown = 3.50% < 4.5% threshold) -> UNTRIPPED
      const sheetRecovered = recalculateBalanceSheet([], 96500, peak, peak)
      expect(sheetRecovered.dailyDrawdownPct).toBe(3.50)
      expect(sheetRecovered.isCircuitBreakerTripped).toBe(false)

      const riskResult = evaluateOrderRisk(
        { symbol: 'BTC/USDT', side: 'BUY', size: 0.01, price: 100000, leverage: 10, marginRequired: 100 },
        sheetRecovered
      )
      expect(riskResult.allowed).toBe(true)
    })
  })

  // =========================================================================
  // Dimension 5: Bot Execution Engine Rolling History & Indicator Integrity
  // =========================================================================
  describe('Dimension 5: Bot Execution Engine Rolling History & Indicator Integrity', () => {
    let engine: BotExecutionEngine

    beforeEach(() => {
      engine = new BotExecutionEngine()
    })

    afterEach(() => {
      engine.stop()
      vi.restoreAllMocks()
    })

    it('ingests 5,000 rapid high-frequency ticks maintaining bounded memory strictly at 100 bars', () => {
      const internalHistory = (engine as unknown as { priceHistory: Map<string, number[]> }).priceHistory

      // Generate 5,000 synthetic ticks for all 4 bot symbols
      const symbols = ['BTC/USDT', 'XAU/USD', 'EUR/USD', 'SOL/USDT']
      let btcPrice = 100000
      let xauPrice = 2700
      let eurPrice = 1.0800
      let solPrice = 200

      for (let i = 0; i < 5000; i++) {
        btcPrice += (Math.random() - 0.49) * 5
        xauPrice += (Math.random() - 0.49) * 0.5
        eurPrice += (Math.random() - 0.49) * 0.0001
        solPrice += (Math.random() - 0.49) * 0.2

        engine.handleMarketTick({
          'BTC/USDT': {
            symbol: 'BTC/USDT',
            category: 'CRYPTO',
            midPrice: btcPrice,
            bidPrice: btcPrice - 1,
            askPrice: btcPrice + 1,
            spreadPips: 2,
            spreadUsd: 2,
            high24h: 110000,
            low24h: 90000,
            change24hPct: 0,
            volume24h: 1000,
            lastUpdateTimestamp: Date.now(),
            connectionStatus: 'LIVE_WS',
          },
          'XAU/USD': {
            symbol: 'XAU/USD',
            category: 'FOREX',
            midPrice: xauPrice,
            bidPrice: xauPrice - 0.2,
            askPrice: xauPrice + 0.2,
            spreadPips: 2,
            spreadUsd: 0.2,
            high24h: 2800,
            low24h: 2600,
            change24hPct: 0,
            volume24h: 1000,
            lastUpdateTimestamp: Date.now(),
            connectionStatus: 'SIMULATED',
          },
          'EUR/USD': {
            symbol: 'EUR/USD',
            category: 'FOREX',
            midPrice: eurPrice,
            bidPrice: eurPrice - 0.00004,
            askPrice: eurPrice + 0.00004,
            spreadPips: 0.4,
            spreadUsd: 0.00004,
            high24h: 1.09,
            low24h: 1.07,
            change24hPct: 0,
            volume24h: 1000,
            lastUpdateTimestamp: Date.now(),
            connectionStatus: 'SIMULATED',
          },
          'SOL/USDT': {
            symbol: 'SOL/USDT',
            category: 'CRYPTO',
            midPrice: solPrice,
            bidPrice: solPrice - 0.05,
            askPrice: solPrice + 0.05,
            spreadPips: 5,
            spreadUsd: 0.05,
            high24h: 220,
            low24h: 180,
            change24hPct: 0,
            volume24h: 1000,
            lastUpdateTimestamp: Date.now(),
            connectionStatus: 'LIVE_WS',
          },
        })
      }

      // Assert each tracked symbol has strictly 100 history bars
      for (const sym of symbols) {
        const hist = internalHistory.get(sym)
        expect(hist).toBeDefined()
        expect(hist!.length).toBe(100)
        // Check all values are finite and positive
        for (const val of hist!) {
          expect(Number.isFinite(val)).toBe(true)
          expect(val).toBeGreaterThan(0)
        }
      }
    })
  })
})
