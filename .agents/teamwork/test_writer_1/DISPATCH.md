## 2026-10-11T03:55:32Z

You are the E2E Test Suite Creator for the Finora Quant AI Trading Platform.
Your working directory: d:\VIBECODE\finora-trading-ai\.agents\teamwork\test_writer_1
Project root: d:\VIBECODE\finora-trading-ai

Read the following documents first:
1. d:\VIBECODE\finora-trading-ai\.agents\teamwork\ORIGINAL_REQUEST.md
2. d:\VIBECODE\finora-trading-ai\.agents\teamwork\PROJECT.md
3. d:\VIBECODE\finora-trading-ai\.agents\teamwork\TEST_INFRA.md

Your Responsibilities:
1. Setup testing infrastructure:
   - Check if vitest is installed. Install it via `pnpm add -D vitest` if missing.
   - Configure `vitest.config.ts` in project root with environment support and path aliases (`@/` -> `src/`).
   - Add `"test": "vitest run"` to `package.json` scripts.
2. Author comprehensive opaque-box test suites in `src/test/` derived from user requirements in ORIGINAL_REQUEST.md:
   - Tier 1: Feature Coverage (≥5 tests per feature area across Quant Math, Alpha Indicators, Backtest Engine, Market Data & Slippage, Order Lifecycle, Risk Circuit Breakers, Formatters, Error Boundaries).
   - Tier 2: Boundary & Corner Cases (empty data, single candle, zero trades, flat equity curve, max leverage, zero stop-loss distance, division by zero, NaN/Infinity guards, extreme price ticks).
   - Tier 3: Pairwise Combinations (Tick feed + Live Position PnL update, Order submission + Margin check + Slippage, Bot strategy signal + Daily Drawdown Circuit Breaker check, Backtest simulation + Commission deduction).
   - Tier 4: Real-World Scenarios (Gold news event high volatility spike, Crypto liquidation cascade triggering 4.5% Daily Drawdown Circuit Breaker, 100-bar multi-trade backtest execution).
3. Test files write ownership: You exclusively own `vitest.config.ts`, `package.json` test scripts, and all files under `src/test/`.
4. Run `pnpm test` to verify test harness execution.
5. Create `TEST_READY.md` at `d:\VIBECODE\finora-trading-ai\TEST_READY.md` and `d:\VIBECODE\finora-trading-ai\.agents\teamwork\TEST_READY.md` using the template from PROJECT.md.
6. Write your summary and results in `d:\VIBECODE\finora-trading-ai\.agents\teamwork\test_writer_1\handoff.md`.
7. Send a completion message back to the orchestrator.
