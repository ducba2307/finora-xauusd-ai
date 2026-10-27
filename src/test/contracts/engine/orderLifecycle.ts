/**
 * 6-Stage Order Lifecycle Pipeline Contract
 * Authoritative reference derived from PROJECT.md (F11) and ORIGINAL_REQUEST.md (R3)
 */

import type { Position } from '@/types/trading'
import { evaluateOrderRisk, type AccountBalanceSheet, type RiskConfig } from './riskEngine'

export type OrderStage = 'SIGNAL' | 'VALIDATION' | 'RISK_CHECK' | 'EXECUTION' | 'TRAILING' | 'EXIT'

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
  botId?: string
}

export interface ProcessedOrderResult {
  orderId: string
  stageReached: OrderStage
  status: 'SUBMITTED' | 'REJECTED' | 'FILLED'
  fillPrice?: number
  commissionUsd?: number
  slippageUsd?: number
  rejectReason?: string
  positionCreated?: Position
}

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
  if (signal.slPrice !== undefined && signal.slPrice > 0) {
    if (signal.side === 'BUY' && signal.slPrice >= signal.price) {
      return { valid: false, reason: 'INVALID_SL: Long stop-loss must be strictly below entry price' }
    }
    if (signal.side === 'SELL' && signal.slPrice <= signal.price) {
      return { valid: false, reason: 'INVALID_SL: Short stop-loss must be strictly above entry price' }
    }
  }
  return { valid: true }
}

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

  // Stage 3: RISK_CHECK
  const notional = signal.size * signal.price
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
  const fillPrice = signal.side === 'BUY'
    ? signal.price + spreadCost + slippageUsd
    : signal.price - spreadCost - slippageUsd

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
  }

  return {
    orderId: signal.id,
    stageReached: 'EXECUTION',
    status: 'FILLED',
    fillPrice: Number(fillPrice.toFixed(4)),
    commissionUsd,
    slippageUsd: Number(slippageUsd.toFixed(4)),
    positionCreated,
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
): { updatedSlPrice: number; wasRatchetUpdated: boolean } {
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
): {
  shouldExit: boolean
  exitReason?: 'TP_HIT' | 'SL_HIT' | 'LIQUIDATION_TRIGGERED'
  exitPrice: number
} {
  if (!Number.isFinite(currentMarkPrice)) {
    return { shouldExit: false, exitPrice: position.markPrice }
  }

  // 1. Liquidation Check
  if (position.side === 'LONG' && currentMarkPrice <= position.liquidationPrice) {
    return { shouldExit: true, exitReason: 'LIQUIDATION_TRIGGERED', exitPrice: position.liquidationPrice }
  }
  if (position.side === 'SHORT' && currentMarkPrice >= position.liquidationPrice) {
    return { shouldExit: true, exitReason: 'LIQUIDATION_TRIGGERED', exitPrice: position.liquidationPrice }
  }

  // 2. Stop Loss Check
  if (position.slPrice && position.slPrice > 0) {
    if (position.side === 'LONG' && currentMarkPrice <= position.slPrice) {
      return { shouldExit: true, exitReason: 'SL_HIT', exitPrice: position.slPrice }
    }
    if (position.side === 'SHORT' && currentMarkPrice >= position.slPrice) {
      return { shouldExit: true, exitReason: 'SL_HIT', exitPrice: position.slPrice }
    }
  }

  // 3. Take Profit Check
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
