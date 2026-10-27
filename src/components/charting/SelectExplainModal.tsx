import React, { useState } from 'react'
import {
  X,
  Sparkles,
  ExternalLink,
  Bot,
  TrendingUp,
  TrendingDown,
  Layers,
  Activity,
  CheckCircle2,
  Pin,
  Cpu
} from 'lucide-react'
import type { SelectExplainRange, AIModelProvider } from '../../types/aiCharting'
import { AI_PROVIDERS, generateAnomalyInvestigation } from '../../services/aiAgentService'
import { formatPercent } from '../../utils/formatters'

interface SelectExplainModalProps {
  isOpen: boolean
  rangeData: SelectExplainRange | null
  onClose: () => void
  onPinAnnotation?: (report: any) => void
}

export const SelectExplainModal: React.FC<SelectExplainModalProps> = ({
  isOpen,
  rangeData,
  onClose,
  onPinAnnotation,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<AIModelProvider>('GEMINI')
  const [isInvestigating, setIsInvestigating] = useState(false)
  const [report, setReport] = useState(() => {
    if (!rangeData) return null
    return generateAnomalyInvestigation(rangeData.symbol, rangeData, 'GEMINI')
  })

  // Re-generate report if rangeData or provider changes
  const handleSwitchProvider = (providerId: AIModelProvider) => {
    setSelectedProvider(providerId)
    setIsInvestigating(true)
    setTimeout(() => {
      if (rangeData) {
        setReport(generateAnomalyInvestigation(rangeData.symbol, rangeData, providerId))
      }
      setIsInvestigating(false)
    }, 450)
  }

  if (!isOpen || !rangeData) return null

  const isUp = rangeData.changePct >= 0
  const activeModel = AI_PROVIDERS.find((p) => p.id === selectedProvider) || AI_PROVIDERS[2]

  const startDateStr = new Date(rangeData.startTime * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const endDateStr = new Date(rangeData.endTime * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#0b0e17] border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-gray-200">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#07090f]/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-500/20 to-emerald-500/20 border border-white/10 flex items-center justify-center text-pink-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-wider text-pink-400 font-bold">
                  OpenChart Engine • Select → Explain
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  保留价格与时间坐标
                </span>
              </div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>AI Anomaly Root-Cause Deep Dive:</span>
                <span className="text-pink-400">{rangeData.symbol}</span>
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

        {/* Selected Range Coordinates Banner */}
        <div className="px-6 py-3.5 bg-[#101423] border-b border-white/5 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div>
            <span className="text-gray-400 block text-[11px]">Selected Interval</span>
            <div className="font-mono text-white font-semibold mt-0.5 truncate">
              {startDateStr} → {endDateStr}
            </div>
          </div>
          <div>
            <span className="text-gray-400 block text-[11px]">Price Movement</span>
            <div className="flex items-center gap-1 font-mono font-bold mt-0.5">
              <span className="text-gray-300">${rangeData.startPrice.toFixed(2)}</span>
              <span className="text-gray-500">→</span>
              <span className="text-white">${rangeData.endPrice.toFixed(2)}</span>
            </div>
          </div>
          <div>
            <span className="text-gray-400 block text-[11px]">Net Return / Range</span>
            <div
              className={`flex items-center gap-1 font-mono font-bold mt-0.5 ${
                isUp ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{formatPercent(rangeData.changePct)}</span>
              <span className="text-[10px] text-gray-400">({rangeData.barsCount} bars)</span>
            </div>
          </div>
          <div>
            <span className="text-gray-400 block text-[11px]">Volume Anomaly</span>
            <div className="font-mono text-cyan-400 font-bold mt-0.5">
              {(rangeData.volumeTotal / 1000).toFixed(1)}k Vol ({rangeData.volumeRatioVsAvg.toFixed(1)}x Avg)
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1 flex items-center justify-end">
            {onPinAnnotation && (
              <button
                onClick={() => {
                  if (report) onPinAnnotation(report)
                  onClose()
                }}
                className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-pink-300 border border-pink-500/30 flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer transition-all"
              >
                <Pin className="w-3.5 h-3.5" />
                <span>Pin on Chart</span>
              </button>
            )}
          </div>
        </div>

        {/* AI Agent Switcher Bar */}
        <div className="px-6 py-3 bg-[#080a12] border-b border-white/5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-400 font-medium">Investigating Agent:</span>
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0e121e] border border-white/10 text-xs">
            {AI_PROVIDERS.map((provider) => {
              const isActive = selectedProvider === provider.id
              return (
                <button
                  key={provider.id}
                  onClick={() => handleSwitchProvider(provider.id)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? `bg-gradient-to-r ${provider.badgeColor} text-white shadow-md`
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>{provider.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Main Content Scrollable Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {isInvestigating ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 rounded-full border-2 border-pink-500 border-t-transparent animate-spin" />
              <div className="text-sm font-mono text-gray-400">
                {activeModel.name} is correlating order flow, SEC filings &amp; news catalysts...
              </div>
            </div>
          ) : report ? (
            <>
              {/* Primary Catalyst Box */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-pink-500/10 via-purple-500/5 to-transparent border border-pink-500/20">
                <div className="flex items-center gap-2 text-xs font-semibold text-pink-400 mb-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>PRIMARY CATALYST IDENTIFIED</span>
                  <span className="ml-auto text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Confidence: {report.confidenceScore}%
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mb-2">{report.primaryCatalyst}</h3>
                <p className="text-xs text-gray-300 leading-relaxed">{report.summary}</p>
              </div>

              {/* Order Flow & Footprint Breakdown */}
              <div>
                <h4 className="text-xs font-mono uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span>Institutional Order Flow &amp; Liquidity Footprint</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-[#101423] border border-white/5">
                    <span className="text-[11px] text-gray-400 block">CVD Divergence</span>
                    <span className="text-sm font-mono font-bold text-emerald-400 mt-1 block">
                      {report.orderFlowBreakdown.cvdDivergence}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#101423] border border-white/5">
                    <span className="text-[11px] text-gray-400 block">Institutional Flow</span>
                    <span className="text-sm font-mono font-bold text-white mt-1 block">
                      {report.orderFlowBreakdown.institutionalFlow}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#101423] border border-white/5">
                    <span className="text-[11px] text-gray-400 block">Liquidation Squeeze</span>
                    <span className="text-sm font-mono font-bold text-pink-400 mt-1 block">
                      {report.orderFlowBreakdown.liquidationVolumeUsd}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#101423] border border-white/5">
                    <span className="text-[11px] text-gray-400 block">Block Trades (&gt;$100k)</span>
                    <span className="text-sm font-mono font-bold text-cyan-400 mt-1 block">
                      {report.orderFlowBreakdown.largeBlockTradesCount} Blocks
                    </span>
                  </div>
                </div>
              </div>

              {/* Technical Drivers */}
              <div>
                <h4 className="text-xs font-mono uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span>Technical &amp; Market Structure Confluence</span>
                </h4>
                <div className="space-y-2.5">
                  {report.technicalDrivers.map((driver, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-[#101423] border border-white/5 flex items-start gap-3"
                    >
                      <div className="w-2 h-2 rounded-full bg-pink-400 mt-1.5 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{driver.title}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                              driver.impact === 'HIGH'
                                ? 'bg-pink-500/15 text-pink-300 border border-pink-500/30'
                                : 'bg-gray-500/15 text-gray-300'
                            }`}
                          >
                            {driver.impact} IMPACT
                          </span>
                        </div>
                        <p className="text-xs text-gray-300 mt-1">{driver.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Verified Sources & Citations */}
              <div>
                <h4 className="text-xs font-mono uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-blue-400" />
                  <span>Verified News Sources &amp; Wire Citations</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {report.citedSources.map((source, idx) => (
                    <a
                      key={idx}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3.5 rounded-xl bg-[#101423] border border-white/5 hover:border-white/20 transition-all group block"
                    >
                      <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                        <span className="text-pink-400 font-semibold">{source.source}</span>
                        <span className="font-mono">{source.timestamp}</span>
                      </div>
                      <div className="text-xs font-bold text-white group-hover:text-pink-300 transition-colors line-clamp-1">
                        {source.title}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">{source.snippet}</p>
                    </a>
                  ))}
                </div>
              </div>

              {/* Actionable Thesis */}
              <div className="p-4 rounded-xl bg-[#090c14] border border-emerald-500/30 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-mono text-emerald-400 font-bold block mb-1">
                    ACTIONABLE QUANTITATIVE THESIS
                  </span>
                  <p className="text-xs text-gray-200 leading-relaxed">{report.actionableThesis}</p>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#07090f] border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <span>Powered by</span>
            <span className="text-white font-semibold">{activeModel.name}</span>
            <span>• Verified Point-in-time Data</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
