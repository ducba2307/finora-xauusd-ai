# Architectural Investigation & Survey Report: Requirements R3 & R4
## AI Trading Bots, Risk Safeguards, Production Hardening & Test Environment

**Target**: Finora Quant AI Trading Platform (Forex, Gold, Crypto)  
**Workspace Root**: `d:\VIBECODE\finora-trading-ai`  
**Investigator**: Survey Explorer 3  
**Timestamp**: 2026-10-11T03:55:00Z  

---

## 1. Observation

### 1.1 AI Trading Bots Architecture & Order Lifecycle Gaps (Requirement R3)

#### Observation 1.1.1: Static Bot Definitions & Missing Operational Parameters
- **File**: `src/types/trading.ts` (lines 120–132)
  ```typescript
  export interface AIBotStrategy {
    id: string
    name: string
    model: string
    description: string
    status: 'ACTIVE' | 'PAUSED'
    winRate: number
    tradesCount: number
    profitPct: number
    riskLevel: 'LOW' | 'MEDIUM' | 'AGGRESSIVE'
    allocationUsd: number
    targetMarket?: MarketCategory
  }
  ```
  *Direct Observation*: The bot interface only defines passive descriptive metadata. It lacks operational runtime parameters required for institutional execution: `maxDrawdownPct`, `stopLossPct`, `takeProfitPct`, `trailingStopTriggerPct`, `trailingDistancePct`, `maxLeverage`, `maxOpenPositions`, `cooldownSec`, and real-time execution statistics (`currentDailyLossUsd`, `activeOrdersCount`).
- **File**: `src/data/mockData.ts` (lines 712–765)
  Defines 4 static bots:
  1. `bot-1`: `'Neural Alpha Scalper v4'` (Model: `Finora Deep Transformer 4.5`, Target: `CRYPTO`, WinRate: `88.4%`, Allocation: `$5,000`)
  2. `bot-2`: `'XAUUSD Gold ICT Hunter'` (Model: `Smart Money M5/M15 SMC Engine`, Target: `FOREX`, WinRate: `94.6%`, Allocation: `$8,000`)
  3. `bot-3`: `'Macro Sentinel News Bot'` (Model: `NLP Fed & NFP Economic Quant`, Target: `FOREX`, WinRate: `91.2%`, Allocation: `$4,500`)
  4. `bot-4`: `'Whale Flow Accumulator'` (Model: `Smart Money On-Chain Radar`, Target: `CRYPTO`, WinRate: `93.1%`, Allocation: `$4,500`)

#### Observation 1.1.2: Complete Absence of an Autonomous Bot Execution Engine
- **File**: `src/App.tsx` (lines 57, 71–79)
  ```typescript
  const [bots, setBots] = useState<AIBotStrategy[]>(INITIAL_AI_BOTS)
  ...
  // Bot toggle handler
  const handleToggleBot = (botId: string) => {
    setBots((prev) =>
      prev.map((b) =>
        b.id === botId
          ? { ...b, status: b.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' }
          : b
      )
    )
  }
  ```
  *Direct Observation*: Toggling a bot in `App.tsx` or `BotControlModal.tsx` strictly changes the string property `status` between `'ACTIVE'` and `'PAUSED'`. There is **zero background execution loop**, **zero event listener on price ticks**, and **zero strategy evaluation logic**. Active bots never generate signals, never evaluate indicators, never place trades, and never manage positions.

