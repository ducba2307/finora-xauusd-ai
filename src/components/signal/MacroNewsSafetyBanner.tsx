import React from 'react'
import { ShieldCheck, AlertTriangle, Flame, Clock } from 'lucide-react'

interface MacroNewsSafetyBannerProps {
  isBlackoutActive: boolean
  message: string
  nextNewsTitle?: string
  minutesUntilNextNews?: number
}

export const MacroNewsSafetyBanner: React.FC<MacroNewsSafetyBannerProps> = ({
  isBlackoutActive,
  message,
  nextNewsTitle,
  minutesUntilNextNews,
}) => {
  if (isBlackoutActive) {
    return (
      <div className="bg-rose-950/80 border border-rose-500/50 text-rose-200 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs animate-pulse shadow-lg shadow-rose-950/50">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="font-bold">{message}</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 font-mono text-[11px] bg-rose-900/60 px-2 py-0.5 rounded border border-rose-700/60">
          <Flame className="w-3.5 h-3.5 text-rose-300" />
          <span>VÙNG NGUY HIỂM</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#0b101d] border border-cyan-500/20 text-gray-300 px-3.5 py-2 rounded-xl flex items-center justify-between text-xs flex-wrap gap-2">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="text-[11px] text-gray-300">
          <strong className="text-emerald-400">Trạng Thái An Toàn:</strong> Thị trường ổn định, không có tin đỏ trong vòng 15 phút tới.
        </span>
      </div>

      {nextNewsTitle && minutesUntilNextNews !== undefined && (
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-gray-400">
          <Clock className="w-3 h-3 text-cyan-400" />
          <span>
            Tin đỏ kế tiếp: <strong className="text-cyan-300">{nextNewsTitle}</strong> ({minutesUntilNextNews}m nữa)
          </span>
        </div>
      )}
    </div>
  )
}
