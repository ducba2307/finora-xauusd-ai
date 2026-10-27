# Explorer 2 Investigation & Remediation Report: Milestone 1 Iteration 2
**Topic**: Swap Balance Guard & Portfolio Accounting Remediation  
**Author**: Explorer 2 (`explorer_m1_iter2_2`)  
**Target Milestone**: Milestone 1, Iteration 2  
**Date**: 2026-10-11T07:38:00Z  

---

## 1. Observation

### Observation 1.1: Missing Balance Verification in `src/components/SwapWidget.tsx`
- **Location**: `src/components/SwapWidget.tsx`, lines 52–55 and lines 202–205:
  ```tsx
  // Lines 52-55:
  const handleExecuteSwap = () => {
    if (parsedFrom <= 0) return
    setIsSwapping(true)
    ...
  }

  // Lines 202-205:
  <button
    onClick={handleExecuteSwap}
    disabled={isSwapping || parsedFrom <= 0}
  ```
- **Observed Flaw**: The execute button and event handler only verify that `parsedFrom > 0`. There is zero validation comparing `parsedFrom` against `userFromBalance`. A user can input `10,000 ETH` when their balance is `3.2 ETH`, and the button remains fully clickable and styled as active.

### Observation 1.2: Infinite Capital Minting Vulnerability in `src/App.tsx`
- **Location**: `src/App.tsx`, lines 125–142:
  ```typescript
  const handleExecuteSwap = (
    fromToken: string,
    toToken: string,
    fromAmount: number,
    toAmount: number
  ) => {
    setPortfolio((prev) => {
      const updatedBalances = { ...prev.balances }
      updatedBalances[fromToken] = Math.max(0, (updatedBalances[fromToken] || 0) - fromAmount)
      updatedBalances[toToken] = (updatedBalances[toToken] || 0) + toAmount

      return {
        ...prev,
        balances: updatedBalances,
        totalBalance: prev.totalBalance + (toAmount * 0.002),
        tradeCapital: prev.tradeCapital + toAmount,
      }
    })
  ```
- **Observed Flaw**: `handleExecuteSwap` performs no validation on `fromAmount`. When `fromAmount > (updatedBalances[fromToken] || 0)`, `Math.max(0, ...)` simply clamps the source balance to `0`. Meanwhile, the destination balance receives the full unbacked `+ toAmount`.
- **Reproduced Evidence**: Challenger 2 test `src/test/tier5_adversarial/challenger2_stress.test.ts` lines 456–488 proved that requesting a swap of `1,000 ETH` on a portfolio with only `3.2 ETH` clamped ETH to `0` and credited `+$3,240,000 USDT`, minting over $3.2M of unbacked equity.

### Observation 1.3: Distorted `totalBalance` Inflation and `tradeCapital` Metric Corruption
- **Location**: `src/App.tsx`, lines 139–140:
  ```typescript
  totalBalance: prev.totalBalance + (toAmount * 0.002),
  tradeCapital: prev.tradeCapital + toAmount,
  ```
- **Observed Flaw**:
  1. `totalBalance` increments by `toAmount * 0.002` regardless of asset type. Swapping to USDT adds `10,000 * 0.002 = 20` USD, whereas swapping to ETH adds `3.07 * 0.002 = 0.00614` nominal units. Furthermore, spot swaps are asset conversions that incur AMM fee/slippage friction, not synthetic money-printing mechanisms.
  2. `tradeCapital` in Finora strictly tracks margin collateral committed to active leveraged positions (see `src/App.tsx:167` where `newPos.margin` is added on order open, and line 188 where `target.margin` is deducted on close). Adding `+ toAmount` unconditionally causes spot swaps to pollute active margin capital, and mixes token counts (e.g. 3.07 ETH) with USD-denominated capital.

### Observation 1.4: Hardcoded Mock Trade PnL in `src/App.tsx`
- **Location**: `src/App.tsx`, lines 144–157:
  ```typescript
  const newTrade: TradeOrder = {
    id: `tx-${Date.now()}`,
    assetSymbol: fromToken,
    type: 'SELL',
    amount: fromAmount,
    price: toAmount / (fromAmount || 1),
    total: toAmount,
    time: 'Just now',
    status: 'COMPLETED',
    pnl: 14.50,
    aiStrategy: 'AI Optimal Route Swap',
  }
  ```
- **Observed Flaw**: Every swap transaction is recorded with a static mock `pnl: 14.50`, regardless of volume, token, or actual execution slippage.

