import React, { useState } from 'react'
import {
  X,
  Sparkles,
  Bot,
  Play,
  Pause,
  AlertCircle,
  CheckCircle,
  Cpu,
  Trash2,
  Flame
} from 'lucide-react'
import type { NaturalLanguageMonitorRule, AIModelProvider } from '../../types/aiCharting'
import { AI_PROVIDERS, compileNaturalLanguageToTeaScript } from '../../services/aiAgentService'

interface NaturalLanguageMonitorModalProps {
  isOpen: boolean
  currentSymbol: string
  onClose: () => void
  onSelectInvestigation?: (symbol: string) => void
}

const DEFAULT_RULES: NaturalLanguageMonitorRule[] = [
  {
    id: 'rule-nvda-breakout',
    userPrompt: 'Canh NVDA vượt kháng cự $188 hoặc Volume tăng đột biến gấp 3 lần trung bình 20 phiên, đồng thời RSI > 70',
    symbol: 'NVDA',
    aiProvider: 'CODEX',
    generatedTeaScript: `//@version=2.0 (TeaScript Engine)
strategy("NVDA Surge & Breakout Monitor", overlay=true)
avgVol = sma(volume, 20)
isVolSurge = volume > (avgVol * 3.0)
isBreakout = crossover(close, 188.0)
if (isVolSurge or isBreakout) {
  alert("NVDA Breakout & Volume Anomaly Detected", action="DISPATCH_AI_INVESTIGATION")
}`,
    isActive: true,
    createdAt: '10 mins ago',
    triggerCount: 3,
    autoInvestigateOnTrigger: true,
    recentAlerts: [
      {
        id: 'alt-nvda-1',
        timestamp: '18:42:15',
        price: 189.20,
        message: 'Volume surge +280% above 20MA detected on $188.00 breakout',
        hasInvestigation: true,
        investigationId: 'inv-nvda-1',
      },
    ],
  },
  {
    id: 'rule-btc-whale',
    userPrompt: 'Alert me if Bitcoin drops below $112,500 with abnormal CVD delta or aggressive sell liquidations',
    symbol: 'BTC/USDT',
    aiProvider: 'CLAUDE',
    generatedTeaScript: `//@version=2.0 (TeaScript Engine)
strategy("BTC Whale Liquidation Watch", overlay=true)
isSupportBreak = crossunder(close, 112500)
if (isSupportBreak) {
  alert("BTC Key Support Breached", action="DISPATCH_AI_INVESTIGATION")
}`,
    isActive: true,
    createdAt: '1 hour ago',
    triggerCount: 1,
    autoInvestigateOnTrigger: true,
    recentAlerts: [
      {
        id: 'alt-btc-1',
        timestamp: '17:15:00',
        price: 112480,
        message: 'Support level $112,500 tested with $48M short liquidations',
        hasInvestigation: true,
        investigationId: 'inv-btc-1',
      },
    ],
  },
]

