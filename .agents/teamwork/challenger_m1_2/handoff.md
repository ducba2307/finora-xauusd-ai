# Adversarial Challenge Report — Challenger 2: Milestone 1 (M1)

**Verdict**: **REQUEST_CHANGES**
**Author**: Challenger 2 (critic, specialist)
**Date**: 2026-10-11T07:32:00Z
**Project**: Finora Quant AI Trading Platform (`d:\VIBECODE\finora-trading-ai`)
**Test Suite**: `src/test/tier5_adversarial/challenger2_stress.test.ts` (17 tests, 100% passing)

---

## 1. Observation

### Observation 1.1: USD/JPY Notional Multiplier Currency Conversion Distortion
- **Location**: `src/App.tsx`, lines 88–94:
  ```typescript
  const isForex = pos.market === 'FOREX' || pos.symbol.includes('EUR') || pos.symbol.includes('GBP') || pos.symbol.includes('JPY') || pos.symbol.includes('XAU')
  const isGold = pos.symbol.includes('XAU')
  const notionalMultiplier = isForex ? (isGold ? 100 : 100000) : 1
  const isLong = pos.side === 'LONG'
  const priceDelta = isLong ? mark - pos.entryPrice : pos.entryPrice - mark
  const pnl = Number((priceDelta * (pos.lots !== undefined ? pos.lots : pos.size) * notionalMultiplier).toFixed(2))
  const pnlPct = Number(((pnl / (pos.margin || 1)) * 100).toFixed(2))
  ```
- **Observed Behavior**: For `USD/JPY`, `isForex` evaluates to `true` and `isGold` evaluates to `false`, assigning `notionalMultiplier = 100000`. When a 1.0-lot USD/JPY position experiences a 100-pip move (e.g. from 152.00 to 153.00, `priceDelta = 1.00`), `pnl` is computed as:
  $$1.00 \times 1.0 \times 100,000 = \$100,000.00\text{ USD}$$
  However, in institutional FX, because JPY is the quote currency, $1\text{ pip} = 0.01 \times 100,000 = 1,000\text{ JPY}$. Converted to USD at rate $153.00$, the true PnL is:
  $$\frac{100,000\text{ JPY}}{153.00} \approx \$653.59\text{ USD}$$
  The current implementation overstates USD/JPY PnL by **~153x** ($100,000.00 vs $653.59).
- **Test Evidence**: `src/test/tier5_adversarial/challenger2_stress.test.ts` test `"ADVERSARIAL CHALLENGE: exposes currency conversion distortion for USD/JPY"`:
  ```typescript
  expect(synced[0].unrealizedPnl).toBe(100000.0)
  expect(distortionFactor).toBeGreaterThan(150)
  ```

### Observation 1.2: Missing Balance Verification in Swap Execution (Infinite Balance Minting)
- **Location**: `src/components/SwapWidget.tsx`, line 204:
  ```tsx
  <button
    onClick={handleExecuteSwap}
    disabled={isSwapping || parsedFrom <= 0}
  ```
  And `src/App.tsx`, lines 131–142:
  ```typescript
  setPortfolio((prev) => {
    const updatedBalances = { ...prev.balances }
    updatedBalances[fromToken] = Math.max(0, (updatedBalances[fromToken] || 0) - fromAmount)
    updatedBalances[toToken] = (updatedBalances[toToken] || 0) + toAmount

    return {
      ...prev,
      balances: updatedBalances,
      totalBalance: prev.totalBalance + (toAmount * 0.002),
      tradeCapital: prev.tradeCapital + toAmount,
    }
  })
  ```
- **Observed Behavior**: `SwapWidget.tsx` disables the submit button only when `parsedFrom <= 0`, without checking if `parsedFrom > userFromBalance`. In `App.tsx`, `handleExecuteSwap` clamps the deducted token to 0 via `Math.max(0, ...)`. A user holding 3.2 ETH can input 1,000 ETH for 3,240,000 USDT; the ETH balance drops to 0 while the user is credited with +$3,240,000 USDT.
- **Test Evidence**: `src/test/tier5_adversarial/challenger2_stress.test.ts` test `"ADVERSARIAL VULNERABILITY: App.tsx lacks balance verification allowing infinite capital creation"`.

### Observation 1.3: Swap Portfolio Accounting Distortion (`totalBalance` and `tradeCapital`)
- **Location**: `src/App.tsx`, lines 139–140:
  ```typescript
  totalBalance: prev.totalBalance + (toAmount * 0.002),
  tradeCapital: prev.tradeCapital + toAmount,
  ```
  And line 153:
  ```typescript
  pnl: 14.50,
  ```
- **Observed Behavior**:
  1. `tradeCapital` unconditionally adds `toAmount` without converting to USD or deducting `fromAmount`. Swapping 10,000 USDT for 3.07 ETH increases `tradeCapital` by only 3.07, erasing ~$10,000 from nominal capital.
  2. `totalBalance` adds `toAmount * 0.002` regardless of whether `toToken` is ETH, BTC, or USDT.
  3. Every swap trade record has a hardcoded static `pnl: 14.50`.

