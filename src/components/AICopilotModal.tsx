import React, { useState } from 'react'
import { X, Send, Bot, Sparkles, Cpu } from 'lucide-react'
import type { AIMessage } from '../types/trading'
import type { AIModelProvider } from '../types/aiCharting'
import { AI_PROVIDERS } from '../services/aiAgentService'

interface AICopilotModalProps {
  isOpen: boolean
  onClose: () => void
}

function createUserMessageId(): string {
  return `u-${Date.now()}`
}

export const AICopilotModal: React.FC<AICopilotModalProps> = ({ isOpen, onClose }) => {
  const [selectedProvider, setSelectedProvider] = useState<AIModelProvider>('CODEX')
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: 'm1',
      sender: 'ai',
      text: 'Welcome to Finora Quant AI Agent Desk. I am connected directly to OpenAI Codex, Claude 3.7 Sonnet, and Gemini 2.5 Flash. I continuously monitor stocks (NVDA, TSLA, AAPL), crypto, and forex order books, correlate news catalysts, and develop runnable Tea scripts. How can I assist your trading desk today?',
      timestamp: 'Just now',
    },
  ])
  const [inputText, setInputText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([])

  if (!isOpen) return null

  const activeModel = AI_PROVIDERS.find((p) => p.id === selectedProvider) || AI_PROVIDERS[0]

  const handleSend = (textToSend?: string) => {
    const text = textToSend || inputText
    if (!text.trim()) return

    const userMsg: AIMessage = {
      id: createUserMessageId(),
      sender: 'user',
      text,
      timestamp: 'Just now',
    }

    setMessages((prev) => [...prev, userMsg])
    setInputText('')
    setIsTyping(true)

    // Simulate multi-step agent reasoning chain
    setThinkingSteps([
      `[${activeModel.name}] Ingesting live tick stream & volume profile...`,
      `[News & SEC Wire] Correlating financial catalysts and supply chain news...`,
      `[Order Book Footprint] Calculating CVD divergence & liquidation depth...`,
      `[Synthesis] Deriving institutional trading hypothesis...`,
    ])

    setTimeout(() => {
      let reply = ''
      let chartSnippet = undefined

      const lower = text.toLowerCase()
      if (lower.includes('nvda') || lower.includes('nvidia')) {
        reply =
          'NVIDIA (NVDA) Analysis: Price broke key resistance at $185.00 with +240% volume surge. Catalyst: Foxconn announced expansion of Blackwell GB200 server rack manufacturing facilities in Houston and Mexico to fulfill $12B+ in enterprise backorders. Simultaneously, TSMC expanded CoWoS advanced packaging allocation by 30%. Volume Profile POC is solidifying at $181.50 with 88% aggressive ask-side absorption. Projected target: $198.50 (+6.4%).'
        chartSnippet = { symbol: 'NVDA', recommendation: 'STRONG BUY', confidence: 97.4 }
      } else if (lower.includes('tsla') || lower.includes('tesla')) {
        reply =
          'Tesla (TSLA) Analysis: Testing $218.40 resistance with positive CVD divergence (+22.5%). Catalyst: NHTSA authorized commercial autonomous vehicle fleet testing frameworks in Texas and California, accelerating Level 4 robotaxi trials. Concurrently, European Megapack grid deployments hit a quarterly record. Key support established at $212.00 Value Area Low.'
        chartSnippet = { symbol: 'TSLA', recommendation: 'BUY', confidence: 88.2 }
      } else if (lower.includes('tea') || lower.includes('script') || lower.includes('pine')) {
        reply =
          'Generated TeaScript v2.0 Indicator:\n\n//@version=2.0 (TeaScript)\nstrategy("AI Volatility Breakout", overlay=true)\navgVol = sma(volume, 20)\nisAnomaly = (volume > avgVol * 3.0) and crossover(close, 185.0)\nalertcondition(isAnomaly, title="Volume Breakout", action="DISPATCH_AI_INVESTIGATION")\n\nYou can run this directly in the "NL Monitor" or "Pine Migration" Studio on your chart with 0 quota limits!'
      } else if (lower.includes('btc') || lower.includes('bitcoin')) {
        reply =
          'Bitcoin (BTC) is consolidating at $114,884 with strong buy absorption near $112,500. Spot CVD leads perp CVD with over 6,400 BTC withdrawn into institutional custody. Projected breakout target is $122,500 (+6.6%).'
        chartSnippet = { symbol: 'BTC/USDT', recommendation: 'STRONG BUY', confidence: 96.4 }
      } else {
        reply = `Analysis confirmed for "${text}". Multi-agent consensus across ${activeModel.name} indicates favorable risk-to-reward ratio. Volume Profile confirms strong liquidity support at recent Value Area High.`
      }

      const aiMsg: AIMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: reply,
        timestamp: 'Just now',
        chartSnippet,
      }
      setMessages((prev) => [...prev, aiMsg])
      setIsTyping(false)
      setThinkingSteps([])
    }, 1100)
  }

  const promptShortcuts = [
    'Investigate NVDA volume breakout & catalyst',
    'Investigate TSLA support & order flow',
    'Generate Tea Script indicator for Bitcoin',
    'Explain how AI investigates chart line breaches',
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="fin-card-glow w-full max-w-3xl bg-[#0a0d16] border border-pink-500/30 rounded-2xl flex flex-col h-[640px] overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#0e121e]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-600 to-rose-400 flex items-center justify-center text-white shadow-lg">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">Finora AI Agent Charting Desk</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-mono-num font-semibold border border-emerald-500/30">
                  ONLINE • 3 LLM ENGINES
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Connects Codex, Claude &amp; Gemini for Causal Market Research
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* AI Provider Switcher */}
        <div className="px-4 py-2.5 bg-[#07090f] border-b border-white/5 flex items-center justify-between gap-2 text-xs">
          <span className="text-gray-400 font-mono flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-pink-400" />
            <span>Active Agent:</span>
          </span>

          <div className="flex items-center gap-1.5 p-0.5 rounded-xl bg-[#101423] border border-white/10">
            {AI_PROVIDERS.map((provider) => {
              const isSelected = selectedProvider === provider.id
              return (
                <button
                  key={provider.id}
                  onClick={() => setSelectedProvider(provider.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? `bg-gradient-to-r ${provider.badgeColor} text-white shadow-md`
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {provider.name}
                </button>
              )
            })}
          </div>
        </div>

        {/* Chat History */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'ai' && (
                <div className="w-7 h-7 rounded-lg bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400 shrink-0 mt-1">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-tr-none'
                    : 'bg-[#121626] border border-white/10 text-gray-200 rounded-tl-none whitespace-pre-wrap'
                }`}
              >
                <p>{msg.text}</p>
                {msg.chartSnippet && (
                  <div className="mt-3 p-3 bg-black/40 border border-white/10 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-gray-400 block text-[10px]">Asset</span>
                      <span className="font-bold text-white font-mono-num">{msg.chartSnippet.symbol}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Signal</span>
                      <span className="font-bold text-emerald-400 font-mono-num">{msg.chartSnippet.recommendation}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">AI Conviction</span>
                      <span className="font-bold text-pink-400 font-mono-num">{msg.chartSnippet.confidence}%</span>
                    </div>
                  </div>
                )}
                <span className="block text-[10px] text-gray-400/80 mt-1.5 text-right font-mono-num">
                  {msg.timestamp}
                </span>
              </div>
            </div>
          ))}

          {/* Live Thinking Steps */}
          {isTyping && (
            <div className="flex gap-3 items-start animate-pulse">
              <div className="w-7 h-7 rounded-lg bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400 shrink-0 mt-1">
                <Bot className="w-3.5 h-3.5 animate-spin" />
              </div>
              <div className="bg-[#121626] border border-white/10 rounded-2xl rounded-tl-none p-3 space-y-1 text-xs">
                {thinkingSteps.map((step, idx) => (
                  <div key={idx} className="font-mono text-[11px] text-pink-300 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Prompt Suggestions */}
        <div className="px-4 py-2 border-t border-white/5 bg-[#0a0d16] flex items-center gap-2 overflow-x-auto no-scrollbar">
          {promptShortcuts.map((sug, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(sug)}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5 whitespace-nowrap cursor-pointer transition-colors"
            >
              {sug}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-[#0e121e] border-t border-white/10 flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={`Ask ${activeModel.name} to analyze NVDA, TSLA, generate Tea indicators, or set up monitoring...`}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-pink-500/50"
          />
          <button
            onClick={() => handleSend()}
            className="w-9 h-9 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white flex items-center justify-center cursor-pointer transition-colors shadow-md"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
