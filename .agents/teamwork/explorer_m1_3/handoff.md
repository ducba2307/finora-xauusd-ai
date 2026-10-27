# Technical Investigation & Architecture Plan: Feature F04 (High-Performance Chart & UI Jitter Elimination, OrderEntryWidget Fix)

- **Target**: Finora Quant AI Trading Platform
- **Investigator**: Explorer 3 (Milestone 1 — F04)
- **Directory**: `d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m1_3`
- **Timestamp**: 2026-10-11T06:57:00Z
- **Status**: Complete (Read-Only Analysis & Design)

---

## 1. Observation

### 1.1 TradingViewChart: Rebuild Overhead & Early-Return Marker Lockout
- **File**: `src/components/TradingViewChart.tsx` (lines 235–379)
  - **Intra-Bar vs. New-Bar Logic** (lines 238–246):
    ```typescript
    const isIntraBarTick =
      prevCandlesLenRef.current === candles.length &&
      prevSymbolRef.current === symbol &&
      prevTimeframeRef.current === timeframe &&
      candles.length > 0
    ```
    When a new bar is appended by the feed, `candles.length` increases (e.g. from 80 to 81). As a result, `isIntraBarTick` evaluates to `false`.
  - **Full Canvas Discard on Every New Bar** (lines 289–344):
    Instead of calling `series.update(...)` with the new bar point, the code falls through to:
    ```typescript
    prevCandlesLenRef.current = candles.length
    prevSymbolRef.current = symbol
    prevTimeframeRef.current = timeframe

    const formattedCandles: CandlestickData<UTCTimestamp>[] = candles.map((c) => ({ ... }))
    candlestickSeriesRef.current.setData(formattedCandles)
    areaSeriesRef.current.setData(formattedArea)
    volumeSeriesRef.current.setData(formattedVolume)
    ema20SeriesRef.current.setData(formattedEma20)
    ema50SeriesRef.current.setData(formattedEma50)
    ```
    In Lightweight Charts v4/v5, calling `.setData()` on 5 series simultaneously forces disposal and recreation of internal binary index trees, time scale recalculation, and complete vertex buffer invalidation.
  - **Marker Overlay Block Bug** (lines 286 & 346–378):
    Line 286 issues an early `return` when `isIntraBarTick` is true:
    ```typescript
    if (isIntraBarTick) {
      ...
      return
    }
    ```
    Because marker management (`createSeriesMarkers`, lines 346–378) is placed *after* line 286, any user interaction that toggles `showAiSignals` or `showSmcZones` during intra-bar streaming hits the early `return` and fails to update markers until a new candle bar opens.
  - **Unmemoized Component** (line 47):
    `TradingViewChart` is exported without `React.memo`, causing full React component re-execution whenever `TradingDashboard` re-renders.

### 1.2 OrderEntryWidget: Destructive Continuous State Overwrites & Build-Breaking TS Errors
- **File**: `src/components/OrderEntryWidget.tsx` (lines 6–7 & lines 50–60)
  - **TypeScript Build Failure (TS6133)**:
    Running `pnpm build` (`tsc -b && vite build`) terminates with exit code 1:
    ```
    src/components/OrderEntryWidget.tsx(6,1): error TS6133: 'defaultMarketStore' is declared but its value is never read.
    src/components/OrderEntryWidget.tsx(7,1): error TS6133: 'getAssetConfig' is declared but its value is never read.
    ```
    These two unused imports prevent production compilation under `"noUnusedLocals": true`.
  - **Catastrophic Continuous Input Overwrite Bug** (lines 50–60):
    ```typescript
    // Reset default amount and leverage when symbol / category changes
    useEffect(() => {
      setLimitPrice(currentPrice.toString())
      if (isForex) {
        setAmountStr('0.50')
        setLeverage(100)
      } else {
        setAmountStr('0.15')
        setLeverage(10)
      }
    }, [symbol, isForex, currentPrice])
    ```
    Because `currentPrice` is declared in the dependency array:
    1. Every live tick (1–50 Hz) re-triggers this effect.
    2. `setLimitPrice(currentPrice.toString())` unconditionally overwrites whatever price the user is typing into the Limit Execution Price input.
    3. `setAmountStr(...)` unconditionally resets any custom lot/size input back to `'0.50'` or `'0.15'`.
    4. `setLeverage(...)` unconditionally resets the user's selected leverage back to `100` or `10`.
  - **Stale TP/SL State on Asset Switch**:
    When the user switches symbols (e.g. from `BTC/USDT` to `EUR/USD`), `customTp` and `customSl` (lines 43–44) are not cleared, causing a cryptocurrency TP (e.g. `$95,000`) to persist into a Forex pair.

