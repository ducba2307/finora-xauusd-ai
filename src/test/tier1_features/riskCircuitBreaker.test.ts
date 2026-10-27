import { describe, it, expect } from 'vitest'
import {
  checkCircuitBreaker,
  recalculateBalanceSheet,
  evaluateOrderRisk,
  DEFAULT_RISK_CONFIG,
  type AccountBalanceSheet,
} from '@/engine/riskEngine'
import type { Position } from '@/types/trading'

describe('Tier 1: F12-F13 Account Risk Engine & Daily Circuit Breaker', () => {
  it('F12: trips Circuit Breaker when daily drawdown meets or exceeds 4.5%', () => {
    // 4.4% drawdown: not tripped
    const safeCheck = checkCircuitBreaker(4.4, 4.5)
    expect(safeCheck.isTripped).toBe(false)

    // Exactly 4.5% drawdown: tripped!
    const tripCheckExact = checkCircuitBreaker(4.5, 4.5)
    expect(tripCheckExact.isTripped).toBe(true)
    expect(tripCheckExact.reason).toContain('Daily Max Drawdown Circuit Breaker Tripped')

    // 5.2% drawdown: tripped!
    const tripCheckHigh = checkCircuitBreaker(5.2, 4.5)
    expect(tripCheckHigh.isTripped).toBe(true)
  })

  it('F13: recalculates dynamic balance sheet and tracks peak daily equity', () => {
    const cash = 100000
    const startEquity = 100000
    const positions: Position[] = [
      {
        id: 'p1',
        symbol: 'BTC/USDT',
        side: 'LONG',
        size: 0.5,
        entryPrice: 114000,
        markPrice: 116000,
        liquidationPrice: 100000,
        leverage: 10,
        margin: 5700,
        unrealizedPnl: 1000, // +$1000
        unrealizedPnlPct: 17.5,
      },
    ]

    const sheet1 = recalculateBalanceSheet(positions, cash, startEquity, startEquity)
    expect(sheet1.equity).toBe(101000)
    expect(sheet1.peakDailyEquity).toBe(101000)
    expect(sheet1.marginUsed).toBe(5700)
    expect(sheet1.freeMargin).toBe(101000 - 5700)
    expect(sheet1.dailyDrawdownPct).toBe(0)
    expect(sheet1.isCircuitBreakerTripped).toBe(false)

    // Now price drops, causing unrealized PnL to drop to -$5000 from peak 101000
    const positionsLoss: Position[] = [
      {
        ...positions[0],
        markPrice: 104000,
        unrealizedPnl: -5000,
      },
    ]

    const sheet2 = recalculateBalanceSheet(positionsLoss, cash, sheet1.peakDailyEquity, startEquity)
    expect(sheet2.equity).toBe(95000)
    expect(sheet2.peakDailyEquity).toBe(101000)
    // Drawdown = 101000 - 95000 = 6000 USD
    // Drawdown % = 6000 / 101000 * 100 = 5.94%
    expect(sheet2.dailyDrawdownPct).toBeCloseTo(5.94, 1)
    expect(sheet2.isCircuitBreakerTripped).toBe(true)
  })

  it('F12: rejects new orders immediately when Circuit Breaker is active', () => {
    const trippedSheet: AccountBalanceSheet = {
      cashBalance: 95000,
      equity: 95000,
      marginUsed: 0,
      freeMargin: 95000,
      marginLevelPct: 999.99,
      peakDailyEquity: 100000,
      dailyStartEquity: 100000,
      dailyDrawdownPct: 5.0, // > 4.5%
      dailyDrawdownUsd: 5000,
      isCircuitBreakerTripped: true,
    }

    const orderRisk = evaluateOrderRisk(
      {
        symbol: 'BTC/USDT',
        side: 'BUY',
        size: 0.1,
        price: 114000,
        leverage: 10,
        marginRequired: 1140,
      },
      trippedSheet
    )

    expect(orderRisk.allowed).toBe(false)
    expect(orderRisk.reason).toContain('CIRCUIT_BREAKER_ACTIVE')
  })

  it('F12: validates margin sufficiency and rejects orders exceeding free margin', () => {
    const tightSheet: AccountBalanceSheet = {
      cashBalance: 1000,
      equity: 1000,
      marginUsed: 800,
      freeMargin: 200, // Only $200 free margin
      marginLevelPct: 125.0,
      peakDailyEquity: 1000,
      dailyStartEquity: 1000,
      dailyDrawdownPct: 0,
      dailyDrawdownUsd: 0,
      isCircuitBreakerTripped: false,
    }

    const orderRisk = evaluateOrderRisk(
      {
        symbol: 'ETH/USDT',
        side: 'BUY',
        size: 1.0,
        price: 3200,
        leverage: 10,
        marginRequired: 320, // $320 needed > $200 free
      },
      tightSheet
    )

    expect(orderRisk.allowed).toBe(false)
    expect(orderRisk.reason).toContain('INSUFFICIENT_MARGIN')
  })

  it('F12: enforces maximum open position count limit (default 10)', () => {
    const normalSheet: AccountBalanceSheet = recalculateBalanceSheet([], 50000, 50000, 50000)

    const orderRisk = evaluateOrderRisk(
      {
        symbol: 'SOL/USDT',
        side: 'BUY',
        size: 10,
        price: 190,
        leverage: 10,
        marginRequired: 190,
        currentOpenPositionsCount: DEFAULT_RISK_CONFIG.maxOpenPositions, // Already at max (10)
      },
      normalSheet
    )

    expect(orderRisk.allowed).toBe(false)
    expect(orderRisk.reason).toContain('MAX_POSITIONS_REACHED')
  })

  it('F12: rejects orders exceeding maximum permissible leverage (100x)', () => {
    const normalSheet: AccountBalanceSheet = recalculateBalanceSheet([], 50000, 50000, 50000)

    const orderRisk = evaluateOrderRisk(
      {
        symbol: 'BTC/USDT',
        side: 'BUY',
        size: 0.1,
        price: 114000,
        leverage: 150, // 150x > 100x max
        marginRequired: 76,
      },
      normalSheet
    )

    expect(orderRisk.allowed).toBe(false)
    expect(orderRisk.reason).toContain('LEVERAGE_EXCEEDED')
  })
})
