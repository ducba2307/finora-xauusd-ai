/**
 * Centralized Market Data Store
 * Multi-asset ticker registry, institutional spreads, square-root slippage,
 * and decoupled subscription pub/sub model for background trading and risk engine.
 */

import { useSyncExternalStore, useCallback } from 'react'
import { simulateNextGBMTick } from '../services/marketDataSimulator'


export interface MarketTicker {
  symbol: string
  category: 'CRYPTO' | 'FOREX'
  midPrice: number
  bidPrice: number
  askPrice: number
  spreadPips: number
  spreadUsd: number
  high24h: number
  low24h: number
  change24hPct: number
  volume24h: number
  lastUpdateTimestamp: number
  connectionStatus: 'LIVE_WS' | 'SIMULATED' | 'CONNECTING' | 'DISCONNECTED'
}

export class MarketDataStore {
  private tickers: Map<string, MarketTicker> = new Map()
  private listeners: Map<string, Set<(ticker: MarketTicker) => void>> = new Map()
  private allListeners: Set<(tickers: Record<string, MarketTicker>) => void> = new Set()
  private feedInterval: ReturnType<typeof setInterval> | null = null
  private isFeedRunning: boolean = false

  constructor() {
    this.initializeDefaultTickers()
    const isBrowser = typeof window !== 'undefined'
    const globalObj = typeof globalThis !== 'undefined' ? (globalThis as unknown as { __VITEST_ENVIRONMENT__?: boolean; process?: { env?: { VITEST?: string } } }) : undefined
    const isVitest = Boolean(globalObj?.__VITEST_ENVIRONMENT__ || globalObj?.process?.env?.VITEST)
    if (isBrowser && !isVitest) {
      this.startGlobalFeed()
    }
  }

  private initializeDefaultTickers() {
    const defaults: MarketTicker[] = [
      {
        symbol: 'BTC/USDT',
        category: 'CRYPTO',
        midPrice: 114884.0,
        bidPrice: 114883.0,
        askPrice: 114885.0,
        spreadPips: 2.0,
        spreadUsd: 2.0, // BTC: $1-3 institutional spread
        high24h: 116240.0,
        low24h: 110450.0,
        change24hPct: 4.61,
        volume24h: 18700000000,
        lastUpdateTimestamp: Date.now(),
        connectionStatus: 'LIVE_WS',
      },
      {
        symbol: 'ETH/USDT',
        category: 'CRYPTO',
        midPrice: 3248.3,
        bidPrice: 3248.2,
        askPrice: 3248.4,
        spreadPips: 2.0,
        spreadUsd: 0.2, // ETH: $0.15-0.30 institutional spread
        high24h: 3310.0,
        low24h: 3140.0,
        change24hPct: 3.45,
        volume24h: 32500000000,
        lastUpdateTimestamp: Date.now(),
        connectionStatus: 'LIVE_WS',
      },
      {
        symbol: 'SOL/USDT',
        category: 'CRYPTO',
        midPrice: 194.25,
        bidPrice: 194.225,
        askPrice: 194.275,
        spreadPips: 5.0,
        spreadUsd: 0.05, // SOL: $0.03-0.08 institutional spread
        high24h: 204.5,
        low24h: 189.1,
        change24hPct: -2.48,
        volume24h: 4300000000,
        lastUpdateTimestamp: Date.now(),
        connectionStatus: 'LIVE_WS',
      },
      {
        symbol: 'XAU/USD',
        category: 'FOREX',
        midPrice: 2734.5,
        bidPrice: 2734.35,
        askPrice: 2734.55,
        spreadPips: 2.0, // Gold: 1.2-2.5 pips ($0.20 spread)
        spreadUsd: 0.2,
        high24h: 2748.2,
        low24h: 2718.6,
        change24hPct: 1.15,
        volume24h: 128400000000,
        lastUpdateTimestamp: Date.now(),
        connectionStatus: 'SIMULATED',
      },
      {
        symbol: 'EUR/USD',
        category: 'FOREX',
        midPrice: 1.0825,
        bidPrice: 1.08248,
        askPrice: 1.08252,
        spreadPips: 0.4, // FX: 0.2-0.4 pips
        spreadUsd: 0.00004,
        high24h: 1.0865,
        low24h: 1.0795,
        change24hPct: 0.28,
        volume24h: 450000000000,
        lastUpdateTimestamp: Date.now(),
        connectionStatus: 'SIMULATED',
      },
      {
        symbol: 'GBP/USD',
        category: 'FOREX',
        midPrice: 1.2984,
        bidPrice: 1.29838,
        askPrice: 1.29842,
        spreadPips: 0.4, // FX: 0.3-0.6 pips
        spreadUsd: 0.00004,
        high24h: 1.3021,
        low24h: 1.2945,
        change24hPct: 0.48,
        volume24h: 142000000000,
        lastUpdateTimestamp: Date.now(),
        connectionStatus: 'SIMULATED',
      },
      {
        symbol: 'USD/JPY',
        category: 'FOREX',
        midPrice: 152.45,
        bidPrice: 152.435,
        askPrice: 152.465,
        spreadPips: 0.3, // FX: 0.3-0.5 pips
        spreadUsd: 0.03,
        high24h: 153.1,
        low24h: 151.8,
        change24hPct: -0.42,
        volume24h: 310000000000,
        lastUpdateTimestamp: Date.now(),
        connectionStatus: 'SIMULATED',
      },
    ]

    for (const t of defaults) {
      this.tickers.set(t.symbol, t)
    }
  }

