/**
 * Autonomous AI Bot Execution Engine
 * src/engine/botEngine.ts
 *
 * Implements Feature F10 (Autonomous AI Bot Engine) adhering to Requirement R3.
 * Supports the 4 institutional alpha models:
 * - SCALPER (Neural Alpha Scalper v4 on BTC/USDT)
 * - GOLD_HUNTER (XAUUSD Gold ICT Hunter on XAU/USD)
 * - MACRO_SENTINEL (Macro Sentinel News Bot on EUR/USD)
 * - WHALE_FLOW (Whale Flow Accumulator on SOL/USDT)
 */

import type { MarketCategory } from '../types/trading'
import type { OrderSignal } from './orderLifecycle'
import { defaultMarketStore, type MarketDataStore, type MarketTicker } from '../stores/marketStore'
import { calculateRSI, calculateEMA } from '../quant/indicators'
import type { SMCTradeSetup } from '../quant/smartMoneyConcepts'

export type BotType = 'SCALPER' | 'GOLD_HUNTER' | 'MACRO_SENTINEL' | 'WHALE_FLOW'
export type BotExecutionStatus = 'ACTIVE' | 'PAUSED' | 'LOCKED_BY_CIRCUIT_BREAKER'

export interface BotInstance {
  id: string
  name: string
  type: BotType
  targetMarket: MarketCategory
  symbol: string
  status: BotExecutionStatus
  defaultLeverage: number
  riskAllocationUsd: number
  tradesCount: number
  stopLossPct?: number
  takeProfitPct?: number
  trailingDistance?: number
  cooldownSec?: number
  maxOpenPositions?: number
  activeOrdersCount?: number
  lastSignalTimestamp?: number
}

export interface BotMarketInput {
  price: number
  rsi?: number
  ema20?: number
  ema50?: number
  atr?: number
  macdHistogram?: number
  whaleBias?: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL'
  smcZoneType?: 'BULLISH_FVG' | 'BEARISH_FVG' | 'BULLISH_OB' | 'BEARISH_OB' | 'NONE'
  economicImpact?: 'HIGH' | 'MEDIUM' | 'LOW'
  economicSentiment?: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'VOLATILITY_ALERT'
  smcSetup?: SMCTradeSetup
}

export const INITIAL_BOT_INSTANCES: BotInstance[] = [
  {
    id: 'bot_scalper_btc',
    name: 'Neural Alpha Scalper v4',
    type: 'SCALPER',
    targetMarket: 'CRYPTO',
    symbol: 'BTC/USDT',
    status: 'ACTIVE',
    defaultLeverage: 20,
    riskAllocationUsd: 15000,
    tradesCount: 412,
    stopLossPct: 0.5,
    takeProfitPct: 1.5,
    trailingDistance: 345.0,
    cooldownSec: 15,
    maxOpenPositions: 1,
    activeOrdersCount: 0,
  },
  {
    id: 'bot_gold_hunter',
    name: 'XAUUSD Gold ICT Hunter',
    type: 'GOLD_HUNTER',
    targetMarket: 'FOREX',
    symbol: 'XAU/USD',
    status: 'ACTIVE',
    defaultLeverage: 30,
    riskAllocationUsd: 20000,
    tradesCount: 185,
    stopLossPct: 0.44,
    takeProfitPct: 0.92,
    trailingDistance: 8.0,
    cooldownSec: 30,
    maxOpenPositions: 1,
    activeOrdersCount: 0,
  },
  {
    id: 'bot_macro_sentinel',
    name: 'Macro Sentinel News Bot',
    type: 'MACRO_SENTINEL',
    targetMarket: 'FOREX',
    symbol: 'EUR/USD',
    status: 'ACTIVE',
    defaultLeverage: 50,
    riskAllocationUsd: 10000,
    tradesCount: 94,
    stopLossPct: 0.28,
    takeProfitPct: 0.70,
    trailingDistance: 0.0020,
    cooldownSec: 60,
    maxOpenPositions: 1,
    activeOrdersCount: 0,
  },
  {
    id: 'bot_whale_flow',
    name: 'Whale Flow Accumulator',
    type: 'WHALE_FLOW',
    targetMarket: 'CRYPTO',
    symbol: 'SOL/USDT',
    status: 'ACTIVE',
    defaultLeverage: 10,
    riskAllocationUsd: 12000,
    tradesCount: 78,
    stopLossPct: 4.0,
    takeProfitPct: 10.0,
    trailingDistance: 4.85,
    cooldownSec: 45,
    maxOpenPositions: 1,
    activeOrdersCount: 0,
  },
]

