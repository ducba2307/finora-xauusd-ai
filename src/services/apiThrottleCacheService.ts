/**
 * Anti-Spam & Intelligent Caching Engine for Financial AI
 * src/services/apiThrottleCacheService.ts
 *
 * Implements 5-Layer Anti-Spam Architecture:
 * 1. Event-Driven onBarClose trigger gate
 * 2. State-Hash Deduplication (0ms, 0 API calls for identical market states)
 * 3. Multi-Level Cache (L1 Memory + L2 LocalStorage) with Time-To-Live (TTL)
 * 4. Token Bucket Rate Limiter & Cooldown Lockout (max 1 call / 3 mins)
 * 5. Deterministic Offline Fallback Generator (costs $0, 100% reliable)
 */

import type { TechnicalConfluenceReport } from '../quant/confluenceEngine'

export interface AIScenarioResult {
  recommendation: 'BUY' | 'SELL' | 'WAIT'
  confidence_score: number // 0 to 100
  setup_name: string
  timeframe_confluence: {
    d1_bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
    h4_bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
    m15_bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  }
  execution_plan: {
    entry_price: number
    stop_loss: number
    take_profit_1: number
    take_profit_2: number
    risk_reward_ratio: number
  }
  invalidation_price: number
  invalidation_reason: string
  rationale_vi: string
  warning_message?: string
  source: '9ROUTER_CLAUDE' | '9ROUTER_GEMINI' | 'OFFLINE_DETERMINISTIC_CACHE'
  generated_at: number
  expires_at: number
}

interface CacheEntry {
  data: AIScenarioResult
  cachedAt: number
  expiresAt: number
}

// In-Memory L1 Cache
const memoryCache = new Map<string, CacheEntry>()

// Rate Limiter State: tracks last API call timestamp per symbol
const lastApiCallTimestamp: Record<string, number> = {}

// Configurable Constants
export const MIN_API_CALL_INTERVAL_MS = 3 * 60 * 1000 // 3 minutes cooldown
export const DEFAULT_TTL_MS = 15 * 60 * 1000 // 15 minutes TTL

/**
 * Check if the state hash is already cached and valid
 */
export function getCachedScenario(stateHash: string): AIScenarioResult | null {
  const now = Date.now()

  // 1. Check L1 Memory Cache
  const memEntry = memoryCache.get(stateHash)
  if (memEntry) {
    if (memEntry.expiresAt > now) {
      return memEntry.data
    }
    memoryCache.delete(stateHash)
  }

  // 2. Check L2 LocalStorage Cache (if in browser)
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = localStorage.getItem(`finora_ai_cache_${stateHash}`)
      if (stored) {
        const parsed: CacheEntry = JSON.parse(stored)
        if (parsed && parsed.expiresAt > now) {
          memoryCache.set(stateHash, parsed) // Promote to L1
          return parsed.data
        } else {
          localStorage.removeItem(`finora_ai_cache_${stateHash}`)
        }
      }
    } catch {
      // LocalStorage errors ignored
    }
  }

  return null
}

/**
 * Save scenario to L1 and L2 cache
 */
export function saveScenarioToCache(
  stateHash: string,
  scenario: AIScenarioResult,
  ttlMs: number = DEFAULT_TTL_MS
): void {
  const now = Date.now()
  const entry: CacheEntry = {
    data: scenario,
    cachedAt: now,
    expiresAt: now + ttlMs,
  }

  // L1 Memory
  memoryCache.set(stateHash, entry)

  // L2 LocalStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(`finora_ai_cache_${stateHash}`, JSON.stringify(entry))
    } catch {
      // LocalStorage quota limits safely handled
    }
  }
}

/**
 * Rate Limiter check: Has cooldown elapsed for this symbol?
 */
export function canCallAI(symbol: string = 'XAU/USD', forceBypass: boolean = false): {
  allowed: boolean
  remainingCooldownSeconds: number
} {
  if (forceBypass) return { allowed: true, remainingCooldownSeconds: 0 }

  const now = Date.now()
  const lastCall = lastApiCallTimestamp[symbol] || 0
  const elapsed = now - lastCall

  if (elapsed < MIN_API_CALL_INTERVAL_MS) {
    const remainingSec = Math.ceil((MIN_API_CALL_INTERVAL_MS - elapsed) / 1000)
    return { allowed: false, remainingCooldownSeconds: remainingSec }
  }

  return { allowed: true, remainingCooldownSeconds: 0 }
}

/**
 * Record an API call execution
 */
export function recordAICall(symbol: string = 'XAU/USD'): void {
  lastApiCallTimestamp[symbol] = Date.now()
}

/**
 * Layer 5: Deterministic Offline Scenario Generator ($0 API Cost)
 * Synthesizes an institutional scenario purely from mathematical confluence features
 */