export const NaturalLanguageMonitorModal: React.FC<NaturalLanguageMonitorModalProps> = ({
  isOpen,
  currentSymbol,
  onClose,
  onSelectInvestigation,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<AIModelProvider>('CODEX')
  const [promptInput, setPromptInput] = useState('')
  const [isCompiling, setIsCompiling] = useState(false)
  const [rules, setRules] = useState<NaturalLanguageMonitorRule[]>(DEFAULT_RULES)
  const [activeTab, setActiveTab] = useState<'CREATE' | 'RULES'>('CREATE')

  const promptSuggestions = [
    `Canh ${currentSymbol} vượt đỉnh hoặc Volume tăng gấp 3 lần 20MA`,
    `Alert if ${currentSymbol} breaks key support with heavy selling delta`,
    `Monitor ${currentSymbol} for RSI divergence and SMC Fair Value Gap mitigation`,
  ]

  const handleCreateRule = () => {
    if (!promptInput.trim()) return
    setIsCompiling(true)

    setTimeout(() => {
      const compiled = compileNaturalLanguageToTeaScript(promptInput, currentSymbol, selectedProvider)
      const newRule: NaturalLanguageMonitorRule = {
        id: `rule-${Date.now()}`,
        userPrompt: promptInput,
        symbol: currentSymbol,
        aiProvider: selectedProvider,
        generatedTeaScript: compiled.teaScript,
        isActive: true,
        createdAt: 'Just now',
        triggerCount: 0,
        autoInvestigateOnTrigger: true,
        recentAlerts: [],
      }

      setRules((prev) => [newRule, ...prev])
      setIsCompiling(false)
      setPromptInput('')
      setActiveTab('RULES')
    }, 700)
  }

  const handleToggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r))
    )
  }

  const handleDeleteRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#0b0e17] border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#07090f]/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-pink-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-wider text-pink-400 font-bold">
                  Finora AI Engine • Natural Language Monitoring
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/20 font-mono">
                  Autonomous Tea Script Generator
                </span>
              </div>
              <h2 className="text-lg font-bold text-white">
                Tell AI What to Watch → Auto-Investigate Anomaly
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 py-2.5 bg-[#080a12] border-b border-white/5 flex items-center gap-4 text-xs">
          <button
            onClick={() => setActiveTab('CREATE')}
            className={`pb-1 font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'CREATE'
                ? 'border-pink-500 text-white'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Create New NL Monitor
          </button>
          <button
            onClick={() => setActiveTab('RULES')}
            className={`pb-1 font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'RULES'
                ? 'border-pink-500 text-white'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <span>Active Monitors</span>
            <span className="px-1.5 py-0.2 rounded-full bg-pink-500/20 text-pink-400 text-[10px] font-mono">
              {rules.length}
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'CREATE' ? (
            <div className="space-y-6">
              {/* Agent Selection */}
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-gray-400 block mb-2">
                  Select Synthesis AI Agent
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {AI_PROVIDERS.map((provider) => {
                    const isSelected = selectedProvider === provider.id
                    return (
                      <button
                        key={provider.id}
                        onClick={() => setSelectedProvider(provider.id)}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#151a2d] border-pink-500/60 shadow-[0_0_15px_rgba(236,72,153,0.15)]'
                            : 'bg-[#101423] border-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Cpu className="w-3.5 h-3.5 text-pink-400" />
                            {provider.name}
                          </span>
                          {isSelected && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                        </div>
                        <span className="text-[11px] text-gray-400 block line-clamp-2">
                          {provider.specialty}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Natural Language Prompt Input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-mono uppercase tracking-wider text-gray-400">
                    Describe Market Condition in Natural Language (EN / VI)
                  </label>
                  <span className="text-xs text-pink-400 font-mono">Target: {currentSymbol}</span>
                </div>
                <div className="relative">
                  <textarea
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    placeholder={`e.g. Canh ${currentSymbol} khi giá vượt đỉnh cũ hoặc volume tăng vọt gấp 3 lần 20MA. Khi có tín hiệu, hãy tự động điều tra nguyên nhân tin tức và order flow...`}
                    rows={3}
                    className="w-full p-4 rounded-xl bg-[#101423] border border-white/10 text-white placeholder-gray-500 text-xs focus:outline-none focus:border-pink-500/50 resize-none font-sans"
                  />
                  <div className="absolute right-3 bottom-3 flex items-center gap-2">
                    <button
                      onClick={handleCreateRule}
                      disabled={isCompiling || !promptInput.trim()}
                      className="px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isCompiling ? (
                        <>
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                          <span>Generating Tea Script...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Compile &amp; Activate</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Prompt Suggestions */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-[11px] text-gray-500 flex items-center gap-1">
                    <Flame className="w-3 h-3 text-pink-400" />
                    Examples:
                  </span>
                  {promptSuggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      onClick={() => setPromptInput(sug)}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5 transition-colors cursor-pointer text-left"
                    >
                      "{sug}"
                    </button>
                  ))}
                </div>
              </div>

              {/* Feature Explanation Banner */}
              <div className="p-4 rounded-xl bg-[#080a12] border border-white/5 text-xs text-gray-300 space-y-2">
                <div className="font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-pink-400" />
                  <span>The Paradigm Shift: From Blind Alerts to Causal AI Research</span>
                </div>
                <p className="text-gray-400 text-[11px] leading-relaxed">
                  Before, legacy charting tools only chimed when a price line was touched. Finora's
                  AI Autonomous Monitors synthesize runnable Tea scripts that watch tick volume, order book
                  depth, and volatility. When a trigger condition fires, the AI immediately searches
                  wire services, SEC filings, and block trades to answer{' '}
                  <strong className="text-white">WHY it moved</strong> with verified sources.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {rules.length === 0 ? (
                <div className="text-center py-16 text-gray-400 text-xs">
                  No active monitors. Switch to "Create New NL Monitor" to set up your first watcher.
                </div>
              ) : (
                rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-4 rounded-xl bg-[#101423] border border-white/10 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono font-bold text-white px-2 py-0.5 rounded bg-white/10">
                            {rule.symbol}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">
                            {rule.aiProvider}
                          </span>
                          <span className="text-[11px] text-gray-400">{rule.createdAt}</span>
                        </div>
                        <p className="text-xs font-semibold text-gray-200">"{rule.userPrompt}"</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleRule(rule.id)}
                          className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                            rule.isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-gray-500/10 text-gray-400 border-gray-500/30'
                          }`}
                        >
                          {rule.isActive ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                          <span>{rule.isActive ? 'ACTIVE' : 'PAUSED'}</span>
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Generated Tea Script Collapsible/View */}
                    <div className="p-3 rounded-lg bg-[#07090f] border border-white/5 font-mono text-[11px] text-gray-300 overflow-x-auto">
                      <div className="flex items-center justify-between text-gray-500 mb-1 text-[10px]">
                        <span>Compiled TeaScript Engine v2.0</span>
                        <span>Auto-Investigate: ON</span>
                      </div>
                      <pre className="text-pink-300/90 whitespace-pre leading-relaxed">
                        {rule.generatedTeaScript}
                      </pre>
                    </div>

                    {/* Recent Triggered Alerts */}
                    {rule.recentAlerts.length > 0 && (
                      <div className="pt-2 border-t border-white/5 space-y-1.5">
                        <span className="text-[10px] font-mono uppercase text-gray-400 block">
                          Recent Anomaly Triggers ({rule.recentAlerts.length})
                        </span>
                        {rule.recentAlerts.map((alt) => (
                          <div
                            key={alt.id}
                            className="p-2 rounded-lg bg-pink-500/5 border border-pink-500/20 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-pink-400 shrink-0" />
                              <span className="font-mono text-gray-400">{alt.timestamp}</span>
                              <span className="text-gray-200">{alt.message}</span>
                            </div>

                            {onSelectInvestigation && (
                              <button
                                onClick={() => {
                                  onSelectInvestigation(rule.symbol)
                                  onClose()
                                }}
                                className="px-2 py-1 rounded bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>View AI Investigation</span>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#07090f] border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
          <span className="font-mono">TeaScript 2.0 Real-Time Execution Loop • 0 Latency</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
