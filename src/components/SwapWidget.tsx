import React, { useState } from 'react'
import { ArrowDownUp, Settings, CheckCircle2, Zap } from 'lucide-react'
import confetti from 'canvas-confetti'
import { defaultMarketStore } from '../stores/marketStore'

interface SwapWidgetProps {
  onSwapSuccess: (fromSymbol: string, toSymbol: string, fromAmount: number, toAmount: number) => void
  userEthBalance: number
  userUsdtBalance: number
  balances?: Record<string, number>
}

export const SwapWidget = React.memo<SwapWidgetProps>(function SwapWidget({
  onSwapSuccess,
  userEthBalance,
  userUsdtBalance,
  balances,
}) {
  const [fromToken, setFromToken] = useState('ETH')
  const [toToken, setToToken] = useState('USDT')
  const [fromAmount, setFromAmount] = useState('2.5')
  const [isSwapping, setIsSwapping] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const getTokenPriceUsd = (tok: string): number => {
    if (tok === 'USDT') return 1.0
    if (tok === 'ETH') return defaultMarketStore.getTicker('ETH/USDT')?.midPrice ?? 3248.30
    if (tok === 'SOL') return defaultMarketStore.getTicker('SOL/USDT')?.midPrice ?? 194.25
    if (tok === 'BTC') return defaultMarketStore.getTicker('BTC/USDT')?.midPrice ?? 114884.00
    return 1.0
  }

  const fromPriceUsd = getTokenPriceUsd(fromToken)
  const toPriceUsd = getTokenPriceUsd(toToken)
  const rawRate = fromPriceUsd / (toPriceUsd || 1)
  const parsedFrom = parseFloat(fromAmount) || 0

  // Institutional Square-Root AMM Slippage Model (F03)
  const tradeUsdValue = parsedFrom * fromPriceUsd
  const poolDepthUsd = 10_000_000
  const baseFeePct = 0.0005 // 0.05%
  const impactPct = 0.0025 * Math.sqrt(Math.max(0, tradeUsdValue) / poolDepthUsd)
  const totalSlippagePct = Math.min(0.05, baseFeePct + impactPct)
  const effectiveRate = rawRate * (1 - totalSlippagePct)
  const calculatedTo = (parsedFrom * effectiveRate).toFixed(toToken === 'USDT' ? 2 : 4)

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

  const isInsufficientBalance = parsedFrom > userFromBalance
  const isInvalidAmount = !Number.isFinite(parsedFrom) || parsedFrom <= 0
  const isSameToken = fromToken === toToken
  const isSwapDisabled = isSwapping || isInvalidAmount || isInsufficientBalance || isSameToken

  const handleFlip = () => {
    setFromToken(toToken)
    setToToken(fromToken)
  }

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

  return (
    <div className="fin-card p-5 relative overflow-hidden flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
          <span>Swap Crypto</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-400 font-semibold border border-pink-500/20 flex items-center gap-1">
            <Zap className="w-2.5 h-2.5" /> AI Route
          </span>
        </h3>
        <button
          className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
          title="Slippage & routing settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* From Input Card */}
      <div className="bg-[#080a10] border border-white/5 rounded-2xl p-3.5 mb-2 relative hover:border-white/10 transition-colors">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
          <span className="font-semibold uppercase tracking-wider text-[11px]">FROM</span>
          <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-md text-[11px] text-gray-300">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>Avalanche C-Chain</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold border border-indigo-500/30 text-xs">
              {fromToken === 'ETH' ? 'Ξ' : fromToken === 'SOL' ? '◎' : fromToken === 'BTC' ? '₿' : '$'}
            </div>
            <select
              value={fromToken}
              onChange={(e) => setFromToken(e.target.value)}
              className="bg-transparent text-white font-bold text-base focus:outline-none cursor-pointer"
            >
              <option value="ETH" className="bg-[#0b0e14]">ETH</option>
              <option value="USDT" className="bg-[#0b0e14]">USDT</option>
              <option value="SOL" className="bg-[#0b0e14]">SOL</option>
              <option value="BTC" className="bg-[#0b0e14]">BTC</option>
            </select>
          </div>

          <div className="text-right">
            <input
              type="number"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              placeholder="0.0"
              className="w-28 text-right bg-transparent text-xl font-bold font-mono-num text-white focus:outline-none"
            />
            <div className="text-[11px] text-gray-400 mt-0.5">
              ≈ ${(parsedFrom * fromPriceUsd).toFixed(2)}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center text-[11px] text-gray-500 mt-2 pt-2 border-t border-white/5">
          <span>Balance: <strong className="text-gray-300 font-mono-num">{userFromBalance.toFixed(3)} {fromToken}</strong></span>
          <button
            onClick={() => setFromAmount(userFromBalance.toString())}
            className="text-pink-400 hover:text-pink-300 font-semibold cursor-pointer"
          >
            MAX
          </button>
        </div>
      </div>

      {/* Flip Button */}
      <div className="flex justify-center -my-2.5 z-10">
        <button
          onClick={handleFlip}
          className="w-8 h-8 rounded-full bg-[#141824] border border-white/10 hover:border-pink-500/50 hover:bg-pink-500/20 text-gray-300 hover:text-pink-400 flex items-center justify-center transition-all shadow-lg cursor-pointer"
        >
          <ArrowDownUp className="w-4 h-4" />
        </button>
      </div>

      {/* To Input Card */}
      <div className="bg-[#080a10] border border-white/5 rounded-2xl p-3.5 mt-1 mb-4 hover:border-white/10 transition-colors">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
          <span className="font-semibold uppercase tracking-wider text-[11px]">TO</span>
          <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-md text-[11px] text-gray-300">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>BNB Chain</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold border border-emerald-500/30 text-xs">
              {toToken === 'USDT' ? '₮' : toToken === 'ETH' ? 'Ξ' : toToken === 'SOL' ? '◎' : '₿'}
            </div>
            <select
              value={toToken}
              onChange={(e) => setToToken(e.target.value)}
              className="bg-transparent text-white font-bold text-base focus:outline-none cursor-pointer"
            >
              <option value="USDT" className="bg-[#0b0e14]">USDT</option>
              <option value="ETH" className="bg-[#0b0e14]">ETH</option>
              <option value="SOL" className="bg-[#0b0e14]">SOL</option>
              <option value="BTC" className="bg-[#0b0e14]">BTC</option>
            </select>
          </div>

          <div className="text-right">
            <span className="text-xl font-bold font-mono-num text-emerald-400">
              {calculatedTo}
            </span>
            <div className="text-[11px] text-gray-400 mt-0.5">
              Available: {toToken === 'USDT' || toToken === 'USD'
                ? `$${userToBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : `${userToBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${toToken}`}
            </div>
          </div>
        </div>

        <div className="text-[11px] text-gray-500 mt-2 pt-2 border-t border-white/5 flex justify-between">
          <span>AMM Slippage Impact:</span>
          <span className="text-emerald-400 font-semibold font-mono-num">{(totalSlippagePct * 100).toFixed(2)}%</span>
        </div>
      </div>

      {/* Quote summary */}
      <div className="text-[11px] text-gray-400 flex items-center justify-between px-1 mb-4">
        <span>1 {fromToken} = {rawRate.toFixed(toToken === 'USDT' ? 2 : 4)} {toToken}</span>
        <span className="font-mono-num text-gray-300">GAS FEE: ~$0.45 (Sponsored)</span>
      </div>

      {/* Execute Button */}
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
    </div>
  )
})
