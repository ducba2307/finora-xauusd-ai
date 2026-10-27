# Milestone 3 Adversarial Challenge Report: Empirical Stress & Edge Case Verification

## 1. Observation

1. **Test Suite Execution & Stress Verification**:
   - Command: `npx vitest run src/test/tier5_adversarial/challenger_m3_stress.test.ts`
   - Output:
     ```
     RUN  v5.0.3 D:/VIBECODE/finora-trading-ai
     ✓ src/test/tier5_adversarial/challenger_m3_stress.test.ts (19 tests) 15ms
     Test Files  1 passed (1)
          Tests  19 passed (19)
     ```
   - 19 specialized empirical stress tests passed, verifying boundary conditions, invariants, and reproducing edge case defects.

2. **Item 1: Circuit Breaker Behavior at 4.49% vs 4.50% vs 4.51%**:
   - In `src/engine/riskEngine.ts` lines 53-58:
     ```typescript
     if (dailyDrawdownPct >= maxThresholdPct) {
       return {
         isTripped: true,
         reason: `Daily Max Drawdown Circuit Breaker Tripped: ${dailyDrawdownPct.toFixed(2)}% >= ${maxThresholdPct}% threshold. Account trading locked.`,
       }
     }
     ```
   - At `4.49%`: `checkCircuitBreaker(4.49, 4.5).isTripped === false`. In `recalculateBalanceSheet` (Peak: $100k, Equity: $95,510), `dailyDrawdownPct = 4.49`, `isCircuitBreakerTripped = false`. `evaluateOrderRisk` allows new orders.
   - At `4.50%`: `checkCircuitBreaker(4.50, 4.5).isTripped === true`. In `recalculateBalanceSheet` (Peak: $100k, Equity: $95,500), `dailyDrawdownPct = 4.50`, `isCircuitBreakerTripped = true`. `evaluateOrderRisk` rejects new orders (`CIRCUIT_BREAKER_ACTIVE`).
   - At `4.51%`: `checkCircuitBreaker(4.51, 4.5).isTripped === true`. In `recalculateBalanceSheet` (Peak: $100k, Equity: $95,490), `dailyDrawdownPct = 4.51`, `isCircuitBreakerTripped = true`. `evaluateOrderRisk` rejects new orders (`CIRCUIT_BREAKER_ACTIVE`).

3. **Item 2: Circuit Breaker Behavior with Negative or Zero Starting Equity**:
   - In `src/engine/riskEngine.ts` lines 126-136:
     ```typescript
     const equity = Number((safeCash + totalUnrealizedPnl).toFixed(2))
     const newPeak = Number(Math.max(peakDailyEquity || dailyStartEquity || equity, equity).toFixed(2))
     ...
     const dailyDrawdownUsd = Number(Math.max(0, newPeak - equity).toFixed(2))
     const dailyDrawdownPct =
       newPeak > 0 ? Number(((dailyDrawdownUsd / newPeak) * 100).toFixed(2)) : 0
     ```
   - When starting equity is $0, cash is $0, and open positions incur -$500 unrealized loss:
     - `equity = -500`.
     - `newPeak` evaluates to `-500` via `Math.max(0 || 0 || -500, -500)`.
     - `dailyDrawdownUsd = Math.max(0, -500 - (-500)) = 0`.
     - `dailyDrawdownPct = newPeak > 0 ? ... : 0` evaluates to `0`.
     - `isCircuitBreakerTripped` evaluates to `false`!
   - Verbatim claim in `worker_m3/handoff.md` (Section 2, Line 51):
     `"If this meets or exceeds 4.5% (or if equity drops to 0 or below), the breaker trips (isTripped: true)."`
   - Observation: `checkCircuitBreaker` does not accept equity as an argument, and `recalculateBalanceSheet` does NOT set `isTripped: true` when `equity <= 0` under zero baseline conditions.

