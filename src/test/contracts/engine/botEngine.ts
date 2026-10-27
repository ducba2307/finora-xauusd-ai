/**
 * Autonomous AI Bot Execution Engine Contract
 * Authoritative reference derived from PROJECT.md (F10) and ORIGINAL_REQUEST.md (R3)
 */

import type { OrderSignal } from './orderLifecycle'

export type BotType = 'SCALPER' | 'GOLD_HUNTER' | 'MACRO_SENTINEL' | 'WHALE_FLOW'

export interface BotInstance {
  id: string
  name: string
  type: BotType
  targetMarket: 'CRYPTO' | 'FOREX'
  symbol: string
  status: 'ACTIVE' | 'PAUSED' | 'LOCKED_BY_CIRCUIT_BREAKER'
  defaultLeverage: number
  riskAllocationUsd: number
  tradesCount: number
}

export const INITIAL_BOT_INSTANCES: BotInstance[] = [
  {
    id: 'bot_scalper_btc',
    name: 'Finora AI HFT Scalper',
    type: 'SCALPER',
    targetMarket: 'CRYPTO',
    symbol: 'BTC/USDT',
    status: 'ACTIVE',
    defaultLeverage: 20,
    riskAllocationUsd: 15000,
    tradesCount: 412,
  },
  {
    id: 'bot_gold_hunter',
    name: 'London/NY Gold Breakout Hunter',
    type: 'GOLD_HUNTER',
    targetMarket: 'FOREX',
    symbol: 'XAU/USD',
    status: 'ACTIVE',
    defaultLeverage: 30,
    riskAllocationUsd: 20000,
    tradesCount: 185,
  },
  {
    id: 'bot_macro_sentinel',
    name: 'Macro Quant Sentinel',
    type: 'MACRO_SENTINEL',
    targetMarket: 'FOREX',
    symbol: 'EUR/USD',
    status: 'ACTIVE',
    defaultLeverage: 50,
    riskAllocationUsd: 10000,
    tradesCount: 94,
  },
  {
    id: 'bot_whale_flow',
    name: 'Institutional Whale Tracker',
    type: 'WHALE_FLOW',
    targetMarket: 'CRYPTO',
    symbol: 'SOL/USDT',
    status: 'ACTIVE',
    defaultLeverage: 10,
    riskAllocationUsd: 12000,
    tradesCount: 78,
  },
]

export function evaluateBotStrategy(
  bot: BotInstance,
  marketInput: {
    price: number
    rsi?: number
    ema20?: number
    ema50?: number
    whaleBias?: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL'
  }
): OrderSignal | null {
  if (bot.status !== 'ACTIVE' || !Number.isFinite(marketInput.price) || marketInput.price <= 0) {
    return null
  }

  const { price, rsi, ema20, ema50, whaleBias } = marketInput

  // 1. SCALPER: Momentum breakout with EMA20 > EMA50 and healthy RSI
  if (bot.type === 'SCALPER') {
    if (ema20 && ema50 && ema20 > ema50 && rsi && rsi > 55 && rsi < 75) {
      return {
        id: `sig_${bot.id}_${Date.now()}`,
        symbol: bot.symbol,
        side: 'BUY',
        size: Number(((bot.riskAllocationUsd * 0.05) / price).toFixed(4)),
        price,
        leverage: bot.defaultLeverage,
        slPrice: Number((price * 0.995).toFixed(2)),
        tpPrice: Number((price * 1.015).toFixed(2)),
        trailingDistance: Number((price * 0.003).toFixed(2)),
        botId: bot.id,
      }
    }
  }

  // 2. GOLD_HUNTER: Volatility breakout on Gold
  if (bot.type === 'GOLD_HUNTER') {
    if (rsi && rsi < 30) {
      // Oversold bounce
      return {
        id: `sig_${bot.id}_${Date.now()}`,
        symbol: bot.symbol,
        side: 'BUY',
        size: 0.5, // 0.5 standard lot
        price,
        leverage: bot.defaultLeverage,
        slPrice: Number((price - 12.0).toFixed(2)),
        tpPrice: Number((price + 25.0).toFixed(2)),
        trailingDistance: 8.0,
        botId: bot.id,
      }
    }
  }

  // 3. MACRO_SENTINEL: Trend following on FX majors
  if (bot.type === 'MACRO_SENTINEL') {
    if (ema20 && ema50 && ema20 < ema50 && rsi && rsi < 45) {
      return {
        id: `sig_${bot.id}_${Date.now()}`,
        symbol: bot.symbol,
        side: 'SELL',
        size: 1.0, // 1 lot
        price,
        leverage: bot.defaultLeverage,
        slPrice: Number((price + 0.0030).toFixed(5)),
        tpPrice: Number((price - 0.0075).toFixed(5)),
        botId: bot.id,
      }
    }
  }

  // 4. WHALE_FLOW: High conviction large order accumulation
  if (bot.type === 'WHALE_FLOW') {
    if (whaleBias === 'ACCUMULATION') {
      return {
        id: `sig_${bot.id}_${Date.now()}`,
        symbol: bot.symbol,
        side: 'BUY',
        size: Number(((bot.riskAllocationUsd * 0.1) / price).toFixed(2)),
        price,
        leverage: bot.defaultLeverage,
        slPrice: Number((price * 0.96).toFixed(2)),
        tpPrice: Number((price * 1.10).toFixed(2)),
        botId: bot.id,
      }
    }
  }

  return null
}
