import { describe, it, expect } from 'vitest'
import { runBacktest } from '@/quant/backtestEngine'
import { calculateRDistribution } from '@/quant/metrics'
import type { CandlestickPoint } from '@/types/trading'

describe('Tier 4: Real-World Scenario — 100-Bar Multi-Trade Backtest Execution', () => {
  // Generate realistic 100-candle multi-regime series (Uptrend -> Range -> Selloff -> Rebound)
  const generate100Candles = (): CandlestickPoint[] => {
    const candles: CandlestickPoint[] = []
    let price = 2500.0

    for (let i = 0; i < 100; i++) {
      let delta = 0
      if (i < 25) delta = 8 // Initial strong rally
      else if (i < 50) delta = (i % 2 === 0 ? 6 : -5) // Consolidation range
      else if (i < 75) delta = -9 // Sharp bear decline
      else delta = 7 // Final recovery rebound

      const open = price
      const close = price + delta
      const high = Math.max(open, close) + 4.5
      const low = Math.min(open, close) - 4.5
      price = close

      candles.push({
        time: 1700000000 + i * 3600,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume: 3500 + (i % 5) * 200,
      })
    }
    return candles
  }

  it('executes full 100-bar simulation and produces comprehensive finite scorecard', () => {
    const candles = generate100Candles()
    expect(candles).toHaveLength(100)

    const initialCapital = 100000.0
    const backtestResult = runBacktest({
      symbol: 'XAU/USD',
      candles,
      initialCapital,
      strategyType: 'SMA_CROSSOVER',
      smaFast: 5,
      smaSlow: 15,
      spreadPips: 2.0,
      slippagePct: 0.0003,
      commissionPerLotUsd: 5.0,
    })

    // 1. Trade counts and execution verification
    expect(backtestResult.totalTrades).toBeGreaterThanOrEqual(1)
    expect(backtestResult.equityCurve).toHaveLength(100)

    // 2. Scorecard finite metrics verification
    expect(Number.isFinite(backtestResult.winRate)).toBe(true)
    expect(backtestResult.winRate).toBeGreaterThanOrEqual(0)
    expect(backtestResult.winRate).toBeLessThanOrEqual(100)

    expect(Number.isFinite(backtestResult.profitFactor)).toBe(true)
    expect(backtestResult.profitFactor).toBeGreaterThanOrEqual(0)

    expect(Number.isFinite(backtestResult.sharpeRatio)).toBe(true)
    expect(backtestResult.sharpeRatio).not.toBeNaN()

    expect(Number.isFinite(backtestResult.sortinoRatio)).toBe(true)
    expect(backtestResult.sortinoRatio).not.toBeNaN()

    expect(Number.isFinite(backtestResult.maxDrawdown)).toBe(true)
    expect(backtestResult.maxDrawdown).toBeGreaterThanOrEqual(0)

    expect(Number.isFinite(backtestResult.netProfitUsd)).toBe(true)
    expect(Number.isFinite(backtestResult.netProfitPct)).toBe(true)

    // 3. Equity Curve point-by-point integrity
    for (let i = 0; i < backtestResult.equityCurve.length; i++) {
      const pt = backtestResult.equityCurve[i]
      expect(Number.isFinite(pt.strategy)).toBe(true)
      expect(Number.isFinite(pt.benchmark)).toBe(true)
      expect(pt.strategy).toBeGreaterThan(0)
      expect(pt.benchmark).toBeGreaterThan(0)
      expect(pt.timestamp).toBeDefined()
    }

    // 4. Derive R-Distribution from trade results
    const mockTradeRs = [
      { rMultiple: 2.1, pnl: 420 },
      { rMultiple: -1.0, pnl: -200 },
      { rMultiple: 3.4, pnl: 680 },
      { rMultiple: -0.8, pnl: -160 },
      { rMultiple: 1.5, pnl: 300 },
    ]
    const rDist = calculateRDistribution(mockTradeRs)

    expect(rDist.buckets).toHaveLength(7)
    const bucketSum = rDist.buckets.reduce((acc: number, b) => acc + b.count, 0)
    expect(bucketSum).toBe(5)
    expect(Number.isFinite(rDist.skewness)).toBe(true)
    expect(rDist.skewness).not.toBeNaN()
  })
})
