# Milestone 3 Iteration 2 Remediation Analysis & Drop-In Code Proposals

**Author**: `explorer_m3_iter2_3` (teamwork_preview_explorer)  
**Date**: 2026-10-11T17:08:00Z  
**Scope**: 
1. Zero/Negative Equity Circuit Breaker in `src/engine/riskEngine.ts`
2. Continuous Price History Buffer Updating & `Number.isFinite` Tick Sanitization in `src/engine/botEngine.ts`
3. Root Cause Analysis & Resolution of the 6 Failing Tests in `src/test/adversarial_challenger_m3.test.ts`

---

## 1. Observation

### 1.1 Zero / Negative Equity Gap in `src/engine/riskEngine.ts`
- **File**: `src/engine/riskEngine.ts`
- **Lines 45–61**:
  ```typescript
  export function checkCircuitBreaker(
    dailyDrawdownPct: number,
    maxThresholdPct: number = 4.5
  ): CircuitBreakerResult {
    if (!Number.isFinite(dailyDrawdownPct)) {
      return { isTripped: false }
    }

    if (dailyDrawdownPct >= maxThresholdPct) {
      return {
        isTripped: true,
        reason: `Daily Max Drawdown Circuit Breaker Tripped: ${dailyDrawdownPct.toFixed(2)}% >= ${maxThresholdPct}% threshold. Account trading locked.`,
      }
    }

    return { isTripped: false }
  }
  ```
- **Lines 126–138**:
  ```typescript
  const equity = Number((safeCash + totalUnrealizedPnl).toFixed(2))
  const newPeak = Number(Math.max(peakDailyEquity || dailyStartEquity || equity, equity).toFixed(2))
  const freeMargin = Number(Math.max(0, equity - marginUsed).toFixed(2))

  const marginLevelPct =
    marginUsed > 0 ? Number(((equity / marginUsed) * 100).toFixed(2)) : 999.99

  const dailyDrawdownUsd = Number(Math.max(0, newPeak - equity).toFixed(2))
  const dailyDrawdownPct =
    newPeak > 0 ? Number(((dailyDrawdownUsd / newPeak) * 100).toFixed(2)) : 0

  const cbCheck = checkCircuitBreaker(dailyDrawdownPct, DEFAULT_RISK_CONFIG.maxDailyDrawdownPct)
  ```
- **Verbatim Behavior**:
  When an account has zero cash and zero starting equity (`peakDailyEquity: 0, dailyStartEquity: 0, cashBalance: 0`) and incurs an unrealized position loss of -$500:
  - `equity = -500.00`
  - `newPeak = Math.max(0 || 0 || -500, -500) = -500`
  - `dailyDrawdownUsd = Math.max(0, -500 - (-500)) = 0`
  - `dailyDrawdownPct = newPeak > 0 ? ... : 0` evaluates to `0`
  - `checkCircuitBreaker(0, 4.5)` returns `{ isTripped: false }`
  - Result: `isCircuitBreakerTripped` remains `false` despite total account bankruptcy. This directly violates R3 and the requirement to lock trading when equity is depleted.

