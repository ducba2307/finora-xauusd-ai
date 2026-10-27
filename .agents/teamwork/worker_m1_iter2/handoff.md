# Handoff Report: Remediation Worker (Milestone 1, Iteration 2)

**Author**: Worker (`worker_m1_iter2`)  
**Role**: Implementer, QA, Specialist  
**Date**: 2026-10-11T07:50:00Z  
**Project Root**: `d:\VIBECODE\finora-trading-ai`  
**Status**: COMPLETE (Verified & Passing)

---

## 1. Observation

### 1.1 USD/JPY PnL Currency Conversion Distortion
- **Observed Defect**:
  In `src/App.tsx` (formerly lines 88–95) and `src/components/OrderEntryWidget.tsx` (formerly lines 160–167), Forex pairs were evaluated using:
  ```typescript
  const notionalMultiplier = isForex ? (isGold ? 100 : 100000) : 1
  const priceDelta = isLong ? mark - pos.entryPrice : pos.entryPrice - mark
  const pnl = Number((priceDelta * (pos.lots !== undefined ? pos.lots : pos.size) * notionalMultiplier).toFixed(2))
  ```
  For `USD/JPY` (1 lot = $100,000 USD notional, quoted in JPY), a 1.00 JPY move (+100 pips) resulted in $100,000.00 JPY profit. Without dividing by the JPY exchange rate (~153.00), this JPY amount was treated directly as USD, exaggerating PnL by ~153x ($100,000.00 vs $653.59 USD).

### 1.2 Swap Balance Guard Omission & Account Equity Corruption
- **Observed Defect**:
  In `src/components/SwapWidget.tsx` (formerly line 204), the button was disabled only if `parsedFrom <= 0`, without validating `parsedFrom > userFromBalance`.
  In `src/App.tsx` (formerly lines 131–142), `handleExecuteSwap` deducted balances with `Math.max(0, balance - fromAmount)` while unconditionally crediting `+ toAmount`, minting unbacked token balances (e.g. 1,000 ETH for $3.24M USDT from a 3.2 ETH wallet). Additionally:
  - `tradeCapital: prev.tradeCapital + toAmount` corrupted margin accounting by adding spot asset quantities to leveraged position collateral.
  - `totalBalance: prev.totalBalance + (toAmount * 0.002)` inflated balance with arbitrary synthetic yields.
  - `src/components/TradingDashboard.tsx` used `userEthBalance={portfolio.balances.ETH || 2.5}`, resurrecting depleted 0 balances back to 2.5 ETH.

### 1.3 OrderEntryWidget TP/SL Input Clearing Trap
- **Observed Defect**:
  In `src/components/OrderEntryWidget.tsx` (formerly lines 405 and 426):
  ```tsx
  value={customTp || defaultTpPrice.toFixed(isForex && !symbol.includes('XAU') ? 5 : 2)}
  ```
  When a trader selected all and pressed Backspace, `customTp` was set to `""`. Because `""` is falsy, the input instantly snapped back to `defaultTpPrice`. Furthermore, JPY pairs displayed 5 decimals instead of the standard 3.

### 1.4 Unbounded Slippage Subtraction in Execution Fill
- **Observed Defect**:
  In `src/stores/marketStore.ts` (formerly lines 247–257), `calculateExecutionFill` computed `fillPrice = ticker.bidPrice - slippageCost` for SELL orders. Without a slippage cap, extreme volume (e.g. 2 Billion BTC) yielded `slippagePct > 100%`, driving `fillPrice` negative (`-$30,435.25`).

### 1.5 Lightweight-Charts Multi-Bar Batch Drop Gap
- **Observed Defect**:
  In `src/components/TradingViewChart.tsx` (formerly lines 293–303), `series.update()` was called only for `candles[candles.length - 1]`. When multi-bar batches arrived (e.g. browser tab backgrounding or WebSocket reconnect catch-up), all intermediate bars were permanently dropped.

---

## 2. Logic Chain

1. **FX Currency Invariance**:
   Finora portfolios are denominated in USD. For pairs where USD is the base currency and JPY is the quote currency (`USD/JPY`), nominal profit $\Delta P \times \text{lots} \times 100,000$ is in JPY. Dividing raw JPY profit by the prevailing JPY exchange rate (`mark`) converts the profit to USD mark-to-market equity. A fallback `jpyRate = mark > 0 ? mark : (entryPrice > 0 ? entryPrice : 1)` prevents zero-division and NaN propagation.
2. **Conservation of Value in Spot Swaps**:
   A spot asset exchange does not commit margin collateral; therefore, `tradeCapital` must remain invariant ($\text{tradeCapital}_{\text{new}} = \text{tradeCapital}_{\text{prev}}$). `handleExecuteSwap` in `App.tsx` and the submit button in `SwapWidget.tsx` enforce `fromAmount <= currentBalance`. Portfolio equity adjusts strictly by net transaction friction $(\text{toAmount} \cdot P_{\text{to}}) - (\text{fromAmount} \cdot P_{\text{from}})$. Using `portfolio.balances.ETH ?? 0` ensures that a zero balance remains zero without revival.
3. **Decoupling Input Value from Placeholder**:
   By assigning `value={customTp}` and `placeholder={defaultTpPrice.toFixed(assetConfig.digits)}`, the controlled React input permits empty states without snapping. Order submission safely falls back to `defaultTpPrice` if the field is left blank, and JPY precision correctly renders 3 decimal places.
4. **Execution Collars & Positive Price Floors**:
   Institutional matching engines enforce execution collars. Capping `slippagePct` at $50\%$ (`MAX_SLIPPAGE_PCT = 0.50`) preserves the square-root scaling ratio for order sizes up to 5,000 lots while ensuring `rawFillPrice > 0`. A floor `Math.max(minTickSize, rawFillPrice)` guarantees fill prices are strictly positive under all market extremes.
