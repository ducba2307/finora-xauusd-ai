# Quantitative Investigation & Survey Report: Requirement R2 (Backtest Engine & AI Alpha Precision)

**Target**: Finora Quant AI Trading Platform  
**Working Directory**: `d:\VIBECODE\finora-trading-ai`  
**Investigator**: Survey Explorer 2  
**Timestamp**: 2026-10-11T03:55:00Z  

---

## 1. Observation

### 1.1 Backtest Engine Implementation & Historical Data Processing
- **File**: `src/components/QuantStudioView.tsx` (lines 14–39, 41–62)
  - The "Institutional Backtester v4.2" simulation is an ungrounded UI timer mock:
    ```typescript
    // Lines 33-37 in QuantStudioView.tsx:
    setResult({
      ...MOCK_BACKTEST_RESULT,
      winRate: Number((86 + (confidenceThreshold / 100) * 5).toFixed(1)),
      sharpeRatio: Number((2.4 + (confidenceThreshold / 100) * 0.6).toFixed(2)),
    })
    ```
  - When `handleRunBacktest()` executes, it runs a 1200ms `setTimeout` with a spinner. It **does not parse any historical candlestick data**, does not execute bar-by-bar iterations, does not simulate position sizing, and does not deduct spread, slippage, or commissions.
  - Model selection (line 113: "Transformer Attention v4.8", "LSTM Deep Sequence", "Reinforcement Learning PPO", "Bayesian Mean Reversion") and Leverage sliders (line 152: 1x to 50x) are purely decorative state variables with **zero algorithmic integration**.
  - **Equity Curve & Heatmap Generation** (`QuantStudioView.tsx:41–62` & `273–288`):
    - Curve is drawn from `MOCK_BACKTEST_RESULT.equityCurve` (lines 979–990 in `src/data/mockData.ts`), a static 10-element array ('Jan' to 'Oct').
    - Monthly returns heatmap displays static numbers (`14.0%` to `12.8%`) from `mockData.ts:991–1002`.

### 1.2 Quantitative Alpha Indicators, Math Models & Signal Generators
- **File**: `src/data/mockData.ts` (lines 858–926, `GENERATE_CANDLESTICK_SERIES`)
  - Exponential Moving Averages (`ema20`, `ema50`) are calculated iteratively inside the synthetic candle generator (lines 893–896).
  - **Missing Standard Alpha Indicators**: There is **no indicator module** in `src/`. Missing from the entire codebase:
    - RSI (Relative Strength Index)
    - MACD (Moving Average Convergence Divergence) & Histogram
    - Bollinger Bands (20 SMA, ±2σ)
    - ATR (Average True Range - 14 period, essential for volatility-adjusted stop losses)
    - VWAP (Volume Weighted Average Price)
    - SMC Market Structure Algorithms (Fair Value Gaps, Order Blocks, Liquidity Sweeps, BOS/MSS)
- **File**: `src/components/AIIntelligenceView.tsx` (lines 56–94)
  - Displayed quantitative telemetry consists entirely of hardcoded JSX strings:
    - Line 58: `<span className="text-emerald-400 font-bold">Buy (RSI 14 = 61.4)</span>`
    - Line 62: `<span className="text-emerald-400 font-bold">Strong Buy (Golden Cross)</span>`
    - Line 66: `<span className="text-emerald-400 font-bold">+18.4 (Bullish Divergence)</span>`
    - Line 75: `BOS Confirmed`, Line 83: `Unmitigated @ Support`
- **File**: `src/data/mockData.ts` (lines 1005–1184, `GENERATE_AI_SWARM_SIGNAL`)
  - **Unidirectional Bias**: The signal generator **always outputs side: 'BUY'** across all market categories (Gold, Forex, Crypto). It has zero logic for SELL/SHORT setups.
  - Hardcoded fixed price distances:
    - Gold: `sl = currentPrice - 13.50`, `tp = currentPrice + 32.50`
    - Forex: `pipDiff = isJpy ? 0.40 : 0.0035`, `sl = currentPrice - pipDiff`, `tp = currentPrice + pipDiff * 2.5`
    - Crypto: `sl = currentPrice * 0.976`, `tp = currentPrice * 1.058`

