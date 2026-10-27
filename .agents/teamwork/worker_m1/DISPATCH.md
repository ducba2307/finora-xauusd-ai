# Task Assignment: Worker (Milestone 1 — Market Data Engine & Execution Fidelity)

## Objective
Implement all features for Milestone 1 (R1):
- F01: Centralized Market Data Store (`src/stores/marketStore.ts`)
- F02: Calibrated Market Feed Engine (`src/services/marketDataSimulator.ts`, `src/hooks/useLiveMarketFeed.ts`, `src/data/mockData.ts`)
- F03: Realistic Spread & Slippage Model (`src/components/OrderEntryWidget.tsx`, `src/components/OrderBookWidget.tsx`, `src/components/SwapWidget.tsx`)
- F04: High-Performance Chart & UI Jitter Fix (`src/components/TradingViewChart.tsx`, `src/components/TradingDashboard.tsx`, `src/components/OrderEntryWidget.tsx`)
- F05: High-Precision Currency & Pip Formatter (`src/utils/formatters.ts`)
- Dynamic Position Sync (`src/App.tsx`)

## Mandatory References (Read First!)
1. Authoritative User Request: `d:\VIBECODE\finora-trading-ai\.agents\teamwork\ORIGINAL_REQUEST.md`
2. Master Project Plan: `d:\VIBECODE\finora-trading-ai\.agents\teamwork\PROJECT.md`
3. Test Specification: `d:\VIBECODE\finora-trading-ai\.agents\teamwork\TEST_READY.md`
4. Explorer 1 Report (Store & Feed Engine): `d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m1_1\handoff.md`
5. Explorer 2 Report (Spread, Slippage & Formatters): `d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m1_2\handoff.md`
6. Explorer 3 Report (Chart Performance & UI Jitter): `d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m1_3\handoff.md`

## Files Owned Exclusively
- `src/stores/marketStore.ts`
- `src/services/marketDataSimulator.ts`
- `src/hooks/useLiveMarketFeed.ts`
- `src/data/mockData.ts`
- `src/utils/formatters.ts`
- `src/components/TradingViewChart.tsx`
- `src/components/OrderEntryWidget.tsx`
- `src/components/OrderBookWidget.tsx`
- `src/components/SwapWidget.tsx`
- `src/components/TradingDashboard.tsx`
- `src/App.tsx`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Detailed Implementation Tasks
1. `src/stores/marketStore.ts`:
   - Implement autonomous `startGlobalFeed()` and `stopGlobalFeed()` stepping all instruments (Forex via ECN GBM, Crypto fallback).
   - Add `useAllMarketTickers()` hook.
   - Guard against Node/Vitest environment so background timers don't interfere with test execution.
2. `src/services/marketDataSimulator.ts`:
   - Calibrate `simulateNextGBMTick` with Ornstein-Uhlenbeck drift, 2-sigma spread expansion, correct decimal digits.
   - Ensure `generateInstitutionalOrderBook` is robust and exported.
3. `src/hooks/useLiveMarketFeed.ts`:
   - Implement `connectionEpochRef` to eliminate concurrent WebSocket/interval collisions.
   - Implement `lastFinalizedBarTimeRef` to prevent double EMA decay on bar close.
   - Batch incoming tick updates with `requestAnimationFrame`.
4. `src/data/mockData.ts`:
   - Align historical candlestick starting timestamps to clean interval boundaries (`currentBarTime - (count - 1) * intervalSeconds`).
   - Forward `GENERATE_ORDER_BOOK(basePrice, symbol)` to `generateInstitutionalOrderBook(symbol, basePrice)`.
5. `src/components/TradingViewChart.tsx`:
   - Implement O(1) `series.update()` for streaming ticks (intra-bar and new bar arrivals).
   - Reserve `.setData()` strictly for initial mount, symbol change, or timeframe change.
   - Separate AI markers into dedicated `useEffect` to fix early-return lockout bug.
   - Wrap component with `React.memo`.
6. `src/components/OrderEntryWidget.tsx`:
   - Fix TS6133 by using `defaultMarketStore` and `getAssetConfig` in execution logic.
   - Decouple limit price, amount, and leverage from streaming ticks (`prevSymbolRef.current !== symbol`).
   - Wire `calculateExecutionFill` for market orders with realistic Ask/Bid entry and negative starting PnL.
7. `src/components/OrderBookWidget.tsx` & `src/components/SwapWidget.tsx`:
   - OrderBookWidget: dynamic headers, pip spread formatting for FX, `formatPrice`.
   - SwapWidget: live tickers from `defaultMarketStore`, square-root AMM slippage model.
8. `src/utils/formatters.ts`:
   - Standardize `formatPrice` (5 decimals for EUR/USD & GBP/USD, 3 for JPY, 2 for Metals/Crypto, no '$' prefix on FX).
   - Standardize `formatPips`.
9. `src/App.tsx`:
   - Subscribe to `defaultMarketStore.subscribeAll` to dynamically update open positions' `markPrice`, `unrealizedPnl`, and `unrealizedPnlPct` on live market ticks.

## Required Verification
Execute and verify:
1. `pnpm exec tsc -b` (must pass with exit code 0, 0 TS errors).
2. `pnpm test` (all 22 test files, 130 tests must PASS with exit code 0).
3. `pnpm build` (`tsc -b && vite build` must succeed).
4. `pnpm lint` (`oxlint` must pass with 0 errors).

Write full completion report to:
`d:\VIBECODE\finora-trading-ai\.agents\teamwork\worker_m1\handoff.md`
Send message to orchestrator when finished.


## 2026-10-11T06:59:45Z
[Message] timestamp=2026-10-11T06:59:45Z sender=7d65581a-bdfb-4e0c-ab66-0c65edc67db2 priority=MESSAGE_PRIORITY_HIGH content=You are the implementation Worker for Milestone 1 (Market Data Engine & Execution Fidelity).
Your working directory is: d:\VIBECODE\finora-trading-ai\.agents\teamwork\worker_m1
Project root: d:\VIBECODE\finora-trading-ai

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY: Read d:\VIBECODE\finora-trading-ai\.agents\teamwork\ORIGINAL_REQUEST.md before starting.
Read your full task assignment at:
d:\VIBECODE\finora-trading-ai\.agents\teamwork\worker_m1\DISPATCH.md

Also read the three Explorer handoffs:
- d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m1_1\handoff.md
- d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m1_2\handoff.md
- d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m1_3\handoff.md

Implement all Milestone 1 features (F01, F02, F03, F04, F05, and live position sync in App.tsx).
Run build, test, and lint commands. Ensure pnpm exec tsc -b, pnpm test, pnpm build, and pnpm lint all pass cleanly with exit code 0.
Write your complete handoff report to:
d:\VIBECODE\finora-trading-ai\.agents\teamwork\worker_m1\handoff.md
Send a message to orchestrator with your report location and build/test verification results when done.
