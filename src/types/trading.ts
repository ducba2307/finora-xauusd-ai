export type MarketCategory = 'CRYPTO' | 'FOREX' | 'STOCKS'

export interface CryptoAsset {
  id: string
  name: string
  symbol: string
  icon: string
  price: number
  change24h: number
  volume24h: string
  marketCap: string
  sparkline: number[]
  aiSignal: 'STRONG BUY' | 'BUY' | 'HOLD' | 'TAKE PROFIT' | 'SELL'
  aiConfidence: number
  network: string
  category: MarketCategory
  high24h?: number
  low24h?: number
  fundingRate?: number
  spreadPips?: number
  digits?: number
}

export interface ChartDataPoint {
  timestamp: string
  price: number
  volume: number
  open?: number
  high?: number
  low?: number
  close?: number
  signal?: 'BUY' | 'SELL' | 'TAKE_PROFIT'
  signalText?: string
  ema20?: number
  ema50?: number
  ema34?: number
  ema89?: number
  ema200?: number
  aiUpperBand?: number
  aiLowerBand?: number
}

export interface CandlestickPoint {
  time: number // Unix timestamp in seconds
  open: number
  high: number
  low: number
  close: number
  volume: number
  ema20?: number
  ema50?: number
  ema34?: number
  ema89?: number
  ema200?: number
  signal?: 'BUY' | 'SELL' | 'TAKE_PROFIT' | 'SMC_OB' | 'SMC_FVG'
  signalText?: string
}

export interface TradeOrder {
  id: string
  assetSymbol: string
  type: 'BUY' | 'SELL'
  amount: number
  price: number
  total: number
  time: string
  status: 'COMPLETED' | 'PENDING' | 'AI_TRIGGERED'
  pnl?: number
  aiStrategy?: string
  market?: MarketCategory
}

export interface Position {
  id: string
  symbol: string
  side: 'LONG' | 'SHORT'
  size: number
  entryPrice: number
  markPrice: number
  liquidationPrice: number
  leverage: number
  margin: number
  unrealizedPnl: number
  unrealizedPnlPct: number
  tpPrice?: number
  slPrice?: number
  market?: MarketCategory
  lots?: number
  pips?: number
}

export interface OrderBookEntry {
  price: number
  size: number
  total: number
  depthPct: number
}

export interface OrderBook {
  bids: OrderBookEntry[]
  asks: OrderBookEntry[]
  spread: number
  spreadPct: number
}

export interface PublicTrade {
  id: string
  time: string
  price: number
  size: number
  side: 'BUY' | 'SELL'
}

export interface WhaleAlert {
  id: string
  timestamp: string
  from: string
  to: string
  amount: number
  symbol: string
  usdValue: number
  type: 'CEX_INFLOW' | 'CEX_OUTFLOW' | 'WHALE_ACCUMULATION' | 'OTC_SETTLEMENT'
  conviction: 'HIGH' | 'MEDIUM' | 'EXTREME'
}

export interface AccountBalanceSheet {
  cashBalance: number
  equity: number
  marginUsed: number
  freeMargin: number
  marginLevelPct: number
  peakDailyEquity: number
  dailyStartEquity: number
  dailyDrawdownPct: number
  dailyDrawdownUsd: number
  isCircuitBreakerTripped: boolean
  circuitBreakerReason?: string
}

export interface RiskConfig {
  maxDailyDrawdownPct: number
  maxOpenPositions: number
  maxLeverage: number
  maxPositionSizeUsd: number
  maxSlippageTolerancePct?: number
}

export type BotType = 'SCALPER' | 'GOLD_HUNTER' | 'MACRO_SENTINEL' | 'WHALE_FLOW'
export type BotExecutionStatus = 'ACTIVE' | 'PAUSED' | 'LOCKED_BY_CIRCUIT_BREAKER'

export interface AIBotStrategy {
  id: string
  name: string
  model: string
  description: string
  status: BotExecutionStatus
  winRate: number
  tradesCount: number
  profitPct: number
  riskLevel: 'LOW' | 'MEDIUM' | 'AGGRESSIVE'
  allocationUsd: number
  targetMarket?: MarketCategory
  type?: BotType
  symbol?: string
  defaultLeverage?: number
  maxDrawdownPct?: number
  stopLossPct?: number
  takeProfitPct?: number
  trailingDistancePct?: number
  cooldownSec?: number
  maxOpenPositions?: number
  activeOrdersCount?: number
  currentDailyLossUsd?: number
  lastSignalTimestamp?: number
}

export interface UserPortfolio {
  totalBalance: number
  tradeCapital: number
  maxLoss: number
  realizedProfit: number
  dailyChangePct: number
  balances: Record<string, number>
  equity?: number
  marginUsed?: number
  freeMargin?: number
  marginLevelPct?: number
  peakDailyEquity?: number
  dailyStartEquity?: number
  dailyDrawdownPct?: number
  dailyDrawdownUsd?: number
  isCircuitBreakerTripped?: boolean
  circuitBreakerReason?: string | null
}

export interface AIMessage {
  id: string
  sender: 'ai' | 'user'
  text: string
  timestamp: string
  chartSnippet?: {
    symbol: string
    recommendation: string
    confidence: number
  }
}

export interface BacktestResult {
  totalTrades: number
  winRate: number
  profitFactor: number
  sharpeRatio: number
  sortinoRatio: number
  maxDrawdown: number
  netProfitUsd: number
  netProfitPct: number
  equityCurve: { timestamp: string; strategy: number; benchmark: number }[]
  monthlyReturns: { month: string; returnPct: number }[]
  calmarRatio?: number
  expectancyR?: number
  tradesCount?: number
}

export interface EconomicEvent {
  id: string
  time: string
  currency: string
  flag: string
  event: string
  impact: 'HIGH' | 'MEDIUM' | 'LOW'
  forecast: string
  previous: string
  actual?: string
  aiSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'VOLATILITY_ALERT'
}

export interface SMCPattern {
  id: string
  symbol: string
  timeframe: string
  patternName: string // 'Fair Value Gap (FVG)', 'Order Block (OB)', 'Liquidity Grab', 'Break of Structure'
  direction: 'BULLISH' | 'BEARISH'
  priceRange: string
  aiConfidence: number
  status: 'ACTIVE' | 'MITIGATED'
}

export interface JournalEntry {
  id: string
  date: string
  dayNumber?: number
  symbol: string
  market: MarketCategory
  side: 'BUY' | 'SELL'
  lotsOrSize: number
  entryPrice: number
  exitPrice: number
  pnl: number
  rMultiple: number
  setup: string // 'SMC Order Block', 'AI Scalp', 'Breakout', 'News Event'
  outcome: 'WIN' | 'LOSS'
  notes: string
  tag?: string
  mistake?: 'Exited early' | 'Overtraded' | 'Moved stop' | 'FOMO entered' | 'None'
  duration?: string
  fees?: number
}

export interface PriceAlert {
  id: string
  symbol: string
  targetPrice: number
  condition: 'ABOVE' | 'BELOW'
  createdAt: string
  triggered: boolean
}

export interface AISwarmSignal {
  symbol: string
  side: 'BUY' | 'SELL'
  consensusScore: number
  bias: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL'
  entryPrice: number
  slPrice: number
  tpPrice: number
  tp2Price: number
  riskReward: number
  recommendedLotsOrSize: number
  agentsAnalysis: {
    id: string
    name: string
    role: string
    conviction: number
    bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
    rationale: string
    icon: string
  }[]
}
