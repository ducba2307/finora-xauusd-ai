/**
 * Multi-Method Technical Confluence Engine
 * src/quant/confluenceEngine.ts
 *
 * Implements Layer 1 (Deterministic Quant Code):
 * - Price Action (Fractal Swings, Rejection Wicks, Pinbars, Engulfing)
 * - SMC & ICT (BSL/SSL Sweeps, CHoCH, BOS, Order Blocks, FVGs, London/NY Killzones)
 * - Multi-Timeframe RSI Momentum & Regular/Hidden Divergence
 * - Confluence Scoring (0 - 100) & State-Hash generation for API Deduplication
 */

import {
  analyzeSMCStructure,
  type SMCAnalysisResult,
  type SMCCandle,
} from './smartMoneyConcepts'
import { calculateRSI } from './indicators'

export type ICTKillzone =
  | 'ASIAN_RANGE'
  | 'LONDON_OPEN'
  | 'NEW_YORK_OPEN'
  | 'LONDON_CLOSE'
  | 'OFF_HOURS'

export interface PriceActionPattern {
  candlePattern:
    | 'BULLISH_PINBAR'
    | 'BEARISH_PINBAR'
    | 'BULLISH_ENGULFING'
    | 'BEARISH_ENGULFING'
    | 'DOJI'
    | 'NONE'
  rejectionWickRatio: number
  isRejectionAtKeyLevel: boolean
  description: string
}

export interface RSIDivergence {
  type:
    | 'BULLISH_REGULAR'
    | 'BEARISH_REGULAR'
    | 'BULLISH_HIDDEN'
    | 'BEARISH_HIDDEN'
    | 'NONE'
  currentRsi: number
  priorRsi: number
  isOverbought: boolean
  isOversold: boolean
  description: string
}

export interface TechnicalConfluenceReport {
  symbol: string
  currentPrice: number
  timestamp: number
  timeframe: string
  killzone: ICTKillzone
  killzoneName: string
  priceAction: PriceActionPattern
  smcAnalysis: SMCAnalysisResult
  rsiAnalysis: RSIDivergence
  confluenceScore: number // 0 to 100
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  reasons: string[]
  stateHash: string
}

/**
 * 1. Compute ICT Killzone based on UTC Timestamp
 * Standardized to New York Eastern Time (handles EST/EDT offset approximation)
 */
export function getICTKillzone(timestampSeconds: number): {
  killzone: ICTKillzone
  name: string
  isActive: boolean
} {
  const date = new Date(timestampSeconds * 1000)
  const utcHours = date.getUTCHours()
  const utcMinutes = date.getUTCMinutes()
  const timeDecimal = utcHours + utcMinutes / 60

  // UTC equivalents for NY market killzones (UTC-5 standard):
  // London Open: 02:00 - 05:00 EST -> 07:00 - 10:00 UTC
  // NY Open:     07:00 - 10:00 EST -> 12:00 - 15:00 UTC
  // London Close: 10:00 - 12:00 EST -> 15:00 - 17:00 UTC
  // Asian Range: 19:00 - 00:00 EST -> 00:00 - 05:00 UTC

  if (timeDecimal >= 12.0 && timeDecimal <= 15.0) {
    return {
      killzone: 'NEW_YORK_OPEN',
      name: 'New York Open Killzone (07:00 - 10:00 EST)',
      isActive: true,
    }
  }
  if (timeDecimal >= 7.0 && timeDecimal <= 10.0) {
    return {
      killzone: 'LONDON_OPEN',
      name: 'London Open Killzone (02:00 - 05:00 EST)',
      isActive: true,
    }
  }
  if (timeDecimal >= 15.0 && timeDecimal <= 17.0) {
    return {
      killzone: 'LONDON_CLOSE',
      name: 'London Close Killzone (10:00 - 12:00 EST)',
      isActive: true,
    }
  }
  if (timeDecimal >= 0.0 && timeDecimal <= 5.0) {
    return {
      killzone: 'ASIAN_RANGE',
      name: 'Asian Session Accumulation Range',
      isActive: false,
    }
  }

  return {
    killzone: 'OFF_HOURS',
    name: 'Interbank Off-Hours / Midday Lull',
    isActive: false,
  }
}

/**
 * 2. Price Action Pattern Recognition
 * Evaluates the latest 2-3 closed candles for Pinbars and Engulfing patterns
 */