### 1.3 Statistical Performance Metrics: Institutional Formula Discrepancies
- **Sharpe Ratio**:
  - `QuantStudioView.tsx:36`: `sharpeRatio = Number((2.4 + (confidenceThreshold / 100) * 0.6).toFixed(2))`
  - `TradingJournalView.tsx:427`: Hardcoded `<span className="text-base font-extrabold text-cyan-400 font-mono-num">3.42</span>`
  - *Institutional Formula*: $S = \frac{\bar{R}_p - R_f}{\sigma(R_p - R_f)} \times \sqrt{N}$. No excess return or sample standard deviation is computed anywhere in the repository.
- **Sortino Ratio**:
  - `TradingJournalView.tsx:428`: Hardcoded `<span className="text-[10px] text-cyan-500 block mt-0.5">Sortino: 4.80</span>`
  - `QuantStudioView.tsx`: Completely omitted from the scorecard UI (exists only as `sortinoRatio: 3.42` in mock object).
  - *Institutional Formula*: $S_\text{down} = \frac{\bar{R}_p - R_f}{\sqrt{\frac{1}{M}\sum \min(0, R_t - \text{MAR})^2}} \times \sqrt{N}$. Downside semi-variance is never computed.
- **Calmar Ratio**:
  - **100% Codebase Gap**: `calmarRatio` is absent from all interfaces (`src/types/trading.ts`), views, and data structures.
  - *Institutional Formula*: $C = \frac{\text{CAGR} \text{ or Annualized Return}}{|\text{Max Drawdown}|}$.
- **Max Drawdown (MDD)**:
  - `TradingJournalView.tsx:433`: Hardcoded `<span className="text-base font-extrabold text-amber-400 font-mono-num">1.36%</span>`
  - `QuantStudioView.tsx:202`: Directly prints `result.maxDrawdown%` (-4.2% from mock data).
  - *Institutional Formula*: $\text{MDD} = \max_t \left( \frac{\text{Peak}_t - \text{Equity}_t}{\text{Peak}_t} \right)$ where $\text{Peak}_t = \max_{s \le t} \text{Equity}_s$. Real peak-to-trough drawdown is never computed from trades or equity curve.
- **Expectancy & R-Multiple Model**:
  - `TradingJournalView.tsx:75`:
    ```typescript
    const totalR = Number(entries.reduce((acc, curr) => acc + curr.rMultiple, 0).toFixed(2))
    const avgR = totalTrades > 0 ? Number((totalR / totalTrades).toFixed(2)) : 0
    const expectancy = totalTrades > 0 ? netPnl / totalTrades : 0
    ```
    - The variable `expectancy` is calculated as dollar net PnL divided by total trades ($/trade), whereas line 440 labels it "Total Expectancy" and line 968 labels `avgR` as "EXPECTANCY IN R".
    - `rMultiple` in `JournalEntry` is taken from manual user form input (`formR = 2.8`), rather than computed strictly from `(exitPrice - entryPrice) / |entryPrice - slPrice|`.
- **R-Distribution Histogram & Behavioral Analytics**:
  - `TradingJournalView.tsx:1030–1058`:
    ```typescript
    [
      { bucket: '< -2R', count: 0, pnl: 0, pct: 0 },
      { bucket: '-2R ... -1R', count: 1, pnl: -300, pct: 15, isLoss: true },
      { bucket: '-1R ... 0R', count: 3, pnl: -246, pct: 40, isLoss: true },
      { bucket: '0R ... 1R', count: 0, pnl: 0, pct: 0 },
      { bucket: '1R ... 2R', count: 3, pnl: 672.5, pct: 40, isWin: true },
      { bucket: '2R ... 3R', count: 5, pnl: 2845.8, pct: 85, isWin: true },
      { bucket: '> 3R', count: 3, pnl: 3000.0, pct: 60, isWin: true },
    ].map(...)
    ```
    - The entire R-Distribution histogram is a **static mock array**. When new trades are logged or deleted, the histogram bars, trade counts, and PnL never change.
    - Lines 989–1008: "Average Win in R (+2.48R)", "Average Loss in R (-1.10R)", "Up Days (80.0%)", "Current Winning Streak (2 Wins)" are all hardcoded strings.
    - Line 1062: "Skewness: Highly Positive (+1.82)" is a hardcoded string rather than the statistical Fisher-Pearson standardized 3rd moment $\frac{E[(R - \mu)^3]}{\sigma^3}$.

