import { describe, it, expect } from 'vitest'
import { safeDivide, calculateExpectancy } from '@/quant/metrics'

describe('Tier 2: Boundary & Corner Cases — Division by Zero & NaN/Infinity Guards', () => {
  it('safeDivide: rejects zero denominators and returns prescribed fallback value', () => {
    expect(safeDivide(50, 0)).toBe(0)
    expect(safeDivide(50, 0, 99)).toBe(99)
    expect(safeDivide(0, 0)).toBe(0)
  })

  it('safeDivide: filters out NaN inputs and prevents NaN propagation', () => {
    expect(safeDivide(NaN, 10)).toBe(0)
    expect(safeDivide(10, NaN)).toBe(0)
    expect(safeDivide(NaN, NaN, 42)).toBe(42)
  })

  it('safeDivide: filters out positive and negative Infinity', () => {
    expect(safeDivide(Infinity, 10)).toBe(0)
    expect(safeDivide(-Infinity, 10)).toBe(0)
    expect(safeDivide(10, Infinity)).toBe(0)
    expect(safeDivide(10, -Infinity)).toBe(0)
    expect(safeDivide(Infinity, Infinity)).toBe(0)
  })

  it('guards against division by zero in R-Multiple calculations when riskUsd is 0 or SL = Entry', () => {
    // If a trader enters a trade with SL = Entry price (risk = $0), rMultiple = pnl / risk would be Infinity!
    const zeroRiskTrades = [
      { pnl: 200, riskUsd: 0 }, // riskUsd = 0 -> must safely default to 0R, not Infinity
      { pnl: 400, riskUsd: 200 }, // 2R
    ]

    const stats = calculateExpectancy(zeroRiskTrades)
    expect(Number.isFinite(stats.expectancyR)).toBe(true)
    expect(stats.expectancyR).not.toBe(Infinity)
    expect(stats.expectancyR).not.toBeNaN()
  })

  it('verifies safe calculation for SVG chart coordinates when series length <= 1', () => {
    // Simulating the bug found in QuantStudioView line 49 / TradingJournalView line 344:
    // const x = (idx / (equityPoints.length - 1)) * 800
    // When length <= 1, (length - 1) is <= 0
    const computeSvgX = (idx: number, length: number, width: number = 800): number => {
      const denominator = length - 1
      if (denominator <= 0) return 0 // Guard
      return safeDivide(idx * width, denominator, 0)
    }

    // Length 1: idx = 0 -> should return 0, never NaN or Infinity
    expect(computeSvgX(0, 1)).toBe(0)
    expect(computeSvgX(0, 0)).toBe(0)
    expect(Number.isFinite(computeSvgX(0, 1))).toBe(true)

    // Length 5: idx = 2 -> (2 / 4) * 800 = 400
    expect(computeSvgX(2, 5)).toBe(400)
  })
})