#### Observation 1.1.3: Broken 6-Stage Order Lifecycle Pipeline
The required institutional lifecycle: `Signal -> Validation -> Risk Check -> Execution -> Trailing -> Exit` is completely unimplemented:
1. **Signal**: No strategy generator runs for any of the 4 bots based on live ticks or candle structures.
2. **Validation**: In `OrderEntryWidget.tsx:120-150`, orders only check `if (parsedAmount <= 0) return`. There is no validation of price sanity (finite positive numbers), session trading hours (Forex weekend closure), minimum lot size, or stop-loss/take-profit geometry (`sl < entry < tp` for longs, `sl > entry > tp` for shorts).
3. **Risk Check**: No check against account daily drawdown, maximum position count, maximum margin exposure, or execution slippage.
4. **Execution**: Bot signals are never translated into DMA positions.
5. **Trailing Stop**: In `OrderEntryWidget.tsx:35, 196`, `'AI_TRAILING'` is merely a button toggle. `grep_search` confirmed zero trailing stop calculation across `src/`. No high-water mark tracking exists to trail stop-loss levels as price moves favorably.
6. **Exit Triggers Ignored**:
   - `grep_search` for `tpPrice` and `slPrice` revealed that `pos.tpPrice` and `pos.slPrice` are only used for drawing visual price lines in `TradingViewChart.tsx:379-400` and rendering badges in `AISwarmConsensusWidget.tsx:109-115`.
   - **Critical Bug**: When live prices tick past `tpPrice` or `slPrice`, or drop below `liquidationPrice`, **nothing triggers an exit**. Positions remain open indefinitely until the user manually clicks "Market Close" in `PositionsTable.tsx:107`.

---

### 1.2 Account-Level Risk Safeguards & Financial Accounting (Requirement R3)

#### Observation 1.2.1: Purely Decorative Circuit Breaker
- **File**: `src/components/BotControlModal.tsx` (lines 70–74)
  ```tsx
  <div className="text-[11px] text-gray-400">Circuit Breaker Protection</div>
  <div className="text-lg font-bold text-indigo-400 font-mono-num flex items-center gap-1">
    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> STRICT (Max -5%)
  </div>
  ```
  *Direct Observation*: The Daily Max Drawdown Circuit Breaker is 100% hardcoded static UI text.
- **File**: `src/components/QuantStudioView.tsx` (lines 158–164)
  Hardcoded text: `<span className="text-rose-400 font-bold font-mono-num">-4.5% Hard Stop</span>`.
- *Finding*: There is **no state variable**, **no calculation of peak daily equity**, **no tracking of daily drawdown percentage**, and **no circuit-breaker trip logic** anywhere in `src/`. Neither manual orders in `OrderEntryWidget.tsx` nor autonomous bot orders are ever locked or restricted.

#### Observation 1.2.2: Absence of Max Position Limit & Slippage Guard
- **File**: `src/components/OrderEntryWidget.tsx` (lines 120–150)
  ```typescript
  const handleSubmitOrder = () => {
    if (parsedAmount <= 0) return
    setIsSubmitting(true)
    ...
    onOrderPlaced(newPos)
  }
  ```
  *Direct Observation*:
  1. **No Position Limit**: There is no check on `positions.length` or total margin exposure. An infinite number of leveraged positions can be opened.
  2. **No Margin Sufficiency Check**: Orders are placed without checking if `requiredMargin <= availableMargin`. Users can open positions that exceed total account balance.
  3. **No Slippage Guard**: Market orders fill instantaneously at `currentPrice` with `unrealizedPnl: 0`. No slippage tolerance parameter exists, and no execution penalty or spread is applied.

#### Observation 1.2.3: Critical Financial Accounting Desynchronization
- **File**: `src/types/trading.ts` (lines 134–141)
  ```typescript
  export interface UserPortfolio {
    totalBalance: number
    tradeCapital: number
    maxLoss: number
    realizedProfit: number
    dailyChangePct: number
    balances: Record<string, number>
  }
  ```
  *Direct Observation*: `UserPortfolio` lacks key institutional balance sheet metrics:
  - `equity` (`totalBalance + sum(unrealizedPnl)`)
  - `marginUsed` (`sum(position.margin)`)
  - `freeMargin` (`equity - marginUsed`)
  - `marginLevelPct` (`(equity / marginUsed) * 100`)
  - `dailyDrawdownPct` (`(peakDailyEquity - equity) / peakDailyEquity * 100`)
  - `isCircuitBreakerTripped` (boolean)
