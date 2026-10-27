import { describe, it, expect } from 'vitest'
import { MarketDataStore } from '@/stores/marketStore'
import {
  processOrderPipeline,
  type OrderSignal,
} from '@/engine/orderLifecycle'
import {
  recalculateBalanceSheet,
  type AccountBalanceSheet,
} from '@/engine/riskEngine'

describe('Tier 3: Pairwise Combination — Order Submission + Margin Check + Slippage', () => {
  const store = new MarketDataStore()

  it('coordinates order sizing, free margin verification, square-root slippage, and fill price execution', () => {
    const initialCash = 25000
    const balanceSheet: AccountBalanceSheet = recalculateBalanceSheet([], initialCash, initialCash, initialCash)

    // Notional: 0.4 * 114000 = $45,600 <= $50,000 maxPositionSizeUsd
    // Margin required = 45600 / 20 = $2,280 <= $25,000 free margin
    const signal: OrderSignal = {
      id: 'sig_eth_pair',
      symbol: 'BTC/USDT',
      side: 'BUY',
      size: 0.4,
      price: 114000.0,
      leverage: 20,
      slPrice: 112000.0,
      tpPrice: 118000.0,
    }

    // 1. Process pipeline: signal passes validation and margin check ($2,280 <= $25,000)
    const processed = processOrderPipeline(signal, balanceSheet)
    expect(processed.status).toBe('FILLED')
    expect(processed.stageReached).toBe('EXECUTION')
    expect(processed.fillPrice).toBeGreaterThan(signal.price) // incorporates spread and slippage
    expect(processed.commissionUsd).toBe(Number((0.4 * 2.5).toFixed(2))) // $1.00 commission

    // 2. Position created has correct margin allocation
    const position = processed.positionCreated!
    expect(position.margin).toBe(2280.0)

    // 3. Updated balance sheet accurately deducts margin used
    const updatedSheet = recalculateBalanceSheet([position], initialCash, initialCash, initialCash)
    expect(updatedSheet.marginUsed).toBe(2280.0)
    expect(updatedSheet.freeMargin).toBe(initialCash - 2280.0)
  })

  it('rejects order when scaled order size causes margin requirement to exceed free margin', () => {
    const lowCashBalance = 1000
    const tightSheet: AccountBalanceSheet = recalculateBalanceSheet([], lowCashBalance, lowCashBalance, lowCashBalance)

    // Order requires 0.3 * 114000 / 10 = $3,420 margin > $1,000 free margin
    const oversizedSignal: OrderSignal = {
      id: 'sig_oversized',
      symbol: 'BTC/USDT',
      side: 'BUY',
      size: 0.3,
      price: 114000.0,
      leverage: 10,
    }

    const processed = processOrderPipeline(oversizedSignal, tightSheet)
    expect(processed.status).toBe('REJECTED')
    expect(processed.stageReached).toBe('RISK_CHECK')
    expect(processed.rejectReason).toContain('INSUFFICIENT_MARGIN')
    expect(processed.positionCreated).toBeUndefined()
  })

  it('demonstrates non-linear slippage scaling impact on fill prices between modest and large institutional orders', () => {
    const ticker = store.getTicker('BTC/USDT')!

    const fillModest = store.calculateExecutionFill('BTC/USDT', 'BUY', 2.0)
    const fillWhale = store.calculateExecutionFill('BTC/USDT', 'BUY', 50.0)

    expect(fillModest.fillPrice).toBeGreaterThan(ticker.askPrice)
    expect(fillWhale.fillPrice).toBeGreaterThan(fillModest.fillPrice)

    // Whale order experiences significantly higher slippage cost
    expect(fillWhale.slippageCost).toBeGreaterThan(fillModest.slippageCost)
    expect(fillWhale.commission).toBeGreaterThan(fillModest.commission)
  })
})
