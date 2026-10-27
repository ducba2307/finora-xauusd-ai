# Milestone 3 Iteration 2 Investigation Report: Automated Exit Settlement & Trailing Distance Precision in `src/App.tsx`

**Agent**: `explorer_m3_iter2_2` (`teamwork_preview_explorer`)  
**Workspace Root**: `d:\VIBECODE\finora-trading-ai`  
**Working Directory**: `d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m3_iter2_2`  
**Target File**: `src/App.tsx`  

---

## 1. Observation

### Observation 1.1: Stale PnL & Bypassed Settlement on Automated Exits in `src/App.tsx`
- **Location**: `src/App.tsx` lines 176–213:
  ```typescript
  // Stage 6: Exit Trigger Evaluation
  const exitCheck = checkPositionExitTriggers(currentPos, mark)
  if (exitCheck.shouldExit) {
    hasChanges = true
    const realizedPnl = currentPos.unrealizedPnl
    if (exitCheck.exitReason === 'TP_HIT') {
      playTakeProfitSound()
      showToast(`Take Profit Hit: ${currentPos.symbol} closed at $${exitCheck.exitPrice.toLocaleString()} (+${realizedPnl.toFixed(2)} USD)`)
    } else if (exitCheck.exitReason === 'SL_HIT') {
      playStopLossSound()
      showToast(`Stop Loss Hit: ${currentPos.symbol} closed at $${exitCheck.exitPrice.toLocaleString()} (${realizedPnl.toFixed(2)} USD)`)
    } else {
      playStopLossSound()
      showToast(`Liquidation Triggered: ${currentPos.symbol} closed at $${exitCheck.exitPrice.toLocaleString()} (${realizedPnl.toFixed(2)} USD)`)
    }

    setPortfolio((prev) => ({
      ...prev,
      totalBalance: Number((prev.totalBalance + realizedPnl).toFixed(2)),
      realizedProfit: Number((prev.realizedProfit + realizedPnl).toFixed(2)),
      tradeCapital: Math.max(0, Number((prev.tradeCapital - currentPos.margin).toFixed(2))),
    }))

    const exitTrade: TradeOrder = {
      id: `tx-exit-${Date.now()}-${currentPos.id}`,
      assetSymbol: currentPos.symbol,
      type: currentPos.side === 'LONG' ? 'SELL' : 'BUY',
      amount: currentPos.size,
      price: exitCheck.exitPrice,
      total: Number((currentPos.size * exitCheck.exitPrice).toFixed(2)),
      time: 'Just now',
      status: 'COMPLETED',
      pnl: realizedPnl,
      aiStrategy: `Automated Exit (${exitCheck.exitReason})`,
    }
    setTrades((prev) => [exitTrade, ...prev])
    continue
  }
  ```
- **Finding**:
  1. `src/App.tsx` line 27 imports `{ checkPositionExitTriggers, updateTrailingStop, processOrderPipeline } from './engine/orderLifecycle'`, but does **not** import `settlePositionExit`.
  2. When `exitCheck.shouldExit` is true, the handler reads `currentPos.unrealizedPnl`. Because point-in-time PnL re-calculation occurs at lines 216–224 (below line 212 `continue`), `currentPos.unrealizedPnl` represents the PnL calculated from the *prior* tick mark price, or `$0.00` if the position was opened on the current tick or had zero prior delta.
  3. The handler manually constructs `exitTrade` rather than utilizing `settlement.closedTrade` from `settlePositionExit(currentPos, exitCheck.exitPrice, exitCheck.exitReason)`.
  4. The position's fill price and contract multiplier (e.g. 100,000 for Forex, 100 for Gold) are ignored, corrupting `portfolio.totalBalance` and `portfolio.realizedProfit`.

### Observation 1.2: Trailing Stop Distance Truncation to 0.00 in `src/App.tsx` Line 168
- **Location**: `src/App.tsx` lines 166–174:
  ```typescript
  // Stage 5: Trailing stop ratchet if configured
  let currentPos = pos
  if (pos.slPrice && pos.slPrice > 0) {
    const trailDist = pos.symbol.includes('XAU') ? 8.0 : Number((pos.entryPrice * 0.003).toFixed(2))
    const trailingUpdate = updateTrailingStop(currentPos, mark, trailDist)
    if (trailingUpdate.wasRatchetUpdated) {
      hasChanges = true
      currentPos = { ...currentPos, slPrice: trailingUpdate.updatedSlPrice }
    }
  }
  ```
