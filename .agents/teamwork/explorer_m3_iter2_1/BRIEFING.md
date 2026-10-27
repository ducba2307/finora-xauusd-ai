# BRIEFING — 2026-10-11T17:16:00Z

## Mission
Investigate and design exact drop-in replacements for isForex classification and contract multiplier handling in orderLifecycle.ts and riskEngine.ts.

## 🔒 My Identity
- Archetype: explorer
- Roles: explorer
- Working directory: d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m3_iter2_1
- Original parent: 24e52ee7-1f05-49b8-87e8-20aaeb1f2060
- Milestone: milestone_3_iter2

## 🔒 Key Constraints
- Read-only investigation — do NOT implement directly in source files
- Produce exact, drop-in replacement code in handoff.md
- Send completion message via send_message to 24e52ee7-1f05-49b8-87e8-20aaeb1f2060
- Do NOT modify source code files directly

## Current Parent
- Conversation ID: 24e52ee7-1f05-49b8-87e8-20aaeb1f2060
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `src/engine/orderLifecycle.ts` (lines 124-227, 310-354)
  - `src/engine/riskEngine.ts` (lines 70-104, 157-219)
  - `src/engine/botEngine.ts` (alpha bots and trade sizes)
  - `src/components/OrderEntryWidget.tsx` (contract notional formula)
  - `src/test/tier1_features/orderLifecycle.test.ts`
  - `src/test/tier3_pairwise/botSignalCircuitBreaker.test.ts`
  - `src/test/tier4_realworld/goldNewsVolatilitySpike.test.ts`
  - `src/test/tier5_adversarial/challenger_m3_stress.test.ts`
  - `src/test/adversarial_challenger_m3.test.ts`
  - `src/test/contracts/engine/riskEngine.ts` & `orderLifecycle.ts`
- **Key findings**:
  1. `isForex` substring collision: `symbol.includes('USD')` matches `USDT`, erroneously tagging `BTC/USDT`, `ETH/USDT`, `SOL/USDT` as `market: 'FOREX'`, setting `lots: signal.size`, and inflating PnL by 100,000x in `settlePositionExit` and `calculatePositionPnl`.
  2. Fix for `isForex`: explicitly test `isCrypto` first (`includes('USDT') || includes('BTC') || includes('ETH') || includes('SOL')`), and define `isForex` as `!isCrypto && (symbol.includes('EUR') || symbol.includes('GBP') || symbol.includes('JPY') || symbol.includes('XAU') || symbol.endsWith('/USD') || symbol.startsWith('USD/'))`.
  3. Notional & Margin calculation in `processOrderPipeline`: compute `notional = signal.size * signal.price * notionalMultiplier` where `notionalMultiplier` is 100 for Gold, 100,000 for Forex, and 1 for Crypto. Derive `marginRequired = notional / signal.leverage`.
  4. Pre-trade size guard in `evaluateOrderRisk`: compute `notionalValue = order.size * order.price * notionalMultiplier`. Support institutional Forex/Gold lot sizes with calibrated ceiling (`maxLimit = riskConfig.maxPositionSizeUsd ?? (isForex ? 1000000 : config.maxPositionSizeUsd)`).
  5. Test impacts: `challenger_m3_stress.test.ts` contains bug reproduction tests expecting `'FOREX'` and `1000000` on `BTC/USDT` that must be updated to expect `'CRYPTO'` and `10.00`.
- **Unexplored areas**: None. All relevant code paths analyzed.

## Key Decisions Made
- Confirmed exact drop-in replacements for `orderLifecycle.ts` and `riskEngine.ts`.
- Documented downstream test impacts and verification commands.

## Artifact Index
- DISPATCH.md — Task assignment details
- BRIEFING.md — Persistent context & state
- progress.md — Liveness heartbeat
- handoff.md — Final 5-component analysis & proposed drop-in replacements
