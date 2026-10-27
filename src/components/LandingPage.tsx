import React from 'react'
import { 
  ArrowRight, Sparkles, ShieldCheck, Zap, 
  Check, Star, ChevronRight, Activity 
} from 'lucide-react'

interface LandingPageProps {
  onLaunchApp: () => void
  onOpenCopilot: () => void
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLaunchApp, onOpenCopilot }) => {
  return (
    <div className="relative w-full overflow-hidden bg-[#07080c]">
      {/* =========================================================================
          HERO SECTION (Exact replica of Image 1 & 2 Finora Hero with Radiant Arch)
      ========================================================================= */}
      <section className="relative pt-12 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col items-center text-center">
        {/* Subtle Perspective Grid */}
        <div className="absolute inset-0 bg-grid-pattern radial-mask pointer-events-none opacity-40"></div>

        {/* The Signature Radiant Pink Glowing Arc (Image 1 & 2) */}
        <div className="hero-halo"></div>
        <div className="hero-halo-core"></div>

        {/* Ambient star particles */}
        <div className="absolute top-20 left-1/4 w-1.5 h-1.5 rounded-full bg-pink-300 blur-[0.5px] animate-ping"></div>
        <div className="absolute top-36 right-1/4 w-2 h-2 rounded-full bg-rose-400 blur-[1px] animate-pulse"></div>
        <div className="absolute top-12 right-1/3 w-1 h-1 rounded-full bg-white opacity-75"></div>

        {/* Top Pill Badge */}
        <div className="relative z-10 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#121624]/90 border border-white/10 text-xs text-gray-300 mb-8 backdrop-blur-md shadow-lg">
          <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse"></span>
          <span>Your Finances, Fully Under Control</span>
          <span className="text-gray-500">•</span>
          <span className="text-pink-400 font-semibold">Autonomous AI Hedge Engine</span>
        </div>

        {/* Massive Hero Heading */}
        <h1 className="relative z-10 text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl leading-[1.1] mb-6">
          Simplify Financial Management <br />
          <span className="bg-gradient-to-r from-white via-pink-100 to-pink-400 bg-clip-text text-transparent">
            With Powerful Finora
          </span>
        </h1>

        {/* Hero Subtitle */}
        <p className="relative z-10 text-base sm:text-lg text-gray-400 max-w-2xl mb-10 leading-relaxed font-normal">
          Manage, track, and optimize your company finances with smart tools designed for accuracy, speed, and scalability.
        </p>

        {/* Action Buttons */}
        <div className="relative z-10 flex flex-wrap items-center justify-center gap-4 mb-16">
          <button
            onClick={onLaunchApp}
            className="px-8 py-4 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-600 hover:from-pink-400 hover:to-rose-400 text-white font-bold text-sm sm:text-base shadow-[0_0_35px_rgba(236,72,153,0.6)] flex items-center gap-3 transition-all transform hover:-translate-y-0.5 cursor-pointer"
          >
            <span>Launch AI Terminal</span>
            <ArrowRight className="w-5 h-5" />
          </button>

          <button
            onClick={onOpenCopilot}
            className="px-7 py-4 rounded-2xl bg-[#141824]/90 hover:bg-[#1a2030] border border-white/10 hover:border-pink-500/40 text-gray-200 hover:text-white font-semibold text-sm sm:text-base backdrop-blur-md flex items-center gap-2.5 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-pink-400" />
            <span>Chat With AI Quant</span>
          </button>
        </div>

        {/* =========================================================================
            HERO MOCKUP CARD (Pixel-perfect replica of Image 2 UI Card)
        ========================================================================= */}
        <div className="relative z-10 w-full max-w-5xl rounded-3xl p-1 bg-gradient-to-b from-white/20 via-pink-500/20 to-transparent shadow-[0_20px_70px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          <div className="bg-[#0b0e17] rounded-[22px] border border-white/10 p-4 sm:p-6 text-left overflow-hidden">
            {/* Top Bar of the Mockup Card */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-white/10">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-pink-500 flex items-center justify-center text-white font-bold shadow-md">
                    ⚡
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white leading-tight">Finora</h4>
                    <span className="text-[11px] text-gray-400">Enterprise Quant</span>
                  </div>
                </div>

                <div className="hidden sm:block h-6 w-[1px] bg-white/10"></div>

                <div>
                  <h3 className="text-base font-bold text-white">Hi, Oripio! Welcome back.</h3>
                  <p className="text-xs text-gray-400">Manage your cards and review recent transactions.</p>
                </div>
              </div>

              {/* Mockup Search & Admin */}
              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-2 bg-[#121624] px-3.5 py-1.5 rounded-xl border border-white/10 text-xs text-gray-400">
                  <span>Search product</span>
                  <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-300">⌘ K</span>
                </div>
                <div className="flex items-center gap-2 bg-[#121624] p-1.5 rounded-xl border border-white/10">
                  <div className="w-7 h-7 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center text-xs font-bold">
                    OP
                  </div>
                  <div className="hidden sm:block text-left pr-2">
                    <div className="text-xs font-bold text-white leading-tight">Oripio</div>
                    <div className="text-[10px] text-pink-400">Admin Pro</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mockup 4 Balances Row (Image 2) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-5">
              <div className="bg-[#121624]/90 p-4 rounded-2xl border border-white/5 hover:border-pink-500/30 transition-all">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                  <span>Current Balance</span>
                  <span className="text-gray-500">•••</span>
                </div>
                <div className="text-2xl font-bold text-white font-mono-num">$7,000.75</div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-[11px]">
                  <span className="text-gray-400">Earned +$3,345.00!</span>
                  <span className="text-emerald-400 font-bold font-mono-num">+47.89% ↗</span>
                </div>
              </div>

              <div className="bg-[#121624]/90 p-4 rounded-2xl border border-white/5 hover:border-pink-500/30 transition-all">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                  <span>Total Savings</span>
                  <span className="text-gray-500">•••</span>
                </div>
                <div className="text-2xl font-bold text-white font-mono-num">$5,300.50</div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-[11px]">
                  <span className="text-gray-400">Saved +$1,456.00!</span>
                  <span className="text-emerald-400 font-bold font-mono-num">+42.33% ↗</span>
                </div>
              </div>

              <div className="bg-[#121624]/90 p-4 rounded-2xl border border-white/5 hover:border-pink-500/30 transition-all">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                  <span>Total Income</span>
                  <span className="text-gray-500">•••</span>
                </div>
                <div className="text-2xl font-bold text-white font-mono-num">$28,750.75</div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-[11px]">
                  <span className="text-gray-400">Income up by $3,345</span>
                  <span className="text-emerald-400 font-bold font-mono-num">+50.76% ↗</span>
                </div>
              </div>

              <div className="bg-[#121624]/90 p-4 rounded-2xl border border-white/5 hover:border-pink-500/30 transition-all">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                  <span>Total Expenses</span>
                  <span className="text-gray-500">•••</span>
                </div>
                <div className="text-2xl font-bold text-white font-mono-num">$21,450.00</div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-[11px]">
                  <span className="text-gray-400">Expenses -45.12%</span>
                  <span className="text-rose-400 font-bold font-mono-num">-45.12% ↘</span>
                </div>
              </div>
            </div>

            {/* Quick Send & Mini Analytics Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-[#121624]/70 p-4 rounded-2xl border border-white/5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-xs font-bold text-white uppercase tracking-wider">AI Autonomous Trade Signals</h5>
                  <span className="text-xs text-pink-400 font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Live Quant Stream
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#090c14] border border-white/5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <div>
                        <div className="text-xs font-bold text-white">BTC/USDT Breakout Scalp</div>
                        <div className="text-[10px] text-gray-400">Deep Transformer v4.8 • Order flow imbalance</div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-mono-num font-bold">
                      +$1,450.20 (96.4%)
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#090c14] border border-white/5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <div>
                        <div className="text-xs font-bold text-white">ETH/USDT Liquidity Sweep</div>
                        <div className="text-[10px] text-gray-400">Whale Flow Radar • Institutional DCA fill</div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-mono-num font-bold">
                      +$820.50 (91.2%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Send Widget from Mockup */}
              <div className="bg-[#121624]/70 p-4 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-xs font-bold text-white">Quick Send</h5>
                  <span className="text-[10px] text-gray-400">Instant Settlement</span>
                </div>
                <div className="flex items-center gap-2 my-2 overflow-x-auto py-1">
                  {['👨‍💻', '👩‍💼', '🧑‍🎨', '🧔', '👩‍🔬'].map((emoji, idx) => (
                    <div key={idx} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm cursor-pointer hover:scale-110 transition-transform shrink-0">
                      {emoji}
                    </div>
                  ))}
                </div>
                <div className="bg-[#090c14] p-2.5 rounded-xl border border-white/5 mt-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-white font-mono-num">100,0000</span>
                  <span className="text-xs text-indigo-400 font-bold">VISA &bull;</span>
                </div>
                <button
                  onClick={onLaunchApp}
                  className="w-full mt-2.5 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-bold shadow-md cursor-pointer hover:opacity-95"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SOCIAL PROOF BANNER (Image 1: Trusted by 4,000+ Growing Companies)
      ========================================================================= */}
      <section className="py-12 border-y border-white/5 bg-[#080a11]">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-8">
            Trusted by 4,000+ Growing Companies & Global Quants
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-14 opacity-60 grayscale hover:grayscale-0 transition-all">
            <span className="text-lg sm:text-xl font-bold text-white tracking-wider flex items-center gap-1">
              LinkedIn
            </span>
            <span className="text-lg sm:text-xl font-bold text-white tracking-wider flex items-center gap-1">
              ∞ Meta
            </span>
            <span className="text-lg sm:text-xl font-bold text-white tracking-wider flex items-center gap-1">
              Google
            </span>
            <span className="text-lg sm:text-xl font-bold text-white tracking-wider flex items-center gap-1">
              amazon
            </span>
            <span className="text-lg sm:text-xl font-bold text-white tracking-wider flex items-center gap-1">
              airbnb
            </span>
            <span className="text-lg sm:text-xl font-bold text-white tracking-wider flex items-center gap-1">
              WhatsApp
            </span>
            <span className="text-lg sm:text-xl font-bold text-white tracking-wider flex items-center gap-1">
              🔥 tinder
            </span>
          </div>
        </div>
      </section>

      {/* =========================================================================
          EXCEPTIONAL FINANCIAL SERVICES (3 Cards matching Image 1)
      ========================================================================= */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
          Exceptional Financial Services
        </h2>
        <p className="text-gray-400 max-w-2xl mx-auto text-sm sm:text-base mb-16">
          Explore our wide range of services designed to help you succeed in managing and scaling your algorithmic capital.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {/* Card 1 */}
          <div className="fin-card p-6 sm:p-8 hover:border-pink-500/40 transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-pink-500/10 text-pink-400 border border-pink-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-3">Multi-Layer Neural Alpha</h3>
            <p className="text-sm text-gray-400 leading-relaxed mb-6">
              Trained on 10+ petabytes of tick-level order book telemetry to forecast sub-second breakout moves with 94%+ win accuracy.
            </p>
            <span className="text-xs font-bold text-pink-400 flex items-center gap-1">
              Learn More <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Card 2 */}
          <div className="fin-card p-6 sm:p-8 hover:border-pink-500/40 transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-pink-500/10 text-pink-400 border border-pink-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-3">Whale Telemetry & Smart Money</h3>
            <p className="text-sm text-gray-400 leading-relaxed mb-6">
              Track institutional accumulation before it manifests on public candlestick charts. Follow the top 100 high-conviction crypto whales.
            </p>
            <span className="text-xs font-bold text-pink-400 flex items-center gap-1">
              Learn More <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Card 3 */}
          <div className="fin-card p-6 sm:p-8 hover:border-pink-500/40 transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-pink-500/10 text-pink-400 border border-pink-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-3">Secure & Zero-Latency Execution</h3>
            <p className="text-sm text-gray-400 leading-relaxed mb-6">
              Equipped with private RPC mempool routing, MEV sandwich protection, and dynamic trailing stop-loss algorithms to protect your capital.
            </p>
            <span className="text-xs font-bold text-pink-400 flex items-center gap-1">
              Learn More <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </section>

      {/* =========================================================================
          POWERFUL FEATURES BUILT FOR MODERN FINANCE (Bento Grid matching Image 1)
      ========================================================================= */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
            Powerful Features Built for Modern Finance
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto text-sm sm:text-base">
            Cutting-edge architecture designed for institutional stability and quantitative speed.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Bento 1: Bar chart */}
          <div className="md:col-span-1 fin-card p-6 flex flex-col justify-between">
            <div>
              <h4 className="text-base font-bold text-white mb-1">Manage Spending & Cash Flow</h4>
              <p className="text-xs text-gray-400 mb-6">Track expenses and optimize capital distribution seamlessly.</p>
            </div>
            <div className="h-44 flex items-end justify-between gap-2 px-2 bg-[#080b12] p-4 rounded-xl border border-white/5">
              {[60, 85, 45, 95, 75, 40, 100].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-pink-600 to-rose-400"
                    style={{ height: `${h}%` }}
                  ></div>
                  <span className="text-[10px] text-gray-500 font-mono-num">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bento 2: Donut Chart / Asset allocation */}
          <div className="md:col-span-1 fin-card p-6 flex flex-col justify-between">
            <div>
              <h4 className="text-base font-bold text-white mb-1">Smart Analytics</h4>
              <p className="text-xs text-gray-400 mb-6">Multi-asset portfolio allocation with risk-weighted budgeting.</p>
            </div>
            <div className="flex flex-col items-center justify-center p-4 bg-[#080b12] rounded-xl border border-white/5">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-white/10"
                    strokeWidth="3.8"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-pink-500"
                    strokeDasharray="50, 100"
                    strokeWidth="4"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-emerald-400"
                    strokeDasharray="30, 100"
                    strokeDashoffset="-50"
                    strokeWidth="4"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-xs font-bold text-white font-mono-num">+142%</span>
                  <span className="text-[9px] text-gray-400 block">Alpha APY</span>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-500"></span> BTC 50%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> ETH 30%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-white/20"></span> Cash 20%</span>
              </div>
            </div>
          </div>

          {/* Bento 3: Group Management */}
          <div className="md:col-span-1 fin-card p-6 flex flex-col justify-between">
            <div>
              <h4 className="text-base font-bold text-white mb-1">Group Management</h4>
              <p className="text-xs text-gray-400 mb-6">Multi-signature authorization and quantitative team roles.</p>
            </div>
            <div className="flex flex-col items-center justify-center p-6 bg-[#080b12] rounded-xl border border-white/5 h-44">
              <div className="flex -space-x-3 mb-4">
                {['https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
                  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
                  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
                  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80'
                ].map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt="avatar"
                    className="w-10 h-10 rounded-full border-2 border-[#0e111a] object-cover"
                  />
                ))}
              </div>
              <span className="text-xs font-bold text-white">4 Active Fund Partners</span>
              <span className="text-[11px] text-emerald-400 font-mono-num">Real-time Sync Active</span>
            </div>
          </div>

          {/* Bento 4: Real-time Accounting at your fingertips */}
          <div className="md:col-span-2 fin-card p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <h4 className="text-xl font-bold text-white mb-2">Real-time Accounting at your fingertips</h4>
              <p className="text-sm text-gray-400 max-w-lg mb-6">
                Automated tax calculations, trade ledger reconstruction, and real-time PnL accounting for high-frequency operations.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#080b12] p-5 rounded-2xl border border-white/5">
              <div>
                <div className="text-xs text-gray-500 mb-1">Total PnL Generated</div>
                <div className="text-3xl font-extrabold text-white font-mono-num">$345,950.00</div>
                <div className="text-xs text-emerald-400 font-bold mt-1 font-mono-num">+214.5% All-Time</div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-white/5">
                  <span className="text-gray-300">Spot Profit</span>
                  <span className="text-emerald-400 font-bold font-mono-num">+$218,400.00</span>
                </div>
                <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-white/5">
                  <span className="text-gray-300">Arbitrage Yield</span>
                  <span className="text-pink-400 font-bold font-mono-num">+$127,550.00</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bento 5: Invest and manage financial future easily */}
          <div className="md:col-span-1 fin-card p-6 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-pink-500/20 blur-2xl pointer-events-none"></div>
            <div>
              <h4 className="text-lg font-bold text-white mb-2">Invest and manage financial future easily</h4>
              <p className="text-xs text-gray-400 mb-6">
                Autonomous AI bots rebalance your exposure 24 hours a day, 7 days a week.
              </p>
            </div>
            <button
              onClick={onLaunchApp}
              className="w-full py-3 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/30 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Explore Terminal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          PRICING PLANS MATRIX (Exact reproduction of Image 1 Pricing)
      ========================================================================= */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
          Choose the Plan That Fits You
        </h2>
        <p className="text-gray-400 max-w-xl mx-auto text-sm sm:text-base mb-16">
          Flexible pricing packages designed to support traders and institutional funds at every scale.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left max-w-5xl mx-auto">
          {/* Free Plan */}
          <div className="fin-card p-8 flex flex-col justify-between">
            <div>
              <h4 className="text-lg font-bold text-white">Free</h4>
              <p className="text-xs text-gray-400 mt-1 mb-6">Basic analytics & manual trading signals</p>
              <div className="text-4xl font-extrabold text-white font-mono-num mb-6">$0<span className="text-sm font-normal text-gray-400">/mo</span></div>
              <ul className="space-y-3.5 text-xs text-gray-300">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400" /> Real-time market charts
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400" /> 3 AI Signals per day
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400" /> Standard Swap Routing
                </li>
                <li className="flex items-center gap-2.5 text-gray-500">
                  <span>✕</span> Autonomous Trading Bots
                </li>
              </ul>
            </div>
            <button
              onClick={onLaunchApp}
              className="w-full mt-8 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs border border-white/10 transition-all cursor-pointer"
            >
              Get Started
            </button>
          </div>

          {/* $100 / mo Pro Highlighted Card */}
          <div className="fin-card-glow p-8 flex flex-col justify-between relative transform -translate-y-2">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-[10px] font-extrabold text-white tracking-wider uppercase shadow-lg">
              Most Popular
            </div>
            <div>
              <h4 className="text-lg font-bold text-white">Pro Quant</h4>
              <p className="text-xs text-gray-400 mt-1 mb-6">Full autonomous AI agent hedge suite</p>
              <div className="text-4xl font-extrabold text-white font-mono-num mb-6">
                $100<span className="text-sm font-normal text-gray-400">/mo</span>
              </div>
              <ul className="space-y-3.5 text-xs text-gray-200">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-pink-400" /> Unlimited Real-Time AI Signals
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-pink-400" /> 4 Active Autonomous Bots
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-pink-400" /> Smart Money Whale Radar
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-pink-400" /> Private MEV Protection
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-pink-400" /> Finora AI Copilot Assistant
                </li>
              </ul>
            </div>
            <button
              onClick={onLaunchApp}
              className="w-full mt-8 py-3.5 rounded-xl bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-600 hover:from-pink-400 hover:to-rose-400 text-white font-bold text-xs shadow-[0_0_20px_rgba(236,72,153,0.5)] transition-all cursor-pointer"
            >
              Start 14-Day Free Trial
            </button>
          </div>

          {/* $370 / mo Enterprise */}
          <div className="fin-card p-8 flex flex-col justify-between">
            <div>
              <h4 className="text-lg font-bold text-white">Enterprise Fund</h4>
              <p className="text-xs text-gray-400 mt-1 mb-6">Sub-millisecond API & custom models</p>
              <div className="text-4xl font-extrabold text-white font-mono-num mb-6">
                $370<span className="text-sm font-normal text-gray-400">/mo</span>
              </div>
              <ul className="space-y-3.5 text-xs text-gray-300">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400" /> Everything in Pro Quant
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400" /> Unlimited Autonomous Bots
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400" /> Dedicated Colocated Server
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400" /> Custom Model Training
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400" /> 24/7 Dedicated Quant Support
                </li>
              </ul>
            </div>
            <button
              onClick={onLaunchApp}
              className="w-full mt-8 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs border border-white/10 transition-all cursor-pointer"
            >
              Contact Sales
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          TESTIMONIALS (6 Cards matching Image 1)
      ========================================================================= */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
            Loved by Global Traders & Fund Managers
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto text-sm sm:text-base">
            See how algorithmic traders generate consistent alpha with Finora AI.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              name: 'Arthur Hayes',
              role: 'Macro Crypto Trader',
              comment: 'Finora’s order book imbalance transformer spotted the $112K BTC breakout 4 hours before any public indicator. Pure gold.',
              rating: 5,
            },
            {
              name: 'Elena Rostova',
              role: 'Quant Researcher, Geneva',
              comment: 'The MEV-shielded routing and automated trailing stop-losses saved our fund over $85,000 during high volatility spikes.',
              rating: 5,
            },
            {
              name: 'David Chen',
              role: 'DeFi Portfolio Lead',
              comment: 'The interface is stunning. It combines the sleek aesthetics of Finora with the clinical data depth of Coinza.',
              rating: 5,
            },
            {
              name: 'Sarah Jenkins',
              role: 'Algorithmic Bot Builder',
              comment: 'I replaced my custom Python scripts with Finora’s 4 AI agents. My monthly Sharpe ratio jumped from 1.6 to 2.9.',
              rating: 5,
            },
            {
              name: 'Marcus Vance',
              role: 'Angel Investor & Prop Trader',
              comment: 'Hands down the best AI trading interface in Web3. The real-time charts and live copilot are unmatched.',
              rating: 5,
            },
            {
              name: 'Yuki Tanaka',
              role: 'Derivatives Specialist',
              comment: 'The whale flow accumulator tracks institutional positioning better than any on-chain tool I’ve used in the past 5 years.',
              rating: 5,
            },
          ].map((item, i) => (
            <div key={i} className="fin-card p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1 text-amber-400 mb-3">
                  {[...Array(item.rating)].map((_, idx) => (
                    <Star key={idx} className="w-3.5 h-3.5 fill-current" />
                  ))}
                </div>
                <p className="text-xs sm:text-sm text-gray-300 leading-relaxed mb-6 italic">
                  "{item.comment}"
                </p>
              </div>
              <div className="flex items-center gap-3 pt-3 border-t border-white/5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-indigo-500 flex items-center justify-center font-bold text-white text-xs">
                  {item.name[0]}
                </div>
                <div>
                  <h5 className="text-xs font-bold text-white leading-tight">{item.name}</h5>
                  <span className="text-[10px] text-gray-400">{item.role}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================================
          INTEGRATION TOOLS (Image 1: Integrate With the Tools You Use Daily)
      ========================================================================= */}
      <section className="py-16 border-t border-white/5 bg-[#080a11]">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h3 className="text-2xl font-bold text-white mb-2">Integrate With the Tools You Use Daily</h3>
          <p className="text-xs text-gray-400 mb-10">Direct low-latency bridge to major CEX, DEX, and payment gateways</p>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            {['Binance', 'Bybit', 'OKX', 'Uniswap', 'Coinbase', 'TradingView', 'Stripe', 'PayPal', 'MetaMask', 'Phantom'].map((tool, idx) => (
              <div
                key={idx}
                className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-pink-500/30 text-xs font-bold text-gray-300 hover:text-white transition-all cursor-pointer flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-pink-500"></span>
                <span>{tool}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          BOTTOM GLOWING ARC CTA (Image 1 Bottom Radiant Arch)
      ========================================================================= */}
      <section className="relative py-28 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center overflow-hidden">
        <div className="hero-halo !top-auto !bottom-[-200px]"></div>
        <div className="hero-halo-core !top-auto !bottom-[-150px]"></div>

        <div className="relative z-10">
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-6">
            Ready to Take Control of <br />
            <span className="bg-gradient-to-r from-pink-300 to-rose-400 bg-clip-text text-transparent">
              Your Finances?
            </span>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto text-sm sm:text-base mb-10">
            Join over 4,000+ traders automating high-conviction market edges with 24/7 AI hedge models.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={onLaunchApp}
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-600 hover:from-pink-400 hover:to-rose-400 text-white font-bold text-base shadow-[0_0_35px_rgba(236,72,153,0.7)] flex items-center gap-2 cursor-pointer transition-all transform hover:scale-105"
            >
              <span>Get Started Now</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={onOpenCopilot}
              className="px-7 py-4 rounded-2xl bg-[#141824] hover:bg-[#1c2236] text-gray-200 border border-white/10 text-sm font-semibold cursor-pointer transition-all"
            >
              Ask AI Assistant
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