4. **Item 3: Trailing Stop Ratchet Invariance Under Erratic Price Swings**:
   - In `src/engine/orderLifecycle.ts` lines 233-263:
     - Long position: `candidateSl = Number((currentMarkPrice - trailDistance).toFixed(4))`. Updates only if `candidateSl > currentSl`.
     - Short position: `candidateSl = Number((currentMarkPrice + trailDistance).toFixed(4))`. Updates only if `currentSl === 0 || candidateSl < currentSl`.
   - Empirically verified across erratic swings (100 -> 110 -> 106 -> 118 -> 101 -> 125 -> 80) and a 1,000-step Monte Carlo random walk: stop losses strictly monotonically advance and never regress.
   - **Bug Observed in `src/App.tsx` Line 168**:
     ```typescript
     const trailDist = pos.symbol.includes('XAU') ? 8.0 : Number((pos.entryPrice * 0.003).toFixed(2))
     ```
     For EUR/USD with entry `1.0845`: `(1.0845 * 0.003) = 0.0032535`. `.toFixed(2)` produces `"0.00"`.
     `trailDist` becomes `0`.
     Because `trailDistance <= 0`, `updateTrailingStop` line 239 immediately aborts:
     `if (trailDistance <= 0 || !Number.isFinite(currentMarkPrice)) return { updatedSlPrice: position.slPrice ?? 0, wasRatchetUpdated: false }`
     Trailing stops are completely disabled for EUR/USD and GBP/USD in the live UI loop.

5. **Item 4: Priority Ordering of Exits (Flash Crash Past SL and Liquidation)**:
   - In `src/engine/orderLifecycle.ts` lines 276-302:
     ```typescript
     // 1. Liquidation Check (Priority 1)
     if (position.side === 'LONG' && currentMarkPrice <= position.liquidationPrice) {
       return { shouldExit: true, exitReason: 'LIQUIDATION_TRIGGERED', exitPrice: position.liquidationPrice }
     }
     ...
     // 2. Stop Loss Check (Priority 2)
     if (position.slPrice && position.slPrice > 0) { ... }
     // 3. Take Profit Check (Priority 3)
     if (position.tpPrice && position.tpPrice > 0) { ... }
     ```
   - On a Long position with SL at 95,000 and Liquidation at 90,000:
     - A single-tick flash crash to 85,000 evaluates Liquidation first, immediately returning `exitReason: 'LIQUIDATION_TRIGGERED'` and `exitPrice: 90000`. The SL check is bypassed.
   - On a Short position with SL at 105,000 and Liquidation at 110,000:
     - A single-tick flash pump to 115,000 evaluates Liquidation first, returning `exitReason: 'LIQUIDATION_TRIGGERED'` and `exitPrice: 110000`.

6. **Item 5: Multi-Asset PnL Calculations & CRITICAL BUG on BTC/USDT**:
   - In `src/engine/orderLifecycle.ts` line 182-184:
     ```typescript
     const isForex = signal.symbol.includes('/') &&
       (signal.symbol.includes('USD') || signal.symbol.includes('EUR') || signal.symbol.includes('GBP') || signal.symbol.includes('JPY') || signal.symbol.includes('XAU'))
     ```
   - In `src/engine/orderLifecycle.ts` line 316-321:
     ```typescript
     const isForex = position.market === 'FOREX' ||
       (position.symbol.includes('/') &&
         (position.symbol.includes('USD') || position.symbol.includes('EUR') || position.symbol.includes('GBP') || position.symbol.includes('JPY') || position.symbol.includes('XAU')))
     const isGold = position.symbol.includes('XAU')
     const isJpy = position.symbol.includes('JPY')
     const notionalMultiplier = isForex ? (isGold ? 100 : 100000) : 1
     ```
   - Observation: `"BTC/USDT".includes('/')` is `true`. `"BTC/USDT".includes('USD')` is `true` (because `"USDT"` contains `"USD"`).
   - This causes:
     1. `processOrderPipeline` to set `positionCreated.market = 'FOREX'` and `positionCreated.lots = signal.size`.
     2. `calculatePositionPnl` (in `riskEngine.ts`) checks `position.market === 'FOREX'`, which evaluates to `true`, setting `notionalMultiplier = 100,000`.
     3. `settlePositionExit` evaluates `isForex = true` and applies `notionalMultiplier = 100,000`.
   - **Empirical Execution Result**:
     - On a position of 0.1 BTC (entry $100,000), when price rises by +$100 to $100,100:
       - True institutional profit: `0.1 * $100 = $10.00 USD`.
       - Observed PnL in `calculatePositionPnl`: `(100) * 0.1 * 100,000 = $1,000,000.00 USD`!
       - Observed Realized PnL in `settlePositionExit`: `$1,000,000.00 USD`!
     - On a price drop of $100 on 0.1 BTC Long:
       - Observed loss: `-$1,000,000.00 USD`, wiping out and deeply bankrupting any account.
     - The same bug impacts all Crypto pairs quoted in USDT: `BTC/USDT`, `ETH/USDT`, and `SOL/USDT`.

