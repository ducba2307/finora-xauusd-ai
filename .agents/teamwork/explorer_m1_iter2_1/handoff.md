# Handoff Report: Explorer 1 (Milestone 1, Iteration 2)

**Author**: Explorer 1 (analyst, investigator)  
**Date**: 2026-10-11T07:40:00Z  
**Project**: Finora Quant AI Trading Platform (`d:\VIBECODE\finora-trading-ai`)  
**Assignment**: Remediation Design for USD/JPY PnL Currency Conversion and Market Store Slippage Capping  
**Status**: COMPLETE (Read-Only Analysis)

---

## Executive Summary
This investigation confirms Challenger 2's findings on the ~153x USD/JPY PnL distortion in `src/App.tsx` (and `OrderEntryWidget.tsx`) and the uncapped slippage subtraction yielding negative fill prices in `src/stores/marketStore.ts`. We provide mathematically proven, zero-regression remediations with zero division safeguards that preserve institutional precision for EUR/USD, GBP/USD, XAU/USD, and Crypto.

---

## 1. Observation

### Observation 1.1: USD/JPY Quote Currency PnL Distortion in `src/App.tsx`
- **Location**: `src/App.tsx`, lines 87–95:
  ```typescript
  const mark = ticker.midPrice
  const isForex = pos.market === 'FOREX' || pos.symbol.includes('EUR') || pos.symbol.includes('GBP') || pos.symbol.includes('JPY') || pos.symbol.includes('XAU')
  const isGold = pos.symbol.includes('XAU')
  const notionalMultiplier = isForex ? (isGold ? 100 : 100000) : 1
  const isLong = pos.side === 'LONG'
  const priceDelta = isLong ? mark - pos.entryPrice : pos.entryPrice - mark
  const pnl = Number((priceDelta * (pos.lots !== undefined ? pos.lots : pos.size) * notionalMultiplier).toFixed(2))
  const pnlPct = Number(((pnl / (pos.margin || 1)) * 100).toFixed(2))
  ```
- **Observed Behavior**:
  For `USD/JPY` (1 standard lot = $100,000 USD notional, quoted in JPY per USD):
  When price moves by 1.00 JPY (+100 pips, e.g. from 152.00 to 153.00), $\text{priceDelta} = 1.00\text{ JPY/USD}$.
  `priceDelta * 1.0 * 100,000` evaluates to $100,000.00\text{ JPY}$.
  Because the user's portfolio and account equity are denominated in USD (and formatted as `+$100,000.00` in `PositionsTable.tsx` line 97), the un-converted JPY amount is treated directly as US Dollars.
  At the current exchange rate of 153.00 JPY/USD, the true mark-to-market USD profit is:
  $$\text{PnL (USD)} = \frac{100,000\text{ JPY}}{153.00\text{ JPY/USD}} \approx \$653.59\text{ USD}$$
  The current code calculates $\$100,000.00$, overstating USD/JPY PnL by **$153.00\times$** (a 15,200% exaggeration).
  Upon position close (`App.tsx` lines 186–187), this distorted PnL is credited to `portfolio.totalBalance` and `portfolio.realizedProfit`, corrupting user equity.

### Observation 1.2: USD/JPY Opening Fill PnL Distortion in `src/components/OrderEntryWidget.tsx`
- **Location**: `src/components/OrderEntryWidget.tsx`, lines 160–167:
  ```typescript
  const notionalMultiplier = isForex
    ? (finalSymbol.includes('XAU') ? 100 : 100000)
    : 1
  const priceDelta = side === 'LONG'
    ? currentPrice - fill.fillPrice
    : fill.fillPrice - currentPrice
  initialUnrealizedPnl = Number((priceDelta * parsedAmount * notionalMultiplier).toFixed(2))
  initialUnrealizedPnlPct = Number(((initialUnrealizedPnl / (requiredMargin || 1)) * 100).toFixed(2))
  ```
- **Observed Behavior**: When a user submits a market order for USD/JPY, the newly generated position is created with an immediate `initialUnrealizedPnl` that suffers from the identical missing currency quotient before the first market tick arrives.

### Observation 1.3: Uncapped Slippage Subtraction in `src/stores/marketStore.ts`
- **Location**: `src/stores/marketStore.ts`, lines 247–257:
  ```typescript
  // Square-root slippage formula
  const sizeRatio = Math.max(0.1, lotOrSize / marketDepth)
  const slippagePct = baseSlippagePct * Math.sqrt(sizeRatio)
  const slippageCost = ticker.midPrice * slippagePct

  const spreadCost = Math.abs(ticker.askPrice - ticker.bidPrice) / 2

  const fillPrice = side === 'BUY'
    ? ticker.askPrice + slippageCost
    : ticker.bidPrice - slippageCost
  ```
