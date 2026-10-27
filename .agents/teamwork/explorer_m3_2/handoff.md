# Architectural Investigation & Specification Report: Feature F11 (6-Stage Order Lifecycle Pipeline)

**Target**: Finora Quant AI Trading Platform (Forex, Gold, Crypto)  
**Feature**: F11 — 6-Stage Order Lifecycle Pipeline (`src/engine/orderLifecycle.ts`)  
**Requirement**: R3 (Autonomous AI Trading Bots & Risk Management Safeguards)  
**Milestone**: Milestone 3 (R3)  
**Investigator**: Explorer M3-2 (`teamwork_preview_explorer`)  
**Timestamp**: 2026-10-11T16:20:00Z  
**Working Directory**: `d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m3_2`  

---

## 1. Observation

### 1.1 Existing Contract & Test Fallback Mechanism
- **File**: `vitest.config.ts` (lines 8–35)
  ```typescript
  const contractFallbackPlugin = () => ({
    name: 'contract-fallback',
    resolveId(id: string) {
      ...
      if (!existsInSrc) {
        // Fall back to src/test/contracts/
        for (const ext of extensions) {
          const p = path.resolve(__dirname, 'src/test/contracts', relPath + ext)
          if (fs.existsSync(p) && fs.statSync(p).isFile()) {
            return p
          }
        }
      }
    }
  })
  ```
  *Direct Observation*: Vitest resolves imports like `import ... from '@/engine/orderLifecycle'` to `src/test/contracts/engine/orderLifecycle.ts` because `src/engine/orderLifecycle.ts` does not yet exist. Once `src/engine/orderLifecycle.ts` is implemented, tests immediately bind to the production implementation.
- **Test Baseline**: Running `pnpm test -- --run` passes **191/191 tests across 25 files in 912ms** with exit code 0.

### 1.2 Inspection of Existing Contract `src/test/contracts/engine/orderLifecycle.ts`
- **File**: `src/test/contracts/engine/orderLifecycle.ts` (lines 9–33, 35–57, 59–141, 147–177, 182–223)
  - Exports:
    - `type OrderStage = 'SIGNAL' | 'VALIDATION' | 'RISK_CHECK' | 'EXECUTION' | 'TRAILING' | 'EXIT'`
    - `interface OrderSignal { id, symbol, side, size, price, leverage, slPrice?, tpPrice?, trailingDistance?, botId? }`
    - `interface ProcessedOrderResult { orderId, stageReached, status, fillPrice?, commissionUsd?, slippageUsd?, rejectReason?, positionCreated? }`
    - `validateOrderSignal(signal: OrderSignal): { valid: boolean; reason?: string }`
    - `processOrderPipeline(signal, balanceSheet, riskConfig?, spreadPips?, slippagePct?): ProcessedOrderResult`
    - `updateTrailingStop(position, currentMarkPrice, trailDistance, activationDistance?): { updatedSlPrice: number; wasRatchetUpdated: boolean }`
    - `checkPositionExitTriggers(position, currentMarkPrice): { shouldExit: boolean; exitReason?: 'TP_HIT' | 'SL_HIT' | 'LIQUIDATION_TRIGGERED'; exitPrice: number }`

### 1.3 Inspection of `src/types/trading.ts`
- **Lines 53–84**:
  - `TradeOrder`: has `id`, `assetSymbol`, `type: 'BUY' | 'SELL'`, `amount`, `price`, `total`, `time`, `status: 'COMPLETED' | 'PENDING' | 'AI_TRIGGERED'`, `pnl?`, `aiStrategy?`, `market?`.
  - `Position`: has `id`, `symbol`, `side: 'LONG' | 'SHORT'`, `size`, `entryPrice`, `markPrice`, `liquidationPrice`, `leverage`, `margin`, `unrealizedPnl`, `unrealizedPnlPct`, `tpPrice?`, `slPrice?`, `market?`, `lots?`, `pips?`.
  - *Observation*: `Position` currently lacks trailing state fields: `trailingDistance?`, `peakPrice?`, and `trailingActive?`.

### 1.4 Inspection of `src/components/OrderEntryWidget.tsx`
- **Lines 38, 138–196**:
  - Contains `'AI_TRAILING'` in `orderType` button group (lines 38, 253), but had no actual trailing algorithm connected.
  - In `handleSubmitOrder()`:
    ```typescript
    if (parsedAmount <= 0) return
    setIsSubmitting(true)
    ...
    onOrderPlaced(newPos)
    ```
  - *Critical Gaps Observed*:
    1. Only validates `parsedAmount <= 0`.
    2. Allows non-positive or NaN `currentPrice`.
    3. Allows inverted SL/TP geometry (e.g. Long order with SL > entry price, or TP < entry price).
    4. Performs zero risk checks: ignores daily circuit breaker, free margin limits, position count limits, and leverage caps.
    5. Directly constructs `Position` inside `setTimeout` without passing through the 6-stage lifecycle pipeline.