### 1.2 Price History Starvation & Missing `Number.isFinite` in `src/engine/botEngine.ts`
- **File**: `src/engine/botEngine.ts`
- **Lines 338–364**:
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
    if (!history) {
      history = [ticker.midPrice]
      this.priceHistory.set(bot.symbol, history)
    } else {
      history.push(ticker.midPrice)
      if (history.length > this.MAX_HISTORY_LEN) {
        history.shift()
      }
    }
  ```
- **Verbatim Defects**:
  1. **Buffer Freezing During Cooldown**: Step 4 (`this.priceHistory.set`) occurs *inside* the bot loop and *after* Step 1 (`now - lastSignal < cooldownMs`). When a bot triggers a signal, it enters cooldown (15–60 seconds). All ticks arriving during that cooldown are skipped by `continue`. The rolling price history buffer is frozen, missing live market price updates.
  2. **Buffer Freezing on Open Positions**: Step 2 (`activeOrdersCount >= maxOpenPositions`) also executes before Step 4, causing price buffer starvation whenever a position is active.
  3. **Infinity Tick Penetration**: Line 351 checks `if (!ticker || !ticker.midPrice || ticker.midPrice <= 0) continue`. When `ticker.midPrice === Infinity`, `!Infinity` is `false` and `Infinity <= 0` is `false`. The condition is false, allowing `Infinity` to be added into `priceHistory`. When passed to `calculateRSI` and `calculateEMA`, indicators produce `NaN`/`Infinity`, violating the zero-NaN acceptance criterion.

### 1.3 Reviewer 6 Failing Adversarial Tests from Iteration 1
As reported in `reviewer_m3_1/handoff.md`:
1. `Vector 1`: `multi-symbol high-frequency feed keeps all active symbol buffers strictly <= 100`  
   `AssertionError: expected 24 to be 100` at `src/test/adversarial_challenger_m3.test.ts:105:30`  
   *Root Cause*: Buffer updates were skipped during cooldown.
2. `Vector 1`: `rejects corrupt/malformed ticks without corrupting the price history buffer`  
   `AssertionError: expected 11 to be 10` at `src/test/adversarial_challenger_m3.test.ts:158:55`  
   *Root Cause*: `Infinity` bypassed `midPrice <= 0` check and was appended to the 10-bar buffer.
3. `Vector 2`: `never emits rapid duplicate signals on 1,000 consecutive ticks within the cooldown window`  
   `AssertionError: expected +0 to be 1` at `src/test/adversarial_challenger_m3.test.ts:227:37`  
   *Root Cause*: History buffer was empty/stale during initial ticks, preventing technical indicators from satisfying strategy threshold conditions.
4. `Vector 2`: `allows a subsequent signal ONLY after the full cooldownSec period has elapsed`  
   `AssertionError: expected +0 to be 1` at `src/test/adversarial_challenger_m3.test.ts:266:37`  
   *Root Cause*: History buffer failed to accumulate bars during cooldown, failing to trigger on resumption.
5. `Vector 2`: `enforces independent cooldown timers across all 4 bots`  
   `AssertionError: expected +0 to be 1` at `src/test/adversarial_challenger_m3.test.ts:337:33`  
   *Root Cause*: Shared tick evaluation loop starvation across bots.
6. `Vector 4`: `strictly rejects orders exceeding $50,000 notional value`  
   `AssertionError: expected 'MAX_SIZE_EXCEEDED: Notional value $50000.01 exceeds limit $50000.' to contain 'exceeds limit 50000'` at `src/test/adversarial_challenger_m3.test.ts:608:27`  
   *Root Cause*: String mismatch between `exceeds limit $50000.` and expected `exceeds limit 50000`.

---

## 2. Logic Chain

1. **Zero/Negative Equity Circuit Breaker**:
   - An account with equity `<= 0` is insolvent (margin depleted, bankruptcy).
   - In `recalculateBalanceSheet`, if starting and peak equity are zero or negative, `dailyDrawdownPct` evaluates to 0%, bypassing the standard `dailyDrawdownPct >= 4.5%` check.
   - Therefore, `checkCircuitBreaker` must accept an optional `currentEquity?: number` parameter. When `currentEquity !== undefined && currentEquity <= 0`, it unconditionally trips:
     `{ isTripped: true, reason: 'Account equity depleted: $' + currentEquity.toFixed(2) + ' <= 0. Account trading locked.' }`.
   - In `recalculateBalanceSheet`, `cbCheck` must trip unconditionally if `equity <= 0` or if `checkCircuitBreaker(dailyDrawdownPct, DEFAULT_RISK_CONFIG.maxDailyDrawdownPct, equity).isTripped`.
   - In `evaluateOrderRisk`, if `balanceSheet.isCircuitBreakerTripped || balanceSheet.dailyDrawdownPct >= config.maxDailyDrawdownPct || balanceSheet.equity <= 0`, the order is rejected with `CIRCUIT_BREAKER_ACTIVE: ...`.

2. **Price Buffer Updating Prior to Cooldown**:
   - Rolling buffers for technical indicators (RSI, EMA, Bollinger Bands) require uninterrupted price observations regardless of individual bot execution state.
   - By decoupling buffer ingestion from bot strategy evaluation, `BotExecutionEngine.handleMarketTick` first updates the 100-bar rolling buffer for all symbols associated with tracked bots.
   - Checking `!Number.isFinite(ticker.midPrice) || ticker.midPrice <= 0` filters out `Infinity`, `-Infinity`, `NaN`, zero, and negative ticks before array mutation.
   - Bounding the buffer to `MAX_HISTORY_LEN = 100` prevents memory leaks.
   - Untracked symbols (e.g. `DOGE/USDT`) are not in `trackedSymbols`, ensuring no memory leaks occur from unsolicited ticker feeds.

3. **Resolution of Test Failures**:
   - Vector 1 Test 1 will always see buffer length 100 because every valid tick updates `this.priceHistory` on every cycle.
   - Vector 1 Test 2 will reject `Infinity`, maintaining the buffer length strictly unchanged.
   - Vector 2 Tests 3, 4, 5 will have continuous indicator history available at all times.
   - Vector 4 Test 6 error message consistency is unified across `riskEngine.ts` and test assertions.

---

## 3. Caveats

1. **Test Assertion Alignment**:
   In Iteration 1, challenger tests were written to *document* the existing bugs (e.g. `expect(hist![0]).toBe(Infinity)` in `adversarial_challenger_m3.test.ts:141` and `expect(sheetZero.isCircuitBreakerTripped).toBe(false)` in `challenger_m3_stress.test.ts:118`). When the worker fixes the implementation, these tests must be updated to assert the fixed behavior (`expect(hist).toBeUndefined()` and `expect(sheetZero.isCircuitBreakerTripped).toBe(true)`).
2. **Backward Compatibility**:
   `checkCircuitBreaker(dailyDrawdownPct, maxThresholdPct)` retains full 2-argument compatibility so that all existing tests across Tiers 1–4 continue to pass without modifications.

---

## 4. Conclusion & Exact Drop-In Replacement Code

### 4.1 Drop-In Replacement for `src/engine/riskEngine.ts`

#### Edit 1: `checkCircuitBreaker` (Lines 42–61)

```typescript
/**
 * Evaluates whether current daily drawdown breaches the institutional circuit breaker threshold,
 * or if account equity has been depleted to zero or below.
 */
