import { describe, it, expect } from 'vitest'
import {
  calculateSharpeRatio,
  calculateSortinoRatio,
  calculateMaxDrawdown,
  calculateExpectancy,
  calculateRDistribution,
} from '@/quant/metrics'
import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateATR,
} from '@/quant/indicators'
import { runBacktest } from '@/quant/backtestEngine'
import { recalculateBalanceSheet } from '@/engine/riskEngine'

describe('Tier 2: Boundary & Corner Cases — Empty & Single Element Datasets', () => {
  it('handles empty returns array across statistical metrics without throw', () => {
    expect(calculateSharpeRatio([])).toBe(0)
    expect(calculateSortinoRatio([])).toBe(0)
    expect(calculateMaxDrawdown([])).toEqual({
      maxDrawdownPct: 0,
      maxDrawdownUsd: 0,
      peakEquity: 0,
      troughEquity: 0,
    })
  })

  it('handles single return element: returns 0 because variance requires at least 2 samples', () => {
    expect(calculateSharpeRatio([0.05])).toBe(0)
    expect(calculateSortinoRatio([0.05])).toBe(0)
    expect(calculateMaxDrawdown([10000])).toEqual({
      maxDrawdownPct: 0,
      maxDrawdownUsd: 0,
      peakEquity: 10000,
      troughEquity: 10000,
    })
  })

  it('handles empty candles array in backtest engine with zero trades and intact capital', () => {
    const result = runBacktest({
      symbol: 'BTC/USDT',
      candles: [],
      initialCapital: 75000,
    })

    expect(result.totalTrades).toBe(0)
    expect(result.winRate).toBe(0)
    expect(result.profitFactor).toBe(0)
    expect(result.sharpeRatio).toBe(0)
    expect(result.sortinoRatio).toBe(0)
    expect(result.netProfitUsd).toBe(0)
    expect(result.equityCurve.length).toBeGreaterThanOrEqual(1)
    expect(result.equityCurve[0].strategy).toBe(75000)
  })

  it('handles single candle series in indicators without crashing or returning NaN', () => {
    const singlePrice = [105.5]
    expect(calculateSMA(singlePrice, 5)).toEqual([105.5])
    expect(calculateEMA(singlePrice, 10)).toEqual([105.5])
    expect(calculateRSI(singlePrice, 14)).toEqual([50])

    const singleCandle = [{ time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 50 }]
    const atr = calculateATR(singleCandle, 14)
    expect(atr).toEqual([20]) // 110 - 90 = 20
  })

  it('handles empty trade histories in expectancy and R-distribution returning safe zeroed state', () => {
    const exp = calculateExpectancy([])
    expect(exp.expectancyUsd).toBe(0)
    expect(exp.expectancyR).toBe(0)
    expect(exp.winRate).toBe(0)
    expect(exp.profitFactor).toBe(0)

    const rDist = calculateRDistribution([])
    expect(rDist.buckets).toHaveLength(7)
    for (const b of rDist.buckets) {
      expect(b.count).toBe(0)
      expect(b.pnl).toBe(0)
      expect(b.pct).toBe(0)
    }
    expect(rDist.skewness).toBe(0)
  })

  it('handles empty positions array in dynamic balance sheet maintaining full free margin', () => {
    const sheet = recalculateBalanceSheet([], 50000, 50000, 50000)
    expect(sheet.equity).toBe(50000)
    expect(sheet.marginUsed).toBe(0)
    expect(sheet.freeMargin).toBe(50000)
    expect(sheet.marginLevelPct).toBe(999.99)
    expect(sheet.dailyDrawdownPct).toBe(0)
    expect(sheet.isCircuitBreakerTripped).toBe(false)
  })
})
