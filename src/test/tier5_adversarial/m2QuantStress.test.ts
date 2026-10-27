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
import {
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateATR,
  detectFairValueGaps,
  detectOrderBlocks,
  detectSMCZones,
} from '@/quant/indicators'


describe('M2 Adversarial Stress Test: Quant Math (metrics.ts)', () => {
  describe('safeDivide adversarial edge cases', () => {
    it('returns fallback for 0 / 0, 1 / 0, and non-finite inputs', () => {
      expect(safeDivide(0, 0)).toBe(0)
      expect(safeDivide(10, 0)).toBe(0)
      expect(safeDivide(0, 0, 42)).toBe(42)
      expect(safeDivide(NaN, 5, -1)).toBe(-1)
      expect(safeDivide(5, NaN, -1)).toBe(-1)
      expect(safeDivide(Infinity, 5, 0)).toBe(0)
      expect(safeDivide(5, Infinity, 0)).toBe(0)
      expect(safeDivide(-Infinity, -Infinity, 0)).toBe(0)
      expect(safeDivide(1e308, 1e-308, 0)).toBe(0) // Overflows to Infinity
    })
  })

  describe('calculateSharpeRatio adversarial edge cases', () => {
    it('handles 0, 1, and invalid return sets gracefully returning 0', () => {
      expect(calculateSharpeRatio([])).toBe(0)
      expect(calculateSharpeRatio([0.05])).toBe(0)
      expect(calculateSharpeRatio([NaN, NaN])).toBe(0)
      expect(calculateSharpeRatio([Infinity, -Infinity])).toBe(0)
    })

    it('handles 10,000 identical returns (zero variance)', () => {
      const identicalReturns = new Array(10000).fill(0.015)
      const sharpe = calculateSharpeRatio(identicalReturns)
      expect(sharpe).toBe(0)
      expect(Number.isFinite(sharpe)).toBe(true)
    })

    it('handles huge returns ($10^9$) without NaN or unhandled exception', () => {
      const hugeReturns = [1e9, -1e9, 1e9, -1e9]
      const sharpe = calculateSharpeRatio(hugeReturns)
      expect(Number.isFinite(sharpe)).toBe(true)
      expect(sharpe).toBe(0) // Mean is 0

      const hugePosReturns = [1e9, 2e9, 1.5e9]
      const posSharpe = calculateSharpeRatio(hugePosReturns)
      expect(Number.isFinite(posSharpe)).toBe(true)
      expect(posSharpe).toBeGreaterThan(0)
    })

    it('handles near-zero variance ($10^{-12}$) cleanly', () => {
      // stdDev < 1e-8 will trigger zero variance guard
      const nearZeroVariance = [1e-6, 1e-6 + 1e-12, 1e-6 - 1e-12]
      const sharpe = calculateSharpeRatio(nearZeroVariance)
      expect(Number.isFinite(sharpe)).toBe(true)
      expect(sharpe).toBe(0)
    })

    it('handles alternating +1 / -1 returns and streaks', () => {
      const alternating = [1, -1, 1, -1, 1, -1, 1, -1]
      const sharpeAlt = calculateSharpeRatio(alternating)
      expect(sharpeAlt).toBe(0)
      expect(Number.isFinite(sharpeAlt)).toBe(true)

      const allLoss = [-0.01, -0.02, -0.015, -0.03, -0.005]
      const sharpeLoss = calculateSharpeRatio(allLoss)
      expect(Number.isFinite(sharpeLoss)).toBe(true)
      expect(sharpeLoss).toBeLessThan(0)

      const allWin = [0.01, 0.02, 0.015, 0.03, 0.005]
      const sharpeWin = calculateSharpeRatio(allWin)
      expect(Number.isFinite(sharpeWin)).toBe(true)
      expect(sharpeWin).toBeGreaterThan(0)
    })
  })

  describe('calculateSortinoRatio adversarial edge cases', () => {
    it('handles 0, 1, and invalid sets returning 0', () => {
      expect(calculateSortinoRatio([])).toBe(0)
      expect(calculateSortinoRatio([0.05])).toBe(0)
      expect(calculateSortinoRatio([NaN, 0.05])).toBe(0)
    })

    it('handles 10,000 identical positive returns (all-winning streak, 0 downside)', () => {
      const allWins = new Array(10000).fill(0.02)
      const sortino = calculateSortinoRatio(allWins)
      expect(sortino).toBe(99.99)
      expect(Number.isFinite(sortino)).toBe(true)
    })

    it('handles 10,000 identical negative returns (all-losing streak, excessMean < 0)', () => {
      const allLosses = new Array(10000).fill(-0.02)
      const sortino = calculateSortinoRatio(allLosses)
      expect(Number.isFinite(sortino)).toBe(true)
      expect(sortino).toBeLessThan(0) // Negative finite Sortino (-15.8745)
    })
    it('handles huge returns ($10^9$) producing finite outputs', () => {
      const hugeReturns = [1e9, 2e9, 1.5e9]
      const sortino = calculateSortinoRatio(hugeReturns)
      expect(Number.isFinite(sortino)).toBe(true)
      expect(sortino).toBe(99.99) // No downside
    })
  })

  describe('calculateCalmarRatio adversarial edge cases', () => {
    it('handles 0 max drawdown, huge values, and negative inputs', () => {
      expect(calculateCalmarRatio(25, 0)).toBe(99.99)
      expect(calculateCalmarRatio(0, 0)).toBe(0)
      expect(calculateCalmarRatio(-15, 0)).toBe(0)
      expect(calculateCalmarRatio(25, -10)).toBe(2.5) // abs(MDD)
      expect(calculateCalmarRatio(NaN, 10)).toBe(0)
      expect(calculateCalmarRatio(10, NaN)).toBe(0)
      expect(calculateCalmarRatio(1e300, 1e-300)).toBe(0) // Overflows to Infinity safely caught
    })
  })

  describe('calculateMaxDrawdown adversarial edge cases', () => {
    it('handles empty, single, and flat equity curves', () => {
      expect(calculateMaxDrawdown([])).toEqual({
        maxDrawdownPct: 0,
        maxDrawdownUsd: 0,
        peakEquity: 0,
        troughEquity: 0,
      })
      expect(calculateMaxDrawdown([50000])).toEqual({
        maxDrawdownPct: 0,
        maxDrawdownUsd: 0,
        peakEquity: 50000,
        troughEquity: 50000,
      })

      const flat = new Array(10000).fill(100000)
      expect(calculateMaxDrawdown(flat)).toEqual({
        maxDrawdownPct: 0,
        maxDrawdownUsd: 0,
        peakEquity: 100000,
        troughEquity: 100000,
      })
    })

    it('handles strictly increasing, strictly decreasing, and catastrophic drop curves', () => {
      const increasing = [1000, 2000, 3000, 4000]
      expect(calculateMaxDrawdown(increasing).maxDrawdownPct).toBe(0)

      const decreasing = [1000, 800, 500, 200, 0]
      const mddDec = calculateMaxDrawdown(decreasing)
      expect(mddDec.maxDrawdownPct).toBe(100)
      expect(mddDec.maxDrawdownUsd).toBe(1000)
      expect(mddDec.peakEquity).toBe(1000)
      expect(mddDec.troughEquity).toBe(0)

      const hugeCurve = [1e9, 0.5e9, 0.8e9]
      const mddHuge = calculateMaxDrawdown(hugeCurve)
      expect(mddHuge.maxDrawdownPct).toBe(50)
      expect(mddHuge.maxDrawdownUsd).toBe(500000000)
    })
  })

  describe('calculateExpectancy adversarial edge cases', () => {
    it('handles 0 trades and trades with zero / missing riskUsd', () => {
      const empty = calculateExpectancy([])
      expect(empty.expectancyUsd).toBe(0)
      expect(empty.expectancyR).toBe(0)
      expect(empty.profitFactor).toBe(0)

      const zeroRiskTrades = [
        { pnl: 100, riskUsd: 0 },
        { pnl: -50, riskUsd: 0 },
      ]
      const res = calculateExpectancy(zeroRiskTrades)
      expect(Number.isFinite(res.expectancyUsd)).toBe(true)
      expect(Number.isFinite(res.expectancyR)).toBe(true)
      expect(res.expectancyR).toBe(0) // riskUsd = 0 gives R = 0
    })

    it('handles all-winning and all-losing streaks with 10,000 trades', () => {
      const allWins = new Array(10000).fill({ pnl: 50, riskUsd: 25 })
      const resWin = calculateExpectancy(allWins)
      expect(resWin.winRate).toBe(100)
      expect(resWin.profitFactor).toBe(99.99)
      expect(resWin.avgLossR).toBe(0)
      expect(resWin.expectancyR).toBe(2)

      const allLoss = new Array(10000).fill({ pnl: -25, riskUsd: 25 })
      const resLoss = calculateExpectancy(allLoss)
      expect(resLoss.winRate).toBe(0)
      expect(resLoss.profitFactor).toBe(0)
      expect(resLoss.avgWinR).toBe(0)
      expect(resLoss.expectancyR).toBe(-1)
    })
  })

  describe('calculateRDistribution adversarial edge cases', () => {
    it('handles 0, 1, 2 trades and 10,000 identical trades', () => {
      const emptyDist = calculateRDistribution([])
      expect(emptyDist.buckets.length).toBe(7)
      expect(emptyDist.skewness).toBe(0)

      const singleDist = calculateRDistribution([{ rMultiple: 1.5, pnl: 50 }])
      expect(singleDist.skewness).toBe(0)
      expect(singleDist.buckets.find((b) => b.bucket === '1R to 2R')?.count).toBe(1)

      const tenK = new Array(10000).fill({ rMultiple: 2.5, pnl: 100 })
      const tenKDist = calculateRDistribution(tenK)
      expect(tenKDist.skewness).toBe(0)
      expect(tenKDist.buckets.find((b) => b.bucket === '2R to 3R')?.count).toBe(10000)
      expect(tenKDist.buckets.find((b) => b.bucket === '2R to 3R')?.pct).toBe(100)
    })

    it('handles extreme outlier R-Multiples without NaN', () => {
      const extreme = [
        { rMultiple: -10, pnl: -1000 },
        { rMultiple: 10, pnl: 1000 },
        { rMultiple: 0.5, pnl: 50 },
      ]
      const dist = calculateRDistribution(extreme)
      expect(dist.buckets.find((b) => b.bucket === '< -2R')?.count).toBe(1)
      expect(dist.buckets.find((b) => b.bucket === '> 3R')?.count).toBe(1)
      expect(Number.isFinite(dist.skewness)).toBe(true)
    })
  })

  describe('Adversarial Vulnerability Probes: Strict Finite Immunity', () => {
    it('probe 1: calculateRDistribution skewness underflow', () => {
      const trades = [
        { rMultiple: 0, pnl: 1 },
        { rMultiple: 1e-110, pnl: 1 },
        { rMultiple: 2e-110, pnl: 1 },
      ]
      const dist = calculateRDistribution(trades)
      expect(Number.isFinite(dist.skewness)).toBe(true)
    })

    it('probe 2: calculateRDistribution with non-finite pnl in trades', () => {
      const trades = [
        { rMultiple: 1, pnl: NaN },
        { rMultiple: 1, pnl: Infinity },
      ]
      const dist = calculateRDistribution(trades)
      dist.buckets.forEach((b) => {
        expect(Number.isFinite(b.pnl)).toBe(true)
      })
    })

    it('probe 3: calculateExpectancy with subnormal tiny riskUsd', () => {
      const trades = [
        { pnl: 10, riskUsd: 1e-320 },
      ]
      const exp = calculateExpectancy(trades)
      expect(Number.isFinite(exp.expectancyR)).toBe(true)
      expect(Number.isFinite(exp.avgWinR)).toBe(true)
    })

    it('probe 4: calculateExpectancy with overflowing pnl', () => {
      const trades = [
        { pnl: 1e308, riskUsd: 1 },
        { pnl: 1e308, riskUsd: 1 },
      ]
      const exp = calculateExpectancy(trades)
      expect(Number.isFinite(exp.expectancyUsd)).toBe(true)
    })
  })
})