### 1.4 Look-Ahead Bias Audit
- **Critical Vulnerability 1: Synthetic Signal Placement by Relative Index**:
  - `src/data/mockData.ts` (lines 910–919):
    ```typescript
    if (i === Math.floor(count * 0.35)) {
      candle.signal = 'BUY'
      candle.signalText = isGold ? '⚡ SMC Order Block Bullish' : '⚡ AI Long Entry (96.4%)'
    } else if (i === Math.floor(count * 0.65)) {
      candle.signal = 'SMC_FVG'
      candle.signalText = '🔷 M15 Fair Value Gap Support'
    } else if (i === Math.floor(count * 0.88)) {
      candle.signal = 'TAKE_PROFIT'
      candle.signalText = '🎯 Partial TP (+3.5R)'
    }
    ```
    This indexes future locations relative to the entire dataset length (`count`). In real market trading, future timestamps and the total sample size cannot be known in advance.
- **Critical Vulnerability 2: Same-Tick Execution with Zero Next-Bar Delay**:
  - When backtesting strategies, executing on the close of bar $t$ without delaying entry to bar $t+1$ `open` (or checking if limit order was within bar $t+1$ `[low, high]`) creates severe look-ahead execution bias.

### 1.5 Division-by-Zero, NaN & Infinity Edge Cases Audit
- **Critical Bug 1: SVG Coordinate NaN on Zero/Single Trade in `TradingJournalView.tsx:344, 362, 373`**:
  ```typescript
  const x = (idx / (equityPoints.length - 1)) * 800
  const y = 200 - ((p.equity - minEq) / (maxEq - minEq)) * 180 - 10
  ```
  - When the journal has 0 entries (or if user filters to an empty set), `equityPoints` has length 1 (`[{ date: 'Start', equity: 50000, pnl: 0 }]`).
  - `equityPoints.length - 1` evaluates to `0`.
  - `x = (0 / 0) * 800 = NaN`.
  - SVG attributes become `points="0,200 NaN,NaN 800,200"`, `cx={NaN}`, `cy={NaN}`. This creates invalid DOM paths and browser rendering errors.
- **Critical Bug 2: SVG Coordinate NaN in `QuantStudioView.tsx:42, 49, 57`**:
  ```typescript
  const maxEquity = Math.max(...result.equityCurve.map((e) => Math.max(e.strategy, e.benchmark)))
  const minEquity = 9000
  const x = (idx / (result.equityCurve.length - 1)) * width
  const y = height - ((e.strategy - minEquity) / (maxEquity - minEquity)) * (height - 30) - 15
  ```
  - If `equityCurve` is empty, `Math.max(...)` returns `-Infinity`.
  - If `maxEquity === minEquity` (flat equity scenario where no trades occurred), `maxEquity - minEquity === 0`, causing division by zero (`y = NaN`).
  - If `equityCurve.length === 1`, `(idx / 0)` yields `NaN`.
- **Critical Bug 3: SVG Coordinate NaN in `TradingChart.tsx:43–44`**:
  ```typescript
  const x = (index / (dataPoints.length - 1)) * width
  const y = height - ((d.price - min) / (max - min)) * (height - 30) - 15
  ```
  - If `dataPoints.length === 1`, `x = NaN`.
  - If `price === 0` (or constant series where `max === min`), `(max - min) === 0`, producing `y = NaN`.
- **Critical Bug 4: Division by Zero in `OrderEntryWidget.tsx:90–91 & 115–116`**:
  ```typescript
  const estimatedLiq = side === 'LONG'
    ? Math.max(0, activePrice * (1 - 1 / leverage + 0.005))
    : activePrice * (1 + 1 / leverage - 0.005)
  ```
  - If `leverage <= 0`, `1 / leverage` produces `Infinity` or negative values.
  ```typescript
  const coins = maxUsd / activePrice
  setAmountStr(coins.toFixed(3))
  ```
  - If `activePrice <= 0` (e.g. data feed initialization or network dropout), `coins = Infinity`, and `coins.toFixed(3)` returns `"Infinity"`.
