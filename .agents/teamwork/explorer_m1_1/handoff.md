# Technical Investigation & Architectural Specification: Milestone 1 (F01 & F02)

**Target**: Finora Quant AI Trading Platform  
**Features**: F01 (Centralized Market Data Store), F02 (Calibrated Market Feed Engine)  
**Workspace**: `d:\VIBECODE\finora-trading-ai`  
**Investigator**: Explorer 1 (Milestone 1)  
**Date**: 2026-10-11T06:58:00Z  

---

## 1. Observation

### 1.1 `src/stores/marketStore.ts`: Store Isolation & Lifecycle Coupling
- **File**: `src/stores/marketStore.ts` (lines 25–298)
  - `MarketDataStore` implements `MarketTicker` matching `PROJECT.md § Interface Contracts § 1`:
    ```typescript
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
    ```
  - Default initialization (lines 34–145) populates seven core instruments:
    - **Crypto**: `BTC/USDT`, `ETH/USDT`, `SOL/USDT`
    - **Forex/Metals**: `XAU/USD`, `EUR/USD`, `GBP/USD`, `USD/JPY`
  - **Deficiency (Passive Store)**: `defaultMarketStore = new MarketDataStore()` is entirely passive. It maintains an in-memory `Map<string, MarketTicker>` and provides pub/sub methods (`subscribeTicker`, `subscribeAll`), but does **not** host an internal streaming loop or background runner.
  - **Single-Symbol Dependency**: `defaultMarketStore.setTicker(...)` is invoked **only** inside `src/hooks/useLiveMarketFeed.ts:108` (`syncMarketStore`).
  - **Lifecycle Coupling**: `useLiveMarketFeed` is only mounted in `src/components/TradingDashboard.tsx:54` for `selectedAsset.symbol`. When the trader switches navigation tabs (`NavView`) to `QuantStudioView`, `TradingJournalView`, `WhaleRadarView`, or `PortfolioView`, `TradingDashboard` unmounts. Consequently:
    1. The WebSocket closes.
    2. The simulation interval stops.
    3. `defaultMarketStore` halts all updates.
    4. The remaining six non-selected symbols never receive price updates even while the user is inside `TradingDashboard`.
    5. Autonomous AI bot strategy loops (`botEngine.ts` in Milestone 3) and margin liquidation checks receive zero ticks in the background.

### 1.2 `src/hooks/useLiveMarketFeed.ts`: Collision Race Conditions & EMA Double Finalization
- **File**: `src/hooks/useLiveMarketFeed.ts` (lines 136–370)
  - **Race Condition in WebSocket Lifecycle**:
    In lines 336–350:
    ```typescript
    ws.onclose = () => {
      if (!isComponentMountedRef.current) return
      startFallbackSimulation()
      const attempts = reconnectAttemptsRef.current
      const backoffMs = Math.min(30000, 1000 * Math.pow(1.5, attempts))
      reconnectAttemptsRef.current += 1
      reconnectTimeoutRef.current = setTimeout(() => {
        if (isComponentMountedRef.current) connectWebSocket()
      }, backoffMs)
    }
    ```
    When the user switches symbols or timeframes, the cleanup function runs:
    ```typescript
    return () => {
      isComponentMountedRef.current = false
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      stopFallbackSimulation()
    }
    ```
    However, when `ws.close()` is executed, the browser dispatches the `onclose` event asynchronously on the event loop. If the new effect has already mounted and reset `isComponentMountedRef.current = true`, the stale `onclose` handler from the old socket fires with `isComponentMountedRef.current === true`, spawning a ghost `reconnectTimeout` and starting a rogue `fallbackInterval` in parallel with the active connection.
  - **EMA Double-Finalization Flaw**:
    In Binance WebSocket handler lines 282–320:
    ```typescript
    if (candleTime === lastCandle.time) {
      ...
      if (isBarClosed) {
        closedEma20Ref.current = calculateClosedBarEMA(closedEma20Ref.current, closeP, 20)
        closedEma50Ref.current = calculateClosedBarEMA(closedEma50Ref.current, closeP, 50)
      }
      ...
    } else if (candleTime > lastCandle.time) {
      // Finalize previous candle closed EMA
      closedEma20Ref.current = calculateClosedBarEMA(closedEma20Ref.current, lastCandle.close, 20)
      closedEma50Ref.current = calculateClosedBarEMA(closedEma50Ref.current, lastCandle.close, 50)
      ...
    }
    ```
    When Binance emits a kline message with `k.x === true` (`isBarClosed`), `closedEma20Ref` is updated for `closeP`. Then, on the subsequent tick when `candleTime > lastCandle.time` arrives, `closedEma20Ref` is updated **again** with `lastCandle.close`. This applies double exponential decay to the closed bar EMA, distorting the technical indicator baseline.

