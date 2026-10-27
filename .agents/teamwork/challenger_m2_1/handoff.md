# Milestone 2 Adversarial Verification Report: Quant Math & Indicators

**Challenger**: Challenger 1 (Milestone 2 Quant Math Adversarial Verifier)  
**Date**: 2026-10-11T04:35:00Z  
**Verdict**: **REQUEST_CHANGES**  
**Working Directory**: `d:\VIBECODE\finora-trading-ai\.agents\teamwork\challenger_m2_1`  
**Test Suite Path**: `src/test/tier5_adversarial/m2QuantStress.test.ts`  

---

## 1. Observation

### 1.1 Test Execution Commands & Results
An adversarial test suite was authored and executed at `src/test/tier5_adversarial/m2QuantStress.test.ts` exercising `src/quant/metrics.ts` and `src/quant/indicators.ts` across 29 stress cases.

**Command**:
```powershell
pnpm vitest run src/test/tier5_adversarial/m2QuantStress.test.ts
```

**Output**:
```
 RUN  v5.0.3 D:/VIBECODE/finora-trading-ai

 ❯ src/test/tier5_adversarial/m2QuantStress.test.ts (29 tests | 4 failed) 25ms
   ❯ M2 Adversarial Stress Test: Quant Math (metrics.ts) (21)
     ✓ safeDivide adversarial edge cases (1)
     ✓ calculateSharpeRatio adversarial edge cases (5)
     ✓ calculateSortinoRatio adversarial edge cases (4)
     ✓ calculateCalmarRatio adversarial edge cases (1)
     ✓ calculateMaxDrawdown adversarial edge cases (2)
     ✓ calculateExpectancy adversarial edge cases (2)
     ✓ calculateRDistribution adversarial edge cases (2)
     ❯ Adversarial Vulnerability Probes: Strict Finite Immunity (4)
       × probe 1: calculateRDistribution skewness underflow
       × probe 2: calculateRDistribution with non-finite pnl in trades
       × probe 3: calculateExpectancy with subnormal tiny riskUsd
       × probe 4: calculateExpectancy with overflowing pnl
   ✓ M2 Adversarial Stress Test: Point-in-Time Indicators (indicators.ts) (8)
     ✓ calculateRSI adversarial edge cases (4)
     ✓ calculateBollingerBands adversarial edge cases (1)
     ✓ calculateATR adversarial edge cases (1)
     ✓ calculateMACD adversarial edge cases (1)
     ✓ SMC liquidity zone detectors adversarial edge cases (1)
```

### 1.2 Observed Bugs & Verbatim Failure Snippets

#### Bug 1: `calculateRDistribution` Skewness Underflow/Overflow yields `NaN`
- **Location**: `src/quant/metrics.ts` (lines 286–293)
- **Code**:
  ```typescript
  const variance = rVals.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / (total - 1)
  const stdDev = Math.sqrt(variance)

  if (stdDev > 0) {
    const m3 = rVals.reduce((acc, r) => acc + Math.pow(r - mean, 3), 0) / total
    skewness = Number((m3 / Math.pow(stdDev, 3)).toFixed(3))
  }
  ```
- **Empirical Input**:
  ```typescript
  const trades = [
    { rMultiple: 0, pnl: 1 },
    { rMultiple: 1e-110, pnl: 1 },
    { rMultiple: 2e-110, pnl: 1 },
  ]
  const dist = calculateRDistribution(trades)
  ```
- **Verbatim Error**:
  ```
  FAIL probe 1: calculateRDistribution skewness underflow
  AssertionError: expected false to be true
  - Expected: true
  + Received: false // dist.skewness is NaN
  ```
- **Root Cause**: `stdDev` is $10^{-110} > 0$, but $\text{stdDev}^3$ underflows to `0` in IEEE 754 float64. $m_3 / 0$ produces `0 / 0 = NaN`. Calling `Number((NaN).toFixed(3))` returns `NaN`.

#### Bug 2: `calculateRDistribution` Leaks `NaN` into Bucket PnL on Non-Finite Trade PnL
- **Location**: `src/quant/metrics.ts` (lines 259, 269)
- **Code**:
  ```typescript
  const validTrades = trades.filter((t) => Number.isFinite(t.rMultiple))
  // ...
  const pnl = Number(matching.reduce((acc, t) => acc + t.pnl, 0).toFixed(2))
  ```
- **Empirical Input**:
  ```typescript
  const trades = [
    { rMultiple: 1, pnl: NaN },
    { rMultiple: 1, pnl: Infinity },
  ]
  const dist = calculateRDistribution(trades)
  ```
- **Verbatim Error**:
  ```
  FAIL probe 2: calculateRDistribution with non-finite pnl in trades
  AssertionError: expected false to be true
  - Expected: true
  + Received: false // b.pnl is NaN
  ```