### 1.5 Inspection of `src/components/PositionsTable.tsx`
- **Lines 47–114**:
  - Iterates over `positions`, displays `pos.side`, `pos.symbol`, `pos.size`, `pos.entryPrice`, `pos.markPrice`, `pos.liquidationPrice`, `pos.margin`, `pos.unrealizedPnl`, `pos.unrealizedPnlPct`.
  - "Market Close" button calls `onClosePosition(pos.id)`.
  - *Observation*: Table only reacts to manual user closes; does not display trailing stop state or automated exit notifications.

### 1.6 Inspection of `src/components/TradingViewChart.tsx`
- **Lines 88–138**:
  - Renders visual horizontal price lines:
    1. Entry Line (Cyan solid) at `pos.entryPrice`
    2. Take Profit Line (Emerald dashed) at `pos.tpPrice`
    3. Stop Loss Line (Rose dashed) at `pos.slPrice`
    4. Liquidation Line (Amber dotted) at `pos.liquidationPrice`
  - *Direct Observation*: Chart re-evaluates `positionPriceLinesRef` on `[activePositions, symbol]`. When `pos.slPrice` is updated by the Trailing Stop ratchet in state, the chart automatically re-renders the Rose dashed line at the new ratcheted level.

### 1.7 Inspection of `src/stores/marketStore.ts` & `src/App.tsx`
- **File**: `src/stores/marketStore.ts` (lines 228–273):
  - `calculateExecutionFill(symbol, side, lotOrSize)` implements institutional square-root slippage with a 50% max cap and minimum positive price tick clamp.
- **File**: `src/App.tsx` (lines 71–117):
  - Subscribes to `defaultMarketStore.subscribeAll((tickers) => ...)` to update `markPrice`, `unrealizedPnl`, `unrealizedPnlPct` on incoming ticks.
  - *Critical Gap Observed*: The tick subscription handler in `App.tsx` **only updates floating PnL**. It **never calls** `updateTrailingStop` or `checkPositionExitTriggers`. When price crosses `tpPrice`, `slPrice`, or `liquidationPrice`, **nothing exits**.

### 1.8 Inspection of `src/utils/soundEffects.ts`
- **Lines 40–129**:
  - `playOrderFilledSound()`: Web Audio dual-tone chime (880Hz -> 1320Hz).
  - `playTakeProfitSound()`: Web Audio triad arpeggio (C6, E6, G6).
  - `playStopLossSound()`: Web Audio low-pass damped tone (260Hz -> 140Hz).
  - All synthesize audio natively with zero asset dependencies and respect `getSoundEnabled()`.

---

## 2. Logic Chain

```
[Observation 1.4: OrderEntryWidget Lacks Risk & Validation Checks]
  │
  ├─> Orders bypass price sanity, SL/TP geometry, and risk checks
  ├─> Orders can open when account Daily Drawdown >= 4.5% (Circuit Breaker ignored)
  └─> Conclusion: Manual order entry must pass through Stages 1, 2, and 3 of orderLifecycle.

[Observation 1.2 & 1.7: Automated Exits & Trailing Stops Never Execute on Ticks]
  │
  ├─> Positions in App.tsx update markPrice on ticks, but never evaluate exit conditions
  ├─> Positions remain open indefinitely even if price drops below liquidation price or hits TP/SL
  ├─> AI_TRAILING toggle in OrderEntryWidget does not ratchet stops
  └─> Conclusion: Stage 5 (Trailing Stop Manager) and Stage 6 (Exit Monitor) must run on every tick.

[Observation 1.1 & 1.2: Test Harness Contract Requirements]
  │
  ├─> 9 distinct test files (Tiers 1, 2, 3, 4) verify orderLifecycle behavior
  ├─> Tests expect exact function signatures: validateOrderSignal, processOrderPipeline,
  │   updateTrailingStop, checkPositionExitTriggers
  ├─> Tests verify edge cases: SL >= Entry for Longs, zero/negative prices, leverage > 100x,
  │   liquidation precedence over SL on flash drops, trailing high-water mark ratchet lock
  └─> Conclusion: src/engine/orderLifecycle.ts must fulfill all contract functions and edge cases.

[Observation 1.6 & 1.8: UI & Audio Feedback Already Exist]
  │
  ├─> TradingViewChart already draws SL/TP lines dynamically from pos.slPrice and pos.tpPrice
  ├─> soundEffects.ts already has tactile Web Audio generators for order fill, TP, SL
  └─> Conclusion: Pipeline execution and exit triggers can immediately trigger visual updates
      and auditory feedback without additional asset dependencies.
```

---

## 3. Caveats

