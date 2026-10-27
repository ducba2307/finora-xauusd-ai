import { describe, it, expect } from 'vitest'
import {
  safeDivide,
  calculateSharpeRatio,
  calculateSortinoRatio,
  calculateCalmarRatio,
  calculateMaxDrawdown,
  calculateExpectancy,
  calculateRDistribution,
} from '@/quant/metrics'

describe('Tier 1: F06 Universal Financial Math Engine', () => {
  it('safeDivide: divides normally and returns fallback on division by zero or NaN', () => {
    expect(safeDivide(100, 2)).toBe(50)
    expect(safeDivide(100, 0, 0)).toBe(0)
    expect(safeDivide(100, 0, -1)).toBe(-1)
    expect(safeDivide(NaN, 5, 0)).toBe(0)
    expect(safeDivide(5, NaN, 0)).toBe(0)
    expect(safeDivide(Infinity, 5, 0)).toBe(0)
  })

  it('calculateSharpeRatio: computes annualized Sharpe with known return series', () => {
    // 10 days of positive steady daily returns ~ 1% each day with small variance
    const dailyReturns = [0.012, 0.008, 0.015, 0.009, 0.011, 0.014, 0.007, 0.013, 0.010, 0.011]
    const sharpe = calculateSharpeRatio(dailyReturns, 0.02, 252)

    expect(Number.isFinite(sharpe)).toBe(true)
    expect(sharpe).toBeGreaterThan(1.0) // Strong positive Sharpe
    expect(sharpe).not.toBeNaN()
  })

  it('calculateSortinoRatio: penalizes only downside volatility below MAR', () => {
    // Strategy with high upside spikes and minimal downside
    const returns = [0.05, 0.04, -0.005, 0.06, -0.002, 0.03, 0.04, -0.008, 0.05, 0.02]
    const sortino = calculateSortinoRatio(returns, 0, 252)
    const sharpe = calculateSharpeRatio(returns, 0, 252)

    expect(Number.isFinite(sortino)).toBe(true)
    // Sortino should be significantly higher than Sharpe because upside volatility is not penalized
    expect(sortino).toBeGreaterThan(sharpe)
  })

  it('calculateCalmarRatio: computes CAGR / |MaxDrawdown| strictly without division by zero', () => {
    const calmar = calculateCalmarRatio(25.5, 8.5)
    expect(calmar).toBe(3.0)

    // With negative return
    const negativeCalmar = calculateCalmarRatio(-10.0, 15.0)
    expect(negativeCalmar).toBe(-0.6667)

    // With zero drawdown: should return finite ratio, never Infinity
    const zeroDdCalmar = calculateCalmarRatio(20.0, 0)
    expect(Number.isFinite(zeroDdCalmar)).toBe(true)
    expect(zeroDdCalmar).toBe(99.99)
  })

  it('calculateMaxDrawdown: accurately captures peak, trough, and drawdown percentages', () => {
    // Peak at 120, trough at 90 -> drawdown of 30 USD, which is (30 / 120) * 100 = 25%
    const equityCurve = [100, 105, 115, 120, 110, 95, 90, 105, 118, 125]
    const mdd = calculateMaxDrawdown(equityCurve)

    expect(mdd.maxDrawdownUsd).toBe(30)
    expect(mdd.maxDrawdownPct).toBe(25)
    expect(mdd.peakEquity).toBe(120)
    expect(mdd.troughEquity).toBe(90)
  })

  it('calculateExpectancy: derives statistical edge in both USD and R-multiples', () => {
    const trades = [
      { pnl: 500, rMultiple: 2.5, riskUsd: 200 },
      { pnl: 300, rMultiple: 1.5, riskUsd: 200 },
      { pnl: -200, rMultiple: -1.0, riskUsd: 200 },
      { pnl: 600, rMultiple: 3.0, riskUsd: 200 },
      { pnl: -200, rMultiple: -1.0, riskUsd: 200 },
    ]

    const stats = calculateExpectancy(trades)
    expect(stats.winRate).toBe(60.0) // 3 wins out of 5 = 60%
    expect(stats.expectancyUsd).toBe(200) // (500 + 300 - 200 + 600 - 200) / 5 = 200
    expect(stats.expectancyR).toBe(1.0) // (2.5 + 1.5 - 1.0 + 3.0 - 1.0) / 5 = 1.0R
    expect(stats.avgWinR).toBeCloseTo(2.33, 1)
    expect(stats.avgLossR).toBe(1.0)
    expect(stats.profitFactor).toBe(3.5) // 1400 / 400 = 3.5
  })

  it('calculateRDistribution: dynamically sorts trades into 7 R-buckets with skewness', () => {
    const trades = [
      { pnl: -450, rMultiple: -2.5 },
      { pnl: -250, rMultiple: -1.5 },
      { pnl: -100, rMultiple: -0.5 },
      { pnl: 150, rMultiple: 0.8 },
      { pnl: 300, rMultiple: 1.5 },
      { pnl: 500, rMultiple: 2.5 },
      { pnl: 900, rMultiple: 4.2 },
    ]

    const distribution = calculateRDistribution(trades)
    expect(distribution.buckets).toHaveLength(7)

    // Each defined bucket should have exactly 1 trade here
    const totalCount = distribution.buckets.reduce((acc: number, b) => acc + b.count, 0)
    expect(totalCount).toBe(7)

    const topBucket = distribution.buckets.find((b) => b.bucket === '> 3R')
    expect(topBucket?.count).toBe(1)
    expect(topBucket?.pnl).toBe(900)

    expect(Number.isFinite(distribution.skewness)).toBe(true)
  })
})
