/**
 * Institutional Market Data Simulator & ECN Calibration Engine
 * 
 * Provides:
 * - Geometric Brownian Motion (GBM) tick generation with session-aware volatility
 * - Institutional dynamic spreads per asset (Forex, Gold, Crypto)
 * - Safe EMA calculation (closed bars only + provisional preview)
 * - Clean candle interval timestamp alignment
 * - Institutional L2 Order Book depth generation
 */

import type { OrderBook } from '../types/trading'

export interface AssetConfig {
  pipSize: number
  minSpreadPips: number
  maxSpreadPips: number
  defaultSpreadPips: number
  annualVol: number
  digits: number
  isForex: boolean
}

export const ASSET_CONFIGS: Record<string, AssetConfig> = {
  'XAU/USD': {
    pipSize: 0.1, // 1 pip = $0.10
    minSpreadPips: 1.2,
    maxSpreadPips: 2.5,
    defaultSpreadPips: 1.8,
    annualVol: 0.16,
    digits: 2,
    isForex: true,
  },
  'EUR/USD': {
    pipSize: 0.0001, // 1 pip = 0.0001
    minSpreadPips: 0.2,
    maxSpreadPips: 0.4,
    defaultSpreadPips: 0.3,
    annualVol: 0.08,
    digits: 5,
    isForex: true,
  },
  'GBP/USD': {
    pipSize: 0.0001,
    minSpreadPips: 0.3,
    maxSpreadPips: 0.6,
    defaultSpreadPips: 0.45,
    annualVol: 0.10,
    digits: 5,
    isForex: true,
  },
  'USD/JPY': {
    pipSize: 0.01,
    minSpreadPips: 0.3,
    maxSpreadPips: 0.5,
    defaultSpreadPips: 0.4,
    annualVol: 0.09,
    digits: 3,
    isForex: true,
  },
  'BTC/USDT': {
    pipSize: 1.0,
    minSpreadPips: 1.5,
    maxSpreadPips: 3.0,
    defaultSpreadPips: 2.0,
    annualVol: 0.55,
    digits: 2,
    isForex: false,
  },
  'ETH/USDT': {
    pipSize: 0.1, // $0.15 - $0.30 spread = 1.5 - 3.0 pips
    minSpreadPips: 1.5,
    maxSpreadPips: 3.0,
    defaultSpreadPips: 2.0,
    annualVol: 0.65,
    digits: 2,
    isForex: false,
  },
  'SOL/USDT': {
    pipSize: 0.01, // $0.03 - $0.08 spread = 3.0 - 8.0 pips
    minSpreadPips: 3.0,
    maxSpreadPips: 8.0,
    defaultSpreadPips: 5.0,
    annualVol: 0.75,
    digits: 2,
    isForex: false,
  },
}

export function getAssetConfig(symbol: string): AssetConfig {
  const clean = symbol.toUpperCase().trim()
  if (ASSET_CONFIGS[clean]) return ASSET_CONFIGS[clean]

  for (const [key, cfg] of Object.entries(ASSET_CONFIGS)) {
    if (clean.includes(key.replace('/', '')) || key.includes(clean)) {
      return cfg
    }
  }

  const isFx = clean.includes('EUR') || clean.includes('GBP') || clean.includes('JPY') || clean.includes('XAU')
  const isJpy = clean.includes('JPY')

  return {
    pipSize: isFx ? (isJpy ? 0.01 : 0.0001) : 1.0,
    minSpreadPips: isFx ? 0.3 : 1.5,
    maxSpreadPips: isFx ? 0.6 : 3.0,
    defaultSpreadPips: isFx ? 0.4 : 2.0,
    annualVol: isFx ? 0.10 : 0.50,
    digits: isFx ? (isJpy ? 3 : 5) : 2,
    isForex: isFx,
  }
}

/**
 * Box-Muller transform for generating standard normal random variables Z ~ N(0, 1)
 */
