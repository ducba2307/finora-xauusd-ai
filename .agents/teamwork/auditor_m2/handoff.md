# Forensic Audit Report: Milestone 2 (Quant Math & Backtest Engine)

**Auditor**: Forensic Auditor (`auditor_m2`)  
**Timestamp**: 2026-10-11T04:33:00Z  
**Work Product**: Milestone 2 (M2: Quant Math & Backtest Engine)  
**Project Root**: `d:\VIBECODE\finora-trading-ai`  
**Profile**: General Project  
**Integrity Mode**: Development (from `ORIGINAL_REQUEST.md`)  
**Verdict**: **CLEAN**

---

## 1. Observation

### 1.1 Source Code Verification
1. **`src/quant/metrics.ts`**:
   - Lines 7–13: `safeDivide` implements complete guard checks against `!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0` and returns fallback.
   - Lines 15–38: `calculateSharpeRatio` computes sample mean, sample variance using Bessel's correction ($n - 1$), checks `stdDev <= 1e-8 || !Number.isFinite(stdDev)` returning `0`, and annualizes by $\sqrt{\text{periodsPerYear}}$.
   - Lines 40–71: `calculateSortinoRatio` computes downside semi-variance exclusively on returns below MAR ($r < \text{periodicMar}$). If downside deviation $\le 1e-8$ and excess return $> 0$, caps at finite `99.99`.
   - Lines 73–84: `calculateCalmarRatio` evaluates $\text{CAGR} / |\text{MDD}|$, returning `99.99` if $\text{MDD} = 0$ with positive return, never dividing by zero.
   - Lines 86–128: `calculateMaxDrawdown` iterates through clean finite equity series, tracking peak-to-trough drop and returning `{ maxDrawdownPct, maxDrawdownUsd, peakEquity, troughEquity }`.
   - Lines 146–216: `calculateExpectancy` computes both dollar expectancy ($\$/\text{trade}$) and R-Multiple expectancy ($R/\text{trade}$), safeguarding against zero-risk denominators.
   - Lines 232–296: `calculateRDistribution` dynamically aggregates trades into 7 buckets (`<-2R`, `[-2R, -1R)`, `[-1R, 0R)`, `[0R, 1R)`, `[1R, 2R)`, `[2R, 3R)`, `>3R`) and computes 3rd-moment Fisher-Pearson standardized skewness.
   - Zero hardcoded output constants or fake return values exist.

2. **`src/quant/indicators.ts`**:
   - Lines 7–24: `calculateSMA` rolling mean with standard window summing.
   - Lines 26–42: `calculateEMA` with smoothing factor $\alpha = \frac{2}{N + 1}$.
   - Lines 44–88: `calculateRSI` implements Wilder's smoothed Relative Strength Index, bounded strictly in $[0, 100]$.
   - Lines 96–114: `calculateMACD` fast EMA, slow EMA, signal EMA, and oscillator histogram.
   - Lines 123–159: `calculateBollingerBands` rolling $2\sigma$ envelope with bandwidth.
   - Lines 161–183: `calculateATR` True Range series averaged via SMA.
   - Lines 194–231 & 241–276: `detectFairValueGaps` and `detectOrderBlocks` detect point-in-time liquidity imbalances without forward index leakage.

3. **`src/quant/backtestEngine.ts`**:
   - Lines 31–205: Deterministic bar-by-bar simulator. Look-ahead bias is eliminated:
     ```typescript
     for (let j = 1; j <= smaFast; j++) sumFastPast += candles[i - j].close
     for (let j = 1; j <= smaSlow; j++) sumSlowPast += candles[i - j].close
     ```
     Signals are evaluated strictly up to bar $i - 1$, and fills are executed on bar $i$ `open` with simulated spread, slippage, and commissions.
   - Dynamic equity curve is calculated and synchronized alongside buy-and-hold benchmark curve.