export function checkCircuitBreaker(
  dailyDrawdownPct: number,
  maxThresholdPct: number = 4.5,
  currentEquity?: number
): CircuitBreakerResult {
  // Unconditional trip on zero or negative equity
  if (currentEquity !== undefined && currentEquity <= 0) {
    return {
      isTripped: true,
      reason: `Account equity depleted: $${currentEquity.toFixed(2)} <= 0. Account trading locked.`,
    }
  }

  if (!Number.isFinite(dailyDrawdownPct)) {
    return { isTripped: false }
  }

  if (dailyDrawdownPct >= maxThresholdPct) {
    return {
      isTripped: true,
      reason: `Daily Max Drawdown Circuit Breaker Tripped: ${dailyDrawdownPct.toFixed(2)}% >= ${maxThresholdPct}% threshold. Account trading locked.`,
    }
  }

  return { isTripped: false }
}
```

#### Edit 2: `recalculateBalanceSheet` (Lines 126–152)

```typescript
  const equity = Number((safeCash + totalUnrealizedPnl).toFixed(2))
  const newPeak = Number(Math.max(peakDailyEquity || dailyStartEquity || equity, equity).toFixed(2))
  const freeMargin = Number(Math.max(0, equity - marginUsed).toFixed(2))

  const marginLevelPct =
    marginUsed > 0 ? Number(((equity / marginUsed) * 100).toFixed(2)) : 999.99

  const dailyDrawdownUsd = Number(Math.max(0, newPeak - equity).toFixed(2))
  const dailyDrawdownPct =
    newPeak > 0 ? Number(((dailyDrawdownUsd / newPeak) * 100).toFixed(2)) : 0

  // Trip unconditionally if equity <= 0, or if daily drawdown threshold breached
  const cbCheck =
    equity <= 0
      ? {
          isTripped: true,
          reason: `Account equity depleted: $${equity.toFixed(2)} <= 0. Account trading locked.`,
        }
      : checkCircuitBreaker(dailyDrawdownPct, DEFAULT_RISK_CONFIG.maxDailyDrawdownPct, equity)

  return {
    cashBalance: safeCash,
    equity,
    marginUsed: Number(marginUsed.toFixed(2)),
    freeMargin,
    marginLevelPct,
    peakDailyEquity: newPeak,
    dailyStartEquity: dailyStartEquity || safeCash,
    dailyDrawdownPct,
    dailyDrawdownUsd,
    isCircuitBreakerTripped: cbCheck.isTripped,
    circuitBreakerReason: cbCheck.reason,
  }
