# Task Assignment: Reviewer 2 (Milestone 1 — Chart, UI Jitter, Formatters & Sync)

## Objective
Review Milestone 1 changes with primary focus on F04 (Chart O(1) Updates & Input Decoupling), F05 (Precision Formatters), and Position Synchronization.

## References
- Authoritative User Request: `d:\VIBECODE\finora-trading-ai\.agents\teamwork\ORIGINAL_REQUEST.md` (MUST READ)
- Project Architecture & Interfaces: `d:\VIBECODE\finora-trading-ai\.agents\teamwork\PROJECT.md`
- Test Specification: `d:\VIBECODE\finora-trading-ai\.agents\teamwork\TEST_READY.md`
- Worker Handoff: `d:\VIBECODE\finora-trading-ai\.agents\teamwork\worker_m1\handoff.md`

## Review Scope & Instructions
1. Inspect `src/components/TradingViewChart.tsx`, `src/components/OrderEntryWidget.tsx`, `src/components/OrderBookWidget.tsx`, `src/components/SwapWidget.tsx`, `src/components/TradingDashboard.tsx`, `src/components/PositionsTable.tsx`, and `src/App.tsx`.
2. Verify that lightweight-charts uses `series.update()` for streaming updates and reserves `.setData()` for resets.
3. Verify that `limitPrice`, `amountStr`, and `leverage` in `OrderEntryWidget.tsx` are completely decoupled from price ticks.
4. Verify `formatPrice` and `formatPips` in `src/utils/formatters.ts` and their usage across components.
5. Verify live position PnL synchronization in `src/App.tsx`.
6. Run build and test verification: `pnpm exec tsc -b`, `pnpm test`, `pnpm build`, `pnpm lint`.
7. State your verdict clearly as **APPROVE** or **REQUEST_CHANGES** in your report.

Write your report to `d:\VIBECODE\finora-trading-ai\.agents\teamwork\reviewer_m1_2\handoff.md`.
Notify orchestrator when done via send_message.


## 2026-10-11T07:23:12Z
From: 7d65581a-bdfb-4e0c-ab66-0c65edc67db2
Content: You are Reviewer 2 for Milestone 1 (Chart Updates, UI Jitter, Formatters & Position Sync).
Your working directory is: d:\VIBECODE\finora-trading-ai\.agents\teamwork\reviewer_m1_2
Project root: d:\VIBECODE\finora-trading-ai

MANDATORY: Read d:\VIBECODE\finora-trading-ai\.agents\teamwork\ORIGINAL_REQUEST.md before starting.
Read your full dispatch instructions at:
d:\VIBECODE\finora-trading-ai\.agents\teamwork\reviewer_m1_2\DISPATCH.md
Also inspect worker_m1\handoff.md.

Review the implementation, run builds/tests (pnpm exec tsc -b, pnpm test, pnpm build, pnpm lint), evaluate correctness, UI performance, input persistence, and formatters.
Write your report and clear verdict (APPROVE or REQUEST_CHANGES) to:
d:\VIBECODE\finora-trading-ai\.agents\teamwork\reviewer_m1_2\handoff.md
Send message to orchestrator when complete.
