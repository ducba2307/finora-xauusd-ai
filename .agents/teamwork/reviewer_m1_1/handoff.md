# Review & Adversarial Stress Report — Reviewer 1 (Milestone 1)

## Review Summary

**Verdict**: **APPROVE**  
**Integrity Mode**: Development / Institutional Standard  
**Integrity Audit**: **PASS — ZERO INTEGRITY VIOLATIONS DETECTED**  
**Milestone Scope**: Milestone 1 (Market Data Store, Feed Engine & Execution Fidelity: F01, F02, F03, F04, F05)

---

## 1. Observation

### Independent Command Executions & Test Results

1. **TypeScript Typecheck (`pnpm exec tsc -b`)**:
   - Exit code: `0`
   - Stdout/Stderr: Empty (Clean compilation across all project modules and test suites).

2. **Automated Test Suite (`pnpm test`)**:
   - Exit code: `0`
   - Vitest output:
     ```
     ✓ src/test/tier1_features/formatters.test.ts (7 tests) 14ms
     ✓ src/test/tier1_features/backtestEngine.test.ts (5 tests) 9ms
     ✓ src/test/tier1_features/alphaIndicators.test.ts (8 tests) 6ms
     ✓ src/test/tier4_realworld/multiTrade100BarBacktest.test.ts (1 test) 14ms
     ✓ src/test/adversarial_challenger_m2.test.ts (13 tests) 16ms
     ✓ src/test/tier5_adversarial/m2QuantStress.test.ts (29 tests) 28ms
     ✓ src/test/tier2_boundaries/zeroVarianceFlatEquity.test.ts (6 tests) 5ms
     ✓ src/test/tier2_boundaries/emptyAndSingleData.test.ts (6 tests) 6ms
     ✓ src/test/tier1_features/marketDataSlippage.test.ts (8 tests) 6ms
     ✓ src/test/tier3_pairwise/backtestCommissionExecution.test.ts (2 tests) 6ms
     ✓ src/test/tier2_boundaries/extremeLeverageMargin.test.ts (5 tests) 3ms
     ✓ src/test/tier1_features/orderLifecycle.test.ts (5 tests) 3ms
     ✓ src/test/tier4_realworld/goldNewsVolatilitySpike.test.ts (1 test) 3ms
     ✓ src/test/tier3_pairwise/botSignalCircuitBreaker.test.ts (3 tests) 3ms
     ✓ src/test/tier1_features/quantMath.test.ts (7 tests) 4ms
     ✓ src/test/tier1_features/errorBoundaries.test.ts (5 tests) 4ms
     ✓ src/test/tier1_features/riskCircuitBreaker.test.ts (6 tests) 4ms
     ✓ src/test/tier3_pairwise/tickFeedPositionSync.test.ts (3 tests) 3ms
     ✓ src/test/tier3_pairwise/orderMarginSlippage.test.ts (3 tests) 3ms
     ✓ src/test/tier2_boundaries/nanDivisionGuards.test.ts (5 tests) 4ms
     ✓ src/test/tier4_realworld/cryptoCascadeCircuitTrip.test.ts (1 test) 3ms
     ✓ src/test/tier2_boundaries/extremeTicksAndGaps.test.ts (5 tests) 3ms

     Test Files  22 passed (22)
          Tests  134 passed (134)
       Duration  684ms
     ```

3. **Production Vite Build (`pnpm build`)**:
   - Exit code: `0`
   - Output:
     ```
     vite v8.3.4 building client environment for production...
     ✓ 1934 modules transformed.
     rendering chunks...
     computing gzip size...
     dist/index.html                   1.07 kB │ gzip:   0.63 kB
     dist/assets/index-IZEADTdg.css   84.49 kB │ gzip:  12.45 kB
     dist/assets/index-sQ9XXhJ1.js   701.30 kB │ gzip: 196.55 kB
     ✓ built in 405ms
     ```

4. **Linter Inspection (`pnpm lint`)**:
   - Exit code: `0`
   - Output: `Found 24 warnings and 0 errors. Finished in 52ms on 66 files with 116 rules.`

