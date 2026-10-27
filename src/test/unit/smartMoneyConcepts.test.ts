import { describe, it, expect } from 'vitest'
import {
  calculateSwingPoints,
  calculateLiquidityPools,
  calculateBOSAndCHoCH,
  calculateFairValueGaps,
  calculateOrderBlocks,
  generateSMCTradeSetup,
  analyzeSMCStructure,
  type SMCCandle,
} from '../../quant/smartMoneyConcepts'

describe('Smart Money Concepts (SMC) Quantitative Engine', () => {
  // Helper to generate a realistic sequence of candles
  const generateTestCandles = (basePrice: number = 4150, count: number = 50): SMCCandle[] => {
    const candles: SMCCandle[] = []
    let price = basePrice
    const now = 1700000000

    for (let i = 0; i < count; i++) {
      const open = price
      // Simulate wavy motion with a dip and a breakout
      const change = Math.sin(i / 3) * 4 + (i > 30 ? 2 : -0.5)
      const close = open + change
      const high = Math.max(open, close) + 1.5
      const low = Math.min(open, close) - 1.5
      price = close

      candles.push({
        time: now + i * 300,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume: 1200 + Math.abs(change) * 100,
      })
    }
    return candles
  }

  describe('calculateSwingPoints', () => {
    it('returns empty array when candle count is insufficient', () => {
      const candles = generateTestCandles(4150, 5)
      expect(calculateSwingPoints(candles, 4)).toEqual([])
      expect(calculateSwingPoints([], 4)).toEqual([])
    })

    it('identifies confirmed swing highs and swing lows', () => {
      const candles = generateTestCandles(4150, 60)
      const swings = calculateSwingPoints(candles, 3)
      expect(swings.length).toBeGreaterThan(0)
      for (const swing of swings) {
        expect(['HIGH', 'LOW']).toContain(swing.type)
        expect(Number.isFinite(swing.price)).toBe(true)
        expect(swing.confirmed).toBe(true)
      }
    })
  })

  describe('calculateLiquidityPools & Sweeps', () => {
    it('creates BSL for swing highs and SSL for swing lows', () => {
      const candles = generateTestCandles(4150, 60)
      const swings = calculateSwingPoints(candles, 3)
      const pools = calculateLiquidityPools(candles, swings)

      expect(pools.length).toBe(swings.length)
      const bsl = pools.filter((p) => p.type === 'BSL')
      const ssl = pools.filter((p) => p.type === 'SSL')
      expect(bsl.length).toBeGreaterThan(0)
      expect(ssl.length).toBeGreaterThan(0)
    })

    it('detects when liquidity has been swept by future wicks', () => {
      // Craft candles where a low is explicitly swept by a lower wick that closes back up
      const testCandles: SMCCandle[] = [
        { time: 100, open: 100, high: 102, low: 98, close: 100 },
        { time: 200, open: 100, high: 101, low: 95, close: 96 }, // Swing low at 95
        { time: 300, open: 96, high: 103, low: 96, close: 102 },
        { time: 400, open: 102, high: 104, low: 100, close: 103 },
        { time: 500, open: 103, high: 105, low: 101, close: 104 },
        { time: 600, open: 104, high: 104, low: 94, close: 98 }, // Wick sweeps 95 down to 94, closes at 98
        { time: 700, open: 98, high: 106, low: 98, close: 105 },
      ]

      const swings = [{ index: 1, time: 200, price: 95, type: 'LOW' as const, confirmed: true }]
      const pools = calculateLiquidityPools(testCandles, swings)

      expect(pools[0].isSwept).toBe(true)
      expect(pools[0].sweptAtTime).toBe(600)
      expect(pools[0].sweepWickPrice).toBe(94)
    })
  })

  describe('calculateFairValueGaps', () => {
    it('identifies bullish FVG when candle 1 high < candle 3 low', () => {
      const fvgCandles: SMCCandle[] = [
        { time: 100, open: 100, high: 102, low: 99, close: 101 }, // C1 high = 102
        { time: 200, open: 101, high: 110, low: 101, close: 109 }, // C2 explosive displacement
        { time: 300, open: 109, high: 112, low: 105, close: 111 }, // C3 low = 105 (> C1 high 102)
      ]

      const fvgs = calculateFairValueGaps(fvgCandles)
      expect(fvgs.length).toBe(1)
      expect(fvgs[0].type).toBe('BULLISH')
      expect(fvgs[0].bottom).toBe(102)
      expect(fvgs[0].top).toBe(105)
      expect(fvgs[0].gapSize).toBe(3)
      expect(fvgs[0].isMitigated).toBe(false)
    })

    it('identifies bearish FVG when candle 1 low > candle 3 high', () => {
      const fvgCandles: SMCCandle[] = [
        { time: 100, open: 110, high: 112, low: 108, close: 109 }, // C1 low = 108
        { time: 200, open: 109, high: 109, low: 100, close: 101 }, // C2 explosive dump
        { time: 300, open: 101, high: 105, low: 98, close: 99 },   // C3 high = 105 (< C1 low 108)
      ]

      const fvgs = calculateFairValueGaps(fvgCandles)
      expect(fvgs.length).toBe(1)
      expect(fvgs[0].type).toBe('BEARISH')
      expect(fvgs[0].top).toBe(108)
      expect(fvgs[0].bottom).toBe(105)
      expect(fvgs[0].gapSize).toBe(3)
    })
  })

  describe('calculateOrderBlocks and BOS/CHoCH', () => {
    it('detects BOS and origin Order Blocks', () => {
      const candles: SMCCandle[] = [
        { time: 100, open: 100, high: 105, low: 99, close: 104 },
        { time: 200, open: 104, high: 106, low: 103, close: 105 }, // High at 106
        { time: 300, open: 105, high: 105, low: 98, close: 99 },   // Low at 98
        { time: 400, open: 99, high: 101, low: 97, close: 98 },    // Bearish OB candle
        { time: 500, open: 98, high: 112, low: 98, close: 110 },   // Bullish displacement breaking 106
      ]

      const swings = [
        { index: 1, time: 200, price: 106, type: 'HIGH' as const, confirmed: true },
        { index: 2, time: 300, price: 98, type: 'LOW' as const, confirmed: true },
      ]

      const breaks = calculateBOSAndCHoCH(candles, swings)
      expect(breaks.length).toBeGreaterThan(0)
      expect(breaks[0].direction).toBe('BULLISH')

      const obs = calculateOrderBlocks(candles, breaks)
      expect(obs.length).toBeGreaterThan(0)
      expect(obs[0].type).toBe('BULLISH')
    })
  })

  describe('generateSMCTradeSetup & analyzeSMCStructure', () => {
    it('evaluates complete SMC structure and produces institutional setup', () => {
      const candles = generateTestCandles(4155, 70)
      const result = analyzeSMCStructure(candles, 4160, 'XAU/USD')

      expect(result.symbol).toBe('XAU/USD')
      expect(result.currentPrice).toBe(4160)
      expect(result.swings.length).toBeGreaterThan(0)
      expect(result.liquidityPools.length).toBeGreaterThan(0)
      expect(result.summary).toBeDefined()
      expect(Number.isFinite(result.activeSetup.riskRewardRatio)).toBe(true)
    })

    it('safely handles empty or corrupt candle feeds without crashing', () => {
      const emptyResult = generateSMCTradeSetup([], 0, 'XAU/USD')
      expect(emptyResult.gateStatus).toBe('NO_SETUP')
      expect(emptyResult.riskRewardRatio).toBe(0)

      const singleResult = generateSMCTradeSetup(
        [{ time: 100, open: NaN, high: NaN, low: NaN, close: NaN }],
        NaN,
        'XAU/USD'
      )
      expect(singleResult.gateStatus).toBe('NO_SETUP')
    })
  })
})