/**
 * Pure strategy evaluation function for the 4 alpha models.
 */
export function evaluateBotStrategy(
  bot: BotInstance,
  marketInput: BotMarketInput
): OrderSignal | null {
  if (bot.status !== 'ACTIVE' || !Number.isFinite(marketInput.price) || marketInput.price <= 0) {
    return null
  }

  const { price, rsi, ema20, ema50, whaleBias } = marketInput
  const now = Date.now()

  // 1. SCALPER: Momentum breakout with EMA20 > EMA50 and healthy RSI band (55..75)
  if (bot.type === 'SCALPER') {
    if (ema20 && ema50 && ema20 > ema50 && rsi && rsi > 55 && rsi < 75) {
      const size = Number(((bot.riskAllocationUsd * 0.05) / price).toFixed(4))
      if (size <= 0 || !Number.isFinite(size)) return null
      return {
        id: `sig_${bot.id}_${now}`,
        symbol: bot.symbol,
        side: 'BUY',
        size,
        price,
        leverage: bot.defaultLeverage,
        slPrice: Number((price * 0.995).toFixed(2)),
        tpPrice: Number((price * 1.015).toFixed(2)),
        trailingDistance: Number((price * 0.003).toFixed(2)),
        botId: bot.id,
      }
    }
  }

  // 2. GOLD_HUNTER: Institutional Smart Money Concepts (SMC Gate Pass) or Volatility Bounce
  if (bot.type === 'GOLD_HUNTER') {
    // A. Institutional Smart Money Concepts Gate Pass execution (Sweep + CHoCH + OB/FVG)
    if (
      marketInput.smcSetup &&
      marketInput.smcSetup.gateStatus === 'GATE_PASS' &&
      marketInput.smcSetup.direction !== 'NONE'
    ) {
      const isBuy = marketInput.smcSetup.direction === 'BUY'
      return {
        id: `sig_${bot.id}_${now}`,
        symbol: bot.symbol,
        side: isBuy ? 'BUY' : 'SELL',
        size: 0.5,
        price,
        leverage: bot.defaultLeverage,
        slPrice: marketInput.smcSetup.stopLoss,
        tpPrice: marketInput.smcSetup.takeProfit,
        trailingDistance: 8.0,
        botId: bot.id,
      }
    }

    // B. Mean-reversion volatility bounce on oversold/overbought conditions
    if (rsi && rsi < 30) {
      return {
        id: `sig_${bot.id}_${now}`,
        symbol: bot.symbol,
        side: 'BUY',
        size: 0.5,
        price,
        leverage: bot.defaultLeverage,
        slPrice: Number((price - 12.0).toFixed(2)),
        tpPrice: Number((price + 25.0).toFixed(2)),
        trailingDistance: 8.0,
        botId: bot.id,
      }
    }
    if (rsi && rsi > 70) {
      return {
        id: `sig_${bot.id}_${now}`,
        symbol: bot.symbol,
        side: 'SELL',
        size: 0.5,
        price,
        leverage: bot.defaultLeverage,
        slPrice: Number((price + 12.0).toFixed(2)),
        tpPrice: Number((price - 25.0).toFixed(2)),
        trailingDistance: 8.0,
        botId: bot.id,
      }
    }
  }

  // 3. MACRO_SENTINEL: Trend following breakdown on Forex majors (EMA20 < EMA50 & RSI < 45)
  if (bot.type === 'MACRO_SENTINEL') {
    if (ema20 && ema50 && ema20 < ema50 && rsi && rsi < 45) {
      return {
        id: `sig_${bot.id}_${now}`,
        symbol: bot.symbol,
        side: 'SELL',
        size: 1.0,
        price,
        leverage: bot.defaultLeverage,
        slPrice: Number((price + 0.0030).toFixed(5)),
        tpPrice: Number((price - 0.0075).toFixed(5)),
        botId: bot.id,
      }
    }
    if (ema20 && ema50 && ema20 > ema50 && rsi && rsi > 55) {
      return {
        id: `sig_${bot.id}_${now}`,
        symbol: bot.symbol,
        side: 'BUY',
        size: 1.0,
        price,
        leverage: bot.defaultLeverage,
        slPrice: Number((price - 0.0030).toFixed(5)),
        tpPrice: Number((price + 0.0075).toFixed(5)),
        botId: bot.id,
      }
    }
  }

  // 4. WHALE_FLOW: High conviction large order accumulation / distribution
  if (bot.type === 'WHALE_FLOW') {
    if (whaleBias === 'ACCUMULATION') {
      const size = Number(((bot.riskAllocationUsd * 0.1) / price).toFixed(2))
      if (size <= 0 || !Number.isFinite(size)) return null
      return {
        id: `sig_${bot.id}_${now}`,
        symbol: bot.symbol,
        side: 'BUY',
        size,
        price,
        leverage: bot.defaultLeverage,
        slPrice: Number((price * 0.96).toFixed(2)),
        tpPrice: Number((price * 1.10).toFixed(2)),
        trailingDistance: Number((price * 0.025).toFixed(2)),
        botId: bot.id,
      }
    }
    if (whaleBias === 'DISTRIBUTION') {
      const size = Number(((bot.riskAllocationUsd * 0.1) / price).toFixed(2))
      if (size <= 0 || !Number.isFinite(size)) return null
      return {
        id: `sig_${bot.id}_${now}`,
        symbol: bot.symbol,
        side: 'SELL',
        size,
        price,
        leverage: bot.defaultLeverage,
        slPrice: Number((price * 1.04).toFixed(2)),
        tpPrice: Number((price * 0.90).toFixed(2)),
        trailingDistance: Number((price * 0.025).toFixed(2)),
        botId: bot.id,
      }
    }
  }

  return null
}

