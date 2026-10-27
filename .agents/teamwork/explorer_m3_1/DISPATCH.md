## 2026-10-11T16:00:57Z
[Message] timestamp=2026-10-11T16:00:57Z sender=24e52ee7-1f05-49b8-87e8-20aaeb1f2060 priority=MESSAGE_PRIORITY_HIGH content=You are explorer_m3_1 (teamwork_preview_explorer).
Your working directory: d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m3_1
Project workspace root: d:\VIBECODE\finora-trading-ai

MANDATORY FIRST STEP:
Read the authoritative user request at:
d:\VIBECODE\finora-trading-ai\.agents\teamwork\ORIGINAL_REQUEST.md
Also read:
d:\VIBECODE\finora-trading-ai\.agents\teamwork\PROJECT.md
d:\VIBECODE\finora-trading-ai\.agents\teamwork\survey_explorer_3\handoff.md

Your Focus for Milestone 3 (R3): Feature F10 - Autonomous AI Bot Execution Engine (`src/engine/botEngine.ts`).
Inspect the codebase:
1. `src/types/trading.ts` (AIBotStrategy interface and needed operational extensions: maxDrawdownPct, stopLossPct, takeProfitPct, trailingDistancePct, cooldownSec, execution metrics).
2. `src/data/mockData.ts` (The 4 bots: Neural Alpha Scalper v4, XAUUSD Gold ICT Hunter, Macro Sentinel News Bot, Whale Flow Accumulator).
3. `src/quant/indicators.ts` and `src/quant/metrics.ts` (Existing indicators like EMA, RSI, SMC Fair Value Gaps, MACD, ATR to use for bot alpha signals).
4. `src/stores/marketStore.ts` and `src/hooks/useLiveMarketFeed.ts` (How market data ticks are fed and how botEngine can subscribe or be triggered by incoming market data).
5. Existing UI controls: `src/components/BotControlModal.tsx`, `src/components/QuantStudioView.tsx`, and `src/App.tsx` (how bots are toggled and rendered).

Your Task:
Investigate and produce a detailed, implementation-ready architectural blueprint in `d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m3_1\handoff.md`.
Include:
- Exact TypeScript types, function signatures, strategy logic for each of the 4 bots (with mathematical conditions based on price/indicators/orderbook/sentiment), cooldown timers, signal generation output structure.
- How the bot engine runs safely without memory leaks, how it interacts with the order lifecycle pipeline and market feed.
- Comprehensive test scenarios for botEngine unit tests.

RULES:
- Read-only exploration. DO NOT modify any source code files.
- Maintain `progress.md` in your working directory.
- Send a completion message via `send_message` to your parent once `handoff.md` is written.
