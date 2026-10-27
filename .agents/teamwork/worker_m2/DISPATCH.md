## 2026-10-11T04:14:08Z
You are the Implementation Worker for Milestone 2 (M2: Quant Math, Alpha Indicators & Backtest Engine).
Your working directory: d:\VIBECODE\finora-trading-ai\.agents\teamwork\worker_m2
Project root: d:\VIBECODE\finora-trading-ai

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

First, read:
1. d:\VIBECODE\finora-trading-ai\.agents\teamwork\ORIGINAL_REQUEST.md
2. d:\VIBECODE\finora-trading-ai\.agents\teamwork\PROJECT.md
3. d:\VIBECODE\finora-trading-ai\.agents\teamwork\TEST_READY.md
4. d:\VIBECODE\finora-trading-ai\.agents\teamwork\survey_explorer_2\handoff.md

Write Ownership:
You exclusively own:
- src/quant/metrics.ts (create)
- src/quant/indicators.ts (create)
- src/quant/backtestEngine.ts (create)
- src/types/trading.ts
- src/utils/formatters.ts
- src/components/QuantStudioView.tsx
- src/components/TradingJournalView.tsx
- tsconfig.app.json (if needed for build configuration)

Implementation Objectives:
1. Universal Financial Math Engine (`src/quant/metrics.ts`):
   - Implement `safeDivide(n, d, fallback)`
   - Implement `calculateSharpeRatio(returns, riskFreeRate, periodsPerYear)` (sample variance, 0 on std=0)
   - Implement `calculateSortinoRatio(returns, mar, periodsPerYear)` (downside semi-variance)
   - Implement `calculateCalmarRatio(annualizedReturnPct, maxDrawdownPct)` (CAGR / |MDD|)
   - Implement `calculateMaxDrawdown(equityCurve)` (peak-to-trough degradation)
   - Implement `calculateExpectancy(trades)` (both dollar $/trade and R-Multiple R/trade)
   - Implement `calculateRDistribution(trades)` (dynamic 7-bucket histogram and Fisher-Pearson skewness)
   - Implement `calculateWinRate(winCount, totalCount)` and `calculateProfitFactor(grossWin, grossLoss)` (capped at 99.99 on 0 loss)
   - Ensure 100% finite outputs: no NaN, Infinity, -Infinity under any input scenario (empty, single-trade, flat equity).
2. Point-in-Time Alpha Indicator Library (`src/quant/indicators.ts`):
   - Implement `calculateEMA(data, period)`
   - Implement `calculateSMA(data, period)`
   - Implement `calculateRSI(closes, period)` (Wilder's smoothed relative strength)
   - Implement `calculateMACD(closes, fast, slow, signal)`
   - Implement `calculateBollingerBands(closes, period, multiplier)`
   - Implement `calculateATR(candles, period)`
   - Implement `detectSMCZones(candles)` (Fair Value Gaps & Order Blocks without look-ahead bias)
3. Deterministic Bar-by-Bar Backtest Engine (`src/quant/backtestEngine.ts`):
   - Sequential candle loop with next-bar execution modeling, realistic slippage, spread, and fees.
   - Outputs complete BacktestResult conforming to `src/types/trading.ts`.
4. Update `src/types/trading.ts`:
   - Add `calmarRatio: number`, `expectancyR: number`, `tradesCount: number` to `BacktestResult`.
5. Update `src/utils/formatters.ts`:
   - Guard `formatCurrency`, `formatPercent`, `formatCompact` against NaN, Infinity, -Infinity.
6. Update `src/components/QuantStudioView.tsx`:
   - Replace synthetic 1.2s timeout random formulas with real execution via `runBacktest(...)`.
   - Display real computed Sharpe, Sortino, Calmar, and Max Drawdown.
   - Fix all SVG polyline calculations against `length - 1 === 0` and `max === min` (zero NaN/Infinity attributes).
7. Update `src/components/TradingJournalView.tsx`:
   - Calculate real Sharpe, Sortino, Max Drawdown, Total Expectancy ($), and Expectancy in R from entries.
   - Dynamically render the R-Distribution histogram and Skewness from `calculateRDistribution(...)`.
   - Fix SVG equity curve coordinate math to prevent `NaN` coordinates when trade entries count <= 1.
8. Verify Verification Criteria:
   - Run `pnpm test` (must pass 100% of the 88 test cases in src/test/).
   - Run `pnpm build` (`tsc -b && vite build`) (must exit with code 0).
9. Write a comprehensive handoff report to `d:\VIBECODE\finora-trading-ai\.agents\teamwork\worker_m2\handoff.md`.
10. Send a completion message back with results and verified test output.
