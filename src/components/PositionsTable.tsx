import React from 'react'
import type { Position } from '../types/trading'
import { formatCurrency, formatPrice } from '../utils/formatters'

interface PositionsTableProps {
  positions: Position[]
  onClosePosition: (positionId: string) => void
}

export const PositionsTable = React.memo<PositionsTableProps>(function PositionsTable({
  positions,
  onClosePosition,
}) {
  return (
    <div className="fin-card p-4">
      <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-white tracking-tight">
            Open Positions ({positions.length})
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30">
            Real-time Margin Engine
          </span>
        </div>
      </div>

      {positions.length === 0 ? (
        <div className="py-10 text-center text-xs text-gray-500">
          No open positions. Use the order desk on the right to open a leveraged position or enable autonomous bots.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 text-gray-400 font-semibold">
                <th className="pb-2.5 pl-2">Contract</th>
                <th className="pb-2.5 text-right">Size</th>
                <th className="pb-2.5 text-right">Entry Price</th>
                <th className="pb-2.5 text-right">Mark Price</th>
                <th className="pb-2.5 text-right">Liq. Price</th>
                <th className="pb-2.5 text-right">Margin</th>
                <th className="pb-2.5 text-right">Unrealized PnL</th>
                <th className="pb-2.5 text-right pr-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {positions.map((pos) => {
                const isLong = pos.side === 'LONG'
                const isProfitable = pos.unrealizedPnl >= 0

                return (
                  <tr key={pos.id} className="hover:bg-white/5 transition-colors">
                    {/* Contract Symbol & Side */}
                    <td className="py-3 pl-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold font-mono-num ${
                            isLong
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {pos.side} {pos.leverage}x
                        </span>
                        <span className="font-bold text-white">{pos.symbol}</span>
                      </div>
                    </td>

                    {/* Size */}
                    <td className="py-3 text-right font-bold text-gray-200 font-mono-num">
                      {pos.size}
                    </td>

                    {/* Entry Price */}
                    <td className="py-3 text-right text-gray-300 font-mono-num">
                      {formatPrice(pos.entryPrice, pos.symbol)}
                    </td>

                    {/* Mark Price */}
                    <td className="py-3 text-right font-bold text-white font-mono-num">
                      {formatPrice(pos.markPrice, pos.symbol)}
                    </td>

                    {/* Liq Price */}
                    <td className="py-3 text-right font-mono-num font-bold text-amber-400">
                      {formatPrice(pos.liquidationPrice, pos.symbol)}
                    </td>

                    {/* Margin */}
                    <td className="py-3 text-right text-gray-300 font-mono-num">
                      {formatCurrency(pos.margin)}
                    </td>

                    {/* Unrealized PnL */}
                    <td className="py-3 text-right font-mono-num font-bold">
                      <div className={isProfitable ? 'text-emerald-400' : 'text-rose-400'}>
                        {isProfitable ? '+' : ''}${pos.unrealizedPnl.toFixed(2)}
                        <span className="text-[10px] ml-1">
                          ({isProfitable ? '+' : ''}{pos.unrealizedPnlPct.toFixed(2)}%)
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 text-right pr-2">
                      <button
                        onClick={() => onClosePosition(pos.id)}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 font-bold text-[11px] border border-rose-500/30 transition-all cursor-pointer"
                      >
                        Market Close
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
})