- **File**: `src/App.tsx` (lines 58–59, 122–163)
  - `const [positions, setPositions] = useState<Position[]>(INITIAL_POSITIONS)`
  - *Critical Bug*: Positions in `App.tsx` are **never updated** when live price ticks arrive via `useLiveMarketFeed`. As Bitcoin or Gold prices fluctuate, positions retain their initial hardcoded entry/mark prices and static unrealized PnL (`$621.00`, `$975.00`, `$273.20`).
  - When closing a position in `App.tsx:143-146`:
    ```typescript
    setPortfolio((prev) => ({
      ...prev,
      totalBalance: prev.totalBalance + target.unrealizedPnl,
      realizedProfit: prev.realizedProfit + target.unrealizedPnl,
      tradeCapital: Math.max(0, prev.tradeCapital - target.margin),
    }))
    ```
    Realized profit is credited using the stale mock PnL. For newly opened positions (`unrealizedPnl: 0`), closing them always results in `$0.00` realized PnL.
  - Furthermore, `portfolio.balances` (e.g. `USDT`, `USD`) is never adjusted for margin reservation on order placement or release on order close.

---

### 1.3 Production SaaS Hardening & Reliability (Requirement R4)

#### Observation 1.3.1: Zero Error Boundaries in Entire Codebase
- **File**: `src/main.tsx` (lines 6–10)
  ```typescript
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  ```
  *Direct Observation*: `grep_search` for `ErrorBoundary`, `componentDidCatch`, or `getDerivedStateFromError` returned **zero results**.
  - No Global Error Boundary wraps `<App />`. If any runtime exception or unhandled promise rejection occurs, the entire React application unmounts and presents a white screen of death.
  - No View-Level Error Boundaries exist in `src/App.tsx:215-267` for any of the 8 navigation views (`LandingPage`, `TradingDashboard`, `QuantStudioView`, `TradingJournalView`, `AIIntelligenceView`, `TraderToolsView`, `WhaleRadarView`, `PortfolioView`).
  - No Widget-Level Error Boundaries exist in `src/components/TradingDashboard.tsx` for complex SVG/Canvas widgets (`TradingViewChart`, `OrderBookWidget`, `OrderEntryWidget`, `PositionsTable`, `AISwarmConsensusWidget`). A crash in Canvas rendering destroys the entire trading desk.

#### Observation 1.3.2: Streaming Memory Leaks & Rendering Churn
- **File**: `src/hooks/useLiveMarketFeed.ts` (lines 108–149)
  ```typescript
  setCandles((prevCandles) => {
    const updated = [...prevCandles]
    ...
    updated.push({ time: candleTime, open: openP, ... })
    return updated
  })
  ```
  *Direct Observation*: In incoming WebSocket message handler, `updated.push(...)` appends new bars without any buffer limit (`MAX_CANDLES`). Over hours of continuous live streaming, the array grows unbounded, causing memory bloat.
- **File**: `src/hooks/useLiveMarketFeed.ts` (lines 173–207)
  `fallbackInterval = setInterval(...)` runs concurrently on top of the Binance WebSocket for Crypto, creating competing tick generation and double array mutations.
- **File**: `src/components/TradingViewChart.tsx` (lines 232–320)
  ```typescript
  useEffect(() => {
    ...
    candlestickSeriesRef.current.setData(formattedCandles)
    areaSeriesRef.current.setData(formattedArea)
    volumeSeriesRef.current.setData(formattedVolume)
    ema20SeriesRef.current.setData(formattedEma20)
    ema50SeriesRef.current.setData(formattedEma50)
    createSeriesMarkers(candlestickSeriesRef.current, markers)
  }, [candles, showAiSignals, showSmcZones])
  ```
  *Direct Observation*: On every single price tick (up to 50 times per minute), `TradingViewChart` calls `.setData(...)` across **all 5 series simultaneously** and reconstructs all series markers. In `lightweight-charts`, `.setData()` discards the entire GPU vertex cache and reallocates memory for all 80 bars. High-frequency streaming requires `series.update(lastBar)` for O(1) in-place rendering.
- **File**: `src/components/TradingDashboard.tsx` (lines 65–75)
  Calls `GENERATE_ORDER_BOOK(liveFeed.currentPrice)` on every tick, instantiating 40 new order objects and reallocating array memory continuously.

