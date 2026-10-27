import React, { useState } from 'react'
import {
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Copy,
  Check,
  Sparkles,
  RefreshCw,
  Zap,
} from 'lucide-react'
import type { AIScenarioResult } from '../../services/apiThrottleCacheService'

interface HeroSignalCardProps {
  scenario: AIScenarioResult | null
  currentPrice: number
  onManualRefresh: () => void
  cooldownSeconds: number
  isLoading: boolean
}

export const HeroSignalCard: React.FC<HeroSignalCardProps> = ({
  scenario,
  currentPrice,
  onManualRefresh,
  cooldownSeconds,
  isLoading,
}) => {
  const [copied, setCopied] = useState(false)

  if (!scenario) {
    return (
      <div className="fin-card p-6 text-center space-y-3 bg-[#0a0d16] border border-white/5">
        <div className="w-10 h-10 mx-auto rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center animate-spin">
          <RefreshCw className="w-5 h-5" />
        </div>
        <h3 className="font-bold text-white text-sm">Đang quét cấu trúc thị trường XAU/USD...</h3>
        <p className="text-gray-400 text-xs">
          Engine đang hợp lưu Price Action, SMC, ICT và RSI đa khung để phát tín hiệu.
        </p>
      </div>
    )
  }

  const isBuy = scenario.recommendation === 'BUY'
  const isSell = scenario.recommendation === 'SELL'
  const isWait = scenario.recommendation === 'WAIT'

  const { entry_price, stop_loss, take_profit_1, take_profit_2, risk_reward_ratio } =
    scenario.execution_plan

  const riskDistance = Math.abs(currentPrice - stop_loss).toFixed(2)
  const rewardDistance = Math.abs(take_profit_1 - currentPrice).toFixed(2)

  const handleCopy = () => {
    const text = `🏆 FINORA AI SIGNAL — XAU/USD (VÀNG)
Khuyến nghị: ${scenario.recommendation}
Chiến lược: ${scenario.setup_name}
Vào lệnh (Entry): $${entry_price.toFixed(2)}
Cắt lỗ (SL): $${stop_loss.toFixed(2)}
Chốt lời 1 (TP1): $${take_profit_1.toFixed(2)}
Chốt lời 2 (TP2): $${take_profit_2.toFixed(2)}
Tỷ lệ R:R: 1 : ${risk_reward_ratio}
Điểm vô hiệu: $${scenario.invalidation_price.toFixed(2)}`

    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="fin-card-glow bg-[#080b14] border border-cyan-500/30 rounded-2xl p-4 sm:p-5 flex flex-col space-y-4 shadow-2xl relative overflow-hidden">
      {/* Background glow gradient */}
      <div
        className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none ${
          isBuy ? 'bg-emerald-500' : isSell ? 'bg-rose-500' : 'bg-cyan-500'
        }`}
      />

      {/* Top Header: Badge & Status */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isBuy ? 'bg-emerald-400 animate-ping' : isSell ? 'bg-rose-400 animate-ping' : 'bg-amber-400'
            }`}
          />
          <span className="font-mono text-xs uppercase tracking-wider text-gray-400 font-semibold">
            XAU/USD SIGNAL DESK
          </span>
          <span className="text-[10px] bg-cyan-950/60 text-cyan-300 font-mono px-2 py-0.5 rounded border border-cyan-800/40">
            {scenario.source === '9ROUTER_CLAUDE'
              ? 'Claude 3.5 Sonnet'
              : scenario.source === '9ROUTER_GEMINI'
              ? 'Gemini 1.5 Pro'
              : 'Deterministic Quant'}
          </span>
        </div>

        {/* Manual Refresh Button with Cooldown & Anti-Spam protection */}
        <button
          onClick={onManualRefresh}
          disabled={cooldownSeconds > 0 || isLoading}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
            cooldownSeconds > 0 || isLoading
              ? 'bg-white/5 text-gray-500 border-white/5 cursor-not-allowed'
              : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/25'
          }`}
          title="Chống spam API: Cooldown 60s giữa các lần phân tích"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          <span>{cooldownSeconds > 0 ? `${cooldownSeconds}s` : 'Làm Mới AI'}</span>
        </button>
      </div>

      {/* Main Signal Display */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">
            Khuyến Nghị Hiện Tại
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-2xl sm:text-3xl font-black tracking-tight font-mono-num flex items-center gap-1.5 ${
                isBuy
                  ? 'text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                  : isSell
                  ? 'text-rose-400 drop-shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                  : 'text-amber-400'
              }`}
            >
              {isBuy && <TrendingUp className="w-7 h-7" />}
              {isSell && <TrendingDown className="w-7 h-7" />}
              {scenario.recommendation}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-white/5 border border-white/10 text-gray-300">
              Độ tin cậy: {scenario.confidence_score}%
            </span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[11px] text-gray-400 font-medium">Biên Lợi Nhuận</div>
          <div className="text-lg font-bold font-mono text-cyan-300 mt-1">
            R:R 1 : {risk_reward_ratio}
          </div>
        </div>
      </div>

      {/* Strategy Title */}
      <div className="bg-white/5 rounded-xl p-2.5 border border-white/5 flex items-center justify-between text-xs">
        <span className="text-gray-300 font-semibold truncate flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="truncate">{scenario.setup_name}</span>
        </span>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors shrink-0"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 text-[11px] font-bold">Đã Copy</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span className="text-[11px]">Copy Lệnh</span>
            </>
          )}
        </button>
      </div>

      {/* Entry, SL, TP Grid */}
      {!isWait && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {/* Entry */}
          <div className="bg-[#0e1322] border border-cyan-500/20 p-2.5 rounded-xl text-center">
            <span className="text-[10px] text-gray-400 block uppercase font-semibold">
              Vào Lệnh (Entry)
            </span>
            <span className="text-sm font-bold text-cyan-300 font-mono mt-1 block">
              ${entry_price.toFixed(2)}
            </span>
            <span className="text-[10px] text-gray-400 block mt-0.5">Giá thị trường</span>
          </div>

          {/* Stop Loss */}
          <div className="bg-[#0e1322] border border-rose-500/20 p-2.5 rounded-xl text-center">
            <span className="text-[10px] text-rose-400 block uppercase font-semibold">
              Cắt Lỗ (SL)
            </span>
            <span className="text-sm font-bold text-rose-400 font-mono mt-1 block">
              ${stop_loss.toFixed(2)}
            </span>
            <span className="text-[10px] text-rose-400/80 block mt-0.5">-{riskDistance} pips</span>
          </div>

          {/* Take Profit 1 */}
          <div className="bg-[#0e1322] border border-emerald-500/20 p-2.5 rounded-xl text-center">
            <span className="text-[10px] text-emerald-400 block uppercase font-semibold">
              Chốt Lời 1 (TP1)
            </span>
            <span className="text-sm font-bold text-emerald-400 font-mono mt-1 block">
              ${take_profit_1.toFixed(2)}
            </span>
            <span className="text-[10px] text-emerald-400/80 block mt-0.5">
              +{rewardDistance} pips
            </span>
          </div>

          {/* Take Profit 2 */}
          <div className="bg-[#0e1322] border border-emerald-500/20 p-2.5 rounded-xl text-center">
            <span className="text-[10px] text-emerald-400 block uppercase font-semibold">
              Chốt Lời 2 (TP2)
            </span>
            <span className="text-sm font-bold text-emerald-400 font-mono mt-1 block">
              ${take_profit_2.toFixed(2)}
            </span>
            <span className="text-[10px] text-emerald-400/80 block mt-0.5">Kỳ vọng mở rộng</span>
          </div>
        </div>
      )}

      {/* Rationale Text */}
      <div className="bg-[#0b0e1b] border border-white/5 rounded-xl p-3 text-xs space-y-1.5 leading-relaxed">
        <div className="font-semibold text-cyan-300 flex items-center gap-1.5 text-[11px]">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Giải Thích Logic Của AI:</span>
        </div>
        <p className="text-gray-300 text-[11px] leading-relaxed">{scenario.rationale_vi}</p>
      </div>

      {/* Invalidation Level Warning */}
      <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-[11px] text-amber-200">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-amber-300">Mức Vô Hiệu Hóa Kịch Bản: </span>
          <span>${scenario.invalidation_price.toFixed(2)}. {scenario.invalidation_reason}</span>
        </div>
      </div>
    </div>
  )
}
