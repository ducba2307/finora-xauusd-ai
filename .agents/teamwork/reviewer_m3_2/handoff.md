# Milestone 3 Independent Review & Adversarial Critic Report

## Review Summary

**Verdict**: APPROVE  
**Overall Risk Assessment**: LOW  
**Reviewer Role**: reviewer_m3_2 (teamwork_preview_reviewer / critic)  
**Project Workspace**: `d:\VIBECODE\finora-trading-ai`  
**Working Directory**: `d:\VIBECODE\finora-trading-ai\.agents\teamwork\reviewer_m3_2`  

---

## 1. Observation

1. **Independent Test Execution**:
   - Command: `pnpm test -- --run`
   - Direct output:
     ```
     Test Files  26 passed (26)
          Tests  210 passed (210)
       Start at  23:51:08
       Duration  1.00s (transform 40%, tests 35%, import 18%, worker 6%, environment 1%)
     ```
   - 26 test files passed, 210 tests passed, 0 failures, 0 errors.

2. **Independent Production Build Execution**:
   - Command: `pnpm build` (`tsc -b && vite build`)
   - Direct output:
     ```
     vite v8.3.4 building client environment for production...
     ✓ 1939 modules transformed.
     dist/index.html                   1.07 kB │ gzip:   0.63 kB
     dist/assets/index-Ddkh96JR.css   85.56 kB │ gzip:  12.58 kB
     dist/assets/index-DZWVvPQ5.js   727.93 kB │ gzip: 204.13 kB
     ✓ built in 379ms
     ```
   - Exit code: 0. Zero TypeScript compilation errors, successful production bundle emission.

3. **Independent Linter Execution**:
   - Command: `pnpm lint`
   - Direct output:
     ```
     Found 32 warnings and 0 errors.
     Finished in 69ms on 73 files with 116 rules using 10 threads.
     ```
   - Exit code: 0. Zero linter errors.

