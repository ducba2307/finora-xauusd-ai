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
