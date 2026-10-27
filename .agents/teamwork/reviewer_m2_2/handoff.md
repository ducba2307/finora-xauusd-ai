# Milestone 2 Review & Adversarial Challenge Report

**Reviewer**: Reviewer 2 (`reviewer_m2_2`)  
**Roles**: Quality Reviewer & Adversarial Critic  
**Date**: 2026-10-11T04:32:00Z  
**Project**: Finora Quant AI Trading Platform Institutional Upgrade  
**Working Directory**: `d:\VIBECODE\finora-trading-ai\.agents\teamwork\reviewer_m2_2`  
**Target Milestone**: Milestone 2 (M2: UI Integration & Numerical Robustness / F06–F09)

---

## 1. Review Summary & Verdict

**Verdict**: **APPROVE**  
**Overall Risk Assessment**: **LOW**

### Integrity Violation Audit
- Hardcoded test results or expected outputs embedded in source code: **NONE DETECTED**
- Dummy or facade implementations bypassing real math logic: **NONE DETECTED**
- Shortcuts delegating core quantitative calculation externally: **NONE DETECTED**
- Fabricated verification outputs or falsified test logs: **NONE DETECTED**
- Self-certifying claims without genuine independent execution: **NONE DETECTED**

The implementation submitted by `worker_m2` represents genuine, production-grade quantitative mathematics and resilient UI engineering. All 88 automated tests in Vitest pass cleanly in 684ms, and the full production build (`tsc -b && vite build`) completes with exit code 0.

---

## 2. 5-Component Handoff Report

### 2.1 Observation

1. **SVG Coordinate Numerical Guards in Scope**:
   - `src/components/QuantStudioView.tsx`: Lines 75–96 implement comprehensive clamping:
     ```typescript
     const denom = eqPoints.length > 1 ? eqPoints.length - 1 : 1
     const maxEquity = rawMax === rawMin ? rawMax + 1000 : rawMax
     const minEquity = rawMax === rawMin ? Math.max(0, rawMin - 1000) : rawMin
     const eqSpan = maxEquity - minEquity > 0 ? maxEquity - minEquity : 1
     ```
     Points are mapped with explicit `Number.isFinite(x) ? Number(x.toFixed(1)) : 0` and `Number.isFinite(y) ? Number(y.toFixed(1)) : height / 2`.
   - `src/components/TradingJournalView.tsx`: Lines 287–302 replicate identical defensive mechanics:
     ```typescript
     const minEq = rawMinEq === rawMaxEq ? Math.max(0, rawMinEq - 1000) : rawMinEq
     const maxEq = rawMinEq === rawMaxEq ? rawMaxEq + 1000 : rawMaxEq
     const eqRange = maxEq - minEq > 0 ? maxEq - minEq : 1
     const eqDenom = equityPoints.length > 1 ? equityPoints.length - 1 : 1
     ```
     Zero occurrences of `NaN` or `Infinity` in SVG attributes under 0-element, 1-element, or flat equity series.

2. **Dynamic Journal Analytics & Scorecard**:
   - `src/components/TradingJournalView.tsx`: Replaced static string constants (previously hardcoded `3.42` Sharpe, `4.80` Sortino, `1.36%` MDD) with dynamic `useMemo` hooks calling `src/quant/metrics.ts` (lines 77–204).
   - Lines 1106–1126 dynamically render the 7-bucket R-distribution histogram using `metrics.rDistribution.buckets.map(...)` with live width percentages and net PnL figures.
   - Lines 1130–1132 dynamically display Fisher-Pearson 3rd-moment skewness (`metrics.rDistribution.skewness`).

3. **Institutional Precision Formatters**:
   - `src/utils/formatters.ts`:
     - `formatPrice(price, symbol)`: Symbol-aware precision (5 decimals for EUR/GBP Forex pairs without `$` prefix, 3 decimals for JPY pairs, 2 decimals for Metals/Crypto). Returns `'0.00'` if `!Number.isFinite(price)`.
     - `formatPips(pips)`: Returns signed `+X.X pips` / `-X.X pips` with guard for non-finite values.
     - `formatCurrency(amount, showSign)` and `formatPercent(value, decimals)`: Comprehensive immunity against `NaN`, `Infinity`, and `-Infinity`.