4. **UI Integrations**:
   - `src/components/QuantStudioView.tsx`: Runs `runBacktest(params)` on mount and on "Run Backtest Simulation". Clamps SVG coordinates:
     ```typescript
     const denom = eqPoints.length > 1 ? eqPoints.length - 1 : 1
     const eqSpan = maxEquity - minEquity > 0 ? maxEquity - minEquity : 1
     ```
     Guarantees zero `NaN` or `Infinity` in SVG attributes. Scorecard displays authentic computed metrics.
   - `src/components/TradingJournalView.tsx`: Imports and calculates `calculateSharpeRatio`, `calculateSortinoRatio`, `calculateMaxDrawdown`, `calculateExpectancy`, and `calculateRDistribution` in `useMemo`. R-distribution histogram renders dynamic bars, count, pnl, and Fisher-Pearson skewness from journal trades.

### 1.2 Test Suite Execution & Output
- **Command**: `pnpm test`
- **Output**:
  ```
  Test Files  20 passed (20)
       Tests  88 passed (88)
    Start at  11:30:26
    Duration  696ms
  ```
  Exit code: `0`.

### 1.3 Production Build Execution & Output
- **Command**: `pnpm build` (`tsc -b && vite build`)
- **Output**:
  ```
  vite v8.3.4 building client environment for production...
  ✓ 1932 modules transformed.
  dist/index.html                   1.07 kB │ gzip:   0.62 kB
  dist/assets/index-7QWC00mu.css   84.47 kB │ gzip:  12.44 kB
  dist/assets/index-BvcRmseL.js   687.37 kB │ gzip: 192.20 kB
  ✓ built in 432ms
  ```
  Exit code: `0`.

### 1.4 Linter Audit Output
- **Command**: `pnpm lint` (`oxlint`)
- **Output**: 0 errors across 62 files.

### 1.5 Independent Empirical Mathematical Verification
Executed independent test runner in Node v24 against `src/quant/metrics.ts` and `src/quant/indicators.ts` with known mathematical ground truths:
- Returns: `[0.02, 0.04, -0.01, 0.03, 0.01]`
  - Independent Theoretical Sharpe: `14.8550` -> Code produced: `14.8550` (PASS)
  - Independent Theoretical Sortino: `63.8937` -> Code produced: `63.8937` (PASS)
  - Theoretical Calmar (20% return, 5% MDD): `4.0000` -> Code produced: `4.0000` (PASS)
- Equity curve: `[100, 150, 120, 180, 135, 190]`
  - Theoretical Max Drawdown: `25.00%`, USD `45.00`, peak `180`, trough `135` -> Code produced identical values (PASS)
- Indicators:
  - SMA on `[10, 20, 30]` (period 2) -> `[10, 15, 25]` (PASS)
  - EMA on `[10, 20, 30]` (period 2) -> `[10, 16.6667, 25.5556]` (PASS)
  - RSI on all ascending prices -> `100.00` (PASS)
  - RSI on all descending prices -> `0.00` (PASS)
- Trade Expectancy:
  - 3 trades (`+$400 (2R)`, `-$200 (-1R)`, `+$600 (3R)`) -> Expectancy USD `266.67`, Expectancy R `1.33R`, Profit Factor `5.00`, Win Rate `66.67%` -> Code produced identical values (PASS)

### 1.6 Adversarial Stress Testing
- Empty arrays (`[]`): Sharpe `0`, Sortino `0`, Calmar `0`, MDD `0%`, Expectancy `0`, R-distribution 7 empty buckets with skewness `0` (PASS).
- Single element (`[0.05]`): Sharpe `0`, Sortino `0`, MDD `0%` (PASS).
- Identical returns (zero variance $\sigma = 0$): Sharpe `0`, Sortino `0` or `99.99` cap (PASS).
- Zero drawdown in Calmar: Capped finite `99.99`, no `Infinity` (PASS).
- NaN / Infinity array filtering: All non-finite entries excluded prior to calculation, resulting in finite outputs (PASS).

