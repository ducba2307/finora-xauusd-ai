import { describe, it, expect } from 'vitest'
import { calculateVolumeProfile } from '../../services/volumeProfileService'
import type { CandlestickPoint } from '../../types/trading'

describe('Volume Profile (VPVR) Service', () => {
  const mockCandles: CandlestickPoint[] = [
    { time: 1000, open: 180, high: 185, low: 178, close: 184, volume: 1000 },
    { time: 1060, open: 184, high: 188, low: 183, close: 187, volume: 5000 }, // High volume node
    { time: 1120, open: 187, high: 192, low: 186, close: 191, volume: 2000 },
    { time: 1180, open: 191, high: 193, low: 189, close: 190, volume: 1500 },
  ]

  it('calculates Volume Profile with POC, VAH, and VAL', () => {
    const vp = calculateVolumeProfile('NVDA', mockCandles, 16)

    expect(vp.symbol).toBe('NVDA')
    expect(vp.bins.length).toBe(16)
    expect(vp.totalVolume).toBe(9500)
    expect(vp.pocPrice).toBeGreaterThan(178)
    expect(vp.pocPrice).toBeLessThan(194)
    expect(vp.vahPrice).toBeGreaterThanOrEqual(vp.valPrice)

    const pocBin = vp.bins.find((b) => b.isPoc)
    expect(pocBin).toBeDefined()
    expect(pocBin?.isPoc).toBe(true)
  })

  it('safely handles empty candle series without NaN or crash', () => {
    const emptyVp = calculateVolumeProfile('EMPTY', [])
    expect(emptyVp.bins).toEqual([])
    expect(emptyVp.totalVolume).toBe(0)
    expect(emptyVp.pocPrice).toBe(0)
  })

  it('safely handles single candle series with flat high/low', () => {
    const singleCandle: CandlestickPoint[] = [
      { time: 1000, open: 100, high: 100, low: 100, close: 100, volume: 500 },
    ]
    const flatVp = calculateVolumeProfile('FLAT', singleCandle, 10)
    expect(flatVp.bins.length).toBe(10)
    expect(Number.isFinite(flatVp.pocPrice)).toBe(true)
  })
})