### 1.3 `src/services/marketDataSimulator.ts`: Calibrated ECN Interbank Modeling
- **File**: `src/services/marketDataSimulator.ts` (lines 114–197)
  - `boxMullerRandom()` (lines 117–123) correctly generates Gaussian random variables $Z \sim \mathcal{N}(0, 1)$.
  - `getSessionVolatilityMultiplier()` (lines 133–147) provides institutional session multipliers (Asian: 0.8x, London: 1.3x, London/NY Overlap: 1.6x, NY Afternoon: 1.1x, Rollover: 0.6x).
  - `simulateNextGBMTick()` (lines 153–197):
    ```typescript
    const dt = dtSeconds / 31557600
    const sigmaEff = cfg.annualVol * sessionMultiplier
    const z = boxMullerRandom()
    const drift = 0
    const shock = sigmaEff * Math.sqrt(dt) * z
    const priceChange = currentPrice * (drift + shock)
    ```
  - **Observation on Drift**: Drift is set to 0. Over extended paper trading sessions, an unanchored random walk will slowly wander arbitrarily far from realistic market levels without mean-reverting stabilizing forces (Ornstein-Uhlenbeck drift towards a session anchor price $S_0$).
  - **Single-Symbol Limitation**: The simulator lacks a batch function to step all non-selected Forex/Gold instruments simultaneously for the global `MarketDataStore`.

### 1.4 `src/data/mockData.ts`: Candle Timestamp Alignment & Order Book Spreads
- **File**: `src/data/mockData.ts` (lines 858–876 & 777–812)
  - `GENERATE_CANDLESTICK_SERIES` generates historical candles as follows:
    ```typescript
    const nowSec = Math.floor(Date.now() / 1000)
    const startSec = nowSec - count * intervalSeconds
    for (let i = 0; i < count; i++) {
      const time = startSec + i * intervalSeconds
    ```
    Because `nowSec` is not rounded to `intervalSeconds`, candle timestamps have arbitrary second offsets (e.g., `1773004523` where seconds = 23).
  - In `useLiveMarketFeed.ts:167`, incoming ticks are aligned to:
    ```typescript
    const alignedNow = alignTimestampToInterval(nowSec, intervalSec) // e.g. 1773004800 (seconds = 00)
    ```
    Because the historical array ended at `...523` while live ticks arrive at `...800`, the comparison `alignedNow > lastCandle.time` causes an irregular time jump and misaligned bar rendering on `lightweight-charts`.
  - In `GENERATE_ORDER_BOOK` (lines 777–812):
    ```typescript
    const step = basePrice > 1000 ? 2.5 : basePrice > 100 ? 0.25 : 0.0002
    ```
    This hardcodes a 50 pip spread ($5.00) on Gold (`XAU/USD`), which is 25x–40x wider than the institutional standard (1.2–2.5 pips). It ignores the calibrated `spreadPips` properties in `ASSET_CONFIGS`.

### 1.5 Downstream UI Desynchronization
- **File**: `src/App.tsx` (lines 59, 130–163)
  - `positions` is initialized from `INITIAL_POSITIONS` and stored in local `useState`.
  - `App.tsx` never subscribes to `defaultMarketStore`. As a result, open positions' `markPrice`, `unrealizedPnl`, and `unrealizedPnlPct` remain frozen at mock values. Closing a position executes at stale prices.
- **File**: `src/components/OrderEntryWidget.tsx` (lines 50–59 & 133–151)
  - `currentPrice` is placed in the dependency array of the `useEffect` that initializes `limitPrice`, continually wiping out user input during live tick streaming.
  - When submitting an order, it fills at mid-price (`currentPrice`) without invoking `defaultMarketStore.calculateExecutionFill`.

---

## 2. Logic Chain

1. **[Observation 1.1]** `defaultMarketStore` relies exclusively on `useLiveMarketFeed` for updates, but `useLiveMarketFeed` is only instantiated for the active symbol on the `TradingDashboard` page.
   - $\rightarrow$ When navigating away from `TradingDashboard` or tracking non-active symbols, market prices freeze.
   - $\rightarrow$ **Deduction**: A background feeder must be integrated directly into `MarketDataStore` (or an autonomous global feed service) so all seven instruments update continuously regardless of mounted UI views.

