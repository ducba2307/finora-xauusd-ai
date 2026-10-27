import React, { useState } from 'react'
import { Calendar, Compass } from 'lucide-react'
import { INITIAL_ECONOMIC_EVENTS, INITIAL_SMC_PATTERNS } from '../data/mockData'

export const AIIntelligenceView: React.FC = () => {
  const [selectedAsset, setSelectedAsset] = useState<'XAU/USD' | 'BTC/USDT' | 'EUR/USD'>('XAU/USD')

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <span>Finora AI Core</span>
            <span>&gt;</span>
            <span className="text-pink-400 font-medium">Market Intelligence &amp; Macro Desk</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <span>AI Macro &amp; Technical Confluence Engine</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold font-mono-num">
              SMC &amp; ICT Multi-Timeframe Radar
            </span>
          </h1>
        </div>

        {/* Asset Quick Switcher */}
        <div className="flex items-center gap-2 bg-[#080a11] p-1 rounded-xl border border-white/10 text-xs">
          {(['XAU/USD', 'BTC/USDT', 'EUR/USD'] as const).map((sym) => (
            <button
              key={sym}
              onClick={() => setSelectedAsset(sym)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                selectedAsset === sym
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.3)]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {sym}
            </button>
          ))}
        </div>
      </div>

      {/* Top 3 Analytical Summary Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Gauge 1: Technical Confluence Summary */}
        <div className="fin-card p-5">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>Overall Technical Confluence ({selectedAsset})</span>
            <span className="text-emerald-400 font-bold font-mono-num">STRONG BUY</span>
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 font-mono-num">
            94.6% Bullish
          </div>
          <div className="space-y-1.5 mt-3 pt-3 border-t border-white/5 text-xs text-gray-400">
            <div className="flex justify-between">
              <span>Oscillators (RSI, Stochastic):</span>
              <span className="text-emerald-400 font-bold">Buy (RSI 14 = 61.4)</span>
            </div>
            <div className="flex justify-between">
              <span>Moving Averages (EMA 20/50/200):</span>
              <span className="text-emerald-400 font-bold">Strong Buy (Golden Cross)</span>
            </div>
            <div className="flex justify-between">
              <span>MACD Histogram:</span>
              <span className="text-emerald-400 font-bold">+18.4 (Bullish Divergence)</span>
            </div>
          </div>
        </div>

        {/* Gauge 2: Smart Money Concept (SMC) Status */}
        <div className="fin-card p-5">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>Smart Money Market Structure</span>
            <span className="text-pink-400 font-bold font-mono-num">BOS Confirmed</span>
          </div>
          <div className="text-3xl font-extrabold text-white font-mono-num">
            Order Flow Bullish
          </div>
          <div className="space-y-1.5 mt-3 pt-3 border-t border-white/5 text-xs text-gray-400">
            <div className="flex justify-between">
              <span>Fair Value Gap (FVG):</span>
              <span className="text-pink-300 font-bold">Unmitigated @ Support</span>
            </div>
            <div className="flex justify-between">
              <span>Liquidity Pool Target:</span>
              <span className="text-white font-mono-num font-bold">Buy-Side Liquidity (BSL)</span>
            </div>
            <div className="flex justify-between">
              <span>Killzone Session:</span>
              <span className="text-emerald-400 font-bold">London / NY Overlap Active</span>
            </div>
          </div>
        </div>

        {/* Gauge 3: Global Macro & Currency Strength */}
        <div className="fin-card p-5">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>Macro Currency Strength Barometer</span>
            <span className="text-indigo-400 font-bold font-mono-num">DXY WEAKNESS</span>
          </div>
          <div className="text-3xl font-extrabold text-indigo-400 font-mono-num">
            Gold &amp; Crypto Tailwinds
          </div>
          <div className="space-y-1.5 mt-3 pt-3 border-t border-white/5 text-xs text-gray-400">
            <div className="flex justify-between">
              <span>Fed Rate Cut Probability:</span>
              <span className="text-emerald-400 font-bold font-mono-num">89% (-25 bps expected)</span>
            </div>
            <div className="flex justify-between">
              <span>Crypto ETF Institutional Inflow:</span>
              <span className="text-emerald-400 font-bold font-mono-num">+$482M / day</span>
            </div>
            <div className="flex justify-between">
              <span>Central Bank Gold Purchases:</span>
              <span className="text-emerald-400 font-bold font-mono-num">+78 tonnes (Q4)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Two Column Stage: SMC Scanner vs Economic Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: SMC & Institutional Liquidity Scanner */}
        <div className="fin-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-pink-400" />
              <h3 className="text-base font-bold text-white tracking-tight">
                SMC &amp; Liquidity Imbalance Scanner
              </h3>
            </div>
            <span className="text-[11px] text-gray-400 font-mono-num">Scanned M5–H4</span>
          </div>

          <div className="space-y-3">
            {INITIAL_SMC_PATTERNS.map((p) => {
              const isBull = p.direction === 'BULLISH'

              return (
                <div
                  key={p.id}
                  className="p-3.5 rounded-xl bg-[#080a11] border border-white/5 hover:border-pink-500/20 transition-all flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                        isBull
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {isBull ? '▲' : '▼'}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{p.symbol}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-gray-300 font-mono-num">
                          {p.timeframe}
                        </span>
                        <span className="text-xs font-semibold text-pink-300">{p.patternName}</span>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5 font-mono-num">
                        Price Zone: <strong className="text-gray-200">{p.priceRange}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      {p.aiConfidence}% Conf
                    </span>
                    <span className="text-[10px] text-gray-500 block mt-1">{p.status}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Real-time Macro Economic Calendar */}
        <div className="fin-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white tracking-tight">
                High-Impact Macro Economic Calendar
              </h3>
            </div>
            <span className="text-[11px] text-emerald-400 font-mono-num font-semibold">Live Fed/CPI Feed</span>
          </div>

          <div className="space-y-3">
            {INITIAL_ECONOMIC_EVENTS.map((evt) => {
              const isHigh = evt.impact === 'HIGH'

              return (
                <div
                  key={evt.id}
                  className="p-3.5 rounded-xl bg-[#080a11] border border-white/5 hover:border-indigo-500/20 transition-all flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{evt.flag}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{evt.event}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                            isHigh ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {evt.impact}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5 font-mono-num">
                        Forecast: <span className="text-gray-300 font-bold">{evt.forecast}</span> • Prev: {evt.previous}
                        {evt.actual && (
                          <span className="text-emerald-400 ml-2 font-bold">• Actual: {evt.actual}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] font-bold text-white font-mono-num">{evt.time}</span>
                    <span className="text-[10px] text-pink-400 block mt-0.5 font-semibold">
                      {evt.aiSentiment.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
