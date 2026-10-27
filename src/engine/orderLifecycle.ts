/**
 * 6-Stage Order Lifecycle Pipeline
 * src/engine/orderLifecycle.ts
 *
 * Stage 1: SIGNAL       - Normalization of manual, AI bot, or swarm order requests
 * Stage 2: VALIDATION   - Price sanity, positive lot size, SL/TP geometric geometry
 * Stage 3: RISK CHECK   - Pre-flight risk gateway (Circuit Breaker, Margin, Limits)
 * Stage 4: EXECUTION    - Institutional fill price (slippage & spread), DMA position creation
 * Stage 5: TRAILING     - High-water mark ratcheting stop loss strictly in favorable direction
 * Stage 6: EXIT MONITOR - Tick-by-tick trigger check against TP, SL, and Liquidation
 */

import type { Position, TradeOrder } from '@/types/trading'
import {
  evaluateOrderRisk,
  type AccountBalanceSheet,
  type RiskConfig,
} from './riskEngine'

export type OrderStage = 'SIGNAL' | 'VALIDATION' | 'RISK_CHECK' | 'EXECUTION' | 'TRAILING' | 'EXIT'

export type OrderStatus = 'SUBMITTED' | 'REJECTED' | 'FILLED'

export type ExitReason = 'TP_HIT' | 'SL_HIT' | 'LIQUIDATION_TRIGGERED' | 'MANUAL_CLOSE'

export interface OrderSignal {
  id: string
  symbol: string
  side: 'BUY' | 'SELL'
  size: number
  price: number
  leverage: number
  slPrice?: number
  tpPrice?: number
  trailingDistance?: number
  trailingActivationDistance?: number
  botId?: string
  source?: 'BOT' | 'MANUAL' | 'AI_SWARM'
  orderType?: 'MARKET' | 'LIMIT' | 'AI_TRAILING' | 'TWAP' | 'ICEBERG'
  timestamp?: number
}

export interface ProcessedOrderResult {
  orderId: string
  stageReached: OrderStage
  status: OrderStatus
  fillPrice?: number
  commissionUsd?: number
  slippageUsd?: number
  rejectReason?: string
  positionCreated?: Position
  executedTrade?: TradeOrder
}

export interface TrailingStopResult {
  updatedSlPrice: number
  wasRatchetUpdated: boolean
}

export interface PositionExitResult {
  shouldExit: boolean
  exitReason?: ExitReason
  exitPrice: number
}

export interface ClosedPositionSettlement {
  positionId: string
  exitPrice: number
  exitReason: ExitReason
  realizedPnl: number
  realizedPnlPct: number
  releasedMargin: number
  closedTrade: TradeOrder
}

/**
 * Stage 2: Order Validation
 */
export function validateOrderSignal(signal: OrderSignal): { valid: boolean; reason?: string } {
  if (!signal.id || !signal.symbol) {
    return { valid: false, reason: 'INVALID_METADATA: Signal missing id or symbol' }
  }
  if (!Number.isFinite(signal.size) || signal.size <= 0) {
    return { valid: false, reason: 'INVALID_SIZE: Order size must be strictly positive' }
  }
  if (!Number.isFinite(signal.price) || signal.price <= 0) {
    return { valid: false, reason: 'INVALID_PRICE: Order price must be strictly positive' }
  }
  if (signal.leverage < 1 || !Number.isFinite(signal.leverage)) {
    return { valid: false, reason: 'INVALID_LEVERAGE: Leverage must be >= 1' }
  }

  // Stop Loss Geometric Verification
  if (signal.slPrice !== undefined && signal.slPrice > 0) {
    if (signal.side === 'BUY' && signal.slPrice >= signal.price) {
      return { valid: false, reason: 'INVALID_SL: Long stop-loss must be strictly below entry price' }
    }
    if (signal.side === 'SELL' && signal.slPrice <= signal.price) {
      return { valid: false, reason: 'INVALID_SL: Short stop-loss must be strictly above entry price' }
    }
  }

  // Take Profit Geometric Verification
  if (signal.tpPrice !== undefined && signal.tpPrice > 0) {
    if (signal.side === 'BUY' && signal.tpPrice <= signal.price) {
      return { valid: false, reason: 'INVALID_TP: Long take-profit must be strictly above entry price' }
    }
    if (signal.side === 'SELL' && signal.tpPrice >= signal.price) {
      return { valid: false, reason: 'INVALID_TP: Short take-profit must be strictly below entry price' }
    }
  }

  // Trailing Distance Verification
  if (signal.trailingDistance !== undefined && signal.trailingDistance <= 0) {
    return { valid: false, reason: 'INVALID_TRAILING_DISTANCE: Trailing distance must be strictly positive' }
  }

  return { valid: true }
}