2. **[Observation 1.2]** Async `onclose` events and reconnect timers fire after effect cleanup has completed, while the new effect has already initialized.
   - $\rightarrow$ Old handlers trigger fallback intervals while the new WebSocket is opening, producing dual-stream mutation collisions on candle state.
   - $\rightarrow$ Furthermore, `isBarClosed` updates `closedEma20Ref`, and the subsequent `candleTime > lastCandle.time` branch updates it again with the same close price.
   - $\rightarrow$ **Deduction**: A generation epoch counter (`connectionEpochRef`) and strict mutual exclusion must govern connection states. Closed-bar EMA must be finalized exactly once using a `lastFinalizedBarTimeRef` guard.

3. **[Observation 1.3]** `simulateNextGBMTick` uses unanchored Brownian motion ($\text{drift} = 0$). Over hours of continuous runtime, cumulative variance $\sigma \sqrt{t}$ leads to random walk divergence from real prices.
   - $\rightarrow$ **Deduction**: An Ornstein-Uhlenbeck mean-reversion drift component against an anchor price $S_0$ ensures price excursions realistically revert towards fair market equilibrium during extended paper trading sessions.

4. **[Observation 1.4]** `GENERATE_CANDLESTICK_SERIES` uses unaligned starting timestamps (`nowSec - count * intervalSeconds`), while live feeds align to exact multiples (`Math.floor(nowSec / interval) * interval`).
   - $\rightarrow$ This causes timestamp boundary jitter between historical and streaming candles.
   - $\rightarrow$ **Deduction**: Historical series must start from `alignedCurrentBarTime - (count - 1) * intervalSeconds` so that all candles share a uniform modulo-$T$ timestamp lattice.

5. **[Observation 1.5]** `App.tsx` does not listen to `defaultMarketStore`, and `OrderEntryWidget` does not invoke `calculateExecutionFill`.
   - $\rightarrow$ Positions remain static and orders fill with $0.00 slippage/spread.
   - $\rightarrow$ **Deduction**: `App.tsx` must subscribe to `defaultMarketStore.subscribeAll`, dynamically syncing open positions, floating PnL, and account equity on every market tick.

---

## 3. Caveats

- **Node/Vitest Test Environment**: `WebSocket` is either absent or unmocked in Node.js test workers. All background network feed initializations must be guarded with `typeof window !== 'undefined' && typeof WebSocket !== 'undefined' && !process.env.VITEST` to prevent test runner crashes.
- **Binance Public WebSocket Availability**: In certain restricted corporate networks or geofenced environments, `stream.binance.com:9443` may block WebSocket handshakes. The hybrid fallback mechanism must cleanly switch to calibrated simulation mode within 4.0 seconds if `CONNECTING` fails to reach `OPEN`.
- **Existing Tests**: 130/130 Vitest tests are currently passing. All modifications to `marketStore.ts`, `marketDataSimulator.ts`, and `useLiveMarketFeed.ts` must maintain complete backwards compatibility with existing test assertions in `src/test/tier1_features/marketDataSlippage.test.ts` and `src/test/tier3_pairwise/tickFeedPositionSync.test.ts`.

---

## 4. Conclusion & Technical File-by-File Specification

To fulfill F01 and F02 to institutional standards, the following concrete modifications are specified for Milestone 1 implementers:

### 4.1 Specification for `src/stores/marketStore.ts` (F01)

#### Requirements
1. Maintain the full `MarketTicker` interface and existing 7-instrument registry.
2. Introduce an autonomous `GlobalMarketFeedManager` inside `MarketDataStore`:
   - Automatically starts upon client initialization (`typeof window !== 'undefined'`).
   - Runs a periodic timer (1200ms) that advances all Forex/Metals instruments (`XAU/USD`, `EUR/USD`, `GBP/USD`, `USD/JPY`) via `simulateNextGBMTick`.
   - Listens to Binance combined WebSocket or steps Crypto fallback simulation for `BTC/USDT`, `ETH/USDT`, `SOL/USDT`.
   - Exposes `startGlobalFeed()` and `stopGlobalFeed()`.
3. Add `useAllMarketTickers()` hook that subscribes to `subscribeAll`.
4. Add safe normalization for symbols (`BTC`, `btcusdt`, `BTC/USDT`, `XAUUSD`, `xau/usd`).

