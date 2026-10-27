import type {
  EconomicNewsEvent,
  PreNewsAnalysisReport,
  HistoricalNewsRecord,
  NewsTradingScenario,
  StraddleBracketOrderSetup,
} from '../types/newsTrading'

export const UPCOMING_NEWS_EVENTS: EconomicNewsEvent[] = [
  {
    id: 'evt-cpi-us',
    title: 'US Core Consumer Price Index (CPI) MoM',
    country: 'USD',
    flag: '🇺🇸',
    impact: 'HIGH_IMPACT',
    scheduledTime: '20:30 (NY Cash Open)',
    countdownSeconds: 462, // ~7 mins 42 secs
    previous: '0.3%',
    forecast: '0.2%',
    shadowEstimate: '0.18%',
    unit: '%',
    historicalMissPct: 65,
    description: 'Primary inflation gauge tracked by the Federal Reserve. A cooler print weakens the US Dollar and triggers explosive bullish expansion in Gold (XAU/USD).',
    currencyAffected: 'USD / XAU / EUR',
  },
  {
    id: 'evt-nfp-us',
    title: 'US Non-Farm Payrolls & Unemployment Rate',
    country: 'USD',
    flag: '🇺🇸',
    impact: 'HIGH_IMPACT',
    scheduledTime: 'Tomorrow 19:30',
    countdownSeconds: 86400,
    previous: '254K',
    forecast: '147K',
    shadowEstimate: '138K',
    unit: 'K Jobs',
    historicalMissPct: 58,
    description: 'Headline labor market creation report. High deviation triggers immediate ±300 pip re-pricing on XAU/USD.',
    currencyAffected: 'USD / XAU / Global Equities',
  },
  {
    id: 'evt-fomc-fed',
    title: 'FOMC Fed Funds Rate Decision & Statement',
    country: 'USD',
    flag: '🇺🇸',
    impact: 'CRITICAL_FOMC',
    scheduledTime: 'Thursday 01:00',
    countdownSeconds: 172800,
    previous: '5.00%',
    forecast: '4.75%',
    shadowEstimate: '4.75% (-25 bps)',
    unit: '%',
    historicalMissPct: 30,
    description: 'Interest rate decision by Jerome Powell and the Federal Open Market Committee. Governs US Real Yields and sovereign Gold demand.',
    currencyAffected: 'Global Multi-Asset',
  },
  {
    id: 'evt-retail-sales',
    title: 'US Core Retail Sales MoM',
    country: 'USD',
    flag: '🇺🇸',
    impact: 'HIGH_IMPACT',
    scheduledTime: 'Friday 19:30',
    countdownSeconds: 259200,
    previous: '0.1%',
    forecast: '0.3%',
    shadowEstimate: '0.2%',
    unit: '%',
    historicalMissPct: 52,
    description: 'Direct measurement of consumer demand resilience and economic velocity.',
    currencyAffected: 'USD / Gold',
  },
]

export const HISTORICAL_NEWS_RECORDS: HistoricalNewsRecord[] = [
  {
    id: 'hist-1',
    date: 'Oct 04, 2026',
    eventName: 'US Non-Farm Payrolls',
    forecast: '147K',
    actual: '254K',
    surpriseDelta: '+107K (Extreme Beat)',
    aiPredictedBias: 'BEARISH',
    actualGoldMovePips: -325,
    outcome: 'WIN',
    rMultiple: 3.4,
    notes: 'Massive beat spiked DXY +0.72%, flushing Gold down to key M15 demand before consolidating.',
  },
  {
    id: 'hist-2',
    date: 'Sep 18, 2026',
    eventName: 'FOMC Interest Rate Decision',
    forecast: '-25 bps',
    actual: '-50 bps',
    surpriseDelta: '-25 bps (Super Dovish)',
    aiPredictedBias: 'STRONG_BULLISH',
    actualGoldMovePips: 410,
    outcome: 'WIN',
    rMultiple: 4.2,
    notes: 'Jumbo 50 bps rate cut collapsed 10Y real yields, catapulting Gold to new highs.',
  },
  {
    id: 'hist-3',
    date: 'Sep 11, 2026',
    eventName: 'US Core CPI MoM',
    forecast: '0.3%',
    actual: '0.2%',
    surpriseDelta: '-0.1% (Cooler)',
    aiPredictedBias: 'BULLISH',
    actualGoldMovePips: 215,
    outcome: 'WIN',
    rMultiple: 2.6,
    notes: 'Sub-forecast core inflation triggered immediate sweep of Buy-Side Liquidity @ $2,710.',
  },
  {
    id: 'hist-4',
    date: 'Aug 29, 2026',
    eventName: 'US Core PCE Price Index',
    forecast: '0.2%',
    actual: '0.2%',
    surpriseDelta: '0.0% (In-line)',
    aiPredictedBias: 'NEUTRAL_WHIP',
    actualGoldMovePips: -45,
    outcome: 'WIN',
    rMultiple: 1.5,
    notes: 'Initial two-way fakeout swept both sides before resuming prior session trend.',
  },
  {
    id: 'hist-5',
    date: 'Aug 14, 2026',
    eventName: 'US Producer Price Index (PPI)',
    forecast: '0.2%',
    actual: '0.1%',
    surpriseDelta: '-0.1% (Cooler)',
    aiPredictedBias: 'BULLISH',
    actualGoldMovePips: 175,
    outcome: 'WIN',
    rMultiple: 2.2,
    notes: 'Wholesale inflation slump confirmed margin expansion for bullion.',
  },
]

