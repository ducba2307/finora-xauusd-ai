/**
 * Account Risk Engine & Daily Circuit Breaker
 * src/engine/riskEngine.ts
 *
 * Implements Feature F12 (Account Risk Engine) and F13 (Balance Sheet Sync)
 * adhering to Requirement R3 institutional risk safeguards.
 */

import type { Position } from '@/types/trading'
export type { AccountBalanceSheet, RiskConfig } from '@/types/trading'
import type { AccountBalanceSheet, RiskConfig } from '@/types/trading'
import { isForexSymbol } from './orderLifecycle'

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  maxDailyDrawdownPct: 4.5,
  maxOpenPositions: 10,
  maxLeverage: 100,
  maxPositionSizeUsd: 50000,
  maxSlippageTolerancePct: 0.5,
}

export interface NewOrderRequest {
  symbol: string
  side: 'BUY' | 'SELL'
  size: number
  price: number
  leverage: number
  marginRequired: number
  currentOpenPositionsCount?: number
  slippagePct?: number
}

export interface CircuitBreakerResult {
  isTripped: boolean
  reason?: string
}

export interface RiskEvaluationResult {
  allowed: boolean
  reason?: string
}

/**
 * Evaluates whether current daily drawdown breaches the institutional circuit breaker threshold,
 * or if account equity has been depleted to zero or below.
 */
