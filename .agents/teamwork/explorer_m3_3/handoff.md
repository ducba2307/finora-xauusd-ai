# Milestone 3 Architectural Investigation & Design Report: F12 & F13
## Feature F12: Account Risk Engine & Daily Circuit Breaker (`src/engine/riskEngine.ts`)
## Feature F13: Dynamic Balance Sheet & Live Position Synchronization (`src/App.tsx`, `src/types/trading.ts`)

**Investigator**: `explorer_m3_3` (`teamwork_preview_explorer`)  
**Workspace Root**: `d:\VIBECODE\finora-trading-ai`  
**Working Directory**: `d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m3_3`  
**Timestamp**: 2026-10-11T16:08:00Z  
**Parent Orchestrator ID**: `24e52ee7-1f05-49b8-87e8-20aaeb1f2060`  

---

## 1. Observation

### 1.1 Codebase Structure & Missing Risk Engine
- **Directory**: `src/engine/` does **not exist** in the repository root.
- **Contract & Test Suite**:
  - `src/test/contracts/engine/riskEngine.ts` defines the authoritative contract for:
    - `AccountBalanceSheet` (lines 8–19)
    - `RiskConfig` & `DEFAULT_RISK_CONFIG` (lines 21–33)
    - `NewOrderRequest` (lines 35–43)
    - `checkCircuitBreaker(dailyDrawdownPct, maxThresholdPct)` (lines 45–61)
    - `recalculateBalanceSheet(positions, cashBalance, peakDailyEquity, dailyStartEquity)` (lines 63–108)
    - `evaluateOrderRisk(order, balanceSheet, riskConfig)` (lines 110–160)
  - `vitest.config.ts` (lines 8–35) includes a `contractFallbackPlugin` which maps `@/engine/*` to `src/test/contracts/engine/*` during Vitest runs when `src/engine/*` is missing.
  - The test suite in `src/test/tier1_features/riskCircuitBreaker.test.ts`, `src/test/tier3_pairwise/tickFeedPositionSync.test.ts`, `src/test/tier4_realworld/cryptoCascadeCircuitTrip.test.ts`, `src/test/tier3_pairwise/botSignalCircuitBreaker.test.ts`, and `src/test/tier2_boundaries/extremeLeverageMargin.test.ts` executes against these contracts.
  - However, in production (`pnpm build`), Vite compiles only `src/` without `src/test`. Therefore, `src/engine/riskEngine.ts` must be created in `src/engine/` so the application and UI can import and execute it in production runtime.

### 1.2 Types Gaps in `src/types/trading.ts`
- **File**: `src/types/trading.ts` (lines 134–141)
  ```typescript
  export interface UserPortfolio {
    totalBalance: number
    tradeCapital: number
    maxLoss: number
    realizedProfit: number
    dailyChangePct: number
    balances: Record<string, number>
  }
  ```
- *Direct Observation*: `UserPortfolio` contains only cash balances and static fields. It completely lacks essential institutional metrics:
  - `equity` (`cashBalance + sum(unrealizedPnl)`)
  - `marginUsed` (`sum(pos.margin)`)
  - `freeMargin` (`Math.max(0, equity - marginUsed)`)
  - `marginLevelPct` (`marginUsed > 0 ? (equity / marginUsed) * 100 : 999.99`)
  - `peakDailyEquity` (high-water mark of equity)
  - `dailyStartEquity` (starting equity at session start)
  - `dailyDrawdownPct` (`((peakDailyEquity - equity) / peakDailyEquity) * 100`)
  - `dailyDrawdownUsd` (`peakDailyEquity - equity`)
  - `isCircuitBreakerTripped` (boolean indicator)
  - `circuitBreakerReason` (string or null)
- Furthermore, `AccountBalanceSheet` and `RiskConfig` are not exported in `src/types/trading.ts`.

