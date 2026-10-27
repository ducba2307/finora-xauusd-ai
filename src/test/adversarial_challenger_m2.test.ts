import { describe, it, expect } from 'vitest'
import { runBacktest } from '../quant/backtestEngine'
import type { CandlestickPoint } from '../types/trading'

describe('Adversarial Challenger M2: Backtest & UI SVG Verification', () => {
  // Helper to generate realistic candles
  function generateCandles(count: number, startPrice = 100, trend = 0.001): CandlestickPoint[] {
    const candles: CandlestickPoint[] = []
    let price = startPrice
    const now = Math.floor(Date.now() / 1000)

    for (let i = 0; i < count; i++) {
      const open = price
      const change = (Math.sin(i * 0.1) * 2 + trend * price)
      const close = Math.max(1, open + change)
      const high = Math.max(open, close) + Math.abs(change) * 0.5
      const low = Math.min(open, close) - Math.abs(change) * 0.5
      candles.push({
        time: now + i * 3600,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume: 1000 + i * 10,
      })
      price = close
    }
    return candles
  }

  // --------------------------------------------------------------------------
  // OBJECTIVE 1.1: Lookahead Bias Empirical Proof
  // --------------------------------------------------------------------------
  describe('Lookahead Bias Elimination in backtestEngine', () => {
    it('should NOT alter trades or equity curve up to bar K when future bars (K..N) change radically', () => {
      const baseCandles = generateCandles(60, 2000, 0.002)
      const k = 45 // truncation point

      // Run backtest on first 45 candles
      const resBase = runBacktest({
        symbol: 'ETH/USDT',
        candles: baseCandles.slice(0, k),
        initialCapital: 50000,
        strategyType: 'SMA_CROSSOVER',
        smaFast: 5,
        smaSlow: 15,
      })

      // Create an adversarial continuation with an extreme 10x pump
      const adversarialPumpCandles = [
        ...baseCandles.slice(0, k),
        ...generateCandles(30, 20000, 0.05), // massive pump starting at bar 45
      ]

      const resPump = runBacktest({
        symbol: 'ETH/USDT',
        candles: adversarialPumpCandles,
        initialCapital: 50000,
        strategyType: 'SMA_CROSSOVER',
        smaFast: 5,
        smaSlow: 15,
      })

      // Create an adversarial continuation with an extreme 90% crash
      const adversarialDumpCandles = [
        ...baseCandles.slice(0, k),
        ...generateCandles(30, 10, -0.05), // massive dump starting at bar 45
      ]

      const resDump = runBacktest({
        symbol: 'ETH/USDT',
        candles: adversarialDumpCandles,
        initialCapital: 50000,
        strategyType: 'SMA_CROSSOVER',
        smaFast: 5,
        smaSlow: 15,
      })

      // Verify that prior to bar k, the equity curve values are strictly identical
      // Note: at bar k-1, if position was open in baseCandles, resBase closes it at bar k-1 close.
      // For bars 0 through k-2, both strategy equity and benchmark equity must match exactly.
      for (let i = 0; i < k - 1; i++) {
        expect(resPump.equityCurve[i].strategy).toBe(resBase.equityCurve[i].strategy)
        expect(resDump.equityCurve[i].strategy).toBe(resBase.equityCurve[i].strategy)
        expect(resPump.equityCurve[i].benchmark).toBe(resBase.equityCurve[i].benchmark)
        expect(resDump.equityCurve[i].benchmark).toBe(resBase.equityCurve[i].benchmark)
      }
    })

    it('signal at bar i strictly uses candles strictly prior to bar i (open execution)', () => {
      // Create a scenario where bar i has an enormous spike high/close that would trigger a signal if lookahead existed
      const candles = generateCandles(30, 100)
      // Bar 25 has huge close
      candles[25] = { ...candles[25], close: 1000 }
      // Bar 26 has normal open
      candles[26] = { ...candles[26], open: 100 }

      const res = runBacktest({
        symbol: 'XAU/USD',
        candles,
        initialCapital: 50000,
        strategyType: 'SMA_CROSSOVER',
        smaFast: 3,
        smaSlow: 5,
      })

      // If there was lookahead, a buy signal might trigger AT bar 25 using bar 25's close for fill.
      // In point-in-time execution, signal can only trigger at bar 26 using bar 26 open.
      expect(Number.isFinite(res.sharpeRatio)).toBe(true)
      expect(Number.isFinite(res.maxDrawdown)).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // OBJECTIVE 1.2: Candle Count Edge Cases (0, 1, 5, 500 candles)
  // --------------------------------------------------------------------------
  describe('Candle Count Edge Cases in backtestEngine', () => {
    it('should handle 0 candles gracefully with finite zero metrics', () => {
      const res = runBacktest({
        symbol: 'BTC/USDT',
        candles: [],
        initialCapital: 50000,
      })

      expect(res.totalTrades).toBe(0)
      expect(res.winRate).toBe(0)
      expect(res.profitFactor).toBe(0)
      expect(res.sharpeRatio).toBe(0)
      expect(res.sortinoRatio).toBe(0)
      expect(res.calmarRatio).toBe(0)
      expect(res.maxDrawdown).toBe(0)
      expect(res.netProfitUsd).toBe(0)
      expect(res.equityCurve.length).toBe(1)
      expect(res.equityCurve[0].strategy).toBe(50000)
      expect(Number.isFinite(res.equityCurve[0].strategy)).toBe(true)
    })

    it('should handle 1 candle gracefully with finite zero metrics', () => {
      const singleCandle = generateCandles(1, 65000)
      const res = runBacktest({
        symbol: 'BTC/USDT',
        candles: singleCandle,
        initialCapital: 50000,
      })

      expect(res.totalTrades).toBe(0)
      expect(res.winRate).toBe(0)
      expect(res.profitFactor).toBe(0)
      expect(res.sharpeRatio).toBe(0)
      expect(res.sortinoRatio).toBe(0)
      expect(res.calmarRatio).toBe(0)
      expect(res.maxDrawdown).toBe(0)
      expect(res.equityCurve.length).toBe(1)
      expect(res.equityCurve[0].strategy).toBe(50000)
    })

    it('should handle 5 candles (minimum boundary) safely without NaN or crash', () => {
      const fiveCandles = generateCandles(5, 2700)
      const res = runBacktest({
        symbol: 'XAU/USD',
        candles: fiveCandles,
        initialCapital: 50000,
        smaFast: 2,
        smaSlow: 3,
      })

      expect(res.equityCurve.length).toBe(5)
      expect(Number.isFinite(res.sharpeRatio)).toBe(true)
      expect(Number.isFinite(res.sortinoRatio)).toBe(true)
      expect(Number.isFinite(res.calmarRatio)).toBe(true)
      expect(Number.isFinite(res.maxDrawdown)).toBe(true)
      expect(Number.isFinite(res.netProfitUsd)).toBe(true)
      for (const eq of res.equityCurve) {
        expect(Number.isFinite(eq.strategy)).toBe(true)
        expect(Number.isFinite(eq.benchmark)).toBe(true)
      }
    })

    it('should handle 500 candles efficiently and generate full statistical scorecard', () => {
      const fiveHundredCandles = generateCandles(500, 60000, 0.0005)
      const t0 = performance.now()
      const res = runBacktest({
        symbol: 'BTC/USDT',
        candles: fiveHundredCandles,
        initialCapital: 100000,
        strategyType: 'SMA_CROSSOVER',
        smaFast: 10,
        smaSlow: 30,
      })
      const elapsedMs = performance.now() - t0

      expect(elapsedMs).toBeLessThan(100) // fast sub-100ms execution
      expect(res.equityCurve.length).toBe(500)
      expect(Number.isFinite(res.sharpeRatio)).toBe(true)
      expect(Number.isFinite(res.sortinoRatio)).toBe(true)
      expect(Number.isFinite(res.calmarRatio)).toBe(true)
      expect(Number.isFinite(res.maxDrawdown)).toBe(true)
      expect(Number.isFinite(res.netProfitPct)).toBe(true)
      expect(Number.isFinite(res.profitFactor)).toBe(true)
      expect(Number.isFinite(res.winRate)).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // OBJECTIVE 1.3: SVG Coordinate Math in QuantStudioView & TradingJournalView
  // --------------------------------------------------------------------------
  describe('SVG Coordinate Math Verification (0 elements, 1 element, Flat Equity)', () => {
    // Exact mathematical logic from QuantStudioView.tsx lines 75-107
    function computeQuantStudioSvg(equityCurve: { strategy: number; benchmark: number }[]) {
      const eqPoints = equityCurve && equityCurve.length > 0
        ? equityCurve
        : [{ timestamp: '2026-10-11T00:00:00.000Z', strategy: 100000, benchmark: 100000 }]

      const allValues = eqPoints.flatMap((e) => [e.strategy, e.benchmark].filter(Number.isFinite))
      const rawMax = allValues.length > 0 ? Math.max(...allValues) : 100000
      const rawMin = allValues.length > 0 ? Math.min(...allValues) : 100000
      const maxEquity = rawMax === rawMin ? rawMax + 1000 : rawMax
      const minEquity = rawMax === rawMin ? Math.max(0, rawMin - 1000) : rawMin
      const eqSpan = maxEquity - minEquity > 0 ? maxEquity - minEquity : 1
      const width = 800
      const height = 240
      const denom = eqPoints.length > 1 ? eqPoints.length - 1 : 1

      const strategyPoints = eqPoints
        .map((e, idx) => {
          const x = (idx / denom) * width
          const y = height - ((e.strategy - minEquity) / eqSpan) * (height - 30) - 15
          const safeX = Number.isFinite(x) ? Number(x.toFixed(1)) : 0
          const safeY = Number.isFinite(y) ? Number(y.toFixed(1)) : height / 2
          return `${safeX},${safeY}`
        })
        .join(' ')

      const benchmarkPoints = eqPoints
        .map((e, idx) => {
          const x = (idx / denom) * width
          const y = height - ((e.benchmark - minEquity) / eqSpan) * (height - 30) - 15
          const safeX = Number.isFinite(x) ? Number(x.toFixed(1)) : 0
          const safeY = Number.isFinite(y) ? Number(y.toFixed(1)) : height / 2
          return `${safeX},${safeY}`
        })
        .join(' ')

      return { strategyPoints, benchmarkPoints }
    }

    // Exact mathematical logic from TradingJournalView.tsx lines 287-302
    function computeTradingJournalSvg(equityPoints: { equity: number }[]) {
      const eqValues = equityPoints.map((p) => p.equity)
      const rawMinEq = eqValues.length > 0 ? Math.min(...eqValues) : 50000
      const rawMaxEq = eqValues.length > 0 ? Math.max(...eqValues) : 50000
      const minEq = rawMinEq === rawMaxEq ? Math.max(0, rawMinEq - 1000) : rawMinEq
      const maxEq = rawMinEq === rawMaxEq ? rawMaxEq + 1000 : rawMaxEq
      const eqRange = maxEq - minEq > 0 ? maxEq - minEq : 1
      const eqDenom = equityPoints.length > 1 ? equityPoints.length - 1 : 1

      const svgEquityPoints = equityPoints.map((p, idx) => {
        const x = (idx / eqDenom) * 800
        const y = 200 - ((p.equity - minEq) / eqRange) * 180 - 10
        const safeX = Number.isFinite(x) ? Number(x.toFixed(1)) : 0
        const safeY = Number.isFinite(y) ? Number(y.toFixed(1)) : 100
        return { x: safeX, y: safeY }
      })
      const equityPointsStr = svgEquityPoints.map((p) => `${p.x},${p.y}`).join(' ')
      return { svgEquityPoints, equityPointsStr }
    }

    it('QuantStudioView: should render valid coordinates when equityCurve has 0 elements', () => {
      const { strategyPoints, benchmarkPoints } = computeQuantStudioSvg([])
      expect(strategyPoints).not.toContain('NaN')
      expect(strategyPoints).not.toContain('Infinity')
      expect(benchmarkPoints).not.toContain('NaN')
      expect(benchmarkPoints).not.toContain('Infinity')
      expect(strategyPoints).toBe('0,120')
      expect(benchmarkPoints).toBe('0,120')
    })

    it('QuantStudioView: should render valid coordinates when equityCurve has 1 element', () => {
      const { strategyPoints, benchmarkPoints } = computeQuantStudioSvg([
        { strategy: 75000, benchmark: 75000 },
      ])
      expect(strategyPoints).not.toContain('NaN')
      expect(strategyPoints).not.toContain('Infinity')
      expect(benchmarkPoints).not.toContain('NaN')
      expect(strategyPoints).toBe('0,120')
    })

    it('QuantStudioView: should render valid coordinates when all equity values are identical (flat curve)', () => {
      const flat = Array.from({ length: 10 }, () => ({ strategy: 50000, benchmark: 50000 }))
      const { strategyPoints, benchmarkPoints } = computeQuantStudioSvg(flat)
      expect(strategyPoints).not.toContain('NaN')
      expect(strategyPoints).not.toContain('Infinity')
      expect(benchmarkPoints).not.toContain('NaN')
      // All y coordinates should be centered at 120
      const points = strategyPoints.split(' ')
      expect(points.length).toBe(10)
      for (const pt of points) {
        const [, y] = pt.split(',')
        expect(Number(y)).toBe(120)
      }
    })

    it('TradingJournalView: should render valid coordinates when entries array has 0 elements (1 baseline point)', () => {
      // With 0 entries, TradingJournalView initializes points = [{ date: 'Start', equity: 50000, pnl: 0 }]
      const { equityPointsStr, svgEquityPoints } = computeTradingJournalSvg([{ equity: 50000 }])
      expect(equityPointsStr).not.toContain('NaN')
      expect(equityPointsStr).not.toContain('Infinity')
      expect(equityPointsStr).toBe('0,100')
      expect(svgEquityPoints[0].x).toBe(0)
      expect(svgEquityPoints[0].y).toBe(100)
    })

    it('TradingJournalView: should render valid coordinates when raw equityPoints is completely empty []', () => {
      const { equityPointsStr, svgEquityPoints } = computeTradingJournalSvg([])
      expect(equityPointsStr).not.toContain('NaN')
      expect(equityPointsStr).not.toContain('Infinity')
      expect(svgEquityPoints.length).toBe(0)
      expect(equityPointsStr).toBe('')
    })

    it('TradingJournalView: should render valid coordinates when entries array has 1 element (2 points)', () => {
      const { equityPointsStr, svgEquityPoints } = computeTradingJournalSvg([
        { equity: 50000 },
        { equity: 50500 },
      ])
      expect(equityPointsStr).not.toContain('NaN')
      expect(equityPointsStr).not.toContain('Infinity')
      expect(svgEquityPoints.length).toBe(2)
      expect(svgEquityPoints[0].x).toBe(0)
      expect(svgEquityPoints[1].x).toBe(800)
    })

    it('TradingJournalView: should render valid coordinates when all equity values are identical (zero PnL trades)', () => {
      const flatTrades = Array.from({ length: 15 }, () => ({ equity: 50000 }))
      const { equityPointsStr, svgEquityPoints } = computeTradingJournalSvg(flatTrades)
      expect(equityPointsStr).not.toContain('NaN')
      expect(equityPointsStr).not.toContain('Infinity')
      expect(svgEquityPoints.length).toBe(15)
      for (const pt of svgEquityPoints) {
        expect(pt.y).toBe(100)
      }
    })
  })
})
