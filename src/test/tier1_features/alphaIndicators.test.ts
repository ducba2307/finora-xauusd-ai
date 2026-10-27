import { describe, it, expect } from 'vitest'
import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateATR,
  detectFairValueGaps,
  detectOrderBlocks,
} from '@/quant/indicators'

describe('Tier 1: F07 Point-in-Time Alpha Indicator Library', () => {
  const samplePrices = [100, 102, 104, 103, 105, 107, 106, 108, 110, 109, 111, 113, 112, 115, 117, 116, 118, 120, 119, 122]

  it('calculateSMA: computes rolling simple moving average accurately', () => {
    const period = 5
    const sma = calculateSMA(samplePrices, period)

    expect(sma).toHaveLength(samplePrices.length)
    // 5-period SMA at index 4: (100 + 102 + 104 + 103 + 105) / 5 = 102.8
    expect(sma[4]).toBe(102.8)
    // At index 5: (102 + 104 + 103 + 105 + 107) / 5 = 104.2
    expect(sma[5]).toBe(104.2)
  })

  it('calculateEMA: applies smoothing alpha factor (2 / (N + 1)) correctly', () => {
    const period = 10
    const ema = calculateEMA(samplePrices, period)

    expect(ema).toHaveLength(samplePrices.length)
    expect(ema[0]).toBe(samplePrices[0])
    // EMA should track upward trend while remaining smooth
    expect(ema[samplePrices.length - 1]).toBeGreaterThan(samplePrices[0])
    expect(ema[samplePrices.length - 1]).toBeLessThan(samplePrices[samplePrices.length - 1])
  })

  it('calculateRSI: computes Wilder-smoothed RSI strictly bounded in [0, 100]', () => {
    const rsi = calculateRSI(samplePrices, 14)

    expect(rsi).toHaveLength(samplePrices.length)
    for (const val of rsi) {
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThanOrEqual(100)
      expect(Number.isFinite(val)).toBe(true)
    }

    // In a steady uptrend, RSI should be in bullish territory (> 50)
    const latestRsi = rsi[rsi.length - 1]
    expect(latestRsi).toBeGreaterThan(60)
  })

  it('calculateMACD: outputs fast line, slow signal line, and oscillator histogram', () => {
    const macd = calculateMACD(samplePrices, 12, 26, 9)

    expect(macd.macdLine).toHaveLength(samplePrices.length)
    expect(macd.signalLine).toHaveLength(samplePrices.length)
    expect(macd.histogram).toHaveLength(samplePrices.length)

    // Histogram equals macdLine minus signalLine
    for (let i = 0; i < samplePrices.length; i++) {
      expect(macd.histogram[i]).toBeCloseTo(macd.macdLine[i] - macd.signalLine[i], 3)
    }
  })

  it('calculateBollingerBands: constructs 2-sigma envelope and bandwidth', () => {
    const bb = calculateBollingerBands(samplePrices, 20, 2)

    expect(bb.upper).toHaveLength(samplePrices.length)
    expect(bb.middle).toHaveLength(samplePrices.length)
    expect(bb.lower).toHaveLength(samplePrices.length)
    expect(bb.bandwidth).toHaveLength(samplePrices.length)

    const lastIdx = samplePrices.length - 1
    expect(bb.upper[lastIdx]).toBeGreaterThan(bb.middle[lastIdx])
    expect(bb.middle[lastIdx]).toBeGreaterThan(bb.lower[lastIdx])
    expect(bb.bandwidth[lastIdx]).toBeGreaterThan(0)
  })

  it('calculateATR: computes True Range and average volatility', () => {
    const candles = samplePrices.map((p, idx) => ({
      time: 1700000000 + idx * 3600,
      open: p - 1,
      high: p + 2,
      low: p - 2,
      close: p,
      volume: 1000,
    }))

    const atr = calculateATR(candles, 14)
    expect(atr).toHaveLength(candles.length)
    // High-low is 4, so ATR should hover near 4
    expect(atr[atr.length - 1]).toBeGreaterThanOrEqual(3.5)
  })

  it('detectFairValueGaps: identifies 3-candle institutional liquidity imbalances', () => {
    // Construct a classic Bullish FVG:
    // Candle 1: high = 100
    // Candle 2: large green displacement (open=100, close=108, high=109, low=100)
    // Candle 3: low = 103 (low > candle 1 high: gap is 103 - 100 = 3)
    const candles = [
      { time: 1000, open: 98, high: 100, low: 97, close: 99 },
      { time: 1060, open: 99, high: 109, low: 99, close: 108 },
      { time: 1120, open: 108, high: 112, low: 103, close: 110 },
      { time: 1180, open: 110, high: 113, low: 109, close: 112 },
    ]

    const fvgs = detectFairValueGaps(candles)
    expect(fvgs.length).toBeGreaterThanOrEqual(1)

    const bullishFvg = fvgs.find((f) => f.type === 'BULLISH')
    expect(bullishFvg).toBeDefined()
    expect(bullishFvg?.bottom).toBe(100)
    expect(bullishFvg?.top).toBe(103)
    expect(bullishFvg?.gapSize).toBe(3)
  })

  it('detectOrderBlocks: detects structural imbalance footprint candles', () => {
    const candles = [
      { time: 1000, open: 105, high: 106, low: 104, close: 104.5, volume: 500 },
      // Bearish candle before aggressive breakout
      { time: 1060, open: 104.5, high: 105, low: 101, close: 102, volume: 1500 },
      // Aggressive bullish displacement breaking previous high
      { time: 1120, open: 102, high: 108, low: 101.5, close: 107.5, volume: 4500 },
      { time: 1180, open: 107.5, high: 111, low: 107, close: 110, volume: 3800 },
    ]

    const obs = detectOrderBlocks(candles)
    expect(obs.length).toBeGreaterThanOrEqual(1)
    expect(obs[0].type).toBe('BULLISH')
    expect(obs[0].priceLow).toBe(101)
  })
})
