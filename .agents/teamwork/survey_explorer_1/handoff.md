# Architectural Investigation & Survey Report: Requirement R1 (Market Data Fidelity & UI Engine)

**Target**: Finora Quant AI Trading Platform  
**Workspace**: `d:\VIBECODE\finora-trading-ai`  
**Investigator**: Survey Explorer 1  
**Timestamp**: 2026-10-11T03:47:00Z  

---

## 1. Observation

### 1.1 Market Data Streaming & WebSocket Service
- **File**: `src/hooks/useLiveMarketFeed.ts` (lines 68–170)
  - Connects to Binance public WebSocket: `wss://stream.binance.com:9443/ws/${streamSymbol}@kline_${tfStr}`.
  - When category is `'FOREX'` (e.g. XAU/USD, EUR/USD, GBP/USD, USD/JPY), lines 167–170 unconditionally set:
    ```typescript
    // Forex or Gold: Interbank ECN Simulation
    setConnectionStatus('LIVE_WS') // High-tier live feed simulation
    setLatencyMs(Math.floor(5 + Math.random() * 6))
    ```
    This fakes `LIVE_WS` status when it is actually an uncalibrated local random number generator.
  - **Concurrent Stream Collision Bug** (lines 173–207):
    `fallbackInterval = setInterval(...)` is instantiated **outside** the `if (!isForex)` branch. As a result, when crypto Binance WebSocket is actively connected and streaming real prices, the `fallbackInterval` continues firing every 1800ms and randomly perturbs `candles[lastIdx].close` with:
    ```typescript
    const delta = (Math.random() - 0.48) * volatilityMultiplier
    ```
    Real exchange ticks and synthetic random ticks collide and overwrite each other.
  - **Dead Hook**: `src/hooks/useBinanceTicker.ts` exists as 109 lines of standalone ticker logic, but has **zero imports or callers** in the entire codebase (`grep_search` found only its own declaration).
  - **Single-Symbol Isolation**: `useLiveMarketFeed` is only invoked inside `src/components/TradingDashboard.tsx:54` for the single currently selected asset. When switching tabs (e.g. to Quant Studio or Portfolio), the hook unmounts, the WebSocket closes, and no global market data exists for background positions or alert checking.

### 1.2 Mathematical & Indicator Flaws in Tick Simulation
- **File**: `src/hooks/useLiveMarketFeed.ts` (lines 116–124 & 143–144)
  - Exponential Moving Average (EMA) calculated inside WebSocket tick handler:
    ```typescript
    const alpha20 = 2 / 21
    const alpha50 = 2 / 51
    const newEma20 = lastCandle.ema20 
      ? Number((closeP * alpha20 + lastCandle.ema20 * (1 - alpha20)).toFixed(2)) 
      : closeP
    ```
    EMA is mathematically defined on closed bar intervals, not on intraday intra-candle ticks. Running recursive EMA decay on every incoming WebSocket tick (up to 20–50 times per minute) degrades the EMA to the instant close price.
  - When a new bar opens (line 143), `ema20` and `ema50` are reset to `closeP`, erasing all historical smoothing memory.
  - Bar alignment in `useLiveMarketFeed.ts:114`:
    `if (lastCandle.time === candleTime || Math.abs(lastCandle.time - candleTime) < 60)` uses arbitrary 60-second fuzziness that fails on higher timeframes (4H, 1D), causing duplicate candle injection.

### 1.3 Spread & Slippage Absence in Execution Desk & Order Book
- **File**: `src/components/OrderEntryWidget.tsx` (lines 77–80 & 136–137)
  ```typescript
  const activePrice = (orderType === 'LIMIT' || orderType === 'TWAP' || orderType === 'ICEBERG') 
    ? (parseFloat(limitPrice) || currentPrice) 
    : currentPrice
  ...
  entryPrice: activePrice,
  markPrice: currentPrice,
  unrealizedPnl: 0,
  ```
  Market orders fill exactly at the mid price (`currentPrice`). There is **zero spread** (no Ask/Bid distinction) and **zero slippage** applied. An institutional order opens with `$0.00` unrealized PnL instead of negative spread/commission.