### 1.3 Disconnection in `src/App.tsx`
- **File**: `src/App.tsx` (lines 57–60, 71–117, 227–271)
  1. **Portfolio State Desynchronization on Price Ticks**:
     Lines 71–117 implement a tick subscription via `defaultMarketStore.subscribeAll`:
     ```typescript
     setPositions((prevPositions) => {
       let hasChanges = false
       const updated = prevPositions.map((pos) => {
         const ticker = tickers[pos.symbol]
         ...
         return { ...pos, markPrice: mark, unrealizedPnl: pnl, unrealizedPnlPct: pnlPct }
       })
       return hasChanges ? updated : prevPositions
     })
     ```
     *Problem*: While `positions` state updates with floating PnL, `portfolio` state is **never updated** during ticks. As a result, portfolio net worth, equity, margin used, and daily drawdown remain static.
  2. **Peak Daily Equity Never Tracked**:
     No `peakDailyEquity` state exists in `App.tsx`. Therefore, account high-water marks are lost, and daily drawdown is never calculated against live equity.
  3. **No Circuit Breaker Trip Detection or Order Locking**:
     Even if adverse ticks push account loss past 4.5%, no state variable flags the trip, and no order placement gateway exists in `handleOrderPlaced` or `OrderEntryWidget.tsx`.
  4. **Stale Realized PnL on Manual Close**:
     In `handleClosePosition` (lines 249–255):
     ```typescript
     setPortfolio((prev) => ({
       ...prev,
       totalBalance: prev.totalBalance + target.unrealizedPnl,
       realizedProfit: prev.realizedProfit + target.unrealizedPnl,
       tradeCapital: Math.max(0, prev.tradeCapital - target.margin),
     }))
     ```
     If the target position was closed before ticks arrived, or if floating PnL is out of sync, `tradeCapital` is decremented while `portfolio.balances` is untouched.
  5. **Automated Exit Triggers Ignored on Ticks**:
     Even when a position's `markPrice` breaches `tpPrice`, `slPrice`, or `liquidationPrice`, no automated close action is triggered. Positions remain open indefinitely until manually closed.

### 1.4 Hardcoded Circuit Breaker UI in Components
- **File**: `src/components/BotControlModal.tsx` (lines 70–74)
  ```tsx
  <div className="bg-[#121624] p-3 rounded-xl border border-white/5">
    <div className="text-[11px] text-gray-400">Circuit Breaker Protection</div>
    <div className="text-lg font-bold text-indigo-400 font-mono-num flex items-center gap-1">
      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> STRICT (Max -5%)
    </div>
  </div>
  ```
  *Direct Observation*: The status text `STRICT (Max -5%)` is completely hardcoded. It never updates when drawdown worsens and does not indicate when the circuit breaker is triggered.
- **File**: `src/components/QuantStudioView.tsx` (lines 207–218)
  ```tsx
  <div className="bg-[#080a11] p-3 rounded-xl border border-white/5 space-y-2 text-xs">
    <span className="font-bold text-white block">Risk Controls:</span>
    <div className="flex justify-between text-[11px] text-gray-400">
      <span>Max Daily Drawdown:</span>
      <span className="text-rose-400 font-bold font-mono-num">-4.5% Hard Stop</span>
    </div>
  ```
  Hardcoded text displaying `-4.5% Hard Stop`.
- **File**: `src/components/PortfolioView.tsx` (lines 35, 119–125)
  - Line 35: Displays `Total Net Worth: {formatCurrency(portfolio.totalBalance)}` (cash balance instead of live equity).
  - Lines 119–125: Displays hardcoded `Armed (-5.0%)` text for `Max Drawdown Breaker`.
- **File**: `src/components/Navbar.tsx` (lines 173–178)
  - Displays only `${totalBalance}` without equity or margin indicators.
- **File**: `src/components/TradingDashboard.tsx` (lines 224–264)
  - Card 1 labeled "Total Equity" displays `portfolio.totalBalance` (cash balance), not live equity (`cash + sum(unrealizedPnl)`).
  - Card 2 labeled "Bot Capital Deployed" displays `portfolio.tradeCapital` (which is modified by manual order margins).
  - Card 3 labeled "Max Drawdown Risk" displays `portfolio.maxLoss` with static `-12.8% ↘` text.

---

## 2. Logic Chain

