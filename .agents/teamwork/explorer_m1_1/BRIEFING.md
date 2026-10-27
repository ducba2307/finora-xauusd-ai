# BRIEFING — 2026-10-11T06:57:00Z

## Mission
Investigate and design technical implementation plan for F01 (Centralized Market Data Store) and F02 (Calibrated Market Feed Engine).

## 🔒 My Identity
- Archetype: explorer
- Roles: investigator, synthesizer
- Working directory: d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m1_1
- Original parent: 7d65581a-bdfb-4e0c-ab66-0c65edc67db2
- Milestone: Milestone 1 (F01 & F02)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Multi-asset ticker registry matching MarketTicker interface in PROJECT.md
- Store prices, bid, ask, spread, 24h stats, connection status for Forex & Crypto
- Decoupled from page mount/unmount lifecycles
- Eliminate concurrent collision bug (fallback interval vs WebSocket)
- Calibrated ECN interbank simulator using GBM for Forex/Gold
- Clean candle boundary alignment (clean UTC timestamps)
- Correct EMA calculation (on closed bars + transient preview)
- Write final report to d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m1_1\handoff.md

## Current Parent
- Conversation ID: 7d65581a-bdfb-4e0c-ab66-0c65edc67db2
- Updated: 2026-10-11T06:57:00Z

## Investigation State
- **Explored paths**:
  - `src/stores/marketStore.ts`
  - `src/services/marketDataSimulator.ts`
  - `src/hooks/useLiveMarketFeed.ts`
  - `src/hooks/useBinanceTicker.ts`
  - `src/data/mockData.ts` (GENERATE_CANDLESTICK_SERIES & GENERATE_ORDER_BOOK)
  - `src/components/TradingDashboard.tsx`, `TradingViewChart.tsx`, `PositionsTable.tsx`, `OrderEntryWidget.tsx`, `OrderBookWidget.tsx`
  - `src/test/tier1_features/marketDataSlippage.test.ts`
  - `src/test/tier3_pairwise/tickFeedPositionSync.test.ts`
  - `src/test/tier4_realworld/goldNewsVolatilitySpike.test.ts`
- **Key findings**:
  1. `marketStore.ts`: Has registry with 7 assets, but lacks active global background ticker feeder. Completely dependent on `useLiveMarketFeed` in `TradingDashboard`, meaning store halts when user navigates away or views other assets.
  2. `useLiveMarketFeed.ts`: Concurrent collision risk from ghost reconnect timers / unmounted event callbacks. WebSocket and fallback interval must be governed by an explicit state machine with generation/epoch tokens.
  3. EMA double-update flaw in WS kline handler: closes bar on `isBarClosed` and then recalculates closed EMA again when the next bar timestamp arrives.
  4. Timestamp alignment gap: `GENERATE_CANDLESTICK_SERIES` generates candles from unaligned `nowSec - count * intervalSeconds`, creating timestamp drift relative to clean UTC `:00` intervals.
  5. Static position desynchronization: `App.tsx` never subscribes to `marketStore`, so open positions never update mark price or unrealized PnL in real time.
- **Unexplored areas**: None for M1 scope; full architectural investigation complete.

## Key Decisions Made
- Formulated decoupled background market feed architecture for `MarketDataStore`.
- Designed mutual-exclusion state machine with epoch token for `useLiveMarketFeed.ts`.
- Designed clean UTC boundary alignment for synthetic and live candles.
- Designed single-finalization EMA computation lifecycle.
- Designed global subscription hook for dynamic position PnL synchronization.

## Artifact Index
- DISPATCH.md — Task assignment and incoming messages
- BRIEFING.md — Persistent working memory
- progress.md — Heartbeat and status log
- handoff.md — Final investigation report
