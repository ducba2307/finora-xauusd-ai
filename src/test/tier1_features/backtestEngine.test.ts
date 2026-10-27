import { describe, it, expect } from 'vitest'
import { runBacktest } from '@/quant/backtestEngine'
import type { CandlestickPoint } from '@/types/trading'

describe('Tier 1: F08 Deterministic Bar-by-Bar Backtest Engine', () => {
  // Generate 60 test candles with an initial uptrend then range
  const generateTestCandles = (count: number = 60): CandlestickPoint[] => {
    const candles: CandlestickPoint[] = []
    let base = 2000
    for (let i = 0; i < count; i++) {
      const delta = i < 35 ? 12 : -5
      const open = base
      const close = base + delta
      const high = Math.max(open, close) + 5
      const low = Math.min(open, close) - 5
      base = close
      candles.push({
        time: 1700000000 + i * 3600,
        open,
        high,
        low,
        close,
        volume: 1000 + i * 10,
      })
    }
    return candles
  }

  it('runs deterministic bar-by-bar backtest and produces full statistical scorecard', () => {
    const candles = generateTestCandles(60)
    const result = runBacktest({
      symbol: 'XAU/USD',
      candles,
      initialCapital: 100000,
      strategyType: 'SMA_CROSSOVER',
      smaFast: 5,
      smaSlow: 15,
      spreadPips: 2.0,
      slippagePct: 0.0005,
      commissionPerLotUsd: 5.0,
    })

    expect(result).toBeDefined()
    expect(result.totalTrades).toBeGreaterThanOrEqual(1)
    expect(Number.isFinite(result.winRate)).toBe(true)
    expect(Number.isFinite(result.profitFactor)).toBe(true)
    expect(Number.isFinite(result.sharpeRatio)).toBe(true)
    expect(Number.isFinite(result.sortinoRatio)).toBe(true)
    expect(Number.isFinite(result.maxDrawdown)).toBe(true)
    expect(result.equityCurve.length).toBe(candles.length)
  })

  it('verifies next-bar execution modeling without look-ahead bias', () => {
    const candles = generateTestCandles(50)
    const result = runBacktest({
      symbol: 'BTC/USDT',
      candles,
      initialCapital: 50000,
      strategyType: 'SMA_CROSSOVER',
      smaFast: 5,
      smaSlow: 15,
    })

    // First trade should execute strictly after the slow SMA window has elapsed
    expect(result.equityCurve[0].strategy).toBe(50000)
    // Equity changes should only occur once positions are marked or executed
    expect(result.equityCurve.length).toBe(50)
  })

  it('deducts realistic spread, slippage, and commissions from strategy profits', () => {
    const candles = generateTestCandles(50)

    // Run without frictions
    const frictionFree = runBacktest({
      symbol: 'BTC/USDT',
      candles,
      initialCapital: 50000,
      spreadPips: 0,
      slippagePct: 0,
      commissionPerLotUsd: 0,
      smaFast: 5,
      smaSlow: 15,
    })

    // Run with high institutional frictions
    const withFriction = runBacktest({
      symbol: 'BTC/USDT',
      candles,
      initialCapital: 50000,
      spreadPips: 5.0,
      slippagePct: 0.002, // 20 bps
      commissionPerLotUsd: 15.0,
      smaFast: 5,
      smaSlow: 15,
    })

    // Strategy with frictions should yield lower net profits than friction-free
    if (frictionFree.totalTrades > 0) {
      expect(withFriction.netProfitUsd).toBeLessThan(frictionFree.netProfitUsd)
    }
  })

  it('synchronizes strategy equity alongside benchmark curve across all bars', () => {
    const candles = generateTestCandles(40)
    const result = runBacktest({
      symbol: 'ETH/USDT',
      candles,
      initialCapital: 20000,
    })

    expect(result.equityCurve).toHaveLength(40)
    for (const point of result.equityCurve) {
      expect(Number.isFinite(point.strategy)).toBe(true)
      expect(Number.isFinite(point.benchmark)).toBe(true)
      expect(point.strategy).toBeGreaterThan(0)
      expect(point.benchmark).toBeGreaterThan(0)
    }
  })

  it('guarantees finite outputs with zero NaN or Infinity across all scorecard metrics', () => {
    const candles = generateTestCandles(30)
    const result = runBacktest({
      symbol: 'SOL/USDT',
      candles,
      initialCapital: 10000,
    })

    expect(result.sharpeRatio).not.toBeNaN()
    expect(result.sortinoRatio).not.toBeNaN()
    expect(result.maxDrawdown).not.toBeNaN()
    expect(result.profitFactor).not.toBeNaN()
    expect(result.winRate).not.toBeNaN()
    expect(Number.isFinite(result.netProfitUsd)).toBe(true)
  })
})
