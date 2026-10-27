# Adversarial Challenge Report — Challenger (Milestone 1, Iteration 2)

**Final Verdict**: **APPROVE**  
**Role**: Empirical Challenger (`challenger_m1_iter2` — critic, specialist)  
**Date**: 2026-10-11T07:57:00Z  
**Project**: Finora Quant AI Trading Platform (`d:\VIBECODE\finora-trading-ai`)  
**Test Suite**: Vitest v5.0.3 (25 files, 191 tests, 100% PASS)  
**Production Build**: Clean exit code 0 (`tsc -b && vite build`)  

---

## 1. Observation

### Observation 1.1: USD/JPY PnL Currency Conversion Distortion (Stress Point 1)
- **File & Line**: `src/App.tsx`, lines 88–101:
  ```typescript
  const isForex = pos.market === 'FOREX' || pos.symbol.includes('EUR') || pos.symbol.includes('GBP') || pos.symbol.includes('JPY') || pos.symbol.includes('XAU')
  const isGold = pos.symbol.includes('XAU')
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
  const pnlPct = Number(((pnl / (pos.margin || 1)) * 100).toFixed(2))
  ```
  And `src/components/OrderEntryWidget.tsx`, lines 164–176:
  ```typescript
  const isJpy = finalSymbol.includes('JPY')
  const notionalMultiplier = isForex
    ? (finalSymbol.includes('XAU') ? 100 : 100000)
    : 1
  const priceDelta = side === 'LONG'
    ? currentPrice - fill.fillPrice
    : fill.fillPrice - currentPrice
  const rawInitialPnl = priceDelta * parsedAmount * notionalMultiplier
  const jpyRate = currentPrice > 0 ? currentPrice : 1
  const initialPnlUsd = isJpy ? rawInitialPnl / jpyRate : rawInitialPnl
  initialUnrealizedPnl = Number(initialPnlUsd.toFixed(2))
  ```
- **Observed Result**: For a 1.0-lot `USD/JPY` position experiencing a 100-pip move (entry 152.00, mark 153.00, `priceDelta = 1.00`), `rawPnl` is 100,000 JPY. Dividing by `mark = 153.00` yields `pnlUsd = 653.59 USD` (verified in `src/test/tier5_adversarial/challenger2_stress.test.ts:176`: `expect(synced[0].unrealizedPnl).toBe(653.59)`). The ~153x distortion is completely eliminated.

---

### Observation 1.2: SwapWidget & App.tsx Unbacked Swap Rejection & Trade Capital Invariance (Stress Point 2)
- **File & Line**: `src/components/SwapWidget.tsx`, lines 56–63 and lines 221–248:
  ```typescript
  const userFromBalance = getUserTokenBalance(fromToken)
  const isInsufficientBalance = parsedFrom > userFromBalance
  const isInvalidAmount = !Number.isFinite(parsedFrom) || parsedFrom <= 0
  const isSameToken = fromToken === toToken
  const isSwapDisabled = isSwapping || isInvalidAmount || isInsufficientBalance || isSameToken
  ```
  ```tsx
  <button
    onClick={handleExecuteSwap}
    disabled={isSwapDisabled}
    ...
  >
    {isSameToken ? 'Select Different Tokens' : isInsufficientBalance ? `Insufficient ${fromToken} Balance` : ...}
  </button>
  ```
  And `src/App.tsx`, lines 159–166 and lines 179–198:
  ```typescript
  const currentFromBalance = portfolio.balances[fromToken] ?? 0
  if (fromAmount > currentFromBalance) {
    showToast(`Swap rejected: Insufficient ${fromToken} balance (requested: ${fromAmount}, available: ${currentFromBalance.toFixed(4)})`)
    return
  }
  ```
  ```typescript
  setPortfolio((prev) => {
    const liveBalance = prev.balances[fromToken] ?? 0
    if (fromAmount > liveBalance || fromAmount <= 0) return prev

    const updatedBalances = { ...prev.balances }
    updatedBalances[fromToken] = Number((liveBalance - fromAmount).toFixed(8))
    updatedBalances[toToken] = Number(((updatedBalances[toToken] ?? 0) + toAmount).toFixed(8))

    return {
      ...prev,
      balances: updatedBalances,
      totalBalance: Math.max(0, Number((prev.totalBalance + swapCostUsd).toFixed(2))),
      tradeCapital: prev.tradeCapital,
    }
  })
  ```
  And `src/components/TradingDashboard.tsx`, lines 455–460:
  ```tsx
  <SwapWidget
    onSwapSuccess={onExecuteSwap}
    userEthBalance={portfolio.balances.ETH ?? 0}
    userUsdtBalance={portfolio.balances.USDT ?? 0}
    balances={portfolio.balances}
  />
  ```
