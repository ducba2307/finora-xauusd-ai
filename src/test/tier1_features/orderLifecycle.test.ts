import { describe, it, expect } from 'vitest'
import {
  validateOrderSignal,
  processOrderPipeline,
  updateTrailingStop,
  checkPositionExitTriggers,
  type OrderSignal,
} from '@/engine/orderLifecycle'
import { recalculateBalanceSheet, type AccountBalanceSheet } from '@/engine/riskEngine'
import type { Position } from '@/types/trading'

describe('Tier 1: F11 6-Stage Order Lifecycle Pipeline', () => {
  const healthyBalanceSheet: AccountBalanceSheet = recalculateBalanceSheet([], 50000, 50000, 50000)

  it('Stage 1 & 2: validates order signal inputs and flags malformed data', () => {
    const validSignal: OrderSignal = {
      id: 'sig_101',
      symbol: 'XAU/USD',
      side: 'BUY',
      size: 1.0,
      price: 2730.0,
      leverage: 20,
      slPrice: 2715.0,
      tpPrice: 2760.0,
    }
    const valResult = validateOrderSignal(validSignal)
    expect(valResult.valid).toBe(true)

    // Invalid: Long order with SL above entry price
    const invalidSlSignal: OrderSignal = {
      ...validSignal,
      slPrice: 2740.0,
    }
    const valFail = validateOrderSignal(invalidSlSignal)
    expect(valFail.valid).toBe(false)
    expect(valFail.reason).toContain('INVALID_SL')

    // Invalid: Zero size
    expect(validateOrderSignal({ ...validSignal, size: 0 }).valid).toBe(false)
  })

  it('Stage 3 & 4: processes risk check gateway and executes fill creating position', () => {
    const signal: OrderSignal = {
      id: 'sig_201',
      symbol: 'BTC/USDT',
      side: 'BUY',
      size: 0.1,
      price: 114000.0,
      leverage: 10,
      slPrice: 112000.0,
      tpPrice: 118000.0,
    }

    const processed = processOrderPipeline(signal, healthyBalanceSheet)
    expect(processed.status).toBe('FILLED')
    expect(processed.stageReached).toBe('EXECUTION')
    expect(processed.positionCreated).toBeDefined()

    const pos = processed.positionCreated!
    expect(pos.symbol).toBe('BTC/USDT')
    expect(pos.side).toBe('LONG')
    expect(pos.entryPrice).toBeGreaterThan(signal.price) // spread + slippage
    expect(pos.margin).toBe(1140.0) // 114000 * 0.1 / 10
    expect(pos.liquidationPrice).toBeLessThan(pos.entryPrice)
  })

  it('Stage 5: ratchets trailing stop upwards only as mark price reaches new highs', () => {
    const position: Position = {
      id: 'pos_301',
      symbol: 'XAU/USD',
      side: 'LONG',
      size: 1.0,
      entryPrice: 2730.0,
      markPrice: 2730.0,
      liquidationPrice: 2600.0,
      leverage: 20,
      margin: 136.5,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      slPrice: 2720.0,
    }

    const trailDistance = 10.0

    // Price advances to 2745: candidate SL is 2745 - 10 = 2735 (> 2720, so ratchet updates)
    const update1 = updateTrailingStop(position, 2745.0, trailDistance)
    expect(update1.wasRatchetUpdated).toBe(true)
    expect(update1.updatedSlPrice).toBe(2735.0)

    // Price pulls back to 2738: SL must NOT move down (high-water mark protection)
    const posWithNewSl = { ...position, slPrice: update1.updatedSlPrice }
    const update2 = updateTrailingStop(posWithNewSl, 2738.0, trailDistance)
    expect(update2.wasRatchetUpdated).toBe(false)
    expect(update2.updatedSlPrice).toBe(2735.0)
  })

  it('Stage 6: automatically triggers exit when Take Profit or Stop Loss is struck', () => {
    const position: Position = {
      id: 'pos_401',
      symbol: 'BTC/USDT',
      side: 'LONG',
      size: 1.0,
      entryPrice: 114000.0,
      markPrice: 114000.0,
      liquidationPrice: 105000.0,
      leverage: 10,
      margin: 11400.0,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      slPrice: 112000.0,
      tpPrice: 118000.0,
    }

    // Normal price in between: no exit
    expect(checkPositionExitTriggers(position, 115000.0).shouldExit).toBe(false)

    // Price hits Take Profit
    const tpExit = checkPositionExitTriggers(position, 118200.0)
    expect(tpExit.shouldExit).toBe(true)
    expect(tpExit.exitReason).toBe('TP_HIT')

    // Price hits Stop Loss
    const slExit = checkPositionExitTriggers(position, 111900.0)
    expect(slExit.shouldExit).toBe(true)
    expect(slExit.exitReason).toBe('SL_HIT')
  })

  it('Stage 6: triggers emergency liquidation when price crosses liquidation threshold', () => {
    const position: Position = {
      id: 'pos_501',
      symbol: 'SOL/USDT',
      side: 'LONG',
      size: 50.0,
      entryPrice: 200.0,
      markPrice: 200.0,
      liquidationPrice: 181.0,
      leverage: 10,
      margin: 1000.0,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
    }

    const liqExit = checkPositionExitTriggers(position, 180.5)
    expect(liqExit.shouldExit).toBe(true)
    expect(liqExit.exitReason).toBe('LIQUIDATION_TRIGGERED')
  })
})
