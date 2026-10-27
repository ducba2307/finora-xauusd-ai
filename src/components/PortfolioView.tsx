import React from 'react'
import type { UserPortfolio, AccountBalanceSheet } from '../types/trading'
import { formatCurrency } from '../utils/formatters'

interface PortfolioViewProps {
  portfolio: UserPortfolio
  balanceSheet?: AccountBalanceSheet
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({ portfolio, balanceSheet }) => {
  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <span>Finora Risk Management</span>
            <span>&gt;</span>
            <span className="text-pink-400 font-medium">Portfolio &amp; Risk Analytics</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <span>Quantitative Portfolio Risk Desk</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold font-mono-num">
              Hedge Ratio: 0.94 (Optimal)
            </span>
          </h1>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="fin-card p-5">
          <div className="text-xs text-gray-400 mb-1">Total Net Worth / Equity</div>
          <div className="text-3xl font-extrabold text-white font-mono-num">
            {formatCurrency(balanceSheet ? balanceSheet.equity : portfolio.totalBalance)}
          </div>
          <div className="text-xs text-emerald-400 font-bold mt-2 font-mono-num">
            Cash: {formatCurrency(balanceSheet ? balanceSheet.cashBalance : portfolio.totalBalance)}
          </div>
        </div>

        <div className="fin-card p-5">
          <div className="text-xs text-gray-400 mb-1">Daily Value at Risk (VaR 95%)</div>
          <div className="text-3xl font-extrabold text-indigo-400 font-mono-num">
            $342.50
          </div>
          <div className="text-xs text-gray-400 mt-2">1.4% of total equity</div>
        </div>

        <div className="fin-card p-5">
          <div className="text-xs text-gray-400 mb-1">Portfolio Beta (vs BTC)</div>
          <div className="text-3xl font-extrabold text-pink-400 font-mono-num">
            0.62
          </div>
          <div className="text-xs text-emerald-400 mt-2">Significantly less volatile than BTC</div>
        </div>

        <div className="fin-card p-5">
          <div className="text-xs text-gray-400 mb-1">Total Fee Alpha Savings</div>
          <div className="text-3xl font-extrabold text-emerald-400 font-mono-num">
            +$1,845.00
          </div>
          <div className="text-xs text-gray-400 mt-2">Private MEV routing rebates</div>
        </div>
      </div>

      {/* Asset Allocations Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 fin-card p-5">
          <h3 className="text-base font-bold text-white mb-4">Account Balances &amp; Margin Collateral</h3>
          <div className="divide-y divide-white/5">
            {Object.entries(portfolio.balances).map(([token, amount]) => (
              <div key={token} className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center font-bold text-white text-xs">
                    {token[0]}
                  </div>
                  <div>
                    <div className="font-bold text-white">{token}</div>
                    <div className="text-[10px] text-gray-400 font-mono-num">Spot &amp; Margin Collateral</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-white font-mono-num">
                    {amount.toLocaleString()} {token}
                  </div>
                  <div className="text-[11px] text-emerald-400 font-mono-num">100% Unencumbered</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Scorecard */}
        <div className="fin-card p-5 space-y-4">
          <h3 className="text-base font-bold text-white">Risk Engine Telemetry</h3>
          
          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between text-gray-400 mb-1">
                <span>Liquidation Distance</span>
                <span className="text-emerald-400 font-bold font-mono-num">+34.8% Safe Margin</span>
              </div>
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: '85%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-gray-400 mb-1">
                <span>Concentration Risk</span>
                <span className="text-indigo-400 font-bold font-mono-num">Diversified</span>
              </div>
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full rounded-full" style={{ width: '60%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-gray-400 mb-1">
                <span>Max Drawdown Breaker</span>
                <span className={`font-bold font-mono-num ${balanceSheet?.isCircuitBreakerTripped ? 'text-rose-400 animate-pulse' : 'text-pink-400'}`}>
                  {balanceSheet?.isCircuitBreakerTripped
                    ? `TRIPPED (-${balanceSheet.dailyDrawdownPct.toFixed(1)}%)`
                    : `ARMED (${balanceSheet ? balanceSheet.dailyDrawdownPct.toFixed(1) : '0.0'}% / 4.5%)`}
                </span>
              </div>
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${balanceSheet?.isCircuitBreakerTripped ? 'bg-rose-500' : 'bg-pink-500'}`}
                  style={{ width: `${Math.min(100, ((balanceSheet?.dailyDrawdownPct ?? 0) / 4.5) * 100)}%` }}
                ></div>
              </div>
            </div>

            {balanceSheet && (
              <div className="pt-2 border-t border-white/5 space-y-1">
                <div className="flex justify-between text-[11px] text-gray-400">
                  <span>Margin Level:</span>
                  <span className="text-white font-mono-num font-bold">{balanceSheet.marginLevelPct.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-[11px] text-gray-400">
                  <span>Free Margin:</span>
                  <span className="text-cyan-400 font-mono-num font-bold">{formatCurrency(balanceSheet.freeMargin)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-gray-400">
                  <span>Margin Used:</span>
                  <span className="text-pink-400 font-mono-num font-bold">{formatCurrency(balanceSheet.marginUsed)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/5 text-[11px] text-gray-400 leading-relaxed">
            Finora's autonomous risk daemon scans your positions every 250 milliseconds. If extreme market slippage occurs, auto-hedge locks in zero-loss deltas.
          </div>
        </div>
      </div>
    </div>
  )
}
