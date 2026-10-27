import { describe, it, expect } from 'vitest'
import {
  evaluateOrderRisk,
  recalculateBalanceSheet,
  type AccountBalanceSheet,
} from '@/engine/riskEngine'
import {
  processOrderPipeline,
  type OrderSignal,
} from '@/engine/orderLifecycle'
import {
  INITIAL_BOT_INSTANCES,
  evaluateBotStrategy,
  type BotInstance,
} from '@/engine/botEngine'

describe('Tier 4: Real-World Scenario — Crypto Liquidation Cascade Triggering 4.5% Circuit Breaker', () => {
  it('simulates multi-asset cascading losses tripping the 4.5% Circuit Breaker and locking subsequent orders', () => {
    const peakEquity = 100000.0 // Peak starting equity $100k
    let cashBalance = 100000.0

    // Step 1: Normal trading starts
    let sheet: AccountBalanceSheet = recalculateBalanceSheet([], cashBalance, peakEquity, peakEquity)
    expect(sheet.isCircuitBreakerTripped).toBe(false)
    expect(sheet.dailyDrawdownPct).toBe(0)

    // Step 2: Loss 1 on BTC flash dip (-$1,800 realized loss)
    cashBalance -= 1800
    sheet = recalculateBalanceSheet([], cashBalance, peakEquity, peakEquity)
    expect(sheet.dailyDrawdownPct).toBe(1.8) // 1.8% < 4.5%
    expect(sheet.isCircuitBreakerTripped).toBe(false)

    // Step 3: Loss 2 on ETH liquidation (-$2,000 realized loss)
    cashBalance -= 2000
    sheet = recalculateBalanceSheet([], cashBalance, peakEquity, peakEquity)
    expect(sheet.dailyDrawdownPct).toBe(3.8) // 3.8% < 4.5%
    expect(sheet.isCircuitBreakerTripped).toBe(false)

    // Bot order still permitted at 3.8% drawdown
    const scalperBot = INITIAL_BOT_INSTANCES.find((b: BotInstance) => b.type === 'SCALPER')!
    const signal1 = evaluateBotStrategy(scalperBot, {
      price: 112000.0,
      ema20: 112500.0,
      ema50: 112100.0,
      rsi: 62.0,
    })
    expect(signal1).not.toBeNull()
    const riskCheck1 = evaluateOrderRisk(
      {
        symbol: signal1!.symbol,
        side: signal1!.side,
        size: signal1!.size,
        price: signal1!.price,
        leverage: signal1!.leverage,
        marginRequired: 500,
      },
      sheet
    )
    expect(riskCheck1.allowed).toBe(true)

    // Step 4: Loss 3 on SOL cascade (-$1,000 realized loss)
    // Cumulative loss: $1,800 + $2,000 + $1,000 = $4,800 (4.8% drawdown >= 4.5% threshold!)
    cashBalance -= 1000
    sheet = recalculateBalanceSheet([], cashBalance, peakEquity, peakEquity)
    expect(sheet.dailyDrawdownPct).toBe(4.8)
    expect(sheet.isCircuitBreakerTripped).toBe(true)

    // Step 5: Circuit Breaker activates! All subsequent bot orders are REJECTED
    const signal2 = evaluateBotStrategy(scalperBot, {
      price: 111500.0,
      ema20: 112000.0,
      ema50: 111800.0,
      rsi: 60.0,
    })
    expect(signal2).not.toBeNull()

    const pipelineResult = processOrderPipeline(signal2!, sheet)
    expect(pipelineResult.status).toBe('REJECTED')
    expect(pipelineResult.stageReached).toBe('RISK_CHECK')
    expect(pipelineResult.rejectReason).toContain('CIRCUIT_BREAKER_ACTIVE')
    expect(pipelineResult.positionCreated).toBeUndefined()

    // Manual trader order submission is also blocked
    const manualOrder: OrderSignal = {
      id: 'sig_manual_fomo',
      symbol: 'BTC/USDT',
      side: 'BUY',
      size: 0.1,
      price: 111500.0,
      leverage: 10,
    }
    const manualResult = processOrderPipeline(manualOrder, sheet)
    expect(manualResult.status).toBe('REJECTED')
    expect(manualResult.rejectReason).toContain('CIRCUIT_BREAKER_ACTIVE')
  })
})
