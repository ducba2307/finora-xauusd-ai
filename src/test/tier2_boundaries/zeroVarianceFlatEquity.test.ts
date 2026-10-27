import { describe, it, expect } from 'vitest'
import {
  calculateSharpeRatio,
  calculateSortinoRatio,
  calculateCalmarRatio,
  calculateMaxDrawdown,
  calculateExpectancy,
} from '@/quant/metrics'

describe('Tier 2: Boundary & Corner Cases — Zero Variance & Flat Equity Curves', () => {
  it('guarantees Sharpe = 0 when daily returns are identical (zero standard deviation)', () => {
    // 10 identical return values (variance = 0)
    const flatReturns = [0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01]
    const sharpe = calculateSharpeRatio(flatReturns, 0.02, 252)

    expect(Number.isFinite(sharpe)).toBe(true)
    expect(sharpe).toBe(0) // Standard deviation is 0 -> ratio must return 0, never NaN or Infinity
  })

  it('guarantees 0% Max Drawdown for completely flat equity curves', () => {
    const flatEquity = new Array(50).fill(50000)
    const mdd = calculateMaxDrawdown(flatEquity)

    expect(mdd.maxDrawdownPct).toBe(0)
    expect(mdd.maxDrawdownUsd).toBe(0)
    expect(mdd.peakEquity).toBe(50000)
    expect(mdd.troughEquity).toBe(50000)
  })

  it('caps Profit Factor to finite value (99.99) when win rate is 100% (zero losses)', () => {
    const allWinTrades = [
      { pnl: 250, rMultiple: 1.5 },
      { pnl: 400, rMultiple: 2.0 },
      { pnl: 180, rMultiple: 1.2 },
      { pnl: 600, rMultiple: 3.0 },
    ]

    const stats = calculateExpectancy(allWinTrades)
    expect(stats.winRate).toBe(100.0)
    expect(Number.isFinite(stats.profitFactor)).toBe(true)
    expect(stats.profitFactor).toBe(99.99)
    expect(stats.profitFactor).not.toBe(Infinity)
  })

  it('handles 100% loss rate (zero wins) with 0 profit factor and safe finite metrics', () => {
    const allLossTrades = [
      { pnl: -150, rMultiple: -1.0 },
      { pnl: -200, rMultiple: -1.0 },
      { pnl: -350, rMultiple: -1.5 },
    ]

    const stats = calculateExpectancy(allLossTrades)
    expect(stats.winRate).toBe(0)
    expect(stats.profitFactor).toBe(0)
    expect(stats.expectancyUsd).toBe(-233.33)
  })

  it('caps Sortino Ratio to finite value when strategy has strictly positive returns (zero downside deviation)', () => {
    const allPositiveReturns = [0.02, 0.03, 0.015, 0.04, 0.025, 0.035, 0.02, 0.03]
    const sortino = calculateSortinoRatio(allPositiveReturns, 0, 252)

    expect(Number.isFinite(sortino)).toBe(true)
    expect(sortino).toBe(99.99)
    expect(sortino).not.toBe(Infinity)
  })

  it('handles Calmar Ratio when Max Drawdown is 0 without division by zero', () => {
    const calmar = calculateCalmarRatio(15.0, 0.0)
    expect(Number.isFinite(calmar)).toBe(true)
    expect(calmar).toBe(99.99)
  })
})