#### Observation 1.3.3: Incomplete Network Connectivity State Machine
- **File**: `src/hooks/useLiveMarketFeed.ts` (line 12, 156–165)
  ```typescript
  connectionStatus: 'LIVE_WS' | 'SIMULATED' | 'CONNECTING'
  ...
  ws.onerror = () => { setConnectionStatus('SIMULATED') }
  ws.onclose = () => { setConnectionStatus('SIMULATED') }
  ```
  *Direct Observation*:
  1. The system does not monitor browser connectivity (`navigator.onLine`, `window.addEventListener('online')`, `window.addEventListener('offline')`).
  2. Requirement R4 explicitly mandates standardized network connectivity states: `Online`, `Reconnecting`, `Offline`.
  3. When WebSocket closes, `useLiveMarketFeed` switches to `'SIMULATED'` and **never attempts reconnection**. It does not implement exponential backoff reconnection.
  4. In `src/components/Navbar.tsx`, there is zero network status indicator. Traders have no global visibility into whether live data feeds are active, reconnecting, or offline.

#### Observation 1.3.4: Dead Price Alert Engine
- **File**: `src/App.tsx` (lines 60, 165–178) & `src/components/PriceAlertModal.tsx`
  `alerts` are created with `triggered: false`. `grep_search` confirmed that `triggered` is never evaluated against incoming prices in `useLiveMarketFeed` or `App.tsx`. Armed price alerts never fire sound chimes or notification toasts.

---

### 1.4 Build, Lint & Test Environment (Requirement R4)

#### Observation 1.4.1: Missing Test Framework & Zero Test Files
- **File**: `package.json` (lines 6–11, 21–34)
  ```json
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "oxlint",
    "preview": "vite preview"
  }
  ```
  *Direct Observation*:
  - **No test script** in `package.json`.
  - **No test runner** installed (`vitest`, `jest`, `@testing-library/react` are absent).
  - `find_by_name *test*` across `d:\VIBECODE\finora-trading-ai` returned **0 test files**.
  - There is currently zero automated unit or integration verification for mathematical calculations, bot logic, or risk safeguards.

#### Observation 1.4.2: Production Build & Monolithic Bundle Size
- Command: `pnpm build`
  - Output: Exit code 0 (`tsc -b && vite build` built in 346ms).
  - Warning:
    ```
    [plugin builtin:vite-reporter] 
    (!) Some chunks are larger than 500 kB after minification. Consider:
    - Using dynamic import() to code-split the application
    dist/assets/index-CkE2ygd1.js   679.82 kB │ gzip: 189.74 kB
    ```
  - *Direct Observation*: All 8 heavy sub-views (`LandingPage`, `TradingDashboard`, `QuantStudioView`, `TradingJournalView`, `TraderToolsView`, `WhaleRadarView`, `PortfolioView`, `AIIntelligenceView`) and heavy libraries (`lightweight-charts`, `lucide-react`, `canvas-confetti`) are bundled into a single synchronous 680 kB JavaScript bundle. No code-splitting (`React.lazy`) or Vite `rollupOptions.output.manualChunks` is implemented.

#### Observation 1.4.3: Linting Diagnostic Results
- Command: `pnpm lint` (`oxlint`)
  - Output: Exit code 0, 12 warnings:
    - `App.tsx`: 4 warnings for impure `Date.now()` calls during rendering (`id: tx-${Date.now()}`).
    - `useLiveMarketFeed.ts`: 2 warnings for synchronous `setState` in `useEffect` and 1 warning for missing `initialPrice` dependency in `useEffect`.
    - `OrderEntryWidget.tsx`: 2 warnings for synchronous `setState` inside `useEffect`.

---

## 2. Logic Chain