- **Critical Bug 5: Division by Zero in `mockData.ts:1013, 1132`**:
  ```typescript
  const rr = Number(((tp - currentPrice) / (currentPrice - sl)).toFixed(2))
  ```
  - If `currentPrice === sl` (zero risk distance), `(currentPrice - sl) === 0`, producing `Infinity` or `NaN`.
- **Critical Bug 6: String Formatters Inadequate for NaN/Infinity in `src/utils/formatters.ts`**:
  - `formatPercent(NaN)` produces `"NaN%"`.
  - `formatPercent(Infinity)` produces `"Infinity%"`.
  - `formatCompact(NaN)` produces `"$NaN"`.
  - `formatCompact(Infinity)` produces `"$Infinity"`.
  - No fallback guard exists to guarantee finite outputs.

---

## 2. Logic Chain

1. **Premise 1**: Acceptance Criterion R2 requires that all statistical metrics (Sharpe, Sortino, Calmar, Max Drawdown, Expectancy R-Multiple, Win Rate, Profit Factor, R-Distribution) produce mathematically accurate, institutional-grade, finite numbers without NaN or Infinity in any data condition (including zero trades, flat equity, or single-point curves).
2. **Premise 2**: Direct observation shows that in `QuantStudioView.tsx`, Sharpe and Win Rate are randomized arithmetic formulas (`(2.4 + (threshold / 100) * 0.6)`), Sortino is missing from the scorecard, Calmar is completely absent from the codebase, and the simulation does not process any candle data.
3. **Premise 3**: Direct observation shows that in `TradingJournalView.tsx`, Sharpe ("3.42"), Sortino ("4.80"), Max Drawdown ("1.36%"), Skewness ("+1.82"), and the entire 7-bucket R-Distribution histogram are hardcoded static mock constants that never update when trades are modified.
4. **Premise 4**: Direct observation shows that in SVG rendering code across `TradingJournalView.tsx`, `QuantStudioView.tsx`, and `TradingChart.tsx`, formulas of the form `(idx / (length - 1))` and `((val - min) / (max - min))` fail when `length <= 1` or `max === min`, directly generating `NaN` coordinates.
5. **Premise 5**: Direct observation shows that `GENERATE_CANDLESTICK_SERIES` injects signals at fixed fractions of the total series (`0.35 * count`), which is a direct violation of point-in-time causality (look-ahead bias).
6. **Inference**: Therefore, the current codebase lacks an authentic quantitative backtesting engine and math library. To reach institutional SaaS standards, the platform requires:
   - A pure, standalone mathematical library (`src/quant/metrics.ts`) with 100% NaN/Infinity immunity.
   - A point-in-time technical analysis indicator library (`src/quant/indicators.ts`) computing EMA, SMA, RSI, MACD, Bollinger Bands, ATR, and SMC Fair Value Gaps.
   - A deterministic, bar-by-bar backtest simulation engine (`src/quant/backtestEngine.ts`) with next-bar execution modeling, slippage, and spread.
   - Integration of these modules into `QuantStudioView.tsx`, `TradingJournalView.tsx`, and `TradingDashboard.tsx`.

---

## 3. Caveats

- **Scope Boundary**: This investigation focused exclusively on Requirement R2 (Backtest Engine, AI Alpha Indicators, Quant Math Models, Statistical Metrics, Look-ahead Bias, and Zero/NaN edge cases).
- **Execution & Bot Order Lifecycle**: AI bot state machines and account-level Circuit Breakers belong to Requirement R3 and are surveyed by peer Explorer 3.
- **Live Market Feed & WebSocket Latency**: Streaming feed concurrency and chart tick updates belong to Requirement R1 and were surveyed by peer Explorer 1.
- **Dependencies**: The current `package.json` does not include external quant libraries (such as `ta-lib` or `mathjs`). All proposed quant routines can and should be authored in zero-dependency, high-performance TypeScript to maintain lightweight bundle size and zero build breakage.

---

## 4. Conclusion & Actionable Blueprint

