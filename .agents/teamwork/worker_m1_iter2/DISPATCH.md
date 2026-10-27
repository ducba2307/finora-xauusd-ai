# Task Assignment: Worker (Milestone 1, Iteration 2 — Remediation Execution)

## Objective
Implement all remediations for Milestone 1 Iteration 2 based on Challenger 2 findings and the 3 Explorer handoffs:
1. Fix USD/JPY PnL currency conversion distortion in `src/App.tsx` and `src/components/OrderEntryWidget.tsx` (divide raw JPY profit by JPY exchange rate).
2. Add balance guard in `src/components/SwapWidget.tsx` and sanitize portfolio accounting in `src/App.tsx:124-160` (prevent unbacked token minting; preserve tradeCapital invariance).
3. Fix TP/SL input clearing trap in `src/components/OrderEntryWidget.tsx` (use `value={customTp}` with `placeholder={defaultTpPrice.toFixed(digits)}`).
4. Add 50% slippage cap and positive price floor in `src/stores/marketStore.ts` (`Math.min(0.50, slippagePct)` and `Math.max(0.01, fillPrice)`).
5. Loop through all intermediate candles in `src/components/TradingViewChart.tsx` when multi-bar batches arrive.
6. Update `src/test/tier5_adversarial/challenger2_stress.test.ts` to assert the remediated invariants (`fillPrice > 0`, realistic USD/JPY PnL, swap balance rejection).

## Mandatory References
- `d:\VIBECODE\finora-trading-ai\.agents\teamwork\ORIGINAL_REQUEST.md` (MUST READ)
- `d:\VIBECODE\finora-trading-ai\.agents\teamwork\PROJECT.md`
- `d:\VIBECODE\finora-trading-ai\.agents\teamwork\challenger_m1_2\handoff.md`
- `d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m1_iter2_1\handoff.md`
- `d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m1_iter2_2\handoff.md`
- `d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m1_iter2_3\handoff.md`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Verification Requirements
Execute and verify:
1. `pnpm exec tsc -b` (exit code 0).
2. `pnpm test` (all test files, 100% pass).
3. `pnpm build` (exit code 0).
4. `pnpm lint` (exit code 0).

Write your report to `d:\VIBECODE\finora-trading-ai\.agents\teamwork\worker_m1_iter2\handoff.md`.
Notify orchestrator when done via send_message.

## 2026-10-11T07:39:45Z
Sender: 7d65581a-bdfb-4e0c-ab66-0c65edc67db2
Priority: MESSAGE_PRIORITY_HIGH
Content:
You are the Remediation Worker for Milestone 1 Iteration 2.
Your working directory is: d:\VIBECODE\finora-trading-ai\.agents\teamwork\worker_m1_iter2
Project root: d:\VIBECODE\finora-trading-ai

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY: Read d:\VIBECODE\finora-trading-ai\.agents\teamwork\ORIGINAL_REQUEST.md before starting.
Read your full dispatch instructions at:
d:\VIBECODE\finora-trading-ai\.agents\teamwork\worker_m1_iter2\DISPATCH.md

Also read the 3 Explorer handoff reports:
- d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m1_iter2_1\handoff.md
- d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m1_iter2_2\handoff.md
- d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m1_iter2_3\handoff.md

Apply all remediations across App.tsx, SwapWidget.tsx, OrderEntryWidget.tsx, marketStore.ts, TradingViewChart.tsx, and the test assertions.
Run build, test, and lint commands (tsc -b, pnpm test, pnpm build, pnpm lint).
Write your complete handoff report to:
d:\VIBECODE\finora-trading-ai\.agents\teamwork\worker_m1_iter2\handoff.md
Send message to orchestrator when complete.

