import React, { useState } from 'react'
import { 
  Calculator, BookOpen, TrendingUp, ShieldCheck, 
  AlertTriangle, 
  Sparkles, Sliders, DollarSign, Flame
} from 'lucide-react'
import type { MarketCategory } from '../types/trading'
import { TradingJournalView } from './TradingJournalView'
import { formatCurrency, formatPercent } from '../utils/formatters'

interface TraderToolsViewProps {
  currentAccountBalance?: number
}

export const TraderToolsView: React.FC<TraderToolsViewProps> = ({
  currentAccountBalance = 48950.0,
}) => {
  const [activeTab, setActiveTab] = useState<'calculator' | 'journal' | 'compound'>('calculator')

  // --- CALCULATOR STATE ---
  const [calcMarket, setCalcMarket] = useState<MarketCategory>('FOREX')
  const [accountBalance, setAccountBalance] = useState<number>(currentAccountBalance)
  const [riskPercent, setRiskPercent] = useState<number>(1.5)
  const [selectedAsset, setSelectedAsset] = useState<string>('XAU/USD')
  const [entryPrice, setEntryPrice] = useState<number>(2734.50)
  const [stopLossPrice, setStopLossPrice] = useState<number>(2722.00)
  const [takeProfitPrice, setTakeProfitPrice] = useState<number>(2765.00)
  const [calcLeverage, setCalcLeverage] = useState<number>(100)

  // Quick preset instruments for calculator
  const FOREX_INSTRUMENTS = [
    { symbol: 'XAU/USD', name: 'Gold (Spot)', pipSize: 0.1, pipValuePerLot: 10, defaultEntry: 2734.50, defaultSl: 2722.00, defaultTp: 2765.00 },
    { symbol: 'EUR/USD', name: 'Euro / US Dollar', pipSize: 0.0001, pipValuePerLot: 10, defaultEntry: 1.08450, defaultSl: 1.08150, defaultTp: 1.09200 },
    { symbol: 'GBP/USD', name: 'British Pound / USD', pipSize: 0.0001, pipValuePerLot: 10, defaultEntry: 1.29850, defaultSl: 1.29450, defaultTp: 1.30900 },
    { symbol: 'USD/JPY', name: 'US Dollar / Yen', pipSize: 0.01, pipValuePerLot: 6.56, defaultEntry: 152.350, defaultSl: 153.100, defaultTp: 150.500 },
  ]

  const CRYPTO_INSTRUMENTS = [
    { symbol: 'BTC/USDT', name: 'Bitcoin', defaultEntry: 114884, defaultSl: 112500, defaultTp: 121000 },
    { symbol: 'ETH/USDT', name: 'Ethereum', defaultEntry: 4180, defaultSl: 4050, defaultTp: 4450 },
    { symbol: 'SOL/USDT', name: 'Solana', defaultEntry: 194.25, defaultSl: 187.00, defaultTp: 215.00 },
  ]

  const handleAssetSelect = (sym: string) => {
    setSelectedAsset(sym)
    if (calcMarket === 'FOREX') {
      const inst = FOREX_INSTRUMENTS.find(f => f.symbol === sym)
      if (inst) {
        setEntryPrice(inst.defaultEntry)
        setStopLossPrice(inst.defaultSl)
        setTakeProfitPrice(inst.defaultTp)
      }
    } else {
      const inst = CRYPTO_INSTRUMENTS.find(c => c.symbol === sym)
      if (inst) {
        setEntryPrice(inst.defaultEntry)
        setStopLossPrice(inst.defaultSl)
        setTakeProfitPrice(inst.defaultTp)
      }
    }
  }

  // Position Sizing Calculations
  const riskAmountUsd = accountBalance * (riskPercent / 100)
  const isLong = stopLossPrice < entryPrice
  const slDistancePrice = Math.abs(entryPrice - stopLossPrice)
  const tpDistancePrice = Math.abs(takeProfitPrice - entryPrice)
  const rewardAmountEst = slDistancePrice > 0 ? (tpDistancePrice / slDistancePrice) * riskAmountUsd : 0
  const riskRewardRatio = slDistancePrice > 0 ? Number((tpDistancePrice / slDistancePrice).toFixed(2)) : 0

  // For Forex: 1 Standard Lot = 100,000 units (Gold: 100 oz)
  // Stop loss in pips:
  const currentForexMeta = FOREX_INSTRUMENTS.find(f => f.symbol === selectedAsset) || FOREX_INSTRUMENTS[0]
  const pipsRisk = slDistancePrice / currentForexMeta.pipSize
  const pipsReward = tpDistancePrice / currentForexMeta.pipSize
  
  // Lot calculation for Forex: Risk / (Pips * PipValuePerLot)
  const calculatedLots = pipsRisk > 0 ? Number((riskAmountUsd / (pipsRisk * currentForexMeta.pipValuePerLot)).toFixed(2)) : 0
  
  // For Crypto: Size in coins = RiskUsd / SlDistance
  const cryptoCoinSize = slDistancePrice > 0 ? Number((riskAmountUsd / slDistancePrice).toFixed(4)) : 0
  const cryptoPositionValue = cryptoCoinSize * entryPrice
  const cryptoMarginRequired = calcLeverage > 0 ? cryptoPositionValue / calcLeverage : cryptoPositionValue

  // --- COMPOUND GROWTH SIMULATOR STATE ---
  const [compStartingCapital, setCompStartingCapital] = useState<number>(10000)
  const [compRatePerPeriod, setCompRatePerPeriod] = useState<number>(2.0)
  const [compPeriods, setCompPeriods] = useState<number>(30)
  const [compPeriodType, setCompPeriodType] = useState<'DAYS' | 'MONTHS'>('DAYS')

  interface CompoundMilestone {
    period: number
    balance: number
    profit: number
  }

  // Generate Compound Growth Curve
  const compoundMilestones: CompoundMilestone[] = []
  let accumulated = compStartingCapital
  for (let i = 0; i <= compPeriods; i++) {
    compoundMilestones.push({
      period: i,
      balance: accumulated,
      profit: accumulated - compStartingCapital,
    })
    accumulated = accumulated * (1 + compRatePerPeriod / 100)
  }
  const finalCompoundBalance = compoundMilestones[compoundMilestones.length - 1]?.balance || compStartingCapital
  const finalCompoundProfit = finalCompoundBalance - compStartingCapital
  const finalGrowthPercent = ((finalCompoundBalance - compStartingCapital) / compStartingCapital) * 100

  return (
    <div className="max-w-[1680px] mx-auto px-3 sm:px-6 py-6 space-y-6">
      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <span>Finora Pro Suite</span>
            <span>&gt;</span>
            <span className="text-pink-400 font-medium">Trader Command &amp; Journal</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <span>Trader Toolset &amp; Execution Journal</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-pink-500/15 text-pink-400 border border-pink-500/30 font-semibold font-mono-num">
              Risk Management &bull; Lot Sizing &bull; Analytics
            </span>
          </h1>
        </div>

        {/* View Segment Control */}
        <div className="flex items-center gap-1.5 bg-[#080a11] p-1.5 rounded-2xl border border-white/10 text-xs self-start md:self-auto">
          <button
            onClick={() => setActiveTab('calculator')}
            className={`px-3.5 py-2 rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'calculator'
                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-[0_0_15px_rgba(236,72,153,0.35)]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Position &amp; Lot Sizer</span>
          </button>

          <button
            onClick={() => setActiveTab('journal')}
            className={`px-3.5 py-2 rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'journal'
                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-[0_0_15px_rgba(236,72,153,0.35)]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Trading Journal</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/20 text-white font-mono-num font-bold">
              15 Trades
            </span>
          </button>

          <button
            onClick={() => setActiveTab('compound')}
            className={`px-3.5 py-2 rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'compound'
                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-[0_0_15px_rgba(236,72,153,0.35)]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Growth Simulator</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: POSITION SIZE & LOT CALCULATOR                     */}
      {/* ========================================================= */}
      {activeTab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Parameter Inputs (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Market Selection Pill */}
            <div className="fin-card p-4">
              <div className="flex items-center justify-between mb-3 text-xs">
                <span className="text-gray-300 font-semibold flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-pink-400" />
                  Target Asset Class
                </span>
                <span className="text-gray-400 text-[11px]">Dual Institutional Formula</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setCalcMarket('FOREX')
                    setSelectedAsset('XAU/USD')
                    setEntryPrice(2734.50)
                    setStopLossPrice(2722.00)
                    setTakeProfitPrice(2765.00)
                    setCalcLeverage(100)
                  }}
                  className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    calcMarket === 'FOREX'
                      ? 'bg-pink-500/15 border-pink-500/40 text-pink-300 shadow-[0_0_15px_rgba(236,72,153,0.2)]'
                      : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  <span>🏆 Forex &amp; Commodities (Gold, Currencies)</span>
                </button>
                <button
                  onClick={() => {
                    setCalcMarket('CRYPTO')
                    setSelectedAsset('BTC/USDT')
                    setEntryPrice(114884)
                    setStopLossPrice(112500)
                    setTakeProfitPrice(121000)
                    setCalcLeverage(20)
                  }}
                  className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    calcMarket === 'CRYPTO'
                      ? 'bg-pink-500/15 border-pink-500/40 text-pink-300 shadow-[0_0_15px_rgba(236,72,153,0.2)]'
                      : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  <span>₿ Crypto Futures &amp; Perps (BTC, ETH, SOL)</span>
                </button>
              </div>
            </div>

            {/* Instrument Buttons & Inputs */}
            <div className="fin-card p-5 space-y-4">
              <div className="flex items-center justify-between text-xs text-gray-300 font-semibold">
                <span>Select Trading Pair</span>
                <span className="text-pink-400 font-mono-num">{selectedAsset}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(calcMarket === 'FOREX' ? FOREX_INSTRUMENTS : CRYPTO_INSTRUMENTS).map((item) => (
                  <button
                    key={item.symbol}
                    onClick={() => handleAssetSelect(item.symbol)}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                      selectedAsset === item.symbol
                        ? 'bg-gradient-to-r from-pink-500/20 to-rose-500/20 border-pink-500/50 text-white'
                        : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className="text-xs font-bold text-white font-mono-num">{item.symbol}</div>
                    <div className="text-[10px] text-gray-400 truncate">{item.name}</div>
                  </button>
                ))}
              </div>

              {/* Capital & Risk Parameters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Account Balance */}
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400 flex items-center justify-between">
                    <span>Account Equity</span>
                    <span className="text-[11px] text-gray-500">Live Balance Sync</span>
                  </label>
                  <div className="flex items-center bg-[#080a11] px-3 py-2 rounded-xl border border-white/10 focus-within:border-pink-500/40">
                    <DollarSign className="w-4 h-4 text-gray-400 mr-1" />
                    <input
                      type="number"
                      value={accountBalance}
                      onChange={(e) => setAccountBalance(Number(e.target.value) || 0)}
                      className="w-full bg-transparent font-mono-num font-bold text-white text-sm focus:outline-none"
                    />
                  </div>
                </div>

                {/* Risk Percentage */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Risk per Trade</span>
                    <span className="text-pink-400 font-bold font-mono-num">{riskPercent}% (${riskAmountUsd.toFixed(2)})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {[1.0, 1.5, 2.0, 3.0].map((r) => (
                      <button
                        key={r}
                        onClick={() => setRiskPercent(r)}
                        className={`flex-1 py-2 rounded-xl text-xs font-mono-num font-bold border transition-all cursor-pointer ${
                          riskPercent === r
                            ? 'bg-pink-500/20 border-pink-500/40 text-pink-300'
                            : 'bg-[#080a11] border-white/5 text-gray-400 hover:text-white'
                        }`}
                      >
                        {r}%
                      </button>
                    ))}
                    <div className="w-20 bg-[#080a11] px-2 py-1.5 rounded-xl border border-white/10 flex items-center">
                      <input
                        type="number"
                        step="0.1"
                        value={riskPercent}
                        onChange={(e) => setRiskPercent(Number(e.target.value) || 0)}
                        className="w-full bg-transparent font-mono-num font-bold text-xs text-white focus:outline-none"
                      />
                      <span className="text-gray-500 text-[10px]">%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Price Triad: Entry, Stop Loss, Take Profit */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400">Entry Price</label>
                  <div className="bg-[#080a11] px-3 py-2 rounded-xl border border-white/10">
                    <input
                      type="number"
                      step={calcMarket === 'FOREX' ? '0.01' : '1'}
                      value={entryPrice}
                      onChange={(e) => setEntryPrice(Number(e.target.value) || 0)}
                      className="w-full bg-transparent font-mono-num font-bold text-white text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-rose-400 flex items-center gap-1 font-semibold">
                    <span>Stop Loss (SL)</span>
                  </label>
                  <div className="bg-[#080a11] px-3 py-2 rounded-xl border border-rose-500/30 focus-within:border-rose-500/60">
                    <input
                      type="number"
                      step={calcMarket === 'FOREX' ? '0.01' : '1'}
                      value={stopLossPrice}
                      onChange={(e) => setStopLossPrice(Number(e.target.value) || 0)}
                      className="w-full bg-transparent font-mono-num font-bold text-rose-300 text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                    <span>Take Profit (TP)</span>
                  </label>
                  <div className="bg-[#080a11] px-3 py-2 rounded-xl border border-emerald-500/30 focus-within:border-emerald-500/60">
                    <input
                      type="number"
                      step={calcMarket === 'FOREX' ? '0.01' : '1'}
                      value={takeProfitPrice}
                      onChange={(e) => setTakeProfitPrice(Number(e.target.value) || 0)}
                      className="w-full bg-transparent font-mono-num font-bold text-emerald-300 text-sm focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Leverage Selector */}
              <div className="pt-2">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                  <span>Leverage / Đòn bẩy tài chính</span>
                  <span className="text-pink-400 font-bold font-mono-num">{calcLeverage}x</span>
                </div>
                <div className="flex items-center gap-2">
                  {(calcMarket === 'FOREX' ? [20, 50, 100, 200] : [5, 10, 20, 50]).map((l) => (
                    <button
                      key={l}
                      onClick={() => setCalcLeverage(l)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-mono-num font-bold border transition-all cursor-pointer ${
                        calcLeverage === l
                          ? 'bg-pink-500/25 border-pink-500/50 text-pink-300'
                          : 'bg-[#080a11] border-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      {l}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Scalper Pip Reference Card */}
            {calcMarket === 'FOREX' && (
              <div className="fin-card p-4 bg-[#090c15] text-xs space-y-2">
                <div className="font-semibold text-gray-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                  <span>Institutional Pip Value Formula Reference</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-gray-400 pt-1">
                  <div className="bg-white/5 p-2 rounded-lg">
                    <div className="text-gray-300 font-bold font-mono-num">XAU/USD (Gold)</div>
                    <div className="text-[11px] text-emerald-400 font-mono-num">$10.00 / Pip (1 Lot)</div>
                    <div className="text-[10px] text-gray-500">1 Pip = $0.10 price move</div>
                  </div>
                  <div className="bg-white/5 p-2 rounded-lg">
                    <div className="text-gray-300 font-bold font-mono-num">EUR/USD</div>
                    <div className="text-[11px] text-emerald-400 font-mono-num">$10.00 / Pip (1 Lot)</div>
                    <div className="text-[10px] text-gray-500">1 Pip = 0.00010 move</div>
                  </div>
                  <div className="bg-white/5 p-2 rounded-lg">
                    <div className="text-gray-300 font-bold font-mono-num">GBP/USD</div>
                    <div className="text-[11px] text-emerald-400 font-mono-num">$10.00 / Pip (1 Lot)</div>
                    <div className="text-[10px] text-gray-500">1 Pip = 0.00010 move</div>
                  </div>
                  <div className="bg-white/5 p-2 rounded-lg">
                    <div className="text-gray-300 font-bold font-mono-num">USD/JPY</div>
                    <div className="text-[11px] text-emerald-400 font-mono-num">~$6.56 / Pip (1 Lot)</div>
                    <div className="text-[10px] text-gray-500">1 Pip = 0.010 move</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Execution Output & Risk Blueprint (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            {/* Primary Result Banner */}
            <div className="fin-card p-6 bg-gradient-to-b from-pink-950/20 via-[#0a0d17] to-[#07080c] border border-pink-500/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-36 h-36 bg-pink-500/10 rounded-full blur-3xl pointer-events-none"></div>

              <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                <span className="font-semibold text-gray-300">RECOMMENDED POSITION SIZE</span>
                <span className="px-2 py-0.5 rounded bg-pink-500/20 text-pink-400 font-bold text-[10px] uppercase tracking-wider">
                  {isLong ? 'Long Setup' : 'Short Setup'}
                </span>
              </div>

              {/* Exact Lot or Coin Size */}
              {calcMarket === 'FOREX' ? (
                <div>
                  <div className="text-4xl font-extrabold text-white font-mono-num tracking-tight flex items-baseline gap-2">
                    <span>{calculatedLots}</span>
                    <span className="text-lg text-pink-400 font-bold">Standard Lots</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1 font-mono-num">
                    = {(calculatedLots * 10).toFixed(1)} Mini Lots | {(calculatedLots * 100).toFixed(0)} Micro Lots
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-4xl font-extrabold text-white font-mono-num tracking-tight flex items-baseline gap-2">
                    <span>{cryptoCoinSize}</span>
                    <span className="text-lg text-pink-400 font-bold">{selectedAsset.split('/')[0]}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1 font-mono-num">
                    Notional Value: {formatCurrency(cryptoPositionValue)}
                  </div>
                </div>
              )}

              {/* R:R Ratio Highlight */}
              <div className="mt-5 p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-gray-400">Risk : Reward Ratio (R:R)</div>
                  <div className="text-xl font-bold font-mono-num text-white flex items-center gap-1.5 mt-0.5">
                    <span>1 : {riskRewardRatio}R</span>
                    {riskRewardRatio >= 2.0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                        Institutional Grade
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-gray-400">Est. Profit @ TP</div>
                  <div className="text-lg font-bold font-mono-num text-emerald-400">
                    +{formatCurrency(rewardAmountEst)}
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown Grid */}
              <div className="mt-5 space-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-gray-400">Cash at Risk (Max Loss):</span>
                  <span className="text-rose-400 font-mono-num font-bold">-{formatCurrency(riskAmountUsd)} ({riskPercent}%)</span>
                </div>

                {calcMarket === 'FOREX' ? (
                  <>
                    <div className="flex justify-between py-1.5 border-b border-white/5">
                      <span className="text-gray-400">Stop Loss Distance:</span>
                      <span className="text-white font-mono-num font-semibold">{pipsRisk.toFixed(1)} Pips (${slDistancePrice.toFixed(2)})</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-white/5">
                      <span className="text-gray-400">Take Profit Distance:</span>
                      <span className="text-white font-mono-num font-semibold">{pipsReward.toFixed(1)} Pips (${tpDistancePrice.toFixed(2)})</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-white/5">
                      <span className="text-gray-400">Required Margin (Est {calcLeverage}x):</span>
                      <span className="text-pink-300 font-mono-num font-bold">
                        {formatCurrency((calculatedLots * (selectedAsset === 'XAU/USD' ? 270000 : 100000)) / calcLeverage)}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between py-1.5 border-b border-white/5">
                      <span className="text-gray-400">Stop Loss Gap (%):</span>
                      <span className="text-white font-mono-num font-semibold">{formatPercent(-((slDistancePrice / entryPrice) * 100))}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-white/5">
                      <span className="text-gray-400">Required Isolated Margin:</span>
                      <span className="text-pink-300 font-mono-num font-bold">{formatCurrency(cryptoMarginRequired)}</span>
                    </div>
                  </>
                )}

                <div className="flex justify-between py-1.5">
                  <span className="text-gray-400">Account Safety Status:</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1 font-mono-num">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    DISCIPLINED (Max 2% Rule)
                  </span>
                </div>
              </div>
            </div>

            {/* Trading Rule Reminder */}
            <div className="fin-card p-4 border border-amber-500/20 bg-amber-500/5 text-xs text-gray-300 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-400">
                <AlertTriangle className="w-4 h-4" />
                <span>Quy Tắc Quản Trị Vốn Chuẩn Quỹ (Prop Firm Rules)</span>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Không bao giờ mạo hiểm quá <strong>1.5% - 2.0%</strong> vốn trên 1 lệnh đơn lẻ. 
                Tỷ lệ R:R tối thiểu nên đạt <strong>1 : 2.0</strong> để đảm bảo kỳ vọng toán học dương (+EV) 
                dù Win Rate của bạn chỉ đạt 45-50%.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: INSTITUTIONAL TRADING JOURNAL                      */}
      {/* ========================================================= */}
      {activeTab === 'journal' && (
        <TradingJournalView currentAccountBalance={accountBalance} />
      )}

      {/* ========================================================= */}
      {/* TAB 3: COMPOUND GROWTH SIMULATOR                          */}
      {/* ========================================================= */}
      {activeTab === 'compound' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="fin-card p-5 space-y-4">
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-pink-400" />
                <span>Compound Interest Simulator (Kỳ Quan Lãi Kép)</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Mô phỏng sức mạnh của lợi nhuận tích lũy đều đặn theo từng chu kỳ giao dịch kỷ luật.
              </p>

              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400">Vốn khởi đầu ($)</label>
                  <div className="bg-[#080a11] px-3 py-2 rounded-xl border border-white/10">
                    <input
                      type="number"
                      value={compStartingCapital}
                      onChange={(e) => setCompStartingCapital(Number(e.target.value) || 0)}
                      className="w-full bg-transparent font-mono-num font-bold text-white text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400">Lợi nhuận mục tiêu mỗi chu kỳ (%)</label>
                  <div className="bg-[#080a11] px-3 py-2 rounded-xl border border-white/10">
                    <input
                      type="number"
                      step="0.1"
                      value={compRatePerPeriod}
                      onChange={(e) => setCompRatePerPeriod(Number(e.target.value) || 0)}
                      className="w-full bg-transparent font-mono-num font-bold text-emerald-400 text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-gray-400">Số chu kỳ</label>
                    <div className="bg-[#080a11] px-3 py-2 rounded-xl border border-white/10">
                      <input
                        type="number"
                        value={compPeriods}
                        onChange={(e) => setCompPeriods(Number(e.target.value) || 0)}
                        className="w-full bg-transparent font-mono-num font-bold text-white text-sm focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-gray-400">Đơn vị chu kỳ</label>
                    <select
                      value={compPeriodType}
                      onChange={(e) => setCompPeriodType(e.target.value as 'DAYS' | 'MONTHS')}
                      className="w-full bg-[#080a11] px-3 py-2.5 rounded-xl border border-white/10 text-xs font-bold text-white focus:outline-none cursor-pointer"
                    >
                      <option value="DAYS">Ngày Giao Dịch</option>
                      <option value="MONTHS">Tháng</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="pt-2">
                <div className="text-[11px] text-gray-500 mb-1.5 font-semibold">Mục tiêu tăng trưởng chuẩn:</div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => { setCompRatePerPeriod(1.0); setCompPeriods(30); }}
                    className="py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-gray-300 font-mono-num font-semibold transition-colors cursor-pointer"
                  >
                    1% / 30 Ngày
                  </button>
                  <button
                    onClick={() => { setCompRatePerPeriod(2.0); setCompPeriods(30); }}
                    className="py-1.5 px-2 rounded-lg bg-pink-500/20 text-[11px] text-pink-300 border border-pink-500/30 font-mono-num font-semibold transition-colors cursor-pointer"
                  >
                    2% / 30 Ngày
                  </button>
                  <button
                    onClick={() => { setCompRatePerPeriod(8.0); setCompPeriods(12); setCompPeriodType('MONTHS'); }}
                    className="py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-gray-300 font-mono-num font-semibold transition-colors cursor-pointer"
                  >
                    8% / 12 Tháng
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Projection Chart & Milestones (8 cols) */}
          <div className="lg:col-span-8 space-y-5">
            {/* Big Milestone Card */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="fin-card p-4">
                <div className="text-[11px] text-gray-400">Vốn Ban Đầu</div>
                <div className="text-xl font-bold font-mono-num text-white mt-1">
                  {formatCurrency(compStartingCapital)}
                </div>
              </div>
              <div className="fin-card p-4">
                <div className="text-[11px] text-gray-400">Vốn Sau {compPeriods} {compPeriodType === 'DAYS' ? 'Ngày' : 'Tháng'}</div>
                <div className="text-2xl font-extrabold font-mono-num text-emerald-400 mt-0.5">
                  {formatCurrency(finalCompoundBalance)}
                </div>
              </div>
              <div className="fin-card p-4">
                <div className="text-[11px] text-gray-400">Tỷ Lệ Tăng Trưởng Thực</div>
                <div className="text-2xl font-extrabold font-mono-num text-pink-400 mt-0.5">
                  +{finalGrowthPercent.toFixed(1)}% (+{formatCurrency(finalCompoundProfit)})
                </div>
              </div>
            </div>

            {/* Interactive SVG Projection Curve */}
            <div className="fin-card p-5 space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-300 font-semibold">
                <span>Đường Cong Tăng Trưởng Tài Khoản (Exponential Equity Curve)</span>
                <span className="text-emerald-400 font-mono-num font-bold">Lợi nhuận gộp lãi kép</span>
              </div>

              <div className="h-48 w-full relative">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 500 150" preserveAspectRatio="none">
                  {/* Grid Lines */}
                  <line x1="0" y1="30" x2="500" y2="30" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <line x1="0" y1="75" x2="500" y2="75" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <line x1="0" y1="120" x2="500" y2="120" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />

                  {/* Gradient Definition */}
                  <defs>
                    <linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ec4899" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#ec4899" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Polyline Path */}
                  {(() => {
                    const minB = compStartingCapital
                    const maxB = finalCompoundBalance
                    const range = Math.max(1, maxB - minB)
                    const points = compoundMilestones.map((m, idx) => {
                      const x = (idx / compPeriods) * 500
                      const y = 140 - ((m.balance - minB) / range) * 125
                      return `${x},${y}`
                    })
                    const areaPoints = `0,145 ${points.join(' ')} 500,145`

                    return (
                      <>
                        <polygon points={areaPoints} fill="url(#compGrad)" />
                        <polyline points={points.join(' ')} fill="none" stroke="#ec4899" strokeWidth="2.5" />
                      </>
                    )
                  })()}
                </svg>
              </div>

              {/* Milestones Table */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/5 text-xs">
                {[0.25, 0.5, 0.75, 1.0].map((fraction) => {
                  const targetIdx = Math.round(compPeriods * fraction)
                  const milestone = compoundMilestones[targetIdx] || compoundMilestones[compoundMilestones.length - 1]
                  return (
                    <div key={fraction} className="bg-white/5 p-2 rounded-xl">
                      <div className="text-[10px] text-gray-400">Chu kỳ {targetIdx} ({fraction * 100}%)</div>
                      <div className="font-bold font-mono-num text-white text-xs mt-0.5">
                        {formatCurrency(milestone?.balance || 0)}
                      </div>
                      <div className="text-[10px] text-emerald-400 font-mono-num">
                        +{formatCurrency(milestone?.profit || 0)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* End Trader Tools */}
    </div>
  )
}
