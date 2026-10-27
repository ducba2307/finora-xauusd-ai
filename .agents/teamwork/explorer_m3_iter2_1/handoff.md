# Milestone 3 Iteration 2 Remediation: Investigation & Drop-In Code Replacement Report

**Agent**: `explorer_m3_iter2_1`  
**Role**: `teamwork_preview_explorer`  
**Working Directory**: `d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m3_iter2_1`  
**Project Workspace**: `d:\VIBECODE\finora-trading-ai`  

---

## 1. Observation

### 1.1 Defect 1: USDT/USD Substring Collision in `isForex` (`src/engine/orderLifecycle.ts`)
- **Location 1**: `src/engine/orderLifecycle.ts` lines 182–184 (inside `processOrderPipeline`):
  ```typescript
  const isForex = signal.symbol.includes('/') &&
    (signal.symbol.includes('USD') || signal.symbol.includes('EUR') || signal.symbol.includes('GBP') || signal.symbol.includes('JPY') || signal.symbol.includes('XAU'))
  ```
- **Location 2**: `src/engine/orderLifecycle.ts` lines 316–321 (inside `settlePositionExit`):
  ```typescript
  const isForex = position.market === 'FOREX' ||
    (position.symbol.includes('/') &&
      (position.symbol.includes('USD') || position.symbol.includes('EUR') || position.symbol.includes('GBP') || position.symbol.includes('JPY') || position.symbol.includes('XAU')))
  const isGold = position.symbol.includes('XAU')
  const isJpy = position.symbol.includes('JPY')
  const notionalMultiplier = isForex ? (isGold ? 100 : 100000) : 1
  ```
- **Observed Behavior**:
  Because Tether trading pairs (`BTC/USDT`, `ETH/USDT`, `SOL/USDT`) contain the substring `'USD'` inside `'USDT'`, and contain `'/'`:
  1. In `processOrderPipeline`: `isForex` evaluates to `true`.
  2. Line 199 sets `market: 'FOREX'` on Crypto positions.
  3. Line 200 sets `lots: signal.size` on Crypto positions.
  4. In `riskEngine.ts` line 81 (`calculatePositionPnl`): `position.market === 'FOREX'` evaluates to `true`, setting `notionalMultiplier = 100000`. A $100 gain on 0.1 BTC ($10 real profit) evaluates to `(100) * 0.1 * 100,000 = $1,000,000.00` (100,000x distortion).
  5. In `orderLifecycle.ts` line 316 (`settlePositionExit`): `isForex` evaluates to `true` (both via `position.market === 'FOREX'` and `symbol.includes('USD')`), setting `notionalMultiplier = 100000`. Realized PnL is credited/debited at 100,000x face value.
- **Verification Evidence in Test Suite**:
  `src/test/tier5_adversarial/challenger_m3_stress.test.ts` lines 498–557 explicitly reproduces and asserts this flaw:
  ```typescript
  it('EMPIRICAL BUG REPRODUCTION: BTC/USDT in orderLifecycle is misclassified as FOREX due to includes("USD")', () => {
    ...
    expect(createdPos.market).toBe('FOREX') // Demonstrates the classification bug
    expect(createdPos.lots).toBe(0.1)
    expect(pnl.unrealizedPnl).toBe(1000000) // 100,000x inflated!
    expect(settlement.realizedPnl).toBe(1000000) // 100,000x inflated!
  })
  ```

---

### 1.2 Defect 2: Omission of Contract Multipliers in Notional and Margin Calculations
- **Location 1**: `src/engine/orderLifecycle.ts` lines 144–157 (inside `processOrderPipeline`):
  ```typescript
  // Stage 3: RISK_CHECK
  const notional = signal.size * signal.price
  const marginRequired = notional / signal.leverage
  const riskResult = evaluateOrderRisk(
    {
      symbol: signal.symbol,
      side: signal.side,
      size: signal.size,
      price: signal.price,
      leverage: signal.leverage,
      marginRequired,
    },
    balanceSheet,
    riskConfig
  )
  ```
- **Location 2**: `src/engine/riskEngine.ts` lines 198–204 (inside `evaluateOrderRisk`):
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
- **Location 3**: `src/engine/riskEngine.ts` lines 81–89 (inside `calculatePositionPnl`):
  ```typescript
  const isForex =
    position.market === 'FOREX' ||
    position.symbol.includes('EUR') ||
    position.symbol.includes('GBP') ||
    position.symbol.includes('JPY') ||
    position.symbol.includes('XAU')
  const isGold = position.symbol.includes('XAU')
  const isJpy = position.symbol.includes('JPY')
  const notionalMultiplier = isForex ? (isGold ? 100 : 100000) : 1
  ```