```
[Observation 1.1 & 1.2: No Risk Engine in src/engine & Missing Balance Sheet Types]
   │
   ├─> App cannot import account risk validation or circuit breaker logic in production.
   ├─> UserPortfolio lacks live equity, margin used, free margin, margin level %, and daily drawdown %.
   └─> Deduction: We must implement src/engine/riskEngine.ts and export AccountBalanceSheet in src/types/trading.ts.

[Observation 1.3: Positions updated on ticks, but Portfolio & Balance Sheet disconnected]
   │
   ├─> When market ticks update position mark prices and unrealized PnL:
   │     totalUnrealizedPnl changes dynamically.
   │     True account equity = cashBalance + totalUnrealizedPnl.
   ├─> High-water mark peakDailyEquity must ratchet UP when equity > peakDailyEquity.
   ├─> Daily drawdown % = ((peakDailyEquity - equity) / peakDailyEquity) * 100.
   ├─> If daily drawdown % >= 4.5%:
   │     Circuit Breaker MUST trip immediately.
   │     isCircuitBreakerTripped becomes true.
   │     Subsequent orders (manual in OrderEntryWidget and bot in BotEngine) MUST be rejected.
   └─> Deduction: The tick subscription in App.tsx must derive the full AccountBalanceSheet on every tick batch.

[Observation 1.3 & 1.4: OrderEntryWidget lacks Pre-Flight Risk Gateway & UI shows hardcoded strings]
   │
   ├─> OrderEntryWidget only checked parsedAmount > 0 before calling onOrderPlaced.
   ├─> evaluateOrderRisk(order, balanceSheet, riskConfig) must guard order submission:
   │     1. Circuit Breaker Active Check (Drawdown >= 4.5% -> REJECT)
   │     2. Margin Sufficiency Check (marginRequired > freeMargin -> REJECT)
   │     3. Leverage Cap Check (leverage > 100x -> REJECT)
   │     4. Max Open Positions Count Check (count >= 10 -> REJECT)
   │     5. Max Position Size Check (notional > $50,000 -> REJECT)
   │     6. Slippage Tolerance Check (slippage > maxTolerance -> REJECT)
   ├─> On position close: cashBalance += realizedPnl, tradeCapital -= margin, release margin.
   └─> Deduction: Integrate evaluateOrderRisk into App.tsx order handler and feed live balanceSheet telemetry into UI components.
```

---

## 3. Caveats

1. **Multi-Asset Currency Conversion Precision**:
   - In `App.tsx` (lines 88–101), Forex gold (`XAU/USD`) uses a contract multiplier of `100` troy oz per lot.
   - Forex currency pairs (`EUR/USD`, `GBP/USD`) use standard `100,000` units per lot.
   - For `USD/JPY`, base is USD and quote is JPY. Raw price delta in JPY must be converted to USD: `pnlUsd = rawPnl / markPrice`. A safety guard must ensure `markPrice > 0` (falling back to `entryPrice` or `1`) to prevent division by zero or NaN.
   - Crypto pairs (`BTC/USDT`, `ETH/USDT`, `SOL/USDT`) use unit multiplier `1`.
2. **Division by Zero and Finite Output Protection**:
   - When `marginUsed === 0`, `marginLevelPct` must equal `999.99` (or `Infinity`) — the contracts and tests specify `999.99` to guarantee finite JSON serializability without NaN.
   - When `peakDailyEquity <= 0`, `dailyDrawdownPct` must return `0`.
   - When `cashBalance < 0` (under extreme debt or gap loss), `recalculateBalanceSheet` must clamp `safeCash = Math.max(0, cashBalance)` as required by `src/test/tier2_boundaries/extremeLeverageMargin.test.ts`.
3. **High-Water Mark Ratcheting**:
   - `peakDailyEquity` must only update in the **upward** direction: `newPeak = Math.max(peakDailyEquity || dailyStartEquity || equity, equity)`.
   - When equity drops from $101,000 to $95,000, `peakDailyEquity` must remain at $101,000.
