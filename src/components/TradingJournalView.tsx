import React, { useState, useMemo } from 'react'
import { 
  BookOpen, Calendar, BarChart3, TrendingUp, AlertTriangle, 
  Plus, Search, Download, Sparkles, Clock, ChevronLeft, 
  ChevronRight, Trash2, Award, X
} from 'lucide-react'
import type { JournalEntry, MarketCategory } from '../types/trading'
import { INITIAL_JOURNAL_ENTRIES } from '../data/mockData'
import { formatCurrency, formatPercent } from '../utils/formatters'
import { playClickSound, playOrderFilledSound } from '../utils/soundEffects'
import {
  calculateSharpeRatio,
  calculateSortinoRatio,
  calculateMaxDrawdown,
  calculateExpectancy,
  calculateRDistribution,
} from '../quant/metrics'

interface TradingJournalViewProps {
  currentAccountBalance?: number
}

type JournalSubTab = 'breakdown' | 'calendar' | 'trades' | 'analytics' | 'mistakes' | 'strategies'

export const TradingJournalView: React.FC<TradingJournalViewProps> = ({
  currentAccountBalance = 54936.30,
}) => {
  const [subTab, setSubTab] = useState<JournalSubTab>('breakdown')
  const [entries, setEntries] = useState<JournalEntry[]>(INITIAL_JOURNAL_ENTRIES)

  // Filter States for Trades Log
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMarket, setFilterMarket] = useState<'ALL' | 'FOREX' | 'CRYPTO'>('ALL')
  const [filterSide, setFilterSide] = useState<'ALL' | 'BUY' | 'SELL'>('ALL')
  const [filterOutcome, setFilterOutcome] = useState<'ALL' | 'WIN' | 'LOSS'>('ALL')
  const [filterStrategy, setFilterStrategy] = useState<string>('ALL')
  const [filterTag, setFilterTag] = useState<string>('ALL')

  // Calendar State
  const [calendarMonth] = useState('October 2026')
  const [selectedDayTrades, setSelectedDayTrades] = useState<JournalEntry[] | null>(null)

  // New Trade Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [formSymbol, setFormSymbol] = useState('XAU/USD')
  const [formMarket, setFormMarket] = useState<MarketCategory>('FOREX')
  const [formSide, setFormSide] = useState<'BUY' | 'SELL'>('BUY')
  const [formSize, setFormSize] = useState<number>(0.5)
  const [formEntry, setFormEntry] = useState<number>(2734.50)
  const [formExit, setFormExit] = useState<number>(2750.00)
  const [formPnl, setFormPnl] = useState<number>(775.00)
  const [formR, setFormR] = useState<number>(2.8)
  const [formSetup, setFormSetup] = useState('SMC Order Block + FVG')
  const [formTag, setFormTag] = useState('#A+Setup')
  const [formMistake, setFormMistake] = useState<'None' | 'Exited early' | 'Overtraded' | 'Moved stop' | 'FOMO entered'>('None')
  const [formDuration, setFormDuration] = useState('1h 30m')
  const [formNotes, setFormNotes] = useState('Tapped H1 bullish imbalance with aggressive displacement.')

  // Equity Curve Calculation (chronological)
  const equityPoints = useMemo(() => {
    let runningBalance = 50000.0 // Starting baseline capital
    const sorted = [...entries].reverse() // chronological
    const points = [{ date: 'Start', equity: runningBalance, pnl: 0 }]

    sorted.forEach((trade) => {
      runningBalance += trade.pnl
      points.push({
        date: trade.date,
        equity: Number(runningBalance.toFixed(2)),
        pnl: trade.pnl,
      })
    })
    return points
  }, [entries])

  // --- CORE COMPUTED METRICS ---
  const metrics = useMemo(() => {
    const totalTrades = entries.length
    const winningTrades = entries.filter((e) => e.outcome === 'WIN')
    const losingTrades = entries.filter((e) => e.outcome === 'LOSS')

    const winCount = winningTrades.length
    const lossCount = losingTrades.length
    const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0

    const totalWinPnl = winningTrades.reduce((acc, curr) => acc + curr.pnl, 0)
    const totalLossPnl = losingTrades.reduce((acc, curr) => acc + Math.abs(curr.pnl), 0)
    const netPnl = entries.reduce((acc, curr) => acc + curr.pnl, 0)

    const profitFactor = totalLossPnl > 0 ? Number((totalWinPnl / totalLossPnl).toFixed(2)) : totalWinPnl > 0 ? 99.99 : 0
    const avgWin = winCount > 0 ? totalWinPnl / winCount : 0
    const avgLoss = lossCount > 0 ? totalLossPnl / lossCount : 0

    const bestTrade = entries.length > 0 ? Math.max(...entries.map((e) => e.pnl)) : 0
    const worstTrade = entries.length > 0 ? Math.min(...entries.map((e) => e.pnl)) : 0

    const totalR = Number(entries.reduce((acc, curr) => acc + curr.rMultiple, 0).toFixed(2))

    // Compute returns series from equityPoints for real Sharpe & Sortino
    const equityValues = equityPoints.map((p) => p.equity)
    const dailyReturns: number[] = []
    for (let i = 1; i < equityPoints.length; i++) {
      const prev = equityPoints[i - 1].equity
      if (prev > 0) {
        dailyReturns.push((equityPoints[i].equity - prev) / prev)
      }
    }
    const sharpe = calculateSharpeRatio(dailyReturns, 0.02, 252)
    const sortino = calculateSortinoRatio(dailyReturns, 0, 252)
    const mddStats = calculateMaxDrawdown(equityValues)

    // Compute real expectancy & R distribution
    const tradeData = entries.map((e) => ({
      pnl: e.pnl,
      rMultiple: e.rMultiple,
    }))
    const expStats = calculateExpectancy(tradeData)
    const rDistribution = calculateRDistribution(tradeData)

    const countAbove2R = rDistribution.buckets
      .filter((b) => b.bucket === '2R to 3R' || b.bucket === '> 3R')
      .reduce((acc, b) => acc + b.count, 0)
    const ratioAbove2R = totalTrades > 0 ? (countAbove2R / totalTrades) * 100 : 0

    // Up / Down Days
    const dayPnlMap: Record<number, number> = {}
    entries.forEach((e) => {
      const d = e.dayNumber || 1
      dayPnlMap[d] = (dayPnlMap[d] || 0) + e.pnl
    })
    const dayPnls = Object.values(dayPnlMap)
    const upDays = dayPnls.filter((p) => p > 0).length
    const downDays = dayPnls.filter((p) => p < 0).length
    const totalDays = dayPnls.length
    const upDayPct = totalDays > 0 ? (upDays / totalDays) * 100 : 0

    // Streaks
    let currentStreak = 0
    let bestStreak = 0
    let tempStreak = 0
    for (const trade of entries) {
      if (trade.outcome === 'WIN') {
        tempStreak += 1
        if (tempStreak > bestStreak) bestStreak = tempStreak
      } else {
        tempStreak = 0
      }
    }
    for (const trade of entries) {
      if (trade.outcome === 'WIN') {
        currentStreak += 1
      } else {
        break
      }
    }

    const totalFees = Number(entries.reduce((acc, curr) => acc + (curr.fees || 2.5), 0).toFixed(2))

    // Mistakes Analysis
    const mistakeTrades = entries.filter((e) => e.mistake && e.mistake !== 'None')
    const cleanTrades = entries.filter((e) => !e.mistake || e.mistake === 'None')
    const cleanPnl = cleanTrades.reduce((acc, curr) => acc + curr.pnl, 0)
    const mistakePnl = mistakeTrades.reduce((acc, curr) => acc + curr.pnl, 0)
    const mistakeCount = mistakeTrades.length
    const adherenceRate = totalTrades > 0 ? ((totalTrades - mistakeCount) / totalTrades) * 100 : 100
    const costOfMistakes = mistakePnl < 0 ? Math.abs(mistakePnl) : 0

    return {
      totalTrades,
      winCount,
      lossCount,
      winRate,
      netPnl,
      profitFactor: expStats.profitFactor > 0 ? expStats.profitFactor : profitFactor,
      avgWin,
      avgLoss,
      bestTrade,
      worstTrade,
      totalR,
      avgR: expStats.expectancyR,
      expectancy: expStats.expectancyUsd,
      expectancyR: expStats.expectancyR,
      avgWinR: expStats.avgWinR,
      avgLossR: expStats.avgLossR,
      sharpe,
      sortino,
      maxDrawdownPct: mddStats.maxDrawdownPct,
      rDistribution,
      ratioAbove2R,
      upDays,
      downDays,
      upDayPct,
      currentStreak,
      bestStreak,
      totalFees,
      mistakeTrades,
      cleanTrades,
      cleanPnl,
      mistakePnl,
      mistakeCount,
      adherenceRate,
      costOfMistakes,
    }
  }, [entries, equityPoints])

  // Calendar Day Map for October 2026 (Days 1 - 31)
  const calendarData = useMemo(() => {
    const dayMap: Record<number, { pnl: number; trades: JournalEntry[]; winCount: number }> = {}
    entries.forEach((e) => {
      const d = e.dayNumber || 1
      if (!dayMap[d]) {
        dayMap[d] = { pnl: 0, trades: [], winCount: 0 }
      }
      dayMap[d].pnl += e.pnl
      dayMap[d].trades.push(e)
      if (e.outcome === 'WIN') dayMap[d].winCount += 1
    })
    return dayMap
  }, [entries])

  // Filtered Trades Log
  const filteredTrades = useMemo(() => {
    return entries.filter((entry) => {
      const matchesSearch =
        entry.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.setup.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (entry.tag && entry.tag.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesMarket = filterMarket === 'ALL' || entry.market === filterMarket
      const matchesSide = filterSide === 'ALL' || entry.side === filterSide
      const matchesOutcome = filterOutcome === 'ALL' || entry.outcome === filterOutcome
      const matchesStrategy = filterStrategy === 'ALL' || entry.setup.includes(filterStrategy)
      const matchesTag =
        filterTag === 'ALL' ||
        (filterTag === 'MISTAKE' && entry.mistake && entry.mistake !== 'None') ||
        entry.tag === filterTag

      return matchesSearch && matchesMarket && matchesSide && matchesOutcome && matchesStrategy && matchesTag
    })
  }, [entries, searchQuery, filterMarket, filterSide, filterOutcome, filterStrategy, filterTag])

  // Unique Strategies and Tags for filters
  const availableStrategies = useMemo(() => {
    const sets = new Set(entries.map((e) => e.setup.split('+')[0].trim()))
    return Array.from(sets)
  }, [entries])

  // Handle Add New Trade
  const handleAddTrade = (e: React.FormEvent) => {
    e.preventDefault()
    playOrderFilledSound()
    const newEntry: JournalEntry = {
      id: `j-${Date.now()}`,
      date: 'Oct 11, 2026',
      dayNumber: 11,
      symbol: formSymbol,
      market: formMarket,
      side: formSide,
      lotsOrSize: formSize,
      entryPrice: formEntry,
      exitPrice: formExit,
      pnl: formPnl,
      rMultiple: formR,
      setup: formSetup,
      outcome: formPnl >= 0 ? 'WIN' : 'LOSS',
      notes: formNotes,
      tag: formTag,
      mistake: formMistake,
      duration: formDuration,
      fees: 3.50,
    }
    setEntries([newEntry, ...entries])
    setIsAddModalOpen(false)
  }

  // Handle Delete Trade
  const handleDeleteTrade = (id: string) => {
    playClickSound()
    setEntries(entries.filter((e) => e.id !== id))
    if (selectedDayTrades) {
      setSelectedDayTrades(selectedDayTrades.filter((e) => e.id !== id))
    }
  }

  // Safe SVG Equity Curve calculation immune to length <= 1 and max === min
  const eqValues = equityPoints.map((p) => p.equity)
  const rawMinEq = eqValues.length > 0 ? Math.min(...eqValues) : 50000
  const rawMaxEq = eqValues.length > 0 ? Math.max(...eqValues) : 50000
  const minEq = rawMinEq === rawMaxEq ? Math.max(0, rawMinEq - 1000) : rawMinEq
  const maxEq = rawMinEq === rawMaxEq ? rawMaxEq + 1000 : rawMaxEq
  const eqRange = maxEq - minEq > 0 ? maxEq - minEq : 1
  const eqDenom = equityPoints.length > 1 ? equityPoints.length - 1 : 1

  const svgEquityPoints = equityPoints.map((p, idx) => {
    const x = (idx / eqDenom) * 800
    const y = 200 - ((p.equity - minEq) / eqRange) * 180 - 10
    const safeX = Number.isFinite(x) ? Number(x.toFixed(1)) : 0
    const safeY = Number.isFinite(y) ? Number(y.toFixed(1)) : 100
    return { x: safeX, y: safeY, point: p }
  })
  const equityPointsStr = svgEquityPoints.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <div className="max-w-[1720px] mx-auto px-3 sm:px-6 py-5 min-h-[calc(100vh-72px)] flex flex-col gap-5 text-gray-200">
      {/* Top Banner & OpenTraderWorld Style Sub-Nav */}
      <div className="fin-card p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#0d101d] via-[#090b14] to-[#0d101d] border border-pink-500/20">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-extrabold border border-pink-500/40">
              OPENTRADERWORLD ARCHITECTURE
            </span>
            <span className="text-xs text-gray-400 font-mono-num">Default Account · USD</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-pink-500" />
            <span>Trading Journal &amp; Performance Intelligence</span>
          </h1>
        </div>

        {/* Action Controls: Log Trade & Export */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              playClickSound()
              setIsAddModalOpen(true)
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 via-rose-600 to-fuchsia-600 hover:brightness-110 text-white text-xs font-bold shadow-[0_0_20px_rgba(236,72,153,0.4)] flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Log New Trade</span>
          </button>

          <button
            onClick={() => {
              playClickSound()
              const jsonStr = JSON.stringify(entries, null, 2)
              const blob = new Blob([jsonStr], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `finora-journal-${Date.now()}.json`
              a.click()
            }}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Export Trades JSON"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Institutional Sub-Navigation Tabs matching OpenTraderWorld */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-white/10 text-xs font-bold">
        {[
          { id: 'breakdown', label: 'Overview & Equity Curve', icon: <TrendingUp className="w-3.5 h-3.5" /> },
          { id: 'calendar', label: 'PnL Calendar Heatmap', icon: <Calendar className="w-3.5 h-3.5" /> },
          { id: 'trades', label: `Trades Log (${entries.length})`, icon: <BookOpen className="w-3.5 h-3.5" /> },
          { id: 'analytics', label: 'R-Distribution & Expectancy', icon: <BarChart3 className="w-3.5 h-3.5" /> },
          { id: 'mistakes', label: `Cost of Mistakes (${metrics.mistakeCount})`, icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> },
          { id: 'strategies', label: 'Strategies & Edge', icon: <Award className="w-3.5 h-3.5 text-pink-400" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              playClickSound()
              setSubTab(tab.id as JournalSubTab)
            }}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              subTab === tab.id
                ? 'bg-gradient-to-r from-pink-600/30 to-rose-600/30 text-white border border-pink-500/50 shadow-[0_0_15px_rgba(236,72,153,0.3)]'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* 1. BREAKDOWN: EQUITY CURVE & 14-KPI SCORECARD                             */}
      {/* ========================================================================= */}
      {subTab === 'breakdown' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Equity Curve Card */}
          <div className="fin-card p-5 border border-pink-500/20 bg-gradient-to-b from-[#0c0f1c] to-[#08090f]">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>Cumulative Equity Curve in USD</span>
                </h3>
                <p className="text-[11px] text-gray-400">
                  Baseline capital $50,000.00 &bull; Daily compound growth trajectory
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono-num">
                <div>
                  <span className="text-gray-500 block text-[10px]">CURRENT EQUITY</span>
                  <span className="text-base font-extrabold text-white">
                    {formatCurrency(currentAccountBalance)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px]">REALIZED RETURN</span>
                  <span className="text-base font-extrabold text-emerald-400">
                    +{formatPercent((metrics.netPnl / 50000) * 100)}
                  </span>
                </div>
              </div>
            </div>

            {/* SVG Interactive Equity Curve */}
            <div className="w-full h-56 relative select-none">
              <svg className="w-full h-full" viewBox="0 0 800 200" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ec4899" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#ec4899" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <line x1="0" y1="40" x2="800" y2="40" stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
                <line x1="0" y1="100" x2="800" y2="100" stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
                <line x1="0" y1="160" x2="800" y2="160" stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />

                {/* Area Fill */}
                <polygon
                  fill="url(#equityGrad)"
                  points={`0,200 ${equityPointsStr} 800,200`}
                />

                {/* Smooth Curve Line */}
                <polyline
                  fill="none"
                  stroke="#ec4899"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={equityPointsStr}
                />

                {/* Point Dots */}
                {svgEquityPoints.map((sp, idx) => (
                  <circle
                    key={idx}
                    cx={sp.x}
                    cy={sp.y}
                    r="4"
                    className="fill-pink-500 hover:fill-white stroke-2 stroke-[#08090f] transition-all cursor-pointer"
                  >
                    <title>{`${sp.point.date}: $${sp.point.equity.toLocaleString()} (${sp.point.pnl >= 0 ? '+' : ''}$${sp.point.pnl})`}</title>
                  </circle>
                ))}
              </svg>
            </div>

            <div className="flex items-center justify-between text-[11px] text-gray-500 mt-2 font-mono-num px-1">
              <span>Start ($50,000.00)</span>
              <span>Oct 05 (+$2,414.80)</span>
              <span>Current Peak ($54,936.30)</span>
            </div>
          </div>

          {/* 14-KPI Institutional Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="fin-card p-3">
              <span className="text-[10px] text-gray-500 block uppercase font-bold">Invested Capital</span>
              <span className="text-base font-extrabold text-white font-mono-num">$50,000.00</span>
              <span className="text-[10px] text-gray-400 block mt-0.5">Prop baseline</span>
            </div>

            <div className="fin-card p-3">
              <span className="text-[10px] text-gray-500 block uppercase font-bold">Net Realized PnL</span>
              <span className="text-base font-extrabold text-emerald-400 font-mono-num">
                +{formatCurrency(metrics.netPnl)}
              </span>
              <span className="text-[10px] text-emerald-500 block mt-0.5">+{formatPercent((metrics.netPnl / 50000) * 100)}</span>
            </div>

            <div className="fin-card p-3">
              <span className="text-[10px] text-gray-500 block uppercase font-bold">Win Rate %</span>
              <span className="text-base font-extrabold text-white font-mono-num">{metrics.winRate.toFixed(1)}%</span>
              <span className="text-[10px] text-gray-400 block mt-0.5">{metrics.winCount}W &bull; {metrics.lossCount}L</span>
            </div>

            <div className="fin-card p-3">
              <span className="text-[10px] text-gray-500 block uppercase font-bold">Profit Factor</span>
              <span className="text-base font-extrabold text-pink-400 font-mono-num">{metrics.profitFactor.toFixed(2)}</span>
              <span className="text-[10px] text-pink-400/80 block mt-0.5">Tier-1 Institutional</span>
            </div>

            <div className="fin-card p-3">
              <span className="text-[10px] text-gray-500 block uppercase font-bold">Sharpe Ratio</span>
              <span className="text-base font-extrabold text-cyan-400 font-mono-num">{metrics.sharpe.toFixed(2)}</span>
              <span className="text-[10px] text-cyan-500 block mt-0.5">Sortino: {metrics.sortino.toFixed(2)}</span>
            </div>

            <div className="fin-card p-3">
              <span className="text-[10px] text-gray-500 block uppercase font-bold">Max Drawdown</span>
              <span className="text-base font-extrabold text-amber-400 font-mono-num">{metrics.maxDrawdownPct.toFixed(2)}%</span>
              <span className="text-[10px] text-gray-400 block mt-0.5">Strict Risk Buffer</span>
            </div>

            <div className="fin-card p-3">
              <span className="text-[10px] text-gray-500 block uppercase font-bold">Total Expectancy</span>
              <span className="text-base font-extrabold text-emerald-400 font-mono-num">
                {metrics.expectancy >= 0 ? '+' : ''}${metrics.expectancy.toFixed(2)}
              </span>
              <span className="text-[10px] text-gray-400 block mt-0.5">+{metrics.avgR}R / trade</span>
            </div>

            <div className="fin-card p-3">
              <span className="text-[10px] text-gray-500 block uppercase font-bold">Average Win</span>
              <span className="text-base font-extrabold text-emerald-400 font-mono-num">
                +${metrics.avgWin.toFixed(2)}
              </span>
              <span className="text-[10px] text-gray-400 block mt-0.5">Per winning setup</span>
            </div>

            <div className="fin-card p-3">
              <span className="text-[10px] text-gray-500 block uppercase font-bold">Average Loss</span>
              <span className="text-base font-extrabold text-rose-400 font-mono-num">
                -${metrics.avgLoss.toFixed(2)}
              </span>
              <span className="text-[10px] text-gray-400 block mt-0.5">Strict stop controlled</span>
            </div>

            <div className="fin-card p-3">
              <span className="text-[10px] text-gray-500 block uppercase font-bold">Best Trade</span>
              <span className="text-base font-extrabold text-emerald-400 font-mono-num">
                +${metrics.bestTrade.toFixed(2)}
              </span>
              <span className="text-[10px] text-gray-400 block mt-0.5">XAU/USD (+3.8R)</span>
            </div>

            <div className="fin-card p-3">
              <span className="text-[10px] text-gray-500 block uppercase font-bold">Worst Trade</span>
              <span className="text-base font-extrabold text-rose-400 font-mono-num">
                ${metrics.worstTrade.toFixed(2)}
              </span>
              <span className="text-[10px] text-gray-400 block mt-0.5">GBP/USD (-1.8R)</span>
            </div>

            <div className="fin-card p-3">
              <span className="text-[10px] text-gray-500 block uppercase font-bold">Accumulated R</span>
              <span className="text-base font-extrabold text-pink-400 font-mono-num">+{metrics.totalR}R</span>
              <span className="text-[10px] text-gray-400 block mt-0.5">Risk units won</span>
            </div>

            <div className="fin-card p-3">
              <span className="text-[10px] text-gray-500 block uppercase font-bold">Broker Commissions</span>
              <span className="text-base font-extrabold text-white font-mono-num">${metrics.totalFees}</span>
              <span className="text-[10px] text-gray-400 block mt-0.5">0.08% friction</span>
            </div>

            <div className="fin-card p-3">
              <span className="text-[10px] text-gray-500 block uppercase font-bold">Rule Adherence</span>
              <span className="text-base font-extrabold text-emerald-400 font-mono-num">
                {metrics.adherenceRate.toFixed(1)}%
              </span>
              <span className="text-[10px] text-gray-400 block mt-0.5">{metrics.mistakeCount} rule breaks</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. PNL CALENDAR HEATMAP (OPEN TRADER WORLD SPECIAL FEATURE)               */}
      {/* ========================================================================= */}
      {subTab === 'calendar' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Calendar Header */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#090b14] border border-white/5">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-pink-400" />
                <span>{calendarMonth}</span>
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono-num font-bold">
                Net: +{formatCurrency(metrics.netPnl)}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => playClickSound()}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => playClickSound()}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Month Grid Table */}
          <div className="fin-card overflow-hidden">
            <div className="grid grid-cols-8 text-center text-xs border-b border-white/10 font-bold text-gray-400 bg-[#08090f]/70 py-2.5">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
              <span className="text-pink-400 border-l border-white/10">Weekly Total</span>
            </div>

            {/* Weeks */}
            {[
              {
                week: 1,
                days: [
                  { num: 28, isPrev: true },
                  { num: 29, isPrev: true },
                  { num: 30, isPrev: true },
                  { num: 1 }, // Oct 1 (-$150)
                  { num: 2 }, // Oct 2 (+$225)
                  { num: 3 }, // Oct 3 (+$1150)
                  { num: 4 }, // Oct 4 (-$130)
                ],
                weekTotal: 1095.0,
                weekTrades: 4,
                weekWin: 50,
              },
              {
                week: 2,
                days: [
                  { num: 5 }, // Oct 5 (+$524.80)
                  { num: 6 }, // Oct 6 (+$545)
                  { num: 7 }, // Oct 7 (-$15)
                  { num: 8 }, // Oct 8 (+$962.50)
                  { num: 9 }, // Oct 9 (+$284)
                  { num: 10 }, // Oct 10 (+$1461)
                  { num: 11 },
                ],
                weekTotal: 3841.30,
                weekTrades: 11,
                weekWin: 81.8,
              },
              {
                week: 3,
                days: [{ num: 12 }, { num: 13 }, { num: 14 }, { num: 15 }, { num: 16 }, { num: 17 }, { num: 18 }],
                weekTotal: 0,
                weekTrades: 0,
                weekWin: 0,
              },
              {
                week: 4,
                days: [{ num: 19 }, { num: 20 }, { num: 21 }, { num: 22 }, { num: 23 }, { num: 24 }, { num: 25 }],
                weekTotal: 0,
                weekTrades: 0,
                weekWin: 0,
              },
            ].map((weekData) => (
              <div key={weekData.week} className="grid grid-cols-8 border-b border-white/5 min-h-[96px]">
                {weekData.days.map((dayObj, dIdx) => {
                  if (dayObj.isPrev) {
                    return (
                      <div key={dIdx} className="p-2 border-r border-white/5 bg-white/[0.01] text-gray-600 text-xs">
                        {dayObj.num}
                      </div>
                    )
                  }

                  const dayMeta = calendarData[dayObj.num]
                  const hasTrades = Boolean(dayMeta && dayMeta.trades.length > 0)
                  const isProfit = hasTrades && dayMeta.pnl >= 0

                  return (
                    <div
                      key={dIdx}
                      onClick={() => {
                        if (hasTrades) {
                          playClickSound()
                          setSelectedDayTrades(dayMeta.trades)
                        }
                      }}
                      className={`p-2 border-r border-white/5 transition-all flex flex-col justify-between ${
                        hasTrades ? 'cursor-pointer hover:border-pink-500/50' : ''
                      } ${
                        hasTrades
                          ? isProfit
                            ? 'bg-emerald-950/20 hover:bg-emerald-950/30'
                            : 'bg-rose-950/20 hover:bg-rose-950/30'
                          : 'bg-[#080a11]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className={`font-mono-num font-bold ${hasTrades ? 'text-white' : 'text-gray-500'}`}>
                          {dayObj.num}
                        </span>
                        {hasTrades && (
                          <span className="text-[10px] text-gray-400 font-mono-num">
                            {dayMeta.trades.length} {dayMeta.trades.length === 1 ? 'trade' : 'trades'}
                          </span>
                        )}
                      </div>

                      {hasTrades && (
                        <div className="my-auto text-left">
                          <div
                            className={`text-xs sm:text-sm font-extrabold font-mono-num ${
                              isProfit ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {isProfit ? '+' : ''}${dayMeta.pnl.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono-num mt-0.5">
                            {((dayMeta.winCount / dayMeta.trades.length) * 100).toFixed(0)}% win
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Week Total Column */}
                <div className="p-2 border-l border-white/10 bg-[#0c0f1c]/70 flex flex-col justify-center items-center text-xs font-mono-num">
                  <span className="text-[10px] text-gray-500">WEEK {weekData.week}</span>
                  <span
                    className={`font-black text-sm mt-1 ${
                      weekData.weekTotal > 0 ? 'text-emerald-400' : weekData.weekTotal < 0 ? 'text-rose-400' : 'text-gray-500'
                    }`}
                  >
                    {weekData.weekTotal > 0 ? `+$${weekData.weekTotal.toFixed(2)}` : '$0.00'}
                  </span>
                  {weekData.weekTrades > 0 && (
                    <span className="text-[10px] text-gray-400 mt-0.5">
                      {weekData.weekTrades} trades &bull; {weekData.weekWin}% W
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Drilldown modal/drawer when day cell is clicked */}
          {selectedDayTrades && (
            <div className="fin-card p-4 border border-pink-500/40 bg-[#0d101e] animate-in slide-in-from-top duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">
                    Trades Logged for {selectedDayTrades[0].date} ({selectedDayTrades.length})
                  </h4>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-bold font-mono-num">
                    Net PnL: ${selectedDayTrades.reduce((acc, curr) => acc + curr.pnl, 0).toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedDayTrades(null)}
                  className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {selectedDayTrades.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl bg-[#080a11] border border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`px-2 py-0.5 rounded font-extrabold text-[10px] ${
                          t.outcome === 'WIN' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {t.side}
                      </span>
                      <span className="font-bold text-white text-sm">{t.symbol}</span>
                      <span className="text-gray-400 font-mono-num">
                        {t.lotsOrSize} {t.market === 'FOREX' ? 'Lots' : 'Units'} @ {t.entryPrice} &rarr; {t.exitPrice}
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-pink-400 font-bold font-mono-num">+{t.rMultiple}R</span>
                      <span
                        className={`text-sm font-extrabold font-mono-num ${
                          t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                      </span>
                      <button
                        onClick={() => handleDeleteTrade(t.id)}
                        className="text-gray-500 hover:text-rose-400 p-1 rounded hover:bg-white/5 cursor-pointer"
                        title="Delete trade"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TRADES LOG TABLE WITH ADVANCED MULTI-FILTERS                           */}
      {/* ========================================================================= */}
      {subTab === 'trades' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Multi-Filter Bar matching OpenTraderWorld */}
          <div className="p-3.5 rounded-2xl bg-[#080a11] border border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Search Input */}
            <div className="flex items-center bg-[#121624] px-3 py-1.5 rounded-xl border border-white/10 w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-gray-400 mr-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symbol, setup, tags..."
                className="w-full bg-transparent font-medium text-white text-xs outline-none"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Market */}
              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl text-[11px] font-bold">
                {(['ALL', 'FOREX', 'CRYPTO'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setFilterMarket(m)}
                    className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                      filterMarket === m ? 'bg-pink-500/20 text-pink-300' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {m === 'ALL' ? 'All Markets' : m}
                  </button>
                ))}
              </div>

              {/* Side */}
              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl text-[11px] font-bold">
                {(['ALL', 'BUY', 'SELL'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterSide(s)}
                    className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                      filterSide === s ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {s === 'ALL' ? 'Any Side' : s === 'BUY' ? 'Long Only' : 'Short Only'}
                  </button>
                ))}
              </div>

              {/* Outcome */}
              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl text-[11px] font-bold">
                {(['ALL', 'WIN', 'LOSS'] as const).map((o) => (
                  <button
                    key={o}
                    onClick={() => setFilterOutcome(o)}
                    className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                      filterOutcome === o
                        ? o === 'WIN'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : o === 'LOSS'
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-white/15 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {o === 'ALL' ? 'All Outcomes' : o === 'WIN' ? 'Wins' : 'Losses'}
                  </button>
                ))}
              </div>

              {/* Strategy Selector */}
              <select
                value={filterStrategy}
                onChange={(e) => setFilterStrategy(e.target.value)}
                className="bg-[#121624] border border-white/10 px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-gray-300 outline-none cursor-pointer"
              >
                <option value="ALL">Any Strategy</option>
                {availableStrategies.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              {/* Tag / Mistake Selector */}
              <select
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
                className="bg-[#121624] border border-white/10 px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-gray-300 outline-none cursor-pointer"
              >
                <option value="ALL">Any Tag</option>
                <option value="#A+Setup">#A+Setup</option>
                <option value="#Disciplined">#Disciplined</option>
                <option value="MISTAKE">⚠️ Any Mistake</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="fin-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-gray-400 bg-[#08090f]/70 text-[11px] font-bold">
                    <th className="py-3 px-4">Date &amp; Asset</th>
                    <th className="py-3 px-3">Side</th>
                    <th className="py-3 px-3">Size / Lots</th>
                    <th className="py-3 px-4">Entry &rarr; Exit</th>
                    <th className="py-3 px-4">Setup Strategy</th>
                    <th className="py-3 px-3 text-right">R-Multiple</th>
                    <th className="py-3 px-4 text-right">Net PnL ($)</th>
                    <th className="py-3 px-3 text-center">Tags / Rule</th>
                    <th className="py-3 px-4">Hold &amp; Notes</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredTrades.map((trade) => {
                    const isWin = trade.outcome === 'WIN'
                    const hasMistake = trade.mistake && trade.mistake !== 'None'

                    return (
                      <tr key={trade.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-white text-xs">{trade.symbol}</div>
                          <div className="text-[10px] text-gray-500 font-mono-num">{trade.date}</div>
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                              trade.side === 'BUY'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {trade.side === 'BUY' ? 'LONG' : 'SHORT'}
                          </span>
                        </td>

                        <td className="py-3 px-3 font-mono-num text-gray-300">
                          {trade.lotsOrSize} {trade.market === 'FOREX' ? 'Lots' : ''}
                        </td>

                        <td className="py-3 px-4 font-mono-num text-xs">
                          <span className="text-gray-400">${trade.entryPrice.toLocaleString()}</span>
                          <span className="text-gray-600 mx-1.5">&rarr;</span>
                          <span className="text-white font-bold">${trade.exitPrice.toLocaleString()}</span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="text-[11px] font-semibold text-gray-200 block truncate max-w-[180px]">
                            {trade.setup}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right font-mono-num font-bold">
                          <span className={isWin ? 'text-pink-400' : 'text-rose-400'}>
                            {trade.rMultiple >= 0 ? '+' : ''}{trade.rMultiple}R
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right font-mono-num font-extrabold text-xs">
                          <span className={isWin ? 'text-emerald-400' : 'text-rose-400'}>
                            {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-center">
                          {hasMistake ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center gap-1 mx-auto max-w-[120px]">
                              <AlertTriangle className="w-3 h-3" />
                              <span className="truncate">{trade.mistake}</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-block">
                              {trade.tag || '#Clean'}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="text-[10px] text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{trade.duration || '1h 30m'}</span>
                          </div>
                          <div className="text-[11px] text-gray-400 truncate max-w-[220px] mt-0.5">
                            {trade.notes}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleDeleteTrade(trade.id)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-white/5 transition-colors cursor-pointer"
                            title="Delete entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. ANALYTICS & R-DISTRIBUTION (OPENTRADERWORLD EXPECTANCY MODEL)          */}
      {/* ========================================================================= */}
      {subTab === 'analytics' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Expectancy & Streaks Card (4 Cols) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="fin-card p-5 space-y-4 border border-pink-500/20">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-pink-400" />
                  <span>Mathematical Edge &amp; R Expectancy</span>
                </h3>

                <div className="p-4 rounded-xl bg-[#080a11] border border-white/5 space-y-3">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-bold">EXPECTANCY IN R</span>
                    <div className="text-2xl font-black text-pink-400 font-mono-num">
                      +{metrics.avgR}R
                    </div>
                    <span className="text-[11px] text-gray-400">Over {metrics.totalTrades} closed trades with strict stop</span>
                  </div>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-gray-500 block">TOTAL R UNITS</span>
                      <span className="text-base font-bold text-white font-mono-num">+{metrics.totalR}R</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 block">RISK PER TRADE</span>
                      <span className="text-base font-bold text-emerald-400 font-mono-num">1.50%</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-gray-400">Average Win in R:</span>
                    <span className="text-emerald-400 font-mono-num font-bold">
                      {metrics.avgWinR > 0 ? `+${metrics.avgWinR.toFixed(2)}R` : '+0.00R'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-gray-400">Average Loss in R:</span>
                    <span className="text-rose-400 font-mono-num font-bold">
                      {metrics.avgLossR > 0 ? `-${metrics.avgLossR.toFixed(2)}R` : '0.00R'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-gray-400">Up Trading Days:</span>
                    <span className="text-white font-mono-num font-bold">{metrics.upDays} days ({metrics.upDayPct.toFixed(1)}%)</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-gray-400">Down Trading Days:</span>
                    <span className="text-white font-mono-num font-bold">{metrics.downDays} days ({(100 - metrics.upDayPct).toFixed(1)}%)</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-gray-400">Current Winning Streak:</span>
                    <span className="text-emerald-400 font-bold font-mono-num">{metrics.currentStreak} Wins (Best: {metrics.bestStreak})</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: R-Multiple Distribution Histogram (8 Cols) */}
            <div className="lg:col-span-8">
              <div className="fin-card p-5 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span>R Distribution · Net PnL per R Bucket</span>
                    </h3>
                    <span className="text-xs text-gray-400 font-mono-num">OpenTraderWorld Histogram</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mb-6">
                    Distribution of closed trade outcomes measured in multiples of initial stop loss risk (R).
                  </p>
                </div>

                {/* Histogram Bars */}
                <div className="space-y-3.5 my-auto">
                  {metrics.rDistribution.buckets.map((b, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-xs font-mono-num">
                      <span className="w-24 text-right text-gray-400 text-[11px]">{b.bucket}</span>
                      <div className="flex-1 h-6 bg-[#080a11] rounded-lg overflow-hidden flex items-center p-1 border border-white/5">
                        <div
                          style={{ width: `${b.pct}%` }}
                          className={`h-full rounded-md transition-all ${
                            b.isLoss ? 'bg-rose-500/80 shadow-[0_0_10px_rgba(244,63,94,0.4)]' : 'bg-emerald-500/80 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                          }`}
                        />
                      </div>
                      <span className="w-16 text-right font-bold text-white">{b.count} trades</span>
                      <span
                        className={`w-24 text-right font-bold ${
                          b.pnl > 0 ? 'text-emerald-400' : b.pnl < 0 ? 'text-rose-400' : 'text-gray-500'
                        }`}
                      >
                        {b.pnl !== 0 ? `${b.pnl > 0 ? '+' : ''}$${b.pnl.toFixed(0)}` : '—'}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-white/5 text-[11px] text-gray-500 flex items-center justify-between">
                  <span>
                    Skewness: {metrics.rDistribution.skewness > 0 ? `Positive (+${metrics.rDistribution.skewness.toFixed(2)})` : metrics.rDistribution.skewness < 0 ? `Negative (${metrics.rDistribution.skewness.toFixed(2)})` : 'Symmetric (0.00)'} &bull; {metrics.rDistribution.skewness > 0.5 ? 'Fat right-tail' : 'Balanced'} distribution
                  </span>
                  <span className="text-emerald-400 font-bold font-mono-num">&gt;2R Trade Ratio: {metrics.ratioAbove2R.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. COST OF MISTAKES: PSYCHOLOGICAL BEHAVIORAL EDGE ANALYSIS               */}
      {/* ========================================================================= */}
      {subTab === 'mistakes' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Main Hero Insight Banner */}
          <div className="fin-card p-5 border border-amber-500/30 bg-gradient-to-r from-amber-950/20 via-[#0a0d18] to-[#07080c] relative overflow-hidden">
            <div className="flex items-center gap-2.5 text-amber-400 font-extrabold text-sm mb-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <span>Behavioral Audit: Cost of Trading Rule Infractions</span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed max-w-4xl">
              <strong>{metrics.mistakeCount} of {metrics.totalTrades} closed trades</strong> broke a core trading rule. 
              The trades following rules averaged <strong className="text-emerald-400">+${(metrics.cleanPnl / (metrics.cleanTrades.length || 1)).toFixed(2)}</strong>, 
              whereas the mistake trades averaged <strong className="text-rose-400">-${(Math.abs(metrics.mistakePnl) / (metrics.mistakeCount || 1)).toFixed(2)}</strong>. 
              Eliminating these 4 rule-breaks would have added <strong className="text-amber-300 font-mono-num font-bold">+{formatCurrency(metrics.costOfMistakes)}</strong> directly to your bottom line!
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/10 font-mono-num">
              <div>
                <span className="text-[10px] text-gray-500 block">TOTAL COST OF MISTAKES</span>
                <span className="text-xl font-black text-rose-400">-${metrics.costOfMistakes.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 block">RULE ADHERENCE</span>
                <span className="text-xl font-black text-amber-400">{metrics.adherenceRate.toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 block">NET FROM CLEAN TRADES</span>
                <span className="text-xl font-black text-emerald-400">+{formatCurrency(metrics.cleanPnl)}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 block">NET FROM MISTAKE TRADES</span>
                <span className="text-xl font-black text-rose-400">-${Math.abs(metrics.mistakePnl).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Breakdown of Specific Mistake Categories */}
          <div className="fin-card overflow-hidden">
            <div className="p-4 border-b border-white/5 font-bold text-xs text-white">
              Specific Rule Violations Log
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-gray-400 bg-[#08090f]/70 text-[11px] font-bold">
                    <th className="py-3 px-4">Mistake Type</th>
                    <th className="py-3 px-4 text-center">Occurrences</th>
                    <th className="py-3 px-4 text-center">Win Rate</th>
                    <th className="py-3 px-4 text-right">Net PnL Impact</th>
                    <th className="py-3 px-4 text-right">Avg R Loss</th>
                    <th className="py-3 px-4">AI Quantitative Prescription</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[
                    {
                      name: 'Moved stop',
                      trades: 1,
                      winRate: '0.0%',
                      net: -300.0,
                      avgR: '-1.8R',
                      prescription: 'Hard-coded DMA contract order locks stop loss at broker level.',
                    },
                    {
                      name: 'FOMO entered',
                      trades: 1,
                      winRate: '0.0%',
                      net: -150.0,
                      avgR: '-1.0R',
                      prescription: 'Enforce SMC FVG minimum 15m candle close requirement before entry.',
                    },
                    {
                      name: 'Overtraded',
                      trades: 1,
                      winRate: '0.0%',
                      net: -130.0,
                      avgR: '-1.0R',
                      prescription: 'Maximum 3 trades per 24 hours execution governor circuit-breaker.',
                    },
                    {
                      name: 'Exited early',
                      trades: 1,
                      winRate: '0.0%',
                      net: -30.0,
                      avgR: '-0.6R',
                      prescription: 'Enable AI Trailing Stop to automate partial take-profit scaling.',
                    },
                  ].map((m, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-amber-400 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>{m.name}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono-num text-white">{m.trades}</td>
                      <td className="py-3.5 px-4 text-center font-mono-num text-gray-400">{m.winRate}</td>
                      <td className="py-3.5 px-4 text-right font-mono-num font-bold text-rose-400">
                        ${m.net.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-num text-rose-300 font-semibold">{m.avgR}</td>
                      <td className="py-3.5 px-4 text-xs text-gray-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                        <span>{m.prescription}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. STRATEGIES & CAPITAL ALLOCATION                                        */}
      {/* ========================================================================= */}
      {subTab === 'strategies' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="fin-card overflow-hidden">
            <div className="p-4 border-b border-white/5 font-bold text-xs text-white flex items-center justify-between">
              <span>Strategy Edge Leaderboard</span>
              <span className="text-[11px] text-gray-400 font-mono-num">Categorized by Setup Mechanics</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-gray-400 bg-[#08090f]/70 text-[11px] font-bold">
                    <th className="py-3 px-4">Setup Strategy</th>
                    <th className="py-3 px-4 text-center">Trades</th>
                    <th className="py-3 px-4 text-center">Win Rate</th>
                    <th className="py-3 px-4 text-right">Net PnL ($)</th>
                    <th className="py-3 px-4 text-right">Total R</th>
                    <th className="py-3 px-4 text-center">Edge Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[
                    { name: 'SMC Order Block + FVG', trades: 4, winRate: '100%', pnl: 3495.0, r: '+12.7R', rating: 'A+ Elite Edge' },
                    { name: 'Neural Transformer Scalp', trades: 3, winRate: '100%', pnl: 1056.0, r: '+7.8R', rating: 'A+ Elite Edge' },
                    { name: 'Asian / London Sweep', trades: 2, winRate: '100%', pnl: 925.0, r: '+4.6R', rating: 'A Institutional' },
                    { name: 'BOJ Intervention Flow', trades: 1, winRate: '100%', pnl: 524.8, r: '+2.6R', rating: 'A Macro Trend' },
                    { name: 'Divergence Scalp', trades: 1, winRate: '100%', pnl: 225.0, r: '+1.9R', rating: 'B Standard' },
                    { name: 'Breakout Retest / Trend', trades: 3, winRate: '0.0%', pnl: -346.0, r: '-2.6R', rating: 'C Revise Rule' },
                    { name: 'News Straddle', trades: 1, winRate: '0.0%', pnl: -300.0, r: '-1.8R', rating: 'D High Risk' },
                  ].map((s, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                        <Award className="w-3.5 h-3.5 text-pink-400" />
                        <span>{s.name}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono-num text-gray-300">{s.trades}</td>
                      <td className="py-3.5 px-4 text-center font-mono-num font-bold text-emerald-400">{s.winRate}</td>
                      <td
                        className={`py-3.5 px-4 text-right font-mono-num font-bold ${
                          s.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {s.pnl >= 0 ? '+' : ''}${s.pnl.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-num font-bold text-pink-400">{s.r}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.rating.includes('A+')
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : s.rating.includes('A')
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                              : s.rating.includes('B')
                              ? 'bg-blue-500/20 text-blue-300'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {s.rating}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LOG NEW TRADE ENTRY MODAL                                                 */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="fin-card w-full max-w-xl p-6 border border-pink-500/30 bg-[#0d101d] shadow-[0_0_50px_rgba(236,72,153,0.15)] relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <Plus className="w-5 h-5 text-pink-400" />
              <span>Log Trade Entry to Journal</span>
            </h3>

            <form onSubmit={handleAddTrade} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 block mb-1">Symbol</label>
                  <input
                    type="text"
                    value={formSymbol}
                    onChange={(e) => setFormSymbol(e.target.value)}
                    className="w-full bg-[#080a11] border border-white/10 rounded-xl px-3 py-2 text-white font-mono-num font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">Market Category</label>
                  <select
                    value={formMarket}
                    onChange={(e) => setFormMarket(e.target.value as MarketCategory)}
                    className="w-full bg-[#080a11] border border-white/10 rounded-xl px-3 py-2 text-white font-bold"
                  >
                    <option value="FOREX">Forex &amp; Gold</option>
                    <option value="CRYPTO">Crypto</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-gray-400 block mb-1">Side</label>
                  <select
                    value={formSide}
                    onChange={(e) => setFormSide(e.target.value as 'BUY' | 'SELL')}
                    className="w-full bg-[#080a11] border border-white/10 rounded-xl px-3 py-2 text-white font-bold"
                  >
                    <option value="BUY">LONG (Buy)</option>
                    <option value="SELL">SHORT (Sell)</option>
                  </select>
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">Size / Lots</label>
                  <input
                    type="number"
                    step="any"
                    value={formSize}
                    onChange={(e) => setFormSize(Number(e.target.value))}
                    className="w-full bg-[#080a11] border border-white/10 rounded-xl px-3 py-2 text-white font-mono-num font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">Net PnL ($)</label>
                  <input
                    type="number"
                    step="any"
                    value={formPnl}
                    onChange={(e) => setFormPnl(Number(e.target.value))}
                    className="w-full bg-[#080a11] border border-white/10 rounded-xl px-3 py-2 text-emerald-400 font-mono-num font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-gray-400 block mb-1">Entry Price</label>
                  <input
                    type="number"
                    step="any"
                    value={formEntry}
                    onChange={(e) => setFormEntry(Number(e.target.value))}
                    className="w-full bg-[#080a11] border border-white/10 rounded-xl px-3 py-2 text-white font-mono-num font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">Exit Price</label>
                  <input
                    type="number"
                    step="any"
                    value={formExit}
                    onChange={(e) => setFormExit(Number(e.target.value))}
                    className="w-full bg-[#080a11] border border-white/10 rounded-xl px-3 py-2 text-white font-mono-num font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">R-Multiple</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formR}
                    onChange={(e) => setFormR(Number(e.target.value))}
                    className="w-full bg-[#080a11] border border-white/10 rounded-xl px-3 py-2 text-pink-400 font-mono-num font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 block mb-1">Setup Strategy</label>
                  <input
                    type="text"
                    value={formSetup}
                    onChange={(e) => setFormSetup(e.target.value)}
                    className="w-full bg-[#080a11] border border-white/10 rounded-xl px-3 py-2 text-white font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">Mistake / Rule Broken?</label>
                  <select
                    value={formMistake}
                    onChange={(e) => setFormMistake(e.target.value as any)}
                    className="w-full bg-[#080a11] border border-white/10 rounded-xl px-3 py-2 text-amber-300 font-bold"
                  >
                    <option value="None">None (Followed Plan)</option>
                    <option value="Exited early">Exited early</option>
                    <option value="Overtraded">Overtraded</option>
                    <option value="Moved stop">Moved stop</option>
                    <option value="FOMO entered">FOMO entered</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 block mb-1">Execution Tag</label>
                  <input
                    type="text"
                    value={formTag}
                    onChange={(e) => setFormTag(e.target.value)}
                    className="w-full bg-[#080a11] border border-white/10 rounded-xl px-3 py-2 text-white font-bold"
                    placeholder="#A+Setup"
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">Trade Duration</label>
                  <input
                    type="text"
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value)}
                    className="w-full bg-[#080a11] border border-white/10 rounded-xl px-3 py-2 text-white font-bold"
                    placeholder="1h 30m"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-400 block mb-1">Trader Notes &amp; Reflection</label>
                <textarea
                  rows={3}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-[#080a11] border border-white/10 rounded-xl px-3 py-2 text-gray-200"
                  placeholder="What was the reason for entry? Did you respect risk rules?"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 text-white font-bold text-xs shadow-lg cursor-pointer"
              >
                Log Trade Entry
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
