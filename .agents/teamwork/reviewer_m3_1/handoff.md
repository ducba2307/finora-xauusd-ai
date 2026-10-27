# Milestone 3 Independent Review & Adversarial Audit Report

## 1. Observation

1. **Test Suite Verification**:
   - Command: `npx vitest run` / `pnpm test`
   - Output:
     ```
     Test Files  1 failed | 26 passed (27)
          Tests  6 failed | 223 passed (229)
       Duration  2.09s
     ```
   - Verbatim Failures in `src/test/adversarial_challenger_m3.test.ts`:
     - Test 1 (`Vector 1`): `multi-symbol high-frequency feed keeps all active symbol buffers strictly <= 100`
       `AssertionError: expected 24 to be 100 // Object.is equality` at `src/test/adversarial_challenger_m3.test.ts:105:30`
     - Test 2 (`Vector 1`): `rejects corrupt/malformed ticks without corrupting the price history buffer`
       `AssertionError: expected 11 to be 10 // Object.is equality` at `src/test/adversarial_challenger_m3.test.ts:158:55`
     - Test 3 (`Vector 2`): `never emits rapid duplicate signals on 1,000 consecutive ticks within the cooldown window`
       `AssertionError: expected +0 to be 1 // Object.is equality` at `src/test/adversarial_challenger_m3.test.ts:227:37`
     - Test 4 (`Vector 2`): `allows a subsequent signal ONLY after the full cooldownSec period has elapsed`
       `AssertionError: expected +0 to be 1 // Object.is equality` at `src/test/adversarial_challenger_m3.test.ts:266:37`
     - Test 5 (`Vector 2`): `enforces independent cooldown timers across all 4 bots`
       `AssertionError: expected +0 to be 1 // Object.is equality` at `src/test/adversarial_challenger_m3.test.ts:337:33`
     - Test 6 (`Vector 4`): `strictly rejects orders exceeding $50,000 notional value`
       `AssertionError: expected 'MAX_SIZE_EXCEEDED: Notional value $50000.01 exceeds limit $50000.' to contain 'exceeds limit 50000'` at `src/test/adversarial_challenger_m3.test.ts:608:27`

2. **TypeScript & Production Build**:
   - Command: `pnpm build` (`tsc -b && vite build`)
   - Result: Exit code 0, 1939 modules transformed, clean compilation.

3. **Linter Verification**:
   - Command: `pnpm lint` (`oxlint`)
   - Result: Exit code 0, 32 warnings, 0 errors.

4. **Forex/Gold Contract Multiplier Discrepancy in `src/engine/orderLifecycle.ts` and `src/engine/riskEngine.ts`**:
   - In `src/engine/orderLifecycle.ts` lines 144–146:
     ```typescript
     // Stage 3: RISK_CHECK
     const notional = signal.size * signal.price
     const marginRequired = notional / signal.leverage
     ```
   - In `src/engine/orderLifecycle.ts` lines 185–202:
     ```typescript
     const positionCreated: Position = {
       id: `pos_${signal.id}`,
       symbol: signal.symbol,
       side: signal.side === 'BUY' ? 'LONG' : 'SHORT',
       size: signal.size,
       entryPrice: Number(fillPrice.toFixed(4)),
       markPrice: Number(fillPrice.toFixed(4)),
       liquidationPrice: Number(liquidationPrice.toFixed(4)),
       leverage: signal.leverage,
       margin: Number(marginRequired.toFixed(2)),
       ...
     ```
   - In `src/engine/riskEngine.ts` lines 198–204:
     ```typescript
     // 5. Max Position Size Guard
     const notionalValue = order.size * order.price
     if (notionalValue > config.maxPositionSizeUsd) {
       return {
         allowed: false,
         reason: `MAX_SIZE_EXCEEDED: Notional value $${notionalValue.toFixed(2)} exceeds limit $${config.maxPositionSizeUsd}.`,
       }
     }
     ```
   - In contrast, `src/components/OrderEntryWidget.tsx` lines 103–109 applies:
     ```typescript
     const notionalContractValue = isForex 
       ? (symbol.includes('XAU') ? parsedAmount * 100 * activePrice : parsedAmount * 100000)
       : parsedAmount * activePrice
     ```
   - And `src/engine/riskEngine.ts` line 89 (`calculatePositionPnl`) and `src/engine/orderLifecycle.ts` line 321 (`settlePositionExit`) both apply:
     ```typescript
     const notionalMultiplier = isForex ? (isGold ? 100 : 100000) : 1
     ```

