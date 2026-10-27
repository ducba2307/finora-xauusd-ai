import React, { useState } from 'react'
import { Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { INITIAL_WHALE_ALERTS } from '../data/mockData'
import { formatCurrency } from '../utils/formatters'

export const WhaleRadarView: React.FC = () => {
  const [filterSymbol, setFilterSymbol] = useState<string>('ALL')

  const filteredAlerts = filterSymbol === 'ALL'
    ? INITIAL_WHALE_ALERTS
    : INITIAL_WHALE_ALERTS.filter((w) => w.symbol === filterSymbol)

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <span>Finora Intelligence</span>
            <span>&gt;</span>
            <span className="text-pink-400 font-medium">On-Chain Whale &amp; Smart Money Radar</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <span>Whale Flow Telemetry</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold font-mono-num flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              Live Mempool Sniffer Active
            </span>
          </h1>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-[#080a11] p-1 rounded-xl border border-white/10 text-xs">
          {['ALL', 'BTC', 'ETH', 'SOL', 'QNT'].map((s) => (
            <button
              key={s}
              onClick={() => setFilterSymbol(s)}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                filterSymbol === s
                  ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Top Telemetry Meters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Meter 1: Exchange Inflow vs Outflow */}
        <div className="fin-card p-5">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>24h CEX Net Exchange Flow</span>
            <span className="text-emerald-400 font-bold font-mono-num">NET OUTFLOW (Bullish)</span>
          </div>
          <div className="text-2xl font-extrabold text-white font-mono-num">
            -$412,850,000
          </div>
          <div className="w-full bg-rose-500/30 h-2.5 rounded-full mt-3 overflow-hidden flex">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: '74%' }}></div>
          </div>
          <div className="flex justify-between text-[11px] text-gray-400 mt-2 font-mono-num">
            <span className="text-emerald-400">Outflows: $890M (74%)</span>
            <span className="text-rose-400">Inflows: $310M (26%)</span>
          </div>
        </div>

        {/* Meter 2: Liquidation Pool Hotspot */}
        <div className="fin-card p-5">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>Nearest High-Density Liquidation Pool</span>
            <span className="text-pink-400 font-bold font-mono-num">Short Squeeze Zone</span>
          </div>
          <div className="text-2xl font-extrabold text-white font-mono-num">
            $117,250.00
          </div>
          <div className="text-xs text-gray-400 mt-3 flex justify-between">
            <span>Estimated Squeeze Volume:</span>
            <strong className="text-white font-mono-num">$1.42B Liquidation Depth</strong>
          </div>
          <div className="text-[11px] text-emerald-400 mt-1 font-semibold">
            AI Projection: +88% probability of magnetic pull
          </div>
        </div>

        {/* Meter 3: Smart Money Conviction Index */}
        <div className="fin-card p-5">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>Top 100 Whale Conviction Index</span>
            <span className="text-emerald-400 font-bold font-mono-num">HEAVY ACCUMULATION</span>
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono-num">
            92 / 100
          </div>
          <div className="text-xs text-gray-400 mt-3 flex justify-between">
            <span>Whale Clusters Monitored:</span>
            <strong className="text-white font-mono-num">4,280 Verified Addresses</strong>
          </div>
          <div className="text-[11px] text-pink-300 mt-1 font-semibold">
            Zero significant dump orders on order book
          </div>
        </div>
      </div>

      {/* Whale Alerts Live Table */}
      <div className="fin-card p-5">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-pink-400" />
          <span>Real-time High-Conviction Whale Transfers (&gt;$10M USD)</span>
        </h3>

        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const isOutflow = alert.type === 'CEX_OUTFLOW' || alert.type === 'WHALE_ACCUMULATION'

            return (
              <div
                key={alert.id}
                className="p-4 rounded-xl bg-[#080b12] border border-white/5 hover:border-pink-500/25 transition-all flex flex-wrap items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                      isOutflow
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {isOutflow ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm font-mono-num">
                        {alert.amount.toLocaleString()} {alert.symbol}
                      </span>
                      <span className="text-xs text-gray-400 font-mono-num">
                        ({formatCurrency(alert.usdValue)})
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-extrabold uppercase ${
                          alert.conviction === 'EXTREME'
                            ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                            : 'bg-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        {alert.type.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                      <span>From: <strong className="text-gray-300">{alert.from}</strong></span>
                      <span>➔</span>
                      <span>To: <strong className="text-gray-300">{alert.to}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-gray-500">{alert.timestamp}</div>
                  <div className="text-xs font-bold text-emerald-400 mt-0.5">
                    {alert.conviction} CONVICTION
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