### Observation 1.4: AMM Slippage Curve Under-Penalizes Orders Exceeding Pool Depth ($10M+)
- **Location**: `src/components/SwapWidget.tsx`, lines 38–41:
  ```typescript
  const poolDepthUsd = 10_000_000
  const baseFeePct = 0.0005 // 0.05%
  const impactPct = 0.0025 * Math.sqrt(Math.max(0, tradeUsdValue) / poolDepthUsd)
  const totalSlippagePct = Math.min(0.05, baseFeePct + impactPct)
  ```
- **Observed Behavior**:
  - For $10,000,000 swap (100% of pool): slippage is 0.30% (30 bps).
  - For $100,000,000 swap (10x pool depth): slippage is 0.84% (84 bps).
  - For $1,000,000,000 swap (100x pool depth): slippage is 2.55%.
  - To reach the 5.0% cap (`Math.min(0.05, ...)`), order volume must reach ~$3.92 Billion USD ($392\times$ pool depth).
  In real AMMs ($x \cdot y = k$), swapping 100% of a pool incurs ~50% slippage, and an order of $100M cannot execute against a $10M pool. While mathematical non-negativity is preserved (`effectiveRate > 0`), the model permits unrealistic whale liquidity absorption.

### Observation 1.5: UI Input Clearing Trap on Optional TP/SL in `OrderEntryWidget`
- **Location**: `src/components/OrderEntryWidget.tsx`, lines 405 and 426:
  ```tsx
  value={customTp || defaultTpPrice.toFixed(isForex && !symbol.includes('XAU') ? 5 : 2)}
  ```
- **Observed Behavior**: Because `customTp` and `customSl` are initialized as `""`, if a user selects all and presses Backspace to clear the field, `e.target.value` becomes `""`. Because `""` is falsy, `customTp || defaultTpPrice` immediately evaluates to `defaultTpPrice`. The user is unable to clear the input to type from a blank state.

### Observation 1.6: Lightweight-Charts Single-Bar Update Gap on Multi-Bar Batch
- **Location**: `src/components/TradingViewChart.tsx`, lines 293–303:
  ```typescript
  prevCandlesLenRef.current = candles.length
  const last = candles[candles.length - 1]
  const lastBarTime = last.time as UTCTimestamp
  candlestickSeriesRef.current.update({
    time: lastBarTime,
    open: last.open,
    high: last.high,
    low: last.low,
    close: last.close,
  })
  ```
- **Observed Behavior**: When a batch of multiple candles arrives in a single render cycle (e.g. following browser tab de-prioritization or WebSocket reconnection catch-up), only `candles[candles.length - 1]` is forwarded to `series.update()`. Intermediate candles are permanently skipped and omitted from the canvas rendering.

### Observation 1.7: Unbounded Slippage Subtraction on Extreme SELL Fills
- **Location**: `src/stores/marketStore.ts`, lines 248–257:
  ```typescript
  const sizeRatio = Math.max(0.1, lotOrSize / marketDepth)
  const slippagePct = baseSlippagePct * Math.sqrt(sizeRatio)
  const slippageCost = ticker.midPrice * slippagePct
  const fillPrice = side === 'BUY'
    ? ticker.askPrice + slippageCost
    : ticker.bidPrice - slippageCost
  ```
- **Observed Behavior**: For extreme SELL lot sizes (e.g. 2,000,000,000 units), `slippagePct` exceeds 1.0 (100%), making `slippageCost` ($145,318.25) exceed `bidPrice` ($114,883.00), yielding a negative fill price of `-$30,435.25`.

---

## 2. Logic Chain

1. **Premise 1 (R1 & F05 Institutional Precision)**: Finora's quantitative trading engine is explicitly contracted in `ORIGINAL_REQUEST.md` (R1) to provide institutional-grade quantitative fidelity, accurate mark-to-market position PnL, realistic slippage, and zero calculation anomalies.
2. **Step 2 (Multi-Asset Synchronization Audit)**:
   - Gold (`XAU/USD`) with 100 oz multiplier and EUR/USD with 100,000 units multiplier correctly calculate PnL across normal and massive swings (+1000%, -90%).
   - However, for currency pairs where USD is the BASE currency (specifically `USD/JPY`), the pip value is denominated in quote currency (JPY). Multiplying `priceDelta` directly by 100,000 without dividing by the JPY exchange rate overstates PnL by $\approx 153\times$ (Observation 1.1).
3. **Step 3 (Order Execution & Transaction Validation)**:
   - `OrderEntryWidget` successfully decoupled user limit price and amount from incoming price ticks once initialized, preserving inputs across 1,000 ticks.
   - However, `SwapWidget` lacks basic balance validation (`parsedFrom <= userFromBalance`), allowing users to execute swaps with arbitrary unbacked volume. Combined with `Math.max(0, balance - amount)` in `App.tsx`, this creates an infinite balance generation vulnerability (Observation 1.2).
   - Furthermore, `App.tsx` distorts `totalBalance` and `tradeCapital` on swap execution by adding non-denominated token amounts (Observation 1.3).