### 4.1 Identified Architectural Gaps
1. **No Core Quant Engine**: There is currently no `src/quant/` directory. All quantitative math is either scattered as inline approximations or hardcoded mock constants.
2. **Missing Calmar Ratio**: The Calmar Ratio ($CAGR / |MDD|$) requested in R2 does not exist anywhere in the code.
3. **Pervasive Division-by-Zero & NaN Risks**: 6 distinct locations produce `NaN` or `Infinity` on zero trades, flat equity, or zero stop loss distance.
4. **Synthetic Look-ahead Bias**: Signal generator uses global dataset index fractions (`0.35 * count`), leaking future data into historical candles.

### 4.2 Proposed Modular Architecture for Implementation

#### Module 1: `src/quant/metrics.ts` (Universal Financial Math Engine)
Implement strictly typed, finite-guaranteed functions:
- `safeDivide(numerator: number, denominator: number, fallback?: number): number`
- `calculateSharpeRatio(returns: number[], riskFreeRate?: number, periodsPerYear?: number): number`
  - Formula: $\frac{\text{mean}(R) - R_f}{\text{std}(R)} \times \sqrt{N}$
  - Guards: returns length < 2 or $\sigma = 0 \implies 0.0$.
- `calculateSortinoRatio(returns: number[], mar?: number, periodsPerYear?: number): number`
  - Formula: $\frac{\text{mean}(R) - \text{MAR}}{\text{downside\_std}(R)} \times \sqrt{N}$
  - Downside deviation computed over all observations using $\min(0, R_t - \text{MAR})^2$.
  - Guards: downside deviation $= 0 \implies$ capped at 99.99 (if mean $> 0$) or $0.0$.
- `calculateCalmarRatio(annualizedReturn: number, maxDrawdownPct: number): number`
  - Formula: $\frac{\text{Annualized Return}}{|\text{Max Drawdown}|}$
  - Guards: $|\text{MDD}| = 0 \implies$ capped at 99.99 (if return $> 0$) or $0.0$.
- `calculateMaxDrawdown(equityCurve: number[]): { maxDrawdownPct: number, maxDrawdownUsd: number, peakEquity: number, troughEquity: number }`
  - Tracks running maximum $\text{Peak}_t = \max_{s \le t} \text{Equity}_s$ and computes $\max \frac{\text{Peak}_t - \text{Equity}_t}{\text{Peak}_t}$.
  - Guards: peak $\le 0$ or equity curve empty $\implies 0.0$.
- `calculateExpectancy(trades: { pnl: number, rMultiple?: number, riskUsd?: number }[]): { expectancyUsd: number, expectancyR: number, avgWinR: number, avgLossR: number, winRate: number, profitFactor: number }`
  - Explicitly computes both dollar expectancy ($\$/\text{trade}$) and R-Multiple expectancy ($R/\text{trade}$).
- `calculateRDistribution(trades: { rMultiple: number, pnl: number }[]): RDistributionAnalysis`
  - Computes dynamic histogram across standard buckets: `<-2R`, `[-2R, -1R)`, `[-1R, 0R)`, `[0R, 1R)`, `[1R, 2R)`, `[2R, 3R)`, `>3R`.
  - Calculates empirical skewness: $\frac{\frac{1}{N}\sum(R_i - \bar{R})^3}{\sigma^3}$ with sample size $> 2$ guard.
- `calculateWinRate(winCount: number, totalCount: number): number`
- `calculateProfitFactor(grossWin: number, grossLoss: number): number` (capped at 99.99 if zero losses).