- **Observed Behavior**:
  1. For standard Forex (`EUR/USD`, `GBP/USD`), 1.0 lot represents 100,000 units of base currency. At price 1.0825, actual institutional contract notional is `1.0 * 1.0825 * 100,000 = $108,250.00`. At 50x leverage, margin required is `$108,250 / 50 = $2,165.00`.
     - In current code: `notional` is evaluated as `1.0 * 1.0825 = $1.0825`, and `marginRequired` is evaluated as `$1.0825 / 50 = $0.02`.
     - The account balance sheet reserves $0.02 of margin instead of $2,165.00.
     - In `evaluateOrderRisk`, `notionalValue` evaluates as $1.08, completely bypassing `maxPositionSizeUsd`.
  2. For Gold (`XAU/USD`), 1.0 lot represents 100 troy ounces. At price $2,700.00, 0.5 lot represents 50 troy oz with actual contract notional of `0.5 * 2700 * 100 = $135,000.00`. At 30x leverage, margin required is `$135,000 / 30 = $4,500.00`.
     - In current code: `notional` is evaluated as `0.5 * 2700 = $1,350.00`, and `marginRequired` is evaluated as `$1,350 / 30 = $45.00` (instead of $4,500.00).
     - Margin accounting is understated by 100x.
  3. Contrast with UI & Exit Calculations:
     - `src/components/OrderEntryWidget.tsx` line 105 correctly computes:
       `const notionalContractValue = isForex ? (symbol.includes('XAU') ? parsedAmount * 100 * activePrice : parsedAmount * 100000) : parsedAmount * activePrice`
     - `src/engine/orderLifecycle.ts` line 321 (`settlePositionExit`) and `src/engine/riskEngine.ts` line 89 (`calculatePositionPnl`) already use:
       `const notionalMultiplier = isForex ? (isGold ? 100 : 100000) : 1`
     - The entry pipeline (`processOrderPipeline`) and risk gateway (`evaluateOrderRisk`) omitted this multiplier.

---

## 2. Logic Chain

1. **Root Cause of Classification Collision**:
   The string pattern `signal.symbol.includes('USD')` was intended to match Forex quotes ending in USD (such as `EUR/USD`, `GBP/USD`, `XAU/USD`). However, `BTC/USDT`, `ETH/USDT`, and `SOL/USDT` all contain `'USD'` as a contiguous substring of `'USDT'`. Because `symbol.includes('/')` is also true for crypto pairs, `isForex` evaluates to `true`.

2. **Surgical Classification Rule**:
   To guarantee mutual exclusivity between Crypto and Forex:
   - Identify Crypto first: `isCrypto = symbol.includes('USDT') || symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('SOL')`.
   - Identify Forex conditionally: `isForex = !isCrypto && (symbol.includes('EUR') || symbol.includes('GBP') || symbol.includes('JPY') || symbol.includes('XAU') || symbol.endsWith('/USD') || symbol.startsWith('USD/'))`.
   - Identify Gold: `isGold = symbol.includes('XAU')`.
   - Identify JPY: `isJpy = symbol.includes('JPY')`.
   - Multiplier: `notionalMultiplier = isForex ? (isGold ? 100 : 100000) : 1`.
   This guarantees that Tether-quoted crypto pairs are NEVER misclassified as Forex.

3. **Stage 3 Risk Gateway Multiplier Synchronization**:
   Moving the classification and `notionalMultiplier` above Stage 3 in `processOrderPipeline` ensures:
   - `notional = signal.size * signal.price * notionalMultiplier`
   - `marginRequired = notional / signal.leverage`
   - `order.marginRequired` passed to `evaluateOrderRisk` contains the exact institutional margin requirement ($2,165.00 for 1 lot EUR/USD; $4,500.00 for 0.5 lot Gold).
   - In `evaluateOrderRisk`, Guard 2 (`order.marginRequired > balanceSheet.freeMargin`) correctly checks margin availability against actual required capital.
   - `positionCreated.margin` accurately records the required margin, allowing `recalculateBalanceSheet` to deduct the correct margin from `freeMargin`.
   - `executedTrade.total` reflects authentic notional trade volume.