5. **Stale Realized PnL on Automated Exits in `src/App.tsx`**:
   - In `src/App.tsx` lines 177–198:
     ```typescript
     // Stage 6: Exit Trigger Evaluation
     const exitCheck = checkPositionExitTriggers(currentPos, mark)
     if (exitCheck.shouldExit) {
       hasChanges = true
       const realizedPnl = currentPos.unrealizedPnl
       ...
       setPortfolio((prev) => ({
         ...prev,
         totalBalance: Number((prev.totalBalance + realizedPnl).toFixed(2)),
         realizedProfit: Number((prev.realizedProfit + realizedPnl).toFixed(2)),
         tradeCapital: Math.max(0, Number((prev.tradeCapital - currentPos.margin).toFixed(2))),
       }))
       ...
       continue
     }
     ```
   - Lines 216–224 (which calculate live PnL at mark price) are positioned below line 212 (`continue`), meaning `currentPos.unrealizedPnl` at exit is the PnL calculated from the *prior* tick, rather than calculating PnL at `exitCheck.exitPrice` via `settlePositionExit(currentPos, exitCheck.exitPrice, exitCheck.exitReason)`.

6. **Rolling Price History Dropped During Bot Cooldown in `src/engine/botEngine.ts`**:
   - In `src/engine/botEngine.ts` lines 338–364:
     ```typescript
     for (const bot of this.bots.values()) {
       if (bot.status !== 'ACTIVE') continue

       // 1. Cooldown check
       const cooldownMs = (bot.cooldownSec ?? 30) * 1000
       const lastSignal = this.lastSignalTimes.get(bot.id) ?? 0
       if (now - lastSignal < cooldownMs) continue

       // 2. Open positions limit check
       if ((bot.activeOrdersCount ?? 0) >= (bot.maxOpenPositions ?? 1)) continue

       // 3. Ticker lookup
       const ticker = tickers[bot.symbol]
       if (!ticker || !ticker.midPrice || ticker.midPrice <= 0) continue

       // 4. Bounded rolling price buffer update (bounded to MAX_HISTORY_LEN)
       let history = this.priceHistory.get(bot.symbol)
     ```
   - Step 4 (price buffer update) is executed *after* Step 1 (cooldown check). When a bot is on cooldown, `continue` executes and incoming price ticks are discarded from `priceHistory`.
   - Line 351 (`if (!ticker || !ticker.midPrice || ticker.midPrice <= 0) continue`) does not check `Number.isFinite(ticker.midPrice)`, allowing `Infinity` to be appended to `priceHistory`.

## 2. Logic Chain