describe('M2 Adversarial Stress Test: Point-in-Time Indicators (indicators.ts)', () => {
  describe('calculateRSI adversarial edge cases', () => {
    it('produces strictly finite values in [0, 100] for 100 consecutive UP bars', () => {
      const upPrices = Array.from({ length: 101 }, (_, i) => 100 + i * 2)
      const rsi = calculateRSI(upPrices, 14)
      expect(rsi.length).toBe(101)
      rsi.forEach((val) => {
        expect(Number.isFinite(val)).toBe(true)
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(100)
      })
      // Terminal bars must be saturated at 100
      expect(rsi[100]).toBe(100)
    })

    it('produces strictly finite values in [0, 100] for 100 consecutive DOWN bars', () => {
      const downPrices = Array.from({ length: 101 }, (_, i) => 300 - i * 2)
      const rsi = calculateRSI(downPrices, 14)
      expect(rsi.length).toBe(101)
      rsi.forEach((val) => {
        expect(Number.isFinite(val)).toBe(true)
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(100)
      })
      // Terminal bars must be saturated at 0
      expect(rsi[100]).toBe(0)
    })

    it('produces strictly finite values in [0, 100] for 100 FLAT bars (zero movement)', () => {
      const flatPrices = Array.from({ length: 101 }, () => 150)
      const rsi = calculateRSI(flatPrices, 14)
      expect(rsi.length).toBe(101)
      rsi.forEach((val) => {
        expect(Number.isFinite(val)).toBe(true)
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(100)
      })
    })

    it('handles 0, 1, and tiny price series', () => {
      expect(calculateRSI([])).toEqual([])
      expect(calculateRSI([100])).toEqual([50])
      expect(calculateRSI([100, 102], 14)).toEqual([50, 50])
    })
  })

  describe('calculateBollingerBands adversarial edge cases', () => {
    it('handles flat prices and extreme prices cleanly', () => {
      const flat = new Array(50).fill(100)
      const bbFlat = calculateBollingerBands(flat, 20)
      expect(bbFlat.upper[40]).toBe(100)
      expect(bbFlat.middle[40]).toBe(100)
      expect(bbFlat.lower[40]).toBe(100)
      expect(bbFlat.bandwidth[40]).toBe(0)

      const huge = [1e9, 1e9, 1e9, 1e9, 1e9]
      const bbHuge = calculateBollingerBands(huge, 3)
      expect(Number.isFinite(bbHuge.upper[4])).toBe(true)
      expect(Number.isFinite(bbHuge.lower[4])).toBe(true)
    })
  })

  describe('calculateATR adversarial edge cases', () => {
    it('handles 0, 1, and flat candles', () => {
      expect(calculateATR([])).toEqual([])
      expect(calculateATR([{ high: 100, low: 90, close: 95 }])).toEqual([10])

      const flatCandles = Array.from({ length: 30 }, () => ({
        high: 100,
        low: 100,
        close: 100,
      }))
      const atr = calculateATR(flatCandles, 14)
      expect(atr.length).toBe(30)
      atr.forEach((val) => {
        expect(Number.isFinite(val)).toBe(true)
        expect(val).toBe(0)
      })
    })
  })

  describe('calculateMACD adversarial edge cases', () => {
    it('handles 10,000 identical prices and empty series', () => {
      expect(calculateMACD([])).toEqual({ macdLine: [], signalLine: [], histogram: [] })

      const tenK = new Array(1000).fill(100)
      const macd = calculateMACD(tenK)
      expect(macd.macdLine.length).toBe(1000)
      expect(macd.macdLine[500]).toBe(0)
      expect(macd.signalLine[500]).toBe(0)
      expect(macd.histogram[500]).toBe(0)
    })
  })

  describe('SMC liquidity zone detectors adversarial edge cases', () => {
    it('handles empty and flat candles without error', () => {
      expect(detectFairValueGaps([])).toEqual([])
      expect(detectOrderBlocks([])).toEqual([])
      expect(detectSMCZones([])).toEqual({ fvgZones: [], orderBlocks: [] })

      const flatCandles = Array.from({ length: 50 }, (_, i) => ({
        time: 1000 + i * 60,
        open: 100,
        high: 100,
        low: 100,
        close: 100,
      }))
      expect(detectFairValueGaps(flatCandles)).toEqual([])
      expect(detectOrderBlocks(flatCandles.map((c) => ({ ...c, volume: 1000 })))).toEqual([])
    })
  })
})