4. **Mathematical Engine & Indicators**:
   - `src/quant/metrics.ts`: Bessel's sample variance ($n - 1$), annualized Sharpe, Sortino downside semi-variance with $99.99$ cap on zero downside deviation, Calmar ratio, peak-to-trough Max Drawdown, dollar and R-multiple expectancy, and 7-bucket R-distribution with Fisher-Pearson skewness.
   - `src/quant/indicators.ts`: SMA, EMA ($\alpha = 2/(N+1)$), Wilder's RSI, MACD with signal line and histogram, Bollinger Bands ($2\sigma$), ATR True Range, Fair Value Gaps (3-bar imbalance), and Order Blocks.
   - `src/quant/backtestEngine.ts`: Deterministic bar-by-bar simulator evaluating signals strictly up to bar $i - 1$ and executing on bar $i$ `open` with spread, slippage, and per-lot commissions.

5. **Test & Build Execution**:
   - Command `pnpm test`: Executed Vitest across 20 test files, 88 test cases. Result: 20 passed, 88 passed (684ms).
   - Command `pnpm build`: Executed `tsc -b && vite build`. Result: Exit code 0, 1932 modules transformed into production bundle.

---

### 2.2 Logic Chain

1. **Numerical Invariant Verification**: SVG coordinates are functions of `x = (idx / (N - 1)) * W` and `y = H - ((v - min) / (max - min)) * H`. When $N \le 1$, $N - 1 = 0 \implies x = \text{NaN}$. When $\max = \min$, $\max - \min = 0 \implies y = \text{NaN}$. In `QuantStudioView.tsx` and `TradingJournalView.tsx`, guarding both denominators ensures $x \in [0, W]$ and $y \in [0, H]$ remain strictly finite real numbers under all edge conditions.
2. **Point-in-Time Causality**: Financial indicators that calculate SMA/EMA or trade execution fills using the current candle's `close` introduce forward-looking look-ahead bias that artificially inflates backtest performance. `src/quant/backtestEngine.ts` enforces causality by indexing `i - j` ($j \ge 1$) for indicator signals and executing on candle $i$ `open`.
3. **Data Integrity in UI Presentation**: Hardcoded constants in financial dashboards degrade trader trust. Linking the UI scorecard and histogram to dynamic outputs from `metrics.ts` ensures complete consistency across the dashboard.
4. **Conclusion Derivation**: Because all code paths are mathematically guarded, verified with passing tests, and confirmed without facades or shortcuts, the milestone meets all acceptance criteria.

---

### 2.3 Caveats

1. **Benchmark Return in Backtesting**: The benchmark equity curve in `backtestEngine.ts` models Buy & Hold of the underlying base asset from bar 0 `close`.
2. **Sortino Semi-Variance Definition**: Downside semi-variance is calculated across all observations where return $<$ MAR (periodic), consistent with CFA Institute standards.
3. **Out-of-Milestone SVG Components**: While `QuantStudioView` and `TradingJournalView` (M2 targets) are fully secured, two components outside M2 (`src/components/TradingChart.tsx:43` and `src/components/TradingDashboard.tsx:370`) still contain unprotected `(idx / (length - 1))` calculations. These are noted below for M1/M4 resolution.

---

### 2.4 Conclusion

Milestone 2 (M2: Quant Math, Alpha Indicators & Backtest Engine) is **APPROVED**. The quantitative modules and UI views satisfy institutional requirements, eliminate all NaN/Infinity risks within the milestone scope, and provide verifiable algorithmic precision.

---

### 2.5 Verification Method

1. **Run Vitest Test Suite**:
   ```bash
   pnpm test
   ```
   *Expected*: 20 test files, 88 test cases pass in < 1 second.