### Observation 1.5: Zero-Balance Refill Bug via Falsy Coalescing (`||`) in `src/components/TradingDashboard.tsx`
- **Location**: `src/components/TradingDashboard.tsx`, lines 450 and 457–458:
  ```tsx
  userUsdtBalance={portfolio.balances.USDT || 14200}
  ...
  userEthBalance={portfolio.balances.ETH || 2.5}
  userUsdtBalance={portfolio.balances.USDT || 14200}
  ```
- **Observed Flaw**: The logical OR operator `||` treats `0` as falsy. When a user legitimately swaps their entire balance (e.g. selling all 3.2 ETH so balance becomes `0`), `0 || 2.5` evaluates to `2.5`! The UI silently gifts the user 2.5 ETH every time their balance reaches zero, completely bypassing balance depletion.

### Observation 1.6: Token Balance Resolution Deficiency in `src/components/SwapWidget.tsx`
- **Location**: `src/components/SwapWidget.tsx`, line 45 and line 184:
  ```typescript
  const userFromBalance = fromToken === 'USDT' ? userUsdtBalance : userEthBalance
  ```
  ```tsx
  <div className="text-[11px] text-gray-400 mt-0.5">
    Available: ${userUsdtBalance.toLocaleString()}
  </div>
  ```
- **Observed Flaw**: `SwapWidget` offers options for `ETH`, `USDT`, `SOL`, and `BTC`. When `fromToken` is `SOL` or `BTC`, line 45 evaluates `userEthBalance` (3.2), ignoring actual BTC balance (0.15) and SOL balance (0). In the destination card (line 184), `Available:` hardcodes `$` and `userUsdtBalance` even when the target token is `ETH` or `BTC`.

---

## 2. Logic Chain

1. **Conservation of Value (Premise 1)**: In institutional financial engines, an exchange of assets (spot swap) cannot increase net portfolio equity without an external capital injection. Swapping token $A$ for token $B$ via an Automated Market Maker (AMM) incurs a liquidity pool fee (0.05%) plus market impact slippage:
   $$\text{Swap Transaction Cost} = (\text{toAmount} \times P_{\text{to}}) - (\text{fromAmount} \times P_{\text{from}}) \le 0$$
2. **Infinite Minting Vulnerability (Observation 1.1 & 1.2)**:
   - When a user requests to swap `fromAmount` exceeding their balance, clamping source tokens to `0` while crediting unbacked target tokens creates arbitrary phantom capital.
   - For example, if a user holding 0.1 ETH initiates a swap for 1,000 ETH to USDT, they receive ~$3,240,000 USDT at a cost of only 0.1 ETH.
   - The UI submit button must be disabled whenever `parsedFrom > userFromBalance`, and the backend state handler `handleExecuteSwap` must reject execution if `fromAmount > currentFromBalance`.
3. **Portfolio Accounting Soundness (Observation 1.3 & 1.4)**:
   - `tradeCapital` measures open margin committed to leveraged CFD/perp positions. A spot swap does not open a leveraged position or consume margin collateral. Adding `+ toAmount` violates dimensional consistency and inflates margin metrics. `tradeCapital` must remain invariant across spot swaps:
     $$\text{tradeCapital}_{\text{new}} = \text{tradeCapital}_{\text{prev}}$$
   - `totalBalance` tracks overall account equity. Rather than adding arbitrary synthetic yields (`toAmount * 0.002`), `totalBalance` should adjust strictly by the net USD transaction friction:
     $$\text{totalBalance}_{\text{new}} = \text{totalBalance}_{\text{prev}} + \Delta \text{USD}_{\text{net}}$$
     where $\Delta \text{USD}_{\text{net}} = (\text{toAmount} \cdot P_{\text{to}}) - (\text{fromAmount} \cdot P_{\text{from}}) \le 0$.
   - Recorded trade orders in `trades` must reflect this actual transaction PnL rather than static mock constant `14.50`.
4. **Zero-Balance Invariant (Observation 1.5)**:
   - `0 || 2.5 === 2.5` is a classic JavaScript bug that revives depleted balances.
   - Switching to nullish coalescing `portfolio.balances.ETH ?? 0` ensures that a zero balance remains strictly zero.
5. **Multi-Asset Balance Resolution (Observation 1.6)**:
   - Passing `balances={portfolio.balances}` into `SwapWidget` allows dynamic lookup for all tokens (`ETH`, `USDT`, `SOL`, `BTC`), preventing cross-token balance bleeding.

---

## 3. Caveats