- **Observed Result**:
  1. A swap exceeding balance (e.g. 1,000 ETH with a 3.2 ETH wallet) is rejected immediately at both the UI button level and the `App.tsx` state update level (`expect(swapRes.success).toBe(false)`).
  2. `tradeCapital` remains strictly invariant across spot swaps (`expect(res.portfolio.tradeCapital).toBe(22540.0)`).
  3. Depleting an asset balance to 0 stays at 0 via `balances.ETH ?? 0` without reviving to the fallback 2.5.

---

### Observation 1.3: OrderEntryWidget TP/SL Cleared Input Behavior (Stress Point 3)
- **File & Line**: `src/components/OrderEntryWidget.tsx`, lines 410–418 and lines 433–441:
  ```tsx
  <input
    type="number"
    step="any"
    value={customTp}
    placeholder={defaultTpPrice.toFixed(assetConfig.digits)}
    onChange={(e) => setCustomTp(e.target.value)}
    disabled={!tpEnabled}
    className="..."
  />
  ```
  And lines 121–125:
  ```typescript
  const parsedCustomTp = customTp.trim() !== '' ? parseFloat(customTp) : NaN
  const effectiveTp = !isNaN(parsedCustomTp) && parsedCustomTp > 0 ? parsedCustomTp : defaultTpPrice
  const parsedCustomSl = customSl.trim() !== '' ? parseFloat(customSl) : NaN
  const effectiveSl = !isNaN(parsedCustomSl) && parsedCustomSl > 0 ? parsedCustomSl : defaultSlPrice
  ```
- **Observed Result**:
  `value={customTp}` is directly controlled without the `|| defaultTpPrice` short-circuit trap. When a user presses Backspace to clear the field, `customTp` becomes `""` and stays empty. The placeholder dynamically shows `defaultTpPrice.toFixed(assetConfig.digits)` (3 digits for JPY, 2 for crypto/gold, 5 for forex). Submitting the order when blank safely defaults to `defaultTpPrice`.

---

### Observation 1.4: MarketStore Execution Fill Non-Negative Price under Extreme Sell Orders (Stress Point 4)
- **File & Line**: `src/stores/marketStore.ts`, lines 248–264 (and mirrored in `src/test/contracts/stores/marketStore.ts`, lines 143–159):
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
- **Observed Result**:
  When selling 2,000,000,000 BTC (`calculateExecutionFill('BTC/USDT', 'SELL', 2_000_000_000)`):
  - `slippagePct` is capped at `0.50` (50%).
  - `slippageCost` does not exceed `midPrice * 0.50`.
  - `fillPrice >= 0.01` (crypto minTickSize), completely preventing negative fill prices (`-$30,435.25` is permanently resolved). Verified in `challenger2_stress.test.ts:524`: `expect(fill.fillPrice).toBeGreaterThan(0)`.

---

