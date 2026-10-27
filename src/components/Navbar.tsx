import React, { useState, useRef, useEffect } from 'react'
import {
  Sparkles,
  Home,
  LayoutDashboard,
  Cpu,
  Activity,
  PieChart,
  Key,
  Layers,
  Menu,
  X,
  Compass,
  Calculator,
  Volume2,
  VolumeX,
  BookOpen,
  AlertTriangle,
  Flame,
  ChevronDown,
} from 'lucide-react'
import { getSoundEnabled, setSoundEnabled, playClickSound } from '../utils/soundEffects'
import { NetworkStatusBadge } from './NetworkStatusBadge'
import type { AccountBalanceSheet } from '../types/trading'

export type NavView =
  | 'landing'
  | 'signal_desk'
  | 'terminal'
  | 'news_trading'
  | 'quant_studio'
  | 'journal'
  | 'ai_intel'
  | 'trader_tools'
  | 'whale_radar'
  | 'portfolio'

interface NavbarProps {
  currentView: NavView
  onNavigate: (view: NavView) => void
  onOpenCopilot: () => void
  onOpenBotManager: () => void
  onOpenApiKeys: () => void
  onOpenAlerts?: () => void
  activeAlertsCount?: number
  activeBotsCount: number
  totalBalance: number
  tradingMode: 'PAPER' | 'LIVE'
  balanceSheet?: AccountBalanceSheet
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  onOpenCopilot,
  onOpenBotManager,
  onOpenApiKeys,
  activeBotsCount,
  totalBalance,
  tradingMode,
  balanceSheet,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [soundActive, setSoundActive] = useState<boolean>(() => getSoundEnabled())
  const moreMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggleSound = () => {
    const next = !soundActive
    setSoundEnabled(next)
    setSoundActive(next)
    if (next) {
      playClickSound()
    }
  }

  // 4 Core Primary Workspaces (fit on 1 single row across laptops and desktops)
  const primaryNavItems: { id: NavView; label: string; icon: React.ReactNode }[] = [
    { id: 'signal_desk', label: '⚡ XAU/USD Signal Desk', icon: <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> },
    { id: 'terminal', label: 'Terminal', icon: <LayoutDashboard className="w-3.5 h-3.5 text-pink-400" /> },
    { id: 'news_trading', label: 'News Desk', icon: <Flame className="w-3.5 h-3.5 text-amber-400" /> },
    { id: 'quant_studio', label: 'Quant Lab', icon: <Layers className="w-3.5 h-3.5 text-emerald-400" /> },
  ]

  // Secondary Tools (cleanly grouped into dropdown, zero horizontal wrapping)
  const secondaryNavItems: { id: NavView; label: string; icon: React.ReactNode }[] = [
    { id: 'journal', label: 'Trading Journal', icon: <BookOpen className="w-3.5 h-3.5 text-indigo-400" /> },
    { id: 'ai_intel', label: 'AI Market Intel', icon: <Compass className="w-3.5 h-3.5 text-blue-400" /> },
    { id: 'trader_tools', label: 'Trader Tools', icon: <Calculator className="w-3.5 h-3.5 text-teal-400" /> },
    { id: 'whale_radar', label: 'Whale Radar', icon: <Activity className="w-3.5 h-3.5 text-rose-400" /> },
    { id: 'portfolio', label: 'Risk & Portfolio', icon: <PieChart className="w-3.5 h-3.5 text-emerald-400" /> },
    { id: 'landing', label: 'Landing Page', icon: <Home className="w-3.5 h-3.5 text-gray-400" /> },
  ]

  const isSecondaryActive = secondaryNavItems.some((item) => item.id === currentView)
  const activeSecondaryItem = secondaryNavItems.find((item) => item.id === currentView)