- **Finding**:
  1. For Forex pairs such as `EUR/USD` (entry ~`1.0845`) and `GBP/USD` (entry ~`1.2984`):
     - `1.0845 * 0.003 = 0.0032535`
     - `Number((1.0845 * 0.003).toFixed(2))` evaluates to `0` (`0.00`).
  2. In `src/engine/orderLifecycle.ts` lines 238–241:
     ```typescript
     export function updateTrailingStop(
       position: Position,
       currentMarkPrice: number,
       trailDistance: number,
       activationDistance: number = 0
     ): TrailingStopResult {
       if (trailDistance <= 0 || !Number.isFinite(currentMarkPrice)) {
         return { updatedSlPrice: position.slPrice ?? 0, wasRatchetUpdated: false }
       }
     ```
  3. Because `trailDist` is `0`, `trailDistance <= 0` triggers immediately, returning `wasRatchetUpdated: false`. Trailing stop ratchets are completely disabled for Forex positions in the live UI loop.

### Observation 1.3: Contract Multiplier & Settlement Validation in `orderLifecycle.ts`
- **Location**: `src/engine/orderLifecycle.ts` lines 310–354:
  ```typescript
  export function settlePositionExit(
    position: Position,
    exitPrice: number,
    exitReason: ExitReason,
    commissionUsd: number = 0
  ): ClosedPositionSettlement
  ```
- **Execution Test**:
  - Running `settlePositionExit` on a 1.0 lot `EUR/USD` Long position (entry 1.0845, exit 1.0895, margin $2169.00):
    ```json
    {
      "positionId": "pos_eur",
      "exitPrice": 1.0895,
      "exitReason": "TP_HIT",
      "realizedPnl": 500,
      "realizedPnlPct": 23.05,
      "releasedMargin": 2169,
      "closedTrade": {
        "id": "tx_close_pos_eur_...",
        "assetSymbol": "EUR/USD",
        "type": "SELL",
        "amount": 1,
        "price": 1.0895,
        "total": 1.09,
        "time": "Just now",
        "status": "COMPLETED",
        "pnl": 500,
        "aiStrategy": "Automated Exit (TP_HIT)",
        "market": "FOREX"
      }
    }
    ```
  - Proves that `settlePositionExit` returns exact fill PnL (`$500.00`), exact released margin (`$2169.00`), and a pre-packaged institutional `closedTrade`.

---

## 2. Logic Chain

1. **Defect Causality (Stale PnL)**:
   - In `src/App.tsx`, the tick monitor loop checks `checkPositionExitTriggers(currentPos, mark)`. When this returns `shouldExit: true` (e.g. `TP_HIT` at 1.0895), `realizedPnl` was taken directly from `currentPos.unrealizedPnl`.
   - In `App.tsx`, the mark price and PnL re-calculation logic (`calculatePositionPnl`) is located at lines 216–224, strictly *after* the exit handler which ends with `continue` (line 212).
   - Therefore, `currentPos.unrealizedPnl` at the moment of exit never includes the current tick's price delta, causing the position to settle with stale or zero PnL.
   - Calling `settlePositionExit(currentPos, exitCheck.exitPrice, exitReason)` calculates the exact fill PnL directly from `exitCheck.exitPrice - currentPos.entryPrice`, incorporating the contract multiplier and exchange rate.

