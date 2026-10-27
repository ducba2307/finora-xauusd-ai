## 2026-10-11T06:47:28Z
You are the Replacement Implementation Worker for Milestone 1 (M1: Market Data Engine & Execution Fidelity R1).
Your predecessor (worker_m1) was interrupted by a platform rate limit.
Your working directory: d:\VIBECODE\finora-trading-ai\.agents\teamwork\worker_m1_replacement
Project root: d:\VIBECODE\finora-trading-ai

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

First, read:
1. d:\VIBECODE\finora-trading-ai\.agents\teamwork\ORIGINAL_REQUEST.md (MANDATORY)
2. d:\VIBECODE\finora-trading-ai\.agents\teamwork\PROJECT.md
3. d:\VIBECODE\finora-trading-ai\.agents\teamwork\TEST_READY.md
4. d:\VIBECODE\finora-trading-ai\.agents\teamwork\survey_explorer_1\handoff.md
5. d:\VIBECODE\finora-trading-ai\.agents\teamwork\worker_m1\progress.md

Current state in workspace:
- `src/stores/marketStore.ts` was already created by worker_m1.
- `src/services/marketDataSimulator.ts` was already created by worker_m1.
- `src/hooks/useLiveMarketFeed.ts` was updated by worker_m1.
- `src/components/TradingViewChart.tsx` was updated with `series.update()` by worker_m1.

Your Tasks to Complete Milestone 1:
1. `src/components/OrderEntryWidget.tsx`:
   - Fix critical limit price UX bug: In the useEffect initializing limitPrice, remove `currentPrice` from the dependency array `[symbol, isForex]` so user manual limit price typing is NOT overwritten on every live tick. Add a small "Use Market" button if desired.
   - Wire realistic execution fills: In `handleSubmitOrder`, compute fill price and costs via `defaultMarketStore.calculateExecutionFill(finalSymbol, side === 'LONG' ? 'BUY' : 'SELL', parsedAmount)`.
   - Set `entryPrice: fillPrice`, `markPrice: currentPrice`, and initial `unrealizedPnl: -(spreadCost + slippageCost + commission)` so market fills realistically start at negative spread/commission.
2. `src/components/OrderBookWidget.tsx`:
   - Replace hardcoded `Price (USDT)` and `Size (BTC)` table headers with dynamic Base / Quote assets based on the selected symbol (e.g. `Price (USD)` and `Size (XAU)` for Gold, `Price (USD)` and `Size (EUR)` for EUR/USD).
   - Display spread using `formatPips(orderBook.spread)` or asset-specific precision rather than `.toFixed(2)` which truncated EUR/USD spread to `$0.00`.
3. `src/components/SwapWidget.tsx`:
   - Replace hardcoded `const ethPrice = 3248.30` with live prices queried from `defaultMarketStore.getTicker(...)`. Support SOL/USDT, BTC/USDT, ETH/USDT live rates.
4. `src/components/TradingDashboard.tsx` & `src/App.tsx`:
   - Ensure open `positions` in `App.tsx` dynamically update their `markPrice` and `unrealizedPnl` as live market ticks arrive from `defaultMarketStore` or `useLiveMarketFeed`.
   - Calculate live floating PnL and total equity dynamically so the Positions Table and Portfolio reflect real-time market movements.
5. Verification:
   - Run `pnpm test` (all 130 tests must pass).
   - Run `pnpm build` (`tsc -b && vite build`) (must exit 0).
   - Run `pnpm lint` (must exit 0).
6. Write a comprehensive handoff report to `d:\VIBECODE\finora-trading-ai\.agents\teamwork\worker_m1_replacement\handoff.md`.
7. Send a completion message back with verification command outputs.