5. **Adversarial Stress Test Suite (`pnpm test src/test/adversarial_challenger_m1.test.ts`)**:
   - Exit code: `0`
   - Vitest output:
     ```
     ✓ src/test/adversarial_challenger_m1.test.ts (28 tests) 456ms
     Test Files  1 passed (1)
          Tests  28 passed (28)
     ```

---

## 2. Integrity Audit & Deep Code Inspection

### Integrity Assessment
- **Hardcoded test expectations embedded in logic**: NONE detected. Formulas in `marketStore.ts` and `marketDataSimulator.ts` calculate stochastic GBM ticks, Box-Muller random normals, Ornstein-Uhlenbeck drifts, square-root slippage, and exponential smoothing in real-time.
- **Dummy or facade implementations**: NONE detected. The centralized `MarketDataStore` manages real Maps, Set listeners, background feeds, and subscriber callbacks.
- **Shortcuts or bypasses**: NONE detected. All 5 features (F01-F05) are fully realized and wired into the application.
- **Fabricated verification logs**: NONE detected. Test runs were executed live on the system with verified exit codes.

### Detailed Component Verification

#### 1. F01: Centralized Market Data Store (`src/stores/marketStore.ts`)
- **Interface Conformance**: Conforms 100% to `PROJECT.md § Interface Contracts § 1`.
  - Properties: `symbol`, `category`, `midPrice`, `bidPrice`, `askPrice`, `spreadPips`, `spreadUsd`, `high24h`, `low24h`, `change24hPct`, `volume24h`, `lastUpdateTimestamp`, `connectionStatus`.
  - Methods: `getTicker`, `getAllTickers`, `calculateExecutionFill`, `subscribeTicker`, `subscribeAll`, `startGlobalFeed`, `stopGlobalFeed`, `isFeedActive`.
  - React Hooks: `useMarketTicker`, `useAllMarketTickers`.
- **Timer Safety**: Lines 35-40 check `globalThis?.__VITEST_ENVIRONMENT__ || globalThis?.process?.env?.VITEST` before launching the global feed timer in constructor, preventing open handles during Vitest execution.

#### 2. F02: Calibrated Feed Engine & ECN Simulation (`src/services/marketDataSimulator.ts`)
- **Ornstein-Uhlenbeck Mean-Reversion Drift**:
  - Implemented in lines 173-178: `drift = kappa * deviation`, with $\kappa = 0.08$ pulling towards `anchorPrice`.
  - Box-Muller transformation: lines 117-123 generate standard normal random variables $Z \sim \mathcal{N}(0, 1)$ without library dependencies.
- **2-Sigma Spread Expansion**:
  - Lines 189-191: when $|Z| > 2.0$, spread expands by 1.4x (capped at 1.5x `maxSpreadPips`).
- **Session-Aware Volatility Multipliers**:
  - Asian Session (00:00 - 08:00 UTC): 0.8x
  - London Open (08:00 - 13:00 UTC): 1.3x
  - London / NY Overlap (13:00 - 16:30 UTC): 1.6x
  - NY Afternoon (16:30 - 21:00 UTC): 1.1x
  - Pacific / Rollover (21:00 - 24:00 UTC): 0.6x
- **Intra-Bar vs. Closed-Bar EMA Safety**:
  - `calculateClosedBarEMA` (lines 233-243): applies standard exponential decay $\alpha = 2 / (period + 1)$ strictly to closed bars.
  - `calculateProvisionalEMA` (lines 249-259): computes real-time preview without mutating the underlying closed-bar baseline, eliminating historical smoothing degradation.

#### 3. F02: Stream Management & WebSocket Concurrency (`src/hooks/useLiveMarketFeed.ts`)
- **Connection Epoch Pattern**:
  - Line 154: `const currentEpoch = ++connectionEpochRef.current`.
  - Checked in `ws.onopen`, `ws.onmessage`, `ws.onerror`, `ws.onclose`, and fallback intervals. Guarantees that callbacks from superseded connections or timeframes never update state.