4. **Step 4 (AMM Execution Depth vs Liquidity Limits)**:
   - While SwapWidget preserves positive rates via `Math.min(0.05, ...)`, its square-root formula with coefficient `0.0025` allows $100M trades against a $10M pool with under 1% slippage (Observation 1.4).
5. **Step 5 (UI Rendering & Chart Streaming)**:
   - TradingViewChart O(1) `series.update()` works for single-bar streaming, but skips intermediate candles when multiple bars arrive together (Observation 1.6).
   - `OrderEntryWidget` traps user input when clearing optional TP/SL fields (Observation 1.5).
6. **Conclusion**: While core Milestone 1 features (feed store, formatters, O(1) chart updates, basic Gold/EUR/BTC position sync) are structurally in place and pass basic unit tests, the presence of a **153x USD/JPY PnL distortion**, an **infinite token balance generation vulnerability in swaps**, and **portfolio balance sheet accounting corruption** violates institutional execution standards and requires formal remediation.

---

## 3. Caveats

1. **No Implementation Code Modified**: As required by the Review-only Challenger role, no production source code in `src/` was modified. All stress tests were strictly added to `src/test/tier5_adversarial/challenger2_stress.test.ts`.
2. **USD/JPY Only JPY Pair in Scope**: The current system only supports `USD/JPY` among JPY pairs; cross-currency pairs (e.g. EUR/JPY, GBP/JPY) are not currently in `mockData.ts`.
3. **Simulated Swaps vs Decentralized DEX**: SwapWidget is an in-app paper-trading feature; however, its balance accounting directly mutates `UserPortfolio` state in `App.tsx`.

---

## 4. Conclusion & Required Changes

**Verdict**: **REQUEST_CHANGES**

Milestone 1 is approximately 85% complete and structurally sound, but cannot be approved for institutional-grade quantitative deployment until the following concrete remediations are applied:

### Required Action Items for Worker:

1. **Fix USD/JPY PnL Calculation in `src/App.tsx`**:
   Update line 93 of `src/App.tsx` to divide by mark price for JPY quote pairs:
   ```typescript
   const isJpy = pos.symbol.includes('JPY')
   const notionalMultiplier = isForex ? (isGold ? 100 : 100000) : 1
   const rawPnl = priceDelta * (pos.lots !== undefined ? pos.lots : pos.size) * notionalMultiplier
   const pnl = Number((isJpy ? rawPnl / mark : rawPnl).toFixed(2))
   ```

2. **Add Balance Guard in `SwapWidget.tsx` and Sanitize Accounting in `App.tsx`**:
   - In `SwapWidget.tsx`: Add check to execute button:
     ```tsx
     disabled={isSwapping || parsedFrom <= 0 || parsedFrom > userFromBalance}
     ```
   - In `App.tsx` `handleExecuteSwap`: Ensure `fromAmount <= (prev.balances[fromToken] || 0)` before execution. Recompute `totalBalance` based on total USD valuation rather than `prev.totalBalance + (toAmount * 0.002)`.

3. **Fix Input Clearing Trap for TP/SL in `OrderEntryWidget.tsx`**:
   - Allow `customTp` and `customSl` to be edited freely without snapping back when empty. Display placeholder with `defaultTpPrice` instead of overriding `value`:
     ```tsx
     value={customTp}
     placeholder={defaultTpPrice.toFixed(cfg.digits)}
     ```

4. **Add Cap to `calculateExecutionFill` in `src/stores/marketStore.ts`**:
   - Guard `slippagePct` against exceeding 50% (`Math.min(0.50, slippagePct)`) and ensure `fillPrice > 0` (`Math.max(0.01, fillPrice)`).

5. **Batch All New Candles in `TradingViewChart.tsx`**:
   - In `TradingViewChart.tsx`, if `candles.length > prevCandlesLenRef.current + 1`, loop through all missing candles and call `series.update()` for each, rather than only updating the final element.

---

## 5. Verification Method

To independently verify all findings and test suites:

1. **Run Challenger 2 Dedicated Adversarial Suite**:
   ```bash
   pnpm exec vitest run src/test/tier5_adversarial/challenger2_stress.test.ts
   ```
   *Expected outcome*: 17/17 tests PASS, confirming empirical reproduction of all 7 findings.

2. **Run Full Test Suite**:
   ```bash
   pnpm test
   ```
   *Current status*: 23/24 test files pass; 1 file (`adversarial_challenger_m1.test.ts`) currently has an unresolved test assertion written by Challenger 1 regarding the 5% AMM slippage cap.

3. **Run Production Build**:
   ```bash
   pnpm build
   ```
   *Expected outcome*: Exit code 0, TypeScript cleanly compiles (`tsc -b && vite build`).

4. **Run Linter**:
   ```bash
   pnpm lint
   ```
   *Expected outcome*: Oxlint completes with 0 errors.