/**
 * Accurately determines whether a symbol is a Forex or Gold institutional asset.
 * Strictly avoids misclassifying Tether-quoted crypto pairs (e.g. BTC/USDT, ETH/USDT, SOL/USDT) as Forex.
 */
export function isForexSymbol(symbol: string): boolean {
  if (!symbol) return false
  const upper = symbol.toUpperCase()
  if (
    upper.includes('USDT') ||
    upper.includes('BTC') ||
    upper.includes('ETH') ||
    upper.includes('SOL')
  ) {
    return false
  }
  return (
    upper.includes('EUR') ||
    upper.includes('GBP') ||
    upper.includes('JPY') ||
    upper.includes('XAU') ||
    upper.endsWith('/USD') ||
    upper.startsWith('USD/')
  )
}

/**
 * Stages 1 through 4: Full Pipeline Execution Gateway
 */
export function processOrderPipeline(
  signal: OrderSignal,
  balanceSheet: AccountBalanceSheet,
  riskConfig: Partial<RiskConfig> = {},
  spreadPips: number = 0.3,
  slippagePct: number = 0.0003
): ProcessedOrderResult {
  // Stage 1: SIGNAL received
  // Stage 2: VALIDATION
  const valResult = validateOrderSignal(signal)
  if (!valResult.valid) {
    return {
      orderId: signal.id,
      stageReached: 'VALIDATION',
      status: 'REJECTED',
      rejectReason: valResult.reason,
    }
  }

  // Asset Classification & Contract Multiplier
  const isForex = isForexSymbol(signal.symbol)
  const isGold = signal.symbol.includes('XAU')
  const notionalMultiplier = isForex ? (isGold ? 100 : 100000) : 1

  // Stage 3: RISK_CHECK (with authentic contract multiplier)
  const notional = signal.size * signal.price * notionalMultiplier
  const marginRequired = notional / signal.leverage
  const riskResult = evaluateOrderRisk(
    {
      symbol: signal.symbol,
      side: signal.side,
      size: signal.size,
      price: signal.price,
      leverage: signal.leverage,
      marginRequired,
    },
    balanceSheet,
    riskConfig
  )

  if (!riskResult.allowed) {
    return {
      orderId: signal.id,
      stageReached: 'RISK_CHECK',
      status: 'REJECTED',
      rejectReason: riskResult.reason,
    }
  }

  // Stage 4: EXECUTION (Slippage & Spread applied)
  const spreadCost = (spreadPips * 0.0001) * signal.price
  const slippageUsd = signal.price * slippagePct
  const rawFillPrice = signal.side === 'BUY'
    ? signal.price + spreadCost + slippageUsd
    : signal.price - spreadCost - slippageUsd

  const fillPrice = Math.max(0.00001, rawFillPrice)
  const commissionUsd = Number((signal.size * 2.5).toFixed(2))

  const liquidationPrice = signal.side === 'BUY'
    ? fillPrice * (1 - 1 / signal.leverage + 0.005)
    : fillPrice * (1 + 1 / signal.leverage - 0.005)

  const positionCreated: Position = {
    id: `pos_${signal.id}`,
    symbol: signal.symbol,
    side: signal.side === 'BUY' ? 'LONG' : 'SHORT',
    size: signal.size,
    entryPrice: Number(fillPrice.toFixed(4)),
    markPrice: Number(fillPrice.toFixed(4)),
    liquidationPrice: Number(liquidationPrice.toFixed(4)),
    leverage: signal.leverage,
    margin: Number(marginRequired.toFixed(2)),
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    tpPrice: signal.tpPrice,
    slPrice: signal.slPrice,
    market: isForex ? 'FOREX' : 'CRYPTO',
    lots: isForex ? signal.size : undefined,
  }

  const executedTrade: TradeOrder = {
    id: `tx_${signal.id}`,
    assetSymbol: signal.symbol,
    type: signal.side,
    amount: signal.size,
    price: Number(fillPrice.toFixed(4)),
    total: Number(notional.toFixed(2)),
    time: 'Just now',
    status: 'COMPLETED',
    pnl: 0,
    aiStrategy: signal.botId ?? 'DMA Order Execution',
    market: isForex ? 'FOREX' : 'CRYPTO',
  }

  return {
    orderId: signal.id,
    stageReached: 'EXECUTION',
    status: 'FILLED',
    fillPrice: Number(fillPrice.toFixed(4)),
    commissionUsd,
    slippageUsd: Number(slippageUsd.toFixed(4)),
    positionCreated,
    executedTrade,
  }
}

/**
 * Stage 5: Trailing stop ratchet algorithm
 * Ensures stop-loss only moves in the favorable direction (never widens loss)
 */
