import { describe, it, expect } from 'vitest'
import {
  UPCOMING_NEWS_EVENTS,
  HISTORICAL_NEWS_RECORDS,
  generatePreNewsAnalysis,
  buildStraddleBracketSetup,
} from '../../services/newsTradingEngine'

describe('News Trading Engine & Pre-News XAU/USD Quantitative Synthesizer', () => {
  it('loads high-impact macroeconomic events with shadow estimates and consensus', () => {
    expect(UPCOMING_NEWS_EVENTS.length).toBeGreaterThanOrEqual(4)
    const cpiEvent = UPCOMING_NEWS_EVENTS.find((e) => e.id === 'evt-cpi-us')
    expect(cpiEvent).toBeDefined()
    expect(cpiEvent?.title).toContain('Consumer Price Index')
    expect(cpiEvent?.forecast).toBe('0.2%')
    expect(cpiEvent?.shadowEstimate).toBe('0.18%')
    expect(cpiEvent?.impact).toBe('HIGH_IMPACT')
  })

  it('formats pre-news countdown and tracks execution phase transitions', () => {
    // 5-10m pre-news window (> 60s)
    const report5m = generatePreNewsAnalysis('evt-cpi-us', 2734.50, 462)
    expect(report5m.phase).toBe('COUNTDOWN_PRE_NEWS')
    expect(report5m.countdownText).toBe('07:42')

    // T-60s critical execution trigger window
    const report45s = generatePreNewsAnalysis('evt-cpi-us', 2734.50, 45)
    expect(report45s.phase).toBe('TACTICAL_WINDOW_T_60S')
    expect(report45s.countdownText).toBe('00:45')

    // Post-release phase
    const report0s = generatePreNewsAnalysis('evt-cpi-us', 2734.50, 0)
    expect(report0s.phase).toBe('NEWS_RELEASED')
    expect(report0s.countdownText).toBe('00:00')
  })

  it('synthesizes inverse beta relationships with DXY and US 10Y Yields', () => {
    const report = generatePreNewsAnalysis('evt-cpi-us', 2734.50, 300)
    expect(report.macroFeed.dxyIndex).toBeGreaterThan(100)
    expect(report.macroFeed.goldBetaVsDxy).toBeLessThan(0) // Negative correlation
    expect(report.macroFeed.goldBetaVsYields).toBeLessThan(0) // Negative yield correlation
    expect(report.macroFeed.realYieldStatus).toBeDefined()
  })

  it('computes Smart Money Concepts (SMC) BSL, SSL and Fair Value Gap boundaries', () => {
    const goldPrice = 2734.50
    const report = generatePreNewsAnalysis('evt-cpi-us', goldPrice, 300)

    // Buy-Side Liquidity should sit above market price
    expect(report.orderBookDepth.nearestBslPrice).toBeGreaterThan(goldPrice)
    // Sell-Side Liquidity should sit below market price
    expect(report.orderBookDepth.nearestSslPrice).toBeLessThan(goldPrice)
    expect(report.orderBookDepth.bidDepthRatio + report.orderBookDepth.askDepthRatio).toBe(100)
    expect(report.orderBookDepth.spreadPipsExpectedNews).toBeGreaterThan(report.orderBookDepth.spreadPipsNormal)
  })

  it('formulates 3 distinct tactical scenarios with valid risk/reward and order targets', () => {
    const goldPrice = 2734.50
    const report = generatePreNewsAnalysis('evt-cpi-us', goldPrice, 300)

    expect(report.scenarios).toHaveLength(3)

    // Scenario A: Bullish
    const bullish = report.scenarios.find((s) => s.id === 'SCENARIO_BULLISH')
    expect(bullish).toBeDefined()
    expect(bullish?.bias).toBe('STRONG_BULLISH')
    expect(bullish?.slPrice).toBeLessThan(goldPrice)
    expect(bullish?.tp1Price).toBeGreaterThan(goldPrice)
    expect(bullish?.tp2Price).toBeGreaterThan(bullish!.tp1Price)
    expect(bullish?.riskReward).toBeGreaterThan(2.0)

    // Scenario B: Bearish
    const bearish = report.scenarios.find((s) => s.id === 'SCENARIO_BEARISH')
    expect(bearish).toBeDefined()
    expect(bearish?.bias).toBe('BEARISH')
    expect(bearish?.slPrice).toBeGreaterThan(goldPrice)
    expect(bearish?.tp1Price).toBeLessThan(goldPrice)
    expect(bearish?.tp2Price).toBeLessThan(bearish!.tp1Price)
    expect(bearish?.riskReward).toBeGreaterThan(2.0)

    // Scenario C: Trap / Whip
    const trap = report.scenarios.find((s) => s.id === 'SCENARIO_TRAP')
    expect(trap).toBeDefined()
    expect(trap?.action).toBe('ARM_STRADDLE')

    // Total probability distribution
    const totalProb = report.scenarios.reduce((sum, s) => sum + s.probabilityPct, 0)
    expect(totalProb).toBeCloseTo(100, 1)
  })

  it('builds automated OCO Straddle Bracket setup with bounded slippage tolerance', () => {
    const goldPrice = 2734.50
    const straddle = buildStraddleBracketSetup(goldPrice, 0.5)

    expect(straddle.symbol).toBe('XAU/USD')
    expect(straddle.currentPrice).toBe(goldPrice)
    expect(straddle.buyStopPrice).toBeGreaterThan(goldPrice)
    expect(straddle.sellStopPrice).toBeLessThan(goldPrice)
    expect(straddle.buyStopPrice - goldPrice).toBeCloseTo(goldPrice - straddle.sellStopPrice, 2)
    expect(straddle.ocoEnabled).toBe(true)
    expect(straddle.maxSlippagePips).toBeLessThanOrEqual(1.0)
    expect(straddle.lots).toBe(0.5)
  })

  it('maintains historical news backtest track record with verified positive R-multiples', () => {
    expect(HISTORICAL_NEWS_RECORDS.length).toBeGreaterThanOrEqual(5)

    const winningTrades = HISTORICAL_NEWS_RECORDS.filter((r) => r.outcome === 'WIN')
    const winRate = (winningTrades.length / HISTORICAL_NEWS_RECORDS.length) * 100

    expect(winRate).toBeGreaterThanOrEqual(80)
    for (const record of HISTORICAL_NEWS_RECORDS) {
      expect(record.rMultiple).toBeGreaterThan(0)
      expect(record.actualGoldMovePips).not.toBe(0)
      expect(record.notes.length).toBeGreaterThan(10)
    }
  })
})
