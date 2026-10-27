# Task Assignment: Explorer 2 (Milestone 1 — Spread, Slippage & Formatters)

## Objective
Investigate and design the technical implementation plan for F03 (Realistic Spread & Slippage Model) and F05 (High-Precision Currency & Pip Formatter).

## References & Inputs
- Authoritative User Request: `d:\VIBECODE\finora-trading-ai\.agents\teamwork\ORIGINAL_REQUEST.md` (MUST READ)
- Project Architecture & Interfaces: `d:\VIBECODE\finora-trading-ai\.agents\teamwork\PROJECT.md`
- Test Specification: `d:\VIBECODE\finora-trading-ai\.agents\teamwork\TEST_READY.md`
- Prior Survey Report: `d:\VIBECODE\finora-trading-ai\.agents\teamwork\survey_explorer_1\handoff.md`

## Specific Focus Areas
1. Institutional Spread & Slippage Model (F03):
   - Model raw interbank spreads: FX majors (0.2–0.4 pips), Gold XAU/USD (1.2–2.5 pips), BTC ($1.00–$3.00).
   - Implement square-root volume slippage: `Slippage = base_spread * (1 + kappa * sqrt(OrderSize / MarketDepth))`.
   - Execution fills: Market BUY fills at `Ask = Mid + (Spread / 2) + Slippage`; Market SELL fills at `Bid = Mid - (Spread / 2) - Slippage`.
   - Realistic starting unrealized PnL reflecting immediate spread + commission costs (no instant $0 PnL).
   - Order book L2 generator (`mockData.ts` / `GENERATE_ORDER_BOOK`): align spreads with asset metadata instead of 50-pip Gold or 4-pip EUR/USD.
   - SwapWidget: eliminate hardcoded ETH price, use live ticker prices and realistic AMM/slippage calculation.
2. High-Precision Currency & Pip Formatter (F05):
   - Inspect `src/utils/formatters.ts`.
   - Design `formatPrice(price: number, symbol: string)`: 5 decimals for EUR/USD, GBP/USD; 3 decimals for USD/JPY; 2 decimals for Metals/Crypto.
   - Do NOT prepend `$` to Forex exchange rates (`1.08452` not `$1.0845`).
   - Implement `formatPips(pips: number)` with fractional pipette precision.

## Deliverables
Write your structured findings to `d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m1_2\handoff.md`.
Report when finished via send_message.

## 2026-10-11T06:50:37Z
You are Explorer 2 for Milestone 1 (F03: Institutional Spread & Slippage Model, F05: High-Precision Currency & Pip Formatter).
Your working directory is: d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m1_2
Project root: d:\VIBECODE\finora-trading-ai

MANDATORY: Read d:\VIBECODE\finora-trading-ai\.agents\teamwork\ORIGINAL_REQUEST.md before starting.
Read your full dispatch instructions at:
d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m1_2\DISPATCH.md
Also review PROJECT.md and survey_explorer_1\handoff.md.

Investigate spread/slippage calculation, order execution pricing, order book L2 generation, SwapWidget calculations, and formatters.ts.
Do NOT modify source code. Write your final report to:
d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m1_2\handoff.md
Once complete, send a message to orchestrator with your report location and summary.