  private normalizeSymbol(symbol: string): string {
    if (this.tickers.has(symbol)) return symbol
    const upper = symbol.toUpperCase().trim()
    if (this.tickers.has(upper)) return upper

    // Strip slashes or check common crypto base symbols
    if (upper === 'BTC') return 'BTC/USDT'
    if (upper === 'ETH') return 'ETH/USDT'
    if (upper === 'SOL') return 'SOL/USDT'
    if (upper === 'XAU' || upper === 'GOLD') return 'XAU/USD'
    if (upper === 'EUR') return 'EUR/USD'
    if (upper === 'GBP') return 'GBP/USD'
    if (upper === 'JPY') return 'USD/JPY'

    // Look for match without slashes (e.g. BTCUSDT -> BTC/USDT)
    for (const key of this.tickers.keys()) {
      if (key.replace('/', '') === upper.replace('/', '')) {
        return key
      }
    }

    return symbol
  }

  getTicker(symbol: string): MarketTicker | undefined {
    const norm = this.normalizeSymbol(symbol)
    return this.tickers.get(norm)
  }

  private allTickersCache: Record<string, MarketTicker> | null = null

  getAllTickers(): Record<string, MarketTicker> {
    if (!this.allTickersCache) {
      const res: Record<string, MarketTicker> = {}
      this.tickers.forEach((val, key) => {
        res[key] = val
      })
      this.allTickersCache = res
    }
    return this.allTickersCache
  }

  setTicker(ticker: MarketTicker): void {
    const norm = this.normalizeSymbol(ticker.symbol)
    const normalizedTicker = { ...ticker, symbol: norm }
    this.tickers.set(norm, normalizedTicker)
    this.allTickersCache = null


    // Notify symbol-specific listeners
    const set = this.listeners.get(norm)
    if (set) {
      set.forEach((fn) => {
        try {
          fn(normalizedTicker)
        } catch {
          // ignore listener errors
        }
      })
    }

    // Notify global listeners
    if (this.allListeners.size > 0) {
      const all = this.getAllTickers()
      this.allListeners.forEach((fn) => {
        try {
          fn(all)
        } catch {
          // ignore listener errors
        }
      })
    }
  }