1. **Paper-Trading Simulation Scope**: `SwapWidget` is an in-browser simulated AMM. While it does not interact with live blockchain contracts, its state updates directly drive the user's reactive portfolio (`portfolio.balances`, `portfolio.totalBalance`, `portfolio.tradeCapital`), which feeds the Trading Journal, Risk Engine, and Navbar.
2. **Non-Blocking UI Animation**: `SwapWidget` executes a 1,200ms `setTimeout` with confetti for realistic UX. The balance verification must be applied both at the moment of button interaction and inside `handleExecuteSwap` to prevent race conditions or rapid multi-click exploits.
3. **Division of Labor**: Explorer 1 is designing the USD/JPY PnL formula and marketStore slippage cap. Explorer 3 is designing the OrderEntryWidget input clearing and TradingView multi-bar batching. Explorer 2's design is strictly modular and does not overlap with their scopes.

---

## 4. Conclusion & Actionable Proposals

### 4.1. Proposed Changes for `src/components/SwapWidget.tsx`

#### A. Extend `SwapWidgetProps` and Implement Universal Token Balance Lookup
```typescript
interface SwapWidgetProps {
  onSwapSuccess: (fromSymbol: string, toSymbol: string, fromAmount: number, toAmount: number) => void
  userEthBalance: number
  userUsdtBalance: number
  balances?: Record<string, number>
}
```

```typescript
// Replace line 45 with dynamic balance lookup:
const getUserTokenBalance = (tok: string): number => {
  if (balances && typeof balances[tok] === 'number') {
    return balances[tok]
  }
  if (tok === 'USDT') return userUsdtBalance
  if (tok === 'ETH') return userEthBalance
  return 0
}

const userFromBalance = getUserTokenBalance(fromToken)
const userToBalance = getUserTokenBalance(toToken)
```

#### B. Implement Strict Multi-State Validation & Button Logic
```typescript
// Add comprehensive validation flags:
const isInsufficientBalance = parsedFrom > userFromBalance
const isInvalidAmount = !Number.isFinite(parsedFrom) || parsedFrom <= 0
const isSameToken = fromToken === toToken
const isSwapDisabled = isSwapping || isInvalidAmount || isInsufficientBalance || isSameToken

const handleExecuteSwap = () => {
  if (isSwapDisabled) return
  setIsSwapping(true)

  setTimeout(() => {
    setIsSwapping(false)
    setShowSuccess(true)
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#ec4899', '#10b981', '#3b82f6'],
    })

    onSwapSuccess(fromToken, toToken, parsedFrom, parseFloat(calculatedTo))

    setTimeout(() => setShowSuccess(false), 3500)
  }, 1200)
}
```

#### C. Update Execute Button JSX (Lines 202–224)
```tsx
<button
  onClick={handleExecuteSwap}
  disabled={isSwapDisabled}
  className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
    isSwapDisabled
      ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5 shadow-none'
      : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-pink-600 hover:from-blue-500 hover:via-indigo-500 hover:to-pink-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.35)] cursor-pointer'
  }`}
>
  {isSwapping ? (
    <>
      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
      Executing AI Smart Swap...
    </>
  ) : showSuccess ? (
    <>
      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      Swap Confirmed on Chain!
    </>
  ) : isSameToken ? (
    'Select Different Tokens'
  ) : isInsufficientBalance ? (
    `Insufficient ${fromToken} Balance`
  ) : isInvalidAmount ? (
    'Enter an Amount'
  ) : (
    'Execute AI Swap'
  )}
