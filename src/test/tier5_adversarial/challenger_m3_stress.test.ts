import { describe, it, expect } from 'vitest'
import {
  checkCircuitBreaker,
  recalculateBalanceSheet,
  evaluateOrderRisk,
  calculatePositionPnl,
  type AccountBalanceSheet,
} from '@/engine/riskEngine'

import {
  updateTrailingStop,
  checkPositionExitTriggers,
  settlePositionExit,
  processOrderPipeline,
  isForexSymbol,
  type OrderSignal,
} from '@/engine/orderLifecycle'
import type { Position } from '@/types/trading'

describe('Tier 5 Adversarial: Milestone 3 Empirical Stress & Edge Case Verification', () => {
  // =========================================================================
  // 1. Circuit Breaker Exact Threshold Boundaries (4.49% vs 4.50% vs 4.51%)
  // =========================================================================
  describe('1. Circuit Breaker exact boundary tests (4.49% vs 4.50% vs 4.51%)', () => {
    it('does NOT trip at 4.49% drawdown (sub-threshold boundary)', () => {
      const res = checkCircuitBreaker(4.49, 4.5)
      expect(res.isTripped).toBe(false)
      expect(res.reason).toBeUndefined()
    })

    it('trips immediately at exactly 4.50% drawdown (exact threshold boundary)', () => {
      const res = checkCircuitBreaker(4.50, 4.5)
      expect(res.isTripped).toBe(true)
      expect(res.reason).toContain('Daily Max Drawdown Circuit Breaker Tripped: 4.50% >= 4.5%')
    })

    it('trips immediately at 4.51% drawdown (super-threshold boundary)', () => {
      const res = checkCircuitBreaker(4.51, 4.5)
      expect(res.isTripped).toBe(true)
      expect(res.reason).toContain('Daily Max Drawdown Circuit Breaker Tripped: 4.51% >= 4.5%')
    })

    it('reflects exact 4.49%, 4.50%, and 4.51% boundaries through recalculateBalanceSheet & evaluateOrderRisk', () => {
      const peak = 100000.0

      // 4.49% drawdown: Equity = 100,000 - 4,490 = 95,510
      const sheetSafe = recalculateBalanceSheet([], 95510, peak, peak)
      expect(sheetSafe.dailyDrawdownPct).toBe(4.49)
      expect(sheetSafe.isCircuitBreakerTripped).toBe(false)

      const safeOrder = evaluateOrderRisk(
        { symbol: 'BTC/USDT', side: 'BUY', size: 0.05, price: 100000, leverage: 10, marginRequired: 500 },
        sheetSafe
      )
      expect(safeOrder.allowed).toBe(true)

      // 4.50% drawdown: Equity = 100,000 - 4,500 = 95,500
      const sheetExact = recalculateBalanceSheet([], 95500, peak, peak)
      expect(sheetExact.dailyDrawdownPct).toBe(4.50)
      expect(sheetExact.isCircuitBreakerTripped).toBe(true)

      const exactOrder = evaluateOrderRisk(
        { symbol: 'BTC/USDT', side: 'BUY', size: 0.05, price: 100000, leverage: 10, marginRequired: 500 },
        sheetExact
      )
      expect(exactOrder.allowed).toBe(false)
      expect(exactOrder.reason).toContain('CIRCUIT_BREAKER_ACTIVE')

      // 4.51% drawdown: Equity = 100,000 - 4,510 = 95,490
      const sheetBreach = recalculateBalanceSheet([], 95490, peak, peak)
      expect(sheetBreach.dailyDrawdownPct).toBe(4.51)
      expect(sheetBreach.isCircuitBreakerTripped).toBe(true)

      const breachOrder = evaluateOrderRisk(
        { symbol: 'BTC/USDT', side: 'BUY', size: 0.05, price: 100000, leverage: 10, marginRequired: 500 },
        sheetBreach
      )
      expect(breachOrder.allowed).toBe(false)
      expect(breachOrder.reason).toContain('CIRCUIT_BREAKER_ACTIVE')
    })
  })

  // =========================================================================
  // 2. Circuit Breaker Behavior When Equity is Negative or Starting Equity is Zero
  // =========================================================================
  describe('2. Circuit Breaker behavior on negative equity and zero starting equity', () => {
    it('trips circuit breaker when equity plunges into negative territory from normal starting equity', () => {
      const peak = 50000.0
      // Loss exceeds starting cash by $5,000, resulting in negative equity: -$5,000
      const lossPos: Position = {
        id: 'p_loss',
        symbol: 'BTC/USDT',
        side: 'LONG',
        size: 1.0,
        entryPrice: 100000,
        markPrice: 90000,
        liquidationPrice: 85000,
        leverage: 10,
        margin: 10000,
        unrealizedPnl: -55000,
        unrealizedPnlPct: -550,
        market: 'CRYPTO',
      }

      const sheet = recalculateBalanceSheet([lossPos], 50000, peak, peak)
      expect(sheet.equity).toBe(-5000)
      // Drawdown = 50,000 - (-5,000) = 55,000 -> 110%
      expect(sheet.dailyDrawdownPct).toBe(110)
      expect(sheet.isCircuitBreakerTripped).toBe(true)
    })

    it('documents behavior when starting equity is zero: unconditionally trips circuit breaker', () => {
      // Account with $0 starting equity, $0 peak, $0 cash
      const sheetZero = recalculateBalanceSheet([], 0, 0, 0)
      expect(sheetZero.equity).toBe(0)
      expect(sheetZero.peakDailyEquity).toBe(0)
      expect(sheetZero.dailyDrawdownPct).toBe(0)
      // Circuit breaker is tripped because equity <= 0
      expect(sheetZero.isCircuitBreakerTripped).toBe(true)
      expect(sheetZero.circuitBreakerReason).toContain('Account equity depleted')

      // Pre-trade risk evaluation blocks new orders due to CIRCUIT_BREAKER_ACTIVE
      const order = evaluateOrderRisk(
        { symbol: 'BTC/USDT', side: 'BUY', size: 0.01, price: 100000, leverage: 10, marginRequired: 100 },
        sheetZero
      )
      expect(order.allowed).toBe(false)
      expect(order.reason).toContain('CIRCUIT_BREAKER_ACTIVE')
    })

    it('identifies boundary remediation: negative equity with zero initial peak unconditionally trips circuit breaker', () => {
      const lossPos: Position = {
        id: 'p_loss_0',
        symbol: 'BTC/USDT',
        side: 'LONG',
        size: 0.1,
        entryPrice: 100000,
        markPrice: 95000,
        liquidationPrice: 90000,
        leverage: 10,
        margin: 1000,
        unrealizedPnl: -500,
        unrealizedPnlPct: -50,
        market: 'CRYPTO',
      }

      const sheetNegativeFromZero = recalculateBalanceSheet([lossPos], 0, 0, 0)
      expect(sheetNegativeFromZero.equity).toBe(-500)
      // Unconditional circuit breaker trip on equity <= 0
      expect(sheetNegativeFromZero.isCircuitBreakerTripped).toBe(true)
      expect(sheetNegativeFromZero.circuitBreakerReason).toContain('Account equity depleted')
    })
  })

  // =========================================================================
  // 3. Trailing Stop Ratchet Invariance Under Erratic Price Swings
  // =========================================================================
  describe('3. Trailing Stop ratchet under erratic price swings', () => {
    it('verifies stop loss strictly increases for Longs and never regresses across erratic swings', () => {
      const pos: Position = {
        id: 'pos_long_swing',
        symbol: 'BTC/USDT',
        side: 'LONG',
        size: 0.1,
        entryPrice: 100000,
        markPrice: 100000,
        liquidationPrice: 90000,
        leverage: 10,
        margin: 1000,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        slPrice: 95000,
      }

      const trailDist = 1000
      let currentPos = { ...pos }
      const priceSwings = [
        100000, // Initial
        102000, // Up -> SL = 101000
        101200, // Down -> SL must stay 101000
        104000, // Up -> SL = 103000
        103500, // Down -> SL must stay 103000
        102000, // Deep drop -> SL must stay 103000
        105500, // New peak -> SL = 104500
        99000,  // Crash -> SL must stay 104500
        108000, // Huge rally -> SL = 107000
        90000,  // Complete dump -> SL must stay 107000
      ]

      let prevSl = currentPos.slPrice!
      for (const price of priceSwings) {
        const update = updateTrailingStop(currentPos, price, trailDist)
        expect(update.updatedSlPrice).toBeGreaterThanOrEqual(prevSl)
        if (update.wasRatchetUpdated) {
          expect(update.updatedSlPrice).toBe(price - trailDist)
          expect(update.updatedSlPrice).toBeGreaterThan(prevSl)
        }
        currentPos = { ...currentPos, slPrice: update.updatedSlPrice }
        prevSl = update.updatedSlPrice
      }

      // Final SL must be 108000 - 1000 = 107000
      expect(currentPos.slPrice).toBe(107000)
    })

    it('verifies stop loss strictly decreases for Shorts and never loosens across erratic swings', () => {
      const pos: Position = {
        id: 'pos_short_swing',
        symbol: 'BTC/USDT',
        side: 'SHORT',
        size: 0.1,
        entryPrice: 100000,
        markPrice: 100000,
        liquidationPrice: 110000,
        leverage: 10,
        margin: 1000,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        slPrice: 105000,
      }

      const trailDist = 1000
      let currentPos = { ...pos }
      const priceSwings = [
        100000, // Initial
        98000,  // Down -> SL = 99000
        98800,  // Up -> SL must stay 99000
        96000,  // Down -> SL = 97000
        96500,  // Up -> SL must stay 97000
        98000,  // Spike up -> SL must stay 97000
        94000,  // New trough -> SL = 95000
        101000, // Pump -> SL must stay 95000
        91000,  // Big dump -> SL = 92000
        110000, // Massive squeeze -> SL must stay 92000
      ]

      let prevSl = currentPos.slPrice!
      for (const price of priceSwings) {
        const update = updateTrailingStop(currentPos, price, trailDist)
        expect(update.updatedSlPrice).toBeLessThanOrEqual(prevSl)
        if (update.wasRatchetUpdated) {
          expect(update.updatedSlPrice).toBe(price + trailDist)
          expect(update.updatedSlPrice).toBeLessThan(prevSl)
        }
        currentPos = { ...currentPos, slPrice: update.updatedSlPrice }
        prevSl = update.updatedSlPrice
      }

      // Final SL must be 91000 + 1000 = 92000
      expect(currentPos.slPrice).toBe(92000)
    })

    it('maintains ratchet monotonicity invariant over a 1,000-step Monte Carlo random walk', () => {
      let longPos: Position = {
        id: 'mc_long',
        symbol: 'BTC/USDT',
        side: 'LONG',
        size: 0.1,
        entryPrice: 100000,
        markPrice: 100000,
        liquidationPrice: 80000,
        leverage: 10,
        margin: 1000,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        slPrice: 95000,
      }

      let shortPos: Position = {
        id: 'mc_short',
        symbol: 'BTC/USDT',
        side: 'SHORT',
        size: 0.1,
        entryPrice: 100000,
        markPrice: 100000,
        liquidationPrice: 120000,
        leverage: 10,
        margin: 1000,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        slPrice: 105000,
      }

      const trail = 500
      let price = 100000

      for (let i = 0; i < 1000; i++) {
        // Random step between -200 and +200
        const delta = (Math.random() - 0.48) * 400
        price = Math.max(50000, price + delta)

        const prevLongSl = longPos.slPrice!
        const longUpdate = updateTrailingStop(longPos, price, trail)
        expect(longUpdate.updatedSlPrice).toBeGreaterThanOrEqual(prevLongSl)
        longPos = { ...longPos, slPrice: longUpdate.updatedSlPrice }

        const prevShortSl = shortPos.slPrice!
        const shortUpdate = updateTrailingStop(shortPos, price, trail)
        expect(shortUpdate.updatedSlPrice).toBeLessThanOrEqual(prevShortSl)
        shortPos = { ...shortPos, slPrice: shortUpdate.updatedSlPrice }
      }
    })
  })

  // =========================================================================
  // 4. Priority Ordering of Exits: Flash Crash Past SL and Liquidation
  // =========================================================================
  describe('4. Priority ordering of exits (Liquidation vs SL vs TP)', () => {
    it('prioritizes LIQUIDATION over SL when price flash-crashes past both on Long', () => {
      const longPos: Position = {
        id: 'pos_long_crash',
        symbol: 'BTC/USDT',
        side: 'LONG',
        size: 1.0,
        entryPrice: 100000,
        markPrice: 100000,
        slPrice: 95000,          // SL at 95,000
        liquidationPrice: 90000, // Liquidation at 90,000
        leverage: 10,
        margin: 10000,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        tpPrice: 110000,
      }

      // Flash crash in a single tick from 100k straight to 85k (below both SL 95k and Liq 90k)
      const exitResult = checkPositionExitTriggers(longPos, 85000)

      expect(exitResult.shouldExit).toBe(true)
      expect(exitResult.exitReason).toBe('LIQUIDATION_TRIGGERED')
      expect(exitResult.exitPrice).toBe(90000) // Liquidation price assigned
    })

    it('prioritizes LIQUIDATION over SL when price flash-spikes past both on Short', () => {
      const shortPos: Position = {
        id: 'pos_short_spike',
        symbol: 'BTC/USDT',
        side: 'SHORT',
        size: 1.0,
        entryPrice: 100000,
        markPrice: 100000,
        slPrice: 105000,          // SL at 105,000
        liquidationPrice: 110000, // Liquidation at 110,000
        leverage: 10,
        margin: 10000,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        tpPrice: 90000,
      }

      // Flash spike in a single tick to 115k (above both SL 105k and Liq 110k)
      const exitResult = checkPositionExitTriggers(shortPos, 115000)

      expect(exitResult.shouldExit).toBe(true)
      expect(exitResult.exitReason).toBe('LIQUIDATION_TRIGGERED')
      expect(exitResult.exitPrice).toBe(110000)
    })

    it('triggers SL when price breaches SL but stays above Liquidation', () => {
      const longPos: Position = {
        id: 'pos_long_sl_only',
        symbol: 'BTC/USDT',
        side: 'LONG',
        size: 1.0,
        entryPrice: 100000,
        markPrice: 100000,
        slPrice: 95000,
        liquidationPrice: 90000,
        leverage: 10,
        margin: 10000,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        tpPrice: 110000,
      }

      // Price drops to 94,000 (below SL 95,000, but strictly above Liquidation 90,000)
      const exitResult = checkPositionExitTriggers(longPos, 94000)

      expect(exitResult.shouldExit).toBe(true)
      expect(exitResult.exitReason).toBe('SL_HIT')
      expect(exitResult.exitPrice).toBe(95000)
    })

    it('triggers TP when price breaches Take Profit level', () => {
      const longPos: Position = {
        id: 'pos_long_tp',
        symbol: 'BTC/USDT',
        side: 'LONG',
        size: 1.0,
        entryPrice: 100000,
        markPrice: 100000,
        slPrice: 95000,
        liquidationPrice: 90000,
        leverage: 10,
        margin: 10000,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        tpPrice: 110000,
      }

      const exitResult = checkPositionExitTriggers(longPos, 110500)

      expect(exitResult.shouldExit).toBe(true)
      expect(exitResult.exitReason).toBe('TP_HIT')
      expect(exitResult.exitPrice).toBe(110000)
    })
  })

  // =========================================================================
  // 5. Multi-Asset PnL Calculations Under Extreme Pip/Price Movements
  // =========================================================================
  describe('5. Multi-Asset PnL calculations for USD/JPY, Gold XAU/USD, EUR/USD, and BTC/USDT', () => {
    it('calculates EUR/USD PnL with 100,000 lot contract multiplier under extreme 1,000 pip movements', () => {
      const eurPos: Position = {
        id: 'p_eur',
        symbol: 'EUR/USD',
        side: 'LONG',
        size: 1.0,
        lots: 1.0,
        entryPrice: 1.08000,
        markPrice: 1.08000,
        liquidationPrice: 1.05000,
        leverage: 50,
        margin: 2160,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        market: 'FOREX',
      }

      // Normal +100 pips (+0.01000): 0.01000 * 1.0 * 100,000 = +$1,000.00
      const pnlNormal = calculatePositionPnl(eurPos, 1.09000)
      expect(pnlNormal.unrealizedPnl).toBe(1000.00)

      // Extreme -1,000 pips (-0.10000): -0.10000 * 1.0 * 100,000 = -$10,000.00
      const pnlExtreme = calculatePositionPnl(eurPos, 0.98000)
      expect(pnlExtreme.unrealizedPnl).toBe(-10000.00)
      expect(pnlExtreme.unrealizedPnlPct).toBeCloseTo((-10000 / 2160) * 100, 2)
    })

    it('calculates Gold XAU/USD PnL with 100 oz contract multiplier under extreme $300 swings', () => {
      const goldPos: Position = {
        id: 'p_gold',
        symbol: 'XAU/USD',
        side: 'LONG',
        size: 1.0,
        lots: 1.0,
        entryPrice: 2700.00,
        markPrice: 2700.00,
        liquidationPrice: 2500.00,
        leverage: 100,
        margin: 2700,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        market: 'FOREX',
      }

      // Normal +$10/oz move: 10 * 1.0 * 100 = +$1,000.00
      const pnlNormal = calculatePositionPnl(goldPos, 2710.00)
      expect(pnlNormal.unrealizedPnl).toBe(1000.00)

      // Extreme +$300/oz rally: 300 * 1.0 * 100 = +$30,000.00
      const pnlExtreme = calculatePositionPnl(goldPos, 3000.00)
      expect(pnlExtreme.unrealizedPnl).toBe(30000.00)
      expect(pnlExtreme.unrealizedPnlPct).toBeCloseTo((30000 / 2700) * 100, 2)
    })

    it('calculates USD/JPY PnL with JPY quote division and division-by-zero protection under extreme Yen movements', () => {
      const jpyPos: Position = {
        id: 'p_jpy',
        symbol: 'USD/JPY',
        side: 'LONG',
        size: 1.0,
        lots: 1.0,
        entryPrice: 150.00,
        markPrice: 150.00,
        liquidationPrice: 145.00,
        leverage: 50,
        margin: 2000,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        market: 'FOREX',
      }

      // +100 pips (+1.00 JPY) at 151.00: 100,000 JPY / 151.00 = +$662.25 USD
      const pnlNormal = calculatePositionPnl(jpyPos, 151.00)
      expect(pnlNormal.unrealizedPnl).toBe(662.25)

      // Extreme Yen intervention: -20.00 JPY crash (150 -> 130):
      // -20 * 1.0 * 100,000 = -2,000,000 JPY / 130.00 = -$15,384.62 USD
      const pnlExtreme = calculatePositionPnl(jpyPos, 130.00)
      expect(pnlExtreme.unrealizedPnl).toBe(-15384.62)

      // Guard: non-positive or invalid markPrice does not divide by zero
      const pnlZero = calculatePositionPnl(jpyPos, 0)
      expect(pnlZero.unrealizedPnl).toBe(0)
    })

    it('verifies BTC/USDT in orderLifecycle is correctly classified as CRYPTO and not FOREX', () => {
      const healthySheet: AccountBalanceSheet = recalculateBalanceSheet([], 50000, 50000, 50000)

      const btcSignal: OrderSignal = {
        id: 'sig_btc_test',
        symbol: 'BTC/USDT',
        side: 'BUY',
        size: 0.1,
        price: 100000,
        leverage: 10,
        slPrice: 98000,
        tpPrice: 105000,
      }

      // Process through order lifecycle pipeline
      const result = processOrderPipeline(btcSignal, healthySheet)
      expect(result.status).toBe('FILLED')
      const createdPos = result.positionCreated!

      expect(createdPos.market).toBe('CRYPTO')
      expect(createdPos.lots).toBeUndefined()

      // True PnL on 0.1 BTC with $100 price gain is 0.1 * 100 = $10.00
      const pnl = calculatePositionPnl(createdPos, createdPos.entryPrice + 100)
      expect(pnl.unrealizedPnl).toBe(10.00)

      // settlePositionExit applies unit multiplier (1) for CRYPTO
      const settlement = settlePositionExit(createdPos, createdPos.entryPrice + 100, 'MANUAL_CLOSE')
      expect(settlement.realizedPnl).toBe(10.00)
    })

    it('verifies settlePositionExit on CRYPTO BTC/USDT position accurately calculates unit PnL', () => {
      const cryptoPos: Position = {
        id: 'pos_crypto_direct',
        symbol: 'BTC/USDT',
        side: 'LONG',
        size: 0.1,
        entryPrice: 100000,
        markPrice: 100000,
        liquidationPrice: 90000,
        leverage: 10,
        margin: 1000,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        market: 'CRYPTO',
      }

      // Exit at $100 higher: true profit on 0.1 BTC is $10.00 USD.
      const settlement = settlePositionExit(cryptoPos, 100100, 'MANUAL_CLOSE')

      expect(settlement.realizedPnl).toBe(10.00)
    })
  })

  // =========================================================================
  // 9. Institutional Multiplier & Asset Classification Remediation Verification
  // =========================================================================
  describe('9. Institutional Contract Multipliers & Strict Asset Classification', () => {
    it('proves isForexSymbol strictly rejects Tether crypto and accepts Forex/Gold', () => {
      expect(isForexSymbol('BTC/USDT')).toBe(false)
      expect(isForexSymbol('ETH/USDT')).toBe(false)
      expect(isForexSymbol('SOL/USDT')).toBe(false)
      expect(isForexSymbol('BTC/USD')).toBe(false)
      expect(isForexSymbol('EUR/USD')).toBe(true)
      expect(isForexSymbol('GBP/USD')).toBe(true)
      expect(isForexSymbol('USD/JPY')).toBe(true)
      expect(isForexSymbol('XAU/USD')).toBe(true)
      expect(isForexSymbol('')).toBe(false)
    })

    it('validates Forex 100,000 contract multiplier in processOrderPipeline and margin allocation', () => {
      const sheet = recalculateBalanceSheet([], 100000, 100000, 100000)
      const eurSignal: OrderSignal = {
        id: 'sig_eur_inst',
        symbol: 'EUR/USD',
        side: 'BUY',
        size: 1.0, // 1 standard lot = 100,000 units
        price: 1.0825,
        leverage: 50,
      }

      const result = processOrderPipeline(eurSignal, sheet)
      expect(result.status).toBe('FILLED')
      const pos = result.positionCreated!
      expect(pos.market).toBe('FOREX')
      expect(pos.lots).toBe(1.0)
      // Notional = 1.0 * 1.0825 * 100,000 = $108,250.00
      // Margin = 108,250 / 50 = $2,165.00
      expect(pos.margin).toBe(2165.00)
      expect(result.executedTrade?.total).toBe(108250.00)

      // Test settlement on 50 pips gain (+0.0050 from fill price)
      const settlement = settlePositionExit(pos, Number((pos.entryPrice + 0.0050).toFixed(4)), 'TP_HIT')
      expect(settlement.realizedPnl).toBe(500.00) // 0.0050 * 1.0 * 100,000 = $500.00
      expect(settlement.releasedMargin).toBe(2165.00)
    })

    it('validates Gold 100 contract multiplier in processOrderPipeline and margin allocation', () => {
      const sheet = recalculateBalanceSheet([], 100000, 100000, 100000)
      const goldSignal: OrderSignal = {
        id: 'sig_gold_inst',
        symbol: 'XAU/USD',
        side: 'BUY',
        size: 0.5, // 0.5 lot = 50 oz
        price: 2700.0,
        leverage: 30,
      }

      const result = processOrderPipeline(goldSignal, sheet)
      expect(result.status).toBe('FILLED')
      const pos = result.positionCreated!
      expect(pos.market).toBe('FOREX')
      expect(pos.lots).toBe(0.5)
      // Notional = 0.5 * 2700.0 * 100 = $135,000.00
      // Margin = 135,000 / 30 = $4,500.00
      expect(pos.margin).toBe(4500.00)
      expect(result.executedTrade?.total).toBe(135000.00)

      // Test settlement on +$10.00 gold surge from fill price
      const settlement = settlePositionExit(pos, Number((pos.entryPrice + 10.0).toFixed(4)), 'TP_HIT')
      expect(settlement.realizedPnl).toBe(500.00) // 10.00 * 0.5 * 100 = $500.00
      expect(settlement.releasedMargin).toBe(4500.00)
    })
  })
})