export function detectPriceActionPattern(candles: SMCCandle[]): PriceActionPattern {
  if (!candles || candles.length < 2) {
    return {
      candlePattern: 'NONE',
      rejectionWickRatio: 0,
      isRejectionAtKeyLevel: false,
      description: 'Chưa đủ dữ liệu nến để xác định mô hình nến.',
    }
  }

  const curr = candles[candles.length - 1]
  const prev = candles[candles.length - 2]
  const totalRange = curr.high - curr.low

  if (totalRange <= 0) {
    return {
      candlePattern: 'NONE',
      rejectionWickRatio: 0,
      isRejectionAtKeyLevel: false,
      description: 'Nến có biên độ bằng 0.',
    }
  }

  const bodyRange = Math.abs(curr.close - curr.open)
  const lowerWick = Math.min(curr.open, curr.close) - curr.low
  const upperWick = curr.high - Math.max(curr.open, curr.close)

  const lowerWickRatio = lowerWick / totalRange
  const upperWickRatio = upperWick / totalRange

  // Bullish Pinbar: Lower wick >= 55% of range and body in top 40%
  if (lowerWickRatio >= 0.55 && curr.close >= curr.low + totalRange * 0.6) {
    return {
      candlePattern: 'BULLISH_PINBAR',
      rejectionWickRatio: Number(lowerWickRatio.toFixed(2)),
      isRejectionAtKeyLevel: true,
      description: `Nến Pinbar rút chân tăng mạnh (Râu dưới chiếm ${(lowerWickRatio * 100).toFixed(0)}% thân nến).`,
    }
  }

  // Bearish Pinbar: Upper wick >= 55% of range and body in bottom 40%
  if (upperWickRatio >= 0.55 && curr.close <= curr.low + totalRange * 0.4) {
    return {
      candlePattern: 'BEARISH_PINBAR',
      rejectionWickRatio: Number(upperWickRatio.toFixed(2)),
      isRejectionAtKeyLevel: true,
      description: `Nến Pinbar từ chối giá giảm mạnh (Râu trên chiếm ${(upperWickRatio * 100).toFixed(0)}% thân nến).`,
    }
  }

  // Bullish Engulfing
  if (
    prev.close < prev.open &&
    curr.close > curr.open &&
    curr.close >= prev.open &&
    curr.open <= prev.close
  ) {
    return {
      candlePattern: 'BULLISH_ENGULFING',
      rejectionWickRatio: 0,
      isRejectionAtKeyLevel: true,
      description: 'Mô hình nến Nhấn Chìm Tăng (Bullish Engulfing) bao trọn nến giảm trước đó.',
    }
  }

  // Bearish Engulfing
  if (
    prev.close > prev.open &&
    curr.close < curr.open &&
    curr.close <= prev.open &&
    curr.open >= prev.close
  ) {
    return {
      candlePattern: 'BEARISH_ENGULFING',
      rejectionWickRatio: 0,
      isRejectionAtKeyLevel: true,
      description: 'Mô hình nến Nhấn Chìm Giảm (Bearish Engulfing) bao trọn nến tăng trước đó.',
    }
  }

  // Doji
  if (bodyRange / totalRange < 0.1) {
    return {
      candlePattern: 'DOJI',
      rejectionWickRatio: 0,
      isRejectionAtKeyLevel: false,
      description: 'Nến Doji thể hiện sự lưỡng lự giằng co giữa hai phe.',
    }
  }

  return {
    candlePattern: 'NONE',
    rejectionWickRatio: 0,
    isRejectionAtKeyLevel: false,
    description: 'Chưa xuất hiện mô hình nến đảo chiều đặc biệt.',
  }
}

/**
 * 3. RSI Multi-Timeframe Momentum & Divergence Detection
 * Computes Wilder's RSI and checks for Regular Bullish/Bearish Divergence
 */