/**
 * Stateful Execution Engine running tick-by-tick alpha evaluation.
 */
export class BotExecutionEngine {
  private bots: Map<string, BotInstance> = new Map()
  private priceHistory: Map<string, number[]> = new Map()
  private lastSignalTimes: Map<string, number> = new Map()
  private signalListeners: Set<(signal: OrderSignal) => void> = new Set()
  private unsubscribeFeed: (() => void) | null = null
  private isEvaluating: boolean = false
  public readonly MAX_HISTORY_LEN = 100

  constructor(initialBots: BotInstance[] = INITIAL_BOT_INSTANCES) {
    for (const b of initialBots) {
      this.bots.set(b.id, { ...b })
    }
  }

  public start(marketStore: MarketDataStore = defaultMarketStore): void {
    if (this.unsubscribeFeed) return
    this.unsubscribeFeed = marketStore.subscribeAll((tickers) => {
      this.handleMarketTick(tickers)
    })
  }

  public stop(): void {
    if (this.unsubscribeFeed) {
      this.unsubscribeFeed()
      this.unsubscribeFeed = null
    }
    this.isEvaluating = false
  }

  public toggleBot(botId: string): void {
    const bot = this.bots.get(botId) || Array.from(this.bots.values()).find((b) => b.id === botId || b.type === botId)
    if (!bot) return
    const nextStatus: BotExecutionStatus = bot.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    bot.status = nextStatus
    this.bots.set(bot.id, bot)
  }