- **Root Cause**: Line 259 validates `Number.isFinite(t.rMultiple)` but does not validate `t.pnl`. Line 269 reduces `acc + t.pnl`, producing `NaN`.

#### Bug 3: `calculateExpectancy` Leaks `Infinity` on Subnormal/Tiny `riskUsd`
- **Location**: `src/quant/metrics.ts` (lines 195–197, 204, 206)
- **Code**:
  ```typescript
  if (t.riskUsd !== undefined && Number.isFinite(t.riskUsd) && t.riskUsd > 0) {
    return t.pnl / t.riskUsd
  }
  ```
- **Empirical Input**:
  ```typescript
  const trades = [{ pnl: 10, riskUsd: 1e-320 }]
  const exp = calculateExpectancy(trades)
  ```
- **Verbatim Error**:
  ```
  FAIL probe 3: calculateExpectancy with subnormal tiny riskUsd
  AssertionError: expected false to be true
  - Expected: true
  + Received: false // exp.expectancyR and exp.avgWinR are Infinity
  ```
- **Root Cause**: While `t.riskUsd > 0` is true for `1e-320`, `t.pnl / t.riskUsd` overflows to `Infinity`. Unlike `safeDivide`, `calculateExpectancy` does not verify `Number.isFinite(t.pnl / t.riskUsd)`, poisoning `rValues` with `Infinity`.

#### Bug 4: `calculateExpectancy` Leaks `Infinity` on Double Precision PnL Sum Overflow
- **Location**: `src/quant/metrics.ts` (line 182)
- **Code**:
  ```typescript
  const netPnl = validTrades.reduce((acc, t) => acc + t.pnl, 0)
  const expectancyUsd = Number((netPnl / total).toFixed(2))
  ```
- **Empirical Input**:
  ```typescript
  const trades = [
    { pnl: 1e308, riskUsd: 1 },
    { pnl: 1e308, riskUsd: 1 },
  ]
  const exp = calculateExpectancy(trades)
  ```
- **Verbatim Error**:
  ```
  FAIL probe 4: calculateExpectancy with overflowing pnl
  AssertionError: expected false to be true
  - Expected: true
  + Received: false // exp.expectancyUsd is Infinity
  ```
- **Root Cause**: When `netPnl` exceeds $1.79 \times 10^{308}$, `netPnl` becomes `Infinity`. In JavaScript, `(Infinity).toFixed(2)` returns `"Infinity"`, and `Number("Infinity")` returns `Infinity`.

### 1.3 Verified Positive Confirmations
1. **Wilder's RSI Strictly Finite in [0, 100]**:
   - 100 consecutive UP bars: all values $\in [0, 100]$, terminal value $= 100.00$.
   - 100 consecutive DOWN bars: all values $\in [0, 100]$, terminal value $= 0.00$.
   - 100 FLAT bars: all values $\in [0, 100]$, no `NaN` or unhandled exceptions.
2. **Sharpe Ratio**: Returns `0` on 0 or 1 return, 10,000 identical returns (zero variance), and near-zero variance ($10^{-12}$). Correctly annualized and finite for huge returns ($10^9$) and alternating +1/-1 returns.
3. **Sortino Ratio**: Correctly caps at `99.99` for all-winning streaks (zero downside semi-variance). Correctly outputs finite negative ratio (-15.8745) for all-losing streaks.
4. **Calmar Ratio**: Correctly caps at `99.99` when max drawdown is 0% with positive CAGR, returns `0` when CAGR $\le 0$. Safely handles overflow to `0`.
5. **Max Drawdown**: Correctly calculates 0% for flat and increasing curves, exactly 100% for decreasing curves to 0, handles huge equity ($10^9$) without overflow.
6. **All Point-in-Time Indicators**: SMA, EMA, MACD, Bollinger Bands, ATR, and SMC zones (Fair Value Gaps, Order Blocks) execute cleanly on empty, single, and flat candle datasets without unhandled exceptions.

---

## 2. Logic Chain

1. **Contract Requirement**: Requirement R2, F06, and the project Acceptance Criteria mandate that all quantitative statistical metrics must be 100% immune to `NaN` and `Infinity` under all input conditions:
   > *"Mọi chỉ số thống kê (Sharpe, Sortino, Win Rate, Max Drawdown, R-Distribution) trên Backtest Engine, AI Bots và Trading Journal đều cho kết quả hữu hạn, chính xác, không xuất hiện NaN hoặc Infinity trong bất kỳ kịch bản dữ liệu nào."*