2. **Defect Causality (Trailing Stop Truncation)**:
   - Forex quotes operate with 5 decimal places (pipette precision: 1 pip = 0.0001, 1 pipette = 0.00001).
   - Standard 0.3% trailing distance on EUR/USD ($1.0845) is $0.00325 (32.5 pips).
   - Calling `.toFixed(2)` on $0.00325 rounds it to `"0.00"`.
   - `updateTrailingStop` guards against non-positive distances via `trailDistance <= 0`.
   - By distinguishing asset categories:
     - **Forex**: 5 decimal places via `.toFixed(5)` with minimum clamp `Math.max(0.00001, ...)`.
     - **Gold**: $8.00 fixed distance (or 2 decimal places).
     - **Crypto**: 2 decimal places via `.toFixed(2)` with minimum clamp `Math.max(0.01, ...)`.
   - Trailing distance is guaranteed to be strictly positive and accurately scaled for all asset types.

3. **Balance Sheet & Portfolio Synchronization**:
   - `settlement.realizedPnl` must be added to `portfolio.totalBalance` and `portfolio.realizedProfit`.
   - `settlement.releasedMargin` must be released from `portfolio.tradeCapital` (`Math.max(0, prev.tradeCapital - settlement.releasedMargin)`).
   - `settlement.closedTrade` must be prepended to `trades` state (`setTrades((prev) => [settlement.closedTrade, ...prev])`).
   - Because `balanceSheet` in `App.tsx` is derived via `useMemo` from `positions, portfolio.totalBalance, peakDailyEquity, dailyStartEquity`, removing the closed position and updating `portfolio.totalBalance` automatically triggers a balance sheet recalculation on the next render cycle.

---

## 3. Caveats

- **Scope Boundary**: This investigation focuses strictly on `src/App.tsx` (automated exit settlement and trailing stop distance calculation). Complementary fixes for `isForex` USDT classification and notional calculation in `src/engine/orderLifecycle.ts` and `src/engine/riskEngine.ts` are managed under peer investigation `explorer_m3_iter2_1`.
- **Manual Close Harmonization**: While the prompt specifies the automated exit closure (`checkPositionExitTriggers`), `handleClosePosition` (lines 380–413) also closes positions manually. An optional drop-in snippet is provided below to ensure manual closures match automated exit settlement standards.
- **No Direct Source Changes**: Per Teamwork protocol, this agent operates in read-only investigation mode. No source code has been altered directly.

---

## 4. Conclusion & Drop-in Replacement Code

### Remediation Plan:
1. **Update Imports in `src/App.tsx` (Line 27)**:
   Add `settlePositionExit` and `type ExitReason` to the import list from `./engine/orderLifecycle`.
2. **Update Trailing Distance Calculation in `src/App.tsx` (Lines 166–175)**:
   Detect asset type and compute high-precision trailing distance (5 decimals for Forex, 2 for Crypto/Gold).
3. **Update Automated Exit Trigger Handler in `src/App.tsx` (Lines 176–213)**:
   Call `settlePositionExit`, credit `settlement.realizedPnl` to balance and profit, release `settlement.releasedMargin`, and log `settlement.closedTrade`.

---

### Drop-in Replacement Chunk 1: Imports (`src/App.tsx` Line 27)

#### Target Lines: 27
```typescript
<<<< BEFORE (Line 27)
import { checkPositionExitTriggers, updateTrailingStop, processOrderPipeline } from './engine/orderLifecycle'
====
>>>> AFTER (Line 27)
import { checkPositionExitTriggers, updateTrailingStop, processOrderPipeline, settlePositionExit, type ExitReason } from './engine/orderLifecycle'
```

---

### Drop-in Replacement Chunk 2: Trailing Stop & Automated Exit Monitor (`src/App.tsx` Lines 165–213)