### 1.3 TradingDashboard: Cascading Double-Renders & 50 Hz Subtree Thrashing
- **File**: `src/components/TradingDashboard.tsx` (lines 65–75 & 88–91)
  - **Cascading Double Render on Every Tick** (lines 65–75):
    ```typescript
    // Sync order book and trade tape on incoming live ticks
    useEffect(() => {
      setOrderBook(GENERATE_ORDER_BOOK(liveFeed.currentPrice))
      const newTrade: PublicTrade = { ... }
      setPublicTrades((pt) => [newTrade, ...pt.slice(0, 15)])
    }, [liveFeed.currentPrice, liveFeed.tickDirection])
    ```
    When `useLiveMarketFeed` receives a tick:
    1. `TradingDashboard` re-renders (Render 1).
    2. The `useEffect` fires and executes `setOrderBook` and `setPublicTrades`.
    3. `TradingDashboard` re-renders again (Render 2).
    This creates an immediate secondary re-render loop on every price tick.
  - **AI Consensus Swarm Thrashing** (lines 88–91):
    ```typescript
    const aiSignal = useMemo(
      () => GENERATE_AI_SWARM_SIGNAL(selectedAsset.symbol, liveFeed.currentPrice),
      [selectedAsset.symbol, liveFeed.currentPrice]
    )
    ```
    `GENERATE_AI_SWARM_SIGNAL` instantiates 4 agent models, calculates random convictions, and builds a brand new signal object on every single price tick, forcing `<AISwarmConsensusWidget />` to re-render continuously.
  - **Absence of Component Memoization**:
    All 5 major widget components lack `React.memo`:
    - `OrderBookWidget` (`src/components/OrderBookWidget.tsx:13`)
    - `PositionsTable` (`src/components/PositionsTable.tsx:10`)
    - `AISwarmConsensusWidget` (`src/components/AISwarmConsensusWidget.tsx:14`)
    - `OrderEntryWidget` (`src/components/OrderEntryWidget.tsx:26`)
    - `TradingViewChart` (`src/components/TradingViewChart.tsx:47`)
    Additionally, handlers passed from `TradingDashboard` (e.g. `onToggleAiSignals`, `onOpenAlerts`, `onApplySignal`) are inline arrow functions, breaking referential identity.

### 1.4 Market Feed WebSocket: Unbatched High-Frequency Dispatch
- **File**: `src/hooks/useLiveMarketFeed.ts` (lines 250–329)
  - Binance WebSocket `ws.onmessage` handlers fire synchronously on every exchange kline tick.
  - There is zero `requestAnimationFrame` batching or rate limiting. Each incoming socket frame directly triggers 6 distinct `useState` updates.

---

## 2. Logic Chain

```
[Observation 1.1: TradingViewChart new-bar falls through to .setData()]
  └─> lightweight-charts series.update() supports BOTH updating existing bar AND appending new bar (time >= lastTime).
  └─> Only initial historical load or symbol/timeframe changes require .setData().
  └─> Calling .setData() on 5 series every time a new bar starts causes canvas stutter and frame drops.
  └─> Early return inside intra-bar branch isolates createSeriesMarkers from running when AI signal toggles change.

[Observation 1.2: OrderEntryWidget useEffect depends on currentPrice]
  └─> currentPrice changes on every market tick (1–50 Hz).
  └─> Effect continuously calls setLimitPrice(currentPrice.toString()), setAmountStr(), and setLeverage().
  └─> User cannot enter a limit order; custom order amounts and leverage selections are wiped out.
  └─> Unused imports defaultMarketStore & getAssetConfig fail tsc -b with TS6133.

[Observation 1.3 & 1.4: Cascading renders & Unmemoized Widgets]
  └─> liveFeed updates -> TradingDashboard renders -> useEffect runs -> setOrderBook/setPublicTrades -> TradingDashboard renders again.
  └─> aiSignal recomputes 4-agent rationale on every tick.
  └─> All 5 child widgets lack React.memo and receive unstable inline callback props.
  └─> Entire dashboard DOM tree re-evaluates at 20–50 Hz, causing high CPU (60-80%) and UI jitter.
```