5. **Sequential Batch Streaming & Buffer Reconciliation**:
   When `candles.length > prevLen + 1`, iterating from `startIndex = Math.max(0, prevLen)` to `candles.length - 1` and calling `series.update()` for each candle preserves the non-decreasing timestamp invariant while rendering every intermediate bar. When `candles.length < prevLen` or `candles.length - prevLen > 50`, calling `series.setData()` guarantees complete canvas resynchronization.

---

## 3. Caveats

- **Cross-JPY Pairs**: The platform currently trades `USD/JPY` as its JPY asset. Should cross-currency pairs (e.g. `EUR/JPY`, `GBP/JPY`) be added in future milestones, converting JPY PnL to USD will require multiplying by the `USD/JPY` exchange rate rather than dividing by the cross pair's mark price.
- **Paper Trading Scope**: `SwapWidget` models simulated on-chain swaps with AMM slippage, but directly mutates reactive portfolio state in `App.tsx`.
- **Pre-existing Linter Warnings**: Oxlint reports 26 pre-existing warnings in `App.tsx` and `OrderEntryWidget.tsx` regarding React Compiler purity and state setting in effects. These are not errors (exit code 0) and were left intact to adhere to the minimal change principle.

---

## 4. Conclusion

All 6 dispatch directives for Milestone 1 Iteration 2 have been genuinely implemented with zero facade/dummy logic and verified:
1. **`src/App.tsx`**: Updated line 92–94 with JPY quote conversion: `const pnlUsd = isJpy ? rawPnl / jpyRate : rawPnl`. Updated `handleExecuteSwap` with strict input/balance validation, mark-to-market cost accounting, and `tradeCapital` invariance.
2. **`src/components/SwapWidget.tsx`**: Added `balances` prop, universal token lookup `getUserTokenBalance`, disabled button validation states (`isInsufficientBalance`, `isInvalidAmount`, `isSameToken`), and dynamic available target balance display.
3. **`src/components/TradingDashboard.tsx`**: Replaced falsy `||` defaults with nullish coalescing `?? 0` and forwarded `balances={portfolio.balances}`.
4. **`src/components/OrderEntryWidget.tsx`**: Added `assetConfig = getAssetConfig(symbol)`, JPY conversion on market fill initial PnL, sanitized `effectiveTp`/`effectiveSl`, and decoupled `value={customTp}` from `placeholder={defaultTpPrice.toFixed(assetConfig.digits)}`.
5. **`src/stores/marketStore.ts`** (and contract mock): Enforced `MAX_SLIPPAGE_PCT = 0.50` and positive price floor `Math.max(minTickSize, rawFillPrice)`.
6. **`src/components/TradingViewChart.tsx`**: Implemented sequential batch loop for multi-bar arrivals and `setData` resync on buffer truncation.
7. **`src/test/tier5_adversarial/challenger2_stress.test.ts`**: Updated 5 stress tests to assert remediated invariants (`fillPrice > 0`, authentic USD/JPY PnL, swap balance rejection, TP/SL clearing, multi-bar streaming).
8. **`src/test/tier1_features/swapAccounting.test.ts`**: Created 4 unit tests covering balance guards, capital invariance, and zero-balance depletion.

---

## 5. Verification Method

### 5.1 Verification Commands and Results

| Command | Target | Exit Code | Result |
|---|---|---|---|
| `pnpm exec tsc -b` | TypeScript Project Reference Typecheck | 0 | 0 errors |
| `pnpm exec vitest run src/test/tier5_adversarial/challenger2_stress.test.ts` | Challenger 2 Stress Suite | 0 | 17/17 tests PASS |
| `pnpm exec vitest run src/test/tier1_features/swapAccounting.test.ts` | Swap Accounting Invariants | 0 | 4/4 tests PASS |
| `pnpm test` | Complete Vitest Test Suite | 0 | 25/25 files PASS (191 tests PASS) |
| `pnpm build` | Production Build (`tsc -b && vite build`) | 0 | Exit code 0, dist bundle emitted |
| `pnpm lint` | Oxlint Linter | 0 | 0 errors (26 pre-existing warnings) |

### 5.2 Key Invariant Spot Checks
- **USD/JPY PnL**: For a 1.0-lot position with entry 152.00 and mark 153.00:
  $$\text{PnL} = \frac{(153.00 - 152.00) \times 1.0 \times 100,000}{153.00} = \$653.59\text{ USD}$$
  Verified: `synced[0].unrealizedPnl === 653.59` (no longer $100,000.00).
- **Execution Fill Price**: For `calculateExecutionFill('BTC/USDT', 'SELL', 2_000_000_000)`:
  Verified: `fill.fillPrice >= 0.01` and `fill.slippageCost <= midPrice * 0.50` (no longer negative).
- **Swap Balance Guard**: Swapping 1,000 ETH with a 3.2 ETH wallet:
  Verified: Swap rejected, balances and `tradeCapital` unchanged (no longer mints $3.24M USDT).
- **TP/SL Input**: Clearing `customTp`:
  Verified: `customTp === ""` remains empty, placeholder displays `defaultTpPrice.toFixed(assetConfig.digits)`.

### 5.3 Invalidation Conditions
- Any trade or tick causing `fillPrice <= 0`.
- USD/JPY PnL exceeding $(priceDelta \times lots \times 100,000) / mark$.
- Swap execution succeeding when `fromAmount > balance`.
- Spot swap increasing `tradeCapital`.
- Multi-bar batch skipping intermediate timestamps.
