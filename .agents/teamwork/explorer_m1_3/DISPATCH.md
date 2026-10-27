# Task Assignment: Explorer 3 (Milestone 1 — Chart Performance & UI Jitter)

## Objective
Investigate and design the technical implementation plan for F04 (High-Performance Chart & UI Jitter Fix, OrderEntryWidget limit price fix).

## References & Inputs
- Authoritative User Request: `d:\VIBECODE\finora-trading-ai\.agents\teamwork\ORIGINAL_REQUEST.md` (MUST READ)
- Project Architecture & Interfaces: `d:\VIBECODE\finora-trading-ai\.agents\teamwork\PROJECT.md`
- Test Specification: `d:\VIBECODE\finora-trading-ai\.agents\teamwork\TEST_READY.md`
- Prior Survey Report: `d:\VIBECODE\finora-trading-ai\.agents\teamwork\survey_explorer_1\handoff.md`

## Specific Focus Areas
1. `src/components/TradingViewChart.tsx`:
   - Inspect lines 232–285 where `.setData()` is called on all 5 series on every single tick.
   - Design O(1) streaming updates using `series.update(candle)` for `candlestickSeries`, `areaSeries`, `volumeSeries`, and EMA series on new ticks.
   - Retain `.setData()` only for initial historical loads or timeframe/symbol changes.
2. `src/components/OrderEntryWidget.tsx`:
   - Fix critical UX bug: `currentPrice` in `useEffect` dependency array continuously overwrites the user's manual input in `limitPrice`.
   - Decouple manual input from streaming ticks. Only set default limit price on symbol switch or explicit user reset.
3. UI Throttling & Re-render optimization:
   - Check `requestAnimationFrame` batching or throttle buffering for tick updates.
   - Ensure `OrderBookWidget`, `PositionsTable`, and `AISwarmConsensusWidget` do not re-render erratically at 50 Hz.

## Deliverables
Write your structured findings to `d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m1_3\handoff.md`.
Report when finished via send_message.


## 2026-10-11T06:50:37Z
Sender: 7d65581a-bdfb-4e0c-ab66-0c65edc67db2
Message:
You are Explorer 3 for Milestone 1 (F04: High-Performance Chart & UI Jitter Fix, OrderEntryWidget limit price input fix).
Your working directory is: d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m1_3
Project root: d:\VIBECODE\finora-trading-ai

MANDATORY: Read d:\VIBECODE\finora-trading-ai\.agents\teamwork\ORIGINAL_REQUEST.md before starting.
Read your full dispatch instructions at:
d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m1_3\DISPATCH.md
Also review PROJECT.md and survey_explorer_1\handoff.md.

Investigate TradingViewChart.tsx setData vs update performance, OrderEntryWidget limit price overwrite bug, and rendering throttles.
Do NOT modify source code. Write your final report to:
d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m1_3\handoff.md
Once complete, send a message to orchestrator with your report location and summary.
