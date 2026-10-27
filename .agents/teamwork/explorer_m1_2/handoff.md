# Investigation & Technical Architecture Report: Milestone 1 (F03 & F05)

**Milestone Focus**: F03 (Institutional Spread & Slippage Model) & F05 (High-Precision Currency & Pip Formatter)  
**Investigator**: Explorer 2 (`explorer_m1_2`)  
**Workspace**: `d:\VIBECODE\finora-trading-ai`  
**Timestamp**: 2026-10-11T07:00:00Z  

---

## 1. Observation

### 1.1 Compiler Failure & Unused Imports in `OrderEntryWidget.tsx`
- **File**: `src/components/OrderEntryWidget.tsx` (lines 6–7)
  ```typescript
  import { defaultMarketStore } from '../stores/marketStore'
  import { getAssetConfig } from '../services/marketDataSimulator'
  ```
- **Command & Output**: Executing `pnpm build` (`tsc -b && vite build`) fails with exit code 2:
  ```
  $ tsc -b && vite build
  src/components/OrderEntryWidget.tsx(6,1): error TS6133: 'defaultMarketStore' is declared but its value is never read.
  src/components/OrderEntryWidget.tsx(7,1): error TS6133: 'getAssetConfig' is declared but its value is never read.
  [ELIFECYCLE] Command failed with exit code 2.
  ```
- **Cause**: In `tsconfig.app.json`, `"noUnusedLocals": true` is enabled. Both symbols were imported to support execution fill and spread modeling, but were never called in the component body.

### 1.2 Execution Pricing Disconnect & Instant $0.00 PnL
- **File**: `src/components/OrderEntryWidget.tsx` (lines 79–81, 137–144)
  ```typescript
  const activePrice = (orderType === 'LIMIT' || orderType === 'TWAP' || orderType === 'ICEBERG') 
    ? (parseFloat(limitPrice) || currentPrice) 
    : currentPrice
  ...
  const newPos: Position = {
    id: `pos-${Date.now()}`,
    symbol: finalSymbol,
    side,
    size: parsedAmount,
    entryPrice: activePrice,
    markPrice: currentPrice,
    ...
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
  ```
- Market orders currently fill directly at `currentPrice` (the mid-market price). There is zero spread deduction, zero volume slippage impact, and starting unrealized PnL is set to `$0.00`.
- In `src/stores/marketStore.ts` (lines 219–257), `MarketDataStore.calculateExecutionFill(symbol, side, lotOrSize)` already exists and implements the institutional non-linear square-root slippage model, but `OrderEntryWidget.tsx` never calls it.

### 1.3 Limit Price Input Overwrite Bug
- **File**: `src/components/OrderEntryWidget.tsx` (lines 50–59)
  ```typescript
  useEffect(() => {
    setLimitPrice(currentPrice.toString())
    if (isForex) {
      setAmountStr('0.50')
      setLeverage(100)
    } else {
      setAmountStr('0.15')
      setLeverage(10)
    }
  }, [symbol, isForex, currentPrice])
  ```
- Because `currentPrice` is included in the `useEffect` dependency array, every incoming price tick (at 1–20 Hz) executes the effect and overwrites the user's manual input in the Limit Price field.

### 1.4 Mock Order Book L2 Generator Spread Distortion
- **File**: `src/data/mockData.ts` (lines 777–812, `GENERATE_ORDER_BOOK`)
  ```typescript
  export const GENERATE_ORDER_BOOK = (basePrice: number): OrderBook => {
    const bids = []
    const asks = []
    let cumulativeBid = 0
    let cumulativeAsk = 0
    const step = basePrice > 1000 ? 2.5 : basePrice > 100 ? 0.25 : 0.0002
  ```
  - For Gold (`XAU/USD` at ~$2734 > 1000), `step = 2.5`. The half-spread is $2.50, making total spread $5.00 (50.0 pips). Institutional gold raw spread is 1.2–2.5 pips ($0.12–$0.25). The mock spread is **20x–40x wider than reality**.
  - For `EUR/USD` (1.0845), `step = 0.0002`. Total spread is 0.0004 (4.0 pips). Institutional raw spread is 0.2–0.4 pips (0.00002–0.00004). The mock spread is **10x wider than reality**.
  - For `USD/JPY` (152.35 > 100), `step = 0.25`. Total spread is 0.50 JPY (50.0 pips). Institutional spread is 0.3–0.5 pips (0.003–0.005 JPY). The mock spread is **100x wider than reality**.
- **File**: `src/services/marketDataSimulator.ts` (lines 255–308)
  - `generateInstitutionalOrderBook(symbol, midPrice, levels)` already exists with exact asset calibration, but `src/components/TradingDashboard.tsx` (lines 50, 66, 145, 342) continues calling `GENERATE_ORDER_BOOK(liveFeed.currentPrice)`.