- **File**: `src/data/mockData.ts` (lines 777–812, `GENERATE_ORDER_BOOK`)
  ```typescript
  const step = basePrice > 1000 ? 2.5 : basePrice > 100 ? 0.25 : 0.0002
  ```
  - For Gold (`XAU/USD` around $2734), `step = 2.5`. The computed spread is `bestAsk - bestBid = 5.00 USD` (50 pips). Institutional gold raw spread is 0.10–0.25 USD (1.0–2.5 pips). The mock spread is **20x to 50x wider than institutional reality**.
  - For EUR/USD (1.0845), `step = 0.0002`. The computed spread is `0.0004` (4.0 pips). Institutional interbank raw spread is 0.1–0.4 pips. The mock spread is **10x too wide**.
  - The `spreadPips` properties defined in `INITIAL_ASSETS` (e.g. `EUR/USD: 0.4`, `XAU/USD: 1.2`) are completely ignored by `GENERATE_ORDER_BOOK`.
- **File**: `src/components/OrderBookWidget.tsx` (lines 59–60 & 99)
  - Hardcoded table headers: `<span>Price (USDT)</span>` and `<span>Size (BTC)</span>` even when displaying Forex pairs (`EUR/USD`, `GBP/USD`) or Metals (`XAU/USD`).
  - Spread format: `Spread: ${orderBook.spread.toFixed(2)}`. For EUR/USD (spread 0.0004), `.toFixed(2)` displays `$0.00`, completely hiding the pip spread.
- **File**: `src/components/SwapWidget.tsx` (lines 23–27)
  - Hardcoded `const ethPrice = 3248.30`. Does not read live prices.
  - When swapping `SOL`, it still computes rate using `ethPrice`.
  - Zero slippage or AMM constant-product curve simulation.

### 1.4 State Management & UI Re-Render / Jitter Deficiencies
- **File**: `src/App.tsx` (lines 53–62)
  - Entire application state (`assets`, `portfolio`, `bots`, `trades`, `positions`, `alerts`) is held in top-level `useState` in `App.tsx` and prop-drilled down.
  - **No Zustand store**, **no React Context**.
  - **Static Position Desynchronization Bug**: `positions` in `App.tsx` is initialized from `INITIAL_POSITIONS` (line 59) and is **never updated** when live market ticks arrive! `markPrice` and `unrealizedPnl` remain completely static. When a user closes a position (`handleClosePosition`), the realized PnL is calculated from stale historical numbers.
  - `portfolio.totalBalance` does not reflect real-time equity (Balance + floating PnL).
- **File**: `src/components/OrderEntryWidget.tsx` (lines 48–57)
  - **Critical UX Bug - Input Overwriting**:
    ```typescript
    useEffect(() => {
      setLimitPrice(currentPrice.toString())
      ...
    }, [symbol, isForex, currentPrice])
    ```
    Because `currentPrice` is in the dependency array, every time a price tick arrives, `setLimitPrice` executes and overwrites whatever the user is typing into the Limit Price input! Users cannot manually set a limit order price.
- **File**: `src/components/TradingViewChart.tsx` (lines 232–285)
  - **Critical Rendering Performance Flaw**:
    On every incoming tick, `candles` state updates. `TradingViewChart` runs:
    ```typescript
    candlestickSeriesRef.current.setData(formattedCandles)
    areaSeriesRef.current.setData(formattedArea)
    volumeSeriesRef.current.setData(formattedVolume)
    ema20SeriesRef.current.setData(formattedEma20)
    ema50SeriesRef.current.setData(formattedEma50)
    createSeriesMarkers(candlestickSeriesRef.current, markers)
    ```
    `lightweight-charts` `.setData(...)` discards and rebuilds the entire internal vertex buffer and canvas cache for all 80 bars on all 5 series simultaneously. The correct high-frequency streaming method is `series.update(lastBar)` for O(1) incremental rendering.
- **File**: `src/components/TradingDashboard.tsx` (lines 65–75 & 88–91)
  - Ticks trigger multiple unbatched `setState` updates (`setOrderBook`, `setPublicTrades`), and `aiSignal` recomputes all 4 agent rationales via `useMemo` on every tick.
  - Child components (`OrderBookWidget`, `PositionsTable`, `OrderEntryWidget`, `AISwarmConsensusWidget`) lack `React.memo`, causing full subtree re-renders at 10–50 Hz.
  - Zero throttling or RAF buffering on the WebSocket stream.

