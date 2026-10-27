import { describe, it, expect } from 'vitest'
import {
  getICTKillzone,
  detectPriceActionPattern,
  detectRSIDivergence,
  evaluateTechnicalConfluence,
} from '../../quant/confluenceEngine'
import type { SMCCandle } from '../../quant/smartMoneyConcepts'

describe('Multi-Method Technical Confluence Engine', () => {
  const createMockCandles = (basePrice: number = 4150, count: number = 40): SMCCandle[] => {
    const candles: SMCCandle[] = []
    let p = basePrice
    const now = 1700000000
    for (let i = 0; i < count; i++) {
      const open = p
      const delta = Math.sin(i / 2) * 3 + (i > 25 ? 2.5 : -1.2)
      const close = open + delta
      const high = Math.max(open, close) + 1.2
      const low = Math.min(open, close) - 1.2
      p = close
      candles.push({
        time: now + i * 300,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume: 1500,
      })
    }
    return candles
  }

  describe('getICTKillzone', () => {
    it('accurately identifies New York Open Killzone (12:00 - 15:00 UTC)', () => {
      // 13:30 UTC
      const date = new Date(Date.UTC(2026, 9, 27, 13, 30, 0))
      const res = getICTKillzone(Math.floor(date.getTime() / 1000))
      expect(res.killzone).toBe('NEW_YORK_OPEN')
      expect(res.isActive).toBe(true)
    })

    it('accurately identifies London Open Killzone (07:00 - 10:00 UTC)', () => {
      // 08:15 UTC
      const date = new Date(Date.UTC(2026, 9, 27, 8, 15, 0))
      const res = getICTKillzone(Math.floor(date.getTime() / 1000))
      expect(res.killzone).toBe('LONDON_OPEN')
      expect(res.isActive).toBe(true)
    })
  })

  describe('detectPriceActionPattern', () => {
    it('detects a Bullish Pinbar rejection wick', () => {
      const candles: SMCCandle[] = [
        { time: 100, open: 4150, high: 4152, low: 4148, close: 4150 },
        // Pinbar: Low at 4130, Open 4148, Close 4149, High 4150 (Total range 20, lower wick 18 = 90%)
        { time: 200, open: 4148, high: 4150, low: 4130, close: 4149 },
      ]
      const res = detectPriceActionPattern(candles)
      expect(res.candlePattern).toBe('BULLISH_PINBAR')
      expect(res.isRejectionAtKeyLevel).toBe(true)
      expect(res.rejectionWickRatio).toBeGreaterThan(0.6)
    })

    it('detects Bullish Engulfing pattern', () => {
      const candles: SMCCandle[] = [
        { time: 100, open: 4150, high: 4151, low: 4145, close: 4146 }, // Red candle
        { time: 200, open: 4145, high: 4155, low: 4144, close: 4153 }, // Green engulfing
      ]
      const res = detectPriceActionPattern(candles)
      expect(res.candlePattern).toBe('BULLISH_ENGULFING')
    })
  })

  describe('detectRSIDivergence', () => {
    it('handles clean candle series and returns valid momentum stats', () => {
      const candles = createMockCandles(4155, 30)
      const res = detectRSIDivergence(candles, 14)
      expect(Number.isFinite(res.currentRsi)).toBe(true)
      expect(res.currentRsi).toBeGreaterThanOrEqual(0)
      expect(res.currentRsi).toBeLessThanOrEqual(100)
    })
  })

  describe('evaluateTechnicalConfluence', () => {
    it('generates a full confluence report with stateHash', () => {
      const candles = createMockCandles(4155, 50)
      const report = evaluateTechnicalConfluence(candles, 4158.50, 'XAU/USD', 'M15')

      expect(report.symbol).toBe('XAU/USD')
      expect(report.confluenceScore).toBeGreaterThanOrEqual(0)
      expect(report.confluenceScore).toBeLessThanOrEqual(100)
      expect(['BULLISH', 'BEARISH', 'NEUTRAL']).toContain(report.bias)
      expect(report.stateHash).toBeDefined()
      expect(report.stateHash.startsWith('hash_')).toBe(true)
    })

    it('safely handles empty or small data arrays without crashing', () => {
      const report = evaluateTechnicalConfluence([], 4150, 'XAU/USD', 'M15')
      expect(report.confluenceScore).toBeGreaterThanOrEqual(0)
      expect(report.stateHash).toBeDefined()
    })
  })
})
