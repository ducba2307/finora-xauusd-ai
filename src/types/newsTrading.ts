export type NewsImpact = 'HIGH_IMPACT' | 'CRITICAL_FOMC' | 'MEDIUM_IMPACT'
export type NewsDirectionBias = 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL_WHIP' | 'BEARISH' | 'STRONG_BEARISH'

export interface EconomicNewsEvent {
  id: string
  title: string
  country: 'USD' | 'EUR' | 'GBP'
  flag: string
  impact: NewsImpact
  scheduledTime: string // ISO string or format
  countdownSeconds: number // dynamic countdown
  previous: string
  forecast: string
  shadowEstimate: string
  unit: string
  historicalMissPct: number
  description: string
  currencyAffected: string
}

export interface MacroDataFeed {
  dxyIndex: number
  dxyChangePct: number
  dxyTrend: 'BULLISH' | 'BEARISH' | 'CHOPPY'
  us10yYield: number
  us10yYieldChangeBps: number
  goldBetaVsDxy: number
  goldBetaVsYields: number
  realYieldStatus: string
}

export interface PreNewsOrderBookDepth {
  symbol: 'XAU/USD'
  bidDepthRatio: number // e.g. 62%
  askDepthRatio: number // e.g. 38%
  cvdDeltaUsd: string
  spreadPipsNormal: number
  spreadPipsExpectedNews: number
  liquidityVoidDetected: boolean
  nearestBslPrice: number // Buy-Side Liquidity
  nearestSslPrice: number // Sell-Side Liquidity
  fvgZone: string // Fair Value Gap
}

export interface NewsTradingScenario {
  id: 'SCENARIO_BULLISH' | 'SCENARIO_BEARISH' | 'SCENARIO_TRAP'
  title: string
  bias: NewsDirectionBias
  probabilityPct: number
  macroTriggerCondition: string
  action: 'BUY_MARKET_OR_DIP' | 'SELL_BREAKDOWN' | 'WAIT_POST_NEWS_FVG' | 'ARM_STRADDLE'
  entryZone: string
  entryPriceNumber: number
  slPrice: number
  tp1Price: number
  tp2Price: number
  expectedPips: number
  riskReward: number
  tacticalNotes: string
}

export interface PreNewsAnalysisReport {
  eventId: string
  eventTitle: string
  assetSymbol: 'XAU/USD'
  currentGoldPrice: number
  countdownText: string
  phase: 'COUNTDOWN_PRE_NEWS' | 'TACTICAL_WINDOW_T_60S' | 'NEWS_RELEASED'
  primaryDirection: NewsDirectionBias
  confidenceScore: number
  macroFeed: MacroDataFeed
  orderBookDepth: PreNewsOrderBookDepth
  scenarios: NewsTradingScenario[]
  recommendedScenario: NewsTradingScenario
  impliedVolatilityMoveUsd: number
  impliedMovePips: number
  riskLevel: 'EXTREME' | 'HIGH' | 'MODERATE'
  aiSummary: string
}

export interface HistoricalNewsRecord {
  id: string
  date: string
  eventName: string
  forecast: string
  actual: string
  surpriseDelta: string
  aiPredictedBias: NewsDirectionBias
  actualGoldMovePips: number
  outcome: 'WIN' | 'LOSS'
  rMultiple: number
  notes: string
}

export interface StraddleBracketOrderSetup {
  symbol: 'XAU/USD'
  currentPrice: number
  buyStopPrice: number
  sellStopPrice: number
  slDistancePips: number
  tpDistancePips: number
  lots: number
  maxSlippagePips: number
  ocoEnabled: boolean
}
