# Dispatch: Explorer M3-2

Target: F11 6-Stage Order Lifecycle Pipeline (`src/engine/orderLifecycle.ts`)
Role: teamwork_preview_explorer
Workspace: d:\VIBECODE\finora-trading-ai
Working directory: d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m3_2
## 2026-10-11T16:00:57Z
Sender: 24e52ee7-1f05-49b8-87e8-20aaeb1f2060
Priority: MESSAGE_PRIORITY_HIGH
Content:
You are explorer_m3_2 (teamwork_preview_explorer).
Your working directory: d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m3_2
Project workspace root: d:\VIBECODE\finora-trading-ai

MANDATORY FIRST STEP:
Read the authoritative user request at:
d:\VIBECODE\finora-trading-ai\.agents\teamwork\ORIGINAL_REQUEST.md
Also read:
d:\VIBECODE\finora-trading-ai\.agents\teamwork\PROJECT.md
d:\VIBECODE\finora-trading-ai\.agents\teamwork\survey_explorer_3\handoff.md

Your Focus for Milestone 3 (R3): Feature F11 - 6-Stage Order Lifecycle Pipeline (`src/engine/orderLifecycle.ts`).
Inspect the codebase:
1. `src/types/trading.ts` (Position, TradeOrder, OrderRequest, order status states).
2. `src/components/OrderEntryWidget.tsx` (Manual order placement logic, validation gaps, AI_TRAILING button).
3. `src/components/PositionsTable.tsx` (Position actions, market close, PnL display).
4. `src/components/TradingViewChart.tsx` (SL/TP price line rendering).
5. `src/hooks/useLiveMarketFeed.ts` and `src/stores/marketStore.ts` (How tick events flow, slippage calculation via calculateExecutionFill).

Your Task:
Investigate and design the exact 6-Stage Order Lifecycle Pipeline:
Stage 1: Signal (manual or AI bot signal input)
Stage 2: Validation (price sanity > 0, valid lot size, valid SL/TP geometry: SL < Entry < TP for BUY, SL > Entry > TP for SELL)
Stage 3: Risk Check (integration with RiskEngine: circuit breaker check, max positions check, margin check, slippage tolerance)
Stage 4: Execution (fill price calculation with slippage & spread via marketStore/simulator, position creation, margin reservation, trade history logging, sound effect trigger)
Stage 5: Trailing Stop Manager (high-water mark peak tracking, ratcheting stop loss strictly in profitable direction, never regressing)
Stage 6: Exit Monitor (tick-by-tick automated check against TP, SL, trailing SL, and liquidation price; automated position closing, PnL realization, margin release, trade journal update, notification sound trigger)

Document the exact state machine, data structures, edge cases, and test specifications in:
`d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m3_2\handoff.md`.

RULES:
- Read-only exploration. DO NOT modify any source code files.
- Maintain `progress.md` in your working directory.
- Send a completion message via `send_message` to your parent once `handoff.md` is written.
