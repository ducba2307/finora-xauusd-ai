import { describe, it, expect, beforeEach } from 'vitest'
import { MarketDataStore, type MarketTicker } from '@/stores/marketStore'

describe('Tier 1: F01-F03 Centralized Market Data Store & Slippage Engine', () => {
  let store: MarketDataStore

  beforeEach(() => {
    store = new MarketDataStore()
  })

  it('F01: maintains multi-asset ticker registry across Crypto and Forex', () => {
    const all = store.getAllTickers()
    expect(all['BTC/USDT']).toBeDefined()
    expect(all['XAU/USD']).toBeDefined()
    expect(all['EUR/USD']).toBeDefined()

    const btc = store.getTicker('BTC/USDT')
    expect(btc?.category).toBe('CRYPTO')
    expect(btc?.midPrice).toBeGreaterThan(100000)
    expect(btc?.bidPrice).toBeLessThan(btc?.askPrice ?? 0)
  })

  it('F03: enforces institutional spread standards (FX: 0.2-0.4 pips, Gold: 1.2-2.5 pips, BTC: $1-3)', () => {
    const btc = store.getTicker('BTC/USDT')!
    const xau = store.getTicker('XAU/USD')!
    const eur = store.getTicker('EUR/USD')!

    // BTC spread should be within institutional $1 - $3 range
    const btcSpreadUsd = btc.askPrice - btc.bidPrice
    expect(btcSpreadUsd).toBeGreaterThanOrEqual(1.0)
    expect(btcSpreadUsd).toBeLessThanOrEqual(3.0)

    // Gold spread should be within institutional 1.2 - 2.5 pips
    expect(xau.spreadPips).toBeGreaterThanOrEqual(1.2)
    expect(xau.spreadPips).toBeLessThanOrEqual(2.5)

    // EUR/USD spread should be within institutional 0.2 - 0.4 pips
    expect(eur.spreadPips).toBeGreaterThanOrEqual(0.2)
    expect(eur.spreadPips).toBeLessThanOrEqual(0.4)
  })

  it('F03: models non-linear square-root volume slippage on execution fills', () => {
    // 5 lots order (ratio 5/50 = 0.1)
    const fillSmall = store.calculateExecutionFill('BTC/USDT', 'BUY', 5.0)
    // 45 lots order (ratio 45/50 = 0.9)
    const fillLarge = store.calculateExecutionFill('BTC/USDT', 'BUY', 45.0)

    expect(fillSmall.fillPrice).toBeGreaterThan(store.getTicker('BTC/USDT')!.askPrice)
    expect(fillLarge.fillPrice).toBeGreaterThan(fillSmall.fillPrice)
    // Slippage cost scales non-linearly (sqrt factor): sqrt(0.9 / 0.1) = sqrt(9) = 3
    expect(fillLarge.slippageCost).toBeGreaterThan(fillSmall.slippageCost)
    expect(fillLarge.slippageCost / fillSmall.slippageCost).toBeCloseTo(3.0, 1)
  })

  it('F01: supports dynamic ticker subscription and listener dispatches', () => {
    let receivedUpdate: MarketTicker | null = null
    const unsubscribe = store.subscribeTicker('BTC/USDT', (t: MarketTicker) => {
      receivedUpdate = t
    })

    const updatedTicker: MarketTicker = {
      ...store.getTicker('BTC/USDT')!,
      midPrice: 115000.0,
      bidPrice: 114999.0,
      askPrice: 115001.0,
      lastUpdateTimestamp: Date.now(),
    }

    store.setTicker(updatedTicker)
    expect(receivedUpdate).not.toBeNull()
    expect(receivedUpdate?.midPrice).toBe(115000.0)

    // Test unsubscribe
    unsubscribe()
    receivedUpdate = null
    store.setTicker({ ...updatedTicker, midPrice: 115100.0 })
    expect(receivedUpdate).toBeNull()
  })

  it('F02: distinguishes live websocket versus simulated ECN connection states', () => {
    const btc = store.getTicker('BTC/USDT')!
    const eur = store.getTicker('EUR/USD')!

    expect(['LIVE_WS', 'SIMULATED', 'CONNECTING']).toContain(btc.connectionStatus)
    expect(['LIVE_WS', 'SIMULATED', 'CONNECTING']).toContain(eur.connectionStatus)
  })

  it('F01: manages autonomous global feed lifecycle and subscribeAll updates', () => {
    expect(store.isFeedActive()).toBe(false)
    store.startGlobalFeed(50)
    expect(store.isFeedActive()).toBe(true)

    let allReceived: Record<string, MarketTicker> | null = null
    const unsubscribe = store.subscribeAll((tickers) => {
      allReceived = tickers
    })

    store.setTicker({
      ...store.getTicker('BTC/USDT')!,
      midPrice: 116000.0,
    })

    expect(allReceived).not.toBeNull()
    expect(allReceived!['BTC/USDT'].midPrice).toBe(116000.0)

    unsubscribe()
    store.stopGlobalFeed()
    expect(store.isFeedActive()).toBe(false)
  })

  it('F02: simulateNextGBMTick generates realistic ticks with positive prices and dynamic spreads', async () => {
    const { simulateNextGBMTick } = await import('@/services/marketDataSimulator')
    const initialPrice = 2734.50
    const tick = simulateNextGBMTick('XAU/USD', initialPrice, 1.0, initialPrice)

    expect(tick.nextPrice).toBeGreaterThan(0)
    expect(tick.askPrice).toBeGreaterThan(tick.bidPrice)
    expect(tick.spreadPips).toBeGreaterThanOrEqual(1.2)
    expect(tick.spreadPips).toBeLessThanOrEqual(4.0)
  })

  it('F02: generateInstitutionalOrderBook produces properly sorted bids and asks', async () => {
    const { generateInstitutionalOrderBook } = await import('@/services/marketDataSimulator')
    const book = generateInstitutionalOrderBook('EUR/USD', 1.0825, 10)

    expect(book.bids.length).toBe(10)
    expect(book.asks.length).toBe(10)
    expect(book.spread).toBeGreaterThan(0)

    // Bids descend from best bid to lowest bid
    for (let i = 1; i < book.bids.length; i++) {
      expect(book.bids[i].price).toBeLessThan(book.bids[i - 1].price)
    }

    // In standard depth display, asks descend to best ask at book.asks[book.asks.length - 1]
    for (let i = 1; i < book.asks.length; i++) {
      expect(book.asks[i].price).toBeLessThan(book.asks[i - 1].price)
    }

    // Best ask is higher than best bid
    const bestAsk = book.asks[book.asks.length - 1].price
    const bestBid = book.bids[0].price
    expect(bestAsk).toBeGreaterThan(bestBid)
  })
})