#### Target Lines: 165–213
```typescript
<<<< BEFORE (Lines 165–213)
          // Stage 5: Trailing stop ratchet if configured
          let currentPos = pos
          if (pos.slPrice && pos.slPrice > 0) {
            const trailDist = pos.symbol.includes('XAU') ? 8.0 : Number((pos.entryPrice * 0.003).toFixed(2))
            const trailingUpdate = updateTrailingStop(currentPos, mark, trailDist)
            if (trailingUpdate.wasRatchetUpdated) {
              hasChanges = true
              currentPos = { ...currentPos, slPrice: trailingUpdate.updatedSlPrice }
            }
          }

          // Stage 6: Exit Trigger Evaluation
          const exitCheck = checkPositionExitTriggers(currentPos, mark)
          if (exitCheck.shouldExit) {
            hasChanges = true
            const realizedPnl = currentPos.unrealizedPnl
            if (exitCheck.exitReason === 'TP_HIT') {
              playTakeProfitSound()
              showToast(`Take Profit Hit: ${currentPos.symbol} closed at $${exitCheck.exitPrice.toLocaleString()} (+${realizedPnl.toFixed(2)} USD)`)
            } else if (exitCheck.exitReason === 'SL_HIT') {
              playStopLossSound()
              showToast(`Stop Loss Hit: ${currentPos.symbol} closed at $${exitCheck.exitPrice.toLocaleString()} (${realizedPnl.toFixed(2)} USD)`)
            } else {
              playStopLossSound()
              showToast(`Liquidation Triggered: ${currentPos.symbol} closed at $${exitCheck.exitPrice.toLocaleString()} (${realizedPnl.toFixed(2)} USD)`)
            }

            setPortfolio((prev) => ({
              ...prev,
              totalBalance: Number((prev.totalBalance + realizedPnl).toFixed(2)),
              realizedProfit: Number((prev.realizedProfit + realizedPnl).toFixed(2)),
              tradeCapital: Math.max(0, Number((prev.tradeCapital - currentPos.margin).toFixed(2))),
            }))

            const exitTrade: TradeOrder = {
              id: `tx-exit-${Date.now()}-${currentPos.id}`,
              assetSymbol: currentPos.symbol,
              type: currentPos.side === 'LONG' ? 'SELL' : 'BUY',
              amount: currentPos.size,
              price: exitCheck.exitPrice,
              total: Number((currentPos.size * exitCheck.exitPrice).toFixed(2)),
              time: 'Just now',
              status: 'COMPLETED',
              pnl: realizedPnl,
              aiStrategy: `Automated Exit (${exitCheck.exitReason})`,
            }
            setTrades((prev) => [exitTrade, ...prev])
            continue
          }
====
>>>> AFTER (Lines 165–213)
          // Stage 5: Trailing stop ratchet if configured
          let currentPos = pos
          if (pos.slPrice && pos.slPrice > 0) {
            const isGold = pos.symbol.includes('XAU')
            const isCrypto = pos.symbol.includes('USDT') || pos.symbol.includes('BTC') || pos.symbol.includes('ETH') || pos.symbol.includes('SOL')
            const isForex = !isGold && (pos.market === 'FOREX' || (!isCrypto && (pos.symbol.includes('EUR') || pos.symbol.includes('GBP') || pos.symbol.includes('JPY') || pos.symbol.endsWith('/USD') || pos.symbol.startsWith('USD/'))))

            const trailDist = isGold
              ? 8.0
              : isForex
              ? Math.max(0.00001, Number((pos.entryPrice * 0.003).toFixed(5)))
              : Math.max(0.01, Number((pos.entryPrice * 0.003).toFixed(2)))

            const trailingUpdate = updateTrailingStop(currentPos, mark, trailDist)
            if (trailingUpdate.wasRatchetUpdated) {
              hasChanges = true
              currentPos = { ...currentPos, slPrice: trailingUpdate.updatedSlPrice }
            }
          }

          // Stage 6: Exit Trigger Evaluation
          const exitCheck = checkPositionExitTriggers(currentPos, mark)
          if (exitCheck.shouldExit) {
            hasChanges = true
            const exitReason: ExitReason = exitCheck.exitReason ?? 'MANUAL_CLOSE'
            const settlement = settlePositionExit(currentPos, exitCheck.exitPrice, exitReason)
            const realizedPnl = settlement.realizedPnl
            const pnlFormatted = `${realizedPnl >= 0 ? '+' : ''}${realizedPnl.toFixed(2)} USD`

            if (exitCheck.exitReason === 'TP_HIT') {
              playTakeProfitSound()
              showToast(`Take Profit Hit: ${currentPos.symbol} closed at $${exitCheck.exitPrice.toLocaleString()} (${pnlFormatted})`)
            } else if (exitCheck.exitReason === 'SL_HIT') {
              playStopLossSound()
              showToast(`Stop Loss Hit: ${currentPos.symbol} closed at $${exitCheck.exitPrice.toLocaleString()} (${pnlFormatted})`)
            } else {
              playStopLossSound()
              showToast(`Liquidation Triggered: ${currentPos.symbol} closed at $${exitCheck.exitPrice.toLocaleString()} (${pnlFormatted})`)
            }

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

---

### Drop-in Replacement Chunk 3 (Optional Enhancement): Manual Close Handler (`src/App.tsx` Lines 380–413)

```typescript
<<<< BEFORE (Lines 380–413)
  // Position closed handler
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
      total: Number((target.size * target.markPrice).toFixed(2)),
      time: 'Just now',
      status: 'COMPLETED',
      pnl: target.unrealizedPnl,
      aiStrategy: 'Manual Position Close',
    }

    setTrades((prev) => [closeTrade, ...prev])
    showToast(`Position Closed: Realized PnL ${target.unrealizedPnl >= 0 ? '+' : ''}$${target.unrealizedPnl.toFixed(2)}`)
  }
