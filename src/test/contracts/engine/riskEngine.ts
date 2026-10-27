/**
 * Account Risk Engine & Circuit Breaker Contract
 * Authoritative reference derived from PROJECT.md (F12, F13) and ORIGINAL_REQUEST.md (R3)
 */

import type { Position } from '@/types/trading'

export interface AccountBalanceSheet {
  cashBalance: number
  equity: number
  marginUsed: number
  freeMargin: number
  marginLevelPct: number
  peakDailyEquity: number
  dailyStartEquity: number
  dailyDrawdownPct: number
  dailyDrawdownUsd: number
  isCircuitBreakerTripped: boolean
}

export interface RiskConfig {
  maxDailyDrawdownPct: number // Default 4.5%
  maxOpenPositions: number // Default 10
  maxLeverage: number // Default 100
  maxPositionSizeUsd: number // Default 50000
}

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  maxDailyDrawdownPct: 4.5,
  maxOpenPositions: 10,
  maxLeverage: 100,
  maxPositionSizeUsd: 50000,
}

export interface NewOrderRequest {
  symbol: string
  side: 'BUY' | 'SELL'
  size: number
  price: number
  leverage: number
  marginRequired: number
  currentOpenPositionsCount?: number
}

export function checkCircuitBreaker(
  dailyDrawdownPct: number,
  maxThresholdPct: number = 4.5
): { isTripped: boolean; reason?: string } {
  if (!Number.isFinite(dailyDrawdownPct)) {
    return { isTripped: false }
  }

  if (dailyDrawdownPct >= maxThresholdPct) {
    return {
      isTripped: true,
      reason: `Daily Max Drawdown Circuit Breaker Tripped: ${dailyDrawdownPct.toFixed(2)}% >= ${maxThresholdPct}% threshold. Account trading locked.`,
    }
  }

  return { isTripped: false }
}

export function recalculateBalanceSheet(
  positions: Position[],
  cashBalance: number,
  peakDailyEquity: number,
  dailyStartEquity: number
): AccountBalanceSheet {
  const safeCash = Number.isFinite(cashBalance) ? Math.max(0, cashBalance) : 0
  const safePositions = positions || []

  // Aggregate margin used and unrealized PnL
  let marginUsed = 0
  let totalUnrealizedPnl = 0

  for (const pos of safePositions) {
    marginUsed += Number.isFinite(pos.margin) ? pos.margin : 0
    totalUnrealizedPnl += Number.isFinite(pos.unrealizedPnl) ? pos.unrealizedPnl : 0
  }

  const equity = Number((safeCash + totalUnrealizedPnl).toFixed(2))
  const newPeak = Number(Math.max(peakDailyEquity || dailyStartEquity || equity, equity).toFixed(2))
  const freeMargin = Number(Math.max(0, equity - marginUsed).toFixed(2))

  const marginLevelPct = marginUsed > 0
    ? Number(((equity / marginUsed) * 100).toFixed(2))
    : 999.99

  const dailyDrawdownUsd = Number(Math.max(0, newPeak - equity).toFixed(2))
  const dailyDrawdownPct = newPeak > 0
    ? Number(((dailyDrawdownUsd / newPeak) * 100).toFixed(2))
    : 0

  const cbCheck = checkCircuitBreaker(dailyDrawdownPct, DEFAULT_RISK_CONFIG.maxDailyDrawdownPct)

  return {
    cashBalance: safeCash,
    equity,
    marginUsed,
    freeMargin,
    marginLevelPct,
    peakDailyEquity: newPeak,
    dailyStartEquity: dailyStartEquity || safeCash,
    dailyDrawdownPct,
    dailyDrawdownUsd,
    isCircuitBreakerTripped: cbCheck.isTripped,
  }
}

export function evaluateOrderRisk(
  order: NewOrderRequest,
  balanceSheet: AccountBalanceSheet,
  riskConfig: Partial<RiskConfig> = {}
): { allowed: boolean; reason?: string } {
  const config = { ...DEFAULT_RISK_CONFIG, ...riskConfig }

  // 1. Account Circuit Breaker Guard
  if (balanceSheet.isCircuitBreakerTripped || balanceSheet.dailyDrawdownPct >= config.maxDailyDrawdownPct) {
    return {
      allowed: false,
      reason: `CIRCUIT_BREAKER_ACTIVE: Daily drawdown is ${balanceSheet.dailyDrawdownPct}%, exceeding ${config.maxDailyDrawdownPct}% safety threshold.`,
    }
  }

  // 2. Margin Sufficiency Guard
  if (order.marginRequired > balanceSheet.freeMargin) {
    return {
      allowed: false,
      reason: `INSUFFICIENT_MARGIN: Required margin $${order.marginRequired.toFixed(2)} exceeds free margin $${balanceSheet.freeMargin.toFixed(2)}.`,
    }
  }

  // 3. Leverage Cap Guard
  if (order.leverage > config.maxLeverage) {
    return {
      allowed: false,
      reason: `LEVERAGE_EXCEEDED: Requested leverage ${order.leverage}x exceeds maximum permissible leverage ${config.maxLeverage}x.`,
    }
  }

  // 4. Max Open Position Count Guard
  const currentPositionsCount = order.currentOpenPositionsCount ?? 0
  if (currentPositionsCount >= config.maxOpenPositions) {
    return {
      allowed: false,
      reason: `MAX_POSITIONS_REACHED: Account has ${currentPositionsCount} open positions, reaching ceiling of ${config.maxOpenPositions}.`,
    }
  }

  // 5. Max Position Size Guard
  const notionalValue = order.size * order.price
  if (notionalValue > config.maxPositionSizeUsd) {
    return {
      allowed: false,
      reason: `MAX_SIZE_EXCEEDED: Notional value $${notionalValue.toFixed(2)} exceeds limit $${config.maxPositionSizeUsd}.`,
    }
  }

  return { allowed: true }
}