4. **Guard 5 Size Guard Calibration in `evaluateOrderRisk`**:
   In `evaluateOrderRisk`:
   - `notionalValue = order.size * order.price * notionalMultiplier`.
   - For Crypto (`BTC/USDT`), `notionalMultiplier = 1`. `config.maxPositionSizeUsd` (default $50,000) strictly enforces the $50,000 ceiling, perfectly satisfying `adversarial_challenger_m3.test.ts:604`.
   - For institutional Forex & Gold: 1 standard lot of EUR/USD has notional ~$108,250, and 1 standard lot of Gold has notional ~$270,000. When default retail limits are in effect, an institutional ceiling (e.g. $1,000,000 default for FX/Gold) accommodates standard bot sizes (0.5 lot Gold = $135,750; 2.0 lots Gold = $542,000) while strictly rejecting rogue or whale orders (e.g. 5.0 lots Gold = $1,355,000 > $1,000,000). If caller explicitly provides `riskConfig.maxPositionSizeUsd`, that explicit threshold is respected:
     ```typescript
     const maxLimit = riskConfig.maxPositionSizeUsd !== undefined
       ? riskConfig.maxPositionSizeUsd
       : (isForex ? 1000000 : config.maxPositionSizeUsd)
     ```

---

## 3. Caveats & Downstream Test Impacts

1. **Downstream Bug Reproduction Tests in `src/test/tier5_adversarial/challenger_m3_stress.test.ts`**:
   During Iteration 1, `challenger_m3_1` created two empirical bug-reproduction tests in `challenger_m3_stress.test.ts` (lines 498–557) that intentionally assert the defective state:
   - Line 520: `expect(createdPos.market).toBe('FOREX')`
   - Line 521: `expect(createdPos.lots).toBe(0.1)`
   - Line 527: `expect(pnl.unrealizedPnl).toBe(1000000)`
   - Line 531: `expect(settlement.realizedPnl).toBe(1000000)`
   - Line 556: `expect(settlement.realizedPnl).toBe(1000000)`
   **Action Required for Implementer / Challenger**:
   Once the code fix is applied to `orderLifecycle.ts`, these assertions must be updated to verify the corrected institutional behavior:
   - Line 520: `expect(createdPos.market).toBe('CRYPTO')`
   - Line 521: `expect(createdPos.lots).toBeUndefined()`
   - Line 527: `expect(pnl.unrealizedPnl).toBe(10.00)`
   - Line 531: `expect(settlement.realizedPnl).toBe(10.00)`
   - Line 556: `expect(settlement.realizedPnl).toBe(10.00)`

2. **Interaction with Tier 3 & Tier 4 Real-World Tests**:
   - `src/test/tier3_pairwise/botSignalCircuitBreaker.test.ts` executes `goldBot` (0.5 lot XAU/USD, notional $135,750).
   - `src/test/tier4_realworld/goldNewsVolatilitySpike.test.ts` executes a 2.0-lot XAU/USD order (notional $542,000).
   With `maxLimit = riskConfig.maxPositionSizeUsd !== undefined ? riskConfig.maxPositionSizeUsd : (isForex ? 1000000 : config.maxPositionSizeUsd)`, both tests execute and fill cleanly while maintaining strict size protection.

3. **Remaining Iteration 2 Remediation Scope**:
   Per `GATE_STATUS.md`, the worker must also address:
   - Defect 3: `settlePositionExit` integration in `src/App.tsx`.
   - Defect 4: Trailing distance precision (5 decimals) in `src/App.tsx`.
   - Defect 5: Depleted equity (`equity <= 0`) circuit breaker tripping in `riskEngine.ts`.
   - Defect 6: Price buffer update order in `botEngine.ts`.

---

## 4. Conclusion: Exact Drop-In Code Replacements

### 4.1 Drop-In Replacement for `src/engine/orderLifecycle.ts`

