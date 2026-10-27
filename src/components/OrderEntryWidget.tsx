import React, { useState } from 'react'

import { Zap, Sliders, ShieldCheck, Clock, EyeOff, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '../utils/formatters'
import type { Position, MarketCategory } from '../types/trading'
import { playOrderFilledSound, playClickSound } from '../utils/soundEffects'
import { defaultMarketStore } from '../stores/marketStore'
import { getAssetConfig } from '../services/marketDataSimulator'

export interface PresetSetup {
  entryPrice?: number
  slPrice?: number
  tpPrice?: number
  size?: number
  side?: 'LONG' | 'SHORT'
}

interface OrderEntryWidgetProps {
  currentPrice: number
  symbol: string
  category?: MarketCategory
  userUsdtBalance: number
  onOrderPlaced: (newPosition: Position) => void
  presetSetup?: PresetSetup | null
  freeMargin?: number
  isCircuitBreakerTripped?: boolean
  circuitBreakerReason?: string
}

export const OrderEntryWidget = React.memo<OrderEntryWidgetProps>(function OrderEntryWidget({
  currentPrice,
  symbol,
  category = 'CRYPTO',
  userUsdtBalance,
  onOrderPlaced,
  presetSetup,
  freeMargin,
  isCircuitBreakerTripped = false,
  circuitBreakerReason,
}) {
  const isForex = category === 'FOREX' || symbol.includes('/') && (symbol.includes('USD') || symbol.includes('EUR') || symbol.includes('JPY') || symbol.includes('XAU'))
  const assetConfig = getAssetConfig(symbol)

  const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG')
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'AI_TRAILING' | 'TWAP' | 'ICEBERG'>('MARKET')
  const [limitPrice, setLimitPrice] = useState<string>(currentPrice.toString())
  const [amountStr, setAmountStr] = useState<string>(isForex ? '0.50' : '0.15')
  const [leverage, setLeverage] = useState<number>(isForex ? 100 : 10)
  const [tpEnabled, setTpEnabled] = useState<boolean>(true)
  const [slEnabled, setSlEnabled] = useState<boolean>(true)
  const [customTp, setCustomTp] = useState<string>('')
  const [customSl, setCustomSl] = useState<string>('')
  const [twapDuration, setTwapDuration] = useState<'5m' | '15m' | '1h'>('15m')
  const [icebergTipPct, setIcebergTipPct] = useState<number>(15)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const [prevSymbol, setPrevSymbol] = useState(symbol)
  const [prevPreset, setPrevPreset] = useState(presetSetup)

  if (prevSymbol !== symbol) {
    setPrevSymbol(symbol)
    if (currentPrice > 0) {
      setLimitPrice(currentPrice.toString())
    }
    setCustomTp('')
    setCustomSl('')
    if (isForex) {
      setAmountStr('0.50')
      setLeverage(100)
    } else {
      setAmountStr('0.15')
      setLeverage(10)
    }
  }

  if (presetSetup && presetSetup !== prevPreset) {
    setPrevPreset(presetSetup)
    if (presetSetup.side) setSide(presetSetup.side)
    if (presetSetup.entryPrice) setLimitPrice(presetSetup.entryPrice.toString())
    if (presetSetup.size) setAmountStr(presetSetup.size.toString())
    if (presetSetup.slPrice) {
      setSlEnabled(true)
      setCustomSl(presetSetup.slPrice.toString())
    }
    if (presetSetup.tpPrice) {
      setTpEnabled(true)
      setCustomTp(presetSetup.tpPrice.toString())
    }
  }


  const parsedAmount = parseFloat(amountStr) || 0
  const activePrice = (orderType === 'LIMIT' || orderType === 'TWAP' || orderType === 'ICEBERG') 
    ? (parseFloat(limitPrice) || currentPrice) 
    : currentPrice
  
  // For Forex: 1 lot = $100,000 notional (or for Gold: 100 oz * price)
  const notionalContractValue = isForex 
    ? (symbol.includes('XAU') ? parsedAmount * 100 * activePrice : parsedAmount * 100000)
    : parsedAmount * activePrice

  const orderValue = isForex ? notionalContractValue : parsedAmount * activePrice
  const requiredMargin = leverage > 0 ? orderValue / leverage : orderValue
  
  const estimatedLiq = side === 'LONG'
    ? Math.max(0, activePrice * (1 - 1 / leverage + 0.005))
    : activePrice * (1 + 1 / leverage - 0.005)

  // Default TP / SL calculations
  const defaultTpPrice = isForex
    ? (side === 'LONG' 
        ? activePrice + (symbol.includes('XAU') ? 25.0 : 0.0060) 
        : activePrice - (symbol.includes('XAU') ? 25.0 : 0.0060))
    : (side === 'LONG' ? activePrice * 1.065 : activePrice * 0.935)

  const defaultSlPrice = isForex
    ? (side === 'LONG' 
        ? activePrice - (symbol.includes('XAU') ? 12.0 : 0.0030) 
        : activePrice + (symbol.includes('XAU') ? 12.0 : 0.0030))
    : (side === 'LONG' ? activePrice * 0.965 : activePrice * 1.035)

  const parsedCustomTp = customTp.trim() !== '' ? parseFloat(customTp) : NaN
  const effectiveTp = !isNaN(parsedCustomTp) && parsedCustomTp > 0 ? parsedCustomTp : defaultTpPrice

  const parsedCustomSl = customSl.trim() !== '' ? parseFloat(customSl) : NaN
  const effectiveSl = !isNaN(parsedCustomSl) && parsedCustomSl > 0 ? parsedCustomSl : defaultSlPrice

  const handlePercentagePick = (pct: number) => {
    playClickSound()
    if (isForex) {
      setAmountStr(pct.toString())
    } else {
      const maxUsd = userUsdtBalance * (pct / 100) * leverage
      const coins = maxUsd / activePrice
      setAmountStr(coins.toFixed(3))
    }
  }

  const handleSubmitOrder = () => {
    setValidationError(null)
    if (parsedAmount <= 0) {
      setValidationError('Order amount must be strictly positive.')
      return
    }

    if (isCircuitBreakerTripped) {
      setValidationError('Trading Locked: Daily Max Drawdown Circuit Breaker is active (-4.5% limit breached).')
      return
    }

    const availableMargin = freeMargin !== undefined ? freeMargin : userUsdtBalance
    if (requiredMargin > availableMargin) {
      setValidationError(`Insufficient Free Margin: required $${requiredMargin.toFixed(2)} exceeds available $${availableMargin.toFixed(2)}.`)
      return
    }

    // Stop loss & take profit geometric checks
    if (slEnabled && effectiveSl > 0) {
      if (side === 'LONG' && effectiveSl >= activePrice) {
        setValidationError('Invalid Stop Loss: Long SL must be strictly below entry price.')
        return
      }
      if (side === 'SHORT' && effectiveSl <= activePrice) {
        setValidationError('Invalid Stop Loss: Short SL must be strictly above entry price.')
        return
      }
    }

    if (tpEnabled && effectiveTp > 0) {
      if (side === 'LONG' && effectiveTp <= activePrice) {
        setValidationError('Invalid Take Profit: Long TP must be strictly above entry price.')
        return
      }
      if (side === 'SHORT' && effectiveTp >= activePrice) {
        setValidationError('Invalid Take Profit: Short TP must be strictly below entry price.')
        return
      }
    }

    setIsSubmitting(true)

    const finalSymbol = isForex 
      ? symbol 
      : (symbol.includes('/') ? symbol : `${symbol}/USDT`)

    const cfg = getAssetConfig(finalSymbol)

    setTimeout(() => {
      setIsSubmitting(false)
      playOrderFilledSound()

      let finalEntryPrice = activePrice
      let initialUnrealizedPnl = 0
      let initialUnrealizedPnlPct = 0

      if (orderType === 'MARKET') {
        const fill = defaultMarketStore.calculateExecutionFill(
          finalSymbol,
          side === 'LONG' ? 'BUY' : 'SELL',
          parsedAmount
        )
        finalEntryPrice = fill.fillPrice

        const isJpy = finalSymbol.includes('JPY')
        const notionalMultiplier = isForex
          ? (finalSymbol.includes('XAU') ? 100 : 100000)
          : 1
        const priceDelta = side === 'LONG'
          ? currentPrice - fill.fillPrice
          : fill.fillPrice - currentPrice
        const rawInitialPnl = priceDelta * parsedAmount * notionalMultiplier
        const jpyRate = currentPrice > 0 ? currentPrice : 1
        const initialPnlUsd = isJpy ? rawInitialPnl / jpyRate : rawInitialPnl
        initialUnrealizedPnl = Number(initialPnlUsd.toFixed(2))
        initialUnrealizedPnlPct = Number(((initialUnrealizedPnl / (requiredMargin || 1)) * 100).toFixed(2))
      }

      const newPos: Position = {
        id: `pos-${Date.now()}`,
        symbol: finalSymbol,
        side,
        size: parsedAmount,
        entryPrice: finalEntryPrice,
        markPrice: currentPrice,
        liquidationPrice: Number(estimatedLiq.toFixed(cfg.digits > 2 ? 3 : 2)),
        leverage,
        margin: Number(requiredMargin.toFixed(2)),
        unrealizedPnl: initialUnrealizedPnl,
        unrealizedPnlPct: initialUnrealizedPnlPct,
        tpPrice: tpEnabled ? Number(effectiveTp.toFixed(cfg.digits)) : undefined,
        slPrice: slEnabled ? Number(effectiveSl.toFixed(cfg.digits)) : undefined,
        market: isForex ? 'FOREX' : 'CRYPTO',
        lots: isForex ? parsedAmount : undefined,
      }
      onOrderPlaced(newPos)
    }, 450)
  }

  return (
    <div className="fin-card p-4 flex flex-col justify-between text-xs">
      <div>
        {/* Header Title with Badge */}
        <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-white/5">
          <span className="font-bold text-white text-xs flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            DMA Order Execution Desk
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isForex 
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
              : 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
          }`}>
            {isForex ? 'FOREX / METALS' : 'CRYPTO PERPS'}
          </span>
        </div>

        {/* Side Tabs: Long vs Short */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#080a11] rounded-xl border border-white/5 mb-3">
          <button
            onClick={() => { playClickSound(); setSide('LONG'); }}
            className={`py-2 rounded-lg font-bold transition-all cursor-pointer ${
              side === 'LONG'
                ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Buy / Long
          </button>
          <button
            onClick={() => { playClickSound(); setSide('SHORT'); }}
            className={`py-2 rounded-lg font-bold transition-all cursor-pointer ${
              side === 'SHORT'
                ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Sell / Short
          </button>
        </div>

        {/* Extended Order Types: Market, Limit, AI Trailing, TWAP, Iceberg */}
        <div className="flex flex-wrap items-center gap-1 mb-3">
          {(['MARKET', 'LIMIT', 'AI_TRAILING', 'TWAP', 'ICEBERG'] as const).map((ot) => (
            <button
              key={ot}
              onClick={() => { playClickSound(); setOrderType(ot); }}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                orderType === ot
                  ? 'bg-pink-500/25 text-pink-300 border border-pink-500/40'
                  : 'text-gray-400 hover:text-gray-200 bg-white/5'
              }`}
            >
              {ot === 'AI_TRAILING' ? '⚡ Trailing' : ot}
            </button>
          ))}
        </div>

        {/* TWAP Execution Parameters */}
        {orderType === 'TWAP' && (
          <div className="p-2.5 rounded-xl bg-pink-500/10 border border-pink-500/30 mb-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-pink-300 font-semibold">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> TWAP Horizon
              </span>
              <span className="text-[10px] text-gray-400">Algorithmic Tranche Slicing</span>
            </div>
            <div className="flex items-center gap-1.5">
              {(['5m', '15m', '1h'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setTwapDuration(d)}
                  className={`flex-1 py-1 rounded text-[10px] font-mono-num font-bold transition-all ${
                    twapDuration === d
                      ? 'bg-pink-500 text-white'
                      : 'bg-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  {d} Horizon
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Iceberg Stealth Execution Parameters */}
        {orderType === 'ICEBERG' && (
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 mb-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-indigo-300 font-semibold">
              <span className="flex items-center gap-1">
                <EyeOff className="w-3 h-3" /> Iceberg Stealth Tip
              </span>
              <span className="font-mono-num font-bold text-white">{icebergTipPct}% Visible</span>
            </div>
            <div className="flex items-center gap-1.5">
              {[10, 15, 25, 33].map((pct) => (
                <button
                  key={pct}
                  onClick={() => setIcebergTipPct(pct)}
                  className={`flex-1 py-1 rounded text-[10px] font-mono-num font-bold transition-all ${
                    icebergTipPct === pct
                      ? 'bg-indigo-500 text-white'
                      : 'bg-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Leverage Selection */}
        <div className="bg-[#080a11] p-2.5 rounded-xl border border-white/5 mb-3">
          <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1.5">
            <span className="flex items-center gap-1 font-semibold">
              <Sliders className="w-3 h-3 text-pink-400" /> Leverage
            </span>
            <span className="font-mono-num font-bold text-pink-400">{leverage}x Cross</span>
          </div>
          <div className="flex items-center justify-between gap-1">
            {(isForex ? [20, 50, 100, 200] : [5, 10, 20, 50]).map((lev) => (
              <button
                key={lev}
                onClick={() => { playClickSound(); setLeverage(lev); }}
                className={`flex-1 py-1 text-[11px] font-mono-num font-bold rounded transition-all cursor-pointer ${
                  leverage === lev
                    ? 'bg-pink-500/25 text-pink-300 border border-pink-500/40'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                {lev}x
              </button>
            ))}
          </div>
        </div>

        {/* Limit Price Input */}
        {(orderType === 'LIMIT' || orderType === 'TWAP' || orderType === 'ICEBERG') && (
          <div className="bg-[#080a11] p-2.5 rounded-xl border border-white/5 mb-2.5">
            <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
              <span>Limit Execution Price</span>
              <button
                type="button"
                onClick={() => setLimitPrice(currentPrice.toString())}
                className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-white/10 hover:bg-pink-500/20 text-gray-400 hover:text-pink-300 transition-colors cursor-pointer"
                title="Snap to current market price"
              >
                Market
              </button>
            </div>
            <div className="flex items-center justify-between">
              <input
                type="number"
                step="any"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                className="w-full bg-transparent font-mono-num font-bold text-sm text-white focus:outline-none"
              />
              <span className="text-gray-400 text-xs font-mono-num">USD</span>
            </div>
          </div>
        )}

        {/* Amount Input */}
        <div className="bg-[#080a11] p-2.5 rounded-xl border border-white/5 mb-2">
          <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
            <span>{isForex ? 'Order Size (Standard Lots)' : 'Contract Amount'}</span>
            <span>Avail: <strong className="text-gray-300 font-mono-num">${userUsdtBalance.toLocaleString()}</strong></span>
          </div>
          <div className="flex items-center justify-between">
            <input
              type="number"
              step={isForex ? '0.01' : '0.001'}
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="w-full bg-transparent font-mono-num font-bold text-base text-white focus:outline-none"
            />
            <span className="text-pink-400 font-bold text-xs font-mono-num">
              {isForex ? 'LOTS' : symbol.split('/')[0]}
            </span>
          </div>
        </div>

        {/* Preset Pickers */}
        <div className="flex items-center gap-1 mb-3">
          {(isForex ? [0.05, 0.10, 0.50, 1.00] : [25, 50, 75, 100]).map((val) => (
            <button
              key={val}
              onClick={() => handlePercentagePick(val)}
              className="flex-1 py-0.5 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-[10px] font-mono-num transition-colors cursor-pointer"
            >
              {isForex ? `${val}L` : `${val}%`}
            </button>
          ))}
        </div>

        {/* TP / SL Inputs */}
        <div className="space-y-2 p-2.5 bg-[#080a11] rounded-xl border border-white/5 mb-3 text-[11px]">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={tpEnabled}
                onChange={(e) => setTpEnabled(e.target.checked)}
                className="rounded accent-emerald-500"
              />
              <span>Take Profit Target (TP)</span>
            </label>
            <div className="w-28 flex items-center bg-white/5 px-2 py-0.5 rounded border border-white/10">
              <input
                type="number"
                step="any"
                value={customTp}
                placeholder={defaultTpPrice.toFixed(assetConfig.digits)}
                onChange={(e) => setCustomTp(e.target.value)}
                disabled={!tpEnabled}
                className="w-full bg-transparent font-mono-num font-bold text-[11px] text-emerald-400 placeholder:text-emerald-500/40 focus:outline-none text-right disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={slEnabled}
                onChange={(e) => setSlEnabled(e.target.checked)}
                className="rounded accent-rose-500"
              />
              <span>Stop Loss Protection (SL)</span>
            </label>
            <div className="w-28 flex items-center bg-white/5 px-2 py-0.5 rounded border border-white/10">
              <input
                type="number"
                step="any"
                value={customSl}
                placeholder={defaultSlPrice.toFixed(assetConfig.digits)}
                onChange={(e) => setCustomSl(e.target.value)}
                disabled={!slEnabled}
                className="w-full bg-transparent font-mono-num font-bold text-[11px] text-rose-400 placeholder:text-rose-500/40 focus:outline-none text-right disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Risk & Execution Summary */}
        <div className="space-y-1 text-[11px] text-gray-400 mb-4 px-1">
          <div className="flex justify-between">
            <span>Notional Value:</span>
            <span className="text-white font-mono-num">{formatCurrency(orderValue)}</span>
          </div>
          <div className="flex justify-between">
            <span>Required Margin:</span>
            <span className="text-pink-300 font-bold font-mono-num">{formatCurrency(requiredMargin)}</span>
          </div>
          <div className="flex justify-between">
            <span>Estimated Liq. Price:</span>
            <span className="text-amber-400 font-bold font-mono-num">{formatCurrency(estimatedLiq)}</span>
          </div>
          <div className="flex justify-between">
            <span>Execution Algorithmic Route:</span>
            <span className="text-emerald-400 font-bold font-mono-num flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> ZERO MEV &bull; DMA TIER-1
            </span>
          </div>
        </div>
      </div>

      {/* Circuit Breaker & Validation Alert */}
      {isCircuitBreakerTripped && (
        <div className="mb-3 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-pulse">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="font-semibold">{circuitBreakerReason || 'Trading Locked: Daily Max Drawdown Circuit Breaker Active'}</span>
        </div>
      )}

      {validationError && (
        <div className="mb-3 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-semibold">
          {validationError}
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmitOrder}
        disabled={isSubmitting || parsedAmount <= 0 || isCircuitBreakerTripped}
        className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
          isSubmitting || isCircuitBreakerTripped
            ? 'bg-gray-800 text-gray-500 border border-white/5 cursor-not-allowed'
            : side === 'LONG'
            ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]'
            : 'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.4)]'
        }`}
      >
        {isSubmitting ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            Executing DMA {orderType}...
          </>
        ) : isCircuitBreakerTripped ? (
          <>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>Trading Locked by Circuit Breaker</span>
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            <span>Open {side} {leverage}x Position</span>
          </>
        )}
      </button>
    </div>
  )
})