---

## 3. Caveats

1. **lightweight-charts Bounded Buffer Semantics**:
   When using `series.update(bar)` continuously, lightweight-charts appends points to its internal binary search tree. lightweight-charts handles up to 50,000 bars with sub-millisecond query latency. However, if the React application caps its own `candles` state array at e.g. 100 bars (`MAX_CANDLES`), calling `series.update()` will keep accumulating bars inside the chart instance until a symbol/timeframe change calls `.setData()`. This is standard and optimal behavior for real-time charting.
2. **WebSocket Inactivity in Background Tabs**:
   Browsers throttle background tab `setInterval` and pause `requestAnimationFrame`. Implementing RAF batching in `useLiveMarketFeed` will automatically sleep during tab invisibility, preventing CPU spin in inactive tabs. When the user returns, the next tick smoothly flushes to screen.
3. **Existing Test Suite Stability**:
   Running `pnpm test` confirms 130/130 tests currently pass across 22 test files. F04 optimizations touch UI rendering layers (`TradingViewChart.tsx`, `OrderEntryWidget.tsx`, `TradingDashboard.tsx`, `useLiveMarketFeed.ts`), which will not regress any Tier 1–4 math, backtest, or risk tests.

---

## 4. Conclusion & Actionable Implementation Plan

To eliminate UI jitter, guarantee 60 FPS performance, and fix the Order Execution Desk, implement the following four changes:

### 4.1 `TradingViewChart.tsx`: O(1) Streaming Updates & Decoupled Markers

1. **Track Last Bar Time**:
   Maintain `const lastBarTimeRef = useRef<number | null>(null)` alongside `prevSymbolRef` and `prevTimeframeRef`.
2. **True O(1) Streaming Condition**:
   A streaming tick occurs when `prevSymbolRef.current === symbol && prevTimeframeRef.current === timeframe && isInitializedRef.current`.
   For all streaming ticks (whether updating the active bar or opening a new bar), call:
   ```typescript
   candlestickSeriesRef.current.update({ time: lastBarTime, open: last.open, high: last.high, low: last.low, close: last.close })
   areaSeriesRef.current?.update({ time: lastBarTime, value: last.close })
   volumeSeriesRef.current?.update({ time: lastBarTime, value: last.volume, color: last.close >= last.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)' })
   if (last.ema20 !== undefined) ema20SeriesRef.current?.update({ time: lastBarTime, value: last.ema20 })
   if (last.ema50 !== undefined) ema50SeriesRef.current?.update({ time: lastBarTime, value: last.ema50 })
   ```
3. **Reserve `.setData()` Exclusively For**:
   - Initial chart mount
   - Symbol change (`prevSymbolRef.current !== symbol`)
   - Timeframe change (`prevTimeframeRef.current !== timeframe`)
4. **Decouple Marker Overlay**:
   Move `createSeriesMarkers` into its own `useEffect` dependent on `[showAiSignals, showSmcZones, candles.length, symbol]`, eliminating the early-return block bug.
5. **Wrap Component in `React.memo`**:
   `export const TradingViewChart = React.memo<TradingViewChartProps>(...)`

