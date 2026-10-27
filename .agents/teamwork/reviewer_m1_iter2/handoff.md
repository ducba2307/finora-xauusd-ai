# Review & Adversarial Challenge Report: Milestone 1 Iteration 2 (Remediation Review)

**Author**: Reviewer / Critic (`reviewer_m1_iter2`)  
**Parent Conversation ID**: `7d65581a-bdfb-4e0c-ab66-0c65edc67db2`  
**Date**: 2026-10-11T07:56:00Z  
**Target Milestone**: Milestone 1 Iteration 2  
**Verdict**: **APPROVE**  
**Integrity Audit**: PASS (Zero integrity violations; genuine implementations with full mathematical fidelity)

---

## 1. Observation

All 6 dispatch directives and the remediations delivered by `worker_m1_iter2` in response to Challenger 2's findings were directly inspected and independently executed.

### Observation 1.1: USD/JPY Notional Multiplier Currency Conversion Distortion Fixed
- **Source Inspection**: `src/App.tsx` lines 90–99:
  ```typescript
  const isJpy = pos.symbol.includes('JPY')
  const notionalMultiplier = isForex ? (isGold ? 100 : 100000) : 1
  const isLong = pos.side === 'LONG'
  const priceDelta = isLong ? mark - pos.entryPrice : pos.entryPrice - mark
  const rawPnl = priceDelta * (pos.lots !== undefined ? pos.lots : pos.size) * notionalMultiplier
  // For USD/JPY, quote currency is JPY; convert JPY PnL to USD by dividing by exchange rate (mark).
  // Guard against non-positive/NaN mark price by falling back to entryPrice or 1.
  const jpyRate = mark > 0 ? mark : (pos.entryPrice > 0 ? pos.entryPrice : 1)
  const pnlUsd = isJpy ? rawPnl / jpyRate : rawPnl
  const pnl = Number(pnlUsd.toFixed(2))
  ```
  And `src/components/OrderEntryWidget.tsx` lines 164–176:
  ```typescript
  const isJpy = finalSymbol.includes('JPY')
  const notionalMultiplier = isForex ? (finalSymbol.includes('XAU') ? 100 : 100000) : 1
  const priceDelta = side === 'LONG' ? currentPrice - fill.fillPrice : fill.fillPrice - currentPrice
  const rawInitialPnl = priceDelta * parsedAmount * notionalMultiplier
  const jpyRate = currentPrice > 0 ? currentPrice : 1
  const initialPnlUsd = isJpy ? rawInitialPnl / jpyRate : rawInitialPnl
  initialUnrealizedPnl = Number(initialPnlUsd.toFixed(2))
  ```
- **Observed Behavior**: For a 1.0-lot position in `USD/JPY` moving +100 pips (+1.00 JPY from 152.00 to 153.00), the raw profit of 100,000 JPY is divided by 153.00, yielding exactly **$653.59 USD** unrealized PnL instead of the former distorted $100,000.00 USD. Zero-division and NaN guards (`mark > 0 ? mark : pos.entryPrice > 0 ? pos.entryPrice : 1`) ensure robust calculation across extreme crash and feed outage states.

### Observation 1.2: Balance Verification & Sound Accounting in Swaps
- **Source Inspection**:
  - `src/components/SwapWidget.tsx` lines 59–63 & 221–249:
    ```typescript
    const isInsufficientBalance = parsedFrom > userFromBalance
    const isInvalidAmount = !Number.isFinite(parsedFrom) || parsedFrom <= 0
    const isSameToken = fromToken === toToken
    const isSwapDisabled = isSwapping || isInvalidAmount || isInsufficientBalance || isSameToken
    ```
    Button `disabled={isSwapDisabled}` displays descriptive feedback (`Insufficient ${fromToken} Balance`, `Select Different Tokens`, `Enter an Amount`).
  - `src/components/TradingDashboard.tsx` lines 449–460:
    ```tsx
    <SwapWidget
      onSwapSuccess={onExecuteSwap}
      userEthBalance={portfolio.balances.ETH ?? 0}
      userUsdtBalance={portfolio.balances.USDT ?? 0}
      balances={portfolio.balances}
    />
    ```
    Replaced `|| 2.5` with nullish coalescing `?? 0`, preventing depleted 0 balances from being artificially restored.
  - `src/App.tsx` lines 147–218 (`handleExecuteSwap`):
    - Validates `!Number.isFinite(fromAmount) || fromAmount <= 0 || fromToken === toToken`.
    - Enforces pre-execution check: `if (fromAmount > currentFromBalance) return`.
    - Enforces atomic state check inside `setPortfolio`: `if (fromAmount > liveBalance || fromAmount <= 0) return prev`.
    - Adjusts `balances`: `updatedBalances[fromToken] = Number((liveBalance - fromAmount).toFixed(8))`.
    - Preserves `tradeCapital` invariance: `tradeCapital: prev.tradeCapital`.
    - Adjusts `totalBalance` strictly by net transaction friction (fee + slippage): `totalBalance: Math.max(0, Number((prev.totalBalance + swapCostUsd).toFixed(2)))`.
    - Logs trade record with authentic `pnl: swapCostUsd` instead of former hardcoded `14.50`.