### 1.5 Order Book Widget Visual & Precision Deficiencies
- **File**: `src/components/OrderBookWidget.tsx` (lines 58–62, 78, 94, 98–100, 117, 133–136, 146)
  - Lines 59–60, 133–134: Hardcoded column headers `Price (USDT)` and `Size (BTC)` regardless of whether viewing `EUR/USD`, `XAU/USD`, or `SOL/USDT`.
  - Line 99: `Spread: <strong className="text-gray-300">${orderBook.spread.toFixed(2)}</strong>`. For `EUR/USD` where spread is 0.00004, `.toFixed(2)` displays `$0.00`, completely masking the spread.
  - Lines 78, 94, 117, 146: Calls `formatCurrency(...)` on ask price, mid price, bid price, and trade tape prices.

### 1.6 SwapWidget Deficiencies: Hardcoded ETH & Absence of AMM Slippage
- **File**: `src/components/SwapWidget.tsx` (lines 22–27, 88–94, 106, 175–178)
  ```typescript
  const ethPrice = 3248.30
  const rate = fromToken === 'ETH' ? ethPrice : 1 / ethPrice
  const parsedFrom = parseFloat(fromAmount) || 0
  const calculatedTo = (parsedFrom * rate).toFixed(2)
  ```
  - When a user selects `SOL`, `fromToken === 'ETH'` evaluates to `false`, using `rate = 1 / 3248.30 = 0.000307`. Swapping 1 SOL yields 0.0003 USDT.
  - Zero AMM constant-product or square-root volume slippage calculation.
  - Hardcoded quote summary: `<span>1 ETH = 3,248.30 USDT</span>`.

### 1.7 Precision Formatter Gaps (F05)
- **File**: `src/utils/formatters.ts` (lines 5–38, 71–88)
  - `formatCurrency` always prepends `$` and uses `maximumFractionDigits: 4` for values >= 1. When applied to `EUR/USD` (e.g. `1.08452`), it outputs `$1.0845`, stripping the 5th decimal (fractional pipette) and improperly prefixing `$`.
  - `formatPrice` and `formatPips` are defined in `src/utils/formatters.ts` (lines 71–88), but `grep_search` reveals they have **zero usages** in any UI component across `src/components/`.
  - Components (`OrderBookWidget.tsx`, `PositionsTable.tsx`, `TradingDashboard.tsx`, `TradingChart.tsx`, `AISwarmConsensusWidget.tsx`, `App.tsx`) continue calling `formatCurrency` or hardcoding `$`.

---

## 2. Logic Chain

```
[Obs 1.1: TS6133 in OrderEntryWidget] 
  └─> tsc -b fails build because defaultMarketStore & getAssetConfig are imported but unused.
  └─> Directly blocks production build requirement (R4/AC: pnpm build exit code 0).

[Obs 1.2: Market Orders execute at midPrice without spread/slippage]
  └─> Orders fill at midPrice; starting unrealized PnL is 0; ignores calculateExecutionFill in marketStore.
  └─> Violates Institutional Trading Fidelity (R1 & F03).
  └─> Fulfilling F03 requires wiring calculateExecutionFill into handleSubmitOrder in OrderEntryWidget.

[Obs 1.3: currentPrice in useEffect dependency array]
  └─> Every live WebSocket / tick update re-runs setLimitPrice(currentPrice.toString()).
  └─> Erases user input inside the Limit Price text box while typing.

[Obs 1.4 & 1.5: GENERATE_ORDER_BOOK & OrderBookWidget spread calculation]
  └─> GENERATE_ORDER_BOOK uses arbitrary step sizes (50 pips Gold, 4 pips EUR/USD, 50 pips USD/JPY).
  └─> OrderBookWidget displays "${orderBook.spread.toFixed(2)}" -> EUR/USD prints "$0.00".
  └─> Table columns hardcoded to USDT/BTC.
  └─> Must delegate GENERATE_ORDER_BOOK to generateInstitutionalOrderBook(symbol, price) 
      and update OrderBookWidget to display pip spread & symbol-aware headers.

[Obs 1.6: SwapWidget hardcodes ethPrice = 3248.30]
  └─> Rates for SOL or other pairs are broken.
  └─> No slippage impact or live ticker binding.
  └─> Must bind SwapWidget to defaultMarketStore tickers with square-root AMM slippage.

[Obs 1.7: formatPrice / formatPips declared but orphaned]
  └─> formatCurrency truncates 5-digit Forex rates and prepends "$".
  └─> formatPrice and formatPips are completely unused in UI widgets.
  └─> Replacing formatCurrency with formatPrice across order book, charts, positions table,
      and trading dashboard resolves F05 cleanly.
```