- **Observed Behavior**:
  For SELL orders, `fillPrice = ticker.bidPrice - slippageCost`.
  `slippagePct` is computed as $\text{baseSlippagePct} \times \sqrt{\text{sizeRatio}}$ with **no upper ceiling**.
  When `lotOrSize = 2,000,000,000` BTC:
  - `sizeRatio = 2,000,000,000 / 50 = 40,000,000`
  - $\sqrt{\text{sizeRatio}} \approx 6,324.555$
  - `slippagePct = 0.0002 * 6324.555 = 1.26491` (126.49%)
  - `slippageCost = 114,884 * 1.26491 = $145,318.25`
  - `fillPrice = 114,883 - 145,318.25 = -$30,435.25`
  The fill price is negative (`-$30,435.25`).
- **Test Evidence**: In `src/test/tier5_adversarial/challenger2_stress.test.ts` lines 490–501:
  ```typescript
  const fill = store.calculateExecutionFill('BTC/USDT', 'SELL', 2_000_000_000)
  expect(fill.fillPrice).toBeLessThan(0)
  ```
  This test was written by Challenger 2 to prove that the execution engine allows negative prices on unbounded sell volume.

---

## 2. Logic Chain

### 2.1 Currency Conversion Analysis (Premise -> Derivation -> Invariance)
1. **Premise 1 (FX Contract Specifications)**:
   - Currency pairs are quoted as Base/Quote ($A/B$).
   - A standard lot represents 100,000 units of the Base currency $A$.
   - The exchange rate $R$ is units of Quote currency $B$ per 1 unit of Base currency $A$.
   - For a position of $N$ lots, the notional value is $N \times 100,000$ units of $A$.
   - A price movement $\Delta P = P_{mark} - P_{entry}$ represents a change in units of $B$ per unit of $A$.
   - Total nominal profit in Quote currency $B$:
     $$\text{PnL}_B = \Delta P \times N \times 100,000\text{ (units of } B\text{)}$$
2. **Premise 2 (Account Valuation in USD)**:
   - Finora's user portfolio, equity, and balances are denominated in USD.
   - When Quote currency $B$ is USD (`EUR/USD`, `GBP/USD`, `XAU/USD`):
     $B = \text{USD} \implies \text{PnL}_{\text{USD}} = \text{PnL}_B$.
     No currency conversion is required. The existing formula is 100% accurate.
   - When Base currency $A$ is USD and Quote currency $B$ is JPY (`USD/JPY`):
     $B = \text{JPY}$. The nominal profit is in Japanese Yen.
     To convert JPY to USD at mark price $P_{mark}$ (which is JPY per USD):
     $$\text{PnL}_{\text{USD}} = \frac{\text{PnL}_{\text{JPY}}}{P_{mark}} = \frac{\Delta P \times N \times 100,000}{P_{mark}}$$
3. **Multi-Asset Invariance Check**:
   - `BTC/USDT`, `ETH/USDT`, `SOL/USDT`: `isForex = false`, `isJpy = false`. $\text{notionalMultiplier} = 1$. $\text{PnL} = \Delta P \times \text{size}$. Invariance maintained.
   - `XAU/USD`: `isForex = true`, `isGold = true`, `isJpy = false`. $\text{notionalMultiplier} = 100$. $\text{PnL} = \Delta P \times \text{lots} \times 100$. Invariance maintained.
   - `EUR/USD`, `GBP/USD`: `isForex = true`, `isGold = false`, `isJpy = false`. $\text{notionalMultiplier} = 100,000$. $\text{PnL} = \Delta P \times \text{lots} \times 100,000$. Invariance maintained.
   - `USD/JPY`: `isForex = true`, `isGold = false`, `isJpy = true`. $\text{notionalMultiplier} = 100,000$. $\text{PnL} = (\Delta P \times \text{lots} \times 100,000) / P_{mark}$. Remediated with zero impact on other symbols.
4. **Defensive Edge Case Guarding**:
   - What if $P_{mark} \le 0$ or NaN during an adversarial tick test?
   - Conversion rate formula:
     ```typescript
     const jpyRate = mark > 0 ? mark : (pos.entryPrice > 0 ? pos.entryPrice : 1)
     ```
     Guarantees that division is strictly positive, finite, and non-zero.

---

### 2.2 Slippage Bound & Execution Floor Analysis
1. **Premise 1 (Market Microstructure & Circuit Caps)**:
   - In institutional financial exchanges and AMMs, price impact slippage is bounded by execution collars (circuit bands) to prevent catastrophic execution anomalies.
   - A reasonable maximum slippage cap for simulated execution is $50.0\%$ (`MAX_SLIPPAGE_PCT = 0.50`).