  /**
   * Institutional Square-Root Slippage Model (F03)
   * slippagePct = baseSlippage * sqrt(tradeSize / marketDepth)
   */
  calculateExecutionFill(
    symbol: string,
    side: 'BUY' | 'SELL',
    lotOrSize: number
  ): {
    fillPrice: number
    spreadCost: number
    slippageCost: number
    commission: number
  } {
    const ticker = this.getTicker(symbol)
    if (!ticker) {
      throw new Error(`Ticker not found for symbol: ${symbol}`)
    }

    const isCrypto = ticker.category === 'CRYPTO'
    const marketDepth = isCrypto ? 50.0 : 10.0 // Normal liquidity depth in lots/units
    const baseSlippagePct = isCrypto ? 0.0002 : 0.00005 // 2 bps or 0.5 bps

    // Square-root slippage formula with institutional execution cap (max 50% slippage)
    const safeSize = Number.isFinite(lotOrSize) && lotOrSize > 0 ? lotOrSize : 0.1
    const sizeRatio = Math.max(0.1, safeSize / marketDepth)
    const rawSlippagePct = baseSlippagePct * Math.sqrt(sizeRatio)
    const MAX_SLIPPAGE_PCT = 0.50 // 50% maximum slippage cap
    const slippagePct = Math.min(MAX_SLIPPAGE_PCT, rawSlippagePct)
    const slippageCost = ticker.midPrice * slippagePct

    const spreadCost = Math.abs(ticker.askPrice - ticker.bidPrice) / 2

    const rawFillPrice = side === 'BUY'
      ? ticker.askPrice + slippageCost
      : ticker.bidPrice - slippageCost

    // Ensure fillPrice is strictly positive and bounded above minimum tick size
    const minTickSize = isCrypto ? 0.01 : symbol.includes('JPY') ? 0.001 : 0.00001
    const fillPrice = Math.max(minTickSize, rawFillPrice)

    const commission = Number((safeSize * (isCrypto ? 1.5 : 3.0)).toFixed(2))

    return {
      fillPrice: Number(fillPrice.toFixed(isCrypto ? 2 : symbol.includes('JPY') ? 3 : 5)),
      spreadCost: Number(spreadCost.toFixed(5)),
      slippageCost: Number(slippageCost.toFixed(5)),
      commission,
    }
  }

  subscribeTicker(symbol: string, listener: (ticker: MarketTicker) => void): () => void {
    const norm = this.normalizeSymbol(symbol)
    if (!this.listeners.has(norm)) {
      this.listeners.set(norm, new Set())
    }
    this.listeners.get(norm)!.add(listener)

    return () => {
      this.listeners.get(norm)?.delete(listener)
    }
  }

  subscribeAll(listener: (tickers: Record<string, MarketTicker>) => void): () => void {
    this.allListeners.add(listener)
    return () => {
      this.allListeners.delete(listener)
    }
  }

  public startGlobalFeed(intervalMs: number = 1200): void {
    if (this.isFeedRunning) return
    this.isFeedRunning = true

    this.feedInterval = setInterval(() => {
      // Step core instruments with calibrated institutional simulation
      const symbolsToStep = ['XAU/USD', 'EUR/USD', 'GBP/USD', 'USD/JPY', 'BTC/USDT', 'ETH/USDT', 'SOL/USDT']
      for (const sym of symbolsToStep) {
        const current = this.getTicker(sym)
        if (!current) continue

        const dtSec = intervalMs / 1000
        const tick = simulateNextGBMTick(sym, current.midPrice, dtSec)
        const updated: MarketTicker = {
          ...current,
          midPrice: tick.nextPrice,
          bidPrice: tick.bidPrice,
          askPrice: tick.askPrice,
          spreadPips: tick.spreadPips,
          spreadUsd: tick.spreadUsd,
          lastUpdateTimestamp: Date.now(),
        }
        this.setTicker(updated)
      }
    }, intervalMs)
  }

  public stopGlobalFeed(): void {
    if (this.feedInterval) {
      clearInterval(this.feedInterval)
      this.feedInterval = null
    }
    this.isFeedRunning = false
  }

  public isFeedActive(): boolean {
    return this.isFeedRunning
  }
}

export const defaultMarketStore = new MarketDataStore()

/**
 * React hook to subscribe to a specific market ticker.
 */
export function useMarketTicker(symbol: string): MarketTicker | undefined {
  const subscribe = useCallback(
    (onStoreChange: () => void) => defaultMarketStore.subscribeTicker(symbol, () => onStoreChange()),
    [symbol]
  )
  const getSnapshot = useCallback(() => defaultMarketStore.getTicker(symbol), [symbol])
  return useSyncExternalStore(subscribe, getSnapshot)
}

/**
 * React hook to subscribe to the entire multi-asset ticker registry
 */
export function useAllMarketTickers(): Record<string, MarketTicker> {
  const subscribe = useCallback(
    (onStoreChange: () => void) => defaultMarketStore.subscribeAll(() => onStoreChange()),
    []
  )
  const getSnapshot = useCallback(() => defaultMarketStore.getAllTickers(), [])
  return useSyncExternalStore(subscribe, getSnapshot)
}