1. **Forex vs. Crypto Contract Sizing in Margin & PnL**:
   - In `orderLifecycle.ts`, margin required is modeled uniformly as `(size * price) / leverage` for consistency with unit tests (`orderLifecycle.test.ts:63` and `orderMarginSlippage.test.ts:20`).
   - In `App.tsx`, live floating PnL calculation distinguishes Forex notional multipliers (100 for XAU/USD, 100,000 for EUR/USD/GBP/USD, and JPY quote division). Realized PnL at Stage 6 must apply these same asset-specific multipliers when closing positions in `App.tsx`.
2. **Asynchronous Slippage Execution vs. Deterministic Pipeline**:
   - `processOrderPipeline` accepts optional `spreadPips` and `slippagePct` parameters for deterministic unit/backtest execution, with defaults matching institutional market conditions (0.3 pips spread, 3 bps slippage). When called in the live UI, it can directly utilize `defaultMarketStore.calculateExecutionFill()`.
3. **High-Frequency Tick Batching**:
   - If market ticks arrive at high frequency (e.g. 50 ticks/second), running Stage 5 and Stage 6 synchronously inside React's `setPositions` must be lightweight O(N) where N = number of open positions (bounded by max 10 positions). The ratchet and exit trigger algorithms are pure arithmetic and execute in microseconds.

---

## 4. Conclusion & Complete Technical Specification

### 4.1 State Machine Specification

The Order Lifecycle Pipeline consists of 6 sequential stages:

```
[Trigger: Manual Trader / Autonomous AI Bot / AI Swarm]
                          │
                          ▼
            +───────────────────────────+
            │      Stage 1: SIGNAL      │
            +───────────────────────────+
                          │
                          ▼
            +───────────────────────────+
            │    Stage 2: VALIDATION    │
            +───────────────────────────+
                 │                 │
              [Valid]          [Invalid]
                 │                 └───────► REJECT: INVALID_METADATA / INVALID_PRICE /
                 ▼                           INVALID_SIZE / INVALID_LEVERAGE / INVALID_SL / INVALID_TP
            +───────────────────────────+
            │    Stage 3: RISK CHECK    │
            +───────────────────────────+
                 │                 │
              [Passed]          [Blocked]
                 │                 └───────► REJECT: CIRCUIT_BREAKER_ACTIVE / INSUFFICIENT_MARGIN /
                 ▼                           LEVERAGE_EXCEEDED / MAX_POSITIONS_REACHED / MAX_SIZE_EXCEEDED
            +───────────────────────────+
            │    Stage 4: EXECUTION     │
            +───────────────────────────+
                 │
                 ├─► Calculate Fill Price (Spread + Slippage via marketStore)
                 ├─► Calculate Liquidation Price: Fill * (1 ± 1/Leverage ∓ 0.005)
                 ├─► Create DMA Position
                 ├─► Reserve Margin on Balance Sheet
                 ├─► Log TradeOrder to History
                 └─► Play Tactile Order Filled Chime (880Hz -> 1320Hz)
                          │
                          ▼
             Position Open & Active in State
                          │
           ┌──────────────┴──────────────┐
           │   On Every Market Tick      │
           ▼                             ▼
+───────────────────────────+  +───────────────────────────+
│ Stage 5: TRAILING STOP    │  │   Stage 6: EXIT MONITOR   │
│ - High-Water Mark Peak    │  │ - Priority 1: Liquidation │
│ - Activation Dist Gate    │  │ - Priority 2: Stop Loss   │
│ - Ratchet SL Favorably    │  │ - Priority 3: Take Profit │
│ - Never Regress Backward  │  +───────────────────────────+
+───────────────────────────+                │
                                      [Trigger Hit]
                                             │
                                             ▼
                               +───────────────────────────+
                               │     POSITION CLOSED       │
                               │ - Realize Cash PnL        │
                               │ - Release Margin          │
                               │ - Record Completed Trade  │
                               │ - Append Journal Entry    │
                               │ - Play Audio (TP / SL)    │
                               +───────────────────────────+
```

---

### 4.2 Data Structures Specification

```typescript
// Location: src/engine/orderLifecycle.ts

import type { Position, TradeOrder, MarketCategory } from '@/types/trading'
import type { AccountBalanceSheet, RiskConfig } from '@/engine/riskEngine'

export type OrderStage = 'SIGNAL' | 'VALIDATION' | 'RISK_CHECK' | 'EXECUTION' | 'TRAILING' | 'EXIT'

export type OrderStatus = 'SUBMITTED' | 'REJECTED' | 'FILLED'

export type ExitReason = 'TP_HIT' | 'SL_HIT' | 'LIQUIDATION_TRIGGERED' | 'MANUAL_CLOSE'

export interface OrderSignal {
  id: string
  symbol: string
  side: 'BUY' | 'SELL'
  size: number
  price: number
  leverage: number
  slPrice?: number
  tpPrice?: number
  trailingDistance?: number
  trailingActivationDistance?: number
  botId?: string
  source?: 'BOT' | 'MANUAL' | 'AI_SWARM'
  orderType?: 'MARKET' | 'LIMIT' | 'AI_TRAILING' | 'TWAP' | 'ICEBERG'
  timestamp?: number
}

export interface ProcessedOrderResult {
  orderId: string
  stageReached: OrderStage
  status: OrderStatus
  fillPrice?: number
  commissionUsd?: number
  slippageUsd?: number
  rejectReason?: string
  positionCreated?: Position
  executedTrade?: TradeOrder
}

export interface TrailingStopResult {
  updatedSlPrice: number
  wasRatchetUpdated: boolean
}

export interface PositionExitResult {
  shouldExit: boolean
  exitReason?: ExitReason
  exitPrice: number
}

export interface ClosedPositionSettlement {
  positionId: string
  exitPrice: number
  exitReason: ExitReason
  realizedPnl: number
  realizedPnlPct: number
  releasedMargin: number
  closedTrade: TradeOrder
}
```