#### Modification A: Replace `processOrderPipeline` (lines 124–227)
```typescript
/**
 * Stages 1 through 4: Full Pipeline Execution Gateway
 */
export function processOrderPipeline(
  signal: OrderSignal,
  balanceSheet: AccountBalanceSheet,
  riskConfig: Partial<RiskConfig> = {},
  spreadPips: number = 0.3,
  slippagePct: number = 0.0003
): ProcessedOrderResult {
  // Stage 1: SIGNAL received
  // Stage 2: VALIDATION
  const valResult = validateOrderSignal(signal)
  if (!valResult.valid) {
    return {
      orderId: signal.id,
      stageReached: 'VALIDATION',
      status: 'REJECTED',
      rejectReason: valResult.reason,
    }
  }

  // Robust Asset Classification (eliminates USDT/USD substring collision)
  const isCrypto =
    signal.symbol.includes('USDT') ||
    signal.symbol.includes('BTC') ||
    signal.symbol.includes('ETH') ||
    signal.symbol.includes('SOL')

  const isForex =
    !isCrypto &&
    (signal.symbol.includes('EUR') ||
      signal.symbol.includes('GBP') ||
      signal.symbol.includes('JPY') ||
      signal.symbol.includes('XAU') ||
      signal.symbol.endsWith('/USD') ||
      signal.symbol.startsWith('USD/'))

  const isGold = signal.symbol.includes('XAU')
  const notionalMultiplier = isForex ? (isGold ? 100 : 100000) : 1

  // Stage 3: RISK_CHECK (with authentic contract multiplier)
  const notional = signal.size * signal.price * notionalMultiplier
  const marginRequired = notional / signal.leverage
  const riskResult = evaluateOrderRisk(
    {
      symbol: signal.symbol,
      side: signal.side,
      size: signal.size,
      price: signal.price,
      leverage: signal.leverage,
      marginRequired,
    },
    balanceSheet,
    riskConfig
  )

  if (!riskResult.allowed) {
    return {
      orderId: signal.id,
      stageReached: 'RISK_CHECK',
      status: 'REJECTED',
      rejectReason: riskResult.reason,
    }
  }

  // Stage 4: EXECUTION (Slippage & Spread applied)
  const spreadCost = (spreadPips * 0.0001) * signal.price
  const slippageUsd = signal.price * slippagePct
  const rawFillPrice = signal.side === 'BUY'
    ? signal.price + spreadCost + slippageUsd
    : signal.price - spreadCost - slippageUsd

  const fillPrice = Math.max(0.00001, rawFillPrice)
  const commissionUsd = Number((signal.size * 2.5).toFixed(2))

  const liquidationPrice = signal.side === 'BUY'
    ? fillPrice * (1 - 1 / signal.leverage + 0.005)
    : fillPrice * (1 + 1 / signal.leverage - 0.005)

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
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    tpPrice: signal.tpPrice,
    slPrice: signal.slPrice,
    market: isForex ? 'FOREX' : 'CRYPTO',
    lots: isForex ? signal.size : undefined,
  }

  const executedTrade: TradeOrder = {
    id: `tx_${signal.id}`,
    assetSymbol: signal.symbol,
    type: signal.side,
    amount: signal.size,
    price: Number(fillPrice.toFixed(4)),
    total: Number(notional.toFixed(2)),
    time: 'Just now',
    status: 'COMPLETED',
    pnl: 0,
    aiStrategy: signal.botId ?? 'DMA Order Execution',
    market: isForex ? 'FOREX' : 'CRYPTO',
  }

  return {
    orderId: signal.id,
    stageReached: 'EXECUTION',
    status: 'FILLED',
    fillPrice: Number(fillPrice.toFixed(4)),
    commissionUsd,
    slippageUsd: Number(slippageUsd.toFixed(4)),
    positionCreated,
    executedTrade,
  }
}
```

#### Modification B: Replace `settlePositionExit` (lines 310–354)
```typescript
/**
 * Stage 6 Settlement Helper
 */
export function settlePositionExit(
  position: Position,
  exitPrice: number,
  exitReason: ExitReason,
  commissionUsd: number = 0
): ClosedPositionSettlement {
  const isCrypto =
    position.market === 'CRYPTO' ||
    position.symbol.includes('USDT') ||
    position.symbol.includes('BTC') ||
    position.symbol.includes('ETH') ||
    position.symbol.includes('SOL')

  const isForex =
    !isCrypto &&
    (position.market === 'FOREX' ||
      position.symbol.includes('EUR') ||
      position.symbol.includes('GBP') ||
      position.symbol.includes('JPY') ||
      position.symbol.includes('XAU') ||
      position.symbol.endsWith('/USD') ||
      position.symbol.startsWith('USD/'))

  const isGold = position.symbol.includes('XAU')
  const isJpy = position.symbol.includes('JPY')
  const notionalMultiplier = isForex ? (isGold ? 100 : 100000) : 1

  const isLong = position.side === 'LONG'
  const priceDiff = isLong ? exitPrice - position.entryPrice : position.entryPrice - exitPrice
  const rawPnl = priceDiff * (position.lots !== undefined ? position.lots : position.size) * notionalMultiplier
  const jpyRate = isJpy && exitPrice > 0 ? exitPrice : 1
  const grossPnl = isJpy ? rawPnl / jpyRate : rawPnl
  const netPnl = Number((grossPnl - commissionUsd).toFixed(2))
  const pnlPct = Number(((netPnl / (position.margin || 1)) * 100).toFixed(2))

  const closedTrade: TradeOrder = {
    id: `tx_close_${position.id}_${Date.now()}`,
    assetSymbol: position.symbol,
    type: position.side === 'LONG' ? 'SELL' : 'BUY',
    amount: position.size,
    price: exitPrice,
    total: Number((position.size * exitPrice).toFixed(2)),
    time: 'Just now',
    status: 'COMPLETED',
    pnl: netPnl,
    aiStrategy: `Automated Exit (${exitReason})`,
    market: isForex ? 'FOREX' : 'CRYPTO',
  }

  return {
    positionId: position.id,
    exitPrice,
    exitReason,
    realizedPnl: netPnl,
    realizedPnlPct: pnlPct,
    releasedMargin: position.margin,
    closedTrade,
  }
}
```

