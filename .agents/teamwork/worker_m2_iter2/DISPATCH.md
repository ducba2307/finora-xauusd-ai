## 2026-10-11T04:40:27Z
You are the Implementation Worker for Milestone 2 Iteration 2 Remediation.
Your working directory: d:\VIBECODE\finora-trading-ai\.agents\teamwork\worker_m2_iter2
Project root: d:\VIBECODE\finora-trading-ai

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

First, read:
1. d:\VIBECODE\finora-trading-ai\.agents\teamwork\ORIGINAL_REQUEST.md (MANDATORY)
2. d:\VIBECODE\finora-trading-ai\.agents\teamwork\PROJECT.md
3. d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m2_iter2_3\handoff.md
4. Test file: src/test/tier5_adversarial/m2QuantStress.test.ts
5. Target files: src/quant/metrics.ts, src/quant/indicators.ts

Write Ownership:
You exclusively own:
- src/quant/metrics.ts
- src/quant/indicators.ts

Implementation Objectives:
1. Apply the mathematical hardening specifications documented in `explorer_m2_iter2_3\handoff.md`:
   - Fix Probe 1: Subnormal skewness underflow in `calculateRDistribution` (safe division by stdDev^3 with Number.isFinite guard).
   - Fix Probe 2: Non-finite PnL leakage in `calculateRDistribution` (filter and sanitize `pnl` in validTrades).
   - Fix Probe 3: Subnormal `riskUsd` (e.g. 1e-320) overflow in `calculateExpectancy` (use safeDivide on pnl / riskUsd with Number.isFinite validation).
   - Fix Probe 4: Double-precision PnL sum overflow (> 1.8e308) in `calculateExpectancy` (two-stage average recovery using scaled increments).
   - Harden all indicator period evaluations against NaN/negative values (`period <= 0 || !Number.isFinite(period)`).
2. Execute verification:
   - Run: `pnpm vitest run src/test/tier5_adversarial/m2QuantStress.test.ts` (all 29 tests must pass).
   - Run: `pnpm test` (all test files, 117/117 tests must pass).
   - Run: `pnpm build` (`tsc -b && vite build`) (must exit 0).
3. Write handoff report to `d:\VIBECODE\finora-trading-ai\.agents\teamwork\worker_m2_iter2\handoff.md`.
4. Send a completion message back with test outputs and findings.