export function detectRSIDivergence(
  candles: SMCCandle[],
  period: number = 14
): RSIDivergence {
  if (!candles || candles.length < period + 5) {
    return {
      type: 'NONE',
      currentRsi: 50,
      priorRsi: 50,
      isOverbought: false,
      isOversold: false,
      description: 'Chưa đủ nến để tính RSI phân kỳ.',
    }
  }

  const closes = candles.map((c) => c.close)
  const rsiValues = calculateRSI(closes, period)
  const currentRsi = rsiValues[rsiValues.length - 1] || 50

  const isOverbought = currentRsi >= 70
  const isOversold = currentRsi <= 30

  // Scan last 15 candles for local price swing lows and highs
  const lookback = Math.min(20, candles.length - 1)
  const recentCandles = candles.slice(-lookback)
  const recentRsis = rsiValues.slice(-lookback)

  // Find lowest price and lowest RSI in recent window
  let minPriceIdx = 0
  let maxPriceIdx = 0
  for (let i = 0; i < recentCandles.length - 1; i++) {
    if (recentCandles[i].low < recentCandles[minPriceIdx].low) minPriceIdx = i
    if (recentCandles[i].high > recentCandles[maxPriceIdx].high) maxPriceIdx = i
  }

  const lastCandle = recentCandles[recentCandles.length - 1]
  const lastRsi = recentRsis[recentRsis.length - 1]

  // Regular Bullish Divergence: Current Low is lower/equal, but RSI is significantly higher
  if (
    lastCandle.low <= recentCandles[minPriceIdx].low + 0.5 &&
    lastRsi > recentRsis[minPriceIdx] + 3.0 &&
    minPriceIdx < recentCandles.length - 2
  ) {
    return {
      type: 'BULLISH_REGULAR',
      currentRsi,
      priorRsi: recentRsis[minPriceIdx],
      isOverbought,
      isOversold,
      description: `Phân kỳ dương RSI (Regular Bullish Divergence): Giá tạo đáy ngang/thấp nhưng RSI tăng từ ${recentRsis[minPriceIdx].toFixed(1)} lên ${currentRsi.toFixed(1)}.`,
    }
  }

  // Regular Bearish Divergence: Current High is higher/equal, but RSI is lower
  if (
    lastCandle.high >= recentCandles[maxPriceIdx].high - 0.5 &&
    lastRsi < recentRsis[maxPriceIdx] - 3.0 &&
    maxPriceIdx < recentCandles.length - 2
  ) {
    return {
      type: 'BEARISH_REGULAR',
      currentRsi,
      priorRsi: recentRsis[maxPriceIdx],
      isOverbought,
      isOversold,
      description: `Phân kỳ âm RSI (Regular Bearish Divergence): Giá tạo đỉnh cao nhưng RSI suy yếu từ ${recentRsis[maxPriceIdx].toFixed(1)} về ${currentRsi.toFixed(1)}.`,
    }
  }

  return {
    type: 'NONE',
    currentRsi,
    priorRsi: currentRsi,
    isOverbought,
    isOversold,
    description: `RSI(14) đạt ${currentRsi.toFixed(1)}${
      isOversold ? ' (Vùng Quá Bán < 30)' : isOverbought ? ' (Vùng Quá Mua > 70)' : ' (Vùng Trung Lập)'
    }.`,
  }
}

/**
 * 4. Helper Hash Generator for API Anti-Spam Deduplication
 */
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0 // Convert to 32bit integer
  }
  return `hash_${Math.abs(hash).toString(16)}`
}

/**
 * 5. Main Technical Confluence Evaluation Engine
 * Synthesizes Price Action + SMC + ICT + RSI into a single institutional report
 */