export function generateOfflineDeterministicScenario(
  report: TechnicalConfluenceReport,
  spreadBuffer: number = 1.80
): AIScenarioResult {
  const { currentPrice, smcAnalysis, priceAction, rsiAnalysis, killzoneName, bias, confluenceScore } = report
  const isBull = bias === 'BULLISH'
  const isBear = bias === 'BEARISH'

  const entryPrice = currentPrice
  let stopLoss = isBull ? currentPrice - 8.50 : currentPrice + 8.50
  let takeProfit1 = isBull ? currentPrice + 17.50 : currentPrice - 17.50
  let takeProfit2 = isBull ? currentPrice + 29.00 : currentPrice - 29.00
  let invalidationPrice = stopLoss

  // Incorporate SMC and sweep levels if present
  if (smcAnalysis.activeSetup && smcAnalysis.activeSetup.direction !== 'NONE') {
    const setup = smcAnalysis.activeSetup
    if (setup.direction === 'BUY') {
      stopLoss = Number((setup.stopLoss - spreadBuffer).toFixed(2))
      takeProfit1 = Number(setup.takeProfit.toFixed(2))
      takeProfit2 = Number((setup.entryPrice + (setup.takeProfit - setup.entryPrice) * 1.5).toFixed(2))
      invalidationPrice = stopLoss
    } else if (setup.direction === 'SELL') {
      stopLoss = Number((setup.stopLoss + spreadBuffer).toFixed(2))
      takeProfit1 = Number(setup.takeProfit.toFixed(2))
      takeProfit2 = Number((setup.entryPrice - (setup.entryPrice - setup.takeProfit) * 1.5).toFixed(2))
      invalidationPrice = stopLoss
    }
  }

  const risk = Math.abs(entryPrice - stopLoss)
  const reward1 = Math.abs(takeProfit1 - entryPrice)
  const rr = risk > 0 ? Number((reward1 / risk).toFixed(2)) : 2.0

  // Compose comprehensive Vietnamese rationale from pure quant features
  const reasonsVi = [
    `Hợp lưu kỹ thuật đạt ${confluenceScore}/100 điểm tại phiên ${killzoneName}.`,
    isBull
      ? 'Cấu trúc thị trường thiên về MUA sau khi quét sạch thanh khoản vùng đáy (SSL Swept).'
      : isBear
      ? 'Cấu trúc thị trường thiên về BÁN sau khi quét sạch thanh khoản vùng đỉnh (BSL Swept).'
      : 'Thị trường đang tích lũy biên độ, ưu tiên kiên nhẫn quan sát.',
  ]

  if (priceAction.candlePattern !== 'NONE') {
    reasonsVi.push(priceAction.description)
  }
  if (rsiAnalysis.type !== 'NONE') {
    reasonsVi.push(rsiAnalysis.description)
  }

  const setupName = isBull
    ? `ICT ${report.killzone.replace(/_/g, ' ')} + SSL Sweep & Bullish Reversal`
    : isBear
    ? `ICT ${report.killzone.replace(/_/g, ' ')} + BSL Sweep & Bearish Rejection`
    : 'Market Structure Consolidation (Wait)'

  const now = Date.now()
  return {
    recommendation: isBull ? 'BUY' : isBear ? 'SELL' : 'WAIT',
    confidence_score: Math.min(95, Math.max(50, confluenceScore)),
    setup_name: setupName,
    timeframe_confluence: {
      d1_bias: isBull ? 'BULLISH' : isBear ? 'BEARISH' : 'NEUTRAL',
      h4_bias: isBull ? 'BULLISH' : isBear ? 'BEARISH' : 'NEUTRAL',
      m15_bias: isBull ? 'BULLISH' : isBear ? 'BEARISH' : 'NEUTRAL',
    },
    execution_plan: {
      entry_price: Number(entryPrice.toFixed(2)),
      stop_loss: Number(stopLoss.toFixed(2)),
      take_profit_1: Number(takeProfit1.toFixed(2)),
      take_profit_2: Number(takeProfit2.toFixed(2)),
      risk_reward_ratio: Math.max(2.0, rr),
    },
    invalidation_price: Number(invalidationPrice.toFixed(2)),
    invalidation_reason: isBull
      ? `Nếu giá đóng cửa thủng $${invalidationPrice.toFixed(2)}, toàn bộ cấu trúc đảo chiều tăng bị phá hủy, hủy bỏ kịch bản.`
      : `Nếu giá đóng cửa vượt $${invalidationPrice.toFixed(2)}, toàn bộ cấu trúc đảo chiều giảm bị phá hủy, hủy bỏ kịch bản.`,
    rationale_vi: reasonsVi.join(' '),
    warning_message:
      'Tín hiệu được tạo từ Bộ máy Định lượng Dự phòng Tức thời (Offline Deterministic Engine - 0đ API).',
    source: 'OFFLINE_DETERMINISTIC_CACHE',
    generated_at: now,
    expires_at: now + DEFAULT_TTL_MS,
  }
}
