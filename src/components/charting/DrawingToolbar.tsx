import React from 'react'
import {
  MousePointer,
  BoxSelect,
  TrendingUp,
  Minus,
  Maximize2,
  BarChart2,
  Trash2,
  Lock,
  Unlock
} from 'lucide-react'
import type { ChartDrawingTool } from '../../types/aiCharting'

interface DrawingToolbarProps {
  activeTool: ChartDrawingTool
  onSelectTool: (tool: ChartDrawingTool) => void
  onClearAll: () => void
  isLocked: boolean
  onToggleLock: () => void
  onOpenSelectExplain?: () => void
  hasDrawings: boolean
}

export const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  activeTool,
  onSelectTool,
  onClearAll,
  isLocked,
  onToggleLock,
  onOpenSelectExplain,
  hasDrawings,
}) => {
  const tools: {
    id: ChartDrawingTool
    label: string
    icon: React.ReactNode
    badge?: string
    isAiSpecial?: boolean
  }[] = [
    {
      id: 'CURSOR',
      label: 'Standard Crosshair Cursor',
      icon: <MousePointer className="w-4 h-4" />,
    },
    {
      id: 'SELECT_EXPLAIN',
      label: 'Select → Explain (AI Anomaly Deep Dive)',
      icon: <BoxSelect className="w-4 h-4" />,
      badge: 'AI',
      isAiSpecial: true,
    },
    {
      id: 'TRENDLINE',
      label: 'Trendline (Auto-Alert on Breach)',
      icon: <TrendingUp className="w-4 h-4" />,
    },
    {
      id: 'HORIZONTAL_LINE',
      label: 'Horizontal Price Level / Support',
      icon: <Minus className="w-4 h-4" />,
    },
    {
      id: 'PRICE_ZONE',
      label: 'SMC Price Zone / Order Block Box',
      icon: <Maximize2 className="w-4 h-4" />,
    },
    {
      id: 'VOLUME_PROFILE',
      label: 'Volume Profile (VPVR: POC / VAH / VAL)',
      icon: <BarChart2 className="w-4 h-4" />,
      badge: 'PRO',
    },
  ]

  return (
    <div className="absolute left-3 top-16 z-20 flex flex-col items-center bg-[#07090f]/90 backdrop-blur-md border border-white/10 rounded-xl p-1 shadow-2xl space-y-1">
      {tools.map((tool) => {
        const isActive = activeTool === tool.id
        return (
          <div key={tool.id} className="relative group">
            <button
              onClick={() => {
                onSelectTool(tool.id)
                if (tool.id === 'SELECT_EXPLAIN' && onOpenSelectExplain) {
                  onOpenSelectExplain()
                }
              }}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer relative ${
                isActive
                  ? tool.isAiSpecial
                    ? 'bg-gradient-to-tr from-pink-500 to-rose-500 text-white shadow-[0_0_12px_rgba(236,72,153,0.5)]'
                    : 'bg-white/20 text-white shadow-sm'
                  : tool.isAiSpecial
                  ? 'text-pink-400 hover:bg-pink-500/15'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tool.icon}
              {tool.badge && (
                <span
                  className={`absolute -top-1 -right-1 text-[8px] px-1 font-mono font-bold rounded-full ${
                    tool.isAiSpecial
                      ? 'bg-pink-500 text-white'
                      : 'bg-cyan-500 text-white'
                  }`}
                >
                  {tool.badge}
                </span>
              )}
            </button>

            {/* Tooltip */}
            <div className="absolute left-10 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center px-2.5 py-1 rounded-md bg-[#0f1424] text-white text-[11px] font-sans font-medium whitespace-nowrap border border-white/10 shadow-xl pointer-events-none z-30">
              {tool.label}
            </div>
          </div>
        )
      })}

      <div className="w-6 h-px bg-white/10 my-1" />

      {/* Lock Drawings */}
      <div className="relative group">
        <button
          onClick={onToggleLock}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
            isLocked ? 'text-amber-400 bg-amber-500/10' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
        </button>
        <div className="absolute left-10 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center px-2.5 py-1 rounded-md bg-[#0f1424] text-white text-[11px] font-sans font-medium whitespace-nowrap border border-white/10 shadow-xl pointer-events-none z-30">
          {isLocked ? 'Unlock Drawings' : 'Lock Drawings'}
        </div>
      </div>

      {/* Clear All Drawings */}
      {hasDrawings && (
        <div className="relative group">
          <button
            onClick={onClearAll}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <div className="absolute left-10 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center px-2.5 py-1 rounded-md bg-[#0f1424] text-white text-[11px] font-sans font-medium whitespace-nowrap border border-white/10 shadow-xl pointer-events-none z-30">
            Clear All Drawings
          </div>
        </div>
      )}
    </div>
  )
}