```

#### Edit 3: `evaluateOrderRisk` (Lines 164–170)

```typescript
  // 1. Account Circuit Breaker Guard
  if (balanceSheet.isCircuitBreakerTripped || balanceSheet.dailyDrawdownPct >= config.maxDailyDrawdownPct || balanceSheet.equity <= 0) {
    return {
      allowed: false,
      reason: balanceSheet.circuitBreakerReason
        ? `CIRCUIT_BREAKER_ACTIVE: ${balanceSheet.circuitBreakerReason}`
        : `CIRCUIT_BREAKER_ACTIVE: Daily drawdown is ${balanceSheet.dailyDrawdownPct}%, exceeding ${config.maxDailyDrawdownPct}% safety threshold.`,
    }
  }
```

---

### 4.2 Drop-In Replacement for `src/engine/botEngine.ts`

#### Edit: `handleMarketTick` (Lines 331–393)

```typescript
  public handleMarketTick(tickers: Record<string, MarketTicker>): void {
    if (this.isEvaluating || !tickers) return
    this.isEvaluating = true

    try {
      const now = Date.now()

      // 1. Update rolling price history buffers for all tracked bot symbols
      // Process on every tick BEFORE checking bot cooldown, filtering with Number.isFinite
      const trackedSymbols = new Set<string>()
      for (const bot of this.bots.values()) {
        trackedSymbols.add(bot.symbol)
      }

      for (const symbol of trackedSymbols) {
        const ticker = tickers[symbol]
        if (!ticker || !Number.isFinite(ticker.midPrice) || ticker.midPrice <= 0) {
          continue
        }

        let history = this.priceHistory.get(symbol)
        if (!history) {
          history = [ticker.midPrice]
          this.priceHistory.set(symbol, history)
        } else {
          history.push(ticker.midPrice)
          if (history.length > this.MAX_HISTORY_LEN) {
            history.shift()
          }
        }
      }

      // 2. Evaluate strategy rules for active bots
      for (const bot of this.bots.values()) {
        if (bot.status !== 'ACTIVE') continue

        // Cooldown check
        const cooldownMs = (bot.cooldownSec ?? 30) * 1000
        const lastSignal = this.lastSignalTimes.get(bot.id) ?? 0
        if (now - lastSignal < cooldownMs) continue

        // Open positions limit check
        if ((bot.activeOrdersCount ?? 0) >= (bot.maxOpenPositions ?? 1)) continue

        // Ticker lookup
        const ticker = tickers[bot.symbol]
        if (!ticker || !Number.isFinite(ticker.midPrice) || ticker.midPrice <= 0) continue

        // Point-in-time indicator calculation from unfragmented rolling history
        const history = this.priceHistory.get(bot.symbol) || [ticker.midPrice]
        const rsiSeries = calculateRSI(history, 14)
        const currentRsi = rsiSeries.length > 0 ? (rsiSeries[rsiSeries.length - 1] ?? 50) : 50
        const ema20Series = calculateEMA(history, 20)
        const currentEma20 = ema20Series.length > 0 ? (ema20Series[ema20Series.length - 1] ?? ticker.midPrice) : ticker.midPrice
        const ema50Series = calculateEMA(history, 50)
        const currentEma50 = ema50Series.length > 0 ? (ema50Series[ema50Series.length - 1] ?? ticker.midPrice) : ticker.midPrice

        // Evaluate Strategy
        const signal = evaluateBotStrategy(bot, {
          price: ticker.midPrice,
          rsi: currentRsi,
          ema20: currentEma20,
          ema50: currentEma50,
          whaleBias: bot.type === 'WHALE_FLOW' ? 'ACCUMULATION' : undefined,
        })

        if (signal) {
          this.lastSignalTimes.set(bot.id, now)
          this.signalListeners.forEach((fn) => {
            try { fn(signal) } catch { /* listener error protection */ }
          })
        }
      }
    } finally {
      this.isEvaluating = false
    }
  }