4. **React Performance & State Synchronization**:
   - Ticks arrive frequently (every 1.2s or via WebSocket).
   - If `App.tsx` triggers multiple distinct `setState` calls per tick (`setPositions`, `setPortfolio`, `setPeakDailyEquity`), it can induce unnecessary re-render churn.
   - Solution: Derive `balanceSheet` via `useMemo` from `(positions, portfolio.totalBalance, peakDailyEquity, dailyStartEquity)` while keeping `peakDailyEquity` updated when equity exceeds the current peak.

---

## 4. Conclusion & Complete Implementation Design

### 4.1 Specification of `src/engine/riskEngine.ts`

The file must be created at `src/engine/riskEngine.ts` with the following authoritative implementation:

```typescript
/**
 * Account Risk Engine & Circuit Breaker Engine
 * Institutional risk controls adhering to Requirement R3 (F12, F13).
 */

import type { Position } from '@/types/trading'
import { safeDivide } from '@/quant/metrics'

export interface AccountBalanceSheet {
  cashBalance: number
  equity: number
  marginUsed: number
  freeMargin: number
  marginLevelPct: number
  peakDailyEquity: number
  dailyStartEquity: number
  dailyDrawdownPct: number
  dailyDrawdownUsd: number
  isCircuitBreakerTripped: boolean
  circuitBreakerReason?: string
}

export interface RiskConfig {
  maxDailyDrawdownPct: number // Default 4.5%
  maxOpenPositions: number    // Default 10
  maxLeverage: number         // Default 100
  maxPositionSizeUsd: number  // Default $50,000
  maxSlippageTolerancePct?: number // Optional slippage tolerance (e.g. 0.5%)
}

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  maxDailyDrawdownPct: 4.5,
  maxOpenPositions: 10,
  maxLeverage: 100,
  maxPositionSizeUsd: 50000,
  maxSlippageTolerancePct: 0.5,
}

export interface NewOrderRequest {
  symbol: string
  side: 'BUY' | 'SELL'
  size: number
  price: number
  leverage: number
  marginRequired: number
  currentOpenPositionsCount?: number
  slippagePct?: number
}

export interface CircuitBreakerResult {
  isTripped: boolean
  reason?: string
}

export interface RiskEvaluationResult {
  allowed: boolean
  reason?: string
}

/**
 * Evaluates whether current daily drawdown breaches the institutional circuit breaker threshold.
 */
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

/**
 * Calculates position floating PnL with multi-asset asset class multiplier & JPY conversion.
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

  const isForex =
    position.market === 'FOREX' ||
    position.symbol.includes('EUR') ||
    position.symbol.includes('GBP') ||
    position.symbol.includes('JPY') ||
    position.symbol.includes('XAU')
  const isGold = position.symbol.includes('XAU')
  const isJpy = position.symbol.includes('JPY')
  const notionalMultiplier = isForex ? (isGold ? 100 : 100000) : 1
  const isLong = position.side === 'LONG'
  const priceDelta = isLong ? markPrice - position.entryPrice : position.entryPrice - markPrice
  const rawPnl = priceDelta * (position.lots !== undefined ? position.lots : position.size) * notionalMultiplier

  const jpyRate = markPrice > 0 ? markPrice : position.entryPrice > 0 ? position.entryPrice : 1
  const pnlUsd = isJpy ? rawPnl / jpyRate : rawPnl
  const pnl = Number(pnlUsd.toFixed(2))
  const marginBase = Math.max(0.01, position.margin || 1)
  const pnlPct = Number(((pnl / marginBase) * 100).toFixed(2))

  return {
    unrealizedPnl: pnl,
    unrealizedPnlPct: pnlPct,
  }
}

/**
 * Recalculates the dynamic account balance sheet from open positions, cash balance, and peak equity.
 */
export function recalculateBalanceSheet(
  positions: Position[],
  cashBalance: number,
  peakDailyEquity: number,
  dailyStartEquity: number
): AccountBalanceSheet {
  const safeCash = Number.isFinite(cashBalance) ? Math.max(0, cashBalance) : 0
  const safePositions = positions || []

  let marginUsed = 0
  let totalUnrealizedPnl = 0

  for (const pos of safePositions) {
    marginUsed += Number.isFinite(pos.margin) ? pos.margin : 0
    totalUnrealizedPnl += Number.isFinite(pos.unrealizedPnl) ? pos.unrealizedPnl : 0
  }

  const equity = Number((safeCash + totalUnrealizedPnl).toFixed(2))
  const newPeak = Number(Math.max(peakDailyEquity || dailyStartEquity || equity, equity).toFixed(2))
  const freeMargin = Number(Math.max(0, equity - marginUsed).toFixed(2))

  const marginLevelPct =
    marginUsed > 0 ? Number(safeDivide(equity * 100, marginUsed, 999.99).toFixed(2)) : 999.99

  const dailyDrawdownUsd = Number(Math.max(0, newPeak - equity).toFixed(2))
  const dailyDrawdownPct =
    newPeak > 0 ? Number(safeDivide(dailyDrawdownUsd * 100, newPeak, 0).toFixed(2)) : 0

  const cbCheck = checkCircuitBreaker(dailyDrawdownPct, DEFAULT_RISK_CONFIG.maxDailyDrawdownPct)

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
}

/**
 * Pre-flight order gateway validating circuit breaker, margin sufficiency, leverage, position limits, and slippage.
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

  // 2. Margin Sufficiency Guard (Strict >: allows exact equality, rejects if required > freeMargin)
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

  // 5. Max Position Size Guard
  const notionalValue = order.size * order.price
  if (notionalValue > config.maxPositionSizeUsd) {
    return {
      allowed: false,
      reason: `MAX_SIZE_EXCEEDED: Notional value $${notionalValue.toFixed(2)} exceeds limit $${config.maxPositionSizeUsd}.`,
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

### 4.2 Type Augmentations in `src/types/trading.ts`

Add exports in `src/types/trading.ts`:

```typescript
// Re-export or define AccountBalanceSheet and RiskConfig
export interface AccountBalanceSheet {
  cashBalance: number
  equity: number
  marginUsed: number
  freeMargin: number
  marginLevelPct: number
  peakDailyEquity: number
  dailyStartEquity: number
  dailyDrawdownPct: number
  dailyDrawdownUsd: number
  isCircuitBreakerTripped: boolean
  circuitBreakerReason?: string
}