1. **Forex/Gold Multiplier Defect (Observation #4)**:
   - For standard Forex (EUR/USD), 1.0 lot represents 100,000 units of base currency. At price 1.0825, actual notional is $108,250.
   - For Gold (XAU/USD), 1.0 lot represents 100 troy ounces. At price 2700.0, actual notional is $270,000 (0.5 lot is $135,000).
   - Because `processOrderPipeline` in `src/engine/orderLifecycle.ts` (lines 144–145) calculates `notional = signal.size * signal.price` without the contract multiplier:
     - 1.0 lot EUR/USD is evaluated as having notional value $1.08 and margin requirement `$1.08 / 50 = $0.02`.
     - 0.5 lot XAU/USD is evaluated as having notional value $1,350 and margin requirement `$1,350 / 30 = $45.00` (instead of $4,500.00).
     - In `evaluateOrderRisk` (lines 198–204), `notionalValue = order.size * order.price` evaluates 1.0 lot EUR/USD as $1.08, completely bypassing the `MAX_SIZE_EXCEEDED` guard ($50,000 limit).
     - In `calculatePositionPnl` (lines 89–98), price movement is multiplied by 100,000, creating floating PnL of hundreds of dollars on a position recorded with $0.02 margin, causing `unrealizedPnlPct` to calculate to millions of percent.

2. **Stale Realized PnL on Automated Exits (Observation #5)**:
   - The user specification in `ORIGINAL_REQUEST.md` mandates:
     *"Vòng đời lệnh giao dịch (tạo, cập nhật SL/TP, trailing stop, đóng vị thế) phản ánh đúng số dư vốn và PnL thực tế của tài khoản."*
   - In `src/App.tsx`, when `checkPositionExitTriggers` returns `shouldExit: true` (e.g. `TP_HIT` at $118,000), `realizedPnl` is taken directly from `currentPos.unrealizedPnl`.
   - Because `currentPos.unrealizedPnl` reflects the *previous tick's mark price*, the position's profit from the final price movement to the TP level is completely lost or credited as $0.00 if the position was newly opened.
   - `src/engine/orderLifecycle.ts` already contains `settlePositionExit(position, exitPrice, exitReason)`, which correctly calculates the exact realized PnL at `exitPrice`. `App.tsx` failed to integrate this helper.

3. **Buffer Freezing During Cooldown (Observation #6)**:
   - Rolling buffers for technical indicators (RSI, EMA) require continuous, unfragmented price observations.
   - Because the cooldown guard in `BotExecutionEngine.handleMarketTick` precedes the price history update, once a bot triggers a trade, its price history freezes for 15–60 seconds, causing subsequent technical calculations to lag or fail test invariants (Test Failures 1–5).
   - Furthermore, omitting `Number.isFinite(ticker.midPrice)` allows `Infinity` to corrupt the rolling history array (Test Failure 2).

4. **Test Suite Regressions (Observation #1)**:
   - 6 tests fail in `src/test/adversarial_challenger_m3.test.ts`.
   - Production readiness criteria require 100% test pass rate with exit code 0.

## 3. Caveats

- **Build and Linting Pass Cleanly**: `pnpm build` and `pnpm lint` exit with code 0 without compiler or linting errors.
- **RSI Requirement in Tests**: Tests 3, 4, and 5 in `adversarial_challenger_m3.test.ts` feed 1 single tick and expect Gold Hunter to emit a signal, but Wilder RSI requires at least 15 ticks of history. However, Test 1 and Test 2 reveal legitimate defects in buffer updating and `Infinity` price filtering in `botEngine.ts`.
- **Integrity Assessment**: No evidence of malicious facades or test mocking was detected; the defects are genuine omissions of contract multiplier logic and lifecycle settlement wiring across modules.

## 4. Conclusion

Milestone 3 has achieved substantial architectural implementation across all 4 features (F10 Autonomous Bots, F11 6-Stage Lifecycle, F12 Risk Engine, F13 Dynamic Balance Sheet). However, because:
1. `processOrderPipeline` and `evaluateOrderRisk` calculate notional value and margin without Forex/Gold contract multipliers, bypassing pre-trade risk size checks and corrupting balance sheet margin accounting,
2. `App.tsx` automated exit closures settle positions with stale PnL rather than using `settlePositionExit`, and
3. `pnpm test` fails with 6 test failures in `src/test/adversarial_challenger_m3.test.ts`,

The implementation cannot be approved in its current state.

**Verdict: REQUEST_CHANGES**

### Actionable Remediation Steps for Worker:
1. **Fix Forex & Gold Contract Multiplier in `src/engine/orderLifecycle.ts`**:
   In `processOrderPipeline`, determine `notionalMultiplier`:
   ```typescript
   const isForex = signal.symbol.includes('/') &&
     (signal.symbol.includes('USD') || signal.symbol.includes('EUR') || signal.symbol.includes('GBP') || signal.symbol.includes('JPY') || signal.symbol.includes('XAU'))
   const isGold = signal.symbol.includes('XAU')
   const notionalMultiplier = isForex ? (isGold ? 100 : 100000) : 1
   const notional = signal.size * signal.price * notionalMultiplier
   const marginRequired = notional / signal.leverage
   ```
2. **Fix Forex & Gold Notional in `src/engine/riskEngine.ts`**:
   In `evaluateOrderRisk`, ensure `notionalValue` accounts for `notionalMultiplier` before comparing against `config.maxPositionSizeUsd`.
3. **Integrate `settlePositionExit` in `src/App.tsx`**:
   In `src/App.tsx`, import `settlePositionExit` from `./engine/orderLifecycle` and use it on line 178:
   ```typescript
   const exitCheck = checkPositionExitTriggers(currentPos, mark)
   if (exitCheck.shouldExit) {
     hasChanges = true
     const settlement = settlePositionExit(currentPos, exitCheck.exitPrice, exitCheck.exitReason)
     const realizedPnl = settlement.realizedPnl
     ...
     setPortfolio((prev) => ({
       ...prev,
       totalBalance: Number((prev.totalBalance + settlement.realizedPnl).toFixed(2)),
       realizedProfit: Number((prev.realizedProfit + settlement.realizedPnl).toFixed(2)),
       tradeCapital: Math.max(0, Number((prev.tradeCapital - settlement.releasedMargin).toFixed(2))),
     }))
     setTrades((prev) => [settlement.closedTrade, ...prev])
     continue
   }
   ```
4. **Fix Rolling Buffer Updating & Input Validation in `src/engine/botEngine.ts`**:
   - Move Step 4 (updating `this.priceHistory`) *before* Step 1 (bot cooldown check) in `handleMarketTick`.
   - Add `Number.isFinite(ticker.midPrice)` guard to prevent `Infinity` or `NaN` from entering `priceHistory`.
5. **Ensure 100% Test Pass Rate**:
   Verify that both `pnpm test` and `pnpm build` pass with 0 failures across all 27 test suites (229+ tests).

## 5. Verification Method

To verify the remediation:
1. Run Vitest test suite across all files:
   ```bash
   pnpm test
   ```
   *Expected outcome*: 27 passed test files, 229+ passed tests, 0 failures.
2. Run TypeScript build:
   ```bash
   pnpm build
   ```
   *Expected outcome*: Exit code 0, clean build.
3. Run Oxlint:
   ```bash
   pnpm lint
   ```
   *Expected outcome*: 0 errors.
4. Verify Forex/Gold notional calculation:
   - For `EUR/USD` 1.0 lot at 1.0825 with 50x leverage, margin must equal $2,165.00 (not $0.02).
   - For `XAU/USD` 0.5 lot at 2700.0 with 30x leverage, margin must equal $4,500.00 (not $45.00).