---

## 3. Caveats
- **Backwards Compatibility**: In `src/data/mockData.ts`, `GENERATE_ORDER_BOOK(basePrice: number)` must support an optional second argument `symbol?: string` while retaining default behavior for legacy callers that only provide `basePrice`.
- **Lightweight-Charts Decimals**: `TradingViewChart.tsx` configures price scale precision. When switching between Forex (5 decimals) and Crypto/Gold (2 decimals), `applyOptions({ priceFormat: { minMove: ... } })` must be respected.
- **Vitest Suite Integrity**: All proposed changes must maintain 100% test passing status across all 22 test files (130/130 tests currently pass in Vitest).

---

## 4. Conclusion & Actionable Implementation Plan

### 4.1 F03: Institutional Spread & Slippage Implementation

#### A. Wire Execution Fills in `OrderEntryWidget.tsx`
1. For Market orders (`orderType === 'MARKET'`):
   - Invoke `defaultMarketStore.calculateExecutionFill(finalSymbol, side === 'LONG' ? 'BUY' : 'SELL', parsedAmount)`.
   - `entryPrice` = `fill.fillPrice` (incorporating `Ask = Mid + Spread/2 + Slippage` for BUY, `Bid = Mid - Spread/2 - Slippage` for SELL).
2. Starting Unrealized PnL:
   - For LONG: marked against current mark price (or bid):
     `priceDelta = currentPrice - fill.fillPrice` (strictly negative).
     `unrealizedPnl = isForex ? (symbol.includes('XAU') ? priceDelta * 100 * parsedAmount : priceDelta * 100000 * parsedAmount) : priceDelta * parsedAmount`.
     `unrealizedPnlPct = (unrealizedPnl / requiredMargin) * 100`.
   - For SHORT:
     `priceDelta = fill.fillPrice - currentPrice` (strictly negative).
     `unrealizedPnl = isForex ? (symbol.includes('XAU') ? priceDelta * 100 * parsedAmount : priceDelta * 100000 * parsedAmount) : priceDelta * parsedAmount`.
     `unrealizedPnlPct = (unrealizedPnl / requiredMargin) * 100`.
3. Fix the limit price overwrite bug:
   - In `useEffect`, remove `currentPrice` from the dependency array: `[symbol, isForex]`.
   - Resolve TS6133 by utilizing `defaultMarketStore` and `getAssetConfig` in order execution and liquidation calculation.

#### B. Align Order Book L2 Generator (`mockData.ts` & `OrderBookWidget.tsx`)
1. In `src/types/trading.ts`:
   - Extend `OrderBook` with optional `spreadPips?: number`.
2. In `src/data/mockData.ts`:
   - Re-export or delegate `GENERATE_ORDER_BOOK`:
     ```typescript
     export const GENERATE_ORDER_BOOK = (basePrice: number, symbol: string = 'BTC/USDT'): OrderBook => {
       return generateInstitutionalOrderBook(symbol, basePrice)
     }
     ```
3. In `src/components/TradingDashboard.tsx`:
   - Update calls to `GENERATE_ORDER_BOOK(price, selectedAsset.symbol)`.
   - Pass `symbol={selectedAsset.symbol}` to `OrderBookWidget`.
4. In `src/components/OrderBookWidget.tsx`:
   - Accept `symbol?: string` in props.
   - Dynamic headers: `Price (${quote})` and `Size (${base})`.
   - Render spread: if Forex or `spreadPips` exists, display `{orderBook.spreadPips.toFixed(1)} pips` instead of `${orderBook.spread.toFixed(2)}`.
   - Use `formatPrice(price, symbol)` for all order book and trade tape rows.

#### C. Overhaul `SwapWidget.tsx` with Live Prices & Square-Root AMM Slippage
1. Retrieve live prices dynamically from `defaultMarketStore` (`USDT: 1.0`, `ETH`, `SOL`, `BTC`).
2. Compute `rawRate = fromPriceUsd / toPriceUsd`.
3. Model institutional AMM slippage:
   ```typescript
   const tradeUsdValue = parsedFrom * fromPriceUsd
   const poolDepthUsd = 10_000_000
   const baseFeePct = 0.0005 // 0.05%
   const impactPct = 0.0025 * Math.sqrt(Math.max(0, tradeUsdValue) / poolDepthUsd)
   const totalSlippagePct = Math.min(0.05, baseFeePct + impactPct)
   const effectiveRate = rawRate * (1 - totalSlippagePct)
   const calculatedTo = (parsedFrom * effectiveRate).toFixed(toToken === 'USDT' ? 2 : 4)
   ```