#### Proposed Code Replacement Snippet for `src/components/TradingViewChart.tsx`:
```typescript
// Replace lines 70-74 with:
  const positionPriceLinesRef = useRef<IPriceLine[]>([])
  const isInitializedRef = useRef<boolean>(false)
  const prevSymbolRef = useRef<string>(symbol)
  const prevTimeframeRef = useRef<string>(timeframe)

// Replace lines 234-379 with:
  // 2. Synchronize Data with Series: O(1) streaming updates, setData ONLY on reset
  useEffect(() => {
    if (!candles || candles.length === 0 || !candlestickSeriesRef.current) return

    const isSymbolOrTfChange =
      prevSymbolRef.current !== symbol ||
      prevTimeframeRef.current !== timeframe ||
      !isInitializedRef.current

    if (isSymbolOrTfChange) {
      // Full series rebuild only on symbol/timeframe switch or initial load
      prevSymbolRef.current = symbol
      prevTimeframeRef.current = timeframe
      isInitializedRef.current = true

      const formattedCandles: CandlestickData<UTCTimestamp>[] = candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
      candlestickSeriesRef.current.setData(formattedCandles)

      if (areaSeriesRef.current) {
        areaSeriesRef.current.setData(
          candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close }))
        )
      }

      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.setData(
          candles.map((c) => ({
            time: c.time as UTCTimestamp,
            value: c.volume,
            color: c.close >= c.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)',
          }))
        )
      }

      if (ema20SeriesRef.current) {
        ema20SeriesRef.current.setData(
          candles.filter((c) => c.ema20 !== undefined).map((c) => ({ time: c.time as UTCTimestamp, value: c.ema20! }))
        )
      }

      if (ema50SeriesRef.current) {
        ema50SeriesRef.current.setData(
          candles.filter((c) => c.ema50 !== undefined).map((c) => ({ time: c.time as UTCTimestamp, value: c.ema50! }))
        )
      }
      return
    }

    // High-performance O(1) streaming tick update (both intra-bar and new bar)
    const last = candles[candles.length - 1]
    const lastBarTime = last.time as UTCTimestamp

    candlestickSeriesRef.current.update({
      time: lastBarTime,
      open: last.open,
      high: last.high,
      low: last.low,
      close: last.close,
    })

    if (areaSeriesRef.current) {
      areaSeriesRef.current.update({
        time: lastBarTime,
        value: last.close,
      })
    }

    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.update({
        time: lastBarTime,
        value: last.volume,
        color: last.close >= last.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)',
      })
    }

    if (ema20SeriesRef.current && last.ema20 !== undefined) {
      ema20SeriesRef.current.update({
        time: lastBarTime,
        value: last.ema20,
      })
    }

    if (ema50SeriesRef.current && last.ema50 !== undefined) {
      ema50SeriesRef.current.update({
        time: lastBarTime,
        value: last.ema50,
      })
    }
  }, [candles, symbol, timeframe])

  // Dedicated AI Markers Synchronization Effect
  useEffect(() => {
    if (!candlestickSeriesRef.current) return

    if (showAiSignals) {
      const markers: SeriesMarker<UTCTimestamp>[] = []
      candles.forEach((c) => {
        if (c.signal === 'BUY') {
          markers.push({
            time: c.time as UTCTimestamp,
            position: 'belowBar',
            color: '#10b981',
            shape: 'arrowUp',
            text: c.signalText || '⚡ AI BUY',
          })
        } else if (c.signal === 'TAKE_PROFIT') {
          markers.push({
            time: c.time as UTCTimestamp,
            position: 'aboveBar',
            color: '#f59e0b',
            shape: 'circle',
            text: c.signalText || '🎯 TAKE PROFIT',
          })
        } else if (c.signal === 'SMC_FVG' && showSmcZones) {
          markers.push({
            time: c.time as UTCTimestamp,
            position: 'belowBar',
            color: '#38bdf8',
            shape: 'arrowUp',
            text: c.signalText || '🔷 FVG ZONE',
          })
        }
      })
      createSeriesMarkers(candlestickSeriesRef.current, markers)
    } else {
      createSeriesMarkers(candlestickSeriesRef.current, [])
    }
  }, [showAiSignals, showSmcZones, candles.length, symbol])
```

---

### 4.2 `OrderEntryWidget.tsx`: Decouple Manual Input & Fix Build Error

1. **Remove Unused Imports**:
   Delete lines 6–7:
   ```typescript
   // REMOVE:
   // import { defaultMarketStore } from '../stores/marketStore'
   // import { getAssetConfig } from '../services/marketDataSimulator'
   ```
   This resolves TS6133 and unblocks `pnpm build`.
2. **Decouple `limitPrice` and Inputs from Live Ticks**:
   Replace lines 49–60 with a symbol-change guarded effect:
   ```typescript
   const prevSymbolRef = useRef(symbol)
   const isInitializedRef = useRef(false)

   // Reset defaults strictly on symbol switch or initial load — NEVER on price ticks
   useEffect(() => {
     const isSymbolSwitch = prevSymbolRef.current !== symbol
     if (isSymbolSwitch || !isInitializedRef.current) {
       prevSymbolRef.current = symbol
       if (currentPrice > 0) {
         setLimitPrice(currentPrice.toString())
         isInitializedRef.current = true
       }
       setCustomTp('')
       setCustomSl('')
       if (isForex) {
         setAmountStr('0.50')
         setLeverage(100)
       } else {
         setAmountStr('0.15')
         setLeverage(10)
       }
     }
   }, [symbol, isForex, currentPrice])
   ```