2. **Run TypeScript Compiler & Vite Production Build**:
   ```bash
   pnpm build
   ```
   *Expected*: `tsc -b && vite build` succeeds with exit code 0.
3. **Run Oxlint Linter**:
   ```bash
   pnpm lint
   ```
   *Expected*: 0 errors.

---

## 3. Adversarial Findings & Stress-Testing

### 3.1 Adversarial Challenges

#### Challenge 1 (Minor / UI Display): Redundant Sign Prefix in `TradingJournalView.tsx`
- **Location**: `src/components/TradingJournalView.tsx`, lines 410 and 482
- **Code**: `+{formatPercent((metrics.netPnl / 50000) * 100)}` and `+{formatCurrency(metrics.netPnl)}` (line 480)
- **Attack Scenario**:
  - `formatPercent` in `formatters.ts` already returns signed strings (e.g. `+9.87%` for positive, `-2.40%` for negative).
  - When `netPnl > 0`, rendering `+{formatPercent(...)}` produces double plus: `++9.87%`.
  - When `netPnl < 0`, rendering `+{formatPercent(...)}` produces plus-minus: `+-2.40%`. Similarly, line 480 renders `+-$1,200.00`.
- **Blast Radius**: Cosmetic string defect in UI scorecard.
- **Recommended Mitigation**: Remove the leading `+` in JSX: `{formatPercent((metrics.netPnl / 50000) * 100)}` and `{formatCurrency(metrics.netPnl, true)}`.

#### Challenge 2 (Minor / Coverage Gap): Remaining Unprotected SVGs in M1 Components
- **Location**: `src/components/TradingChart.tsx:43` and `src/components/TradingDashboard.tsx:370`
- **Code**: `const x = (index / (dataPoints.length - 1)) * width` and `(idx / (asset.sparkline.length - 1)) * 100`
- **Attack Scenario**: If `dataPoints` or `sparkline` contains exactly 1 data point, `length - 1 = 0`, producing `NaN` in SVG polyline/path attributes and generating browser console rendering errors.
- **Blast Radius**: Isolated to TradingChart and sparkline widget if fed single-tick data.
- **Recommended Mitigation**: Apply the same `safeDenom = length > 1 ? length - 1 : 1` pattern developed in M2 to M1 during Milestone 1 or Milestone 4 hardening.

#### Challenge 3 (Info / Performance): Vite Bundle Chunk Size Warning
- **Location**: Production build output
- **Observation**: `dist/assets/index-BvcRmseL.js` is 687.37 kB (> 500 kB chunk threshold).
- **Blast Radius**: Mild impact on initial load time over slow networks; no functional breakage.
- **Recommended Mitigation**: Add Vite `manualChunks` in `vite.config.ts` (already scheduled for M4 / Feature F16).

---

## 4. Verified Claims Matrix

| Claim | Verification Method | Result |
|-------|---------------------|:------:|
| SVG points handle `length <= 1` without NaN | Code inspection & boundary test suite (`nanDivisionGuards.test.ts`) | **PASS** |
| SVG points handle `max === min` without NaN | Code inspection & boundary test suite (`zeroVarianceFlatEquity.test.ts`) | **PASS** |
| Trading Journal uses live computed metrics | Code inspection of `TradingJournalView.tsx` `useMemo` hooks | **PASS** |
| Dynamic 7-bucket histogram renders from trade data | Code inspection of lines 1106–1126 mapping `metrics.rDistribution` | **PASS** |
| Formatters guard against `NaN` / `Infinity` | `formatters.test.ts` & direct parameter inspection | **PASS** |
| Forex prices formatted with 5/3 decimals, no `$` | `formatters.test.ts` test case for EUR/USD and USD/JPY | **PASS** |
| Deterministic backtest has zero look-ahead bias | Code inspection of `backtestEngine.ts:83-105` & 100-bar test | **PASS** |
| Vitest test suite pass rate: 100% (88/88) | Direct execution: `pnpm test` | **PASS** |
| Production build succeeds: exit code 0 | Direct execution: `pnpm build` | **PASS** |
