# Gate Status: Milestone 3 (Iteration 1)

| Agent | Role | Verdict | Source |
|---|---|:---:|---|
| worker_m3 | teamwork_preview_worker | DONE (210/210 tests pass, build exit 0) | worker_m3/handoff.md |
| reviewer_m3_1 | teamwork_preview_reviewer | REQUEST_CHANGES | reviewer_m3_1/handoff.md |
| reviewer_m3_2 | teamwork_preview_reviewer | APPROVE | reviewer_m3_2/handoff.md |
| challenger_m3_1 | teamwork_preview_challenger | REQUEST_CHANGES | challenger_m3_1/handoff.md |
| challenger_m3_2 | teamwork_preview_challenger | APPROVE | challenger_m3_2/handoff.md |
| auditor_m3 | teamwork_preview_auditor | CLEAN | auditor_m3/handoff.md |

Gate Result: **FAIL** (reviewer_m3_1 and challenger_m3_1 REQUEST_CHANGES)

### Defects Identified for Remediation (Iteration 2):
1. **USDT / USD Substring Collision in `isForex`**: In `src/engine/orderLifecycle.ts` (lines 182, 316), `symbol.includes('USD')` matches `BTC/USDT`, `ETH/USDT`, `SOL/USDT`, misclassifying them as Forex and applying a 100,000x multiplier. Solution: check `symbol.endsWith('/USD') || symbol.startsWith('USD/') || symbol.includes('EUR') || symbol.includes('GBP') || symbol.includes('JPY') || symbol.includes('XAU')`, and explicitly exclude `USDT`.
2. **Forex/Gold Notional & Margin Multipliers in `processOrderPipeline` & `evaluateOrderRisk`**: In `orderLifecycle.ts` and `riskEngine.ts`, `notional` and `marginRequired` for Forex must use `size * price * 100000` (or 100 for Gold) when `size` represents lots.
3. **Automated Exit Settlement in `src/App.tsx`**: In the tick exit handler, call `settlePositionExit(pos, exitCheck.exitPrice, exitCheck.exitReason)` to settle positions with accurate PnL rather than reading stale `pos.unrealizedPnl`.
4. **Trailing Distance Precision Truncation in `src/App.tsx`**: For Forex pairs, trailing distance must retain up to 5 decimal places (or pips) instead of truncating via `.toFixed(2)` to `0.00`.
5. **Circuit Breaker on Zero/Negative Equity**: In `checkCircuitBreaker` and `recalculateBalanceSheet`, if `equity <= 0`, trip circuit breaker unconditionally.
6. **Price History Buffer Updating in `botEngine.ts`**: Update the 100-bar rolling buffer for all symbols on every tick before the bot cooldown check so indicators remain continuous.
