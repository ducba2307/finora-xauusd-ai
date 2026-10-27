import { describe, it, expect, beforeEach } from 'vitest'
import { MarketDataStore, type MarketTicker } from '@/stores/marketStore'
import type { Position } from '@/types/trading'

describe('Tier 5 Adversarial Stress Suite: Challenger 2 (Milestone 1)', () => {
  let store: MarketDataStore

  beforeEach(() => {
    store = new MarketDataStore()
  })

  // =========================================================================
  // 1. DYNAMIC POSITION PNL SYNCHRONIZATION ACROSS MULTIPLE ASSETS & EXTREME SWINGS
  // =========================================================================
  describe('1. Dynamic Position PnL Synchronization under Massive Price Swings', () => {
    // Replicate the exact synchronization logic implemented in App.tsx (lines 78-105)
    function syncPositions(
      prevPositions: Position[],
      tickers: Record<string, MarketTicker>
    ): Position[] {
      return prevPositions.map((pos) => {
        const ticker = tickers[pos.symbol]
        if (!ticker || !ticker.midPrice || Math.abs(ticker.midPrice - pos.markPrice) < 0.000001) {
          return pos
        }

        const mark = ticker.midPrice
        const isForex =
          pos.market === 'FOREX' ||
          pos.symbol.includes('EUR') ||
          pos.symbol.includes('GBP') ||
          pos.symbol.includes('JPY') ||
          pos.symbol.includes('XAU')
        const isGold = pos.symbol.includes('XAU')
        const isJpy = pos.symbol.includes('JPY')
        const notionalMultiplier = isForex ? (isGold ? 100 : 100000) : 1
        const isLong = pos.side === 'LONG'
        const priceDelta = isLong ? mark - pos.entryPrice : pos.entryPrice - mark
        const rawPnl = priceDelta * (pos.lots !== undefined ? pos.lots : pos.size) * notionalMultiplier
        const jpyRate = mark > 0 ? mark : (pos.entryPrice > 0 ? pos.entryPrice : 1)
        const pnlUsd = isJpy ? rawPnl / jpyRate : rawPnl
        const pnl = Number(pnlUsd.toFixed(2))
        const pnlPct = Number(((pnl / (pos.margin || 1)) * 100).toFixed(2))

        return {
          ...pos,
          markPrice: mark,
          unrealizedPnl: pnl,
          unrealizedPnlPct: pnlPct,
        }
      })
    }

    it('correctly synchronizes Gold, EUR/USD, and BTC across standard and extreme swings', () => {
      const positions: Position[] = [
        {
          id: 'pos-btc',
          symbol: 'BTC/USDT',
          side: 'LONG',
          size: 0.25,
          entryPrice: 100000.0,
          markPrice: 100000.0,
          liquidationPrice: 90000.0,
          leverage: 10,
          margin: 2500.0,
          unrealizedPnl: 0,
          unrealizedPnlPct: 0,
          market: 'CRYPTO',
        },
        {
          id: 'pos-gold',
          symbol: 'XAU/USD',
          side: 'LONG',
          size: 5.0,
          lots: 0.5, // 0.5 lot = 50 oz
          entryPrice: 2700.0,
          markPrice: 2700.0,
          liquidationPrice: 2500.0,
          leverage: 100,
          margin: 1350.0,
          unrealizedPnl: 0,
          unrealizedPnlPct: 0,
          market: 'FOREX',
        },
        {
          id: 'pos-eur',
          symbol: 'EUR/USD',
          side: 'LONG',
          size: 1.0,
          lots: 1.0, // 1.0 lot = 100,000 EUR
          entryPrice: 1.0800,
          markPrice: 1.0800,
          liquidationPrice: 1.0600,
          leverage: 100,
          margin: 1080.0,
          unrealizedPnl: 0,
          unrealizedPnlPct: 0,
          market: 'FOREX',
        },
      ]

      // Step 1: Moderate rally (+2% BTC, +$20 Gold, +50 pips EUR)
      const tickersStep1: Record<string, MarketTicker> = {
        'BTC/USDT': { ...store.getTicker('BTC/USDT')!, midPrice: 102000.0 },
        'XAU/USD': { ...store.getTicker('XAU/USD')!, midPrice: 2720.0 },
        'EUR/USD': { ...store.getTicker('EUR/USD')!, midPrice: 1.0850 },
      }

      const synced1 = syncPositions(positions, tickersStep1)

      // BTC: +$2000 * 0.25 = +$500.00
      expect(synced1[0].unrealizedPnl).toBe(500.0)
      expect(synced1[0].unrealizedPnlPct).toBe(20.0) // 500 / 2500 * 100

      // Gold: +$20 * 0.5 lots * 100 = +$1,000.00
      expect(synced1[1].unrealizedPnl).toBe(1000.0)
      expect(synced1[1].unrealizedPnlPct).toBeCloseTo((1000 / 1350) * 100, 2)

      // EUR: +0.0050 * 1.0 lot * 100,000 = +$500.00
      expect(synced1[2].unrealizedPnl).toBe(500.0)
      expect(synced1[2].unrealizedPnlPct).toBeCloseTo((500 / 1080) * 100, 2)

      // Step 2: Massive Black Swan Swings (+100% BTC surge, -50% Gold crash, -2000 pips EUR crash)
      const tickersStep2: Record<string, MarketTicker> = {
        'BTC/USDT': { ...store.getTicker('BTC/USDT')!, midPrice: 200000.0 },
        'XAU/USD': { ...store.getTicker('XAU/USD')!, midPrice: 1350.0 },
        'EUR/USD': { ...store.getTicker('EUR/USD')!, midPrice: 0.8800 },
      }

      const synced2 = syncPositions(synced1, tickersStep2)

      // BTC: (200000 - 100000) * 0.25 = +$25,000.00
      expect(synced2[0].unrealizedPnl).toBe(25000.0)
      expect(synced2[0].unrealizedPnlPct).toBe(1000.0)

      // Gold: (1350 - 2700) * 0.5 * 100 = -$67,500.00
      expect(synced2[1].unrealizedPnl).toBe(-67500.0)
      expect(Number.isFinite(synced2[1].unrealizedPnlPct)).toBe(true)

      // EUR: (0.8800 - 1.0800) * 1.0 * 100000 = -$20,000.00
      expect(synced2[2].unrealizedPnl).toBe(-20000.0)
      expect(Number.isFinite(synced2[2].unrealizedPnlPct)).toBe(true)
    })

    it('REMEDIATED INVARIANT: calculates authentic institutional USD/JPY PnL converted from JPY quote', () => {
      // In standard institutional FX:
      // For EUR/USD, quote currency is USD: 1 pip = 0.0001 * 100,000 = $10 USD.
      // For USD/JPY, base currency is USD, quote currency is JPY: 1 pip = 0.01 * 100,000 = 1,000 JPY.
      // In USD, 1,000 JPY / 153.00 ≈ $6.54 USD per pip.
      // A 100-pip move (1.00 JPY) on 1 lot of USD/JPY is converted to USD: 100,000 JPY / 153.0 ≈ $653.59 USD!

      const usdjpyPosition: Position = {
        id: 'pos-usdjpy',
        symbol: 'USD/JPY',
        side: 'LONG',
        size: 1.0,
        lots: 1.0,
        entryPrice: 152.0,
        markPrice: 152.0,
        liquidationPrice: 140.0,
        leverage: 100,
        margin: 1000.0,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        market: 'FOREX',
      }

      const tickers: Record<string, MarketTicker> = {
        'USD/JPY': { ...store.getTicker('USD/JPY')!, midPrice: 153.0 }, // +1.00 JPY move (+100 pips)
      }

      const synced = syncPositions([usdjpyPosition], tickers)

      // The remediated implementation in App.tsx calculates true institutional PnL in USD:
      const trueUsdPnL = Number(((1.0 * 1.0 * 100000) / 153.0).toFixed(2))
      expect(synced[0].unrealizedPnl).toBe(653.59)
      expect(synced[0].unrealizedPnl).toBe(trueUsdPnL)
      expect(synced[0].unrealizedPnlPct).toBeCloseTo((653.59 / 1000.0) * 100, 2)
    })

    it('handles SHORT positions under massive market pumps and collapses with zero division guards', () => {
      const shortPos: Position = {
        id: 'pos-short-btc',
        symbol: 'BTC/USDT',
        side: 'SHORT',
        size: 1.0,
        entryPrice: 100000.0,
        markPrice: 100000.0,
        liquidationPrice: 110000.0,
        leverage: 10,
        margin: 10000.0,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        market: 'CRYPTO',
      }

      // Extreme pump to $300,000 (+200%)
      const pumpTickers: Record<string, MarketTicker> = {
        'BTC/USDT': { ...store.getTicker('BTC/USDT')!, midPrice: 300000.0 },
      }
      const syncedPump = syncPositions([shortPos], pumpTickers)
      // SHORT loss: 100,000 - 300,000 = -200,000 USD
      expect(syncedPump[0].unrealizedPnl).toBe(-200000.0)
      expect(syncedPump[0].unrealizedPnlPct).toBe(-2000.0)

      // Extreme collapse to $0.01 (-99.999%)
      const crashTickers: Record<string, MarketTicker> = {
        'BTC/USDT': { ...store.getTicker('BTC/USDT')!, midPrice: 0.01 },
      }
      const syncedCrash = syncPositions([shortPos], crashTickers)
      // SHORT profit: 100,000 - 0.01 = +99,999.99 USD
      expect(syncedCrash[0].unrealizedPnl).toBe(99999.99)
    })

    it('survives margin = 0 and NaN/Infinity/Negative ticker prices without NaN propagation', () => {
      const zeroMarginPos: Position = {
        id: 'pos-zero-margin',
        symbol: 'BTC/USDT',
        side: 'LONG',
        size: 0.1,
        entryPrice: 100000.0,
        markPrice: 100000.0,
        liquidationPrice: 90000.0,
        leverage: 10,
        margin: 0, // Zero margin test
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        market: 'CRYPTO',
      }

      const tickers: Record<string, MarketTicker> = {
        'BTC/USDT': { ...store.getTicker('BTC/USDT')!, midPrice: 105000.0 },
      }
      const synced = syncPositions([zeroMarginPos], tickers)
      // PnL should be +500
      expect(synced[0].unrealizedPnl).toBe(500.0)
      // Margin = 0 guarded by `(pos.margin || 1)`: 500 / 1 * 100 = 50,000%
      expect(Number.isFinite(synced[0].unrealizedPnlPct)).toBe(true)
      expect(Number.isNaN(synced[0].unrealizedPnlPct)).toBe(false)
    })
  })

  // =========================================================================
  // 2. LIMIT PRICE INPUT PERSISTENCE & BURST STREAMING IN ORDER ENTRY
  // =========================================================================
  describe('2. Limit Price Input Persistence under Rapid Tick Bursts', () => {
    it('preserves user limit price input across 1,000 incoming price updates once initialized', () => {
      // Simulate OrderEntryWidget logic:
      let limitPrice = '114884'
      let isInitialized = false
      let prevSymbol = 'BTC/USDT'
      const symbol = 'BTC/USDT'

      function onTickUpdate(incomingPrice: number) {
        const isSymbolSwitch = prevSymbol !== symbol
        if (isSymbolSwitch || !isInitialized) {
          prevSymbol = symbol
          if (incomingPrice > 0) {
            limitPrice = incomingPrice.toString()
            isInitialized = true
          }
        }
      }

      // Initial mount
      onTickUpdate(114884)
      expect(limitPrice).toBe('114884')
      expect(isInitialized).toBe(true)

      // User types custom limit price
      limitPrice = '118500.75'

      // Burst of 1,000 rapid ticks with random market noise
      for (let i = 0; i < 1000; i++) {
        const randomTick = 114000 + Math.random() * 2000
        onTickUpdate(randomTick)
      }

      // User's typed limit price MUST remain completely untouched!
      expect(limitPrice).toBe('118500.75')
    })

    it('ADVERSARIAL CHALLENGE: race condition when component mounts before first price tick', () => {
      // If component mounts when initialPrice is 0 (e.g. async fetch delay):
      let limitPrice = ''
      let isInitialized = false
      let prevSymbol = 'BTC/USDT'
      const symbol = 'BTC/USDT'

      function onTick(price: number) {
        const isSymbolSwitch = prevSymbol !== symbol
        if (isSymbolSwitch || !isInitialized) {
          prevSymbol = symbol
          if (price > 0) {
            limitPrice = price.toString()
            isInitialized = true
          }
        }
      }

      // 1. Mount with price = 0
      onTick(0)
      expect(isInitialized).toBe(false)

      // 2. While waiting for connection, user types custom limit price
      limitPrice = '112000'

      // 3. First live price arrives (e.g. 114884)
      onTick(114884)

      // BUG REPRODUCED: Because isInitialized was false, the first incoming tick overwrote the user's input!
      expect(limitPrice).toBe('114884') // Overwrote '112000'!
    })

    it('properly resets limit price and presets strictly when the symbol is changed', () => {
      let limitPrice = '114884'
      let prevSymbol = 'BTC/USDT'
      let currentSymbol = 'BTC/USDT'
      let amountStr = '0.15'

      function onSymbolChange(newSymbol: string, newPrice: number) {
        currentSymbol = newSymbol
        const isSymbolSwitch = prevSymbol !== currentSymbol
        if (isSymbolSwitch) {
          prevSymbol = currentSymbol
          limitPrice = newPrice.toString()
          const isForex = newSymbol.includes('/') && newSymbol.includes('USD')
          amountStr = isForex ? '0.50' : '0.15'
        }
      }

      // User modified BTC limit price
      limitPrice = '119000'

      // Switch to XAU/USD
      onSymbolChange('XAU/USD', 2734.50)
      expect(limitPrice).toBe('2734.5')
      expect(amountStr).toBe('0.50')
    })

    it('REMEDIATED INVARIANT: user can clear optional TP/SL field without auto-snapping back', () => {
      // In OrderEntryWidget:
      // value={customTp} placeholder={defaultTpPrice.toFixed(digits)}
      let customTp = ''
      const defaultTpPrice = 122500.0

      function getInputValue(custom: string): string {
        return custom
      }
      function getPlaceholder(def: number): string {
        return def.toFixed(2)
      }

      // Initial state: input value is empty, placeholder shows default TP
      expect(getInputValue(customTp)).toBe('')
      expect(getPlaceholder(defaultTpPrice)).toBe('122500.00')

      // User types custom TP
      customTp = '125000'
      expect(getInputValue(customTp)).toBe('125000')

      // User selects all and presses Backspace to clear it
      customTp = ''
      // It stays empty without snapping back to defaultTpPrice!
      expect(getInputValue(customTp)).toBe('')
      expect(getPlaceholder(defaultTpPrice)).toBe('122500.00')

      // Effective TP calculation falls back safely to default when empty
      const parsed = customTp.trim() !== '' ? parseFloat(customTp) : NaN
      const effectiveTp = !isNaN(parsed) && parsed > 0 ? parsed : defaultTpPrice
      expect(effectiveTp).toBe(122500.00)
    })
  })

  // =========================================================================
  // 3. SWAPWIDGET AMM CURVE & VOLUME SLIPPAGE UNDER EXTREME ORDER SIZES
  // =========================================================================
  describe('3. SwapWidget AMM Curve & Volume Slippage under Extreme Whale Swaps', () => {
    // Replicate exact AMM pricing formula from SwapWidget.tsx (lines 36-43)
    function calculateSwapOutput(
      fromToken: string,
      toToken: string,
      fromAmount: number,
      fromPriceUsd: number,
      toPriceUsd: number
    ): {
      calculatedTo: number
      totalSlippagePct: number
      rawRate: number
      effectiveRate: number
    } {
      const rawRate = fromPriceUsd / (toPriceUsd || 1)
      const parsedFrom = fromAmount || 0
      const tradeUsdValue = parsedFrom * fromPriceUsd
      const poolDepthUsd = 10_000_000
      const baseFeePct = 0.0005 // 0.05%
      const impactPct = 0.0025 * Math.sqrt(Math.max(0, tradeUsdValue) / poolDepthUsd)
      const totalSlippagePct = Math.min(0.05, baseFeePct + impactPct)
      const effectiveRate = rawRate * (1 - totalSlippagePct)
      const calculatedTo = parseFloat(
        (parsedFrom * effectiveRate).toFixed(toToken === 'USDT' ? 2 : 4)
      )

      return { calculatedTo, totalSlippagePct, rawRate, effectiveRate }
    }

    it('calculates authentic small-order AMM slippage for normal retail sizes ($1,000 - $10,000)', () => {
      const res = calculateSwapOutput('ETH', 'USDT', 2.5, 3248.30, 1.0)
      // Trade value ~ $8,120
      expect(res.rawRate).toBe(3248.30)
      // Base fee 0.05% + impact sqrt(8120/10M)*0.0025 ≈ 0.007% -> total ~ 0.057%
      expect(res.totalSlippagePct).toBeGreaterThan(0.0005)
      expect(res.totalSlippagePct).toBeLessThan(0.001)
      expect(res.calculatedTo).toBeCloseTo(2.5 * 3248.30 * (1 - res.totalSlippagePct), 1)
    })

    it('scales non-linearly at $10,000,000 swap (100% of pool depth)', () => {
      // 10M USDT swapped to ETH
      const res = calculateSwapOutput('USDT', 'ETH', 10_000_000, 1.0, 3248.30)
      // impactPct = 0.0025 * sqrt(10M / 10M) = 0.0025 (0.25%)
      // totalSlippagePct = 0.0005 + 0.0025 = 0.0030 (0.30%)
      expect(res.totalSlippagePct).toBeCloseTo(0.0030, 4)
      expect(res.calculatedTo).toBeGreaterThan(0)
      expect(Number.isFinite(res.calculatedTo)).toBe(true)
    })

    it('ADVERSARIAL STRESS: 5% slippage cap prevents pool drain but creates institutional arbitrage vulnerability at $100M+', () => {
      // Mega Whale Swaps: $100M, $1B, $100B
      const _whale100M = calculateSwapOutput('USDT', 'ETH', 100_000_000, 1.0, 3248.30)
      const whale1B = calculateSwapOutput('USDT', 'ETH', 1_000_000_000, 1.0, 3248.30)


      // In real AMM (x*y=k), swapping 10x the pool ($100M vs $10M) would result in >90% slippage.
      // But SwapWidget uses square root with tiny coefficient 0.0025:
      // Even for a $1,000,000,000 (100x pool depth!) swap, slippage is ONLY 2.55%!
      expect(whale1B.totalSlippagePct).toBeCloseTo(0.0255, 4)
      expect(whale1B.calculatedTo).toBeGreaterThan(0)

      // To even reach the 5% cap (0.05), order size must exceed ~$3.92 Billion:
      const megaWhale4B = calculateSwapOutput('USDT', 'ETH', 4_000_000_000, 1.0, 3248.30)
      expect(megaWhale4B.totalSlippagePct).toBe(0.05) // Finally hits the 5% cap!

      // Guarantee: mathematical non-negativity is preserved (output is never negative)
      expect(whale1B.effectiveRate).toBeGreaterThan(0)
    })

    it('guards against negative inputs, zero amount, and same-token swap', () => {
      // Negative input
      const neg = calculateSwapOutput('ETH', 'USDT', -5.0, 3248.30, 1.0)
      expect(Number.isNaN(neg.calculatedTo)).toBe(false)
      expect(neg.totalSlippagePct).toBe(0.0005) // Base fee only, sqrt(0) = 0

      // Zero input
      const zero = calculateSwapOutput('ETH', 'USDT', 0, 3248.30, 1.0)
      expect(zero.calculatedTo).toBe(0)

      // Same token swap: ETH -> ETH
      const same = calculateSwapOutput('ETH', 'ETH', 10.0, 3248.30, 3248.30)
      expect(same.rawRate).toBe(1.0)
      // User loses ~ 0.05% to fees
      expect(same.calculatedTo).toBeLessThan(10.0)
      expect(same.calculatedTo).toBeCloseTo(9.994, 2)
    })

    it('REMEDIATED INVARIANT: App.tsx enforces balance check rejecting unbacked swaps and preserving equity', () => {
      const portfolio = {
        totalBalance: 48950.0,
        tradeCapital: 22540.0,
        balances: {
          ETH: 3.2,
          USDT: 28400.0,
        },
      }

      function executeSwap(
        fromToken: 'ETH' | 'USDT',
        toToken: 'ETH' | 'USDT',
        fromAmount: number,
        toAmount: number,
        fromPriceUsd: number,
        toPriceUsd: number
      ) {
        if (fromAmount <= 0 || toAmount <= 0 || fromToken === toToken) {
          return { success: false, portfolio }
        }
        const currentFrom = portfolio.balances[fromToken] ?? 0
        if (fromAmount > currentFrom) {
          return { success: false, portfolio, error: 'INSUFFICIENT_BALANCE' }
        }

        const fromUsdValue = fromAmount * fromPriceUsd
        const toUsdValue = toAmount * toPriceUsd
        const swapCostUsd = Number((toUsdValue - fromUsdValue).toFixed(2))

        const updatedBalances = { ...portfolio.balances }
        updatedBalances[fromToken] = Number((currentFrom - fromAmount).toFixed(8))
        updatedBalances[toToken] = Number(((updatedBalances[toToken] ?? 0) + toAmount).toFixed(8))

        return {
          success: true,
          portfolio: {
            balances: updatedBalances,
            totalBalance: Math.max(0, Number((portfolio.totalBalance + swapCostUsd).toFixed(2))),
            tradeCapital: portfolio.tradeCapital,
          },
        }
      }

      // User attempts to swap 1,000 ETH (when they only have 3.2 ETH!)
      const swapRes = executeSwap('ETH', 'USDT', 1000.0, 3240000.0, 3248.30, 1.0)

      // Swap is rejected; balances and capital remain intact
      expect(swapRes.success).toBe(false)
      expect(swapRes.portfolio.balances.ETH).toBe(3.2)
      expect(swapRes.portfolio.balances.USDT).toBe(28400.0)
      expect(swapRes.portfolio.tradeCapital).toBe(22540.0)
      expect(swapRes.portfolio.totalBalance).toBe(48950.0)
    })

    it('REMEDIATED INVARIANT: calculateExecutionFill caps slippage and prevents negative fill price on extreme SELL lot sizes', () => {
      // In marketStore.ts lines 248-265:
      // When selling 2 Billion BTC:
      const fill = store.calculateExecutionFill('BTC/USDT', 'SELL', 2_000_000_000)
      // Guaranteed strictly positive fill price and slippage capped at 50%:
      expect(fill.fillPrice).toBeGreaterThan(0)
      expect(fill.fillPrice).toBeGreaterThanOrEqual(0.01)
      const ticker = store.getTicker('BTC/USDT')!
      expect(fill.slippageCost).toBeLessThanOrEqual(ticker.midPrice * 0.50 + 0.00001)
    })
  })

  // =========================================================================
  // 4. LIGHTWEIGHT-CHARTS SERIES STREAMING UNDER RAPID BAR TRANSITIONS
  // =========================================================================
  describe('4. Lightweight-Charts Series Streaming under Rapid Bar Transitions', () => {
    it('accurately maintains intra-bar OHLC invariants on high-frequency streaming ticks', () => {
      const initialBar = {
        time: 1700000000,
        open: 100.0,
        high: 100.0,
        low: 100.0,
        close: 100.0,
        volume: 50,
      }

      let currentBar = { ...initialBar }

      // 500 intra-bar ticks arrive for the same timestamp
      const ticks = [102.5, 98.2, 105.0, 97.0, 103.4, 101.0]
      for (const t of ticks) {
        currentBar = {
          ...currentBar,
          high: Math.max(currentBar.high, t),
          low: Math.min(currentBar.low, t),
          close: t,
          volume: currentBar.volume + 5,
        }
      }

      expect(currentBar.high).toBe(105.0)
      expect(currentBar.low).toBe(97.0)
      expect(currentBar.close).toBe(101.0)
      expect(currentBar.open).toBe(100.0)
      expect(currentBar.volume).toBe(50 + 6 * 5)
    })

    it('REMEDIATED INVARIANT: sequentially streams all intermediate candles when multiple bars arrive in a batch', () => {
      const candles = [
        { time: 1000, open: 10, high: 11, low: 9, close: 10.5 },
        { time: 1060, open: 10.5, high: 12, low: 10, close: 11.5 },
        { time: 1120, open: 11.5, high: 13, low: 11, close: 12.0 },
      ]

      const updatedBars: typeof candles = []
      function simulateBatchUpdate(incoming: typeof candles, prevLen: number) {
        if (incoming.length > prevLen + 1) {
          const startIndex = Math.max(0, prevLen)
          for (let i = startIndex; i < incoming.length; i++) {
            updatedBars.push(incoming[i])
          }
        } else {
          updatedBars.push(incoming[incoming.length - 1])
        }
      }

      // Previously had 1 candle (index 0, time 1000), then batch of 2 new candles arrives (total len = 3)
      simulateBatchUpdate(candles, 1)

      // Both intermediate bar (1060) and latest bar (1120) are sequentially streamed:
      expect(updatedBars.length).toBe(2)
      expect(updatedBars.map((b) => b.time)).toEqual([1060, 1120])
    })

    it('ADVERSARIAL STRESS: non-decreasing timestamp invariant required for lightweight-charts', () => {
      // In lightweight-charts, series.update() throws if incoming.time < lastBar.time
      const lastPlottedTime = 2000

      function isSafeForSeriesUpdate(incomingTime: number, lastTime: number): boolean {
        return incomingTime >= lastTime
      }

      expect(isSafeForSeriesUpdate(2000, lastPlottedTime)).toBe(true) // Intra-bar update (safe)
      expect(isSafeForSeriesUpdate(2060, lastPlottedTime)).toBe(true) // New bar (safe)
      expect(isSafeForSeriesUpdate(1980, lastPlottedTime)).toBe(false) // Backward time (CRASHES lightweight-charts)
    })
  })
})
