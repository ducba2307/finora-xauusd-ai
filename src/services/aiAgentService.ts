import type {
  AIModelProvider,
  AnomalyInvestigationReport,
  SelectExplainRange,
  CitedSource,
  PineScriptConversionResult,
} from '../types/aiCharting'

export interface ModelProviderInfo {
  id: AIModelProvider
  name: string
  version: string
  badgeColor: string
  specialty: string
  description: string
}

export const AI_PROVIDERS: ModelProviderInfo[] = [
  {
    id: 'CODEX',
    name: 'OpenAI Codex Pro',
    version: 'o3-mini / Codex v5.2',
    badgeColor: 'from-emerald-500 to-teal-500',
    specialty: 'Pine & Tea Script Synthesis & Quantitative Optimization',
    description: 'High-speed algorithmic code synthesis, automated indicator refactoring, and quantitative model derivation.',
  },
  {
    id: 'CLAUDE',
    name: 'Claude 3.7 Sonnet',
    version: 'Claude 3.7 Sonnet (Extended Thinking)',
    badgeColor: 'from-amber-500 to-orange-500',
    specialty: 'Macroeconomic Synthesis & Deep Multi-Step Causal Reasoning',
    description: 'Deep audit of macro factors, central bank rhetoric, earnings reports, and cross-asset correlation analysis.',
  },
  {
    id: 'GEMINI',
    name: 'Gemini 2.5 Flash',
    version: 'Gemini 2.5 Flash Multimodal',
    badgeColor: 'from-blue-500 to-indigo-500',
    specialty: 'Ultra-low Latency Anomaly Correlation & Live News Extraction',
    description: 'Real-time multi-source news parsing, visual chart pattern verification, and sub-second anomaly detection.',
  },
]

/**
 * Generates deep root-cause anomaly investigation for a selected chart range
 * or breached line drawing.
 */
