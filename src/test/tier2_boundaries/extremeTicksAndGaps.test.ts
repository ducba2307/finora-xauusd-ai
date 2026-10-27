import { describe, it, expect } from 'vitest'
import {
  validateOrderSignal,
  checkPositionExitTriggers,
  type OrderSignal,
} from '@/engine/orderLifecycle'
import { MarketDataStore } from '@/stores/marketStore'
import type { Position } from '@/types/trading'

describe('Tier 2: Boundary & Corner Cases — Extreme Price Ticks & Gaps', () => {
  const store = new MarketDataStore()

  it('rejects zero or negative prices in order validation', () => {
    const zeroPriceSignal: OrderSignal = {
      id: 'sig_zero_p',
      symbol: 'BTC/USDT',
      side: 'BUY',
      size: 1.0,
      price: 0,
      leverage: 10,
    }
    expect(validateOrderSignal(zeroPriceSignal).valid).toBe(false)

    const negPriceSignal: OrderSignal = {
      ...zeroPriceSignal,
      price: -100,
    }
    expect(validateOrderSignal(negPriceSignal).valid).toBe(false)
  })

  it('handles violent flash drop tick: triggers liquidation or stop loss without crash', () => {
    const position: Position = {
      id: 'pos_long_btc',
      symbol: 'BTC/USDT',
      side: 'LONG',
      size: 1.0,
      entryPrice: 114000,
      markPrice: 114000,
      liquidationPrice: 103000,
      leverage: 10,
      margin: 11400,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      slPrice: 111000,
      tpPrice: 120000,
    }

    // Flash drop to $55,000 (-51% in a single tick)
    const flashTick = 55000
    const exitResult = checkPositionExitTriggers(position, flashTick)

    expect(exitResult.shouldExit).toBe(true)
    // Both SL and Liquidation are breached; liquidation takes precedence as emergency liquidation
    expect(exitResult.exitReason).toBe('LIQUIDATION_TRIGGERED')
    expect(exitResult.exitPrice).toBe(position.liquidationPrice)
  })

  it('handles micro-lot order sizing (0.0001 lots) without underflow or zero slippage crash', () => {
    const microFill = store.calculateExecutionFill('BTC/USDT', 'BUY', 0.0001)

    expect(Number.isFinite(microFill.fillPrice)).toBe(true)
    expect(microFill.fillPrice).toBeGreaterThan(0)
    expect(microFill.spreadCost).toBeGreaterThan(0)
    expect(microFill.slippageCost).toBeGreaterThanOrEqual(0)
  })

  it('handles institutional whale size (5,000 lots) scaling square-root slippage gracefully', () => {
    const whaleFill = store.calculateExecutionFill('BTC/USDT', 'BUY', 5000.0)

    expect(Number.isFinite(whaleFill.fillPrice)).toBe(true)
    expect(whaleFill.fillPrice).toBeGreaterThan(store.getTicker('BTC/USDT')!.askPrice)
    expect(whaleFill.slippageCost).toBeGreaterThan(100) // Deep impact on orderbook
    expect(Number.isFinite(whaleFill.commission)).toBe(true)
  })

  it('handles tick price crossing Take Profit barrier upward for Short positions', () => {
    const shortPosition: Position = {
      id: 'pos_short_eur',
      symbol: 'EUR/USD',
      side: 'SHORT',
      size: 1.0,
      entryPrice: 1.0850,
      markPrice: 1.0850,
      liquidationPrice: 1.1200,
      leverage: 20,
      margin: 54.25,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      slPrice: 1.0920,
      tpPrice: 1.0750, // Profit target below entry
    }

    // Tick drops to 1.0740: below TP -> should trigger TP exit
    const exitResult = checkPositionExitTriggers(shortPosition, 1.0740)
    expect(exitResult.shouldExit).toBe(true)
    expect(exitResult.exitReason).toBe('TP_HIT')
    expect(exitResult.exitPrice).toBe(1.0750)
  })
})
