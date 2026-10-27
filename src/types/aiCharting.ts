export type AIModelProvider = 'CODEX' | 'CLAUDE' | 'GEMINI'

export type ChartDrawingTool =
  | 'CURSOR'
  | 'SELECT_EXPLAIN'
  | 'TRENDLINE'
  | 'HORIZONTAL_LINE'
  | 'PRICE_ZONE'
  | 'VOLUME_PROFILE'

export type MultiChartLayout = '1x1' | '1x2' | '2x2' | '4x4'

export interface ChartPoint {
  time: number // Unix timestamp seconds
  price: number
}

export interface DrawnObject {
  id: string
  type: 'TRENDLINE' | 'HORIZONTAL_LINE' | 'PRICE_ZONE'
  symbol: string
  points: ChartPoint[]
  label?: string
  color: string
  isBreached?: boolean
  breachedAt?: number
  breachPrice?: number
  enableAiAlert: boolean
  aiProvider: AIModelProvider
  investigationReport?: AnomalyInvestigationReport
}

export interface SelectExplainRange {
  id: string
  symbol: string
  startTime: number
  endTime: number
  startPrice: number
  endPrice: number
  highPrice: number
  lowPrice: number
  changePct: number
  barsCount: number
  volumeTotal: number
  volumeRatioVsAvg: number
  investigationReport?: AnomalyInvestigationReport
}

export interface CitedSource {
  title: string
  source: string
  timestamp: string
  url: string
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  snippet: string
}

export interface AnomalyInvestigationReport {
  id: string
  symbol: string
  timeframe: string
  investigatedAt: string
  aiProvider: AIModelProvider
  primaryCatalyst: string
  summary: string
  technicalDrivers: {
    title: string
    detail: string
    impact: 'HIGH' | 'MEDIUM' | 'LOW'
  }[]
  orderFlowBreakdown: {
    cvdDivergence: string
    institutionalFlow: string
    liquidationVolumeUsd: string
    largeBlockTradesCount: number
  }
  citedSources: CitedSource[]
  confidenceScore: number
  actionableThesis: string
}

export interface VolumeProfileBin {
  priceLevel: number
  volume: number
  buyVolume: number
  sellVolume: number
  pctOfTotal: number
  isPoc: boolean
  isValueArea: boolean
}

export interface VolumeProfileData {
  symbol: string
  bins: VolumeProfileBin[]
  pocPrice: number // Point of Control
  vahPrice: number // Value Area High (70% band)
  valPrice: number // Value Area Low (70% band)
  totalVolume: number
}

export interface TeaScriptDefinition {
  id: string
  name: string
  description: string
  author: string
  code: string
  version: string
  isCompiled: boolean
  compileError?: string
  outputSignalsCount: number
  indicators: {
    name: string
    color: string
    style: 'LINE' | 'HISTOGRAM' | 'BAND'
  }[]
}

export interface NaturalLanguageMonitorRule {
  id: string
  userPrompt: string
  symbol: string
  aiProvider: AIModelProvider
  generatedTeaScript: string
  isActive: boolean
  createdAt: string
  lastEvaluatedAt?: string
  triggerCount: number
  autoInvestigateOnTrigger: boolean
  recentAlerts: {
    id: string
    timestamp: string
    price: number
    message: string
    hasInvestigation: boolean
    investigationId?: string
  }[]
}

export interface PineScriptConversionResult {
  sourcePineScript: string
  convertedTeaScript: string
  syntaxTreeValid: boolean
  warnings: string[]
  detectedIndicators: string[]
  sampleDataPlotsCount: number
}
