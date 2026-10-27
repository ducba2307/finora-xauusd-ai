import React, { useState } from 'react'
import { Sparkles, Wallet, Home, LayoutDashboard, Cpu, Activity, PieChart, Key, Layers, Menu, X, Compass, Calculator, Volume2, VolumeX, Bell, BookOpen, AlertTriangle, Flame } from 'lucide-react'
import { getSoundEnabled, setSoundEnabled, playClickSound } from '../utils/soundEffects'
import { NetworkStatusBadge } from './NetworkStatusBadge'
import type { AccountBalanceSheet } from '../types/trading'

export type NavView = 'landing' | 'signal_desk' | 'terminal' | 'news_trading' | 'quant_studio' | 'journal' | 'ai_intel' | 'trader_tools' | 'whale_radar' | 'portfolio'

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
  onOpenAlerts,
  activeAlertsCount = 0,
  activeBotsCount,
  totalBalance,
  tradingMode,
  balanceSheet,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [soundActive, setSoundActive] = useState<boolean>(() => getSoundEnabled())

  const handleToggleSound = () => {
    const next = !soundActive
    setSoundEnabled(next)
    setSoundActive(next)
    if (next) {
      playClickSound()
    }
  }

  const navItems: { id: NavView; label: string; icon: React.ReactNode }[] = [
    { id: 'landing', label: 'Landing Page', icon: <Home className="w-3.5 h-3.5" /> },
    { id: 'signal_desk', label: '⚡ XAU/USD AI Signal Desk', icon: <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> },
    { id: 'terminal', label: 'Terminal', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
    { id: 'news_trading', label: 'News Trading Desk (XAUUSD)', icon: <Flame className="w-3.5 h-3.5 text-amber-400" /> },
    { id: 'quant_studio', label: 'AI Quant Lab', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'journal', label: 'Trading Journal', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'ai_intel', label: 'AI Market Intel', icon: <Compass className="w-3.5 h-3.5" /> },
    { id: 'trader_tools', label: 'Trader Tools', icon: <Calculator className="w-3.5 h-3.5" /> },
    { id: 'whale_radar', label: 'Whale Radar', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'portfolio', label: 'Risk & Portfolio', icon: <PieChart className="w-3.5 h-3.5" /> },
  ]

  const handleSelectNav = (view: NavView) => {
    onNavigate(view)
    setMobileMenuOpen(false)
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#07080c]/95 backdrop-blur-xl transition-all">
      <div className="max-w-[1720px] mx-auto px-3 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Logo matching Finora */}
        <div
          onClick={() => handleSelectNav('landing')}
          className="flex items-center gap-3 cursor-pointer select-none group shrink-0"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-600 via-rose-500 to-fuchsia-600 flex items-center justify-center text-white shadow-[0_0_20px_rgba(236,72,153,0.5)] group-hover:scale-105 transition-transform">
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-extrabold tracking-tight text-white group-hover:text-pink-200 transition-colors">
                Finora
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-pink-500/20 text-pink-400 font-extrabold tracking-wide border border-pink-500/30">
                QUANT AI
              </span>
            </div>
          </div>
        </div>

        {/* Center Nav tabs (Desktop / Tablet) */}
        <nav className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/5 text-xs">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelectNav(item.id)}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                currentView === item.id
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-[0_0_15px_rgba(236,72,153,0.4)]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {/* F15: Connection & Latency Telemetry Badge */}
          <NetworkStatusBadge />

          {/* API Keys & Trading Mode */}
          <button
            onClick={onOpenApiKeys}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              tradingMode === 'PAPER'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            }`}
          >
            <Key className="w-3 h-3" />
            <span>{tradingMode === 'PAPER' ? 'Paper Simulation' : 'Live API DMA'}</span>
          </button>

          {/* AI Bot status */}
          <button
            onClick={onOpenBotManager}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121624] border border-pink-500/30 hover:border-pink-500/60 transition-all text-xs font-semibold text-gray-200 cursor-pointer shadow-sm group"
          >
            <Cpu className="w-3.5 h-3.5 text-pink-400 group-hover:rotate-12 transition-transform" />
            <span className="hidden xl:inline">AI Bots:</span>
            <span className="text-emerald-400 font-mono-num font-bold">
              {activeBotsCount} Active
            </span>
          </button>

          {/* AI Copilot chat trigger */}
          <button
            onClick={onOpenCopilot}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-500/15 border border-pink-500/40 text-pink-300 hover:bg-pink-500/25 transition-all text-xs font-semibold cursor-pointer shadow-[0_0_15px_rgba(236,72,153,0.25)]"
          >
            <Sparkles className="w-3.5 h-3.5 text-pink-400 animate-spin" />
            <span>AI Copilot</span>
          </button>

          {/* Audio Chime Mute/Unmute Toggle */}
          <button
            onClick={handleToggleSound}
            className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs ${
              soundActive
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                : 'bg-white/5 text-gray-500 border-white/10 hover:text-gray-300'
            }`}
            title={soundActive ? 'Institutional Trading Sound FX Active (Click to Mute)' : 'Sound Effects Muted (Click to Unmute)'}
          >
            {soundActive ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden xl:inline text-[11px] font-bold">{soundActive ? 'SFX ON' : 'SFX OFF'}</span>
          </button>

          {/* Price Alerts Trigger */}
          {onOpenAlerts && (
            <button
              onClick={() => {
                playClickSound()
                onOpenAlerts()
              }}
              className="relative p-2 rounded-xl bg-[#121624] border border-white/10 hover:border-pink-500/40 text-gray-300 hover:text-white transition-all cursor-pointer"
              title="Open Price Alerts Desk"
            >
              <Bell className="w-3.5 h-3.5 text-pink-400" />
              {activeAlertsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-pink-500 text-white text-[9px] font-extrabold flex items-center justify-center font-mono-num animate-pulse">
                  {activeAlertsCount}
                </span>
              )}
            </button>
          )}

          {/* Wallet equity & balance */}
          <div className="hidden lg:flex items-center gap-2 bg-[#121624] border border-white/10 px-3 py-1.5 rounded-xl">
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold text-white font-mono-num leading-tight">
                ${(balanceSheet ? balanceSheet.equity : totalBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {balanceSheet && (
                <span className="text-[9px] text-gray-400 font-mono-num leading-none">
                  Free: ${balanceSheet.freeMargin.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              )}
            </div>
            {balanceSheet?.isCircuitBreakerTripped && (
              <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[9px] font-extrabold animate-pulse flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-400" /> LOCKED
              </span>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/10 bg-[#0b0e17] px-4 py-3 space-y-1.5 animate-in slide-in-from-top duration-200">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelectNav(item.id)}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                currentView === item.id
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white'
                  : 'text-gray-300 hover:bg-white/5'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
            <span className="text-gray-400">Network Telemetry:</span>
            <NetworkStatusBadge compact={false} />
          </div>
          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
            <span className="text-gray-400">Total Equity:</span>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold font-mono-num">
                ${(balanceSheet ? balanceSheet.equity : totalBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
              {balanceSheet?.isCircuitBreakerTripped && (
                <span className="text-[10px] text-rose-400 font-bold font-mono-num">LOCKED</span>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