#### Exact Implementation Structure
```typescript
// Proposed additions to src/stores/marketStore.ts

export class MarketDataStore {
  private tickers: Map<string, MarketTicker> = new Map()
  private listeners: Map<string, Set<(ticker: MarketTicker) => void>> = new Map()
  private allListeners: Set<(tickers: Record<string, MarketTicker>) => void> = new Set()
  private feedInterval: ReturnType<typeof setInterval> | null = null
  private isFeedRunning: boolean = false

  constructor() {
    this.initializeDefaultTickers()
    // Auto-start background feeder in browser environment
    if (typeof window !== 'undefined' && !(window as any).__VITEST_ENVIRONMENT__) {
      this.startGlobalFeed()
    }
  }

  public startGlobalFeed(): void {
    if (this.isFeedRunning) return
    this.isFeedRunning = true

    this.feedInterval = setInterval(() => {
      // Step all Forex instruments via calibrated ECN GBM
      const forexSymbols = ['XAU/USD', 'EUR/USD', 'GBP/USD', 'USD/JPY']
      for (const sym of forexSymbols) {
        const current = this.getTicker(sym)
        if (!current) continue

        const tick = simulateNextGBMTick(sym, current.midPrice, 1.2)
        const updated: MarketTicker = {
          ...current,
          midPrice: tick.nextPrice,
          bidPrice: tick.bidPrice,
          askPrice: tick.askPrice,
          spreadPips: tick.spreadPips,
          spreadUsd: tick.spreadUsd,
          lastUpdateTimestamp: Date.now(),
          connectionStatus: 'SIMULATED',
        }
        this.setTicker(updated)
      }
    }, 1200)
  }

  public stopGlobalFeed(): void {
    if (this.feedInterval) {
      clearInterval(this.feedInterval)
      this.feedInterval = null
    }
    this.isFeedRunning = false
  }
}

/**
 * React hook to subscribe to the entire multi-asset ticker registry
 */
export function useAllMarketTickers(): Record<string, MarketTicker> {
  const [tickers, setTickers] = useState<Record<string, MarketTicker>>(() =>
    defaultMarketStore.getAllTickers()
  )

  useEffect(() => {
    setTickers(defaultMarketStore.getAllTickers())
    return defaultMarketStore.subscribeAll((updated) => {
      setTickers(updated)
    })
  }, [])

  return tickers
}
```

---

### 4.2 Specification for `src/services/marketDataSimulator.ts` (F02)

#### Requirements
1. Enhance `simulateNextGBMTick` with Ornstein-Uhlenbeck mean-reverting micro-drift against an anchor price.
2. Incorporate dynamic spread expansion during large volatility shocks ($|Z| > 2.0$).
3. Maintain exact decimal digits per asset (`digits: 5` for EUR/USD and GBP/USD; `3` for USD/JPY; `2` for XAU/USD and Crypto).
4. Provide `alignTimestampToInterval` and safe closed/provisional EMA calculators.

#### Exact Code Specification
```typescript
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
  
  const dt = dtSeconds / 31557600
  const sigmaEff = cfg.annualVol * sessionMultiplier
  const z = boxMullerRandom()

  // Mild Ornstein-Uhlenbeck mean-reversion drift towards anchor price (reversion speed kappa = 0.08)
  const baseAnchor = anchorPrice && anchorPrice > 0 ? anchorPrice : currentPrice
  const deviation = (baseAnchor - currentPrice) / baseAnchor
  const kappa = 0.08
  const drift = kappa * deviation

  const shock = sigmaEff * Math.sqrt(dt) * z
  const priceChange = currentPrice * (drift * dt + shock)

  const rawNext = Math.max(0.00001, currentPrice + priceChange)
  const nextPrice = Number(rawNext.toFixed(cfg.digits))

  // Dynamic spread fluctuation + 1.5x expansion on 2-sigma volatility shock
  const spreadSpread = cfg.maxSpreadPips - cfg.minSpreadPips
  const spreadNoise = (Math.random() + Math.random()) / 2
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
```

---

### 4.3 Specification for `src/hooks/useLiveMarketFeed.ts` (F02)