---

## 2. Logic Chain

1. **From Observation 1 & 2**:
   - `checkCircuitBreaker` implements `>= maxThresholdPct`.
   - At 4.49%, `4.49 >= 4.5` is false; orders proceed normally.
   - At 4.50%, `4.50 >= 4.5` is true; the circuit breaker trips and blocks new orders.
   - At 4.51%, `4.51 >= 4.5` is true; orders are blocked.
   - In `recalculateBalanceSheet`, peak equity ratchets upwards deterministically, and drawdown is computed as `((peak - equity) / peak) * 100`.
   - Boundary behavior at 4.49%, 4.50%, and 4.51% is verified and mathematically sound.

2. **From Observation 3**:
   - Worker M3 claimed that if equity drops to 0 or below, the circuit breaker trips automatically.
   - However, `checkCircuitBreaker` only takes `dailyDrawdownPct` (not equity).
   - In `recalculateBalanceSheet`, if starting equity is zero (e.g. fresh deposit account or zero-capital simulation), an unrealized loss results in negative equity, but `newPeak` becomes negative, resulting in `dailyDrawdownPct = 0`.
   - Consequently, `isCircuitBreakerTripped` remains `false`.
   - While `evaluateOrderRisk` blocks orders via `INSUFFICIENT_MARGIN` because `freeMargin = 0`, the account circuit breaker state machine fails to flag `isCircuitBreakerTripped: true`, leaving AI bots in `ACTIVE` status instead of `LOCKED_BY_CIRCUIT_BREAKER`.

3. **From Observation 4**:
   - `updateTrailingStop` in `orderLifecycle.ts` correctly guarantees that stop loss only moves in the favorable direction (ratchets up for Longs, ratchets down for Shorts).
   - However, in `App.tsx` (the live trading loop), trailing distance for non-Gold assets is computed as `Number((pos.entryPrice * 0.003).toFixed(2))`.
   - For EUR/USD (entry ~1.0845), `1.0845 * 0.003 = 0.00325`, which `.toFixed(2)` truncates to `0.00`.
   - Because `trailDistance <= 0`, `updateTrailingStop` rejects the update, breaking trailing stops for all Forex major pairs in the application.

4. **From Observation 5**:
   - `checkPositionExitTriggers` tests exit conditions in sequential order: (1) Liquidation, (2) Stop Loss, (3) Take Profit.
   - Under flash crashes crossing both SL and Liquidation, Liquidation is evaluated first and returned immediately. This guarantees that emergency liquidation accounting and margin forfeiture take precedence over limit/stop orders.

5. **From Observation 6**:
   - Forex pairs use contract size multipliers: standard lot = 100,000 units; Gold = 100 oz; USD/JPY converts via quote rate division.
   - Crypto spot/perpetuals have a unit multiplier of 1 (1 BTC = 1 BTC, size 0.1 = 0.1 BTC).
   - In `orderLifecycle.ts`, `isForex` checks `signal.symbol.includes('USD')`.
   - Because Tether pairs have `USDT`, `symbol.includes('USD')` is true for `BTC/USDT`, `ETH/USDT`, and `SOL/USDT`.
   - This erroneously designates Crypto trades as `market: 'FOREX'` with `notionalMultiplier = 100,000`.
   - In `settlePositionExit`, any closure of `BTC/USDT` multiplies price difference by 100,000, inflating profit/loss by 5 orders of magnitude (100,000x).
   - This is a critical algorithmic defect in the order execution and risk pipeline.

---

## 3. Caveats

- Tests were run on the local test suite using Vitest 5.0.3 and Node.js v24.18.0.
- Spot balances in `portfolio.balances` were not modified; only position and trade lifecycle execution paths were tested.
- No other caveats.

---

## 4. Conclusion

### **VERDICT: REQUEST_CHANGES**

