## 2026-10-11T16:00:57Z
You are explorer_m3_3 (teamwork_preview_explorer).
Your working directory: d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m3_3
Project workspace root: d:\VIBECODE\finora-trading-ai

MANDATORY FIRST STEP:
Read the authoritative user request at:
d:\VIBECODE\finora-trading-ai\.agents\teamwork\ORIGINAL_REQUEST.md
Also read:
d:\VIBECODE\finora-trading-ai\.agents\teamwork\PROJECT.md
d:\VIBECODE\finora-trading-ai\.agents\teamwork\survey_explorer_3\handoff.md

Your Focus for Milestone 3 (R3): Feature F12 - Account Risk Engine & Circuit Breaker (`src/engine/riskEngine.ts`) AND Feature F13 - Dynamic Balance Sheet & Position Synchronization (`src/App.tsx`, `src/types/trading.ts`).
Inspect the codebase:
1. `src/types/trading.ts` (UserPortfolio, AccountBalanceSheet, RiskConfig).
2. `src/components/BotControlModal.tsx` and `src/components/QuantStudioView.tsx` (Circuit Breaker UI representation, currently hardcoded strings).
3. `src/App.tsx` (How positions state is maintained, how portfolio state is maintained, why positions never update on live ticks, why closing positions realizes stale mock PnL, margin balance locking).
4. `src/components/PortfolioView.tsx` and `src/components/Navbar.tsx` (How balance, equity, and margin are displayed).

Your Task:
Investigate and design:
1. `riskEngine.ts`:
   - Daily Max Drawdown Circuit Breaker: tracking `peakDailyEquity`, `dailyStartingEquity`, calculating current drawdown pct: `((peakDailyEquity - currentEquity) / peakDailyEquity) * 100`. If drawdown >= 4.5%, trip circuit breaker, lock new orders (both manual and bot), record trip timestamp and reason.
   - Max concurrent positions enforcement (e.g. max 5 positions).
   - Margin sufficiency verification (`requiredMargin <= freeMargin`).
   - Slippage protection check (`slippage <= maxTolerancePct`).
2. Dynamic Balance Sheet & Live Position Synchronization:
   - Full live synchronization: when market ticks arrive, update each open position's `currentPrice` / `markPrice`, calculate `unrealizedPnl` with currency conversion (e.g. JPY conversion from M1), calculate `unrealizedPnlPct`.
   - Derive portfolio `equity = totalBalance + sum(unrealizedPnl)`, `marginUsed = sum(position.margin)`, `freeMargin = equity - marginUsed`, `marginLevelPct = marginUsed > 0 ? (equity / marginUsed) * 100 : Infinity`.
   - Update `peakDailyEquity = Math.max(peakDailyEquity, equity)`.
   - On position close: add `realizedPnl` to `totalBalance` and `realizedProfit`, release `marginUsed`.

Document the exact design, formulas, integration points in `App.tsx`, and test specifications in:
`d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m3_3\handoff.md`.

RULES:
- Read-only exploration. DO NOT modify any source code files.
- Maintain `progress.md` in your working directory.
- Send a completion message via `send_message` to your parent once `handoff.md` is written.