#### Requirements
1. **Generation Epoch Pattern**: Track `connectionEpochRef.current` to cancel stale asynchronous `onclose` and `reconnectTimeout` handlers.
2. **Mutual Exclusion**: If `wsRef.current` opens successfully, verify `stopFallbackSimulation()` has executed and confirm only one feed mutates state.
3. **EMA Single Finalization**: Track `lastFinalizedBarTimeRef` so that `calculateClosedBarEMA` is called exactly once when transitioning between bars.
4. **Candle Boundary Alignment**: Derive historical series from aligned start time and align incoming ticks to `alignTimestampToInterval`.

#### Exact Code Architecture
```typescript
export function useLiveMarketFeed(
  symbol: string,
  timeframe: string = '1H',
  category: MarketCategory = 'CRYPTO',
  initialPrice: number = 114884.00
): LiveMarketFeedState {
  // ... state declarations ...

  const connectionEpochRef = useRef<number>(0)
  const closedEma20Ref = useRef<number | undefined>(undefined)
  const closedEma50Ref = useRef<number | undefined>(undefined)
  const lastFinalizedBarTimeRef = useRef<number | null>(null)

  useEffect(() => {
    const currentEpoch = ++connectionEpochRef.current
    let fallbackInterval: ReturnType<typeof setInterval> | null = null
    const intervalSec = getTimeframeSeconds(timeframe)

    const stopFallback = () => {
      if (fallbackInterval) {
        clearInterval(fallbackInterval)
        fallbackInterval = null
      }
    }

    const startFallback = () => {
      if (currentEpoch !== connectionEpochRef.current) return
      if (fallbackInterval) return

      setConnectionStatus('SIMULATED')
      setLatencyMs(Math.floor(5 + Math.random() * 8))

      fallbackInterval = setInterval(() => {
        if (currentEpoch !== connectionEpochRef.current) return

        setCandles((prevCandles) => {
          if (prevCandles.length === 0) return prevCandles
          const lastIdx = prevCandles.length - 1
          const lastCandle = prevCandles[lastIdx]

          const tick = simulateNextGBMTick(symbol, lastCandle.close, 1.5)
          const nextClose = tick.nextPrice
          const nowSec = Math.floor(Date.now() / 1000)
          const alignedNow = alignTimestampToInterval(nowSec, intervalSec)

          const updated = [...prevCandles]

          if (alignedNow > lastCandle.time) {
            // New Bar: Finalize previous candle EMA exactly once
            if (lastFinalizedBarTimeRef.current !== lastCandle.time) {
              closedEma20Ref.current = calculateClosedBarEMA(closedEma20Ref.current, lastCandle.close, 20)
              closedEma50Ref.current = calculateClosedBarEMA(closedEma50Ref.current, lastCandle.close, 50)
              lastFinalizedBarTimeRef.current = lastCandle.time
            }

            const newEma20 = calculateProvisionalEMA(closedEma20Ref.current, nextClose, 20)
            const newEma50 = calculateProvisionalEMA(closedEma50Ref.current, nextClose, 50)

            updated.push({
              time: alignedNow,
              open: nextClose,
              high: nextClose,
              low: nextClose,
              close: nextClose,
              volume: Math.round(10 + Math.random() * 20),
              ema20: newEma20,
              ema50: newEma50,
            })
          } else {
            // Intra-bar update: Safe provisional preview
            const provEma20 = calculateProvisionalEMA(closedEma20Ref.current, nextClose, 20)
            const provEma50 = calculateProvisionalEMA(closedEma50Ref.current, nextClose, 50)

            updated[lastIdx] = {
              ...lastCandle,
              close: nextClose,
              high: Math.max(lastCandle.high, nextClose),
              low: Math.min(lastCandle.low, nextClose),
              volume: lastCandle.volume + Math.round(Math.random() * 3),
              ema20: provEma20,
              ema50: provEma50,
            }
          }

          syncMarketStore(symbol, nextClose, 'SIMULATED')
          return updated
        })
      }, 1500)
    }

    if (isForex) {
      startFallback()
    } else {
      // Connect WebSocket with Epoch guard
      const wsUrl = `wss://stream.binance.com:9443/ws/${symbol.replace('/', '').toLowerCase()}@kline_${timeframe.toLowerCase()}`
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        if (currentEpoch !== connectionEpochRef.current) {
          ws.close()
          return
        }
        stopFallback()
        setConnectionStatus('LIVE_WS')
      }

      ws.onmessage = (event) => {
        if (currentEpoch !== connectionEpochRef.current) return
        // parse message and update candles + provisional EMA ...
      }

      ws.onerror = () => {
        if (currentEpoch === connectionEpochRef.current) startFallback()
      }

      ws.onclose = () => {
        if (currentEpoch === connectionEpochRef.current) startFallback()
      }
    }

    return () => {
      connectionEpochRef.current++
      stopFallback()
      if (wsRef.current) {
        wsRef.current.onopen = null
        wsRef.current.onmessage = null
        wsRef.current.onerror = null
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [symbol, timeframe, isForex])
}
```

---

### 4.4 Specification for `src/data/mockData.ts` (Alignment & Order Book)

#### 1. Timestamp Alignment in `GENERATE_CANDLESTICK_SERIES`
Replace lines 874–882 with aligned interval boundaries:
```typescript
// Aligned historical series generation
const nowSec = Math.floor(Date.now() / 1000)
const currentBarTime = Math.floor(nowSec / intervalSeconds) * intervalSeconds
const startSec = currentBarTime - (count - 1) * intervalSeconds