export interface RiskConfig {
  maxDailyDrawdownPct: number
  maxOpenPositions: number
  maxLeverage: number
  maxPositionSizeUsd: number
  maxSlippageTolerancePct?: number
}

export interface UserPortfolio {
  totalBalance: number
  tradeCapital: number
  maxLoss: number
  realizedProfit: number
  dailyChangePct: number
  balances: Record<string, number>
  // F13 & F12 additions for backward-compatible balance sheet metrics:
  equity?: number
  marginUsed?: number
  freeMargin?: number
  marginLevelPct?: number
  peakDailyEquity?: number
  dailyStartEquity?: number
  dailyDrawdownPct?: number
  dailyDrawdownUsd?: number
  isCircuitBreakerTripped?: boolean
  circuitBreakerReason?: string | null
}
```

---

### 4.3 Integration Points in `src/App.tsx`

#### Point 1: State Initialization & High-Water Mark Tracking
```typescript
import {
  recalculateBalanceSheet,
  evaluateOrderRisk,
  type AccountBalanceSheet,
} from './engine/riskEngine'
import { checkPositionExitTriggers } from './engine/orderLifecycle'

// In App component:
const INITIAL_DAILY_START = 48950.0
// Initial equity with INITIAL_POSITIONS unrealized PnL ($1,869.20): 48950 + 1869.20 = 50819.20
const [dailyStartEquity] = useState<number>(INITIAL_DAILY_START)
const [peakDailyEquity, setPeakDailyEquity] = useState<number>(50819.20)

// Derived live balance sheet
const balanceSheet = useMemo<AccountBalanceSheet>(() => {
  return recalculateBalanceSheet(positions, portfolio.totalBalance, peakDailyEquity, dailyStartEquity)
}, [positions, portfolio.totalBalance, peakDailyEquity, dailyStartEquity])