```
[Observation 1.1.1 & 1.1.2: Bot Definitions are Static Mock Objects]
  │
  ├─> Bots have no operational configuration (max drawdown, trailing distance, lot step)
  ├─> Toggling a bot only flips a status string in React state
  └─> Conclusion: The 4 AI Bots have no background engine or execution capabilities.

[Observation 1.1.3: Disconnected Order Lifecycle & Exit Triggers]
  │
  ├─> OrderEntryWidget only checks parsedAmount > 0 (no SL/TP geometry, no price sanity)
  ├─> AI_TRAILING is a decorative toggle without high-water mark or ratcheting algorithm
  ├─> tpPrice, slPrice, and liquidationPrice are visual markers on chart and never trigger order close
  └─> Conclusion: Order lifecycle is fundamentally broken; positions never automatically take profit, stop loss, or liquidate.

[Observation 1.2.1 & 1.2.2: Hardcoded Circuit Breaker & Unchecked Margin]
  │
  ├─> BotControlModal displays hardcoded string "STRICT (Max -5%)"
  ├─> No tracking of peakDailyEquity or current drawdown percentage
  ├─> No max position count limit; orders submitted without margin availability check
  ├─> Instant mid-price fill without slippage guard
  └─> Conclusion: Account-level risk safeguards do not exist in code, leaving account unprotected against catastrophic loss.

[Observation 1.2.3: Stale Positions & Desynchronized Balance Sheet]
  │
  ├─> Positions in App.tsx never update on price ticks
  ├─> Unrealized PnL is completely frozen; closing a position realizes stale mock data
  ├─> UserPortfolio lacks equity, marginUsed, freeMargin, marginLevelPct, dailyDrawdownPct
  └─> Conclusion: Account accounting is mathematically incorrect and fails the primary acceptance criteria.

[Observation 1.3.1 & 1.3.2: Missing Error Boundaries & Streaming Memory Leaks]
  │
  ├─> Zero Error Boundaries (global or local); any component error crashes the entire app
  ├─> useLiveMarketFeed appends candles without buffer cap; dual interval/WS collision causes runaway re-renders
  ├─> TradingViewChart calls full .setData() across 5 series on every tick instead of .update()
  └─> Conclusion: Platform vulnerable to UI freezing, memory exhaustion, and catastrophic crashes under production load.

[Observation 1.3.3 & 1.4.1: Missing Network State Machine & Test Suite]
  │
  ├─> No Online/Reconnecting/Offline state machine; no WS reconnect backoff; price alerts never trigger
  ├─> Zero test frameworks installed (no vitest); zero test files exist
  └─> Conclusion: System does not meet production SaaS institutional hardening criteria.
```

---

## 3. Caveats

1. **Integration with Requirements R1 & R2**:
   - Survey Explorer 1 documented ticker collision and EMA bugs in `useLiveMarketFeed.ts`. The Bot Execution Engine and Risk Engine must consume sanitized, throttle-buffered market data from the upgraded feed.
   - Survey Explorer 2 is auditing backtesting math in `QuantStudioView.tsx` and `TradingJournalView.tsx`. The Bot Engine should share common risk and statistical calculations (Sharpe, Drawdown, R-multiples) with the Backtest Engine to ensure mathematical consistency.
2. **Web Audio Execution**:
   - The audio synthesis in `src/utils/soundEffects.ts` uses native browser Web Audio oscillators without external audio asset downloads. It functions reliably once the user interacts with the document, but requires safety checks for browser autoplay policies.
3. **Network Mode & Browser Compatibility**:
   - Binance public WebSocket (`wss://stream.binance.com`) may be blocked in certain corporate VPNs or regulatory jurisdictions. The connection state machine must gracefully transition to high-precision calibrated ECN simulation when WebSocket connection fails or times out.

---

## 4. Conclusion & Target Architecture

### 4.1 Summary of Existing Files vs. Gaps