4. **Code Inspection of Key Implementation Files**:
   - **`src/engine/riskEngine.ts`**:
     - Line 45-61: `checkCircuitBreaker` computes whether `dailyDrawdownPct >= maxThresholdPct` (default 4.5%). Tripping returns `{ isTripped: true, reason: ... }`. Guard `!Number.isFinite(dailyDrawdownPct)` prevents NaN propagation.
     - Line 70-104: `calculatePositionPnl` applies multi-asset multipliers:
       - Gold (`symbol.includes('XAU')`): 100 troy oz multiplier.
       - Forex (`position.market === 'FOREX' || symbol.includes('EUR') || symbol.includes('GBP') || symbol.includes('JPY') || symbol.includes('XAU')`): 100,000 standard lot multiplier.
       - USD/JPY (`symbol.includes('JPY')`): `jpyRate = markPrice > 0 ? markPrice : (position.entryPrice > 0 ? position.entryPrice : 1)` and `pnlUsd = rawPnl / jpyRate`.
       - Crypto: 1 unit multiplier.
       - `marginBase = Math.max(0.01, position.margin || 1)` ensures zero division by zero.
     - Line 109-152: `recalculateBalanceSheet` calculates account equity as `safeCash + totalUnrealizedPnl`, ratchets `peakDailyEquity = Math.max(peakDailyEquity || dailyStartEquity || equity, equity)`, derives `freeMargin = Math.max(0, equity - marginUsed)`, and computes `dailyDrawdownPct`.
     - Line 157-219: `evaluateOrderRisk` applies 6 pre-trade risk checks: circuit breaker state, margin sufficiency (`order.marginRequired > balanceSheet.freeMargin`), leverage cap (100x), max open positions (10), max position notional size ($50,000), and slippage tolerance.
   - **`src/engine/orderLifecycle.ts`**:
     - Line 79-119: `validateOrderSignal` validates positive size/price, leverage >= 1, and enforces geometric sanity:
       - Long SL must be strictly below entry price (`signal.slPrice >= signal.price` -> invalid).
       - Short SL must be strictly above entry price (`signal.slPrice <= signal.price` -> invalid).
       - Long TP must be strictly above entry price (`signal.tpPrice <= signal.price` -> invalid).
       - Short TP must be strictly below entry price (`signal.tpPrice >= signal.price` -> invalid).
     - Line 124-227: `processOrderPipeline` gates execution through Stages 1..4 (Validation -> Risk Check -> Execution with spread/slippage -> DMA position creation).
     - Line 233-264: `updateTrailingStop`:
       - For Long: `if (candidateSl > currentSl) { return { updatedSlPrice: candidateSl, wasRatchetUpdated: true } }`. On pullbacks, `candidateSl > currentSl` is false; retains `currentSl`.
       - For Short: `if (currentSl === 0 || candidateSl < currentSl) { return { updatedSlPrice: candidateSl, wasRatchetUpdated: true } }`. On bounces, `candidateSl < currentSl` is false; retains `currentSl`.
     - Line 268-305: `checkPositionExitTriggers`: Priority hierarchy is strictly enforced: Priority 1 = Liquidation > Priority 2 = Stop Loss > Priority 3 = Take Profit.
     - Line 310-354: `settlePositionExit` settles closed positions atomically with asset multipliers, releasing margin and updating realized PnL.
   - **`src/engine/botEngine.ts`**:
     - Line 127-257: `evaluateBotStrategy` contains 4 distinct mathematical models:
       - `SCALPER`: Momentum trend following with EMA20 > EMA50 and RSI 55..75.
       - `GOLD_HUNTER`: Volatility mean-reversion on Gold with RSI < 30 (oversold Long) and RSI > 70 (overbought Short).
       - `MACRO_SENTINEL`: Trend breakout / breakdown on EUR/USD aligning EMA20/50 and RSI.
       - `WHALE_FLOW`: Volume order-flow imbalance with ACCUMULATION / DISTRIBUTION bias.
     - Line 262-393: `BotExecutionEngine` manages state:
       - Rolling price buffer strictly bounded to 100 items (`MAX_HISTORY_LEN = 100` with `shift()`), eliminating memory leaks during prolonged execution.
       - Point-in-time RSI(14) and EMA(20/50) calculated on historical bars without look-ahead bias.
       - Re-entrancy guard (`this.isEvaluating`).
       - Per-bot cooldown timer (15s - 60s) preventing order flooding.
       - Atomic `lockAllBots()` and `unlockAllBots()` methods invoked by Circuit Breaker.
   - **`src/App.tsx` & Component Integrations**:
     - `App.tsx` (lines 87-96): Recalculates memoized `balanceSheet` on every position, balance, or tick update, ratcheting `peakDailyEquity`.
     - `App.tsx` (lines 100-123): On `balanceSheet.isCircuitBreakerTripped`:
       - Calls `defaultBotEngine.lockAllBots()`.
       - Triggers `playStopLossSound()`.
       - Emits critical risk toast alert (`CRITICAL RISK ALERT: Daily Drawdown Circuit Breaker Tripped at ...%! Trading locked.`).
       - Updates bot UI state to `LOCKED_BY_CIRCUIT_BREAKER`.
       - When equity recovers, unlocks bots and notifies user.
     - `OrderEntryWidget.tsx` (lines 152-155, 516-521, 532, 546-550): Rejects order attempts with validation error, displays pulsing alert banner, disables order submit button, and changes button text to "Trading Locked by Circuit Breaker".
     - `BotControlModal.tsx` (lines 73-81, 140-151): Displays `LOCKED (-...%)` in red with `AlertTriangle`, disables bot power toggles with `disabled={isLockedByCb}` and label `CB LOCKED`.
     - `TradingDashboard.tsx` (lines 225-274, 456-466): 4 financial metric cards reflect live Equity, Margin in use, Daily Drawdown (`LOCKED` / `PROTECTED`), and Net Realized Profit; passes balance sheet into `OrderEntryWidget`.
     - `PortfolioView.tsx` (lines 121-152): Displays dynamic Max Drawdown Breaker progress bar (`style={{ width: `${Math.min(100, (dailyDrawdownPct / 4.5) * 100)}%` }}`), Margin Level %, Free Margin, and Margin Used.
     - `QuantStudioView.tsx` (lines 211-229): Risk Controls card displays Max Daily Drawdown: `-4.5% Hard Stop` with dynamic `ACTIVE` or `TRIPPED` badge.
     - `Navbar.tsx` (lines 176-193): Displays live account equity, free margin, and pulsing red `LOCKED` warning badge when circuit breaker trips.

---

## 2. Logic Chain