### Observation 1.3: TP/SL Input Clearing Decoupling in `OrderEntryWidget`
- **Source Inspection**: `src/components/OrderEntryWidget.tsx` lines 410–443:
  ```tsx
  <input
    type="number"
    step="any"
    value={customTp}
    placeholder={defaultTpPrice.toFixed(assetConfig.digits)}
    onChange={(e) => setCustomTp(e.target.value)}
    disabled={!tpEnabled}
    ...
  />
  ```
  And lines 121–125:
  ```typescript
  const parsedCustomTp = customTp.trim() !== '' ? parseFloat(customTp) : NaN
  const effectiveTp = !isNaN(parsedCustomTp) && parsedCustomTp > 0 ? parsedCustomTp : defaultTpPrice
  ```
  And symbol-switch effect lines 62–63:
  ```typescript
  setCustomTp('')
  setCustomSl('')
  ```
- **Observed Behavior**: The controlled input binds directly to `customTp` and `customSl`. When a trader clears the input with Backspace, `customTp` becomes `""`, remaining blank while displaying the default price target in the gray placeholder. Order submission safely falls back to `defaultTpPrice` when empty, and switching trading pairs resets custom overrides to prevent cross-asset target contamination.

### Observation 1.4: Capped Slippage & Positive Price Floor in Matching Engine
- **Source Inspection**: `src/stores/marketStore.ts` lines 248–265 and `src/test/contracts/stores/marketStore.ts` lines 142–160:
  ```typescript
  const safeSize = Number.isFinite(lotOrSize) && lotOrSize > 0 ? lotOrSize : 0.1
  const sizeRatio = Math.max(0.1, safeSize / marketDepth)
  const rawSlippagePct = baseSlippagePct * Math.sqrt(sizeRatio)
  const MAX_SLIPPAGE_PCT = 0.50 // 50% maximum slippage cap
  const slippagePct = Math.min(MAX_SLIPPAGE_PCT, rawSlippagePct)
  const slippageCost = ticker.midPrice * slippagePct

  const spreadCost = Math.abs(ticker.askPrice - ticker.bidPrice) / 2

  const rawFillPrice = side === 'BUY'
    ? ticker.askPrice + slippageCost
    : ticker.bidPrice - slippageCost

  // Ensure fillPrice is strictly positive and bounded above minimum tick size
  const minTickSize = isCrypto ? 0.01 : symbol.includes('JPY') ? 0.001 : 0.00001
  const fillPrice = Math.max(minTickSize, rawFillPrice)
  ```
- **Observed Behavior**: For extreme SELL sizes (e.g. 2 Billion BTC), slippage is strictly capped at 50% (`slippageCost <= midPrice * 0.50`), and `fillPrice >= minTickSize > 0`. Fill price cannot become negative or zero.

### Observation 1.5: Sequential Multi-Bar Streaming in `TradingViewChart`
- **Source Inspection**: `src/components/TradingViewChart.tsx` lines 292–395:
  ```typescript
  if (candles.length < prevLen || (candles.length - prevLen > 50)) {
    // Complete setData resync on buffer truncation or large reconnect batch
    candlestickSeriesRef.current.setData(formattedCandles)
    ...
    return
  }

  if (candles.length > prevLen + 1) {
    const startIndex = Math.max(0, prevLen)
    for (let i = startIndex; i < candles.length; i++) {
      updateSeriesBar(candles[i])
    }
  } else {
    // Single bar update (O(1) intra-bar tick or single new bar arrival)
    updateSeriesBar(candles[candles.length - 1])
  }
  ```
- **Observed Behavior**: When a multi-bar burst arrives (2 to 50 candles), all intermediate bars from `prevLen` to `candles.length - 1` are sequentially piped through `series.update()`. If the buffer undergoes truncation or a huge burst (>50 candles), `setData` safely resynchronizes all series. Intermediate bars are no longer dropped.

### Observation 1.6: Independent Build & Test Tool Results
- **TypeScript**: `pnpm exec tsc -b` exited with code 0 (0 errors).
- **Vitest Test Suite**: `pnpm test` exited with code 0. 25/25 test files passed, 191/191 tests passed in 796ms.
- **Production Bundle**: `pnpm build` (`tsc -b && vite build`) exited with code 0. Emitted `dist/assets/index-BPbGKkzx.css` (85.33 kB) and `dist/assets/index-B0X6DWig.js` (703.55 kB).
- **Linter**: `pnpm lint` exited with code 0 (0 errors, 26 pre-existing warnings in `App.tsx` and `OrderEntryWidget.tsx` regarding React Compiler hooks).