2. **Defensive Flaw in `.toFixed()`**: `calculateSharpeRatio`, `calculateSortinoRatio`, `calculateCalmarRatio`, and `calculateMaxDrawdown` protect their return values with explicit `Number.isFinite(...)` checks before returning. However, `calculateExpectancy` and `calculateRDistribution` mistakenly relied on `Number(val.toFixed(...))` without checking `Number.isFinite`. Because `(Infinity).toFixed(...)` returns `"Infinity"` and `(NaN).toFixed(...)` returns `"NaN"`, non-finite values bypass `.toFixed()` and return `NaN`/`Infinity`.
3. **Underflow / Division by Zero in Skewness**: In `calculateRDistribution`, while `stdDev > 0` checks that `stdDev` is non-zero, raising `stdDev` to power 3 can underflow to 0.0 in IEEE 754 float64 when `stdDev` is small ($< 10^{-108}$). This creates an unprotected division by zero ($m_3 / 0 \implies \text{NaN}$).
4. **Unprotected Quotient in Expectancy R-Multiple**: In `calculateExpectancy`, `t.riskUsd > 0` is checked, but `t.pnl / t.riskUsd` is computed directly without `safeDivide` or `Number.isFinite`. Subnormal numbers like `1e-320` satisfy `> 0` but cause division overflow to `Infinity`.
5. **Impact on Dependent Layers**: When `skewness` or `bucket.pnl` is `NaN`, rendering them into UI SVG paths (as in `TradingJournalView.tsx`) or AI bot decision engines will trigger runtime errors, invalid SVG path strings (`NaN`), or corrupted trade analysis.

---

## 3. Caveats

1. **Real-Market Likelihood**: Trades with PnL exceeding $10^{308}$ or risk amounts of $10^{-320}$ are synthetic edge cases rather than standard exchange values. However, R-Multiples with near-zero standard deviation (underflowing $\text{stdDev}^3$) or journal entries with missing/non-finite PnL values can easily occur in real user sessions (e.g., when a user imports partial journal data).
2. **Indicator Inputs**: `calculateRSI` assumes prices are positive finite numbers. If corrupted arrays containing `NaN` are passed into `calculateRSI`, `NaN` propagates into the output. A defensive check `validPrices = prices.filter(Number.isFinite)` would make it completely impenetrable.

---

## 4. Conclusion

**Verdict**: **REQUEST_CHANGES**

Milestone 2 implementation is well-architected and mathematically sound for standard workloads (Sharpe, Sortino, Calmar, Max Drawdown, and indicators pass all adversarial stress tests). However, 4 verified vulnerabilities in `src/quant/metrics.ts` violate the strict zero-NaN/zero-Infinity institutional requirement:
1. `calculateRDistribution`: Skewness underflow/overflow produces `NaN`.
2. `calculateRDistribution`: Unfiltered trade `pnl` produces `NaN` in bucket `pnl`.
3. `calculateExpectancy`: Subnormal `riskUsd` produces `Infinity` in `expectancyR` and `avgWinR`.
4. `calculateExpectancy`: Double precision PnL overflow produces `Infinity` in `expectancyUsd`.

### Required Fixes for Worker M2:
1. In `src/quant/metrics.ts` line 259:
   ```typescript
   // Sanitize both rMultiple and pnl
   const validTrades = trades.filter((t) => Number.isFinite(t.rMultiple) && Number.isFinite(t.pnl))
   ```
2. In `src/quant/metrics.ts` line 291:
   ```typescript
   if (stdDev > 0) {
     const m3 = rVals.reduce((acc, r) => acc + Math.pow(r - mean, 3), 0) / total
     const denom = Math.pow(stdDev, 3)
     const rawSkewness = denom > 0 && Number.isFinite(denom) ? m3 / denom : 0
     skewness = Number.isFinite(rawSkewness) ? Number(rawSkewness.toFixed(3)) : 0
   }
   ```
3. In `src/quant/metrics.ts` lines 182, 195–198, 204–206:
   ```typescript
   // Use safeDivide for R-multiples:
   if (t.riskUsd !== undefined && Number.isFinite(t.riskUsd) && t.riskUsd > 0) {
     return safeDivide(t.pnl, t.riskUsd, 0)
   }
   // Wrap final expectancy returns with Number.isFinite guards:
   const rawExpUsd = total > 0 ? netPnl / total : 0
   const expectancyUsd = Number.isFinite(rawExpUsd) ? Number(rawExpUsd.toFixed(2)) : 0
   ```

---

## 5. Verification Method

### 5.1 Independent Reproduction Command
Run the stress test suite to observe the 4 failing tests:
```powershell
pnpm vitest run src/test/tier5_adversarial/m2QuantStress.test.ts
```

### 5.2 Pass Invalidation Condition
Once the worker implements the required fixes, re-run:
```powershell
pnpm vitest run src/test/tier5_adversarial/m2QuantStress.test.ts
```
Expected result: **All 29 tests PASS (100% pass rate)**.
Then run full project suite:
```powershell
pnpm test
```
Expected result: **All 22 test files PASS, 130 tests PASS**.
