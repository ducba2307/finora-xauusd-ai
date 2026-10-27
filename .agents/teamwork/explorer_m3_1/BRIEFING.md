# BRIEFING — 2026-10-11T16:10:00Z

## Mission
Investigate and design an implementation-ready architectural blueprint for Feature F10: Autonomous AI Bot Execution Engine (src/engine/botEngine.ts).

## 🔒 My Identity
- Archetype: explorer (teamwork_preview_explorer)
- Roles: investigation, synthesis
- Working directory: d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m3_1
- Original parent: 24e52ee7-1f05-49b8-87e8-20aaeb1f2060
- Milestone: Milestone 3 (R3) - Feature F10 Autonomous AI Bot Execution Engine

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify project source code
- Write only to own working directory: d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m3_1
- Provide concrete TypeScript types, mathematical strategy logic for 4 bots, order pipeline integration, memory safety, and unit test specs in handoff.md
- Maintain progress.md heartbeat

## Current Parent
- Conversation ID: 24e52ee7-1f05-49b8-87e8-20aaeb1f2060
- Updated: 2026-10-11T16:10:00Z

## Investigation State
- **Explored paths**:
  - `ORIGINAL_REQUEST.md`, `PROJECT.md`, `survey_explorer_3/handoff.md`
  - `src/types/trading.ts` (AIBotStrategy, Position, TradeOrder, UserPortfolio)
  - `src/data/mockData.ts` (INITIAL_AI_BOTS, INITIAL_WHALE_ALERTS, INITIAL_ECONOMIC_EVENTS)
  - `src/quant/indicators.ts` (calculateEMA, calculateRSI, detectSMCZones, calculateATR)
  - `src/quant/metrics.ts` (safeDivide, calculateSharpeRatio, calculateMaxDrawdown)
  - `src/stores/marketStore.ts` (MarketDataStore pub/sub, calculateExecutionFill)
  - `src/hooks/useLiveMarketFeed.ts` (syncMarketStore, live price feed)
  - `src/components/BotControlModal.tsx`, `src/components/QuantStudioView.tsx`, `src/App.tsx`
  - `src/test/contracts/engine/` (`botEngine.ts`, `orderLifecycle.ts`, `riskEngine.ts`)
  - `src/test/tier1_features/orderLifecycle.test.ts`, `src/test/tier1_features/riskCircuitBreaker.test.ts`
  - `src/test/tier3_pairwise/botSignalCircuitBreaker.test.ts`, `src/test/tier4_realworld/cryptoCascadeCircuitTrip.test.ts`
- **Key findings**:
  - Existing bot definitions in `mockData.ts` and `App.tsx` are static; toggling only changes local string status without an execution loop.
  - Vitest test suite uses `contractFallbackPlugin` which maps `@/engine/*` to `src/test/contracts/engine/*`. All 191 existing tests pass.
  - Test suites require `BotType` union (`SCALPER`, `GOLD_HUNTER`, `MACRO_SENTINEL`, `WHALE_FLOW`), `BotInstance` interface, and pure function `evaluateBotStrategy(bot, marketInput)`.
  - Strategy mathematical conditions verified:
    - SCALPER: Long on `ema20 > ema50 && 55 < rsi < 75` on `BTC/USDT` (20x, 0.5% SL, 1.5% TP, 0.3% trailing).
    - GOLD_HUNTER: Long on `rsi < 30`, Short on `rsi > 70` on `XAU/USD` (30x, $12 SL, $25 TP, $8 trailing).
    - MACRO_SENTINEL: Short on `ema20 < ema50 && rsi < 45`, Long on `ema20 > ema50 && rsi > 55` on `EUR/USD` (50x, 30 pips SL, 75 pips TP).
    - WHALE_FLOW: Long on `whaleBias === 'ACCUMULATION'`, Short on `'DISTRIBUTION'` on `SOL/USDT` (10x, 4% SL, 10% TP).
  - Memory leak protection formulated: Bounded rolling history buffer (`MAX_BARS = 100`) via FIFO shifting, unsubscription handlers, and per-bot cooldown timers (15s - 60s).
- **Unexplored areas**: None for Feature F10; full architectural blueprint completed in `handoff.md`.

## Key Decisions Made
- Unified `AIBotStrategy` and `BotInstance` with dual ID resolution (`'bot-1'` / `'bot_scalper_btc'`) to maintain 100% backward compatibility with React UI and Vitest suites.
- Exported both functional point-in-time evaluator `evaluateBotStrategy` and stateful `BotExecutionEngine` class with `defaultBotEngine` singleton.
- Integrated circuit breaker locking (`LOCKED_BY_CIRCUIT_BREAKER`) directly into bot state and signal suppression.

## Artifact Index
- `DISPATCH.md` — Parent task instructions
- `BRIEFING.md` — Persistent context & memory
- `progress.md` — Activity log and heartbeat
- `handoff.md` — Final 5-component architectural handoff specification