### 1.5 Formatters & Precision Truncation
- **File**: `src/utils/formatters.ts` (lines 13–17)
  - `formatCurrency`:
    ```typescript
    } else if (abs >= 1) {
      formatted = abs.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      })
    ```
    For EUR/USD at `1.08452`, `maximumFractionDigits: 4` truncates the 5th digit (fractional pip/pipette), displaying `$1.0845`. Standard institutional FX requires 5 decimals for major pairs and 3 decimals for JPY pairs.
  - Hardcoded `$` sign prepended to Forex exchange rates (`$1.0845`), which violates financial UI conventions.

---

## 2. Logic Chain

```
[Observation 1.1: WS & Interval Dual-Execution]
  └─> Both Binance WebSocket and fallbackInterval mutate candle state at the same time
  └─> Ticks collide and produce erratic price jumps.
  └─> When Forex is selected, connection is falsely claimed as 'LIVE_WS', yet runs uncalibrated math.random.

[Observation 1.2: EMA Recalculation per Tick]
  └─> Tick frequency (1-50 Hz) applied to daily/hourly alpha smoothing (alpha = 2/21)
  └─> EMA quickly converges to close price, destroying technical indicator validity.

[Observation 1.3: Mid-price Execution with Zero Spread/Slippage]
  └─> Orders fill at mid price without Ask/Bid spread or volume impact.
  └─> Unrealistic 0 PnL at inception; doesn't reflect ECN/DMA broker execution.
  └─> Mock order book has 50 pip spread on Gold and 4 pip spread on EUR/USD, contrasting with 1.2 / 0.4 pip reality.

[Observation 1.4: App-level useState & Stale Positions]
  └─> No global store (Zustand/Context). Positions never receive live price updates.
  └─> OrderEntryWidget overwrites limitPrice on every tick due to currentPrice in useEffect deps.
  └─> TradingViewChart calls full .setData() on 5 series every tick instead of .update().
  └─> Massive frame drops, jitter, and memory waste.

[Observation 1.5: Currency Formatter Pipette Truncation]
  └─> formatCurrency truncates 5-digit Forex rates to 4 decimals and prefixes '$'.
  └─> Forex traders lose pip visibility.
```

---

## 3. Caveats
- No unit or integration test suite currently exists in the repository (`pnpm test` is not configured, zero `*.test.ts` files). All verification must currently rely on static TypeScript build (`tsc -b`), linter (`oxlint`), and runtime inspection.
- Binance Public WebSocket (`wss://stream.binance.com:9443`) only provides Crypto pairs (BTC, ETH, SOL). A real institutional Forex/Gold WebSocket requires a paid broker API or institutional feed (e.g. FIX protocol, Oanda, Interactive Brokers, Finnhub). In a self-contained web platform, high-fidelity Geometric Brownian Motion (GBM) with jump-diffusion and session volatility (London/NY overlap) is the industry standard for institutional paper trading.
- No caveats regarding code accessibility — all 40 files in `src/` were examined.

---

## 4. Conclusion & Architectural Recommendations

To satisfy Requirement R1 to institutional SaaS standards, the following architectural upgrades are required:

### R1.1: Centralized Market Data Store (Zustand or Centralized Context Engine)
1. Introduce a dedicated market store (e.g., `useMarketStore` or `MarketDataContext`) managing:
   - Multi-asset ticker registry (`prices: Record<string, TickerData>`).
   - Bid, Ask, Spread, 24h High/Low, Volume, and connection status for **all** tracked assets simultaneously.
   - Decouple market data subscription from individual page view lifecycles so positions and alerts continue updating in the background.

### R1.2: Institutional Market Simulation & Hybrid WebSocket Engine
1. **Hybrid Feed Service**:
   - For Crypto (`BTC/USDT`, `ETH/USDT`, `SOL/USDT`): Connect cleanly to Binance WebSocket with exponential backoff reconnection and heartbeats. Ensure fallback simulator only activates when WS is disconnected.
   - For Forex & Gold (`XAU/USD`, `EUR/USD`, `GBP/USD`, `USD/JPY`): Implement a calibrated ECN interbank simulator using Geometric Brownian Motion with session-aware volatility (Asian range, London open, NY overlap) and microsecond tick generation.
