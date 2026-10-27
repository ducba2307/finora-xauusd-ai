import { describe, it, expect } from 'vitest'
import { MarketDataStore } from '@/stores/marketStore'
import {
  processOrderPipeline,
  updateTrailingStop,
  checkPositionExitTriggers,
  type OrderSignal,
} from '@/engine/orderLifecycle'
import {
  recalculateBalanceSheet,
  type AccountBalanceSheet,
} from '@/engine/riskEngine'
import { calculateSharpeRatio, calculateMaxDrawdown } from '@/quant/metrics'
import type { Position } from '@/types/trading'

describe('Tier 4: Real-World Scenario — Gold News Event High Volatility Spike (NFP / CPI)', () => {
  it('simulates macroeconomic news spike on XAU/USD with widening spreads, trailing ratchet, and zero NaN errors', () => {
    const store = new MarketDataStore()
    const initialCash = 100000
    let balanceSheet: AccountBalanceSheet = recalculateBalanceSheet([], initialCash, initialCash, initialCash)

    // Pre-news Gold state: price 2734.50, normal spread 1.5 pips
    const preNewsTicker = store.getTicker('XAU/USD')!
    expect(preNewsTicker.midPrice).toBe(2734.5)

    // 1. News Drops: Violent initial downside dip to 2710.00 (-$24.50)
    // Liquidity providers widen spread from 1.5 pips to 8.0 pips
    const widenedSpreadPips = 8.0
    const dipPrice = 2710.0
    store.setTicker({
      ...preNewsTicker,
      midPrice: dipPrice,
      bidPrice: dipPrice - 0.4,
      askPrice: dipPrice + 0.4,
      spreadPips: widenedSpreadPips,
    })

    // 2. Volatility Hunter enters Long on oversold rebound
    const signal: OrderSignal = {
      id: 'sig_nfp_gold_long',
      symbol: 'XAU/USD',
      side: 'BUY',
      size: 2.0, // 2 lots
      price: dipPrice,
      leverage: 30, // Margin: 2 * 2710 / 30 = $180.67
      slPrice: 2695.0, // Initial SL $15 below
      tpPrice: 2760.0,
      trailingDistance: 10.0,
    }

    const orderResult = processOrderPipeline(signal, balanceSheet, {}, widenedSpreadPips, 0.001)
    expect(orderResult.status).toBe('FILLED')
    expect(orderResult.fillPrice).toBeGreaterThan(dipPrice) // High slippage & spread accounted for

    let position: Position = orderResult.positionCreated!
    balanceSheet = recalculateBalanceSheet([position], initialCash, initialCash, initialCash)
    expect(balanceSheet.marginUsed).toBeGreaterThan(0)

    // 3. News Reversal: Gold violently surges to 2755.00 (+45 USD in minutes)
    const surgePrice = 2755.0
    position = {
      ...position,
      markPrice: surgePrice,
      unrealizedPnl: (surgePrice - position.entryPrice) * position.size,
    }

    // Trailing stop activates and ratchets upwards:
    // Candidate SL: 2755 - 10 = 2745.00 (far above initial SL 2695.00)
    const trailingUpdate = updateTrailingStop(position, surgePrice, 10.0, 5.0)
    expect(trailingUpdate.wasRatchetUpdated).toBe(true)
    expect(trailingUpdate.updatedSlPrice).toBe(2745.0)

    position = { ...position, slPrice: trailingUpdate.updatedSlPrice }

    // 4. Pullback & Exit: Gold pulls back to 2744.50, hitting ratcheted trailing stop at 2745.00
    const exitCheck = checkPositionExitTriggers(position, 2744.5)
    expect(exitCheck.shouldExit).toBe(true)
    expect(exitCheck.exitReason).toBe('SL_HIT') // Trailing SL locked in profit

    // 5. Realize profit and verify account health
    const realizedPnl = (position.slPrice! - position.entryPrice) * position.size - orderResult.commissionUsd!
    expect(realizedPnl).toBeGreaterThan(50) // Solid net gain captured

    const finalCash = initialCash + realizedPnl
    const finalSheet = recalculateBalanceSheet([], finalCash, finalCash, initialCash)
    expect(finalSheet.equity).toBeGreaterThan(initialCash)
    expect(finalSheet.dailyDrawdownPct).toBe(0)

    // 6. Verify mathematical stability: zero NaN or Infinity across metrics
    const returnsSeries = [(finalCash - initialCash) / initialCash, 0.005, -0.002]
    const sharpe = calculateSharpeRatio(returnsSeries)
    const mdd = calculateMaxDrawdown([initialCash, initialCash + realizedPnl])

    expect(Number.isFinite(sharpe)).toBe(true)
    expect(sharpe).not.toBeNaN()
    expect(mdd.maxDrawdownPct).toBe(0)
  })
})