// Ratchet peakDailyEquity whenever equity hits a new intraday high
useEffect(() => {
  if (balanceSheet.equity > peakDailyEquity) {
    setPeakDailyEquity(balanceSheet.equity)
  }
}, [balanceSheet.equity, peakDailyEquity])

// Circuit breaker trip monitor: trigger alert sound & toast on trip transition
const prevTrippedRef = useRef(false)
useEffect(() => {
  if (balanceSheet.isCircuitBreakerTripped && !prevTrippedRef.current) {
    prevTrippedRef.current = true
    playStopLossSound()
    showToast(
      `CRITICAL RISK ALERT: Daily Drawdown Circuit Breaker Tripped at ${balanceSheet.dailyDrawdownPct.toFixed(2)}%! All trading locked.`
    )
  } else if (!balanceSheet.isCircuitBreakerTripped) {
    prevTrippedRef.current = false
  }
}, [balanceSheet.isCircuitBreakerTripped, balanceSheet.dailyDrawdownPct])
```

#### Point 2: Automated Position Exit Monitoring on Ticks
Inside the `defaultMarketStore.subscribeAll` callback in `App.tsx`:
```typescript
const unsubscribe = defaultMarketStore.subscribeAll((tickers) => {
  setPositions((prevPositions) => {
    let hasChanges = false
    const remainingPositions: Position[] = []

    for (const pos of prevPositions) {
      const ticker = tickers[pos.symbol]
      const mark = ticker?.midPrice ?? pos.markPrice

      // Check automated SL / TP / Liquidation exits
      const exitCheck = checkPositionExitTriggers(pos, mark)
      if (exitCheck.shouldExit) {
        hasChanges = true
        // Position struck exit trigger! Automatically close and settle
        const realizedPnl = pos.unrealizedPnl
        if (exitCheck.exitReason === 'TP_HIT') {
          playTakeProfitSound()
          showToast(`Take Profit Hit: ${pos.symbol} closed at ${exitCheck.exitPrice} (+${realizedPnl.toFixed(2)} USD)`)
        } else {
          playStopLossSound()
          showToast(`Exit Triggered (${exitCheck.exitReason}): ${pos.symbol} closed at ${exitCheck.exitPrice} (${realizedPnl.toFixed(2)} USD)`)
        }

        // Settle portfolio balance and realize profit
        setPortfolio((prev) => ({
          ...prev,
          totalBalance: Number((prev.totalBalance + realizedPnl).toFixed(2)),
          realizedProfit: Number((prev.realizedProfit + realizedPnl).toFixed(2)),
          tradeCapital: Math.max(0, Number((prev.tradeCapital - pos.margin).toFixed(2))),
        }))

        // Log trade history
        const closedTrade: TradeOrder = {
          id: `tx-auto-${Date.now()}-${pos.id}`,
          assetSymbol: pos.symbol,
          type: pos.side === 'LONG' ? 'SELL' : 'BUY',
          amount: pos.size,
          price: exitCheck.exitPrice,
          total: pos.size * exitCheck.exitPrice,
          time: 'Just now',
          status: 'COMPLETED',
          pnl: realizedPnl,
          aiStrategy: `Automated Exit (${exitCheck.exitReason})`,
        }
        setTrades((prev) => [closedTrade, ...prev])
        continue // Do not include in remainingPositions
      }

      // If price changed, update markPrice and floating PnL
      if (ticker && ticker.midPrice && Math.abs(ticker.midPrice - pos.markPrice) >= 0.000001) {
        hasChanges = true
        const pnlData = calculatePositionPnl(pos, mark)
        remainingPositions.push({
          ...pos,
          markPrice: mark,
          unrealizedPnl: pnlData.unrealizedPnl,
          unrealizedPnlPct: pnlData.unrealizedPnlPct,
        })
      } else {
        remainingPositions.push(pos)
      }
    }

    return hasChanges ? remainingPositions : prevPositions
  })
})
```

#### Point 3: Pre-Flight Risk Check on Order Placement (`handleOrderPlaced`)
```typescript
const handleOrderPlaced = (newPos: Position) => {
  // Pre-flight risk evaluation
  const riskCheck = evaluateOrderRisk(
    {
      symbol: newPos.symbol,
      side: newPos.side === 'LONG' ? 'BUY' : 'SELL',
      size: newPos.size,
      price: newPos.entryPrice,
      leverage: newPos.leverage,
      marginRequired: newPos.margin,
      currentOpenPositionsCount: positions.length,
    },
    balanceSheet
  )

  if (!riskCheck.allowed) {
    playStopLossSound()
    showToast(`Order Blocked by Risk Engine: ${riskCheck.reason}`)
    return
  }

  playOrderFilledSound()
  setPositions((prev) => [newPos, ...prev])
  setPortfolio((prev) => ({
    ...prev,
    tradeCapital: Number((prev.tradeCapital + newPos.margin).toFixed(2)),
  }))
  showToast(`Order Filled: ${newPos.side} ${newPos.size} ${newPos.symbol} @ $${newPos.entryPrice.toLocaleString()}`)
}
```

#### Point 4: Accurate PnL Realization on Manual Close (`handleClosePosition`)
```typescript
const handleClosePosition = (positionId: string) => {
  const target = positions.find((p) => p.id === positionId)
  if (!target) return

  if (target.unrealizedPnl >= 0) {
    playTakeProfitSound()
  } else {
    playStopLossSound()
  }

  setPositions((prev) => prev.filter((p) => p.id !== positionId))
  setPortfolio((prev) => ({
    ...prev,
    totalBalance: Number((prev.totalBalance + target.unrealizedPnl).toFixed(2)),
    realizedProfit: Number((prev.realizedProfit + target.unrealizedPnl).toFixed(2)),
    tradeCapital: Math.max(0, Number((prev.tradeCapital - target.margin).toFixed(2))),
  }))

  const closeTrade: TradeOrder = {
    id: `tx-close-${Date.now()}`,
    assetSymbol: target.symbol,
    type: target.side === 'LONG' ? 'SELL' : 'BUY',
    amount: target.size,
    price: target.markPrice,
    total: target.size * target.markPrice,
    time: 'Just now',
    status: 'COMPLETED',
    pnl: target.unrealizedPnl,
    aiStrategy: 'Manual Position Close',
  }

  setTrades((prev) => [closeTrade, ...prev])
  showToast(`Position Closed: Realized PnL ${target.unrealizedPnl >= 0 ? '+' : ''}$${target.unrealizedPnl.toFixed(2)}`)
}
```

---

### 4.4 UI Updates

1. **`BotControlModal.tsx`**:
   - Add prop `balanceSheet?: AccountBalanceSheet`.
   - Update Circuit Breaker badge (lines 70–74):
     ```tsx
     <div className="bg-[#121624] p-3 rounded-xl border border-white/5">
       <div className="text-[11px] text-gray-400">Circuit Breaker Protection</div>
       {balanceSheet?.isCircuitBreakerTripped ? (
         <div className="text-lg font-bold text-rose-400 font-mono-num flex items-center gap-1 animate-pulse">
           <AlertTriangle className="w-4 h-4 text-rose-400" /> LOCKED (-{balanceSheet.dailyDrawdownPct.toFixed(1)}%)
         </div>
       ) : (
         <div className="text-lg font-bold text-emerald-400 font-mono-num flex items-center gap-1">
           <CheckCircle2 className="w-4 h-4 text-emerald-400" /> ACTIVE ({balanceSheet?.dailyDrawdownPct.toFixed(1) ?? '0.0'}% / 4.5%)
         </div>
       )}
     </div>
     ```
2. **`TradingDashboard.tsx`**:
   - Receive `balanceSheet: AccountBalanceSheet`.
   - Update the 4 Financial Metric cards:
     - Card 1: `Total Equity`: `{formatCurrency(balanceSheet.equity)}` with subtext `Cash: {formatCurrency(balanceSheet.cashBalance)}`.
     - Card 2: `Margin In Use`: `{formatCurrency(balanceSheet.marginUsed)}` with `Free Margin: {formatCurrency(balanceSheet.freeMargin)}`.
     - Card 3: `Daily Drawdown`: `-{balanceSheet.dailyDrawdownPct.toFixed(2)}%` with status badge `{balanceSheet.isCircuitBreakerTripped ? 'LOCKED' : 'PROTECTED'}`.
     - Card 4: `Net Realized Profit`: `{formatCurrency(portfolio.realizedProfit)}`.
   - Pass `freeMargin={balanceSheet.freeMargin}` and `isCircuitBreakerTripped={balanceSheet.isCircuitBreakerTripped}` to `OrderEntryWidget`.
3. **`OrderEntryWidget.tsx`**:
   - Disable order submit button and render warning banner when `isCircuitBreakerTripped === true`:
     `"Trading Locked: Daily Max Drawdown Circuit Breaker Active"`.
   - Validate `requiredMargin <= freeMargin` in UI and show warning when insufficient.
4. **`PortfolioView.tsx`**:
   - Receive `balanceSheet: AccountBalanceSheet`.
   - Card 1: `Total Net Worth / Equity`: `{formatCurrency(balanceSheet.equity)}`.
   - Scorecard: `Max Drawdown Breaker`: `{balanceSheet.isCircuitBreakerTripped ? 'TRIPPED' : 'ARMED'} (-${balanceSheet.dailyDrawdownPct.toFixed(1)}% / 4.5%)`.
   - Telemetry: Display `Margin Level: ${balanceSheet.marginLevelPct.toFixed(1)}%`, `Free Margin: ${formatCurrency(balanceSheet.freeMargin)}`.
5. **`Navbar.tsx`**:
   - Show `equity` in wallet pill: `${formatCurrency(balanceSheet.equity)}`.
   - If circuit breaker is tripped, display warning icon in navbar.

---

## 5. Verification Method

### 5.1 Automated Vitest Test Commands
Run the existing opaque-box Vitest suites covering F12 and F13:
```bash
# 1. Tier 1: Core Risk Engine & Circuit Breaker Logic
pnpm test src/test/tier1_features/riskCircuitBreaker.test.ts