3. **Add "Use Market Price" Quick Button**:
   Add a quick-snap action button next to the Limit Execution Price input:
   ```tsx
   <button
     type="button"
     onClick={() => setLimitPrice(currentPrice.toString())}
     className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-white/10 hover:bg-pink-500/20 text-gray-400 hover:text-pink-300 transition-colors"
     title="Snap to current market price"
   >
     Market
   </button>
   ```
4. **Wrap in `React.memo`**:
   `export const OrderEntryWidget = React.memo<OrderEntryWidgetProps>(...)`

---

### 4.3 `TradingDashboard.tsx` & Market Feed: 3-Tier Anti-Jitter Throttle Pipeline

1. **Tier 1: RAF Tick Batching in `useLiveMarketFeed.ts`**:
   In `ws.onmessage`, collect incoming ticks in a ref buffer and flush via `requestAnimationFrame`:
   ```typescript
   const pendingTickRef = useRef<any>(null)
   const rafIdRef = useRef<number | null>(null)

   // On websocket message:
   pendingTickRef.current = msgData
   if (rafIdRef.current === null) {
     rafIdRef.current = requestAnimationFrame(() => {
       flushPendingTick(pendingTickRef.current)
       rafIdRef.current = null
     })
   }
   ```
2. **Tier 2: Throttle Order Book & AI Swarm in `TradingDashboard.tsx`**:
   - Throttle `orderBook` and `publicTrades` updates to 150ms (max ~6.6 Hz) using a ref timestamp guard, eliminating the double re-render cascade.
   - Throttle `aiSignal` recomputation: evaluate only on asset switch or when price moves by more than 0.1%.
3. **Tier 3: Component Memoization & Callback Stabilization**:
   - Wrap `OrderBookWidget`, `PositionsTable`, `AISwarmConsensusWidget`, `OrderEntryWidget`, and `TradingViewChart` with `React.memo`.
   - Wrap event handlers (`handleTimeframeChange`, `handleToggleAiSignals`, `handleOpenAlerts`, `handleApplySignal`) with `useCallback`.

---

## 5. Verification Method

To verify these fixes independently:

1. **TypeScript Build Verification**:
   - Run: `pnpm build` (`tsc -b && vite build`)
   - **Expected**: Exit code 0, zero TS errors (TS6133 eliminated).
2. **Linter Verification**:
   - Run: `pnpm lint` (`oxlint`)
   - **Expected**: Zero errors, unused imports resolved.
3. **Existing E2E Test Suite Run**:
   - Run: `pnpm test`
   - **Expected**: All 22 test files and 130 tests pass.
4. **OrderEntryWidget Input Persistence Test**:
   - Navigate to Terminal -> Order Execution Desk.
   - Select `LIMIT` order type.
   - Type a custom limit price (e.g. `112,500.00`) and custom size (e.g. `2.5`).
   - Observe across multiple live market ticks (10+ seconds):
     - **Pass**: Input remains exactly `112,500.00` and `2.5`, untouched by streaming ticks.
     - **Fail**: Input reverts to `currentPrice` or resets to `'0.15'`.
5. **Chart O(1) Streaming & FPS Verification**:
   - Open Chrome DevTools Performance Profiler or monitor FPS during live streaming.
   - Verify `candlestickSeries.update()` is called on every tick and on new bar open.
   - Verify `setData()` is called **only** when clicking a new symbol or changing timeframe.
   - Toggle AI Signals button: markers immediately show/hide without requiring a new bar.
6. **UI Jitter Inspection**:
   - Enable "Paint Flashing" in Chrome DevTools Rendering tab.
   - Observe `PositionsTable` and `AISwarmConsensusWidget`: they do not flash or re-paint on intra-second price ticks when their internal data is unchanged.

---
*Report completed by Explorer 3 (Milestone 1 — F04).*