  const handleSelectNav = (view: NavView) => {
    onNavigate(view)
    setMobileMenuOpen(false)
    setMoreMenuOpen(false)
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#07080c]/95 backdrop-blur-xl transition-all">
      <div className="max-w-[1720px] mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        {/* Brand Logo */}
        <div
          onClick={() => handleSelectNav('signal_desk')}
          className="flex items-center gap-2.5 cursor-pointer select-none group shrink-0"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-pink-600 via-rose-500 to-fuchsia-600 flex items-center justify-center text-white shadow-[0_0_20px_rgba(236,72,153,0.5)] group-hover:scale-105 transition-transform">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-base sm:text-lg font-extrabold tracking-tight text-white group-hover:text-pink-200 transition-colors">
              Finora
            </span>
            <span className="text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded bg-pink-500/20 text-pink-400 font-extrabold tracking-wide border border-pink-500/30">
              QUANT AI
            </span>
          </div>
        </div>

        {/* Center Nav tabs (Desktop >= 1024px) - Guaranteed Single Row */}
        <nav className="hidden lg:flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/5 text-xs">
          {primaryNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelectNav(item.id)}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                currentView === item.id
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-[0_0_15px_rgba(236,72,153,0.4)]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.icon}
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          ))}

          {/* More Tools Dropdown */}
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              className={`px-2.5 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                isSecondaryActive
                  ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              title="Công cụ bổ trợ & Nhật ký"
            >
              {isSecondaryActive && activeSecondaryItem ? (
                <>
                  {activeSecondaryItem.icon}
                  <span className="whitespace-nowrap">{activeSecondaryItem.label}</span>
                </>
              ) : (
                <>
                  <Compass className="w-3.5 h-3.5 text-gray-400" />
                  <span className="whitespace-nowrap">Khác</span>
                </>
              )}
              <ChevronDown className={`w-3 h-3 transition-transform ${moreMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {moreMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-52 bg-[#0b0f19] border border-white/10 rounded-2xl p-1.5 shadow-2xl z-50 space-y-0.5 animate-fadeIn backdrop-blur-xl">
                <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                  Công Cụ Bổ Trợ
                </div>
                {secondaryNavItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectNav(item.id)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer text-left ${
                      currentView === item.id
                        ? 'bg-pink-600 text-white font-bold'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* Right side controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Connection & Latency Telemetry Badge */}
          <NetworkStatusBadge />

          {/* API Keys & Trading Mode */}
          <button
            onClick={onOpenApiKeys}
            className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              tradingMode === 'PAPER'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            }`}
          >
            <Key className="w-3 h-3" />
            <span>{tradingMode === 'PAPER' ? 'Paper' : 'Live'}</span>
          </button>

          {/* AI Bot status */}
          <button
            onClick={onOpenBotManager}
            className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121624] border border-pink-500/30 hover:border-pink-500/60 transition-all text-xs font-semibold text-gray-200 cursor-pointer shadow-sm group"
          >
            <Cpu className="w-3.5 h-3.5 text-pink-400 group-hover:rotate-12 transition-transform" />
            <span className="text-emerald-400 font-mono-num font-bold">
              {activeBotsCount} Active
            </span>
          </button>

          {/* AI Copilot chat trigger */}
          <button
            onClick={onOpenCopilot}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-cyan-500/20 border border-pink-500/40 hover:border-pink-500/80 transition-all text-xs font-extrabold text-pink-200 shadow-[0_0_15px_rgba(236,72,153,0.25)] cursor-pointer group"
          >
            <Sparkles className="w-3.5 h-3.5 text-pink-400 group-hover:scale-125 transition-transform" />
            <span>AI Copilot</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={handleToggleSound}
            className="p-1.5 sm:p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
            title={soundActive ? 'Mute SFX' : 'Enable SFX'}
          >
            {soundActive ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-gray-500" />}
          </button>

          {/* Balance Sheet Equity Badge */}
          <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-white/10">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-gray-400 font-medium">Equity</span>
              <span className="text-xs sm:text-sm font-bold font-mono-num text-white">
                ${(balanceSheet ? balanceSheet.equity : totalBalance).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
            {balanceSheet?.isCircuitBreakerTripped && (
              <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[9px] font-extrabold animate-pulse flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-400" /> LOCKED
              </span>
            )}
          </div>

          {/* Mobile & Tablet Menu Toggle Button (< 1024px) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile & Tablet Navigation Drawer (< 1024px) */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-white/10 bg-[#080b14] px-4 py-3 space-y-2 animate-in slide-in-from-top duration-200">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Không Gian Tác Chiến</div>
          <div className="grid grid-cols-2 gap-1.5">
            {primaryNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelectNav(item.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  currentView === item.id
                    ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>

          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider pt-2 border-t border-white/5">
            Công Cụ Định Lượng &amp; Quản Trị
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {secondaryNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelectNav(item.id)}
                className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
                  currentView === item.id
                    ? 'bg-pink-600 text-white font-bold'
                    : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
            <span className="text-gray-400">Total Equity:</span>
            <span className="text-white font-bold font-mono-num">
              ${(balanceSheet ? balanceSheet.equity : totalBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Quick Drawer Actions */}
          <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => {
                setMobileMenuOpen(false)
                onOpenCopilot()
              }}
              className="py-2 px-3 rounded-xl bg-pink-500/15 border border-pink-500/30 text-pink-300 font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-pink-500/25"
            >
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              <span>AI Copilot</span>
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false)
                onOpenBotManager()
              }}
              className="py-2 px-3 rounded-xl bg-white/5 border border-white/10 text-gray-200 font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-white/10"
            >
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>Bot Quants ({activeBotsCount})</span>
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