### Observation 1.5: TradingViewChart Multi-Bar Batching Rendering All Intermediate Bars (Stress Point 5)
- **File & Line**: `src/components/TradingViewChart.tsx`, lines 295–306 and lines 386–395:
  ```typescript
  // If candle buffer was truncated, cleared, or received an abnormally large batch (> 50 bars),
  // perform a complete setData resync to avoid out-of-order errors or unhandled evictions.
  if (candles.length < prevLen || (candles.length - prevLen > 50)) {
    const formattedCandles: CandlestickData<UTCTimestamp>[] = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))
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
- **Observed Result**:
  When a batch of multiple candles arrives (e.g. length expands from 1 to 3), `startIndex = 1` iterates through index 1 and index 2, calling `updateSeriesBar()` for each in chronological order. Intermediate candles are no longer dropped. For batches larger than 50 bars or buffer resets, `setData()` resynchronizes the entire canvas cleanly.

---

### Observation 1.6: Build, Test, and Linter Execution
- **Challenger 2 Stress Test Suite**:
  ```
  pnpm exec vitest run src/test/tier5_adversarial/challenger2_stress.test.ts
  Exit code: 0
  Result: 17 passed (17) in 148ms
  ```
- **Complete Vitest Suite**:
  ```
  pnpm test
  Exit code: 0
  Result: 25 test files passed (25), 191 tests passed (191) in 796ms
  ```
- **Production Build**:
  ```
  pnpm build (tsc -b && vite build)
  Exit code: 0
  Modules transformed: 1934
  Output: dist/index.html, dist/assets/index-BPbGKkzx.css, dist/assets/index-B0X6DWig.js
  ```
- **Linter**:
  ```
  pnpm lint (oxlint)
  Exit code: 0
  Errors: 0 (26 pre-existing warnings in 69 files)
  ```

---

## 2. Logic Chain

1. **Premise 1 (FX Conversion Correctness)**:
   Per `ORIGINAL_REQUEST.md` R1 and F05 quantitative standards, mark-to-market PnL must reflect institutional denomination. In Forex pairs where USD is the base currency and JPY is the quote currency (`USD/JPY`), the pip value is in JPY ($0.01 \times 100,000 = 1,000\text{ JPY}$). Dividing by `mark` ($153.00$) yields the true USD equivalent ($653.59\text{ USD}$). The fallback `jpyRate = mark > 0 ? mark : (pos.entryPrice > 0 ? pos.entryPrice : 1)` eliminates zero-division risk (Observation 1.1).

2. **Premise 2 (Spot Asset Balance Sheet Conservation)**:
   A spot exchange swaps one asset for another; it does not lock margin collateral. Therefore, `tradeCapital` must remain strictly invariant ($\Delta \text{tradeCapital} = 0$). By checking `fromAmount <= currentBalance` prior to execution, clamping to 0 upon depletion, preventing resurrection via nullish coalescing `?? 0`, and adjusting `totalBalance` strictly by net transaction friction $(V_{\text{to}} - V_{\text{from}})$, infinite balance creation and balance sheet distortion are eliminated (Observation 1.2).

3. **Premise 3 (UI Form Usability & Input Control)**:
   Controlled input values in React should reflect user keystrokes without overriding backspaces. Moving the fallback price into `placeholder` preserves an empty input state (`""`), and calculating `effectiveTp` on submit provides a clean fallback without trapping the user (Observation 1.3).

4. **Premise 4 (Execution Collars & Positive Price Floors)**:
   In financial matching engines, orders beyond normal liquidity depth are protected by collars. Capping `slippagePct` at $50\%$ and enforcing a floor at `minTickSize` prevents negative fill prices under extreme order sizes up to 2 Billion units (Observation 1.4).

5. **Premise 5 (Chart Data Completeness)**:
   Lightweight-charts requires chronological feeding of time series bars. Sequentially looping through missing indices (`Math.max(0, prevLen)` to `candles.length - 1`) preserves intermediate bars on batch delivery, while `setData()` guards against buffer truncation (Observation 1.5).

6. **Conclusion**:
   All 5 stress points identified in Iteration 1 have been remediated with authentic quantitative algorithms and tested with zero failures across 191 tests and production build (Observation 1.6).

---

## 3. Caveats

1. **Pre-existing Linter Warnings**: Oxlint reports 26 warnings regarding React Compiler purity and state setting inside effects in `App.tsx` and `OrderEntryWidget.tsx`. These warnings are pre-existing, do not cause runtime errors, and do not block production build (`exit code 0`).
2. **Cross-JPY Pairs**: The platform currently supports `USD/JPY` as its primary JPY market. If cross-currency pairs (e.g. `EUR/JPY`, `GBP/JPY`) are introduced in future milestones, conversion from JPY to USD will require multiplying by `USD/JPY` rate rather than dividing by the cross pair's mark price.

---

## 4. Conclusion

**Verdict**: **APPROVE**

Milestone 1 Iteration 2 satisfies all institutional-grade criteria set forth in `ORIGINAL_REQUEST.md` and `PROJECT.md`:
1. USD/JPY PnL calculates accurate institutional USD conversion (~$653.59 USD on 100 pips at 153.00).
2. SwapWidget and App.tsx reject unbacked swaps and preserve `tradeCapital` invariance.
3. OrderEntryWidget TP/SL inputs can be cleared freely with clean placeholders and accurate digit formatting.
4. MarketStore execution fill enforces positive fill prices (`fillPrice > 0`) under extreme SELL orders (up to 2B units).
5. TradingViewChart multi-bar batching renders all intermediate candles sequentially.
6. The entire test suite (25 files, 191 tests) passes with 100% success.
7. Production build (`tsc -b && vite build`) succeeds with exit code 0.

---

## 5. Verification Method

Independent reproduction steps:

```bash
# 1. Run Challenger 2 Adversarial Stress Suite (17 tests)
pnpm exec vitest run src/test/tier5_adversarial/challenger2_stress.test.ts

# 2. Run Swap Accounting Invariant Suite (4 tests)
pnpm exec vitest run src/test/tier1_features/swapAccounting.test.ts

# 3. Run Full Test Suite (191 tests across 25 files)
pnpm test

# 4. Run TypeScript Project Reference & Production Build
pnpm build

# 5. Run Linter
pnpm lint
```

### Invalidation Conditions:
- `fillPrice <= 0` under any order size.
- USD/JPY unrealized PnL exceeding `(priceDelta * lots * 100,000) / mark`.
- Swap executing successfully when `fromAmount > balance`.
- Spot swap modifying `tradeCapital`.
- Intermediate candles skipped during multi-bar batch chart updates.