2. **Correct Indicator Mathematics**:
   - Keep EMA calculations strictly on closed bars, with a temporary provisional preview for the active candle that does not recursively degrade the EMA state.
   - Align synthetic candle timestamps to clean UTC boundaries (`:00`, `:15`, `:30`).

### R1.3: Institutional Spread, Slippage & Execution Model
1. **Dynamic Spread**:
   - Major FX: 0.1–0.4 pips (variable by session).
   - Gold (XAU/USD): 1.0–2.5 pips ($0.10–$0.25).
   - Crypto: 1.0–3.0 USD on BTC, $0.05 on SOL.
   - Order book L2 depth generator must use exact symbol spread from asset metadata.
2. **Order Execution Realism**:
   - Market BUY fills at `Ask = Mid + (Spread / 2) + Slippage`.
   - Market SELL fills at `Bid = Mid - (Spread / 2) - Slippage`.
   - Slippage modeled via square-root market impact law:
     $$\text{Slippage} = \text{base\_spread} \times \left(1 + \kappa \cdot \sqrt{\frac{\text{OrderSize}}{\text{MarketDepth}}}\right)$$
   - Deduct ECN commission ($3.50/lot for FX, 0.04% for Crypto).
   - Starting unrealized PnL immediately reflects execution cost.

### R1.4: UI Performance & 60 FPS Jitter Elimination
1. **Lightweight Charts Optimization**:
   - On initial load / symbol switch: Call `series.setData(bars)`.
   - On streaming ticks: Call `series.update(candle)` on `candlestickSeries`, `areaSeries`, and `volumeSeries`. O(1) update with hardware acceleration.
2. **Tick Throttling / RAF Batching**:
   - Buffer high-frequency ticks and dispatch UI updates at a capped 20–30 Hz or via `requestAnimationFrame` to eliminate frame jitter.
3. **Fix OrderEntryWidget Input Locking**:
   - Remove `currentPrice` from the `useEffect` that initializes `limitPrice`. Only reset limit price when `symbol` changes or when the user explicitly clicks a "Use Current Price" button.
4. **Live Position & Equity Engine**:
   - Calculate live mark price, floating PnL, and total equity dynamically against the market data store so the Positions Table and Portfolio View update in real time.

### R1.5: Precision Currency & Pip Formatter
1. Update `formatCurrency` / add `formatQuotePrice(symbol, price)`:
   - 5 decimal places for EUR/USD, GBP/USD (e.g. `1.08452`).
   - 3 decimal places for JPY pairs (e.g. `152.350`).
   - 2 decimal places for Gold and Crypto (e.g. `2,734.50`, `114,884.00`).
   - Do not display `$` in front of Forex cross rates.

---

## 5. Verification Method

1. **Static Analysis & Build Verification**:
   - Execute: `pnpm build` (`tsc -b && vite build`)
     - Expected: Exit code 0, 0 TypeScript errors.
   - Execute: `pnpm lint` (`oxlint`)
     - Expected: 0 errors; verify that missing effect dependencies (`react-hooks/exhaustive-deps`) and state-in-effect warnings are resolved.
2. **Limit Price Input Verification**:
   - Navigate to Terminal -> Order Execution Desk -> select "LIMIT".
   - Type a custom limit price (e.g. `112,000`).
   - Observe for 10 seconds: price ticks arrive, but the input text must **NOT** be overwritten or reset.
3. **Execution Spread & Slippage Verification**:
   - Open a 1.00 Lot Market Buy order on `XAU/USD` at Mid $2734.50.
   - Verify entry price fills at Ask (e.g. $2734.62 with 1.2 pip spread + micro-slippage).
   - Verify initial Unrealized PnL is negative (approx -$12 to -$15), matching real broker conditions.
4. **Rendering Performance Verification**:
   - Open Chrome DevTools Performance panel or inspect CPU utilization while streaming at 1s intervals.
   - Confirm lightweight-charts calls `update()` rather than `setData()` during streaming ticks, maintaining smooth 60fps frame rate without canvas flickering.
5. **Positions Real-Time Mark Price Verification**:
   - Have an open position in `BTC/USDT` and `XAU/USD`.
   - Observe `markPrice` and `unrealizedPnl` updating in real time in `PositionsTable` as new ticks arrive.

---
*Report completed by Survey Explorer 1.*
