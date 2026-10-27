# Task Assignment: Explorer 1 (Milestone 1 — Market Store & Data Engine)

## Objective
Investigate and design the technical implementation plan for F01 (Centralized Market Data Store) and F02 (Calibrated Market Feed Engine).

## References & Inputs
- Authoritative User Request: `d:\VIBECODE\finora-trading-ai\.agents\teamwork\ORIGINAL_REQUEST.md` (MUST READ)
- Project Architecture & Interfaces: `d:\VIBECODE\finora-trading-ai\.agents\teamwork\PROJECT.md`
- Test Specification: `d:\VIBECODE\finora-trading-ai\.agents\teamwork\TEST_READY.md`
- Prior Survey Report: `d:\VIBECODE\finora-trading-ai\.agents\teamwork\survey_explorer_1\handoff.md`

## Specific Focus Areas
1. `src/stores/marketStore.ts`:
   - Design multi-asset ticker registry matching `MarketTicker` interface in `PROJECT.md § Interface Contracts`.
   - Store prices, bid, ask, spread, 24h stats, connection status for Forex (EUR/USD, GBP/USD, USD/JPY, XAU/USD) and Crypto (BTC/USDT, ETH/USDT, SOL/USDT).
   - Ensure store runs globally and is decoupled from page mount/unmount lifecycles.
2. `src/services/marketDataSimulator.ts` & `src/hooks/useLiveMarketFeed.ts`:
   - Eliminate the concurrent collision bug where fallback interval and Binance WebSocket mutate candles simultaneously.
   - Design calibrated ECN interbank simulator using Geometric Brownian Motion (GBM) for Forex/Gold with realistic drift, volatility, and session characteristics.
   - Clean candle boundary alignment (clean UTC timestamps).
   - Correct EMA calculation: compute on closed bars + transient preview, do not recursively degrade EMA per tick.

## Deliverables
Write your structured findings to `d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m1_1\handoff.md`.
Report when finished via send_message.


## 2026-10-11T06:50:37Z
[Message from 7d65581a-bdfb-4e0c-ab66-0c65edc67db2]
You are Explorer 1 for Milestone 1 (F01: Centralized Market Data Store, F02: Calibrated Market Feed Engine).
Your working directory is: d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m1_1
Project root: d:\VIBECODE\finora-trading-ai
