import { describe, it, expect } from 'vitest'
import {
  INITIAL_BOT_INSTANCES,
  evaluateBotStrategy,
  type BotInstance,
} from '@/engine/botEngine'
import { processOrderPipeline } from '@/engine/orderLifecycle'
import type { AccountBalanceSheet } from '@/engine/riskEngine'

describe('Tier 3: Pairwise Combination — Bot Strategy Signal + Daily Circuit Breaker Check', () => {
  const goldBot: BotInstance = INITIAL_BOT_INSTANCES.find((b: BotInstance) => b.type === 'GOLD_HUNTER')!

  it('permits bot strategy signal execution when daily drawdown is within safe bounds (< 4.5%)', () => {
    // Normal balance sheet: daily drawdown = 1.5%
    const safeBalanceSheet: AccountBalanceSheet = {
      cashBalance: 98500,
      equity: 98500,
      marginUsed: 0,
      freeMargin: 98500,
      marginLevelPct: 999.99,
      peakDailyEquity: 100000,
      dailyStartEquity: 100000,
      dailyDrawdownPct: 1.5, // 1.5% < 4.5% limit
      dailyDrawdownUsd: 1500,
      isCircuitBreakerTripped: false,
    }

    // Bot triggers oversold bounce signal on XAU/USD (RSI = 25)
    const signal = evaluateBotStrategy(goldBot, {
      price: 2715.0,
      rsi: 25.0,
    })

    expect(signal).not.toBeNull()
    expect(signal?.symbol).toBe('XAU/USD')
    expect(signal?.side).toBe('BUY')

    // Run pipeline: should execute and fill
    const processed = processOrderPipeline(signal!, safeBalanceSheet)
    expect(processed.status).toBe('FILLED')
    expect(processed.stageReached).toBe('EXECUTION')
    expect(processed.positionCreated).toBeDefined()
  })

  it('intercepts and rejects bot strategy signals when daily drawdown breaches 4.5% circuit breaker', () => {
    // Breached balance sheet: daily drawdown = 4.8% (tripped)
    const trippedBalanceSheet: AccountBalanceSheet = {
      cashBalance: 95200,
      equity: 95200,
      marginUsed: 0,
      freeMargin: 95200,
      marginLevelPct: 999.99,
      peakDailyEquity: 100000,
      dailyStartEquity: 100000,
      dailyDrawdownPct: 4.8, // 4.8% >= 4.5% limit!
      dailyDrawdownUsd: 4800,
      isCircuitBreakerTripped: true,
    }

    // Bot evaluates market and generates a valid technical signal
    const signal = evaluateBotStrategy(goldBot, {
      price: 2710.0,
      rsi: 22.0,
    })

    expect(signal).not.toBeNull()

    // Pass through pipeline: Risk check MUST reject with CIRCUIT_BREAKER_ACTIVE
    const processed = processOrderPipeline(signal!, trippedBalanceSheet)
    expect(processed.status).toBe('REJECTED')
    expect(processed.stageReached).toBe('RISK_CHECK')
    expect(processed.rejectReason).toContain('CIRCUIT_BREAKER_ACTIVE')
    expect(processed.positionCreated).toBeUndefined()
  })

  it('verifies that paused or circuit-locked bot instances generate zero signals', () => {
    const lockedBot: BotInstance = {
      ...goldBot,
      status: 'LOCKED_BY_CIRCUIT_BREAKER',
    }

    const signal = evaluateBotStrategy(lockedBot, {
      price: 2710.0,
      rsi: 22.0,
    })

    expect(signal).toBeNull()
  })
})
