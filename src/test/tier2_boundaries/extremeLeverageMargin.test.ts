import { describe, it, expect } from 'vitest'
import {
  evaluateOrderRisk,
  recalculateBalanceSheet,
  type AccountBalanceSheet,
} from '@/engine/riskEngine'
import { validateOrderSignal, type OrderSignal } from '@/engine/orderLifecycle'

describe('Tier 2: Boundary & Corner Cases — Extreme Leverage & Margin Limits', () => {
  const sampleSheet: AccountBalanceSheet = recalculateBalanceSheet([], 10000, 10000, 10000)

  it('permits maximum institutional leverage of exactly 100x', () => {
    const riskCheck = evaluateOrderRisk(
      {
        symbol: 'BTC/USDT',
        side: 'BUY',
        size: 0.1,
        price: 114000,
        leverage: 100, // Exactly 100x
        marginRequired: 114,
      },
      sampleSheet
    )
    expect(riskCheck.allowed).toBe(true)
  })

  it('rejects leverage exceeding the 100x ceiling (e.g. 101x or 500x)', () => {
    const riskCheck101 = evaluateOrderRisk(
      {
        symbol: 'BTC/USDT',
        side: 'BUY',
        size: 0.1,
        price: 114000,
        leverage: 101, // 101x > 100x
        marginRequired: 112.8,
      },
      sampleSheet
    )
    expect(riskCheck101.allowed).toBe(false)
    expect(riskCheck101.reason).toContain('LEVERAGE_EXCEEDED')

    const riskCheck500 = evaluateOrderRisk(
      {
        symbol: 'EUR/USD',
        side: 'BUY',
        size: 1.0,
        price: 1.0825,
        leverage: 500, // 500x > 100x
        marginRequired: 200,
      },
      sampleSheet
    )
    expect(riskCheck500.allowed).toBe(false)
  })

  it('rejects non-positive leverage (0 or negative) in order validation', () => {
    const zeroLevSignal: OrderSignal = {
      id: 'sig_zero_lev',
      symbol: 'BTC/USDT',
      side: 'BUY',
      size: 0.1,
      price: 114000,
      leverage: 0,
    }
    expect(validateOrderSignal(zeroLevSignal).valid).toBe(false)

    const negLevSignal: OrderSignal = {
      ...zeroLevSignal,
      leverage: -10,
    }
    expect(validateOrderSignal(negLevSignal).valid).toBe(false)
  })

  it('tests exact free margin threshold boundary: allows at exact equality, rejects at equality + $0.01', () => {
    const balanceSheet: AccountBalanceSheet = {
      cashBalance: 1000,
      equity: 1000,
      marginUsed: 500,
      freeMargin: 500.0, // Exactly $500 free margin
      marginLevelPct: 200.0,
      peakDailyEquity: 1000,
      dailyStartEquity: 1000,
      dailyDrawdownPct: 0,
      dailyDrawdownUsd: 0,
      isCircuitBreakerTripped: false,
    }

    // Exact match: required = 500.00 -> allowed
    const exactAllowed = evaluateOrderRisk(
      {
        symbol: 'ETH/USDT',
        side: 'BUY',
        size: 1.0,
        price: 3000,
        leverage: 6,
        marginRequired: 500.0,
      },
      balanceSheet
    )
    expect(exactAllowed.allowed).toBe(true)

    // Exceeds by 1 cent: required = 500.01 -> rejected
    const overOneCent = evaluateOrderRisk(
      {
        symbol: 'ETH/USDT',
        side: 'BUY',
        size: 1.0,
        price: 3000,
        leverage: 6,
        marginRequired: 500.01,
      },
      balanceSheet
    )
    expect(overOneCent.allowed).toBe(false)
    expect(overOneCent.reason).toContain('INSUFFICIENT_MARGIN')
  })

  it('handles negative cash balance safely by clamping to zero in balance sheet', () => {
    const sheetNegative = recalculateBalanceSheet([], -5000, 10000, 10000)
    expect(sheetNegative.cashBalance).toBe(0)
    expect(sheetNegative.equity).toBe(0)
    expect(sheetNegative.freeMargin).toBe(0)
  })
})
