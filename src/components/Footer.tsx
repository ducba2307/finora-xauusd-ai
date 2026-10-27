import React from 'react'
import { Sparkles } from 'lucide-react'

const CURRENT_YEAR = new Date().getFullYear()

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-white/10 bg-[#06070a] text-xs text-gray-400 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand info */}
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-pink-600 to-rose-500 flex items-center justify-center text-white font-bold shadow-md">
                ⚡
              </div>
              <span className="text-lg font-extrabold text-white tracking-tight">Finora AI</span>
            </div>
            <p className="text-gray-400 max-w-sm mb-4 leading-relaxed">
              Empowering individual traders and institutional funds with multi-agent quantitative models, zero-latency execution, and automated risk protection.
            </p>
            <div className="flex items-center gap-3 text-gray-500">
              <span className="hover:text-white cursor-pointer transition-colors">Twitter (X)</span>
              <span>•</span>
              <span className="hover:text-white cursor-pointer transition-colors">Discord</span>
              <span>•</span>
              <span className="hover:text-white cursor-pointer transition-colors">Telegram</span>
              <span>•</span>
              <span className="hover:text-white cursor-pointer transition-colors">GitHub</span>
            </div>
          </div>

          {/* Column 1 */}
          <div>
            <h5 className="font-bold text-white mb-3 uppercase tracking-wider text-[11px]">Platform</h5>
            <ul className="space-y-2.5">
              <li className="hover:text-white cursor-pointer transition-colors">Live Terminal</li>
              <li className="hover:text-white cursor-pointer transition-colors">AI Alpha Models</li>
              <li className="hover:text-white cursor-pointer transition-colors">Whale Flow Radar</li>
              <li className="hover:text-white cursor-pointer transition-colors">MEV Guard</li>
            </ul>
          </div>

          {/* Column 2 */}
          <div>
            <h5 className="font-bold text-white mb-3 uppercase tracking-wider text-[11px]">Quant Tools</h5>
            <ul className="space-y-2.5">
              <li className="hover:text-white cursor-pointer transition-colors">Order Book Imbalance</li>
              <li className="hover:text-white cursor-pointer transition-colors">Backtest Simulator</li>
              <li className="hover:text-white cursor-pointer transition-colors">API Docs (REST & WS)</li>
              <li className="hover:text-white cursor-pointer transition-colors">Risk Telemetry</li>
            </ul>
          </div>

          {/* Column 3 */}
          <div>
            <h5 className="font-bold text-white mb-3 uppercase tracking-wider text-[11px]">Legal & Safety</h5>
            <ul className="space-y-2.5">
              <li className="hover:text-white cursor-pointer transition-colors">Terms of Service</li>
              <li className="hover:text-white cursor-pointer transition-colors">Privacy Policy</li>
              <li className="hover:text-white cursor-pointer transition-colors">Security Audit (CertiK)</li>
              <li className="hover:text-white cursor-pointer transition-colors">Risk Disclosure</li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-wrap items-center justify-between gap-4 text-[11px] text-gray-500">
          <div>
            © {CURRENT_YEAR} Finora AI Quant Technologies Inc. All rights reserved.
          </div>

          <div className="flex items-center gap-1.5 text-gray-400">
            <Sparkles className="w-3 h-3 text-pink-400" />
            <span>Built with High Precision Autonomous Architecture</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