| Area | Current State in Codebase | Severity | Required Target Implementation |
|---|---|---|---|
| **4 AI Bots Architecture** | Static mock data in `mockData.ts:712`; UI toggle in `App.tsx:71` | **CRITICAL** | Introduce `AIBotEngine` service running configurable strategy loops for all 4 bots with distinct alpha models. |
| **Order Lifecycle** | Incomplete: only manual entry without validation; SL/TP never exit; Trailing stop is a dummy string | **CRITICAL** | Implement 6-stage pipeline: `Signal -> Validation -> Risk Check -> Execution -> Trailing -> Exit`. Automated SL/TP/Liquidation monitoring. |
| **Daily Drawdown Circuit Breaker** | Hardcoded text in `BotControlModal.tsx:72` (`Max -5%`) | **CRITICAL** | Real-time `peakDailyEquity` tracking; automatically trip Circuit Breaker and lock new orders when drawdown hits threshold (default 4.5%). |
| **Max Position & Slippage Guard** | No limit on positions; no margin check; zero slippage | **HIGH** | Enforce max positions limit (e.g. 5 concurrent), check `requiredMargin <= freeMargin`, add configurable slippage tolerance check. |
| **Balance Sheet Accounting** | `UserPortfolio` lacks `equity`, `freeMargin`, `marginLevelPct`; `positions` static in `App.tsx` | **CRITICAL** | Dynamic position price/PnL recalculation on every tick; derive `equity = balance + sum(unrealizedPnl)` in real time. |
| **Error Boundaries** | Zero Error Boundaries in `src/` | **HIGH** | Global Error Boundary in `main.tsx`; View-level boundaries in `App.tsx`; Widget-level fallback cards in `TradingDashboard.tsx`. |
| **Streaming Performance** | Unbounded candle array; full `.setData()` on 5 series every tick in `TradingViewChart.tsx` | **HIGH** | Buffer limit (`MAX_CANDLES = 100`); use `series.update(lastBar)` for ticks; throttle RAF updates to 200ms. |
| **Network State Machine** | Only `'LIVE_WS' \| 'SIMULATED' \| 'CONNECTING'`; no reconnect backoff | **MEDIUM** | Standardized `ONLINE`, `RECONNECTING`, `OFFLINE` state machine with `navigator.onLine` listener and exponential backoff. |
| **Price Alert Trigger** | `alerts` in `App.tsx` never trigger | **MEDIUM** | Background tick checker that flips `alert.triggered = true`, plays `playAlertPingSound()`, and shows toast. |
| **Build & Test Suite** | Build passes but 680 kB single bundle; **zero test framework or files**; 12 oxlint warnings | **HIGH** | Install `vitest`; configure `package.json` test script; add comprehensive unit & integration tests; code-split via `React.lazy`. |

---

### 4.2 Architectural Design Proposal for Implementation

#### Module 1: Institutional Trading & Bot Execution Engine (`src/engine/tradingEngine.ts`)
```typescript
export interface BotConfig {
  id: string
  name: string
  model: string
  targetMarket: MarketCategory
  allocationUsd: number
  riskLevel: 'LOW' | 'MEDIUM' | 'AGGRESSIVE'
  maxPositions: number
  trailingEnabled: boolean
  trailingActivationR: number // e.g. 1.0R
  trailingDistancePct: number  // e.g. 0.8%
  cooldownSec: number
}

export interface RiskEngineConfig {
  dailyMaxDrawdownPct: number // 4.5%
  maxAccountPositions: number // 5
  maxLeverageCrypto: number   // 20x
  maxLeverageForex: number    // 100x
  slippageTolerancePct: number// 0.2%
}

export interface AccountBalanceSheet {
  balance: number
  equity: number
  marginUsed: number
  freeMargin: number
  marginLevelPct: number
  dailyStartingEquity: number
  peakDailyEquity: number
  dailyDrawdownPct: number
  isCircuitBreakerTripped: boolean
  circuitBreakerReason: string | null
}
```

