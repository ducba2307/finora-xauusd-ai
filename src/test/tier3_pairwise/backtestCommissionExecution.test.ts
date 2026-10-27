import { describe, it, expect } from 'vitest'
import { runBacktest } from '@/quant/backtestEngine'
import type { CandlestickPoint } from '@/types/trading'

describe('Tier 3: Pairwise Combination — Backtest Simulation + Commission Deduction', () => {
  const generateTrendCandles = (count: number = 70): CandlestickPoint[] => {
    const candles: CandlestickPoint[] = []
    let price = 1000
    for (let i = 0; i < count; i++) {
      // Create alternating trends to trigger multiple buy & sell cycles
      const trend = (i >= 20 && i < 35) || (i >= 45 && i < 60) ? 15 : -8
      const open = price
      const close = price + trend
      const high = Math.max(open, close) + 4
      const low = Math.min(open, close) - 4
      price = close
      candles.push({
        time: 1700000000 + i * 3600,
        open,
        high,
        low,
        close,
        volume: 2500,
      })
    }
    return candles
  }

  it('accurately discounts trade commission per lot on every entry and exit transaction', () => {
    const candles = generateTrendCandles(70)
    const commissionPerTrade = 10.0 // $10 per trade

    const result = runBacktest({
      symbol: 'BTC/USDT',
      candles,
      initialCapital: 100000,
      strategyType: 'SMA_CROSSOVER',
      smaFast: 5,
      smaSlow: 15,
      commissionPerLotUsd: commissionPerTrade,
      spreadPips: 1.0,
      slippagePct: 0.0002,
    })

    expect(result.totalTrades).toBeGreaterThanOrEqual(1)

    // Compare with zero commission run
    const zeroCommResult = runBacktest({
      symbol: 'BTC/USDT',
      candles,
      initialCapital: 100000,
      strategyType: 'SMA_CROSSOVER',
      smaFast: 5,
      smaSlow: 15,
      commissionPerLotUsd: 0,
      spreadPips: 1.0,
      slippagePct: 0.0002,
    })

    // Net profit difference should be at least (totalTrades * commissionPerTrade)
    const expectedCommissionImpact = result.totalTrades * commissionPerTrade
    const profitDifference = zeroCommResult.netProfitUsd - result.netProfitUsd

    expect(profitDifference).toBeGreaterThanOrEqual(expectedCommissionImpact - 1.0)
  })

  it('ensures dynamic equity curve reflects mark-to-market valuations and commission hits on trade close', () => {
    const candles = generateTrendCandles(60)
    const initialCapital = 50000

    const result = runBacktest({
      symbol: 'ETH/USDT',
      candles,
      initialCapital,
      strategyType: 'SMA_CROSSOVER',
      smaFast: 5,
      smaSlow: 15,
      commissionPerLotUsd: 5.0,
    })

    expect(result.equityCurve).toHaveLength(60)

    // Starting equity matches initial capital
    expect(result.equityCurve[0].strategy).toBe(initialCapital)

    // Each bar's equity is strictly finite and positive
    for (const pt of result.equityCurve) {
      expect(Number.isFinite(pt.strategy)).toBe(true)
      expect(pt.strategy).toBeGreaterThan(0)
    }

    // Final equity curve endpoint matches initialCapital + netProfitUsd
    const finalPt = result.equityCurve[result.equityCurve.length - 1]
    expect(finalPt.strategy).toBeCloseTo(initialCapital + result.netProfitUsd, 1)
  })
})
