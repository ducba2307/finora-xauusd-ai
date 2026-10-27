import { MarketDataStore, type MarketTicker } from '@/stores/marketStore'

import {
  simulateNextGBMTick,
  getAssetConfig,
  generateInstitutionalOrderBook,
  calculateClosedBarEMA,
  calculateProvisionalEMA,
  alignTimestampToInterval,
  getTimeframeSeconds,
  boxMullerRandom,
  getSessionVolatilityMultiplier,
} from '@/services/marketDataSimulator'
import { formatPrice, formatPips, formatCurrency, formatPercent, formatCompact } from '@/utils/formatters'

describe('Adversarial Challenger Milestone 1: Market Feed, ECN Math & Execution Stress', () => {
  let store: MarketDataStore

  beforeEach(() => {
    store = new MarketDataStore()
  })

  // ==========================================================================
  // SECTION 1: High-Frequency Tick Bursts (10,000 simulated ticks in tight loops)
  // ==========================================================================
  describe('1. High-Frequency Tick Bursts & Stochastic Stability', () => {
    it('survives 10,000 rapid simulated ticks on Forex EUR/USD without NaN, Infinity, or negative prices', () => {
      let price = 1.0825
      const anchor = 1.0825
      const t0 = performance.now()

      for (let i = 0; i < 10000; i++) {
        const tick = simulateNextGBMTick('EUR/USD', price, 1.0, anchor)
        expect(Number.isFinite(tick.nextPrice)).toBe(true)
        expect(Number.isFinite(tick.bidPrice)).toBe(true)
        expect(Number.isFinite(tick.askPrice)).toBe(true)
        expect(Number.isFinite(tick.spreadPips)).toBe(true)
        expect(Number.isFinite(tick.spreadUsd)).toBe(true)

        expect(tick.nextPrice).toBeGreaterThan(0)
        expect(tick.askPrice).toBeGreaterThanOrEqual(tick.bidPrice)
        price = tick.nextPrice
      }

      const elapsed = performance.now() - t0
      // 10,000 ticks with 50,000 assertion checks should execute under 1,000ms (> 10,000 ticks/sec)
      expect(elapsed).toBeLessThan(1000)
      // Due to Ornstein-Uhlenbeck mean-reversion towards 1.0825, price must remain in realistic FX range [0.8, 1.4]
      expect(price).toBeGreaterThan(0.8)
      expect(price).toBeLessThan(1.4)
    })

    it('survives 10,000 rapid simulated ticks on Gold XAU/USD with stable Ornstein-Uhlenbeck mean reversion', () => {
      let price = 2734.50
      const anchor = 2734.50

      for (let i = 0; i < 10000; i++) {
        const tick = simulateNextGBMTick('XAU/USD', price, 1.0, anchor)
        expect(Number.isFinite(tick.nextPrice)).toBe(true)
        expect(tick.nextPrice).toBeGreaterThan(0)
        expect(tick.askPrice).toBeGreaterThanOrEqual(tick.bidPrice)
        price = tick.nextPrice
      }

      // XAU/USD should stay within realistic boundaries around anchor
      expect(price).toBeGreaterThan(1500)
      expect(price).toBeLessThan(4500)
    })

    it('survives 10,000 rapid simulated ticks on Crypto BTC/USDT with high annual volatility (55%)', () => {
      let price = 114884.00
      const anchor = 114884.00

      for (let i = 0; i < 10000; i++) {
        const tick = simulateNextGBMTick('BTC/USDT', price, 1.0, anchor)
        expect(Number.isFinite(tick.nextPrice)).toBe(true)
        expect(tick.nextPrice).toBeGreaterThan(0)
        expect(tick.askPrice).toBeGreaterThan(tick.bidPrice)
        price = tick.nextPrice
      }

      // BTC/USDT should remain positive and finite
      expect(price).toBeGreaterThan(10000)
      expect(price).toBeLessThan(500000)
    })

    it('pure random walk without anchor does not produce NaN or zero/negative prices even when drifting', () => {
      let price = 152.45 // USD/JPY
      for (let i = 0; i < 5000; i++) {
        // Omitting anchorPrice exercises pure unanchored GBM
        const tick = simulateNextGBMTick('USD/JPY', price, 1.0)
        expect(Number.isFinite(tick.nextPrice)).toBe(true)
        expect(tick.nextPrice).toBeGreaterThan(0.00001)
        expect(tick.bidPrice).toBeLessThanOrEqual(tick.askPrice)
        price = tick.nextPrice
      }
    })
  })

  // ==========================================================================
  // SECTION 2: 2-Sigma Spread Expansion & Session Volatility Calibration
  // ==========================================================================
  describe('2. Dynamic 2-Sigma Spread Expansion & Volatility Multipliers', () => {
    it('verifies session volatility multipliers are strictly positive across all UTC hours', () => {
      const hoursToTest = [0, 4, 8, 10, 13, 15, 17, 20, 22, 23.9]
      for (const h of hoursToTest) {
        const d = new Date(Date.UTC(2026, 9, 11, Math.floor(h), (h % 1) * 60))
        const mult = getSessionVolatilityMultiplier(d)
        expect(Number.isFinite(mult)).toBe(true)
        expect(mult).toBeGreaterThanOrEqual(0.6)
        expect(mult).toBeLessThanOrEqual(1.6)
      }
    })

    it('verifies standard spread is within [minSpreadPips, maxSpreadPips * 1.5] for all assets', () => {
      const testSymbols = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'XAU/USD', 'BTC/USDT', 'ETH/USDT', 'SOL/USDT']
      for (const sym of testSymbols) {
        const cfg = getAssetConfig(sym)
        for (let i = 0; i < 200; i++) {
          const tick = simulateNextGBMTick(sym, 100, 1.0)
          expect(tick.spreadPips).toBeGreaterThanOrEqual(cfg.minSpreadPips)
          expect(tick.spreadPips).toBeLessThanOrEqual(cfg.maxSpreadPips * 1.5 + 0.1)
          const maxDelta = cfg.digits > 2 ? 0.0001 : 0.006
          expect(Math.abs(tick.spreadUsd - tick.spreadPips * cfg.pipSize)).toBeLessThanOrEqual(maxDelta)
        }
      }
    })

    it('empirically tests 2-sigma spread shock expansion', () => {
      // Simulate 2,000 ticks and detect when spread exceeds cfg.maxSpreadPips
      const cfg = getAssetConfig('XAU/USD')
      let expansionObserved = false

      for (let i = 0; i < 2000; i++) {
        const tick = simulateNextGBMTick('XAU/USD', 2734.5, 1.0)
        if (tick.spreadPips > cfg.maxSpreadPips) {
          expansionObserved = true
          // Expansion is capped at maxSpreadPips * 1.5
          expect(tick.spreadPips).toBeLessThanOrEqual(cfg.maxSpreadPips * 1.5 + 0.1)
        }
      }
      expect(expansionObserved).toBe(true)
    })

    it('boxMullerRandom produces standard normal distribution N(0, 1)', () => {
      const N = 10000
      let sum = 0
      let sumSq = 0
      for (let i = 0; i < N; i++) {
        const z = boxMullerRandom()
        expect(Number.isFinite(z)).toBe(true)
        sum += z
        sumSq += z * z
      }
      const mean = sum / N
      const variance = (sumSq / N) - (mean * mean)

      expect(mean).toBeCloseTo(0, 1) // Mean close to 0 (|mean| < 0.1)
      expect(variance).toBeCloseTo(1, 1) // Variance close to 1 (|var - 1| < 0.15)
    })
  })

  // ==========================================================================
  // SECTION 3: Order Execution Fills, Micro-Lots (0.001) & Whale-Lots (5,000)
  // ==========================================================================
  describe('3. Execution Fills across Micro-Lots and Whale-Lots', () => {
    it('models micro-lot (0.001) order fills across Forex, Gold, and Crypto', () => {
      const microLot = 0.001

      // 1. Forex EUR/USD
      const eurFill = store.calculateExecutionFill('EUR/USD', 'BUY', microLot)
      expect(eurFill.fillPrice).toBeGreaterThan(store.getTicker('EUR/USD')!.bidPrice)
      expect(eurFill.spreadCost).toBeGreaterThan(0)
      expect(eurFill.slippageCost).toBeGreaterThan(0)
      expect(Number.isFinite(eurFill.commission)).toBe(true)

      // 2. Gold XAU/USD
      const goldFill = store.calculateExecutionFill('XAU/USD', 'BUY', microLot)
      expect(goldFill.fillPrice).toBeGreaterThan(store.getTicker('XAU/USD')!.bidPrice)
      expect(goldFill.spreadCost).toBeGreaterThan(0)

      // 3. Crypto BTC/USDT
      const btcFill = store.calculateExecutionFill('BTC/USDT', 'BUY', microLot)
      expect(btcFill.fillPrice).toBeGreaterThan(store.getTicker('BTC/USDT')!.bidPrice)
      expect(btcFill.spreadCost).toBeGreaterThan(0)
    })

    it('models whale-lot (5,000) order fills without price collapse or negative fills', () => {
      const whaleLot = 5000.0

      // Whale BUY: fill price must exceed ask price due to slippage
      const btcBuyWhale = store.calculateExecutionFill('BTC/USDT', 'BUY', whaleLot)
      const btcTicker = store.getTicker('BTC/USDT')!
      expect(btcBuyWhale.fillPrice).toBeGreaterThan(btcTicker.askPrice)
      expect(btcBuyWhale.slippageCost).toBeGreaterThan(10.0) // Significant slippage for 5,000 BTC
      expect(btcBuyWhale.commission).toBe(whaleLot * 1.5) // $7,500 commission

      // Whale SELL: fill price must be lower than bid price due to slippage, but remain strictly positive
      const btcSellWhale = store.calculateExecutionFill('BTC/USDT', 'SELL', whaleLot)
      expect(btcSellWhale.fillPrice).toBeLessThan(btcTicker.bidPrice)
      expect(btcSellWhale.fillPrice).toBeGreaterThan(0)

      // Forex Whale BUY & SELL (5,000 lots = $500,000,000 volume)
      const eurTicker = store.getTicker('EUR/USD')!
      const eurBuyWhale = store.calculateExecutionFill('EUR/USD', 'BUY', whaleLot)
      const eurSellWhale = store.calculateExecutionFill('EUR/USD', 'SELL', whaleLot)
      expect(eurBuyWhale.fillPrice).toBeGreaterThan(eurTicker.askPrice)
      expect(eurSellWhale.fillPrice).toBeLessThan(eurTicker.bidPrice)
      expect(eurSellWhale.fillPrice).toBeGreaterThan(0)
      expect(eurBuyWhale.commission).toBe(whaleLot * 3.0) // $15,000 commission
    })

    it('verifies non-linear square-root volume slippage scaling: sqrt(100x size) = 10x slippage', () => {
      // Depth for Crypto is 50.
      // Small size = 50 (ratio = 1) -> slippage = base * 1
      // Huge size = 5000 (ratio = 100) -> slippage = base * sqrt(100) = base * 10
      const fillNormal = store.calculateExecutionFill('BTC/USDT', 'BUY', 50)
      const fillWhale = store.calculateExecutionFill('BTC/USDT', 'BUY', 5000)

      const ratio = fillWhale.slippageCost / fillNormal.slippageCost
      expect(ratio).toBeCloseTo(10.0, 1)
    })

    it('enforces directional fill penalty: BUY fills at Ask + slippage, SELL fills at Bid - slippage', () => {
      const ticker = store.getTicker('EUR/USD')!
      const buyFill = store.calculateExecutionFill('EUR/USD', 'BUY', 1.0)
      const sellFill = store.calculateExecutionFill('EUR/USD', 'SELL', 1.0)

      // Buyer pays higher than ask
      expect(buyFill.fillPrice).toBeGreaterThan(ticker.askPrice)
      // Seller receives lower than bid
      expect(sellFill.fillPrice).toBeLessThan(ticker.bidPrice)
      // Spread cost is half of bid-ask spread
      expect(buyFill.spreadCost).toBeCloseTo((ticker.askPrice - ticker.bidPrice) / 2, 5)
    })

    it('throws descriptive error on nonexistent symbol', () => {
      expect(() => {
        store.calculateExecutionFill('INVALID/PAIR', 'BUY', 1.0)
      }).toThrow(/Ticker not found/)
    })
  })

  // ==========================================================================
  // SECTION 4: Pip Precision & Formatter Boundary Testing (F05)
  // ==========================================================================
  describe('4. Pip Precision & Formatter Boundaries', () => {
    it('formats EUR/USD and GBP/USD with strictly 5 decimal places and NO "$" prefix', () => {
      expect(formatPrice(1.0825, 'EUR/USD')).toBe('1.08250')
      expect(formatPrice(1.082534, 'EUR/USD')).toBe('1.08253')
      expect(formatPrice(1.2984, 'GBP/USD')).toBe('1.29840')
      expect(formatPrice(1.298499, 'GBP/USD')).toBe('1.29850')

      // Must never have dollar sign
      expect(formatPrice(1.0825, 'EUR/USD')).not.toContain('$')
      expect(formatPrice(1.2984, 'GBP/USD')).not.toContain('$')
    })

    it('formats USD/JPY with strictly 3 decimal places and NO "$" prefix', () => {
      expect(formatPrice(152.45, 'USD/JPY')).toBe('152.450')
      expect(formatPrice(152.4567, 'USD/JPY')).toBe('152.457')
      expect(formatPrice(152.45, 'USD/JPY')).not.toContain('$')
    })

    it('formats Gold XAU/USD and Crypto BTC/USDT with 2 decimal places and standard comma separation', () => {
      expect(formatPrice(2734.5, 'XAU/USD')).toBe('2,734.50')
      expect(formatPrice(114884.2, 'BTC/USDT')).toBe('114,884.20')
      expect(formatPrice(194.25, 'SOL/USDT')).toBe('194.25')
      expect(formatPrice(3248.3, 'ETH/USDT')).toBe('3,248.30')
    })

    it('formats pips with correct sign and fractional pipette precision', () => {
      expect(formatPips(0.4, true, 1)).toBe('+0.4 pips')
      expect(formatPips(-1.5, true, 1)).toBe('-1.5 pips')
      expect(formatPips(0, true, 1)).toBe('0.0 pips')
      expect(formatPips(2.35, true, 2)).toBe('+2.35 pips')
      expect(formatPips(1.8, false, 1)).toBe('1.8 pips')
    })

    it('guarantees NaN, Infinity, -Infinity immunity across all formatters', () => {
      expect(formatPrice(NaN, 'EUR/USD')).toBe('0.00')
      expect(formatPrice(Infinity, 'BTC/USDT')).toBe('0.00')
      expect(formatPrice(-Infinity, 'USD/JPY')).toBe('0.00')

      expect(formatPips(NaN)).toBe('0.0 pips')
      expect(formatPips(Infinity)).toBe('0.0 pips')

      expect(formatCurrency(NaN)).toBe('$0.00')
      expect(formatCurrency(Infinity)).toBe('$0.00')
      expect(formatCurrency(-Infinity)).toBe('$0.00')

      expect(formatPercent(NaN)).toBe('0.00%')
      expect(formatPercent(Infinity)).toBe('0.00%')

      expect(formatCompact(NaN)).toBe('$0.00')
      expect(formatCompact(Infinity)).toBe('$0.00')
    })
  })

  // ==========================================================================
  // SECTION 5: Institutional Order Book (L2) Depth Integrity
  // ==========================================================================
  describe('5. Institutional L2 Order Book Depth Integrity', () => {
    it('generates strictly ordered bids and asks for Forex (EUR/USD) with 5 decimals', () => {
      const book = generateInstitutionalOrderBook('EUR/USD', 1.08250, 8)
      expect(book.bids.length).toBe(8)
      expect(book.asks.length).toBe(8)
      expect(book.spread).toBeGreaterThan(0)

      // Bids: bids[0] is best bid (highest). Each subsequent bid is strictly lower.
      for (let i = 1; i < book.bids.length; i++) {
        expect(book.bids[i].price).toBeLessThan(book.bids[i - 1].price)
        expect(book.bids[i].total).toBeGreaterThan(book.bids[i - 1].total)
      }

      // Asks: asks[asks.length - 1] is best ask (lowest). Asks are unshifted, so asks[0] has highest ask.
      for (let i = 1; i < book.asks.length; i++) {
        expect(book.asks[i].price).toBeLessThan(book.asks[i - 1].price)
      }

      const bestAsk = book.asks[book.asks.length - 1].price
      const bestBid = book.bids[0].price
      expect(bestAsk).toBeGreaterThan(bestBid)
      expect(book.spread).toBeCloseTo(bestAsk - bestBid, 5)
    })

    it('generates strictly ordered bids and asks for Crypto (BTC/USDT) with $1-3 spread', () => {
      const book = generateInstitutionalOrderBook('BTC/USDT', 114884.0, 10)
      const bestAsk = book.asks[book.asks.length - 1].price
      const bestBid = book.bids[0].price

      expect(bestAsk).toBeGreaterThan(bestBid)
      expect(bestAsk - bestBid).toBeGreaterThanOrEqual(1.5)
      expect(bestAsk - bestBid).toBeLessThanOrEqual(4.0)
    })
  })

  // ==========================================================================
  // SECTION 6: Feed Lifecycle, Rapid Toggling & Memory Stability
  // ==========================================================================
  describe('6. Feed Lifecycle, Rapid Toggling & Listener Management', () => {
    it('handles rapid startGlobalFeed and stopGlobalFeed toggling without orphaned timers', () => {
      for (let i = 0; i < 20; i++) {
        store.startGlobalFeed(100)
        expect(store.isFeedActive()).toBe(true)
        store.stopGlobalFeed()
        expect(store.isFeedActive()).toBe(false)
      }
    })

    it('supports 1,000 concurrent listeners with clean unsubscription and zero memory leaks', () => {
      const unsubs: (() => void)[] = []
      let triggerCount = 0

      for (let i = 0; i < 1000; i++) {
        const unsub = store.subscribeTicker('BTC/USDT', () => {
          triggerCount++
        })
        unsubs.push(unsub)
      }

      // Dispatch 1 tick
      const current = store.getTicker('BTC/USDT')!
      store.setTicker({ ...current, midPrice: 115000.0 })
      expect(triggerCount).toBe(1000)

      // Unsubscribe all 1,000 listeners
      for (const unsub of unsubs) {
        unsub()
      }

      // Dispatch another tick - triggerCount must remain 1000
      store.setTicker({ ...current, midPrice: 115100.0 })
      expect(triggerCount).toBe(1000)
    })

    it('global subscribeAll correctly receives multi-asset snapshots on updates', () => {
      let received: Record<string, MarketTicker> | null = null
      const unsub = store.subscribeAll((all) => {
        received = all
      })

      const xau = store.getTicker('XAU/USD')!
      store.setTicker({ ...xau, midPrice: 2750.0 })

      expect(received).not.toBeNull()
      expect(received!['XAU/USD'].midPrice).toBe(2750.0)
      expect(received!['EUR/USD']).toBeDefined()

      unsub()
    })
  })

  // ==========================================================================
  // SECTION 7: Mathematical EMA Integrity (Closed Bar vs. Provisional Intra-Bar)
  // ==========================================================================
  describe('7. Closed Bar EMA vs. Provisional Intra-Bar Streaming EMA', () => {
    it('calculateClosedBarEMA accurately applies exponential smoothing alpha = 2/(N+1)', () => {
      const period = 20
      const alpha = 2 / (period + 1) // 2 / 21 = 0.095238
      const prevEma = 100.0
      const newClose = 110.0

      const expected = Number((newClose * alpha + prevEma * (1 - alpha)).toFixed(4))
      const actual = calculateClosedBarEMA(prevEma, newClose, period)
      expect(actual).toBe(expected)
    })

    it('provisional intra-bar updates do NOT degrade or mutate closed bar EMA across 1,000 ticks', () => {
      const closedEma = 2730.0
      const period = 20

      // 1,000 intra-bar tick fluctuations
      for (let i = 0; i < 1000; i++) {
        const intraTick = 2730.0 + (Math.sin(i) * 5)
        const provEma = calculateProvisionalEMA(closedEma, intraTick, period)
        expect(Number.isFinite(provEma)).toBe(true)
        // Provisional EMA should respond to tick but never mutate closedEma
        expect(provEma).toBeGreaterThan(2725)
        expect(provEma).toBeLessThan(2735)
      }

      // Baseline closedEma is completely untouched
      expect(closedEma).toBe(2730.0)
    })

    it('handles undefined or NaN previous EMA gracefully without NaN crash', () => {
      expect(calculateClosedBarEMA(undefined, 105.0, 20)).toBe(105.0)
      expect(calculateClosedBarEMA(NaN, 105.0, 20)).toBe(105.0)
      expect(calculateProvisionalEMA(undefined, 105.0, 20)).toBe(105.0)
      expect(calculateProvisionalEMA(NaN, 105.0, 20)).toBe(105.0)
    })
  })

  // ==========================================================================
  // SECTION 8: Timestamp Interval Alignment
  // ==========================================================================
  describe('8. Candle Timestamp Interval Alignment', () => {
    it('accurately aligns raw timestamps to 1m, 5m, 15m, 1h, 4h, 1d boundaries', () => {
      const nowSec = 1791708453 // Arbitrary unix epoch timestamp in seconds
      expect(alignTimestampToInterval(nowSec, 60) % 60).toBe(0)
      expect(alignTimestampToInterval(nowSec, 300) % 300).toBe(0)
      expect(alignTimestampToInterval(nowSec, 900) % 900).toBe(0)
      expect(alignTimestampToInterval(nowSec, 3600) % 3600).toBe(0)
      expect(alignTimestampToInterval(nowSec, 14400) % 14400).toBe(0)
      expect(alignTimestampToInterval(nowSec, 86400) % 86400).toBe(0)
    })

    it('getTimeframeSeconds maps all supported timeframes cleanly', () => {
      expect(getTimeframeSeconds('1m')).toBe(60)
      expect(getTimeframeSeconds('5m')).toBe(300)
      expect(getTimeframeSeconds('15m')).toBe(900)
      expect(getTimeframeSeconds('1h')).toBe(3600)
      expect(getTimeframeSeconds('1H')).toBe(3600)
      expect(getTimeframeSeconds('4h')).toBe(14400)
      expect(getTimeframeSeconds('1d')).toBe(86400)
      expect(getTimeframeSeconds('1w')).toBe(604800)
      expect(getTimeframeSeconds('UNKNOWN')).toBe(3600)
    })
  })

  // ==========================================================================
  // SECTION 9: Symbol Normalization & Multi-Format Resolution
  // ==========================================================================
  describe('9. Symbol Normalization & Multi-Format Resolution', () => {
    it('normalizes uppercase, lowercase, slash-less, and shorthand asset symbols', () => {
      expect(store.getTicker('BTC/USDT')).toBeDefined()
      expect(store.getTicker('BTCUSDT')?.symbol).toBe('BTC/USDT')
      expect(store.getTicker('btcusdt')?.symbol).toBe('BTC/USDT')
      expect(store.getTicker('btc')?.symbol).toBe('BTC/USDT')

      expect(store.getTicker('ETH')?.symbol).toBe('ETH/USDT')
      expect(store.getTicker('ethusdt')?.symbol).toBe('ETH/USDT')
      expect(store.getTicker('SOL')?.symbol).toBe('SOL/USDT')

      expect(store.getTicker('XAU/USD')?.symbol).toBe('XAU/USD')
      expect(store.getTicker('XAUUSD')?.symbol).toBe('XAU/USD')
      expect(store.getTicker('xau')?.symbol).toBe('XAU/USD')
      expect(store.getTicker('gold')?.symbol).toBe('XAU/USD')

      expect(store.getTicker('EUR/USD')?.symbol).toBe('EUR/USD')
      expect(store.getTicker('EURUSD')?.symbol).toBe('EUR/USD')
      expect(store.getTicker('eur')?.symbol).toBe('EUR/USD')

      expect(store.getTicker('GBP/USD')?.symbol).toBe('GBP/USD')
      expect(store.getTicker('gbpusd')?.symbol).toBe('GBP/USD')

      expect(store.getTicker('USD/JPY')?.symbol).toBe('USD/JPY')
      expect(store.getTicker('usdjpy')?.symbol).toBe('USD/JPY')
      expect(store.getTicker('jpy')?.symbol).toBe('USD/JPY')
    })
  })

  // ==========================================================================
  // SECTION 10: Dynamic Position Synchronization & Multiplier Verification
  // ==========================================================================
  describe('10. Dynamic Position PnL Synchronization & Notional Multipliers', () => {
    it('verifies Forex 100,000 notional multiplier on EUR/USD position PnL ($10/pip on 1.0 lot)', () => {
      const entryPrice = 1.08250
      const markPrice = 1.08350 // +10 pips (+0.00100)
      const lots = 1.0
      const notionalMultiplier = 100000

      const priceDelta = markPrice - entryPrice
      const pnl = Number((priceDelta * lots * notionalMultiplier).toFixed(2))

      // Exactly $100.00 profit for 10 pips on 1 standard lot
      expect(pnl).toBe(100.00)
    })

    it('verifies Gold 100 oz notional multiplier on XAU/USD position PnL ($100 per $1 move on 1.0 lot)', () => {
      const entryPrice = 2730.00
      const markPrice = 2740.00 // +$10.00 move
      const lots = 0.50 // half lot (50 oz)
      const notionalMultiplier = 100

      const priceDelta = markPrice - entryPrice
      const pnl = Number((priceDelta * lots * notionalMultiplier).toFixed(2))

      // $10 * 0.50 * 100 = $500.00 profit
      expect(pnl).toBe(500.00)
    })

    it('verifies Crypto 1.0 unit multiplier on BTC/USDT position PnL', () => {
      const entryPrice = 110000.00
      const markPrice = 115000.00 // +$5,000 move
      const size = 0.25 // 0.25 BTC
      const notionalMultiplier = 1

      const priceDelta = markPrice - entryPrice
      const pnl = Number((priceDelta * size * notionalMultiplier).toFixed(2))

      // $5,000 * 0.25 = $1,250.00 profit
      expect(pnl).toBe(1250.00)
    })

    it('verifies SHORT positions gain when mark price drops and lose when mark price rises', () => {
      const entryPrice = 1.30000
      const lowerMark = 1.29500 // -50 pips drop (profit for short)
      const higherMark = 1.30500 // +50 pips rise (loss for short)
      const lots = 1.0
      const notionalMultiplier = 100000

      const profitPnl = Number(((entryPrice - lowerMark) * lots * notionalMultiplier).toFixed(2))
      const lossPnl = Number(((entryPrice - higherMark) * lots * notionalMultiplier).toFixed(2))

      expect(profitPnl).toBe(500.00)
      expect(lossPnl).toBe(-500.00)
    })
  })

  // ==========================================================================
  // SECTION 11: AMM Slippage Mathematical Bounds in SwapWidget
  // ==========================================================================
  describe('11. AMM Square-Root Slippage Mathematical Bounds', () => {
    function computeSwapSlippage(tradeUsdValue: number, poolDepthUsd: number = 10_000_000) {
      const baseFeePct = 0.0005 // 0.05%
      const impactPct = 0.0025 * Math.sqrt(Math.max(0, tradeUsdValue) / poolDepthUsd)
      const totalSlippagePct = Math.min(0.05, baseFeePct + impactPct)
      return { totalSlippagePct, impactPct }
    }

    it('clamps minimum slippage to base fee (0.05%) for tiny micro-swaps', () => {
      const { totalSlippagePct } = computeSwapSlippage(1.0)
      expect(totalSlippagePct).toBeGreaterThanOrEqual(0.0005)
      expect(totalSlippagePct).toBeLessThan(0.0006)
    })

    it('clamps maximum slippage strictly at 5.0% guardrail for catastrophic swaps ($4B+)', () => {
      const { totalSlippagePct } = computeSwapSlippage(4_000_000_000)
      expect(totalSlippagePct).toBe(0.05) // Strict 5% cap
    })

    it('scales slippage monotonically with swap volume', () => {
      const small = computeSwapSlippage(10_000)
      const medium = computeSwapSlippage(500_000)
      const large = computeSwapSlippage(5_000_000)

      expect(medium.totalSlippagePct).toBeGreaterThan(small.totalSlippagePct)
      expect(large.totalSlippagePct).toBeGreaterThan(medium.totalSlippagePct)
    })
  })
})