export function evaluateTechnicalConfluence(
  candles: SMCCandle[],
  currentPrice: number,
  symbol: string = 'XAU/USD',
  timeframe: string = 'M15'
): TechnicalConfluenceReport {
  const latestCandle = candles[candles.length - 1]
  const timestamp = latestCandle?.time || Math.floor(Date.now() / 1000)

  // 1. Session Killzone
  const kz = getICTKillzone(timestamp)

  // 2. SMC Structure
  const smc = analyzeSMCStructure(candles, currentPrice, symbol)

  // 3. Price Action
  const pa = detectPriceActionPattern(candles)

  // 4. RSI Divergence
  const rsi = detectRSIDivergence(candles, 14)

  // 5. Confluence Scoring Matrix (0 - 100)
  let score = 0
  const reasons: string[] = []
  let bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL'

  let bullPoints = 0
  let bearPoints = 0

  // A. SMC Liquidity Sweeps (+25 max)
  const lastSwept = smc.liquidityPools.slice().reverse().find((p) => p.isSwept)
  if (lastSwept) {
    if (lastSwept.type === 'SSL') {
      bullPoints += 25
      reasons.push(`Quét sạch thanh khoản đáy SSL tại $${lastSwept.price.toFixed(2)} (Săn thanh khoản phe Bán).`)
    } else {
      bearPoints += 25
      reasons.push(`Quét sạch thanh khoản đỉnh BSL tại $${lastSwept.price.toFixed(2)} (Săn thanh khoản phe Mua).`)
    }
  }

  // B. SMC Structure Break (+25 max)
  const lastBreak = smc.structureBreaks[smc.structureBreaks.length - 1]
  if (lastBreak) {
    if (lastBreak.direction === 'BULLISH') {
      bullPoints += 25
      reasons.push(`Đổi cấu trúc tăng ${lastBreak.type} ↑ tại $${lastBreak.level.toFixed(2)}.`)
    } else {
      bearPoints += 25
      reasons.push(`Đổi cấu trúc giảm ${lastBreak.type} ↓ tại $${lastBreak.level.toFixed(2)}.`)
    }
  }

  // C. Order Block & FVG Retest (+20 max)
  if (smc.activeSetup.orderBlock) {
    if (smc.activeSetup.orderBlock.type === 'BULLISH') {
      bullPoints += 20
      reasons.push(`Giá kiểm định lại Bullish Order Block [$${smc.activeSetup.orderBlock.bottom.toFixed(2)} - $${smc.activeSetup.orderBlock.top.toFixed(2)}].`)
    } else {
      bearPoints += 20
      reasons.push(`Giá kiểm định lại Bearish Order Block [$${smc.activeSetup.orderBlock.bottom.toFixed(2)} - $${smc.activeSetup.orderBlock.top.toFixed(2)}].`)
    }
  } else if (smc.activeSetup.fvg) {
    if (smc.activeSetup.fvg.type === 'BULLISH') {
      bullPoints += 15
      reasons.push(`Bật tăng từ vùng Fair Value Gap Bullish [$${smc.activeSetup.fvg.bottom.toFixed(2)} - $${smc.activeSetup.fvg.top.toFixed(2)}].`)
    } else {
      bearPoints += 15
      reasons.push(`Bị từ chối từ vùng Fair Value Gap Bearish [$${smc.activeSetup.fvg.bottom.toFixed(2)} - $${smc.activeSetup.fvg.top.toFixed(2)}].`)
    }
  }

  // D. Price Action Candlestick (+15 max)
  if (pa.candlePattern === 'BULLISH_PINBAR' || pa.candlePattern === 'BULLISH_ENGULFING') {
    bullPoints += 15
    reasons.push(pa.description)
  } else if (pa.candlePattern === 'BEARISH_PINBAR' || pa.candlePattern === 'BEARISH_ENGULFING') {
    bearPoints += 15
    reasons.push(pa.description)
  }

  // E. RSI Divergence / Overextended (+15 max)
  if (rsi.type === 'BULLISH_REGULAR' || (rsi.isOversold && bullPoints > 0)) {
    bullPoints += 15
    reasons.push(rsi.description)
  } else if (rsi.type === 'BEARISH_REGULAR' || (rsi.isOverbought && bearPoints > 0)) {
    bearPoints += 15
    reasons.push(rsi.description)
  }

  // F. Session Killzone Boost (+10 bonus if active)
  if (kz.isActive) {
    if (bullPoints > bearPoints) bullPoints += 10
    else if (bearPoints > bullPoints) bearPoints += 10
    reasons.push(`Trùng phiên giao dịch quan trọng: ${kz.name}.`)
  }

  // Determine final score and bias
  if (bullPoints >= bearPoints && bullPoints >= 45) {
    bias = 'BULLISH'
    score = Math.min(100, bullPoints)
  } else if (bearPoints > bullPoints && bearPoints >= 45) {
    bias = 'BEARISH'
    score = Math.min(100, bearPoints)
  } else {
    bias = 'NEUTRAL'
    score = Math.max(bullPoints, bearPoints, 35)
  }

  // 6. Generate State Hash for API Anti-Spam Caching
  const stateSignature = `${symbol}_${timeframe}_${latestCandle?.time || 0}_${lastSwept?.id || 'none'}_${lastBreak?.id || 'none'}_${pa.candlePattern}_${bias}_${kz.killzone}`
  const stateHash = simpleHash(stateSignature)

  return {
    symbol,
    currentPrice,
    timestamp,
    timeframe,
    killzone: kz.killzone,
    killzoneName: kz.name,
    priceAction: pa,
    smcAnalysis: smc,
    rsiAnalysis: rsi,
    confluenceScore: score,
    bias,
    reasons,
    stateHash,
  }
}
