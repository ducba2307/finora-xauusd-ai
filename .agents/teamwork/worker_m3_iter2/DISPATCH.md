## 2026-10-11T17:17:46Z
You are worker_m3_iter2 (teamwork_preview_worker).
Your working directory: d:\VIBECODE\finora-trading-ai\.agents\teamwork\worker_m3_iter2
Project workspace root: d:\VIBECODE\finora-trading-ai

MANDATORY FIRST STEP:
Read the authoritative user request at:
d:\VIBECODE\finora-trading-ai\.agents\teamwork\ORIGINAL_REQUEST.md
Also read the detailed remediation blueprints from the 3 Explorers:
- d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m3_iter2_1\handoff.md
- d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m3_iter2_2\handoff.md
- d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m3_iter2_3\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Mission: Implement Milestone 3 Iteration 2 Remediation.

Exclusive File Ownership:
- `src/engine/orderLifecycle.ts`
- `src/engine/riskEngine.ts`
- `src/engine/botEngine.ts`
- `src/App.tsx`
- `src/test/tier5_adversarial/challenger_m3_stress.test.ts`
- `src/test/adversarial_challenger_m3.test.ts`

Tasks:
1. `src/engine/orderLifecycle.ts`:
   - Replace flawed `symbol.includes('USD')` with a clean `isForexSymbol(symbol)` helper that NEVER matches `USDT`, `BTC`, `ETH`, or `SOL`.
   - Incorporate contract multipliers (Forex: 100,000, Gold: 100, Crypto: 1) in `processOrderPipeline` so notional and marginRequired reflect institutional contract sizing.
2. `src/engine/riskEngine.ts`:
   - Incorporate contract multipliers in `evaluateOrderRisk` and `calculatePositionPnl`.
   - In `checkCircuitBreaker` and `recalculateBalanceSheet`, unconditionally trip the circuit breaker when `equity <= 0` with reason indicating equity depletion.
3. `src/App.tsx`:
   - In the `defaultMarketStore.subscribeAll` tick listener, when an automated exit trigger is detected by `checkPositionExitTriggers`, call `settlePositionExit(pos, exitCheck.exitPrice, exitCheck.exitReason)`.
   - Credit `settlement.realizedPnl` to `portfolio.totalBalance` and `realizedProfit`, release `settlement.releasedMargin`, and append `settlement.closedTrade` to trades.
   - Calculate high-precision trailing distances (5 decimals for Forex, 2 for Crypto, $8.00 for Gold).
4. `src/engine/botEngine.ts`:
   - In `BotExecutionEngine.handleMarketTick`, update the 100-bar rolling buffer for all symbols on every tick *before* evaluating bot cooldown, status, or open position counts. Validate ticks with `Number.isFinite(ticker.midPrice) && ticker.midPrice > 0`.
5. Test Suites:
   - Update assertions in `src/test/tier5_adversarial/challenger_m3_stress.test.ts` and `src/test/adversarial_challenger_m3.test.ts` so they assert the corrected behavior (USDT is NOT forex, depleted equity trips circuit breaker, 100-bar buffer updates correctly).
6. Verification:
   - Run `pnpm test -- --run` — MUST pass 100% of all tests across all test suites (0 failures).
   - Run `pnpm build` (`tsc -b && vite build`) — MUST succeed with exit code 0.
   - Run `pnpm lint` — MUST report 0 errors.

Deliverable:
Write a comprehensive handoff report in `d:\VIBECODE\finora-trading-ai\.agents\teamwork\worker_m3_iter2\handoff.md`.
Send completion message via send_message.