#### Module 2: `src/quant/indicators.ts` (Point-in-Time Alpha Indicator Library)
- `calculateEMA(data: number[], period: number): number[]` (recursive Wilder/standard smoothing)
- `calculateSMA(data: number[], period: number): number[]`
- `calculateRSI(closes: number[], period?: number): number[]` (Wilder's smoothed relative strength, range 0–100)
- `calculateMACD(closes: number[], fast?: number, slow?: number, signal?: number): { macd: number[], signal: number[], histogram: number[] }`
- `calculateBollingerBands(closes: number[], period?: number, multiplier?: number): { upper: number[], middle: number[], lower: number[] }`
- `calculateATR(candles: CandlestickPoint[], period?: number): number[]`
- `detectSMCZones(candles: CandlestickPoint[]): { fvgZones: SMCZone[], orderBlocks: SMCOrderBlock[] }`
  - Point-in-time Fair Value Gap detection:
    - Bullish FVG: `candle[i-2].high < candle[i].low` (3-bar displacement imbalance)
    - Bearish FVG: `candle[i-2].low > candle[i].high`

#### Module 3: `src/quant/backtestEngine.ts` (Deterministic Bar-by-Bar Simulator)
- Core interface:
  ```typescript
  export interface BacktestConfig {
    symbol: string
    timeframe: string
    candles: CandlestickPoint[]
    initialCapital: number
    modelStrategy: 'TRANSFORMER_ATTENTION' | 'TREND_BREAKOUT' | 'PPO_MARKET_MAKER' | 'MEAN_REVERSION'
    confidenceThreshold: number
    leverage: number
    slippagePips: number
    spreadPips: number
    feeRate: number // e.g. 0.04% for taker
  }
  ```
- Strict sequential loop:
  - Iterates $t = 20 \dots \text{candles.length} - 1$.
  - Generates signal using only data up to bar $t$.
  - Executes fill on bar $t+1$ `open` (plus slippage & spread) or evaluates SL/TP hits against bar $t+1$ `[low, high]`.
  - Records discrete fills, tracks floating equity, calculates period returns.
  - Passes return array and equity curve to `src/quant/metrics.ts` to output full institutional `BacktestResult`.

#### Module 4: UI & Metric Integration
- **`src/types/trading.ts`**: Update `BacktestResult` interface to include `calmarRatio: number`, `expectancyR: number`, `tradesCount: number`.
- **`src/components/QuantStudioView.tsx`**:
  - Integrate `runBacktest(candles, config)`.
  - Display actual computed Sharpe, Sortino, Calmar, Max Drawdown, and dynamic equity curve.
  - Secure all SVG polyline calculations against `length - 1 === 0` and `max === min`.
- **`src/components/TradingJournalView.tsx`**:
  - Replace hardcoded Sharpe, Sortino, Max Drawdown with real values computed from `entries`.
  - Replace static histogram with dynamic buckets generated by `calculateRDistribution(entries)`.
  - Fix SVG equity curve coordinate math to prevent `NaN` coordinates when trades count $\le 1$.
- **`src/utils/formatters.ts`**:
  - Guard `formatCurrency`, `formatPercent`, and `formatCompact` against `NaN`, `Infinity`, and `-Infinity`, always returning safe formatted strings.

---

## 5. Verification Method

### Independent Verification Commands
1. **Typecheck & Production Build**:
   ```powershell
   pnpm build
   ```
   *Expected Result*: Must exit with code 0 without any TypeScript compilation errors or broken exports.
2. **Lint Audit**:
   ```powershell
   pnpm lint
   ```
   *Expected Result*: Must exit with code 0 without linter crashes.
3. **Mathematical Invalidation & Edge-Case Verification**:
   - Inspect `QuantStudioView.tsx` and run backtest with `confidenceThreshold = 60`, `85`, `95` — verify that returns, Sharpe, Sortino, and Calmar derive from actual simulated trades rather than `(2.4 + threshold * ...)`.
   - Clear all journal entries in `TradingJournalView.tsx` (or filter by an unmatched setup name) — inspect the DOM / SVG elements to verify that `cx`, `cy`, and `points` contain **zero `NaN` or `Infinity` strings**.
   - Input a trade with identical Entry and Stop Loss ($1R = 0$) — verify that Expectancy R and R-Multiple handle the zero denominator gracefully without crashing.
   - Verify that Calmar Ratio is displayed on the Quant Studio scorecard and computed as $\frac{\text{CAGR}}{|\text{Max Drawdown}|}$.

### Files to Inspect
- `src/quant/metrics.ts` (to be created)
- `src/quant/indicators.ts` (to be created)
- `src/quant/backtestEngine.ts` (to be created)
- `src/components/QuantStudioView.tsx`
- `src/components/TradingJournalView.tsx`
- `src/types/trading.ts`
- `src/utils/formatters.ts`