---

### 4.3 Detailed Stage-by-Stage Implementation Design

#### Stage 1: Signal Generation
- Originates from:
  1. `evaluateBotStrategy` in `src/engine/botEngine.ts` (autonomous bots)
  2. `handleSubmitOrder` in `src/components/OrderEntryWidget.tsx` (manual UI execution)
  3. `presetSetup` from `AISwarmConsensusWidget.tsx`
- Produces normalized `OrderSignal`.

#### Stage 2: Order Validation (`validateOrderSignal`)
Rules enforced:
1. **Metadata Integrity**: `signal.id` and `signal.symbol` must be non-empty strings.
2. **Size Sanity**: `Number.isFinite(signal.size)` and `signal.size > 0`.
3. **Price Sanity**: `Number.isFinite(signal.price)` and `signal.price > 0`.
4. **Leverage Sanity**: `Number.isFinite(signal.leverage)` and `signal.leverage >= 1`.
5. **Stop Loss Geometry**:
   - Long (`side === 'BUY'`): if `slPrice` defined, `slPrice < price`. Rejection reason: `'INVALID_SL: Long stop-loss must be strictly below entry price'`.
   - Short (`side === 'SELL'`): if `slPrice` defined, `slPrice > price`. Rejection reason: `'INVALID_SL: Short stop-loss must be strictly above entry price'`.
6. **Take Profit Geometry**:
   - Long (`side === 'BUY'`): if `tpPrice` defined, `tpPrice > price`. Rejection reason: `'INVALID_TP: Long take-profit must be strictly above entry price'`.
   - Short (`side === 'SELL'`): if `tpPrice` defined, `tpPrice < price`. Rejection reason: `'INVALID_TP: Short take-profit must be strictly below entry price'`.
7. **Trailing Distance Sanity**:
   - If `trailingDistance !== undefined`, must be strictly positive (`trailingDistance > 0`).

#### Stage 3: Risk Check Gateway (`evaluateOrderRisk`)
Integrates with `src/engine/riskEngine.ts`:
- Computes `notional = signal.size * signal.price`.
- Computes `marginRequired = notional / signal.leverage`.
- Calls `evaluateOrderRisk({ symbol, side, size, price, leverage, marginRequired, currentOpenPositionsCount }, balanceSheet, riskConfig)`.
- If blocked, returns `{ orderId: signal.id, stageReached: 'RISK_CHECK', status: 'REJECTED', rejectReason: riskResult.reason }`.
- Block conditions:
  1. Circuit breaker tripped (`balanceSheet.isCircuitBreakerTripped || dailyDrawdownPct >= 4.5%`) -> `'CIRCUIT_BREAKER_ACTIVE'`
  2. Margin shortfall (`marginRequired > balanceSheet.freeMargin`) -> `'INSUFFICIENT_MARGIN'`
  3. Leverage cap exceeded (`leverage > maxLeverage (100)`) -> `'LEVERAGE_EXCEEDED'`
  4. Max positions reached (`openCount >= maxOpenPositions (10)`) -> `'MAX_POSITIONS_REACHED'`
  5. Max notional exceeded (`notional > maxPositionSizeUsd (50,000)`) -> `'MAX_SIZE_EXCEEDED'`

#### Stage 4: Execution Engine (`processOrderPipeline`)
When Risk Check passes:
1. **Spread & Slippage Application**:
   - `spreadCost = (spreadPips * 0.0001) * signal.price` (or via `marketStore.calculateExecutionFill`)
   - `slippageUsd = signal.price * slippagePct`
   - `fillPrice`:
     - Buy: `signal.price + spreadCost + slippageUsd`
     - Sell: `signal.price - spreadCost - slippageUsd`
   - Minimum clamp: `fillPrice = Math.max(0.00001, fillPrice)`
2. **Commission Calculation**:
   - `commissionUsd = Number((signal.size * 2.5).toFixed(2))`
3. **Liquidation Price Calculation**:
   - Long: `fillPrice * (1 - 1 / signal.leverage + 0.005)`
   - Short: `fillPrice * (1 + 1 / signal.leverage - 0.005)`