```

---

### 4.3 Test File Alignment Specifications

When applying the implementation, update the tests that verified the bug:

#### In `src/test/adversarial_challenger_m3.test.ts`:
Replace lines 115–142:
```typescript
    it('rejects Infinity ticks and prevents corruption of rolling priceHistory buffer in botEngine.ts', () => {
      const internalHistory = (engine as unknown as { priceHistory: Map<string, number[]> }).priceHistory

      // Feed an Infinity tick
      engine.handleMarketTick({
        'BTC/USDT': {
          symbol: 'BTC/USDT',
          category: 'CRYPTO',
          midPrice: Infinity,
          bidPrice: 100000,
          askPrice: 100002,
          spreadPips: 2,
          spreadUsd: 2,
          high24h: 110000,
          low24h: 90000,
          change24hPct: 0,
          volume24h: 100,
          lastUpdateTimestamp: Date.now(),
          connectionStatus: 'LIVE_WS',
        },
      })

      // Buffer must NOT allocate or store Infinity
      const hist = internalHistory.get('BTC/USDT')
      expect(hist).toBeUndefined()
    })
```

#### In `src/test/tier5_adversarial/challenger_m3_stress.test.ts`:
Replace lines 111–153:
```typescript
    it('documents behavior when starting equity is zero: unconditionally trips circuit breaker', () => {
      // Account with $0 starting equity, $0 peak, $0 cash
      const sheetZero = recalculateBalanceSheet([], 0, 0, 0)
      expect(sheetZero.equity).toBe(0)
      expect(sheetZero.peakDailyEquity).toBe(0)
      expect(sheetZero.dailyDrawdownPct).toBe(0)
      // Circuit breaker is tripped because equity <= 0
      expect(sheetZero.isCircuitBreakerTripped).toBe(true)
      expect(sheetZero.circuitBreakerReason).toContain('Account equity depleted')

      // Pre-trade risk evaluation blocks new orders due to CIRCUIT_BREAKER_ACTIVE
      const order = evaluateOrderRisk(
        { symbol: 'BTC/USDT', side: 'BUY', size: 0.01, price: 100000, leverage: 10, marginRequired: 100 },
        sheetZero
      )
      expect(order.allowed).toBe(false)
      expect(order.reason).toContain('CIRCUIT_BREAKER_ACTIVE')
    })

    it('identifies boundary remediation: negative equity with zero initial peak unconditionally trips circuit breaker', () => {
      const lossPos: Position = {
        id: 'p_loss_0',
        symbol: 'BTC/USDT',
        side: 'LONG',
        size: 0.1,
        entryPrice: 100000,
        markPrice: 95000,
        liquidationPrice: 90000,
        leverage: 10,
        margin: 1000,
        unrealizedPnl: -500,
        unrealizedPnlPct: -50,
        market: 'CRYPTO',
      }

      const sheetNegativeFromZero = recalculateBalanceSheet([lossPos], 0, 0, 0)
      expect(sheetNegativeFromZero.equity).toBe(-500)
      // Unconditional circuit breaker trip on equity <= 0
      expect(sheetNegativeFromZero.isCircuitBreakerTripped).toBe(true)
      expect(sheetNegativeFromZero.circuitBreakerReason).toContain('Account equity depleted')
    })
```

---

## 5. Verification Method

1. **Independent Vitest Execution**:
   ```bash
   npx vitest run src/test/adversarial_challenger_m3.test.ts
   npx vitest run src/test/tier5_adversarial/challenger_m3_stress.test.ts
   pnpm test
   ```
   *Expected Outcome*: All test files pass with 0 failures (250+ tests passing).

2. **TypeScript & Build Verification**:
   ```bash
   pnpm build
   ```
   *Expected Outcome*: Clean exit code 0, no typing errors or unhandled promises.

3. **Linter Inspection**:
   ```bash
   pnpm lint
   ```
   *Expected Outcome*: Exit code 0, 0 errors.

4. **Negative/Zero Equity Boundary Verification**:
   - `checkCircuitBreaker(0, 4.5, 0)` -> `{ isTripped: true, reason: 'Account equity depleted: $0.00 <= 0...' }`
   - `checkCircuitBreaker(0, 4.5, -500)` -> `{ isTripped: true, reason: 'Account equity depleted: $-500.00 <= 0...' }`
   - `checkCircuitBreaker(4.49, 4.5, 10000)` -> `{ isTripped: false }`
   - `checkCircuitBreaker(4.50, 4.5, 10000)` -> `{ isTripped: true }`

5. **Price History Buffer Updating Verification**:
   - 200 ticks fed to `engine.handleMarketTick` without time advances -> buffer length reaches 100 and holds at 100 across all registered symbols.
   - Malformed tick with `midPrice: Infinity` or `NaN` -> buffer length unaffected, `Infinity` is never stored.
   - Untracked symbol (`DOGE/USDT`) -> `internalHistory.has('DOGE/USDT') === false`.