4. Render dynamic rate quote and slippage metrics in the UI.

---

### 4.2 F05: High-Precision Currency & Pip Formatter Implementation

#### A. Finalize `src/utils/formatters.ts`
```typescript
/**
 * Symbol-aware precision price formatter conforming to F05.
 * 5 decimals for EUR/USD & GBP/USD; 3 for USD/JPY; 2 for Metals/Crypto.
 * Never prepends '$' to Forex exchange rates.
 */
export function formatPrice(price: number, symbol: string = '', includeCommas: boolean = true): string {
  if (!Number.isFinite(price)) return '0.00'
  const clean = (symbol || '').toUpperCase().trim()
  const isJpy = clean.includes('JPY')
  const isFxMajors = (clean.includes('EUR') || clean.includes('GBP')) && !clean.includes('USDT')
  const digits = isFxMajors ? 5 : isJpy ? 3 : 2

  if (!includeCommas || isFxMajors || isJpy) {
    return price.toFixed(digits)
  }

  return price.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/**
 * Pip difference and spread formatter with fractional pipette precision.
 */
export function formatPips(pips: number, showSign: boolean = true, decimals: number = 1): string {
  if (!Number.isFinite(pips)) return '0.0 pips'
  const sign = showSign && pips > 0 ? '+' : ''
  return `${sign}${pips.toFixed(decimals)} pips`
}
```

#### B. Component UI Rollout
Replace `formatCurrency` with `formatPrice(price, symbol)` across:
1. `src/components/OrderBookWidget.tsx`: asks, bids, mark price, trades tape.
2. `src/components/PositionsTable.tsx`: entryPrice, markPrice, liquidationPrice.
3. `src/components/TradingDashboard.tsx`: ticker bar, watchlist & sparklines, AI fills log.
4. `src/components/AISwarmConsensusWidget.tsx`: entry, SL, TP, TP2 prices.
5. `src/components/OrderEntryWidget.tsx`: estimated liquidation price.
6. `src/components/TradingChart.tsx`: current display price, min/max bounds, active hover price.
7. `src/App.tsx`: `handleOrderPlaced` toast notification.

---

## 5. Verification Method

### 5.1 Automated Test Execution
Run the full Vitest test suite:
```bash
pnpm test
```
- **Expected Outcome**: All 22 test files, 130 tests PASS.
- Key tests validating F03 and F05:
  - `src/test/tier1_features/marketDataSlippage.test.ts` (institutional spread boundaries and sqrt volume slippage).
  - `src/test/tier1_features/formatters.test.ts` (precision formatting, currency notation).
  - `src/test/tier3_pairwise/orderMarginSlippage.test.ts` (order sizing, slippage execution, margin deduction).

### 5.2 Build & Type Checking
Run the TypeScript compiler and Vite production build:
```bash
pnpm build
```
- **Expected Outcome**: Exit code 0, 0 TypeScript errors. `TS6133` in `OrderEntryWidget.tsx` must be eliminated.

### 5.3 Linter & Oxlint Verification
Run Oxlint:
```bash
pnpm lint
```
- **Expected Outcome**: 0 errors. Unused variable warnings on `defaultMarketStore` and `getAssetConfig` eliminated.

### 5.4 Manual UI & Invalidation Conditions
1. **Forex Rate UI Check**:
   - Select `EUR/USD` in the Terminal.
   - Verify ticker bar displays `1.08452` (NOT `$1.0845`).
   - Verify Order Book columns display `Price (USD)` and `Size (EUR)`.
   - Verify Order Book spread indicator displays `0.3 pips` or `0.4 pips` (NOT `$0.00`).
2. **Order Execution Realism Check**:
   - Submit 1.00 Lot Market Buy order on `XAU/USD` at mid $2734.50.
   - Entry price fills above mid (e.g. $2734.62, factoring in half-spread + slippage).
   - Verify initial unrealized PnL is negative (e.g. -$12.00 to -$15.00), reflecting immediate execution cost.
3. **Limit Price Retention Check**:
   - In Order Desk, switch to `LIMIT` order and enter custom price `112,000`.
   - Observe for 10 seconds: incoming ticks must not wipe out or overwrite the input.
4. **SwapWidget Multi-Asset Swap Check**:
   - In SwapWidget, select `SOL` -> `USDT`, input `10.0` SOL.
   - Verify calculated USDT reflects ~$1,940 (NOT $0.003).
   - Verify dynamic slippage percentage and sponsored gas fee are displayed.

---
*Report prepared by Explorer 2 for Milestone 1.*