====
>>>> AFTER (Lines 380–413)
  // Position closed handler
  const handleClosePosition = (positionId: string) => {
    const target = positions.find((p) => p.id === positionId)
    if (!target) return

    const settlement = settlePositionExit(target, target.markPrice, 'MANUAL_CLOSE')
    const realizedPnl = settlement.realizedPnl

    if (realizedPnl >= 0) {
      playTakeProfitSound()
    } else {
      playStopLossSound()
    }

    setPositions((prev) => prev.filter((p) => p.id !== positionId))
    setPortfolio((prev) => ({
      ...prev,
      totalBalance: Number((prev.totalBalance + settlement.realizedPnl).toFixed(2)),
      realizedProfit: Number((prev.realizedProfit + settlement.realizedPnl).toFixed(2)),
      tradeCapital: Math.max(0, Number((prev.tradeCapital - settlement.releasedMargin).toFixed(2))),
    }))

    const closeTrade: TradeOrder = {
      ...settlement.closedTrade,
      aiStrategy: 'Manual Position Close',
    }

    setTrades((prev) => [closeTrade, ...prev])
    showToast(`Position Closed: Realized PnL ${realizedPnl >= 0 ? '+' : ''}$${realizedPnl.toFixed(2)}`)
  }
```

---

## 5. Verification Method

### Step 1: Verify Trailing Distance Formula Output
Run in Node.js / terminal:
```bash
node -e "const p = 1.0845; console.log('FX trail dist:', Math.max(0.00001, Number((p * 0.003).toFixed(5)))); console.log('Crypto trail dist:', Math.max(0.01, Number((114884 * 0.003).toFixed(2))));"
```
**Expected Output**:
- `FX trail dist: 0.00325` (positive, non-zero, exact 5-decimal precision)
- `Crypto trail dist: 344.65` (positive, non-zero, 2-decimal precision)

### Step 2: Verify `settlePositionExit` Output on Automated Exits
Run using `npx tsx`:
```bash
npx tsx -e "import { settlePositionExit } from './src/engine/orderLifecycle'; const pos = { id: 'p1', symbol: 'EUR/USD', side: 'LONG', size: 1.0, entryPrice: 1.0845, markPrice: 1.0845, leverage: 50, margin: 2169, unrealizedPnl: 0, unrealizedPnlPct: 0, market: 'FOREX' }; const s = settlePositionExit(pos, 1.0895, 'TP_HIT'); console.log('PnL:', s.realizedPnl, 'Released Margin:', s.releasedMargin, 'Trade:', s.closedTrade.pnl);"
```
**Expected Output**:
- `PnL: 500`
- `Released Margin: 2169`
- `Trade: 500`

### Step 3: Run Full Test Suite & TypeScript Build
```bash
pnpm test
pnpm build
pnpm lint
```
**Expected Outcome**:
- `pnpm test`: 28 test files passed, 250+ tests passed, 0 failures.
- `pnpm build`: Exit code 0, 0 compilation errors.
- `pnpm lint`: Exit code 0, 0 errors.