const candles: CandlestickPoint[] = []
for (let i = 0; i < count; i++) {
  const time = startSec + i * intervalSeconds
  // ...
}
```

#### 2. Order Book Calibration in `GENERATE_ORDER_BOOK`
Forward `GENERATE_ORDER_BOOK` directly to `generateInstitutionalOrderBook(symbol, basePrice)` from `services/marketDataSimulator.ts`, eliminating the 50 pip Gold spread artifact.

---

### 4.5 Downstream Integrations for Milestone 1 Completeness

1. **`src/App.tsx` Position Sync**:
   Add a root-level listener:
   ```typescript
   useEffect(() => {
     return defaultMarketStore.subscribeAll((tickers) => {
       setPositions((prev) =>
         prev.map((pos) => {
           const ticker = tickers[pos.symbol]
           if (!ticker) return pos
           const mark = ticker.midPrice
           const isLong = pos.side === 'LONG'
           const diff = isLong ? mark - pos.entryPrice : pos.entryPrice - mark
           const isGold = pos.symbol.includes('XAU')
           const isForex = pos.market === 'FOREX' || pos.symbol.includes('/')
           const notionalMult = isForex ? (isGold ? 100 : 100000) : 1
           const pnl = Number((diff * pos.size * notionalMult).toFixed(2))
           const pnlPct = Number(((pnl / (pos.margin || 1)) * 100).toFixed(2))
           return { ...pos, markPrice: mark, unrealizedPnl: pnl, unrealizedPnlPct: pnlPct }
         })
       )
     })
   }, [])
   ```
2. **`src/components/OrderEntryWidget.tsx`**:
   - Remove `currentPrice` from the `useEffect` on line 59: dependency array becomes `[symbol, isForex]`.
   - When placing a market order, invoke `defaultMarketStore.calculateExecutionFill(finalSymbol, side === 'LONG' ? 'BUY' : 'SELL', parsedAmount)` to establish realistic institutional entry prices with negative initial spread/slippage cost.

---

## 5. Verification Method

1. **Automated Unit & Integration Test Suite**:
   Execute:
   ```bash
   pnpm test
   ```
   **Pass Criteria**:
   - 100% of the 22 test files and 130 test cases pass.
   - Specific feature tests to verify:
     - `src/test/tier1_features/marketDataSlippage.test.ts` (F01, F02, F03)
     - `src/test/tier3_pairwise/tickFeedPositionSync.test.ts` (Live tick PnL sync)
     - `src/test/tier4_realworld/goldNewsVolatilitySpike.test.ts` (XAU/USD spread widening and tick volatility)

2. **TypeScript Static Analysis**:
   Execute:
   ```bash
   pnpm exec tsc -b
   ```
   **Pass Criteria**: Exit code 0, 0 diagnostic errors.

3. **Linter & Code Quality**:
   Execute:
   ```bash
   pnpm exec oxlint
   ```
   **Pass Criteria**: 0 errors.

4. **Independent Runtime Invalidation Conditions**:
   - Invalidate if WebSocket and fallback simulator simultaneously emit ticks to candles in console logs.
   - Invalidate if navigating to `PortfolioView` freezes `defaultMarketStore.getTicker('BTC/USDT').lastUpdateTimestamp`.
   - Invalidate if typing a custom price into Order Execution Desk Limit input gets overwritten on the next tick.
   - Invalidate if candle timestamps generated by `GENERATE_CANDLESTICK_SERIES` are not exact multiples of `intervalSeconds`.

---
*Report produced by Explorer 1 (Milestone 1).*
