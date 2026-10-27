/**
 * AI Multi-Model Scenario Orchestrator
 * src/services/aiScenarioEngine.ts
 *
 * Coordinates Layer 1 (Confluence Engine), Layer 2 (9Router + Anti-Spam Cache),
 * and Layer 3 (Risk & Spread Gating).
 */

import type { TechnicalConfluenceReport } from '../quant/confluenceEngine'
import {
  getCachedScenario,
  saveScenarioToCache,
  canCallAI,
  recordAICall,
  generateOfflineDeterministicScenario,
  type AIScenarioResult,
} from './apiThrottleCacheService'
import { call9RouterWithFallback } from './nineRouterService'

/**
 * Main Entry Point for obtaining an AI Scenario
 * Fully protected by 5-layer anti-spam & caching architecture
 */
export async function getOrGenerateAIScenario(
  report: TechnicalConfluenceReport,
  forceRefresh: boolean = false
): Promise<AIScenarioResult> {
  // 1. Layer 2 Check: State-Hash Deduplication Cache
  if (!forceRefresh) {
    const cached = getCachedScenario(report.stateHash)
    if (cached) {
      return cached
    }
  }

  // 2. Layer 4 Check: Token Bucket Rate Limiter
  const rateLimit = canCallAI(report.symbol, forceRefresh)
  if (!rateLimit.allowed) {
    // Cooldown active, generate instant deterministic offline scenario
    const offlineScenario = generateOfflineDeterministicScenario(report)
    offlineScenario.warning_message = `Đang trong thời gian giãn cách API (${rateLimit.remainingCooldownSeconds}s còn lại). Hiển thị kịch bản định lượng nội bộ.`
    saveScenarioToCache(report.stateHash, offlineScenario, 60 * 1000)
    return offlineScenario
  }

  // 3. Assemble Quantitative Feature Dossier Payload
  const featurePayload = {
    symbol: report.symbol,
    current_price: report.currentPrice,
    timestamp: report.timestamp,
    timeframe: report.timeframe,
    killzone: report.killzoneName,
    confluence_score: report.confluenceScore,
    market_bias: report.bias,
    price_action: {
      candle_pattern: report.priceAction.candlePattern,
      description: report.priceAction.description,
      rejection_wick_ratio: report.priceAction.rejectionWickRatio,
    },
    smc_structure: {
      market_bias: report.smcAnalysis.summary.marketBias,
      last_break: report.smcAnalysis.summary.lastBreakType,
      active_bullish_obs: report.smcAnalysis.summary.activeBullishOBsCount,
      active_bearish_obs: report.smcAnalysis.summary.activeBearishOBsCount,
      active_setup: report.smcAnalysis.activeSetup,
    },
    rsi_momentum: {
      current_rsi: report.rsiAnalysis.currentRsi,
      divergence: report.rsiAnalysis.type,
      description: report.rsiAnalysis.description,
    },
    reasons: report.reasons,
  }

  // 4. Dispatch to 9Router Gateway
  try {
    const aiResult = await call9RouterWithFallback(featurePayload)
    if (aiResult) {
      recordAICall(report.symbol)
      saveScenarioToCache(report.stateHash, aiResult)
      return aiResult
    }
  } catch {
    // 9Router network or parsing error caught safely
  }

  // 5. Layer 5 Fallback: Deterministic Offline Generator ($0 API Cost)
  const fallbackScenario = generateOfflineDeterministicScenario(report)
  saveScenarioToCache(report.stateHash, fallbackScenario)
  return fallbackScenario
}
