import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isForexSymbol,
  processOrderPipeline,
  updateTrailingStop,
  settlePositionExit,
  type OrderSignal,
} from '@/engine/orderLifecycle'
import {
  checkCircuitBreaker,
  recalculateBalanceSheet,
  evaluateOrderRisk,
  calculatePositionPnl,
} from '@/engine/riskEngine'
import {
  BotExecutionEngine,
} from '@/engine/botEngine'

import type { Position, MarketTicker } from '@/types/trading'

describe('Challenger M3 Iteration 2: Empirical Stress Test & Adversarial Verification', () => {
  // =========================================================================
  // Test 1: Crypto Classification and Unit PnL vs Forex Multipliers
  // =========================================================================
  describe('1. Asset classification: BTC/USDT, ETH/USDT, SOL/USDT vs Forex & Gold', () => {
    it('isForexSymbol strictly classifies Tether crypto as non-forex and Forex/Gold as forex', () => {
      // Crypto pairs must be FALSE
      expect(isForexSymbol('BTC/USDT')).toBe(false)
      expect(isForexSymbol('ETH/USDT')).toBe(false)
      expect(isForexSymbol('SOL/USDT')).toBe(false)
      expect(isForexSymbol('DOGE/USDT')).toBe(false)
      expect(isForexSymbol('BTC/USD')).toBe(false)
      expect(isForexSymbol('ETH/USD')).toBe(false)
      expect(isForexSymbol('SOL/USD')).toBe(false)
      expect(isForexSymbol('btc/usdt')).toBe(false)
      expect(isForexSymbol('eth/usdt')).toBe(false)
      expect(isForexSymbol('sol/usdt')).toBe(false)

      // Forex & Gold pairs must be TRUE
      expect(isForexSymbol('EUR/USD')).toBe(true)
      expect(isForexSymbol('GBP/USD')).toBe(true)
      expect(isForexSymbol('USD/JPY')).toBe(true)
      expect(isForexSymbol('XAU/USD')).toBe(true)
      expect(isForexSymbol('EUR/GBP')).toBe(true)
      expect(isForexSymbol('EUR/JPY')).toBe(true)
      expect(isForexSymbol('USD/CHF')).toBe(true)
      expect(isForexSymbol('USD/CAD')).toBe(true)

      // Edge cases & falsy inputs
      expect(isForexSymbol('')).toBe(false)
      expect(isForexSymbol(undefined as unknown as string)).toBe(false)
    })

    it('empirically verifies unit multiplier PnL for BTC/USDT, ETH/USDT, and SOL/USDT', () => {
      const sheet = recalculateBalanceSheet([], 100000, 100000, 100000)

      // 0.1 BTC order at $100,000, price increases by $100 -> profit must be EXACTLY $10.00
      const btcSignal: OrderSignal = {
        id: 'btc-stress-1',
        symbol: 'BTC/USDT',
        side: 'BUY',
        size: 0.1,
        price: 100000,
        leverage: 10,
      }
      const btcResult = processOrderPipeline(btcSignal, sheet)
      expect(btcResult.status).toBe('FILLED')
      const btcPos = btcResult.positionCreated!
      expect(btcPos.market).toBe('CRYPTO')
      expect(btcPos.lots).toBeUndefined()

      const btcFloatingPnl = calculatePositionPnl(btcPos, btcPos.entryPrice + 100)
      expect(btcFloatingPnl.unrealizedPnl).toBe(10.00)

      const btcSettlement = settlePositionExit(btcPos, btcPos.entryPrice + 100, 'TP_HIT')
      expect(btcSettlement.realizedPnl).toBe(10.00)

      // 2.5 ETH order at $3,000, price drops by $50 (SHORT) -> profit must be EXACTLY +$125.00
      const ethSignal: OrderSignal = {
        id: 'eth-stress-2',
        symbol: 'ETH/USDT',
        side: 'SELL',
        size: 2.5,
        price: 3000,
        leverage: 10,
      }
      const ethResult = processOrderPipeline(ethSignal, sheet)
      expect(ethResult.status).toBe('FILLED')
      const ethPos = ethResult.positionCreated!
      expect(ethPos.market).toBe('CRYPTO')

      const ethFloatingPnl = calculatePositionPnl(ethPos, ethPos.entryPrice - 50)
      expect(ethFloatingPnl.unrealizedPnl).toBe(125.00)

      const ethSettlement = settlePositionExit(ethPos, ethPos.entryPrice - 50, 'TP_HIT')
      expect(ethSettlement.realizedPnl).toBe(125.00)

      // 50 SOL order at $200, price rises by $5 -> profit must be EXACTLY +$250.00
      const solSignal: OrderSignal = {
        id: 'sol-stress-3',
        symbol: 'SOL/USDT',
        side: 'BUY',
        size: 50,
        price: 200,
        leverage: 5,
      }
      const solResult = processOrderPipeline(solSignal, sheet)
      expect(solResult.status).toBe('FILLED')
      const solPos = solResult.positionCreated!
      expect(solPos.market).toBe('CRYPTO')

      const solFloatingPnl = calculatePositionPnl(solPos, solPos.entryPrice + 5)
      expect(solFloatingPnl.unrealizedPnl).toBe(250.00)

      const solSettlement = settlePositionExit(solPos, solPos.entryPrice + 5, 'TP_HIT')
      expect(solSettlement.realizedPnl).toBe(250.00)
    })
  })

  // =========================================================================
  // Test 2: EUR/USD 1 Lot Notional ($100k) and Margin Calculation
  // =========================================================================
  describe('2. Forex 1 lot notional and margin calculation', () => {
    it('calculates Forex 1 lot EUR/USD at 1.0825 with 50x leverage as $108,250 notional and $2,165 margin', () => {
      const sheet = recalculateBalanceSheet([], 100000, 100000, 100000)
      const eurSignal: OrderSignal = {
        id: 'eur-notional-test',
        symbol: 'EUR/USD',
        side: 'BUY',
        size: 1.0, // 1 standard lot
        price: 1.0825,
        leverage: 50,
      }

      const res = processOrderPipeline(eurSignal, sheet)
      expect(res.status).toBe('FILLED')
      const pos = res.positionCreated!

      expect(pos.market).toBe('FOREX')
      expect(pos.lots).toBe(1.0)

      // Expected notional: 1.0 * 1.0825 * 100,000 = $108,250.00
      // Expected margin: 108,250 / 50 = $2,165.00
      expect(pos.margin).toBe(2165.00)
      expect(res.executedTrade?.total).toBe(108250.00)

      // Pre-flight margin sufficiency enforcement:
      // If freeMargin is $2,000, order requiring $2,165 must be REJECTED
      const tightSheet = recalculateBalanceSheet([], 2000, 2000, 2000)
      const rejectedResult = processOrderPipeline(eurSignal, tightSheet)
      expect(rejectedResult.status).toBe('REJECTED')
      expect(rejectedResult.stageReached).toBe('RISK_CHECK')
      expect(rejectedResult.rejectReason).toContain('INSUFFICIENT_MARGIN')
    })

    it('enforces institutional max position size limit ($1,000,000) for Forex while rejecting oversized lot sizes', () => {
      const sheet = recalculateBalanceSheet([], 200000, 200000, 200000)

      // 10 lots EUR/USD at 1.0825: Notional = 10 * 1.0825 * 100,000 = $1,082,500.00 (> $1,000,000 ceiling)
      const oversizedSignal: OrderSignal = {
        id: 'eur-oversized',
        symbol: 'EUR/USD',
        side: 'BUY',
        size: 10.0,
        price: 1.0825,
        leverage: 50,
      }

      const res = processOrderPipeline(oversizedSignal, sheet)
      expect(res.status).toBe('REJECTED')
      expect(res.stageReached).toBe('RISK_CHECK')
      expect(res.rejectReason).toContain('MAX_SIZE_EXCEEDED')
    })
  })

  // =========================================================================
  // Test 3: Trailing Distance Precision for Forex (Never Truncating to 0.00)
  // =========================================================================
  describe('3. Trailing distance precision for Forex (never truncating to 0.00)', () => {
    it('calculates Forex trailing distance preserving 5 decimals (~0.00325) and ratchets stop loss', () => {
      const entryPrice = 1.0845
      // Simulating App.tsx trailDist calculation:
      const trailDist = Math.max(0.00001, Number((entryPrice * 0.003).toFixed(5)))

      expect(trailDist).toBe(0.00325)
      expect(trailDist).toBeGreaterThan(0)
      expect(trailDist).not.toBe(0.00)

      const eurPos: Position = {
        id: 'pos-eur-trail',
        symbol: 'EUR/USD',
        side: 'LONG',
        size: 1.0,
        lots: 1.0,
        entryPrice: 1.0845,
        markPrice: 1.0845,
        slPrice: 1.0800,
        liquidationPrice: 1.0600,
        leverage: 50,
        margin: 2169,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        market: 'FOREX',
      }

      // Price rallies to 1.0900 (ahead by 55 pips)
      const update = updateTrailingStop(eurPos, 1.0900, trailDist)
      expect(update.wasRatchetUpdated).toBe(true)
      // Candidate SL = 1.0900 - 0.00325 = 1.08675 -> 1.0868 (toFixed 4)
      expect(update.updatedSlPrice).toBe(1.0868)
      expect(update.updatedSlPrice).toBeGreaterThan(eurPos.slPrice!)

      // Price pulls back to 1.0870 -> stop loss MUST NOT regress
      const updatedPos = { ...eurPos, slPrice: update.updatedSlPrice }
      const pullbackUpdate = updateTrailingStop(updatedPos, 1.0870, trailDist)
      expect(pullbackUpdate.wasRatchetUpdated).toBe(false)
      expect(pullbackUpdate.updatedSlPrice).toBe(1.0868)
    })

    it('guarantees trailing distance is strictly positive even for micro-priced Forex rates', () => {
      const microEntry = 0.00001
      const trailDist = Math.max(0.00001, Number((microEntry * 0.003).toFixed(5)))
      expect(trailDist).toBe(0.00001)
      expect(trailDist).toBeGreaterThan(0)
    })
  })

  // =========================================================================
  // Test 4: Account Lockout on Equity <= 0
  // =========================================================================
  describe('4. Account lockout on equity <= 0', () => {
    it('unconditionally trips circuit breaker in checkCircuitBreaker when equity <= 0', () => {
      // Zero equity
      const zeroRes = checkCircuitBreaker(0, 4.5, 0)
      expect(zeroRes.isTripped).toBe(true)
      expect(zeroRes.reason).toContain('Account equity depleted: $0.00 <= 0')

      // Negative equity
      const negRes = checkCircuitBreaker(0, 4.5, -250.75)
      expect(negRes.isTripped).toBe(true)
      expect(negRes.reason).toContain('Account equity depleted: $-250.75 <= 0')

      // Positive equity with 0% drawdown -> NOT tripped
      const posRes = checkCircuitBreaker(0, 4.5, 1000)
      expect(posRes.isTripped).toBe(false)
    })

    it('trips circuit breaker and locks new orders in recalculateBalanceSheet & evaluateOrderRisk', () => {
      // 1. Account with $0 cash and no positions
      const sheetZero = recalculateBalanceSheet([], 0, 0, 0)
      expect(sheetZero.equity).toBe(0)
      expect(sheetZero.isCircuitBreakerTripped).toBe(true)

      const orderOnZero = evaluateOrderRisk(
        { symbol: 'BTC/USDT', side: 'BUY', size: 0.01, price: 100000, leverage: 10, marginRequired: 100 },
        sheetZero
      )
      expect(orderOnZero.allowed).toBe(false)
      expect(orderOnZero.reason).toContain('CIRCUIT_BREAKER_ACTIVE')

      // 2. Account with negative equity due to unrealized loss exceeding cash
      const lossPos: Position = {
        id: 'huge-loss',
        symbol: 'BTC/USDT',
        side: 'LONG',
        size: 1.0,
        entryPrice: 100000,
        markPrice: 80000,
        liquidationPrice: 70000,
        leverage: 10,
        margin: 10000,
        unrealizedPnl: -25000,
        unrealizedPnlPct: -250,
        market: 'CRYPTO',
      }
      const sheetNegative = recalculateBalanceSheet([lossPos], 10000, 10000, 10000)
      expect(sheetNegative.equity).toBe(-15000)
      expect(sheetNegative.isCircuitBreakerTripped).toBe(true)

      const orderOnNeg = evaluateOrderRisk(
        { symbol: 'BTC/USDT', side: 'BUY', size: 0.01, price: 100000, leverage: 10, marginRequired: 100 },
        sheetNegative
      )
      expect(orderOnNeg.allowed).toBe(false)
      expect(orderOnNeg.reason).toContain('CIRCUIT_BREAKER_ACTIVE')
    })
  })

  // =========================================================================
  // Test 5: Continuous Price Buffering During Bot Cooldowns and Rejection of Infinity
  // =========================================================================
  describe('5. Continuous price buffering during bot cooldowns and rejection of Infinity', () => {
    let engine: BotExecutionEngine

    beforeEach(() => {
      engine = new BotExecutionEngine()
    })

    afterEach(() => {
      engine.stop()
      vi.restoreAllMocks()
    })

    it('buffers price ticks continuously during bot cooldown', () => {
      const internalHistory = (engine as unknown as { priceHistory: Map<string, number[]> }).priceHistory
      const lastSignalTimes = (engine as unknown as { lastSignalTimes: Map<string, number> }).lastSignalTimes

      // Get scalper bot id (trades BTC/USDT, cooldown 15s)
      const scalper = engine.getBot('bot_scalper_btc')
      expect(scalper).toBeDefined()

      // Artificially put scalper into active cooldown right now
      const now = 1700000000000
      vi.spyOn(Date, 'now').mockReturnValue(now)
      lastSignalTimes.set(scalper!.id, now - 5000) // 5s ago, cooldown is 15s -> 10s remaining

      // Feed 10 consecutive ticks for BTC/USDT while in cooldown
      for (let i = 1; i <= 10; i++) {
        const tickPrice = 100000 + i * 10
        engine.handleMarketTick({
          'BTC/USDT': {
            symbol: 'BTC/USDT',
            category: 'CRYPTO',
            midPrice: tickPrice,
            bidPrice: tickPrice - 1,
            askPrice: tickPrice + 1,
            spreadPips: 2,
            spreadUsd: 2,
            high24h: 110000,
            low24h: 90000,
            change24hPct: 0,
            volume24h: 1000,
            lastUpdateTimestamp: now,
            connectionStatus: 'LIVE_WS',
          },
        })
      }

      // Verify that rolling history buffer contains all 10 prices despite active cooldown
      const hist = internalHistory.get('BTC/USDT')
      expect(hist).toBeDefined()
      expect(hist!.length).toBe(10)
      expect(hist![0]).toBe(100010)
      expect(hist![9]).toBe(100100)
    })

    it('strictly rejects Infinity, -Infinity, NaN, 0, and negative prices from rolling buffer', () => {
      const internalHistory = (engine as unknown as { priceHistory: Map<string, number[]> }).priceHistory

      // Seed with 1 valid price
      const validTicker: MarketTicker = {
        symbol: 'BTC/USDT',
        category: 'CRYPTO',
        midPrice: 100000,
        bidPrice: 99999,
        askPrice: 100001,
        spreadPips: 2,
        spreadUsd: 2,
        high24h: 110000,
        low24h: 90000,
        change24hPct: 0,
        volume24h: 1000,
        lastUpdateTimestamp: Date.now(),
        connectionStatus: 'LIVE_WS',
      }
      engine.handleMarketTick({ 'BTC/USDT': validTicker })
      expect(internalHistory.get('BTC/USDT')!.length).toBe(1)

      // Feed invalid prices
      const invalidPrices = [Infinity, -Infinity, NaN, 0, -100, -0.0001]
      for (const bad of invalidPrices) {
        engine.handleMarketTick({
          'BTC/USDT': {
            ...validTicker,
            midPrice: bad,
          },
        })
      }

      // Buffer must remain strictly 1 element
      expect(internalHistory.get('BTC/USDT')!.length).toBe(1)
      expect(internalHistory.get('BTC/USDT')![0]).toBe(100000)
    })
  })

  // =========================================================================
  // Test 6: Exit Settlement Accuracy in Automation and Manual Close
  // =========================================================================
  describe('6. Exit settlement fidelity across Forex, Gold, and Crypto', () => {
    it('properly accounts for commission and exact multiplier in settlePositionExit', () => {
      // 1 lot EUR/USD: 100,000 multiplier, 50 leverage, entry 1.0800, exit 1.0850 (+50 pips)
      const eurPos: Position = {
        id: 'settle-eur',
        symbol: 'EUR/USD',
        side: 'LONG',
        size: 1.0,
        lots: 1.0,
        entryPrice: 1.0800,
        markPrice: 1.0800,
        liquidationPrice: 1.0500,
        leverage: 50,
        margin: 2160.00,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        market: 'FOREX',
      }

      // Commission: 1.0 lot * $2.50 = $2.50
      const eurSettlement = settlePositionExit(eurPos, 1.0850, 'TP_HIT', 2.50)
      // Gross PnL = (1.0850 - 1.0800) * 1.0 * 100,000 = $500.00
      // Net PnL = $500.00 - $2.50 = $497.50
      expect(eurSettlement.realizedPnl).toBe(497.50)
      expect(eurSettlement.releasedMargin).toBe(2160.00)
      expect(eurSettlement.exitReason).toBe('TP_HIT')
      expect(eurSettlement.closedTrade.total).toBe(108500.00) // 1.0 * 1.0850 * 100,000
    })
  })
})