#### Module 2: Order Lifecycle Pipeline State Machine
```
[Market Tick Received]
       │
       ▼
[Active Bot Evaluates Setup] ──────────> (Bot 1: Orderbook Imbalance / Liquidation Cascade)
       │                                 (Bot 2: Gold London/NY Killzone SMC Sweep)
       │                                 (Bot 3: Macro Economic Event Volatility Breakout)
       │                                 (Bot 4: On-Chain Whale CEX Inflow/Outflow)
       ▼
1. [Signal Generated] { symbol, side, entry, sl, tp, size, confidence }
       │
       ▼
2. [Order Validation] ─── Invalid (negative price, SL >= TP) ───> REJECT with reason
       │
       ▼
3. [Risk Check]
   ├─> Check 1: Is Daily Circuit Breaker Active? ──────────> REJECT (Locked)
   ├─> Check 2: Account Open Positions >= Max Limit? ─────> REJECT (Limit reached)
   ├─> Check 3: Required Margin > Free Margin? ────────────> REJECT (Insufficient margin)
   └─> Check 4: Slippage > Max Tolerance? ─────────────────> REJECT / Requote
       │
       ▼ Passed All Checks
4. [Execution]
   ├─> Apply modeled slippage & spread
   ├─> Create Position with liquidation price and trailing parameters
   ├─> Reserve margin, append to trades journal
   └─> Play tactile order filled chime
       │
       ▼
5. [Trailing Stop Manager] (Runs on every price tick)
   ├─> Update unrealized PnL & account equity
   ├─> Track position high-water mark
   └─> If profit >= activation threshold: Ratchet SL favorably (never regress)
       │
       ▼
6. [Exit Monitor] (Runs on every price tick)
   ├─> Price >= TP (Long) or <= TP (Short) ──> TAKE PROFIT EXIT (Triumphant chime)
   ├─> Price <= SL (Long) or >= SL (Short) ──> STOP LOSS EXIT (Warning thud)
   ├─> Price reaches Liq Price ─────────────> LIQUIDATION EXIT (Circuit trip warning)
   └─> Settle cash balance, release margin, write closed TradeOrder
```

#### Module 3: Production SaaS Hardening (`src/components/ErrorBoundary.tsx` & Vite Chunks)
1. **ErrorBoundary Component**: Class component implementing `componentDidCatch` and `getDerivedStateFromError`. Supports `widgetName` prop and customizable fallback UI with retry button.
2. **Vite Code Splitting (`vite.config.ts`)**:
   ```typescript
   build: {
     chunkSizeWarningLimit: 600,
     rollupOptions: {
       output: {
         manualChunks: {
           vendor_charts: ['lightweight-charts'],
           vendor_icons: ['lucide-react', 'canvas-confetti'],
         }
       }
     }
   }
   ```
3. **Network Status Indicator & Connection State Machine**:
   - State machine: `'ONLINE' | 'RECONNECTING' | 'OFFLINE'`.
   - Add status pill in `Navbar.tsx` with latency ping and reconnect attempt counter.
   - Exponential backoff: `1s -> 2s -> 4s -> 8s -> 16s -> 30s` with max retries before reverting to simulation mode.

---

## 5. Verification Method

### 5.1 Current Build & Lint Commands
To verify the baseline observations independently:
1. **Build Verification**:
   ```bash
   pnpm build
   ```
   *Expected Result*: Exits 0, outputs `dist/` with chunk size warning `(!) Some chunks are larger than 500 kB after minification (679.82 kB)`.
2. **Linting Verification**:
   ```bash
   pnpm lint
   ```
   *Expected Result*: Exits 0, outputs exactly 12 warnings across `src/App.tsx`, `src/hooks/useLiveMarketFeed.ts`, and `src/components/OrderEntryWidget.tsx`.
3. **Test Framework Absence**:
   ```bash
   pnpm test
   ```
   *Expected Result*: Errors out with `"Missing script: test"`.

### 5.2 Code Inspection Checklist
- Check bot definitions: View `src/data/mockData.ts:712-765`.
- Check bot toggle logic: View `src/App.tsx:71-79`.
- Check position closure & static PnL: View `src/App.tsx:141-163`.
- Check Error Boundary absence: Grep `ErrorBoundary` in `src/`.
- Check chart `.setData()` re-render: View `src/components/TradingViewChart.tsx:232-285`.

### 5.3 Post-Implementation Invalidation Conditions
The findings in this report will be considered resolved when:
1. `pnpm add -D vitest` is installed and `pnpm test` runs comprehensive tests for bot lifecycle, circuit breaker, and margin accounting with 100% pass rate.
2. Positions in `App.tsx` dynamically update their mark price and floating PnL on every live tick.
3. Placing a position with Daily Drawdown >= 4.5% is rejected by the Circuit Breaker.
4. An active bot autonomously generates a signal, places an order, trails its stop, and exits when TP/SL is touched.
5. All 12 oxlint warnings are cleared, and Vite code-splitting splits bundle chunks to < 500 kB.
6. Error Boundary components protect the app from crashing when any chart or widget throws.