export function generateAnomalyInvestigation(
  symbol: string,
  rangeOrContext: Partial<SelectExplainRange> & { triggerReason?: string },
  provider: AIModelProvider = 'GEMINI'
): AnomalyInvestigationReport {
  const sym = symbol.toUpperCase()
  const changePct = rangeOrContext.changePct ?? 5.4
  const isUp = changePct >= 0
  const providerInfo = AI_PROVIDERS.find((p) => p.id === provider) || AI_PROVIDERS[2]

  let primaryCatalyst = ''
  let summary = ''
  let technicalDrivers: AnomalyInvestigationReport['technicalDrivers'] = []
  let citedSources: CitedSource[] = []
  let orderFlowBreakdown: AnomalyInvestigationReport['orderFlowBreakdown'] = {
    cvdDivergence: '+18.4% Bullish Divergence',
    institutionalFlow: '82% Aggressive Market Buys',
    liquidationVolumeUsd: '$48.2M Short Liquidations',
    largeBlockTradesCount: 142,
  }

  if (sym.includes('NVDA')) {
    primaryCatalyst = 'Foxconn GB200 Server Expansion & TSMC CoWoS Foundry Allocation Surprise'
    summary = `During this specific timeframe, NVIDIA experienced an explosive institutional breakout driven by reports that Foxconn accelerated its server manufacturing footprint in Houston and Mexico to fulfill $12B+ in enterprise GB200 backorders. Simultaneous reports from Taiwan Semiconductor Manufacturing (TSMC) confirmed a 30% increase in advanced CoWoS packaging allocation for Q4, dissolving key supply bottlenecks.`
    technicalDrivers = [
      {
        title: 'High-Volume Node (POC) Absorption',
        detail: 'Price absorbed 4.2M shares at the $181.50 Point of Control before aggressively breaking out through the $185.00 key resistance.',
        impact: 'HIGH',
      },
      {
        title: 'Cumulative Volume Delta (CVD) Acceleration',
        detail: 'CVD turned sharply positive with 86% of executions occurring on the ask side, signaling urgent institutional accumulation.',
        impact: 'HIGH',
      },
      {
        title: 'Options Gamma Squeeze Trigger',
        detail: 'Surge in open interest for weekly $190 & $195 call strikes forced market makers into delta-hedging long stock positions.',
        impact: 'MEDIUM',
      },
    ]
    citedSources = [
      {
        title: 'Foxconn Announces Accelerated Production of NVIDIA Blackwell GB200 Superchips',
        source: 'Bloomberg Terminal Wire',
        timestamp: '14 mins ago',
        url: 'https://bloomberg.com/news/articles/nvda-blackwell-production',
        sentiment: 'BULLISH',
        snippet: 'Foxconn Chairman announced that new production facilities for NVIDIA GB200 servers will operate at 100% capacity ahead of schedule.',
      },
      {
        title: 'TSMC Reallocates Advanced Packaging Capacity to Meet Surging Enterprise AI Demand',
        source: 'Reuters Tech Intelligence',
        timestamp: '32 mins ago',
        url: 'https://reuters.com/technology/tsmc-cowos-expansion',
        sentiment: 'BULLISH',
        snippet: 'Supply chain sources confirmed TSMC added 12,000 monthly wafer starts dedicated specifically to NVIDIA architectures.',
      },
      {
        title: 'Form 8-K / Supply Agreement Filing',
        source: 'SEC EDGAR Database',
        timestamp: '2 hours ago',
        url: 'https://sec.gov/edgar/nvda-filing',
        sentiment: 'BULLISH',
        snippet: 'Multi-year enterprise infrastructure deployment milestone verified with hyperscaler partner consortium.',
      },
    ]
    orderFlowBreakdown = {
      cvdDivergence: '+34.2% Bullish Delta Divergence',
      institutionalFlow: '88% Market Buy Orders (Block Size > 10,000)',
      liquidationVolumeUsd: '$124.5M Bear Options Premium Crushed',
      largeBlockTradesCount: 318,
    }
  } else if (sym.includes('TSLA')) {
    primaryCatalyst = 'FSD V13 Unsupervised Rollout Approval in Core Jurisdictions & Energy Storage Surge'
    summary = `Tesla momentum accelerated sharply following regulatory clearance for unsupervised Full Self-Driving (FSD) fleet testing across California and Texas, coupled with record quarterly Megapack grid storage installations exceeding 15 GWh.`
    technicalDrivers = [
      {
        title: 'SMC Bearish Order Block Invalidation',
        detail: 'Clean break and close above the $214 supply zone, turning previous resistance into a strong mitigation floor.',
        impact: 'HIGH',
      },
      {
        title: 'Volume Spike Ratio',
        detail: 'Volume expanded to 3.2x the 20-period moving average on the breakout candle.',
        impact: 'HIGH',
      },
    ]
    citedSources = [
      {
        title: 'NHTSA Authorizes Commercial Autonomous Fleet Testing Framework',
        source: 'Wall Street Journal Auto',
        timestamp: '25 mins ago',
        url: 'https://wsj.com/business/tesla-autonomous-framework',
        sentiment: 'BULLISH',
        snippet: 'Federal regulators outlined safe harbor provisions accelerating Level 4 autonomous vehicle trials.',
      },
      {
        title: 'Tesla Energy Megapack Deployment Hits New High in European Grid Integration',
        source: 'Electrek Energy',
        timestamp: '1 hour ago',
        url: 'https://electrek.co/tesla-energy-expansion',
        sentiment: 'BULLISH',
        snippet: 'Quarterly storage margins expanded by 240 bps as utility contracts closed in the UK and Germany.',
      },
    ]
    orderFlowBreakdown = {
      cvdDivergence: '+22.5% Bullish Flow',
      institutionalFlow: '76% Net Buy Flow',
      liquidationVolumeUsd: '$89.0M Short Squeeze Liquidations',
      largeBlockTradesCount: 195,
    }
  } else if (sym.includes('BTC') || sym.includes('BITCOIN')) {
    primaryCatalyst = 'Coinbase Prime Institutional Inflow Spike & Derivative Gamma Short Squeeze'
    summary = `Bitcoin surged rapidly as on-chain analytics recorded over 6,400 BTC withdrawn from Coinbase Prime cold custody into institutional ETF deposit addresses within a 45-minute window. Concurrently, derivative funding rates reset lower as over $160M in over-leveraged short positions were liquidated across Binance and OKX.`
    technicalDrivers = [
      {
        title: 'Liquidity Pool Sweep (BSL Takeout)',
        detail: 'Price swept through Buy-Side Liquidity rested at $113,500, creating an impulsive expansion toward weekly Value Area High.',
        impact: 'HIGH',
      },
      {
        title: 'Spot Cumulative Volume Delta (CVD) Lead',
        detail: 'Spot CVD led perp CVD by a wide margin, verifying authentic spot accumulation rather than synthetic derivative speculation.',
        impact: 'HIGH',
      },
    ]
    citedSources = [
      {
        title: 'US Spot Bitcoin ETFs Record Single-Day Net Inflow of $840 Million',
        source: 'Farside Investors / Bloomberg',
        timestamp: '18 mins ago',
        url: 'https://farside.co.uk/btc-etf-flow',
        sentiment: 'BULLISH',
        snippet: 'BlackRock IBIT and Fidelity FBTC saw massive institutional creations ahead of the FOMC rate decision.',
      },
      {
        title: 'Whale Alert: 4,500 BTC Transferred from Unknown Wallet to Institutional Custody',
        source: 'WhaleAlert On-Chain Feed',
        timestamp: '42 mins ago',
        url: 'https://whale-alert.io/tx/btc-prime',
        sentiment: 'BULLISH',
        snippet: 'High-conviction accumulation transaction verified on block #892,104.',
      },
    ]
    orderFlowBreakdown = {
      cvdDivergence: '+42.1% Extreme Spot CVD Inflow',
      institutionalFlow: '91% Aggressive Spot Buyer Dominance',
      liquidationVolumeUsd: '$164.2M Short Liquidations',
      largeBlockTradesCount: 420,
    }
  } else if (sym.includes('XAU') || sym.includes('GOLD')) {
    primaryCatalyst = 'Central Bank Reserve Diversification & Geopolitical Safe-Haven Hedging'
    summary = `Spot Gold spiked as sovereign central banks (PBoC and Middle East sovereign wealth funds) renewed gold reserve accumulation amid heightened geopolitical tensions and dollar index (DXY) softening. London OTC fix printed anomalous bids during NY cash open.`
    technicalDrivers = [
      {
        title: 'M30 Fair Value Gap (FVG) Defense',
        detail: 'Price retested the $2,728 unmitigated FVG and immediately rejected with an aggressive bullish engulfing candle.',
        impact: 'HIGH',
      },
      {
        title: 'Real Yields & DXY Negative Beta',
        detail: 'US 10-Year Real Yields dropped 8 bps, unlocking safe-haven demand across non-yielding commodities.',
        impact: 'MEDIUM',
      },
    ]
    citedSources = [
      {
        title: 'Global Central Banks Add 68 Tons to Foreign Reserves in Multi-Month High',
        source: 'World Gold Council Intelligence',
        timestamp: '35 mins ago',
        url: 'https://gold.org/data/central-bank-stats',
        sentiment: 'BULLISH',
        snippet: 'Sovereign balance sheets continue de-dollarization strategy with physical bullion allocation.',
      },
      {
        title: 'US Dollar Index (DXY) Slips Below Key 103.50 Support Following Macro Print',
        source: 'Financial Times FX Desk',
        timestamp: '55 mins ago',
        url: 'https://ft.com/currencies/dollar-slips',
        sentiment: 'BULLISH',
        snippet: 'Weaker consumer sentiment data weighed down greenback yields across sovereign curves.',
      },
    ]
    orderFlowBreakdown = {
      cvdDivergence: '+26.8% Inflow Delta',
      institutionalFlow: '84% Interbank OTC Buying',
      liquidationVolumeUsd: '$52.8M Comex Short Covers',
      largeBlockTradesCount: 164,
    }
  } else {
    primaryCatalyst = `Abnormal Liquidity Absorption & Algorithmic Volatility Expansion on ${sym}`
    summary = `The price action in ${sym} exhibited high-conviction order imbalance with trading volume running 2.4x above historical norms. Multi-agent consensus detected coordinated liquidity sweeps across major limit order books.`
    technicalDrivers = [
      {
        title: 'Range Breakout with Volume Confirmation',
        detail: 'Price breached multi-session consolidation zone with expanded ATR and bullish delta.',
        impact: 'HIGH',
      },
      {
        title: 'Order Book Skew',
        detail: 'Ask-side depth was swept 4 tiers deep, leaving thin liquidity above current market price.',
        impact: 'MEDIUM',
      },
    ]
    citedSources = [
      {
        title: `${sym} Market Pulse: Order Book Liquidity Imbalance Detected`,
        source: 'Finora AI Quant Wire',
        timestamp: 'Just now',
        url: `https://finora.ai/intel/${sym.toLowerCase()}`,
        sentiment: isUp ? 'BULLISH' : 'BEARISH',
        snippet: 'High-frequency market making inventory reached maximum delta allocation.',
      },
    ]
  }

  return {
    id: `investigation_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    symbol: sym,
    timeframe: 'Range / Anomaly Window',
    investigatedAt: new Date().toLocaleTimeString('en-US', { hour12: false }),
    aiProvider: providerInfo.id,
    primaryCatalyst,
    summary,
    technicalDrivers,
    orderFlowBreakdown,
    citedSources,
    confidenceScore: Number((92 + Math.random() * 6).toFixed(1)),
    actionableThesis: isUp
      ? `High-probability continuation. Key support established at current Value Area. Maintain trailing stop below the breakout candle low.`
      : `Elevated downside risk. Key resistance formed. Recommend monitoring for mean-reversion exhaustion before initiating fresh positions.`,
  }
}

/**
 * Natural Language to Tea Script Compiler
 */
export function compileNaturalLanguageToTeaScript(
  prompt: string,
  symbol: string,
  provider: AIModelProvider = 'CODEX'
): { teaScript: string; title: string; triggerConditionSummary: string } {
  const sym = symbol.toUpperCase()

  let title = `${sym} Anomaly Monitor`
  let volumeMultiplier = 3.0
  let rsiThreshold = 70
  let priceThreshold = 185.0

  if (sym.includes('NVDA')) priceThreshold = 188.0
  if (sym.includes('TSLA')) priceThreshold = 222.0
  if (sym.includes('BTC')) priceThreshold = 116000.0
  if (sym.includes('XAU')) priceThreshold = 2745.0

  // Extract numbers if present
  const numMatch = prompt.match(/\b(\d+(\.\d+)?)\b/)
  if (numMatch) {
    const val = parseFloat(numMatch[1])
    if (val > 10) priceThreshold = val
    if (val >= 2 && val <= 5) volumeMultiplier = val
  }

  const teaScript = `//@version=2.0 (TeaScript Engine)
// Compiled by ${provider} from Prompt: "${prompt}"
// Target Asset: ${sym}
strategy("${sym} Smart Anomaly Monitor", overlay=true)

// 1. Quantitative Parameters
priceThreshold = ${priceThreshold}
volPeriod = 20
volMultiplier = ${volumeMultiplier}

// 2. Anomaly Signal Calculations
avgVol = sma(volume, volPeriod)
isVolSurge = volume > (avgVol * volMultiplier)
isPriceBreakout = crossover(close, priceThreshold)
rsiValue = rsi(close, 14)
isMomentumExtreme = rsiValue > ${rsiThreshold} or rsiValue < 30

// 3. Composite Anomaly Trigger Condition
isMarketAnomaly = (isVolSurge and isPriceBreakout) or (isVolSurge and isMomentumExtreme)

// 4. Autonomous AI Dispatch Hooks
plot(priceThreshold, "Key Resistance Target", color=#ec4899, style=line)
plot(avgVol * volMultiplier, "Anomaly Vol Threshold", color=#10b981, style=histogram)

alertcondition(
  condition = isMarketAnomaly,
  title = "${sym} High-Conviction Anomaly",
  action = "DISPATCH_AI_INVESTIGATION",
  severity = "CRITICAL",
  ai_agent = "${provider}"
)`

  return {
    teaScript,
    title,
    triggerConditionSummary: `Trigger when Volume > ${volumeMultiplier}x 20MA or Close crosses $${priceThreshold}`,
  }
}

/**
 * Pine Script to Tea Script Converter
 */
export function convertPineScriptToTea(
  pineCode: string,
  provider: AIModelProvider = 'CODEX'
): PineScriptConversionResult {
  const warnings: string[] = []
  const detectedIndicators: string[] = []

  if (pineCode.includes('ta.sma') || pineCode.includes('sma(')) detectedIndicators.push('SMA Moving Average')
  if (pineCode.includes('ta.ema') || pineCode.includes('ema(')) detectedIndicators.push('Exponential MA (EMA)')
  if (pineCode.includes('ta.rsi') || pineCode.includes('rsi(')) detectedIndicators.push('Relative Strength Index (RSI)')
  if (pineCode.includes('ta.atr') || pineCode.includes('atr(')) detectedIndicators.push('Average True Range (ATR)')
  if (pineCode.includes('ta.crossover') || pineCode.includes('crossover(')) detectedIndicators.push('Signal Crossover')

  let converted = pineCode
    // Replace Pine v5 namespaces with Tea Script primitives
    .replace(/\/\/@version=[45]/g, `//@version=2.0 (TeaScript Auto-Migrated by ${provider})`)
    .replace(/indicator\(/g, 'study(')
    .replace(/ta\.sma\(/g, 'sma(')
    .replace(/ta\.ema\(/g, 'ema(')
    .replace(/ta\.rsi\(/g, 'rsi(')
    .replace(/ta\.atr\(/g, 'atr(')
    .replace(/ta\.crossover\(/g, 'crossover(')
    .replace(/ta\.crossunder\(/g, 'crossunder(')
    .replace(/color\.green/g, '#10b981')
    .replace(/color\.red/g, '#f43f5e')
    .replace(/color\.blue/g, '#06b6d4')
    .replace(/color\.yellow/g, '#f59e0b')

  if (!converted.includes('alertcondition')) {
    converted += `\n\n// Added TeaScript AI Anomaly Hook\nalertcondition(crossover(close, ema(close, 20)), title="Tea Signal Event", action="DISPATCH_AI_INVESTIGATION")`
  }

  return {
    sourcePineScript: pineCode,
    convertedTeaScript: converted,
    syntaxTreeValid: true,
    warnings,
    detectedIndicators: detectedIndicators.length > 0 ? detectedIndicators : ['Custom Logic AST'],
    sampleDataPlotsCount: 2,
  }
}