export function checkCircuitBreaker(
  dailyDrawdownPct: number,
  maxThresholdPct: number = 4.5,
  currentEquity?: number
): CircuitBreakerResult {
  // Unconditional trip on zero or negative equity
  if (currentEquity !== undefined && currentEquity <= 0) {
    return {
      isTripped: true,
      reason: `Account equity depleted: $${currentEquity.toFixed(2)} <= 0. Account trading locked.`,
    }
  }

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

/**
 * Calculates position floating PnL with multi-asset contract multipliers & currency conversion.
 * - Gold (XAU/USD): 100 troy oz contract multiplier
 * - Forex (EUR/USD, GBP/USD): 100,000 standard lot multiplier
 * - USD/JPY: JPY quote currency divided by exchange rate (markPrice)
 * - Crypto: Unit multiplier (1)
 */
export function calculatePositionPnl(
  position: Position,
  markPrice: number
): { unrealizedPnl: number; unrealizedPnlPct: number } {
  if (!Number.isFinite(markPrice) || markPrice <= 0) {
    return {
      unrealizedPnl: position.unrealizedPnl,
      unrealizedPnlPct: position.unrealizedPnlPct,
    }
  }

  const isCrypto =
    position.market === 'CRYPTO' ||
    !isForexSymbol(position.symbol)

  const isForex = !isCrypto && (position.market === 'FOREX' || isForexSymbol(position.symbol))
  const isGold = position.symbol.includes('XAU')
  const isJpy = position.symbol.includes('JPY')
  const notionalMultiplier = isForex ? (isGold ? 100 : 100000) : 1
  const isLong = position.side === 'LONG'
  const priceDelta = isLong ? markPrice - position.entryPrice : position.entryPrice - markPrice
  const rawPnl = priceDelta * (position.lots !== undefined ? position.lots : position.size) * notionalMultiplier

  const jpyRate = markPrice > 0 ? markPrice : (position.entryPrice > 0 ? position.entryPrice : 1)
  const pnlUsd = isJpy ? rawPnl / jpyRate : rawPnl
  const pnl = Number(pnlUsd.toFixed(2))
  const marginBase = Math.max(0.01, position.margin || 1)
  const pnlPct = Number(((pnl / marginBase) * 100).toFixed(2))

  return {
    unrealizedPnl: pnl,
    unrealizedPnlPct: pnlPct,
  }
}

/**
 * Recalculates the dynamic account balance sheet from open positions, cash balance, and peak equity.
 */
export function recalculateBalanceSheet(
  positions: Position[],
  cashBalance: number,
  peakDailyEquity: number,
  dailyStartEquity: number
): AccountBalanceSheet {
  const safeCash = Number.isFinite(cashBalance) ? Math.max(0, cashBalance) : 0
  const safePositions = positions || []

  let marginUsed = 0
  let totalUnrealizedPnl = 0

  for (const pos of safePositions) {
    marginUsed += Number.isFinite(pos.margin) ? pos.margin : 0
    totalUnrealizedPnl += Number.isFinite(pos.unrealizedPnl) ? pos.unrealizedPnl : 0
  }

  const equity = Number((safeCash + totalUnrealizedPnl).toFixed(2))
  const newPeak = Number(Math.max(peakDailyEquity || dailyStartEquity || equity, equity).toFixed(2))
  const freeMargin = Number(Math.max(0, equity - marginUsed).toFixed(2))

  const marginLevelPct =
    marginUsed > 0 ? Number(((equity / marginUsed) * 100).toFixed(2)) : 999.99

  const dailyDrawdownUsd = Number(Math.max(0, newPeak - equity).toFixed(2))
  const dailyDrawdownPct =
    newPeak > 0 ? Number(((dailyDrawdownUsd / newPeak) * 100).toFixed(2)) : 0

  // Trip unconditionally if equity <= 0, or if daily drawdown threshold breached
  const cbCheck =
    equity <= 0
      ? {
          isTripped: true,
          reason: `Account equity depleted: $${equity.toFixed(2)} <= 0. Account trading locked.`,
        }
      : checkCircuitBreaker(dailyDrawdownPct, DEFAULT_RISK_CONFIG.maxDailyDrawdownPct, equity)

  return {
    cashBalance: safeCash,
    equity,
    marginUsed: Number(marginUsed.toFixed(2)),
    freeMargin,
    marginLevelPct,
    peakDailyEquity: newPeak,
    dailyStartEquity: dailyStartEquity || safeCash,
    dailyDrawdownPct,
    dailyDrawdownUsd,
    isCircuitBreakerTripped: cbCheck.isTripped,
    circuitBreakerReason: cbCheck.reason,
  }
}

/**
 * Pre-flight order gateway validating circuit breaker, margin sufficiency, leverage, position limits, size, and slippage.
 */
export function evaluateOrderRisk(
  order: NewOrderRequest,
  balanceSheet: AccountBalanceSheet,
  riskConfig: Partial<RiskConfig> = {}
): RiskEvaluationResult {
  const config = { ...DEFAULT_RISK_CONFIG, ...riskConfig }

  // 1. Account Circuit Breaker Guard
  if (balanceSheet.isCircuitBreakerTripped || balanceSheet.dailyDrawdownPct >= config.maxDailyDrawdownPct || balanceSheet.equity <= 0) {
    return {
      allowed: false,
      reason: balanceSheet.circuitBreakerReason
        ? `CIRCUIT_BREAKER_ACTIVE: ${balanceSheet.circuitBreakerReason}`
        : `CIRCUIT_BREAKER_ACTIVE: Daily drawdown is ${balanceSheet.dailyDrawdownPct}%, exceeding ${config.maxDailyDrawdownPct}% safety threshold.`,
    }
  }

  // 2. Margin Sufficiency Guard (strict > allows exact match, rejects if required > freeMargin)
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

  // 5. Max Position Size Guard (Contract Multiplier applied for Forex/Gold)
  const isForex = isForexSymbol(order.symbol)
  const isGold = order.symbol.includes('XAU')
  const notionalMultiplier = isForex ? (isGold ? 100 : 100000) : 1

  const notionalValue = order.size * order.price * notionalMultiplier
  const maxLimit = riskConfig.maxPositionSizeUsd !== undefined
    ? riskConfig.maxPositionSizeUsd
    : (isForex ? 1000000 : config.maxPositionSizeUsd)

  if (notionalValue > maxLimit) {
    return {
      allowed: false,
      reason: `MAX_SIZE_EXCEEDED: Notional value $${notionalValue.toFixed(2)} exceeds limit $${maxLimit}.`,
    }
  }

  // 6. Slippage Tolerance Guard
  if (
    order.slippagePct !== undefined &&
    config.maxSlippageTolerancePct !== undefined &&
    order.slippagePct > config.maxSlippageTolerancePct
  ) {
    return {
      allowed: false,
      reason: `SLIPPAGE_EXCEEDED: Slippage ${order.slippagePct.toFixed(2)}% exceeds maximum tolerance ${config.maxSlippageTolerancePct}%.`,
    }
  }

  return { allowed: true }
}

/**
 * 7. Minimum Risk/Reward Ratio Gatekeeper (R:R >= 2.0)
 */
export function validateRiskRewardRatio(
  entry: number,
  sl: number,
  tp: number,
  minRatio: number = 2.0
): { valid: boolean; ratio: number; reason?: string } {
  if (!Number.isFinite(entry) || !Number.isFinite(sl) || !Number.isFinite(tp) || entry <= 0) {
    return { valid: false, ratio: 0, reason: 'Tọa độ giá không hợp lệ.' }
  }

  const risk = Math.abs(entry - sl)
  const reward = Math.abs(tp - entry)

  if (risk <= 0) {
    return { valid: false, ratio: 0, reason: 'Khoảng cách Stop Loss bằng 0 (Rủi ro vô cực).' }
  }

  const ratio = Number((reward / risk).toFixed(2))
  if (ratio < minRatio) {
    return {
      valid: false,
      ratio,
      reason: `Tỷ lệ R:R đạt 1:${ratio}, không thỏa mãn ngưỡng tối thiểu bắt buộc 1:${minRatio}.`,
    }
  }

  return { valid: true, ratio }
}

export interface EconomicEventTimePoint {
  title: string
  timeUnix: number
  impact: 'HIGH' | 'MEDIUM' | 'LOW'
}

export const DEFAULT_MOCK_ECONOMIC_EVENTS: EconomicEventTimePoint[] = [
  {
    title: 'US CPI Consumer Price Index',
    timeUnix: Math.floor(Date.now() / 1000) + 45 * 60, // 45 mins from now
    impact: 'HIGH',
  },
  {
    title: 'FOMC Interest Rate Decision',
    timeUnix: Math.floor(Date.now() / 1000) + 24 * 3600,
    impact: 'HIGH',
  },
]

/**
 * 8. News Blackout Guard: Suspends signals +-15 minutes around Red Impact events
 */
export function checkNewsBlackoutStatus(
  currentTimeSec: number = Math.floor(Date.now() / 1000),
  upcomingEvents: EconomicEventTimePoint[] = DEFAULT_MOCK_ECONOMIC_EVENTS,
  windowMinutes: number = 15
): {
  isBlackoutActive: boolean
  activeEventTitle?: string
  minutesDelta?: number
  message: string
} {
  const windowSec = windowMinutes * 60

  for (const evt of upcomingEvents) {
    if (evt.impact === 'HIGH') {
      const deltaSec = evt.timeUnix - currentTimeSec
      // Inside the blackout window: from -windowSec to +windowSec
      if (Math.abs(deltaSec) <= windowSec) {
        const deltaMin = Math.round(deltaSec / 60)
        return {
          isBlackoutActive: true,
          activeEventTitle: evt.title,
          minutesDelta: deltaMin,
          message: `CHẾ ĐỘ AN TOÀN / KHÓA TIN ĐỎ: Đang trong cửa sổ biến động mạnh của tin "${evt.title}" (${
            deltaMin > 0 ? `còn ${deltaMin} phút` : `vừa ra ${Math.abs(deltaMin)} phút trước`
          }). Tự động đình chỉ tín hiệu mới!`,
        }
      }
    }
  }

  return {
    isBlackoutActive: false,
    message: 'Trạng thái an toàn: Không có tin tức đỏ (High Impact) trong vòng 15 phút tới.',
  }
}

/**
 * 9. Institutional Lot Sizing by Account Risk Percentage
 */
export function calculatePositionLotSize(
  accountEquity: number,
  riskPercent: number,
  entryPrice: number,
  stopLossPrice: number,
  symbol: string = 'XAU/USD'
): { lots: number; riskUsd: number; pips: number } {
  if (accountEquity <= 0 || riskPercent <= 0 || entryPrice <= 0 || stopLossPrice <= 0) {
    return { lots: 0.01, riskUsd: 0, pips: 0 }
  }

  const isGold = symbol.toUpperCase().includes('XAU')
  const contractMultiplier = isGold ? 100 : symbol.includes('JPY') ? 1000 : 100000
  const riskUsd = (accountEquity * Math.min(5, riskPercent)) / 100

  const priceDistance = Math.abs(entryPrice - stopLossPrice)
  if (priceDistance <= 0) {
    return { lots: 0.01, riskUsd, pips: 0 }
  }

  const rawLots = riskUsd / (priceDistance * contractMultiplier)
  // Step size 0.01 lot, minimum 0.01, maximum 50.0
  const lots = Math.max(0.01, Math.min(50.0, Math.floor(rawLots * 100) / 100))
  const pips = Number((priceDistance * (isGold ? 10 : 10000)).toFixed(1))

  return { lots, riskUsd: Number(riskUsd.toFixed(2)), pips }
}

/**
 * 10. Dynamic Spread Buffer for Gold Stop Losses
 */
export function applyDynamicSpreadBuffer(
  rawStopLoss: number,
  direction: 'BUY' | 'SELL',
  spreadBufferUsd: number = 1.80
): number {
  if (direction === 'BUY') {
    return Number((rawStopLoss - spreadBufferUsd).toFixed(2))
  }
  return Number((rawStopLoss + spreadBufferUsd).toFixed(2))
}