4. **Position Construction**:
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
     unrealizedPnl: 0,
     unrealizedPnlPct: 0,
     tpPrice: signal.tpPrice,
     slPrice: signal.slPrice,
   }
   ```
5. **Trade Order Logging & Audio**:
   - Logs `TradeOrder` to transaction history.
   - Triggers `playOrderFilledSound()`.

#### Stage 5: Trailing Stop Manager (`updateTrailingStop`)
Mathematical Ratchet Specification:
- Parameters: `(position: Position, currentMarkPrice: number, trailDistance: number, activationDistance: number = 0)`
- Guards: If `trailDistance <= 0 || !Number.isFinite(currentMarkPrice)`, return `{ updatedSlPrice: position.slPrice ?? 0, wasRatchetUpdated: false }`.
- **Long Position**:
  - Activation: `currentMarkPrice >= position.entryPrice + activationDistance`
  - Candidate: `candidateSl = Number((currentMarkPrice - trailDistance).toFixed(4))`
  - Ratchet Condition: `candidateSl > (position.slPrice ?? 0)`
  - If satisfied: returns `{ updatedSlPrice: candidateSl, wasRatchetUpdated: true }`.
  - **Pullback Invariance**: If price decreases, `candidateSl < currentSl`, condition evaluates to `false`, returning current `slPrice`. The stop **never regresses**.
- **Short Position**:
  - Activation: `currentMarkPrice <= position.entryPrice - activationDistance`
  - Candidate: `candidateSl = Number((currentMarkPrice + trailDistance).toFixed(4))`
  - Ratchet Condition: `(position.slPrice ?? 0) === 0 || candidateSl < position.slPrice`
  - If satisfied: returns `{ updatedSlPrice: candidateSl, wasRatchetUpdated: true }`.
  - **Pullback Invariance**: If price increases, candidate SL increases, but ratchet condition requires candidate < current, so current stop is retained.

#### Stage 6: Exit Monitor (`checkPositionExitTriggers`)
Priority Hierarchy:
1. **Emergency Liquidation (Priority 1)**:
   - Long: `currentMarkPrice <= position.liquidationPrice` -> `{ shouldExit: true, exitReason: 'LIQUIDATION_TRIGGERED', exitPrice: position.liquidationPrice }`
   - Short: `currentMarkPrice >= position.liquidationPrice` -> `{ shouldExit: true, exitReason: 'LIQUIDATION_TRIGGERED', exitPrice: position.liquidationPrice }`
2. **Stop Loss / Trailing Stop (Priority 2)**:
   - Long: `position.slPrice && currentMarkPrice <= position.slPrice` -> `{ shouldExit: true, exitReason: 'SL_HIT', exitPrice: position.slPrice }`
   - Short: `position.slPrice && currentMarkPrice >= position.slPrice` -> `{ shouldExit: true, exitReason: 'SL_HIT', exitPrice: position.slPrice }`
3. **Take Profit (Priority 3)**:
   - Long: `position.tpPrice && currentMarkPrice >= position.tpPrice` -> `{ shouldExit: true, exitReason: 'TP_HIT', exitPrice: position.tpPrice }`
   - Short: `position.tpPrice && currentMarkPrice <= position.tpPrice` -> `{ shouldExit: true, exitReason: 'TP_HIT', exitPrice: position.tpPrice }`
4. **No Exit**:
   - Returns `{ shouldExit: false, exitPrice: currentMarkPrice }`.

Settlement Action on Exit Trigger (`settlePositionExit`):
```typescript
export function settlePositionExit(
  position: Position,
  exitPrice: number,
  exitReason: ExitReason,
  commissionUsd: number = 0
): ClosedPositionSettlement {
  const isForex = position.market === 'FOREX' || position.symbol.includes('EUR') || position.symbol.includes('GBP') || position.symbol.includes('JPY') || position.symbol.includes('XAU')
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
    total: position.size * exitPrice,
    time: 'Just now',
    status: 'COMPLETED',
    pnl: netPnl,
    aiStrategy: `Automated Exit (${exitReason})`,
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

### 4.4 Target Implementation File: `src/engine/orderLifecycle.ts`

The complete target code structure to be created by the Milestone 3 implementer:

```typescript
/**
 * 6-Stage Order Lifecycle Pipeline
 * src/engine/orderLifecycle.ts
 *
 * Stage 1: SIGNAL       - Normalization of manual, AI bot, or swarm order requests
 * Stage 2: VALIDATION   - Price sanity, positive lot size, SL/TP geometric geometry
 * Stage 3: RISK CHECK   - Integration with RiskEngine (Circuit Breaker, Margin, Limits)
 * Stage 4: EXECUTION    - Institutional fill price (slippage & spread), DMA position creation
 * Stage 5: TRAILING     - High-water mark ratcheting stop loss strictly in favorable direction
 * Stage 6: EXIT MONITOR - Automated tick-by-tick trigger check against TP, SL, and Liquidation
 */

import type { Position, TradeOrder, MarketCategory } from '@/types/trading'
import {
  evaluateOrderRisk,
  type AccountBalanceSheet,
  type RiskConfig,
} from '@/engine/riskEngine'

export type OrderStage = 'SIGNAL' | 'VALIDATION' | 'RISK_CHECK' | 'EXECUTION' | 'TRAILING' | 'EXIT'

export type OrderStatus = 'SUBMITTED' | 'REJECTED' | 'FILLED'

export type ExitReason = 'TP_HIT' | 'SL_HIT' | 'LIQUIDATION_TRIGGERED' | 'MANUAL_CLOSE'

export interface OrderSignal {
  id: string
  symbol: string
  side: 'BUY' | 'SELL'
  size: number
  price: number
  leverage: number
  slPrice?: number
  tpPrice?: number
  trailingDistance?: number
  trailingActivationDistance?: number
  botId?: string
  source?: 'BOT' | 'MANUAL' | 'AI_SWARM'
  orderType?: 'MARKET' | 'LIMIT' | 'AI_TRAILING' | 'TWAP' | 'ICEBERG'
  timestamp?: number
}

export interface ProcessedOrderResult {
  orderId: string
  stageReached: OrderStage
  status: OrderStatus
  fillPrice?: number
  commissionUsd?: number
  slippageUsd?: number
  rejectReason?: string
  positionCreated?: Position
  executedTrade?: TradeOrder
}

export interface TrailingStopResult {
  updatedSlPrice: number
  wasRatchetUpdated: boolean
}

export interface PositionExitResult {
  shouldExit: boolean
  exitReason?: ExitReason
  exitPrice: number
}

export interface ClosedPositionSettlement {
  positionId: string
  exitPrice: number
  exitReason: ExitReason
  realizedPnl: number
  realizedPnlPct: number
  releasedMargin: number
  closedTrade: TradeOrder
}

/**
 * Stage 2: Order Validation
 */
export function validateOrderSignal(signal: OrderSignal): { valid: boolean; reason?: string } {
  if (!signal.id || !signal.symbol) {
    return { valid: false, reason: 'INVALID_METADATA: Signal missing id or symbol' }
  }
  if (!Number.isFinite(signal.size) || signal.size <= 0) {
    return { valid: false, reason: 'INVALID_SIZE: Order size must be strictly positive' }
  }
  if (!Number.isFinite(signal.price) || signal.price <= 0) {
    return { valid: false, reason: 'INVALID_PRICE: Order price must be strictly positive' }
  }
  if (signal.leverage < 1 || !Number.isFinite(signal.leverage)) {
    return { valid: false, reason: 'INVALID_LEVERAGE: Leverage must be >= 1' }
  }

  // Stop Loss Geometric Verification
  if (signal.slPrice !== undefined && signal.slPrice > 0) {
    if (signal.side === 'BUY' && signal.slPrice >= signal.price) {
      return { valid: false, reason: 'INVALID_SL: Long stop-loss must be strictly below entry price' }
    }
    if (signal.side === 'SELL' && signal.slPrice <= signal.price) {
      return { valid: false, reason: 'INVALID_SL: Short stop-loss must be strictly above entry price' }
    }
  }

  // Take Profit Geometric Verification
  if (signal.tpPrice !== undefined && signal.tpPrice > 0) {
    if (signal.side === 'BUY' && signal.tpPrice <= signal.price) {
      return { valid: false, reason: 'INVALID_TP: Long take-profit must be strictly above entry price' }
    }
    if (signal.side === 'SELL' && signal.tpPrice >= signal.price) {
      return { valid: false, reason: 'INVALID_TP: Short take-profit must be strictly below entry price' }
    }
  }

  // Trailing Distance Verification
  if (signal.trailingDistance !== undefined && signal.trailingDistance <= 0) {
    return { valid: false, reason: 'INVALID_TRAILING_DISTANCE: Trailing distance must be strictly positive' }
  }

  return { valid: true }
}

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

  const isForex = signal.symbol.includes('/') &&
    (signal.symbol.includes('USD') || signal.symbol.includes('EUR') || signal.symbol.includes('GBP') || signal.symbol.includes('JPY') || signal.symbol.includes('XAU'))

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

/**
 * Stage 5: Trailing stop ratchet algorithm
 * Ensures stop-loss only moves in the favorable direction (never widens loss)
 */
export function updateTrailingStop(
  position: Position,
  currentMarkPrice: number,
  trailDistance: number,
  activationDistance: number = 0
): TrailingStopResult {
  if (trailDistance <= 0 || !Number.isFinite(currentMarkPrice)) {
    return { updatedSlPrice: position.slPrice ?? 0, wasRatchetUpdated: false }
  }

  const currentSl = position.slPrice ?? 0

  if (position.side === 'LONG') {
    // Only activate once price has moved ahead by activation distance
    if (currentMarkPrice >= position.entryPrice + activationDistance) {
      const candidateSl = Number((currentMarkPrice - trailDistance).toFixed(4))
      if (candidateSl > currentSl) {
        return { updatedSlPrice: candidateSl, wasRatchetUpdated: true }
      }
    }
  } else if (position.side === 'SHORT') {
    if (currentMarkPrice <= position.entryPrice - activationDistance) {
      const candidateSl = Number((currentMarkPrice + trailDistance).toFixed(4))
      if (currentSl === 0 || candidateSl < currentSl) {
        return { updatedSlPrice: candidateSl, wasRatchetUpdated: true }
      }
    }
  }

  return { updatedSlPrice: currentSl, wasRatchetUpdated: false }
}

/**
 * Stage 6: Position exit trigger evaluation
 */
export function checkPositionExitTriggers(
  position: Position,
  currentMarkPrice: number
): PositionExitResult {
  if (!Number.isFinite(currentMarkPrice)) {
    return { shouldExit: false, exitPrice: position.markPrice }
  }

  // 1. Liquidation Check (Highest Priority)
  if (position.side === 'LONG' && currentMarkPrice <= position.liquidationPrice) {
    return { shouldExit: true, exitReason: 'LIQUIDATION_TRIGGERED', exitPrice: position.liquidationPrice }
  }
  if (position.side === 'SHORT' && currentMarkPrice >= position.liquidationPrice) {
    return { shouldExit: true, exitReason: 'LIQUIDATION_TRIGGERED', exitPrice: position.liquidationPrice }
  }

  // 2. Stop Loss Check (Second Priority)
  if (position.slPrice && position.slPrice > 0) {
    if (position.side === 'LONG' && currentMarkPrice <= position.slPrice) {
      return { shouldExit: true, exitReason: 'SL_HIT', exitPrice: position.slPrice }
    }
    if (position.side === 'SHORT' && currentMarkPrice >= position.slPrice) {
      return { shouldExit: true, exitReason: 'SL_HIT', exitPrice: position.slPrice }
    }
  }

  // 3. Take Profit Check (Third Priority)
  if (position.tpPrice && position.tpPrice > 0) {
    if (position.side === 'LONG' && currentMarkPrice >= position.tpPrice) {
      return { shouldExit: true, exitReason: 'TP_HIT', exitPrice: position.tpPrice }
    }
    if (position.side === 'SHORT' && currentMarkPrice <= position.tpPrice) {
      return { shouldExit: true, exitReason: 'TP_HIT', exitPrice: position.tpPrice }
    }
  }

  return { shouldExit: false, exitPrice: currentMarkPrice }
}

/**
 * Stage 6 Settlement Helper
 */
export function settlePositionExit(
  position: Position,
  exitPrice: number,
  exitReason: ExitReason,
  commissionUsd: number = 0
): ClosedPositionSettlement {
  const isForex = position.market === 'FOREX' ||
    (position.symbol.includes('/') &&
      (position.symbol.includes('USD') || position.symbol.includes('EUR') || position.symbol.includes('GBP') || position.symbol.includes('JPY') || position.symbol.includes('XAU')))
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

### 4.5 Integration Blueprint in `src/App.tsx` & UI Components

#### 1. Wiring Stage 5 and Stage 6 into `App.tsx` Tick Listener
Currently lines 77–117 in `App.tsx` update positions. The enhanced loop:
```typescript
// Inside defaultMarketStore.subscribeAll((tickers) => ...):
setPositions((prevPositions) => {
  const remainingPositions: Position[] = []
  const closedSettlements: ClosedPositionSettlement[] = []

  for (const pos of prevPositions) {
    const ticker = tickers[pos.symbol]
    if (!ticker || !ticker.midPrice) {
      remainingPositions.push(pos)
      continue
    }

    const mark = ticker.midPrice
    // Update floating PnL
    const isForex = pos.market === 'FOREX' || pos.symbol.includes('EUR') || pos.symbol.includes('GBP') || pos.symbol.includes('JPY') || pos.symbol.includes('XAU')
    const isGold = pos.symbol.includes('XAU')
    const isJpy = pos.symbol.includes('JPY')
    const notionalMultiplier = isForex ? (isGold ? 100 : 100000) : 1
    const priceDelta = pos.side === 'LONG' ? mark - pos.entryPrice : pos.entryPrice - mark
    const rawPnl = priceDelta * (pos.lots !== undefined ? pos.lots : pos.size) * notionalMultiplier
    const jpyRate = isJpy && mark > 0 ? mark : 1
    const pnlUsd = isJpy ? rawPnl / jpyRate : rawPnl
    const pnl = Number(pnlUsd.toFixed(2))
    const pnlPct = Number(((pnl / (pos.margin || 1)) * 100).toFixed(2))

    let updatedPos: Position = {
      ...pos,
      markPrice: mark,
      unrealizedPnl: pnl,
      unrealizedPnlPct: pnlPct,
    }

    // Stage 5: Trailing stop ratchet
    const trailingDist = (pos as any).trailingDistance ?? (pos.market === 'FOREX' ? 10.0 : mark * 0.008)
    const trailingUpdate = updateTrailingStop(updatedPos, mark, trailingDist)
    if (trailingUpdate.wasRatchetUpdated) {
      updatedPos.slPrice = trailingUpdate.updatedSlPrice
    }

    // Stage 6: Exit Trigger Check
    const exitCheck = checkPositionExitTriggers(updatedPos, mark)
    if (exitCheck.shouldExit && exitCheck.exitReason) {
      const settlement = settlePositionExit(updatedPos, exitCheck.exitPrice, exitCheck.exitReason)
      closedSettlements.push(settlement)
    } else {
      remainingPositions.push(updatedPos)
    }
  }

  // Handle closed settlements: credit balance, release margin, play audio, log trade
  if (closedSettlements.length > 0) {
    for (const st of closedSettlements) {
      if (st.realizedPnl >= 0) {
        playTakeProfitSound()
      } else {
        playStopLossSound()
      }
      setPortfolio((prev) => ({
        ...prev,
        totalBalance: prev.totalBalance + st.realizedPnl,
        realizedProfit: prev.realizedProfit + st.realizedPnl,
        tradeCapital: Math.max(0, prev.tradeCapital - st.releasedMargin),
      }))
      setTrades((prev) => [st.closedTrade, ...prev])
      showToast(`Position Exited (${st.exitReason}): Realized PnL ${st.realizedPnl >= 0 ? '+' : ''}$${st.realizedPnl.toFixed(2)}`)
    }
  }

  return remainingPositions
})
```

#### 2. Wiring OrderEntryWidget to Order Lifecycle Pipeline
In `OrderEntryWidget.tsx`:
Replace ad-hoc `newPos` construction with:
1. Build `OrderSignal`:
   ```typescript
   const signal: OrderSignal = {
     id: `sig_manual_${Date.now()}`,
     symbol: finalSymbol,
     side: side === 'LONG' ? 'BUY' : 'SELL',
     size: parsedAmount,
     price: activePrice,
     leverage,
     slPrice: slEnabled ? effectiveSl : undefined,
     tpPrice: tpEnabled ? effectiveTp : undefined,
     trailingDistance: orderType === 'AI_TRAILING' ? (isForex ? 12.0 : activePrice * 0.008) : undefined,
     source: 'MANUAL',
     orderType,
   }
   ```
2. Validate and execute through `processOrderPipeline(signal, currentBalanceSheet)`:
   - If `status === 'REJECTED'`, show toast with `rejectReason` and abort.
   - If `status === 'FILLED'`, pass `positionCreated` to `onOrderPlaced()`.

---

## 5. Verification Method

### 5.1 Automated Test Execution
Run the full test suite verifying all 6 stages of order lifecycle:
```powershell
pnpm test -- --run
```
*Expected Result*:
- `src/test/tier1_features/orderLifecycle.test.ts`: **5/5 tests PASS**
- `src/test/tier1_features/riskCircuitBreaker.test.ts`: **6/6 tests PASS**
- `src/test/tier2_boundaries/extremeTicksAndGaps.test.ts`: **5/5 tests PASS**
- `src/test/tier2_boundaries/extremeLeverageMargin.test.ts`: **5/5 tests PASS**
- `src/test/tier3_pairwise/tickFeedPositionSync.test.ts`: **3/3 tests PASS**
- `src/test/tier3_pairwise/orderMarginSlippage.test.ts`: **3/3 tests PASS**
- `src/test/tier3_pairwise/botSignalCircuitBreaker.test.ts`: **3/3 tests PASS**
- `src/test/tier4_realworld/cryptoCascadeCircuitTrip.test.ts`: **1/1 test PASS**
- `src/test/tier4_realworld/goldNewsVolatilitySpike.test.ts`: **1/1 test PASS**
- Total suite: **191/191 tests PASS** (or expanded with M3 tests).

### 5.2 Build & Typecheck Verification
```powershell
pnpm build
```
*Expected Result*: Exits with code 0 (`tsc -b && vite build`), no TypeScript compilation errors.

### 5.3 Invalidation Conditions
This investigation and design would be considered invalid if:
1. A long order signal with `slPrice >= price` is allowed to proceed to risk check without rejection.
2. A trailing stop pulls back in the losing direction when price reverses after hitting a new high.
3. During a flash crash where price breaches both Stop Loss and Liquidation price, Stop Loss is reported instead of emergency liquidation.
4. An order submitted when daily drawdown is >= 4.5% is filled instead of rejected by the Circuit Breaker.
5. Live price ticks crossing a position's TP or SL leave the position open without automatic exit.