/**
 * 5-10m Pre-News Quantitative Synthesizer for XAU/USD
 */
export function generatePreNewsAnalysis(
  eventId: string,
  currentGoldPrice: number = 4155.50,
  secondsRemaining: number = 462
): PreNewsAnalysisReport {
  const event = UPCOMING_NEWS_EVENTS.find((e) => e.id === eventId) || UPCOMING_NEWS_EVENTS[0]

  const phase: PreNewsAnalysisReport['phase'] =
    secondsRemaining > 60
      ? 'COUNTDOWN_PRE_NEWS'
      : secondsRemaining > 0
      ? 'TACTICAL_WINDOW_T_60S'
      : 'NEWS_RELEASED'

  const minutes = Math.floor(secondsRemaining / 60)
  const secs = secondsRemaining % 60
  const countdownText = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`

  // Macro metrics
  const dxyIndex = 103.42
  const dxyChangePct = -0.18
  const us10yYield = 4.18
  const us10yYieldChangeBps = -3.2

  // Key SMC Price Levels for Gold
  const nearestBslPrice = Number((currentGoldPrice + 18.50).toFixed(2)) // Buy-Side Liquidity Pool
  const nearestSslPrice = Number((currentGoldPrice - 22.50).toFixed(2)) // Sell-Side Liquidity Pool
  const fvgLow = Number((currentGoldPrice - 5.50).toFixed(2))
  const fvgHigh = Number((currentGoldPrice - 2.00).toFixed(2))
  const fvgZone = `$${fvgLow} - $${fvgHigh}`

  // Scenario 1: Bullish Gold Impulse (Higher Conviction)
  const scenarioBullish: NewsTradingScenario = {
    id: 'SCENARIO_BULLISH',
    title: 'Scenario A: Bullish Gold Moonshot (Cooler CPI / Weak DXY)',
    bias: 'STRONG_BULLISH',
    probabilityPct: 74.2,
    macroTriggerCondition: 'CPI MoM prints <= 0.2% (Forecast: 0.2%, Previous: 0.3%)',
    action: 'BUY_MARKET_OR_DIP',
    entryZone: `$${(currentGoldPrice - 3.0).toFixed(2)} - $${currentGoldPrice.toFixed(2)}`,
    entryPriceNumber: currentGoldPrice,
    slPrice: Number((currentGoldPrice - 14.50).toFixed(2)),
    tp1Price: nearestBslPrice,
    tp2Price: Number((currentGoldPrice + 35.00).toFixed(2)),
    expectedPips: 240,
    riskReward: 2.6,
    tacticalNotes:
      `If headline prints <= 0.2%, DXY will swiftly test 103.00 support. Spot gold will aggressively hunt Buy-Side Liquidity at $${nearestBslPrice}. Enter on initial M3 dip into FVG.`,
  }

  // Scenario 2: Bearish Gold Flush
  const scenarioBearish: NewsTradingScenario = {
    id: 'SCENARIO_BEARISH',
    title: 'Scenario B: Bearish Gold Flush (Hot CPI / Hawkish Spike)',
    bias: 'BEARISH',
    probabilityPct: 18.5,
    macroTriggerCondition: 'CPI MoM prints >= 0.4% (Substantial inflation surprise)',
    action: 'SELL_BREAKDOWN',
    entryZone: `$${(currentGoldPrice - 2.0).toFixed(2)} - $${(currentGoldPrice + 2.0).toFixed(2)}`,
    entryPriceNumber: currentGoldPrice,
    slPrice: Number((currentGoldPrice + 15.00).toFixed(2)),
    tp1Price: nearestSslPrice,
    tp2Price: Number((currentGoldPrice - 36.00).toFixed(2)),
    expectedPips: 220,
    riskReward: 2.2,
    tacticalNotes:
      `Hot inflation delays Fed rate cuts, sending 10Y real yields higher. Short aggressive breakdown below $${(currentGoldPrice - 5).toFixed(0)} with targets at Sell-Side Liquidity $${nearestSslPrice}.`,
  }

  // Scenario 3: Two-Way Whip & Liquidity Sweep (Trap Warning)
  const scenarioTrap: NewsTradingScenario = {
    id: 'SCENARIO_TRAP',
    title: 'Scenario C: Two-Way Sweep Trap (Mixed Data & Spread Blowout)',
    bias: 'NEUTRAL_WHIP',
    probabilityPct: 7.3,
    macroTriggerCondition: 'Headline matches forecast (0.2%) but Core surprises or revisions clash',
    action: 'ARM_STRADDLE',
    entryZone: 'Breakout Bracket (+/- 25 pips)',
    entryPriceNumber: currentGoldPrice,
    slPrice: Number((currentGoldPrice - 6.00).toFixed(2)),
    tp1Price: nearestBslPrice,
    tp2Price: nearestSslPrice,
    expectedPips: 160,
    riskReward: 1.8,
    tacticalNotes:
      'High danger of institutional algorithms executing a stop-run on both sides within the first 60 seconds. Do NOT chase market orders; utilize automated straddle bracket or wait for post-news M5 stabilization.',
  }

  return {
    eventId: event.id,
    eventTitle: event.title,
    assetSymbol: 'XAU/USD',
    currentGoldPrice,
    countdownText,
    phase,
    primaryDirection: 'STRONG_BULLISH',
    confidenceScore: 74.2,
    macroFeed: {
      dxyIndex,
      dxyChangePct,
      dxyTrend: 'BEARISH',
      us10yYield,
      us10yYieldChangeBps,
      goldBetaVsDxy: -0.82,
      goldBetaVsYields: -0.74,
      realYieldStatus: 'Negative Real Yield Tailwinds Active',
    },
    orderBookDepth: {
      symbol: 'XAU/USD',
      bidDepthRatio: 63,
      askDepthRatio: 37,
      cvdDeltaUsd: '+$14.8M Spot Lead',
      spreadPipsNormal: 1.2,
      spreadPipsExpectedNews: 5.8,
      liquidityVoidDetected: true,
      nearestBslPrice,
      nearestSslPrice,
      fvgZone,
    },
    scenarios: [scenarioBullish, scenarioBearish, scenarioTrap],
    recommendedScenario: scenarioBullish,
    impliedVolatilityMoveUsd: 32.50,
    impliedMovePips: 325,
    riskLevel: 'EXTREME',
    aiSummary: `T-minus ${countdownText}: Pre-news quantitative telemetry for XAU/USD demonstrates a 74.2% bullish asymmetry. Used-car auctions and shelter disinflation leading indicators signal US Core CPI will print at or below 0.2%. Concurrently, spot CVD shows +$14.8M institutional accumulation off the London fix. Recommended strategy: Execute long setup targeting Buy-Side Liquidity at $${nearestBslPrice} with stop loss protected below the M15 Bullish Order Block.`,
  }
}

/**
 * Generates automated Straddle Bracket parameters (Buy Stop + Sell Stop)
 */
export function buildStraddleBracketSetup(
  currentGoldPrice: number,
  lots: number = 0.5
): StraddleBracketOrderSetup {
  const pipDistance = 2.50 // 25 pips on gold ($2.50 move)
  const slPips = 4.00 // 40 pips SL ($4.00)
  const tpPips = 9.50 // 95 pips TP ($9.50)

  return {
    symbol: 'XAU/USD',
    currentPrice: currentGoldPrice,
    buyStopPrice: Number((currentGoldPrice + pipDistance).toFixed(2)),
    sellStopPrice: Number((currentGoldPrice - pipDistance).toFixed(2)),
    slDistancePips: slPips,
    tpDistancePips: tpPips,
    lots,
    maxSlippagePips: 0.60, // 6 pips slippage tolerance
    ocoEnabled: true,
  }
}