Milestone 3 has achieved strong foundational architecture for the 6-stage order lifecycle, circuit breaker threshold boundaries, and trailing stop ratchets. However, it cannot be approved in its current state due to **1 CRITICAL** and **2 HIGH/MEDIUM** algorithmic defects:

1. **[CRITICAL] Multiplier Inflation on Crypto (`orderLifecycle.ts` lines 182-184 & 316-318)**:
   - `BTC/USDT`, `ETH/USDT`, and `SOL/USDT` are misclassified as `FOREX` because `'USDT'.includes('USD')` is true.
   - Position PnL and settlement PnL are multiplied by 100,000x, turning a $10 move into a $1,000,000 PnL distortion.
   - **Remediation**:
     Fix `isForex` definition in `orderLifecycle.ts` (both in `processOrderPipeline` and `settlePositionExit`):
     ```typescript
     const isCrypto = signal.symbol.includes('USDT') || signal.symbol.includes('BTC') || signal.symbol.includes('ETH') || signal.symbol.includes('SOL')
     const isForex = !isCrypto && (
       signal.symbol.includes('EUR') ||
       signal.symbol.includes('GBP') ||
       signal.symbol.includes('JPY') ||
       signal.symbol.includes('XAU') ||
       signal.symbol.endsWith('/USD') ||
       signal.symbol.startsWith('USD/')
     )
     ```

2. **[HIGH] Truncation of Forex Trailing Stop Distance in UI (`App.tsx` line 168)**:
   - `const trailDist = pos.symbol.includes('XAU') ? 8.0 : Number((pos.entryPrice * 0.003).toFixed(2))` truncates Forex trail distances (< 0.01) to `0.00`.
   - **Remediation**: Use `toFixed(5)` or calculate dynamically based on asset decimals:
     ```typescript
     const isForex = pos.market === 'FOREX' || pos.symbol.includes('EUR') || pos.symbol.includes('GBP')
     const trailDist = pos.symbol.includes('XAU') 
       ? 8.0 
       : isForex 
       ? Number((pos.entryPrice * 0.002).toFixed(5)) 
       : Number((pos.entryPrice * 0.003).toFixed(2))
     ```

3. **[MEDIUM] Negative Equity Circuit Breaker Gap (`riskEngine.ts` line 134)**:
   - If starting equity and peak equity are zero and equity drops below zero, `dailyDrawdownPct` evaluates to 0, leaving `isCircuitBreakerTripped: false`.
   - **Remediation**: In `recalculateBalanceSheet`, trip circuit breaker whenever `equity <= 0` or `dailyDrawdownPct >= maxThresholdPct`:
     ```typescript
     const cbCheck = equity <= 0 
       ? { isTripped: true, reason: `Account equity depleted: $${equity.toFixed(2)} <= $0.00. Account trading locked.` }
       : checkCircuitBreaker(dailyDrawdownPct, DEFAULT_RISK_CONFIG.maxDailyDrawdownPct)
     ```

---

## 5. Verification Method

To independently verify these findings, run:

1. **Run the adversarial challenge stress test suite**:
   ```bash
   npx vitest run src/test/tier5_adversarial/challenger_m3_stress.test.ts
   ```
   *Expected outcome*: 19 tests pass, proving the exact boundary checks (4.49%/4.50%/4.51%), exit priority ordering (Liquidation > SL > TP), and empirically proving the BTC/USDT 100,000x multiplier bug.

2. **Run direct reproduction of BTC/USDT multiplier bug**:
   ```bash
   npx tsx -e "import { settlePositionExit } from './src/engine/orderLifecycle'; const pos = { id: 'p1', symbol: 'BTC/USDT', side: 'LONG', size: 0.1, entryPrice: 100000, markPrice: 100000, leverage: 10, margin: 1000, unrealizedPnl: 0, unrealizedPnlPct: 0, market: 'CRYPTO' }; console.log('Settlement PnL:', settlePositionExit(pos, 100100, 'MANUAL_CLOSE').realizedPnl);"
   ```
   *Observed output*: `Settlement PnL: 1000000` (100,000x higher than the correct $10.00).

3. **Run direct reproduction of App.tsx Forex trailDist truncation**:
   ```bash
   node -e "console.log(Number((1.0845 * 0.003).toFixed(2)))"
   ```
   *Observed output*: `0` (disabling trailing stop in App.tsx).
