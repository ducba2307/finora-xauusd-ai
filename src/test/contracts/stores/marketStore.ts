/**
 * Centralized Market Data Store Contract
 * Authoritative reference derived from PROJECT.md (F01, F02, F03) and Interface Contracts § 1
 */

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

  constructor() {
    this.initializeDefaultTickers()
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
        symbol: 'XAU/USD',
        category: 'FOREX',
        midPrice: 2734.5,
        bidPrice: 2734.35,
        askPrice: 2734.55,
        spreadPips: 2.0, // Gold: 1.2-2.5 pips
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
        symbol: 'USD/JPY',
        category: 'FOREX',
        midPrice: 152.45,
        bidPrice: 152.435,
        askPrice: 152.465,
        spreadPips: 0.3,
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

  getTicker(symbol: string): MarketTicker | undefined {
    return this.tickers.get(symbol)
  }

  getAllTickers(): Record<string, MarketTicker> {
    const res: Record<string, MarketTicker> = {}
    this.tickers.forEach((val, key) => {
      res[key] = val
    })
    return res
  }

  setTicker(ticker: MarketTicker): void {
    this.tickers.set(ticker.symbol, ticker)
    const set = this.listeners.get(ticker.symbol)
    if (set) {
      set.forEach((fn) => fn(ticker))
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
    if (!this.listeners.has(symbol)) {
      this.listeners.set(symbol, new Set())
    }
    this.listeners.get(symbol)!.add(listener)

    return () => {
      this.listeners.get(symbol)?.delete(listener)
    }
  }
}

export const defaultMarketStore = new MarketDataStore()