export function boxMullerRandom(): number {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

/**
 * Returns session-aware volatility multiplier based on current UTC time:
 * - Asian Session (00:00 - 08:00 UTC): 0.8x
 * - London Open (08:00 - 13:00 UTC): 1.3x
 * - London / NY Overlap (13:00 - 16:30 UTC): 1.6x (Peak intraday liquidity & volatility)
 * - NY Afternoon (16:30 - 21:00 UTC): 1.1x
 * - Pacific / Rollover (21:00 - 24:00 UTC): 0.6x
 */
export function getSessionVolatilityMultiplier(date: Date = new Date()): number {
  const utcHour = date.getUTCHours() + date.getUTCMinutes() / 60

  if (utcHour >= 0 && utcHour < 8) {
    return 0.8
  } else if (utcHour >= 8 && utcHour < 13) {
    return 1.3
  } else if (utcHour >= 13 && utcHour < 16.5) {
    return 1.6
  } else if (utcHour >= 16.5 && utcHour < 21) {
    return 1.1
  } else {
    return 0.6
  }
}

/**
 * Simulates next tick using calibrated Geometric Brownian Motion with Ornstein-Uhlenbeck drift:
 * dS = S * (mu_OU * dt + sigma_eff * sqrt(dt) * Z)
 */
export function simulateNextGBMTick(
  symbol: string,
  currentPrice: number,
  dtSeconds: number = 1.5,
  anchorPrice?: number
): {
  nextPrice: number
  bidPrice: number
  askPrice: number
  spreadPips: number
  spreadUsd: number
} {
  const cfg = getAssetConfig(symbol)
  const sessionMultiplier = getSessionVolatilityMultiplier()
  
  // Annualized seconds: 365.25 * 86400 = 31,557,600
  const dt = dtSeconds / 31557600
  const sigmaEff = cfg.annualVol * sessionMultiplier
  const z = boxMullerRandom()

  // Mild Ornstein-Uhlenbeck mean-reversion drift towards anchor price (reversion speed kappa = 0.08)
  const baseAnchor = anchorPrice && anchorPrice > 0 ? anchorPrice : currentPrice
  const deviation = (baseAnchor - currentPrice) / (baseAnchor || 1)
  const kappa = 0.08
  const drift = kappa * deviation

  const shock = sigmaEff * Math.sqrt(dt) * z
  const priceChange = currentPrice * (drift * dt + shock)

  const rawNext = Math.max(0.00001, currentPrice + priceChange)
  const nextPrice = Number(rawNext.toFixed(cfg.digits))

  // Dynamic spread fluctuation + 1.4x expansion on 2-sigma volatility shock
  const spreadSpread = cfg.maxSpreadPips - cfg.minSpreadPips
  const spreadNoise = (Math.random() + Math.random()) / 2 // Triangular distribution around center
  let spreadPips = cfg.minSpreadPips + spreadSpread * spreadNoise
  if (Math.abs(z) > 2.0) {
    spreadPips = Math.min(cfg.maxSpreadPips * 1.5, spreadPips * 1.4)
  }
  spreadPips = Number(spreadPips.toFixed(1))
  const spreadUsd = Number((spreadPips * cfg.pipSize).toFixed(cfg.digits > 2 ? 5 : 2))

  const halfSpread = spreadUsd / 2
  const bidPrice = Number((nextPrice - halfSpread).toFixed(cfg.digits))
  const askPrice = Number((nextPrice + halfSpread).toFixed(cfg.digits))

  return {
    nextPrice,
    bidPrice,
    askPrice,
    spreadPips,
    spreadUsd,
  }
}

/**
 * Align candle timestamp to clean interval boundaries
 */
export function getTimeframeSeconds(tf: string): number {
  switch (tf) {
    case '1m': return 60
    case '5m': return 300
    case '15m': return 900
    case '1h': case '1H': return 3600
    case '4h': case '4H': return 14400
    case '1d': case '1D': return 86400
    case '1w': case '1W': return 604800
    default: return 3600
  }
}

export function alignTimestampToInterval(timestampSec: number, intervalSec: number): number {
  return Math.floor(timestampSec / intervalSec) * intervalSec
}

/**
 * Mathematical EMA for closed bars
 * alpha = 2 / (period + 1)
 * ema_t = close_t * alpha + ema_{t-1} * (1 - alpha)
 */
export function calculateClosedBarEMA(
  prevClosedEma: number | undefined,
  barClosePrice: number,
  period: number
): number {
  if (prevClosedEma === undefined || isNaN(prevClosedEma)) {
    return barClosePrice
  }
  const alpha = 2 / (period + 1)
  return Number((barClosePrice * alpha + prevClosedEma * (1 - alpha)).toFixed(4))
}

/**
 * Safe Provisional EMA calculation for active intra-bar tick streaming.
 * NEVER mutates or recursively degrades the underlying closed bar EMA!
 */
export function calculateProvisionalEMA(
  lastClosedEma: number | undefined,
  currentTickPrice: number,
  period: number
): number {
  if (lastClosedEma === undefined || isNaN(lastClosedEma)) {
    return currentTickPrice
  }
  const alpha = 2 / (period + 1)
  return Number((currentTickPrice * alpha + lastClosedEma * (1 - alpha)).toFixed(4))
}

/**
 * Generates calibrated institutional L2 Order Book based on exact asset spread
 */
export function generateInstitutionalOrderBook(
  symbol: string,
  midPrice: number,
  levels: number = 8
): OrderBook {
  const cfg = getAssetConfig(symbol)
  const spreadUsd = Number((cfg.defaultSpreadPips * cfg.pipSize).toFixed(cfg.digits > 2 ? 5 : 2))
  const halfSpread = spreadUsd / 2

  // Best ask and best bid
  const bestAsk = Number((midPrice + halfSpread).toFixed(cfg.digits))
  const bestBid = Number((midPrice - halfSpread).toFixed(cfg.digits))

  // Step size for deeper levels
  const step = Math.max(cfg.pipSize, spreadUsd * 0.8)

  const asks = []
  let cumulativeAsk = 0
  for (let i = 0; i < levels; i++) {
    const price = Number((bestAsk + i * step).toFixed(cfg.digits))
    const size = Number((0.2 + Math.random() * (cfg.isForex ? 2.5 : 1.8)).toFixed(3))
    cumulativeAsk += size
    asks.unshift({
      price,
      size,
      total: Number(cumulativeAsk.toFixed(3)),
      depthPct: Math.min(100, Math.round((cumulativeAsk / (levels * 1.5)) * 100)),
    })
  }

  const bids = []
  let cumulativeBid = 0
  for (let i = 0; i < levels; i++) {
    const price = Number((bestBid - i * step).toFixed(cfg.digits))
    const size = Number((0.2 + Math.random() * (cfg.isForex ? 2.5 : 1.8)).toFixed(3))
    cumulativeBid += size
    bids.push({
      price,
      size,
      total: Number(cumulativeBid.toFixed(3)),
      depthPct: Math.min(100, Math.round((cumulativeBid / (levels * 1.5)) * 100)),
    })
  }

  const actualSpread = Number(Math.max(spreadUsd, asks[asks.length - 1].price - bids[0].price).toFixed(cfg.digits))
  const spreadPct = Number(((actualSpread / (midPrice || 1)) * 100).toFixed(4))

  return {
    bids,
    asks,
    spread: actualSpread,
    spreadPct,
  }
}