- **Dual-Stream Collision Guard**:
  - When `ws.onopen` fires, `stopFallbackSimulation()` is invoked immediately.
  - If `ws.onerror` or `ws.onclose` fires, `startFallbackSimulation()` is invoked and exponential backoff is scheduled.
- **High-Frequency RAF Batching**:
  - Incoming klines are staged in `pendingTickRef.current` and flushed via `requestAnimationFrame` (lines 368-376) to prevent React thread congestion.

#### 4. F03: Realistic Spread & Square-Root Slippage Model (`marketStore.ts`)
- **Institutional Spreads**:
  - FX: EUR/USD 0.2-0.4 pips, GBP/USD 0.3-0.6 pips, USD/JPY 0.3-0.5 pips.
  - Gold XAU/USD: 1.2-2.5 pips ($0.12 - $0.25 spread).
  - Crypto BTC: $1.00 - $3.00 spread.
- **Square-Root Market Impact**:
  - Formula: $\text{slippagePct} = \text{baseSlippagePct} \times \sqrt{\max(0.1, \text{tradeSize} / \text{marketDepth})}$.
  - Tested: $100\times$ order size correctly causes $10\times$ slippage cost ($\sqrt{100} = 10$).
  - BUY orders fill at $\text{Ask} + \text{slippageCost}$; SELL orders fill at $\text{Bid} - \text{slippageCost}$.

#### 5. F04: Chart Performance & UI Jitter Elimination
- **`TradingViewChart.tsx`**:
  - Wrapped in `React.memo`.
  - Uses O(1) `series.update()` for streaming intra-bar ticks and new bar arrivals (lines 297-332).
  - Reserves full `.setData()` strictly for symbol or timeframe switches (`isSymbolOrTfChange`).
- **`OrderEntryWidget.tsx`**:
  - Limit price overwrite bug resolved: decoupled from incoming ticks via `prevSymbolRef` and `isInitializedRef`. Traders' input is preserved across ticks. Added "Market" snap button.
- **`TradingDashboard.tsx`**:
  - L2 orderbook re-renders throttled to 150ms (lines 65-72).
  - AI signal recomputations throttled to symbol switches or price movements $\ge 0.1\%$ (lines 94-110).

#### 6. F05: Currency & Pip Precision Formatter (`src/utils/formatters.ts`)
- `formatPrice`:
  - 5 decimals for EUR/USD & GBP/USD (e.g., `1.08250`, `1.29456`).
  - 3 decimals for USD/JPY (e.g., `152.450`).
  - 2 decimals for Metals/Crypto with comma thousands (e.g., `2,734.50`, `114,884.00`).
  - Strictly no `$` prefix on Forex exchange rates.
- `formatPips`:
  - Outputs signed fractional pipettes (e.g., `+1.5 pips`, `-0.8 pips`, `0.4 pips`).
- Immunity: all formatters return safe fallbacks on `NaN`, `Infinity`, or `-Infinity`.

---

## 3. Adversarial Stress-Test Findings & Logic Chain

### Evidence Chain