---

## 2. Logic Chain

1. **Absence of Prohibited Patterns**:
   - Hardcoded test outputs: Phase 1 AST inspection confirms all calculations in `metrics.ts`, `indicators.ts`, and `backtestEngine.ts` are parameterized and derived from runtime arrays.
   - Facade implementations: No dummy stubs or placeholder returns exist. All algorithms implement full mathematical formulas matching institutional definitions.
   - Pre-populated artifacts: Search across project directories identified 0 predated `.log`, `*result*`, or `*output*` files.
   - Self-certifying / trivial tests: Inspection of `src/test/` confirmed all 88 assertions check real invariants, numerical outputs, and mathematical formulas.

2. **Empirical Verification**:
   - The test suite executes in 696ms via Vitest and passes 100% of 88 test cases.
   - The production build executes in 432ms via Vite and TypeScript compiler, emitting valid minified bundles with exit code 0.
   - Independent ground-truth calculations reproduced every formula to the 4th decimal place.

3. **Adversarial Robustness**:
   - Under hostile inputs (empty lists, single candles, flat curves, division by zero denominators, extreme spikes, NaN injections), the math engine guaranteed finite results without throwing exceptions or emitting `NaN`/`Infinity`.

4. **Constraint & Requirement Satisfaction**:
   - All criteria for Requirement R2 ("Kiểm định và chuẩn hóa toàn bộ công thức toán học trong bộ máy kiểm thử chiến lược (Backtest) và chỉ báo AI: tính toán chính xác Sharpe Ratio, Sortino Ratio, Calmar Ratio, Max Drawdown, Expectancy R-Multiple, loại bỏ hoàn toàn các lỗi Look-ahead bias, chia cho 0 hoặc giá trị NaN") and Acceptance Criteria have been satisfied.

---

## 3. Caveats

- **Scope Limitation**: This forensic audit covers Milestone 2 (M2: Quant Math, Alpha Indicators, Backtest Engine, Quant Studio, and Trading Journal). Autonomous AI Bot live execution loops and account-level live circuit breaker triggers are part of Milestone 3 (M3).
- **Linter Warnings**: 18 warnings reported by Oxlint originate from UI files in M1/M4 (`OrderEntryWidget.tsx`, `useLiveMarketFeed.ts`, `App.tsx`, `TradingDashboard.tsx`) and are scheduled for resolution in Milestone 4. Milestone 2 files (`metrics.ts`, `indicators.ts`, `backtestEngine.ts`) have 0 linter issues.

---

## 4. Conclusion

**Verdict: CLEAN**

Milestone 2 work products by `worker_m2` are genuine, authentic, mathematically rigorous, and fully compliant with project specifications. There are no integrity violations, no mock facades, no hardcoded test outputs, and no look-ahead biases.

The work product is **ACCEPTED**.

---

## 5. Verification Method

To independently verify this audit, run the following commands in `d:\VIBECODE\finora-trading-ai`:

1. **Run full automated test suite**:
   ```powershell
   pnpm test
   ```
   *Expected*: 20 test files passed, 88 tests passed.

2. **Run production TypeScript build**:
   ```powershell
   pnpm build
   ```
   *Expected*: `tsc -b && vite build` succeeds with exit code 0.

3. **Run independent mathematical verification in Node**:
   ```powershell
   node --experimental-strip-types -e "import { calculateSharpeRatio } from './src/quant/metrics.ts'; console.log('Sharpe:', calculateSharpeRatio([0.02, 0.04, -0.01, 0.03, 0.01], 0, 252));"
   ```
   *Expected*: Prints `Sharpe: 14.855`.

### Invalidation Conditions
- Any test in `src/test/` failing.
- Any metric in `metrics.ts` returning `NaN` or `Infinity` under clean or corner-case inputs.
- Any return statement in `metrics.ts` or `indicators.ts` returning a hardcoded constant regardless of input.