  public lockAllBots(): void {
    for (const bot of this.bots.values()) {
      if (bot.status === 'ACTIVE') {
        bot.status = 'LOCKED_BY_CIRCUIT_BREAKER'
      }
    }
  }

  public unlockAllBots(): void {
    for (const bot of this.bots.values()) {
      if (bot.status === 'LOCKED_BY_CIRCUIT_BREAKER') {
        bot.status = 'ACTIVE'
      }
    }
  }

  public getBots(): BotInstance[] {
    return Array.from(this.bots.values())
  }

  public getBot(idOrType: string): BotInstance | undefined {
    return this.bots.get(idOrType) || Array.from(this.bots.values()).find((b) => b.id === idOrType || b.type === idOrType)
  }

  public subscribeSignals(listener: (signal: OrderSignal) => void): () => void {
    this.signalListeners.add(listener)
    return () => {
      this.signalListeners.delete(listener)
    }
  }

  public handleMarketTick(tickers: Record<string, MarketTicker>): void {
    if (this.isEvaluating || !tickers) return
    this.isEvaluating = true

    try {
      const now = Date.now()

      // 1. Update rolling price history buffers for all tracked bot symbols
      // Process on every tick BEFORE checking bot cooldown, filtering with Number.isFinite
      const trackedSymbols = new Set<string>()
      for (const bot of this.bots.values()) {
        trackedSymbols.add(bot.symbol)
      }

      for (const symbol of trackedSymbols) {
        const ticker = tickers[symbol]
        if (!ticker || !Number.isFinite(ticker.midPrice) || ticker.midPrice <= 0) {
          continue
        }

        let history = this.priceHistory.get(symbol)
        if (!history) {
          history = [ticker.midPrice]
          this.priceHistory.set(symbol, history)
        } else {
          history.push(ticker.midPrice)
          if (history.length > this.MAX_HISTORY_LEN) {
            history.shift()
          }
        }
      }

      // 2. Evaluate strategy rules for active bots
      for (const bot of this.bots.values()) {
        if (bot.status !== 'ACTIVE') continue

        // 1. Cooldown check
        const cooldownMs = (bot.cooldownSec ?? 30) * 1000
        const lastSignal = this.lastSignalTimes.get(bot.id) ?? 0
        if (now - lastSignal < cooldownMs) continue

        // 2. Open positions limit check
        if ((bot.activeOrdersCount ?? 0) >= (bot.maxOpenPositions ?? 1)) continue

        // 3. Ticker lookup
        const ticker = tickers[bot.symbol]
        if (!ticker || !Number.isFinite(ticker.midPrice) || ticker.midPrice <= 0) continue

        // 4. Point-in-time indicator calculation from unfragmented rolling history
        const history = this.priceHistory.get(bot.symbol) || [ticker.midPrice]
        const rsiSeries = calculateRSI(history, 14)
        const currentRsi = rsiSeries.length > 0 ? (rsiSeries[rsiSeries.length - 1] ?? 50) : 50
        const ema20Series = calculateEMA(history, 20)
        const currentEma20 = ema20Series.length > 0 ? (ema20Series[ema20Series.length - 1] ?? ticker.midPrice) : ticker.midPrice
        const ema50Series = calculateEMA(history, 50)
        const currentEma50 = ema50Series.length > 0 ? (ema50Series[ema50Series.length - 1] ?? ticker.midPrice) : ticker.midPrice

        // 5. Evaluate Strategy
        const signal = evaluateBotStrategy(bot, {
          price: ticker.midPrice,
          rsi: currentRsi,
          ema20: currentEma20,
          ema50: currentEma50,
          whaleBias: bot.type === 'WHALE_FLOW' ? 'ACCUMULATION' : undefined,
        })

        if (signal) {
          this.lastSignalTimes.set(bot.id, now)
          this.signalListeners.forEach((fn) => {
            try { fn(signal) } catch { /* listener error protection */ }
          })
        }
      }
    } finally {
      this.isEvaluating = false
    }
  }
}

export const defaultBotEngine = new BotExecutionEngine()