| Test Domain | Stress Condition | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|
| **High-Frequency Bursts** | 10,000 rapid ticks on EUR/USD, XAU/USD, BTC/USDT | Finite, non-negative prices, no NaN/Infinity, $>10,000$ ticks/sec | All prices finite in realistic bands; execution in 456ms | **PASS** |
| **OU Drift Bounds** | 10,000 ticks with $\kappa = 0.08$ towards anchor | Price bounded within physical range $[0.8, 1.4]$ for FX | Stayed within $[0.8, 1.4]$ for EUR/USD and $[1500, 4500]$ for Gold | **PASS** |
| **2-Sigma Spread Shock** | 2,000 ticks under random walk | Spread expands by 1.4x when $\|Z\| > 2.0$, capped at $1.5\times$ maxSpread | Observed expansion events capped at $1.5\times$ maxSpread | **PASS** |
| **Micro-Lots** | 0.001 lot size on Forex, Gold, Crypto | Non-zero fill price, valid spread and slippage cost | Fill price correctly calculated, no division by zero | **PASS** |
| **Whale-Lots** | 5,000 lots on BTC/USDT and EUR/USD | Heavy slippage penalty, no negative or overflow fill price | BUY fills at ask + high slippage; SELL fills at bid - slippage $> 0$ | **PASS** |
| **Square-Root Scaling** | 50 vs 5,000 lots ($100\times$ size) | Slippage cost ratio $= \sqrt{100} = 10.0$ | Ratio measured at $10.0$ | **PASS** |
| **L2 Depth Ordering** | 8 levels of bids and asks for FX and Crypto | Bids monotonically decreasing; asks monotonically increasing | Monotonically sorted with positive spread | **PASS** |
| **Concurrent Listeners** | 1,000 simultaneous ticker subscriptions | All 1,000 dispatches executed; 0 dispatches after unsubscription | Exact count 1,000 $\to$ 1,000 after unsub; 0 memory leaks | **PASS** |
| **Feed Rapid Toggling** | 20 rapid start/stop cycles | `isFeedActive` accurately mirrors state, 0 orphaned timer handles | Clean start/stop without leakage | **PASS** |
| **Provisional EMA Decay** | 1,000 intra-bar fluctuations | Closed EMA baseline remains unchanged | Closed EMA strictly preserved at baseline value | **PASS** |
| **Formatter Edge Cases** | `NaN`, `Infinity`, `-Infinity`, sub-dollar amounts | No exceptions, graceful string fallbacks | Sanitized outputs (`0.00`, `0.0 pips`, `$0.00`) | **PASS** |

### Logic Chain
1. Observations confirm that all required APIs, interfaces, data structures, and algorithms are present and adhere strictly to `PROJECT.md § 1`.
2. Independent runs of `tsc -b`, `pnpm test`, `pnpm build`, and `pnpm lint` demonstrate zero compiler, runtime, or test errors.
3. Adversarial testing verifies mathematical robustness under extreme loads: high tick volume, extreme order sizes, stochastic volatility shocks, and memory unsubscription.
4. UI stability fixes (RAF batching, O(1) chart updates, limit price decoupling, 150ms orderbook throttle, position PnL synchronization) function cleanly in code inspection and end-to-end testing.
5. Therefore, Milestone 1 is functionally complete, robust, and ready for production approval.

---

## 4. Minor Observations & Recommendations (Non-Blocking)

- **Oxlint note on `set-state-in-effect` in `OrderEntryWidget.tsx`**: Line 58 calls `setLimitPrice` inside `useEffect` on symbol change. While this is intentional to sync default inputs when a user switches instruments, it produces a linter warning. Oxlint exits cleanly with 0 errors, but refactoring state initialization to key-based remounting (`key={symbol}`) could be considered in a future polish pass.
- **Decimal precision in `calculateExecutionFill` for Gold**: Line 261 uses `isCrypto ? 2 : symbol.includes('JPY') ? 3 : 5`. For Gold (`XAU/USD`), this produces 5 decimals on the internal fill price number, though trailing zeroes are automatically dropped and `formatPrice(fill, 'XAU/USD')` enforces 2 decimals on display. Using `getAssetConfig(symbol).digits` would be even more elegant.

---

## 5. Caveats

- Testing of live Binance WebSocket was performed under Node.js mock/simulation environment where WebSockets fall back gracefully to calibrated ECN simulation. Live network behavior depends on outbound WebSocket connectivity to Binance public endpoints.
- No other caveats.

---

## 6. Conclusion

Milestone 1 (Market Data Store, Feed Engine & Execution Fidelity) successfully meets and exceeds all requirements defined in `ORIGINAL_REQUEST.md (R1)` and `PROJECT.md (M1)`.

**Verdict**: **APPROVE**

---

## 7. Verification Method

To independently verify this verdict:

```bash
# 1. Typecheck
pnpm exec tsc -b

# 2. Complete Unit, Integration & Pairwise Test Suite (134 tests)
pnpm test

# 3. Adversarial Stress-Test Suite (28 tests)
pnpm test src/test/adversarial_challenger_m1.test.ts

# 4. Production Build
pnpm build

# 5. Linter Check
pnpm lint
```
