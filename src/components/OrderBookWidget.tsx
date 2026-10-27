import React, { useState } from 'react'
import type { OrderBook, PublicTrade } from '../types/trading'
import { formatPrice, formatPips } from '../utils/formatters'
import { getAssetConfig } from '../services/marketDataSimulator'
import { Activity, Layers } from 'lucide-react'

interface OrderBookWidgetProps {
  orderBook: OrderBook
  trades: PublicTrade[]
  currentPrice: number
  onSelectPrice: (price: number) => void
  symbol?: string
}

export const OrderBookWidget = React.memo<OrderBookWidgetProps>(function OrderBookWidget({
  orderBook,
  trades,
  currentPrice,
  onSelectPrice,
  symbol = 'BTC/USDT',
}) {
  const [activeTab, setActiveTab] = useState<'book' | 'trades'>('book')

  const [base, quote] = symbol.includes('/')
    ? symbol.split('/')
    : [symbol, 'USDT']
  const cfg = getAssetConfig(symbol)
  const spreadPips = cfg.pipSize > 0 ? orderBook.spread / cfg.pipSize : 0
  const isForex = cfg.isForex

  return (
    <div className="fin-card p-4 flex flex-col justify-between h-full text-xs">
      {/* Header with Book / Trades toggle */}
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('book')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'book'
                ? 'bg-white/10 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-pink-400" />
            <span>Order Book (L2)</span>
          </button>
          <button
            onClick={() => setActiveTab('trades')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'trades'
                ? 'bg-white/10 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span>Market Trades</span>
          </button>
        </div>

        <div className="text-[11px] text-gray-500 font-mono-num">
          0.1 Tick
        </div>
      </div>

      {activeTab === 'book' ? (
        <div className="flex-1 flex flex-col justify-between py-2">
          {/* Column labels */}
          <div className="grid grid-cols-3 text-[11px] text-gray-500 font-medium pb-1.5">
            <span>Price ({quote})</span>
            <span className="text-right">Size ({base})</span>
            <span className="text-right">Total</span>
          </div>

          {/* Asks (Sell orders - Red) */}
          <div className="space-y-0.5">
            {orderBook.asks.slice(-6).map((ask, idx) => (
              <div
                key={`ask-${idx}`}
                onClick={() => onSelectPrice(ask.price)}
                className="grid grid-cols-3 py-0.5 px-1 relative hover:bg-white/5 cursor-pointer rounded transition-colors group select-none"
              >
                {/* Visual Depth Bar */}
                <div
                  className="absolute right-0 top-0 bottom-0 bg-rose-500/15 pointer-events-none rounded-r transition-all"
                  style={{ width: `${ask.depthPct}%` }}
                ></div>
                <span className="text-rose-400 font-bold font-mono-num relative z-10">
                  {formatPrice(ask.price, symbol)}
                </span>
                <span className="text-right text-gray-300 font-mono-num relative z-10">
                  {ask.size.toFixed(3)}
                </span>
                <span className="text-right text-gray-400 font-mono-num relative z-10">
                  {ask.total.toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          {/* Mid Price & Spread Indicator */}
          <div className="py-2.5 my-1 px-2 rounded-xl bg-[#080a11] border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold text-white font-mono-num">
                {formatPrice(currentPrice, symbol)}
              </span>
              <span className="text-[10px] text-emerald-400 font-bold">▲ Mark</span>
            </div>
            <div className="text-[11px] text-gray-400 font-mono-num">
              Spread:{' '}
              <strong className="text-gray-300">
                {isForex ? formatPips(spreadPips, false, 1) : `$${orderBook.spread.toFixed(2)}`}
              </strong>{' '}
              ({orderBook.spreadPct}%)
            </div>
          </div>

          {/* Bids (Buy orders - Green) */}
          <div className="space-y-0.5">
            {orderBook.bids.slice(0, 6).map((bid, idx) => (
              <div
                key={`bid-${idx}`}
                onClick={() => onSelectPrice(bid.price)}
                className="grid grid-cols-3 py-0.5 px-1 relative hover:bg-white/5 cursor-pointer rounded transition-colors group select-none"
              >
                {/* Visual Depth Bar */}
                <div
                  className="absolute right-0 top-0 bottom-0 bg-emerald-500/15 pointer-events-none rounded-r transition-all"
                  style={{ width: `${bid.depthPct}%` }}
                ></div>
                <span className="text-emerald-400 font-bold font-mono-num relative z-10">
                  {formatPrice(bid.price, symbol)}
                </span>
                <span className="text-right text-gray-300 font-mono-num relative z-10">
                  {bid.size.toFixed(3)}
                </span>
                <span className="text-right text-gray-400 font-mono-num relative z-10">
                  {bid.total.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Market Trades Tape */
        <div className="flex-1 overflow-y-auto py-2 space-y-1">
          <div className="grid grid-cols-3 text-[11px] text-gray-500 font-medium pb-2 border-b border-white/5">
            <span>Price ({quote})</span>
            <span className="text-right">Size ({base})</span>
            <span className="text-right">Time</span>
          </div>

          {trades.map((trade) => {
            const isBuy = trade.side === 'BUY'
            return (
              <div
                key={trade.id}
                className="grid grid-cols-3 py-1 px-1 hover:bg-white/5 rounded text-[11px] font-mono-num transition-colors"
              >
                <span className={`font-bold ${isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatPrice(trade.price, symbol)}
                </span>
                <span className="text-right text-gray-300 font-medium">
                  {trade.size.toFixed(3)}
                </span>
                <span className="text-right text-gray-500">
                  {trade.time}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})
