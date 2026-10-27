import { describe, it, expect } from 'vitest'
import {
  registerNewSignal,
  updateSignalsWithPrice,
  calculateLedgerStats,
} from '../../services/signalLifecycleManager'

describe('Signal Lifecycle & State Machine Tracker', () => {
  it('loads initial historical ledger and computes valid stats', () => {
    const stats = calculateLedgerStats()
    expect(stats.totalSignals).toBeGreaterThanOrEqual(4)
    expect(stats.winRatePct).toBeGreaterThanOrEqual(0)
    expect(stats.winRatePct).toBeLessThanOrEqual(100)
    expect(Number.isFinite(stats.totalRealizedR)).toBe(true)
  })

  it('progresses signal from PENDING_RETEST to ACTIVE_TRIGGERED when price fills entry', () => {
    const sig = registerNewSignal({
      symbol: 'XAU/USD',
      direction: 'BUY',
      setupName: 'Test Fill Setup',
      entryPrice: 4150.00,
      stopLoss: 4140.00,
      takeProfit1: 4170.00,
      takeProfit2: 4185.00,
      riskRewardRatio: 2.0,
      emittedAt: Date.now(),
      rationale: 'Test',
      invalidationPrice: 4138.00,
      confidenceScore: 85,
    })

    expect(sig.status).toBe('PENDING_RETEST')

    // Price touches entry price (4149.00 <= 4150.00 and >= 4140.00)
    const updated = updateSignalsWithPrice(4149.00)
    const currentSig = updated.find((s) => s.id === sig.id)
    expect(currentSig?.status).toBe('ACTIVE_TRIGGERED')
  })

  it('progresses active BUY signal to TP1_HIT and locks break-even stop loss', () => {
    // Current price reaches TP1 (4170.50 >= 4170.00)
    const updated = updateSignalsWithPrice(4171.00)
    const sig = updated.find((s) => s.setupName === 'Test Fill Setup')
    expect(sig?.status).toBe('TP1_HIT')
    expect(sig?.isBreakEven).toBe(true)
    expect(sig?.stopLoss).toBe(sig?.entryPrice) // Stop loss moved to Entry!
  })
})
