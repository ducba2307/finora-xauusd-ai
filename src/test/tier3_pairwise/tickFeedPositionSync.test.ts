import { describe, it, expect } from 'vitest'
import { MarketDataStore } from '@/stores/marketStore'
import { recalculateBalanceSheet } from '@/engine/riskEngine'
import { updateTrailingStop, checkPositionExitTriggers } from '@/engine/orderLifecycle'
import type { Position } from '@/types/trading'

describe('Tier 3: Pairwise Combination — Tick Feed + Live Position PnL Update', () => {
  it('synchronizes incoming market tick with position mark price, unrealized PnL, and account equity', () => {
    const store = new MarketDataStore()
    const initialCash = 50000

    let position: Position = {
      id: 'pos_btc_01',
      symbol: 'BTC/USDT',
      side: 'LONG',
      size: 0.5,
      entryPrice: 114000.0,
      markPrice: 114000.0,
      liquidationPrice: 103000.0,
      leverage: 10,
      margin: 5700.0,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      slPrice: 111000.0,
      tpPrice: 120000.0,
    }

    // Baseline balance sheet
    let sheet = recalculateBalanceSheet([position], initialCash, initialCash, initialCash)
    expect(sheet.equity).toBe(50000.0)
    expect(sheet.marginUsed).toBe(5700.0)
    expect(sheet.freeMargin).toBe(50000.0 - 5700.0)

    // New tick arrives from feed: BTC moves to 116,000 (+2,000 USD)
    const newMidPrice = 116000.0
    store.setTicker({
      ...store.getTicker('BTC/USDT')!,
      midPrice: newMidPrice,
      bidPrice: newMidPrice - 1,
      askPrice: newMidPrice + 1,
    })

    // Update position mark price and floating PnL
    const priceDiff = newMidPrice - position.entryPrice
    const newUnrealizedPnl = Number((priceDiff * position.size).toFixed(2)) // +$1,000
    const newUnrealizedPct = Number(((newUnrealizedPnl / position.margin) * 100).toFixed(2)) // +17.54%

    position = {
      ...position,
      markPrice: newMidPrice,
      unrealizedPnl: newUnrealizedPnl,
      unrealizedPnlPct: newUnrealizedPct,
    }

    expect(position.unrealizedPnl).toBe(1000.0)

    // Recalculate balance sheet with updated position
    sheet = recalculateBalanceSheet([position], initialCash, sheet.peakDailyEquity, initialCash)
    expect(sheet.equity).toBe(51000.0) // 50000 + 1000
    expect(sheet.peakDailyEquity).toBe(51000.0)
    expect(sheet.freeMargin).toBe(51000.0 - 5700.0)
    expect(sheet.marginLevelPct).toBeCloseTo((51000 / 5700) * 100, 1) // ~894.7%
  })

  it('triggers trailing stop ratchet when tick feed pushes mark price to new highs', () => {
    let position: Position = {
      id: 'pos_xau_02',
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
      slPrice: 2715.0,
    }

    const trailDistance = 8.0 // 8 USD trail
    const activationDistance = 5.0 // Activate once +5 USD in profit

    // Tick 1: Price goes to 2733 (+3): hasn't reached +5 activation -> no ratchet
    let ratchet1 = updateTrailingStop(position, 2733.0, trailDistance, activationDistance)
    expect(ratchet1.wasRatchetUpdated).toBe(false)

    // Tick 2: Price surges to 2742 (+12): activation reached! Candidate SL is 2742 - 8 = 2734 > 2715
    let ratchet2 = updateTrailingStop(position, 2742.0, trailDistance, activationDistance)
    expect(ratchet2.wasRatchetUpdated).toBe(true)
    expect(ratchet2.updatedSlPrice).toBe(2734.0)

    position = { ...position, slPrice: ratchet2.updatedSlPrice, markPrice: 2742.0 }

    // Tick 3: Price drops to 2736: trailing stop must HOLD at 2734 (never move down)
    let ratchet3 = updateTrailingStop(position, 2736.0, trailDistance, activationDistance)
    expect(ratchet3.wasRatchetUpdated).toBe(false)
    expect(ratchet3.updatedSlPrice).toBe(2734.0)
  })

  it('detects automated exit trigger when adverse tick strikes updated stop loss', () => {
    const position: Position = {
      id: 'pos_sol_03',
      symbol: 'SOL/USDT',
      side: 'LONG',
      size: 10.0,
      entryPrice: 195.0,
      markPrice: 195.0,
      liquidationPrice: 175.0,
      leverage: 10,
      margin: 195.0,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      slPrice: 190.0,
    }

    // Adverse tick drops SOL to 189.50 (below SL 190.0)
    const exitCheck = checkPositionExitTriggers(position, 189.5)
    expect(exitCheck.shouldExit).toBe(true)
    expect(exitCheck.exitReason).toBe('SL_HIT')
    expect(exitCheck.exitPrice).toBe(190.0)
  })
})