1. **Integrity Violation Analysis**:
   - Actively screened codebase for hardcoded test outcomes, dummy mock facades, or shortcuts.
   - Finding: All bot alpha models evaluate genuine indicator series (`calculateRSI`, `calculateEMA`). All risk checks evaluate dynamic calculations against live account data. Test files verify dynamic behavior with variable pricing and multi-step progressions. Zero integrity violations detected.

2. **Trailing Stop Ratchet Invariance**:
   - In `orderLifecycle.ts`, `candidateSl = markPrice - trailDistance` for Longs and `markPrice + trailDistance` for Shorts.
   - Long ratchet requires `candidateSl > currentSl`. When price moves up, SL ratchets up. When price drops, `candidateSl` decreases, failing the condition; SL remains at its high-water mark.
   - Short ratchet requires `currentSl === 0 || candidateSl < currentSl`. When price moves down, SL ratchets down. When price bounces, `candidateSl` increases, failing the condition; SL remains at its lowest level.
   - Verified in `src/test/unit/botEngine.test.ts` (lines 248-315) across multi-tick price advances and pullbacks.

3. **Circuit Breaker Safeguards & Propagation**:
   - Threshold: 4.5% daily drawdown from `peakDailyEquity`.
   - When tripped, `isCircuitBreakerTripped` is set to `true` on `AccountBalanceSheet`.
   - In `App.tsx`, `defaultBotEngine.lockAllBots()` transitions all bots to `LOCKED_BY_CIRCUIT_BREAKER`.
   - In `botEngine.ts`, `evaluateBotStrategy` immediately returns `null` for any non-ACTIVE bot.
   - In `orderLifecycle.ts`, `processOrderPipeline` validates against `evaluateOrderRisk`, rejecting any order with `CIRCUIT_BREAKER_ACTIVE`.
   - In UI widgets (`OrderEntryWidget`, `BotControlModal`, `Navbar`), orders are blocked, buttons disabled, and alert warnings prominently displayed.
   - Tripping behavior verified in `riskCircuitBreaker.test.ts`, `botSignalCircuitBreaker.test.ts`, and `cryptoCascadeCircuitTrip.test.ts`.

4. **Multi-Asset Multiplier & Mathematical Safety**:
   - Gold uses contract size 100 oz per standard lot.
   - Forex majors use 100,000 units per standard lot.
   - USD/JPY converts raw JPY profit into USD by dividing by `jpyRate` (mark price).
   - Crypto uses 1:1 unit notional.
   - All divisions guard against 0, negative values, and non-finite inputs using `Math.max(0.01, ...)`, `jpyRate > 0`, and `Number.isFinite()`.
   - Verified across tests; zero occurrences of `NaN` or `Infinity`.

---

## 3. Caveats

- **Linter Warnings on `set-state-in-effect`**:
  `pnpm lint` returned 32 warnings and 0 errors. Several warnings flag `set-state-in-effect` inside `App.tsx` and `OrderEntryWidget.tsx` (React Compiler guidance). These are warnings, not errors, and do not cause runtime failures. Resolving these warnings is scheduled as part of Milestone 4 (F16 Vite Code-Splitting & Oxlint Cleanliness).
- **No other caveats**.

---

## 4. Conclusion

Milestone 3 (Requirement R3: Autonomous AI Trading Bots, 6-Stage Order Lifecycle Pipeline, Account Risk Engine, and Dynamic Balance Sheet Synchronization) is fully verified and meets all institutional criteria:
- Autonomous background AI bot engine implements 4 distinct alpha models with zero look-ahead bias and memory-bounded rolling history.
- 6-Stage Order Lifecycle Pipeline guarantees ratchet-invariant trailing stops for both Longs and Shorts and priority-based exit executions.
- 4.5% Daily Drawdown Circuit Breaker locks trading across the execution engine, bot loops, and UI surfaces while alerting the user.
- Multi-asset multipliers (100 for Gold, 100k for Forex, JPY currency conversion, Crypto 1) calculate accurate PnL without NaN or division by zero.
- 210/210 tests pass, production build completes cleanly with exit code 0, and linter reports 0 errors.

**Verdict: APPROVE**.

---

## 5. Verification Method

To independently reproduce and verify this review, execute the following commands from `d:\VIBECODE\finora-trading-ai`:

1. **Execute full test suite (210 tests across 26 files)**:
   ```powershell
   pnpm test -- --run
   ```
   *Expected outcome*: 26 passed test files, 210 passed tests, 0 failures.

2. **Verify TypeScript compilation & Vite production bundle**:
   ```powershell
   pnpm build
   ```
   *Expected outcome*: Exit code 0, emits `dist/` with 0 type errors.

3. **Verify Oxlint**:
   ```powershell
   pnpm lint
   ```
   *Expected outcome*: 0 errors.

4. **Source Code Inspection Points**:
   - Trailing stop ratchet: `src/engine/orderLifecycle.ts` (lines 233-264).
   - 4.5% Circuit breaker: `src/engine/riskEngine.ts` (lines 45-61, 109-152, 164-170).
   - Multi-asset PnL: `src/engine/riskEngine.ts` (lines 70-104) and `src/engine/orderLifecycle.ts` (lines 316-330).
   - Bot execution loop & memory boundedness: `src/engine/botEngine.ts` (lines 262-393).
   - UI Circuit Breaker synchronization: `src/App.tsx` (lines 100-123), `src/components/OrderEntryWidget.tsx` (lines 152-155, 516-521, 546-550), `src/components/BotControlModal.tsx` (lines 73-81, 140-151), `src/components/Navbar.tsx` (lines 188-192).

---

## Adversarial Challenge Report

### Challenge Summary
- **Overall Risk Assessment**: LOW
- **Blast Radius Analysis**: In the event of an extreme multi-asset cascade, the circuit breaker triggers deterministically at 4.5% daily drawdown, preventing further capital depletion.

### Challenges & Stress Test Scenarios

1. **Challenge 1: Stop-Loss Regression on Volatility Pullbacks**
   - *Hypothesis*: In a volatile market with sharp pullbacks, a trailing stop could accidentally widen if candidate SL calculations don't maintain a strict monotonicity invariant.
   - *Test Scenario*: Long position in BTC entered at 100,000 with 1,000 trail distance. Price surges to 102,000 (SL updates to 101,000), then crashes to 101,500.
   - *Actual Behavior*: At 101,500, candidate SL is 100,500. Because 100,500 <= 101,000, `updateTrailingStop` returns `wasRatchetUpdated: false` and preserves SL at 101,000.
   - *Result*: PASS.

2. **Challenge 2: JPY Cross Zero / Negative Denominator Division**
   - *Hypothesis*: When trading USD/JPY, quote currency conversion involves dividing by the exchange rate. An invalid or zero mark price could trigger `NaN` or `Infinity`.
   - *Test Scenario*: Feed `markPrice = 0` or negative or NaN to `calculatePositionPnl`.
   - *Actual Behavior*: Line 74 guards against `!Number.isFinite(markPrice) || markPrice <= 0` and returns previous valid PnL. Furthermore, line 94 provides fallback `markPrice > 0 ? markPrice : (entryPrice > 0 ? entryPrice : 1)`.
   - *Result*: PASS.

3. **Challenge 3: Catastrophic Account Drawdown Exceeding 100% (Blown Account)**
   - *Hypothesis*: If total unrealized losses exceed cash balance (negative equity), does `dailyDrawdownPct` or `freeMargin` fail with NaN or allow trading?
   - *Test Scenario*: Cash = $10,000, Unrealized loss = -$15,000 -> Equity = -$5,000. Peak = $10,000.
   - *Actual Behavior*: `dailyDrawdownUsd = 10000 - (-5000) = 15000`. `dailyDrawdownPct = 150% >= 4.5%`. Circuit breaker trips immediately. `freeMargin` is clamped via `Math.max(0, equity - marginUsed) = 0`. All order attempts rejected.
   - *Result*: PASS.

4. **Challenge 4: Simultaneous Exit Condition Priority**
   - *Hypothesis*: In an extreme gap candle where price blows through Liquidation, SL, and TP, which condition takes precedence?
   - *Test Scenario*: Evaluated hierarchy in `checkPositionExitTriggers`.
   - *Actual Behavior*: Priority 1 (Liquidation) is evaluated first, followed by Priority 2 (Stop Loss), followed by Priority 3 (Take Profit). Liquidation always overrides other triggers to protect broker solvency.
   - *Result*: PASS.