export function updateTrailingStop(
  position: Position,
  currentMarkPrice: number,
  trailDistance: number,
  activationDistance: number = 0
): TrailingStopResult {
  if (trailDistance <= 0 || !Number.isFinite(currentMarkPrice)) {
    return { updatedSlPrice: position.slPrice ?? 0, wasRatchetUpdated: false }
  }

  const currentSl = position.slPrice ?? 0

  if (position.side === 'LONG') {
    // Only activate once price has moved ahead by activation distance
    if (currentMarkPrice >= position.entryPrice + activationDistance) {
      const candidateSl = Number((currentMarkPrice - trailDistance).toFixed(4))
      if (candidateSl > currentSl) {
        return { updatedSlPrice: candidateSl, wasRatchetUpdated: true }
      }
    }
  } else if (position.side === 'SHORT') {
    if (currentMarkPrice <= position.entryPrice - activationDistance) {
      const candidateSl = Number((currentMarkPrice + trailDistance).toFixed(4))
      if (currentSl === 0 || candidateSl < currentSl) {
        return { updatedSlPrice: candidateSl, wasRatchetUpdated: true }
      }
    }
  }

  return { updatedSlPrice: currentSl, wasRatchetUpdated: false }
}

/**
 * Stage 6: Position exit trigger evaluation
 */
export function checkPositionExitTriggers(
  position: Position,
  currentMarkPrice: number
): PositionExitResult {
  if (!Number.isFinite(currentMarkPrice)) {
    return { shouldExit: false, exitPrice: position.markPrice }
  }

  // 1. Liquidation Check (Priority 1)
  if (position.side === 'LONG' && currentMarkPrice <= position.liquidationPrice) {
    return { shouldExit: true, exitReason: 'LIQUIDATION_TRIGGERED', exitPrice: position.liquidationPrice }
  }
  if (position.side === 'SHORT' && currentMarkPrice >= position.liquidationPrice) {
    return { shouldExit: true, exitReason: 'LIQUIDATION_TRIGGERED', exitPrice: position.liquidationPrice }
  }

  // 2. Stop Loss Check (Priority 2)
  if (position.slPrice && position.slPrice > 0) {
    if (position.side === 'LONG' && currentMarkPrice <= position.slPrice) {
      return { shouldExit: true, exitReason: 'SL_HIT', exitPrice: position.slPrice }
    }
    if (position.side === 'SHORT' && currentMarkPrice >= position.slPrice) {
      return { shouldExit: true, exitReason: 'SL_HIT', exitPrice: position.slPrice }
    }
  }

  // 3. Take Profit Check (Priority 3)
  if (position.tpPrice && position.tpPrice > 0) {
    if (position.side === 'LONG' && currentMarkPrice >= position.tpPrice) {
      return { shouldExit: true, exitReason: 'TP_HIT', exitPrice: position.tpPrice }
    }
    if (position.side === 'SHORT' && currentMarkPrice <= position.tpPrice) {
      return { shouldExit: true, exitReason: 'TP_HIT', exitPrice: position.tpPrice }
    }
  }

  return { shouldExit: false, exitPrice: currentMarkPrice }
}

/**
 * Stage 6 Settlement Helper
 */
export function settlePositionExit(
  position: Position,
  exitPrice: number,
  exitReason: ExitReason,
  commissionUsd: number = 0
): ClosedPositionSettlement {
  const isCrypto =
    position.market === 'CRYPTO' ||
    !isForexSymbol(position.symbol)

  const isForex = !isCrypto && (position.market === 'FOREX' || isForexSymbol(position.symbol))
  const isGold = position.symbol.includes('XAU')
  const isJpy = position.symbol.includes('JPY')
  const notionalMultiplier = isForex ? (isGold ? 100 : 100000) : 1

  const isLong = position.side === 'LONG'
  const priceDiff = isLong ? exitPrice - position.entryPrice : position.entryPrice - exitPrice
  const rawPnl = priceDiff * (position.lots !== undefined ? position.lots : position.size) * notionalMultiplier
  const jpyRate = isJpy && exitPrice > 0 ? exitPrice : 1
  const grossPnl = isJpy ? rawPnl / jpyRate : rawPnl
  const netPnl = Number((grossPnl - commissionUsd).toFixed(2))
  const pnlPct = Number(((netPnl / (position.margin || 1)) * 100).toFixed(2))

  const closedTrade: TradeOrder = {
    id: `tx_close_${position.id}_${Date.now()}`,
    assetSymbol: position.symbol,
    type: position.side === 'LONG' ? 'SELL' : 'BUY',
    amount: position.size,
    price: exitPrice,
    total: Number((position.size * exitPrice * notionalMultiplier).toFixed(2)),
    time: 'Just now',
    status: 'COMPLETED',
    pnl: netPnl,
    aiStrategy: `Automated Exit (${exitReason})`,
    market: isForex ? 'FOREX' : 'CRYPTO',
  }

  return {
    positionId: position.id,
    exitPrice,
    exitReason,
    realizedPnl: netPnl,
    realizedPnlPct: pnlPct,
    releasedMargin: position.margin,
    closedTrade,
  }
}
