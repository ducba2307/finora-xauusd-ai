import React, { useState } from 'react'
import {
  X,
  Sparkles,
  Play,
  Code2,
  Copy,
  Check,
  ArrowRight,
  CheckCircle2,
  FileCode
} from 'lucide-react'
import type { AIModelProvider } from '../../types/aiCharting'
import { AI_PROVIDERS, convertPineScriptToTea } from '../../services/aiAgentService'

interface PineScriptMigrationModalProps {
  isOpen: boolean
  onClose: () => void
  onApplyToChart?: (scriptName: string, teaCode: string) => void
}

const PINE_TEMPLATES: { name: string; pineCode: string }[] = [
  {
    name: 'SuperTrend ATR Strategy',
    pineCode: `//@version=5
indicator("Supertrend ATR Volatility", overlay=true)
atrPeriod = input(10, "ATR Period")
src = input(hl2, "Source")
multiplier = input(3.0, "ATR Multiplier")

atrVal = ta.atr(atrPeriod)
up = src - (multiplier * atrVal)
down = src + (multiplier * atrVal)

isBuy = ta.crossover(close, down)
isSell = ta.crossunder(close, up)

plot(up, "Supertrend Lower", color=color.green)
plot(down, "Supertrend Upper", color=color.red)
plotshape(isBuy, "Buy Signal", shape.triangleup, location.belowbar, color.green)
plotshape(isSell, "Sell Signal", shape.triangledown, location.abovebar, color.red)`,
  },
  {
    name: 'Volume Weighted Average Price (VWAP) Bands',
    pineCode: `//@version=5
indicator("VWAP Institutional Bands", overlay=true)
length = input(20, "Period")
vwapVal = ta.sma(close * volume, length) / ta.sma(volume, length)
dev = ta.atr(length) * 1.5

plot(vwapVal, "VWAP", color=color.blue)
plot(vwapVal + dev, "Upper Band", color=color.yellow)
plot(vwapVal - dev, "Lower Band", color=color.yellow)`,
  },
  {
    name: 'Bollinger Band Squeeze & Volume Breakout',
    pineCode: `//@version=5
indicator("Bollinger Volatility Breakout", overlay=true)
basis = ta.sma(close, 20)
dev = 2.0 * ta.atr(20)
upper = basis + dev
lower = basis - dev

breakoutLong = ta.crossover(close, upper) and volume > ta.sma(volume, 20) * 2.0

plot(basis, "Basis", color=color.blue)
plot(upper, "Upper", color=color.green)
plot(lower, "Lower", color=color.red)`,
  },
]

export const PineScriptMigrationModal: React.FC<PineScriptMigrationModalProps> = ({
  isOpen,
  onClose,
  onApplyToChart,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<AIModelProvider>('CODEX')
  const [sourceCode, setSourceCode] = useState(PINE_TEMPLATES[0].pineCode)
  const [convertedCode, setConvertedCode] = useState<string>(
    () => convertPineScriptToTea(PINE_TEMPLATES[0].pineCode, 'CODEX').convertedTeaScript
  )
  const [isConverting, setIsConverting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [applied, setApplied] = useState(false)

  const handleSelectTemplate = (templatePine: string) => {
    setSourceCode(templatePine)
    setApplied(false)
    setIsConverting(true)
    setTimeout(() => {
      const res = convertPineScriptToTea(templatePine, selectedProvider)
      setConvertedCode(res.convertedTeaScript)
      setIsConverting(false)
    }, 400)
  }

  const handleConvert = () => {
    setIsConverting(true)
    setApplied(false)
    setTimeout(() => {
      const res = convertPineScriptToTea(sourceCode, selectedProvider)
      setConvertedCode(res.convertedTeaScript)
      setIsConverting(false)
    }, 500)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(convertedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRunOnChart = () => {
    if (onApplyToChart) {
      onApplyToChart('Converted Tea Indicator', convertedCode)
      setApplied(true)
      setTimeout(() => setApplied(false), 3000)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-[#0b0e17] border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#07090f]/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center text-cyan-400">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-bold">
                  AI Script Migration Studio
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  TradingView Pine Script v4/v5 → TeaScript v2.0
                </span>
              </div>
              <h2 className="text-lg font-bold text-white">
                Convert TradingView Indicators into Native Tea Script
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

        {/* Toolbar: Template Presets & LLM Selector */}
        <div className="px-6 py-3 bg-[#080a12] border-b border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-mono">Presets:</span>
            <div className="flex items-center gap-1.5">
              {PINE_TEMPLATES.map((tpl, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectTemplate(tpl.pineCode)}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5 transition-colors cursor-pointer text-xs"
                >
                  {tpl.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-mono">AI Model:</span>
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#101423] border border-white/10">
              {AI_PROVIDERS.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => setSelectedProvider(provider.id)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                    selectedProvider === provider.id
                      ? 'bg-cyan-500 text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {provider.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Split Code View */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 overflow-y-auto flex-1">
          {/* Left: Pine Script Input */}
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-gray-400 flex items-center gap-1.5 font-bold">
                <FileCode className="w-4 h-4 text-amber-400" />
                <span>TradingView Pine Script (Input)</span>
              </span>
              <span className="text-[10px] text-gray-500 font-mono">v4 / v5 Syntax</span>
            </div>
            <textarea
              value={sourceCode}
              onChange={(e) => setSourceCode(e.target.value)}
              rows={16}
              className="w-full flex-1 p-3.5 rounded-xl bg-[#07090f] border border-white/10 font-mono text-[11px] text-gray-300 leading-relaxed focus:outline-none focus:border-cyan-500/50 resize-none"
            />
            <button
              onClick={handleConvert}
              disabled={isConverting}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
            >
              {isConverting ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Converting Syntax AST...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Convert to TeaScript v2.0</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>

          {/* Right: Converted Tea Script Output */}
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-emerald-400 flex items-center gap-1.5 font-bold">
                <Sparkles className="w-4 h-4" />
                <span>Finora TeaScript v2.0 (Runnable AST)</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-gray-300 text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy Code'}</span>
                </button>
              </div>
            </div>
            <textarea
              readOnly
              value={convertedCode}
              rows={16}
              className="w-full flex-1 p-3.5 rounded-xl bg-[#07090f] border border-emerald-500/30 font-mono text-[11px] text-emerald-300/90 leading-relaxed focus:outline-none resize-none"
            />
            <button
              onClick={handleRunOnChart}
              className={`w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                applied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white'
              }`}
            >
              {applied ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Indicator Applied to Active Chart!</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Run &amp; Overlay Directly on Chart (0 Quota Limit)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#07090f] border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-mono">AST Parser Verified • 100% Free &amp; Unlimited Indicators</span>
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