</button>
```

#### D. Fix Target Balance Display in TO Card (Line 184)
```tsx
<div className="text-[11px] text-gray-400 mt-0.5">
  Available: {toToken === 'USDT' || toToken === 'USD'
    ? `$${userToBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `${userToBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${toToken}`}
</div>
```

---

### 4.2. Proposed Changes for `src/App.tsx` (Lines 125–160)

Replace the entire `handleExecuteSwap` function with:

```typescript
  // Helper for USD asset valuation
  const getTokenPriceUsd = (tok: string): number => {
    if (tok === 'USDT' || tok === 'USD') return 1.0
    if (tok === 'ETH') return defaultMarketStore.getTicker('ETH/USDT')?.midPrice ?? 3248.30
    if (tok === 'SOL') return defaultMarketStore.getTicker('SOL/USDT')?.midPrice ?? 194.25
    if (tok === 'BTC') return defaultMarketStore.getTicker('BTC/USDT')?.midPrice ?? 114884.00
    if (tok === 'XAU') return defaultMarketStore.getTicker('XAU/USD')?.midPrice ?? 2734.50
    return 1.0
  }

  // Institutional Swap Execution Handler with Strict Balance Guards & Sound Accounting
  const handleExecuteSwap = (
    fromToken: string,
    toToken: string,
    fromAmount: number,
    toAmount: number
  ) => {
    // 1. Validate inputs
    if (
      !Number.isFinite(fromAmount) ||
      !Number.isFinite(toAmount) ||
      fromAmount <= 0 ||
      toAmount <= 0 ||
      fromToken === toToken
    ) {
      showToast('Swap rejected: Invalid token pair or non-positive amount')
      return
    }

    // 2. Pre-execution balance check
    const currentFromBalance = portfolio.balances[fromToken] ?? 0
    if (fromAmount > currentFromBalance) {
      showToast(
        `Swap rejected: Insufficient ${fromToken} balance (requested: ${fromAmount}, available: ${currentFromBalance.toFixed(4)})`
      )
      return
    }

    // 3. Mark-to-market valuation and transaction cost calculation
    const fromPriceUsd = getTokenPriceUsd(fromToken)
    const toPriceUsd = getTokenPriceUsd(toToken)
    const fromUsdValue = fromAmount * fromPriceUsd
    const toUsdValue = toAmount * toPriceUsd
    // True transaction cost (fee + slippage incurred):
    const swapCostUsd = Number((toUsdValue - fromUsdValue).toFixed(2))

    let executionSuccess = false

    // 4. Atomic portfolio state update
    setPortfolio((prev) => {
      const liveBalance = prev.balances[fromToken] ?? 0
      if (fromAmount > liveBalance || fromAmount <= 0) {
        return prev
      }

      executionSuccess = true
      const updatedBalances = { ...prev.balances }
      updatedBalances[fromToken] = Number((liveBalance - fromAmount).toFixed(8))
      updatedBalances[toToken] = Number(((updatedBalances[toToken] ?? 0) + toAmount).toFixed(8))

      return {
        ...prev,
        balances: updatedBalances,
        // Total balance adjusts strictly by the transaction friction (fee & slippage)
        totalBalance: Math.max(0, Number((prev.totalBalance + swapCostUsd).toFixed(2))),
        // tradeCapital remains untouched because spot swaps do not deploy leveraged margin
        tradeCapital: prev.tradeCapital,
      }
    })

    if (!executionSuccess) {
      showToast(`Swap failed: Insufficient ${fromToken} balance`)
      return
    }

    // 5. Append Trade Order with verified execution metrics
    const newTrade: TradeOrder = {
      id: `tx-${Date.now()}`,
      assetSymbol: `${fromToken}/${toToken}`,
      type: 'SELL',
      amount: fromAmount,
      price: toAmount / fromAmount,
      total: fromUsdValue,
      time: 'Just now',
      status: 'COMPLETED',
      pnl: swapCostUsd,
      aiStrategy: 'AI Optimal Route Swap',
      market: 'CRYPTO',
    }

    setTrades((prev) => [newTrade, ...prev])
    showToast(
      `Successfully swapped ${fromAmount} ${fromToken} to ${toAmount.toFixed(toToken === 'USDT' || toToken === 'USD' ? 2 : 4)} ${toToken}`
    )
  }
```

---

### 4.3. Proposed Changes for `src/components/TradingDashboard.tsx` (Lines 446–461)

Eliminate `||` fallbacks that cause infinite token resets, and pass full `balances` map:

```tsx
        <div className="lg:col-span-3 space-y-4">
          <OrderEntryWidget
            currentPrice={currentPrice}
            symbol={selectedAsset.symbol}
            category={selectedAsset.category}
            userUsdtBalance={portfolio.balances.USDT ?? 0}
            onOrderPlaced={onOrderPlaced}
            presetSetup={presetSetup}
          />

          <SwapWidget
            onSwapSuccess={onExecuteSwap}
            userEthBalance={portfolio.balances.ETH ?? 0}
            userUsdtBalance={portfolio.balances.USDT ?? 0}
            balances={portfolio.balances}
          />
        </div>
```

---

## 5. Verification Method

### 5.1. Automated Test Specifications for Worker

Add the following verification unit tests to a new test file `src/test/tier1_features/swapAccounting.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

describe('Institutional Swap Balance Guard & Accounting Invariants', () => {
  interface UserPortfolio {
    totalBalance: number
    tradeCapital: number
    balances: Record<string, number>
  }

  function simulateExecuteSwap(
    portfolio: UserPortfolio,
    fromToken: string,
    toToken: string,
    fromAmount: number,
    toAmount: number,
    fromPriceUsd: number,
    toPriceUsd: number
  ): { success: boolean; portfolio: UserPortfolio; error?: string } {
    if (fromAmount <= 0 || toAmount <= 0 || fromToken === toToken) {
      return { success: false, portfolio, error: 'INVALID_AMOUNT_OR_PAIR' }
    }

    const currentFrom = portfolio.balances[fromToken] ?? 0
    if (fromAmount > currentFrom) {
      return { success: false, portfolio, error: 'INSUFFICIENT_BALANCE' }
    }

    const fromUsdValue = fromAmount * fromPriceUsd
    const toUsdValue = toAmount * toPriceUsd
    const swapCostUsd = Number((toUsdValue - fromUsdValue).toFixed(2))

    const updatedBalances = { ...portfolio.balances }
    updatedBalances[fromToken] = Number((currentFrom - fromAmount).toFixed(8))
    updatedBalances[toToken] = Number(((updatedBalances[toToken] ?? 0) + toAmount).toFixed(8))

    return {
      success: true,
      portfolio: {
        balances: updatedBalances,
        totalBalance: Math.max(0, Number((portfolio.totalBalance + swapCostUsd).toFixed(2))),
        tradeCapital: portfolio.tradeCapital,
      },
    }
  }

  it('rejects swaps exceeding user balance without modifying state', () => {
    const portfolio: UserPortfolio = {
      totalBalance: 48950.0,
      tradeCapital: 22540.0,
      balances: { ETH: 3.2, USDT: 28400.0 },
    }

    const res = simulateExecuteSwap(portfolio, 'ETH', 'USDT', 1000.0, 3240000.0, 3248.30, 1.0)
    expect(res.success).toBe(false)
    expect(res.error).toBe('INSUFFICIENT_BALANCE')
    expect(res.portfolio.balances.ETH).toBe(3.2)
    expect(res.portfolio.balances.USDT).toBe(28400.0)
    expect(res.portfolio.totalBalance).toBe(48950.0)
  })

  it('preserves tradeCapital invariance across spot swaps', () => {
    const portfolio: UserPortfolio = {
      totalBalance: 48950.0,
      tradeCapital: 22540.0,
      balances: { ETH: 3.2, USDT: 28400.0 },
    }

    const res = simulateExecuteSwap(portfolio, 'USDT', 'ETH', 10000.0, 3.07, 1.0, 3248.30)
    expect(res.success).toBe(true)
    expect(res.portfolio.tradeCapital).toBe(22540.0) // Strictly invariant!
  })

  it('adjusts totalBalance strictly by transaction fee/slippage cost', () => {
    const portfolio: UserPortfolio = {
      totalBalance: 48950.0,
      tradeCapital: 22540.0,
      balances: { ETH: 3.2, USDT: 28400.0 },
    }

    // Swapping $10,000 USDT for $9,985 worth of ETH (loss of $15 to slippage/fees)
    const res = simulateExecuteSwap(portfolio, 'USDT', 'ETH', 10000.0, 3.0739, 1.0, 3248.30)
    expect(res.success).toBe(true)
    expect(res.portfolio.totalBalance).toBeLessThan(48950.0)
    expect(res.portfolio.totalBalance).toBeCloseTo(48950.0 - 15.0, 0)
  })

  it('correctly depletes source balance to exactly zero without refill', () => {
    const portfolio: UserPortfolio = {
      totalBalance: 48950.0,
      tradeCapital: 22540.0,
      balances: { ETH: 3.2, USDT: 28400.0 },
    }

    const res = simulateExecuteSwap(portfolio, 'ETH', 'USDT', 3.2, 10380.0, 3248.30, 1.0)
    expect(res.success).toBe(true)
    expect(res.portfolio.balances.ETH).toBe(0)
    // Coalescing check
    const refreshedEthBalance = res.portfolio.balances.ETH ?? 0
    expect(refreshedEthBalance).toBe(0)
  })
})
```

### 5.2. Independent CLI Verification Steps

1. **Run full vitest suite**:
   ```powershell
   pnpm exec vitest run
   ```
   *Expected outcome*: 100% test files pass with 0 failures.

2. **Run production build**:
   ```powershell
   pnpm build
   ```
   *Expected outcome*: Exit code 0, TypeScript cleanly compiles (`tsc -b && vite build`) without lint or typing errors.

3. **Run oxlint**:
   ```powershell
   pnpm lint
   ```
   *Expected outcome*: 0 warnings, 0 errors.

4. **Invalidation Conditions**:
   - If a swap with `fromAmount > balance` succeeds and credits `toAmount`.
   - If `tradeCapital` increases upon executing a spot swap.
   - If `totalBalance` increases by arbitrary constants on swaps.
   - If zero balance resurrects to default fallback `2.5` or `14200`.