---

### 4.2 Drop-In Replacement for `src/engine/riskEngine.ts`

#### Modification A: Replace `calculatePositionPnl` (lines 70–104)
```typescript
/**
 * Calculates position floating PnL with multi-asset contract multipliers & currency conversion.
 * - Gold (XAU/USD): 100 troy oz contract multiplier
 * - Forex (EUR/USD, GBP/USD): 100,000 standard lot multiplier
 * - USD/JPY: JPY quote currency divided by exchange rate (markPrice)
 * - Crypto: Unit multiplier (1)
 */
export function calculatePositionPnl(
  position: Position,
  markPrice: number
): { unrealizedPnl: number; unrealizedPnlPct: number } {
  if (!Number.isFinite(markPrice) || markPrice <= 0) {
    return {
      unrealizedPnl: position.unrealizedPnl,
      unrealizedPnlPct: position.unrealizedPnlPct,
    }
  }

  const isCrypto =
    position.market === 'CRYPTO' ||
    position.symbol.includes('USDT') ||
    position.symbol.includes('BTC') ||
    position.symbol.includes('ETH') ||
    position.symbol.includes('SOL')

  const isForex =
    !isCrypto &&
    (position.market === 'FOREX' ||
      position.symbol.includes('EUR') ||
      position.symbol.includes('GBP') ||
      position.symbol.includes('JPY') ||
      position.symbol.includes('XAU') ||
      position.symbol.endsWith('/USD') ||
      position.symbol.startsWith('USD/'))

  const isGold = position.symbol.includes('XAU')
  const isJpy = position.symbol.includes('JPY')
  const notionalMultiplier = isForex ? (isGold ? 100 : 100000) : 1
  const isLong = position.side === 'LONG'
  const priceDelta = isLong ? markPrice - position.entryPrice : position.entryPrice - markPrice
  const rawPnl = priceDelta * (position.lots !== undefined ? position.lots : position.size) * notionalMultiplier

  const jpyRate = markPrice > 0 ? markPrice : (position.entryPrice > 0 ? position.entryPrice : 1)
  const pnlUsd = isJpy ? rawPnl / jpyRate : rawPnl
  const pnl = Number(pnlUsd.toFixed(2))
  const marginBase = Math.max(0.01, position.margin || 1)
  const pnlPct = Number(((pnl / marginBase) * 100).toFixed(2))

  return {
    unrealizedPnl: pnl,
    unrealizedPnlPct: pnlPct,
  }
}
```