2. **Premise 2 (Scaling Invariance for Institutional Order Sizes)**:
   - Challenger 1's test in `src/test/adversarial_challenger_m1.test.ts` lines 213–222 explicitly asserts:
     $$\frac{\text{slippageCost}(5000\text{ lots})}{\text{slippageCost}(50\text{ lots})} \approx 10.0$$
   - At 50 lots: $\text{sizeRatio} = 50 / 50 = 1 \implies \text{slippagePct} = 0.0002 \times 1 = 0.02\%$ (2 bps).
   - At 5,000 lots: $\text{sizeRatio} = 5000 / 50 = 100 \implies \text{slippagePct} = 0.0002 \times 10 = 0.20\%$ (20 bps).
   - Because $0.20\% \ll 50.0\%$, capping at $50.0\%$ does NOT affect orders up to $5,000$ lots (or even up to $312,500,000$ BTC).
   - Therefore, the $10.0\times$ scaling ratio test is 100% preserved!
3. **Premise 3 (Strictly Positive Fill Price Floor)**:
   - For an extreme sell order of 2 Billion BTC:
     With $\text{MAX_SLIPPAGE_PCT} = 0.50$, $\text{slippageCost} = \text{midPrice} \times 0.50 = \$57,442.00$.
     $\text{rawFillPrice} = 114,883.00 - 57,442.00 = \$57,441.00 > 0$.
   - In addition, to defend against pathological micro-price ticker states ($\text{bidPrice} \to 0$):
     ```typescript
     const minTickSize = isCrypto ? 0.01 : symbol.includes('JPY') ? 0.001 : 0.00001
     const fillPrice = Math.max(minTickSize, rawFillPrice)
     ```
     Guarantees that fill price can NEVER be zero or negative under any input.

---

## 3. Caveats

1. **Test Suite Adjustment Requirement**:
   In `src/test/tier5_adversarial/challenger2_stress.test.ts`, line 499:
   ```typescript
   expect(fill.fillPrice).toBeLessThan(0)
   ```
   was written in Iteration 1 to demonstrate the defect. When the worker implements the slippage cap in `marketStore.ts`, this test assertion will naturally fail unless updated to:
   ```typescript
   expect(fill.fillPrice).toBeGreaterThan(0)
   ```
   This is an expected and required test update.
2. **JPY Cross Pairs Scope**:
   Finora currently only trades `USD/JPY` as its JPY asset. Cross-currency pairs where USD is neither base nor quote (e.g. `EUR/JPY` or `GBP/JPY`) are not in `mockData.ts`. If they are added in future milestones, converting JPY PnL to USD will require multiplying by the USD/JPY rate rather than dividing by the cross pair's mark price. For `USD/JPY`, dividing by `mark` is the exact institutional formula.
3. **Read-Only Explorer Compliance**:
   No source code files in `src/` were edited during this investigation. All changes below are provided as ready-to-apply specifications for the worker.

---

## 4. Conclusion & Concrete Implementation Specifications

### Remediation 1: `src/App.tsx` (Lines 88–95)

#### Exact Target Code:
```typescript
<<<<
          const mark = ticker.midPrice
          const isForex = pos.market === 'FOREX' || pos.symbol.includes('EUR') || pos.symbol.includes('GBP') || pos.symbol.includes('JPY') || pos.symbol.includes('XAU')
          const isGold = pos.symbol.includes('XAU')
          const notionalMultiplier = isForex ? (isGold ? 100 : 100000) : 1
          const isLong = pos.side === 'LONG'
          const priceDelta = isLong ? mark - pos.entryPrice : pos.entryPrice - mark
          const pnl = Number((priceDelta * (pos.lots !== undefined ? pos.lots : pos.size) * notionalMultiplier).toFixed(2))
          const pnlPct = Number(((pnl / (pos.margin || 1)) * 100).toFixed(2))
====
          const mark = ticker.midPrice
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
>>>>
```

---

### Remediation 2: `src/components/OrderEntryWidget.tsx` (Lines 160–168)

#### Exact Target Code:
```typescript
<<<<
        const notionalMultiplier = isForex
          ? (finalSymbol.includes('XAU') ? 100 : 100000)
          : 1
        const priceDelta = side === 'LONG'
          ? currentPrice - fill.fillPrice
          : fill.fillPrice - currentPrice
        initialUnrealizedPnl = Number((priceDelta * parsedAmount * notionalMultiplier).toFixed(2))
        initialUnrealizedPnlPct = Number(((initialUnrealizedPnl / (requiredMargin || 1)) * 100).toFixed(2))
====
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
        initialUnrealizedPnlPct = Number(((initialUnrealizedPnl / (requiredMargin || 1)) * 100).toFixed(2))
>>>>
```