# 2. Tier 3: Pairwise Position Mark Price & Equity Synchronization on Ticks
pnpm test src/test/tier3_pairwise/tickFeedPositionSync.test.ts

# 3. Tier 4: Real-world cascading loss scenario tripping 4.5% Circuit Breaker
pnpm test src/test/tier4_realworld/cryptoCascadeCircuitTrip.test.ts

# 4. Tier 3: Bot Signal Execution vs Circuit Breaker Lockout
pnpm test src/test/tier3_pairwise/botSignalCircuitBreaker.test.ts

# 5. Tier 3: Order Sizing, Free Margin Verification, Slippage & Commissions
pnpm test src/test/tier3_pairwise/orderMarginSlippage.test.ts

# 6. Tier 2: Boundary Cases (100x leverage ceiling, exact margin boundary, negative cash clamp)
pnpm test src/test/tier2_boundaries/extremeLeverageMargin.test.ts

# 7. Complete Test Suite Run (all 191+ tests)
pnpm test --run
```

### 5.2 Build & Lint Verification
```bash
# Verify TypeScript compilation and Vite build with exit code 0
pnpm build

# Verify Oxlint cleanliness with zero errors
pnpm lint
```

### 5.3 Invalidation Conditions
This investigation and design report will be invalidated if:
1. `checkCircuitBreaker` does not trip when daily drawdown equals or exceeds 4.5% (e.g. at 4.5% or 5.2%).
2. `recalculateBalanceSheet` allows `freeMargin` to become negative or produces `NaN` on zero margin used.
3. Orders with `marginRequired > freeMargin` are permitted by `evaluateOrderRisk`.
4. High-water mark `peakDailyEquity` drops when equity decreases instead of remaining anchored at the daily peak.
5. `pnpm build` fails due to missing exports in `src/engine/riskEngine.ts` or type mismatches in `src/types/trading.ts`.