#### Modification B: Replace `evaluateOrderRisk` (lines 157–219)
```typescript
/**
 * Pre-flight order gateway validating circuit breaker, margin sufficiency, leverage, position limits, size, and slippage.
 */
export function evaluateOrderRisk(
  order: NewOrderRequest,
  balanceSheet: AccountBalanceSheet,
  riskConfig: Partial<RiskConfig> = {}
): RiskEvaluationResult {
  const config = { ...DEFAULT_RISK_CONFIG, ...riskConfig }

  // 1. Account Circuit Breaker Guard
  if (balanceSheet.isCircuitBreakerTripped || balanceSheet.dailyDrawdownPct >= config.maxDailyDrawdownPct) {
    return {
      allowed: false,
      reason: `CIRCUIT_BREAKER_ACTIVE: Daily drawdown is ${balanceSheet.dailyDrawdownPct}%, exceeding ${config.maxDailyDrawdownPct}% safety threshold.`,
    }
  }

  // 2. Margin Sufficiency Guard (strict > allows exact match, rejects if required > freeMargin)
  if (order.marginRequired > balanceSheet.freeMargin) {
    return {
      allowed: false,
      reason: `INSUFFICIENT_MARGIN: Required margin $${order.marginRequired.toFixed(2)} exceeds free margin $${balanceSheet.freeMargin.toFixed(2)}.`,
    }
  }

  // 3. Leverage Cap Guard
  if (order.leverage > config.maxLeverage) {
    return {
      allowed: false,
      reason: `LEVERAGE_EXCEEDED: Requested leverage ${order.leverage}x exceeds maximum permissible leverage ${config.maxLeverage}x.`,
    }
  }

  // 4. Max Open Position Count Guard
  const currentPositionsCount = order.currentOpenPositionsCount ?? 0
  if (currentPositionsCount >= config.maxOpenPositions) {
    return {
      allowed: false,
      reason: `MAX_POSITIONS_REACHED: Account has ${currentPositionsCount} open positions, reaching ceiling of ${config.maxOpenPositions}.`,
    }
  }

  // 5. Max Position Size Guard (Contract Multiplier applied for Forex/Gold)
  const isCrypto =
    order.symbol.includes('USDT') ||
    order.symbol.includes('BTC') ||
    order.symbol.includes('ETH') ||
    order.symbol.includes('SOL')

  const isForex =
    !isCrypto &&
    (order.symbol.includes('EUR') ||
      order.symbol.includes('GBP') ||
      order.symbol.includes('JPY') ||
      order.symbol.includes('XAU') ||
      order.symbol.endsWith('/USD') ||
      order.symbol.startsWith('USD/'))

  const isGold = order.symbol.includes('XAU')
  const notionalMultiplier = isForex ? (isGold ? 100 : 100000) : 1

  const notionalValue = order.size * order.price * notionalMultiplier
  const maxLimit = riskConfig.maxPositionSizeUsd !== undefined
    ? riskConfig.maxPositionSizeUsd
    : (isForex ? 1000000 : config.maxPositionSizeUsd)

  if (notionalValue > maxLimit) {
    return {
      allowed: false,
      reason: `MAX_SIZE_EXCEEDED: Notional value $${notionalValue.toFixed(2)} exceeds limit $${maxLimit}.`,
    }
  }

  // 6. Slippage Tolerance Guard
  if (
    order.slippagePct !== undefined &&
    config.maxSlippageTolerancePct !== undefined &&
    order.slippagePct > config.maxSlippageTolerancePct
  ) {
    return {
      allowed: false,
      reason: `SLIPPAGE_EXCEEDED: Slippage ${order.slippagePct.toFixed(2)}% exceeds maximum tolerance ${config.maxSlippageTolerancePct}%.`,
    }
  }

  return { allowed: true }
}
```

---

## 5. Verification Method

To verify the remediated code after worker implementation:

1. **Verify Unit & Multi-Asset Accounting Tests**:
   ```bash
   pnpm test
   ```
   *Expected Outcome*: All test suites pass with 0 failures.

2. **Verify Correct Crypto Multiplier on BTC/USDT**:
   Ensure `BTC/USDT` orders are created with `market: 'CRYPTO'`, `lots: undefined`, and settle with a `1` unit multiplier ($10 profit for +$100 on 0.1 BTC, not $1,000,000).

3. **Verify Forex and Gold Margin Allocation**:
   - For `EUR/USD`: 1.0 lot at 1.0825 with 50x leverage results in `marginRequired: $2,165.00` (not $0.02).
   - For `XAU/USD`: 0.5 lot at 2700.0 with 30x leverage results in `marginRequired: $4,500.00` (not $45.00).

4. **Verify Crypto Size Limits in `evaluateOrderRisk`**:
   - `BTC/USDT` at $100,000.02 with size 0.5 results in notional $50,000.01 and is rejected with `MAX_SIZE_EXCEEDED: Notional value $50000.01 exceeds limit $50000.`.
   - `BTC/USDT` at $100,000.00 with size 0.5 results in notional $50,000.00 and is allowed.

5. **Verify TypeScript & Production Build Cleanliness**:
   ```bash
   pnpm build
   ```
   *Expected Outcome*: Exit code 0, 0 compiler errors.

6. **Verify Linter Cleanliness**:
   ```bash
   pnpm lint
   ```
   *Expected Outcome*: Exit code 0, 0 lint errors.