---

## 2. Logic Chain

1. **Premise 1 (R1 & Quantitative Accuracy Requirements)**: Finora's core quantitative mandate requires accurate position PnL, conservation of portfolio equity, and non-negative execution pricing under all market conditions.
2. **Step 1 (Currency Invariance)**: Because the platform portfolio is USD-denominated, any Forex pair with a foreign quote currency requires converting nominal quote profit back into base USD equity. For `USD/JPY`, 1 lot = $100,000 USD notional with 1 pip = 1,000 JPY. Dividing nominal JPY PnL by the prevailing USD/JPY exchange rate yields the exact USD mark-to-market equity. The fix in `App.tsx` and `OrderEntryWidget.tsx` correctly resolves the former 153x overstatement without regressions to EUR/USD or XAU/USD.
3. **Step 2 (Conservation of Value in Swaps)**: Spot swaps exchange one asset for another; they do not borrow against or pledge leveraged margin collateral. Therefore, `tradeCapital` must remain invariant. Deducting exactly `fromAmount` (while forbidding `fromAmount > balance`), crediting `toAmount`, and modifying `totalBalance` strictly by net transaction friction satisfies basic accounting conservation laws.
4. **Step 3 (Matching Engine Robustness)**: By imposing a 50% execution collar (`MAX_SLIPPAGE_PCT = 0.50`) and a positive price floor (`minTickSize`), `calculateExecutionFill` guarantees that extreme orders cannot result in negative prices or infinite arbitrage.
5. **Step 4 (Rendering Continuity)**: Pumping all intermediate bars sequentially through `series.update()` guarantees that charting canvases maintain visual continuity and conform to lightweight-charts timestamp monotonicity without dropping candles.
6. **Integrity Evaluation**:
   - No hardcoded test outputs detected in production logic.
   - All logic paths execute generalized mathematical computations.
   - The test suites genuinely test the contracts without facade workarounds.
   - Zero integrity violations.
7. **Conclusion**: All reported defects have been fully, authentically, and cleanly remediated.

---

## 3. Caveats

1. **Cross-JPY Pairs Universe**: As noted by the worker, Finora currently offers `USD/JPY` as its sole JPY asset. If future milestones add cross-JPY pairs (e.g., `EUR/JPY`, `GBP/JPY`), USD conversion will require dividing or multiplying by `USD/JPY` instead of the cross pair's mark price. For the current Milestone 1 asset universe (`USD/JPY`), the implementation is exact.
2. **Paper Trading Scope**: The Swap Widget simulates on-chain DEX execution with AMM slippage but updates local in-memory portfolio state. This is aligned with the Milestone 1 paper-trading architecture.
3. **Pre-existing Linter Warnings**: Oxlint surfaces 26 React Compiler warnings relating to `useEffect` setState invocations. These are architectural characteristics of the existing React application, do not affect runtime execution, and were appropriately left intact.

---

## 4. Conclusion & Verdict

**Verdict**: **APPROVE**

All findings from Challenger 2 have been thoroughly resolved:
1. `USD/JPY` PnL correctly converts to USD via exchange rate division.
2. `SwapWidget` and `App.tsx` strictly enforce balance checks and preserve `tradeCapital` invariance.
3. `OrderEntryWidget` TP/SL inputs can be cleared freely with placeholders and reset on asset switch.
4. `marketStore.ts` enforces `MAX_SLIPPAGE_PCT = 0.50` and positive price floor `minTickSize`.
5. `TradingViewChart.tsx` sequentially updates all candles on multi-bar batch arrivals.
6. Full test suite (191 tests across 25 files), production build, and typecheck compile cleanly with 0 errors.

Milestone 1 Iteration 2 meets all quantitative and architectural criteria.

---

## 5. Verification Method

To independently reproduce this verification:

1. **Typecheck Verification**:
   ```bash
   pnpm exec tsc -b
   ```
   *Expected outcome*: Exit code 0, 0 type errors.

2. **Full Unit & Adversarial Test Suite**:
   ```bash
   pnpm test
   ```
   *Expected outcome*: Exit code 0, 25/25 files pass (191/191 tests pass).

3. **Dedicated Challenger 2 Stress Suite**:
   ```bash
   pnpm exec vitest run src/test/tier5_adversarial/challenger2_stress.test.ts
   ```
   *Expected outcome*: 17/17 tests PASS.

4. **Dedicated Swap Accounting Suite**:
   ```bash
   pnpm exec vitest run src/test/tier1_features/swapAccounting.test.ts
   ```
   *Expected outcome*: 4/4 tests PASS.

5. **Production Build**:
   ```bash
   pnpm build
   ```
   *Expected outcome*: Exit code 0, client bundle built cleanly in `dist/`.

6. **Linter**:
   ```bash
   pnpm lint
   ```
   *Expected outcome*: Exit code 0, 0 errors.