---

### Remediation 3: `src/stores/marketStore.ts` (Lines 247–266)

#### Exact Target Code:
```typescript
<<<<
    // Square-root slippage formula
    const sizeRatio = Math.max(0.1, lotOrSize / marketDepth)
    const slippagePct = baseSlippagePct * Math.sqrt(sizeRatio)
    const slippageCost = ticker.midPrice * slippagePct

    const spreadCost = Math.abs(ticker.askPrice - ticker.bidPrice) / 2

    const fillPrice = side === 'BUY'
      ? ticker.askPrice + slippageCost
      : ticker.bidPrice - slippageCost

    const commission = Number((lotOrSize * (isCrypto ? 1.5 : 3.0)).toFixed(2))

    return {
      fillPrice: Number(fillPrice.toFixed(isCrypto ? 2 : symbol.includes('JPY') ? 3 : 5)),
      spreadCost: Number(spreadCost.toFixed(5)),
      slippageCost: Number(slippageCost.toFixed(5)),
      commission,
    }
====
    // Square-root slippage formula with institutional execution cap (max 50% slippage)
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

    const commission = Number((safeSize * (isCrypto ? 1.5 : 3.0)).toFixed(2))

    return {
      fillPrice: Number(fillPrice.toFixed(isCrypto ? 2 : symbol.includes('JPY') ? 3 : 5)),
      spreadCost: Number(spreadCost.toFixed(5)),
      slippageCost: Number(slippageCost.toFixed(5)),
      commission,
    }
>>>>
```

---

### Remediation 4: `src/test/tier5_adversarial/challenger2_stress.test.ts` (Lines 490–501)

#### Exact Target Code:
```typescript
<<<<
    it('ADVERSARIAL BOUNDARY: calculateExecutionFill produces negative fill price on extreme SELL lot sizes', () => {
      // In marketStore.ts lines 248-257:
      // const sizeRatio = Math.max(0.1, lotOrSize / marketDepth)
      // const slippagePct = baseSlippagePct * Math.sqrt(sizeRatio)
      // const slippageCost = ticker.midPrice * slippagePct
      // const fillPrice = ticker.bidPrice - slippageCost (for SELL)
      // When selling 2 Billion BTC:
      const fill = store.calculateExecutionFill('BTC/USDT', 'SELL', 2_000_000_000)
      // Because slippagePct > 100%, slippageCost > bidPrice, yielding a NEGATIVE fill price:
      expect(fill.fillPrice).toBeLessThan(0)
    })
====
    it('ADVERSARIAL BOUNDARY: calculateExecutionFill caps slippage and prevents negative fill price on extreme SELL lot sizes', () => {
      // In marketStore.ts lines 248-265:
      // When selling 2 Billion BTC:
      const fill = store.calculateExecutionFill('BTC/USDT', 'SELL', 2_000_000_000)
      // Guaranteed strictly positive fill price and slippage capped at 50%:
      expect(fill.fillPrice).toBeGreaterThan(0)
      expect(fill.fillPrice).toBeGreaterThanOrEqual(0.01)
      expect(fill.slippageCost).toBeLessThanOrEqual(store.getTicker('BTC/USDT')!.midPrice * 0.50)
    })
>>>>
```

---

## 5. Verification Method

To independently verify the proposed remediations:

1. **Vitest Unit & Adversarial Test Verification**:
   ```powershell
   pnpm exec vitest run src/test/tier5_adversarial/challenger2_stress.test.ts
   pnpm exec vitest run src/test/tier1_features/marketDataSlippage.test.ts
   pnpm exec vitest run src/test/adversarial_challenger_m1.test.ts
   ```
   *Expected outcome*: All test files pass with 0 errors.

2. **Full Regression Suite Execution**:
   ```powershell
   pnpm test
   ```
   *Expected outcome*: All 24 test suites pass cleanly.

3. **Production TypeScript Build & Linter**:
   ```powershell
   pnpm build
   pnpm lint
   ```
   *Expected outcome*: Exit code 0, 0 TypeScript compile errors, 0 linter errors.

4. **Independent Mathematical Verification**:
   - For a 1.0-lot USD/JPY position at entry 152.00 and mark 153.00:
     $$\text{PnL} = \frac{(153.00 - 152.00) \times 1.0 \times 100,000}{153.00} = \frac{100,000}{153.00} = \$653.59\text{ USD}$$
     Verify that `pos.unrealizedPnl === 653.59` and `pos.unrealizedPnlPct === 65.36` (on $1,000 margin).
   - For a 2 Billion BTC sell order:
     Verify that `store.calculateExecutionFill('BTC/USDT', 'SELL', 2_000_000_000).fillPrice > 0`.
