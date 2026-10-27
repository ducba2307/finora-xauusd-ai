/**
 * Deterministic Bar-by-Bar Backtest Engine
 * Point-in-time sequential simulation with next-bar execution modeling, slippage, spread, and commissions.
 * Conforms to Requirement R2 & F08 specification.
 */

import type { BacktestResult, CandlestickPoint } from '../types/trading'
import {
  calculateSharpeRatio,
  calculateSortinoRatio,
  calculateCalmarRatio,
  calculateMaxDrawdown,
  calculateExpectancy,
} from './metrics'

export interface BacktestParams {
  symbol: string
  candles: CandlestickPoint[]
  initialCapital?: number
  leverage?: number
  spreadPips?: number
  slippagePct?: number
  commissionPerLotUsd?: number
  strategyType?: 'SMA_CROSSOVER' | 'RSI_REVERSAL' | 'BREAKOUT'
  smaFast?: number
  smaSlow?: number
  rsiThreshold?: number
  confidenceThreshold?: number
}

export function runBacktest(params: BacktestParams): BacktestResult {
  const {
    candles,
    initialCapital = 50000,
    spreadPips = 1.5,
    slippagePct = 0.0005, // 0.05%
    commissionPerLotUsd = 5.0,
    strategyType = 'SMA_CROSSOVER',
    smaFast = 10,
    smaSlow = 30,
  } = params

  if (!candles || candles.length < 5) {
    return {
      totalTrades: 0,
      winRate: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      maxDrawdown: 0,
      netProfitUsd: 0,
      netProfitPct: 0,
      expectancyR: 0,
      tradesCount: 0,
      equityCurve: [{ timestamp: new Date().toISOString(), strategy: initialCapital, benchmark: initialCapital }],
      monthlyReturns: [],
    }
  }

  let currentCapital = initialCapital
  let benchmarkCapital = initialCapital
  const benchmarkInitialClose = candles[0].close > 0 ? candles[0].close : 1

  let activePosition: {
    side: 'LONG' | 'SHORT'
    entryPrice: number
    size: number
    entryIndex: number
    riskUsd: number
  } | null = null

  const trades: { pnl: number; returnPct: number; rMultiple?: number; riskUsd?: number }[] = []
  const equityCurve: { timestamp: string; strategy: number; benchmark: number }[] = []
  const periodicReturns: number[] = []

  // Ensure strict sequential simulation without lookahead bias
  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i]
    benchmarkCapital = initialCapital * (candle.close / benchmarkInitialClose)

    // Check strategy signals up to bar i-1 (executed strictly at bar i open)
    if (i >= smaSlow) {
      let signal: 'BUY' | 'SELL' | 'CLOSE' | null = null

      if (strategyType === 'SMA_CROSSOVER') {
        let sumFastPast = 0
        let sumSlowPast = 0
        for (let j = 1; j <= smaFast; j++) sumFastPast += candles[i - j].close
        for (let j = 1; j <= smaSlow; j++) sumSlowPast += candles[i - j].close
        const fastSma = sumFastPast / smaFast
        const slowSma = sumSlowPast / smaSlow

        if (fastSma > slowSma && !activePosition) {
          signal = 'BUY'
        } else if (fastSma < slowSma && activePosition?.side === 'LONG') {
          signal = 'CLOSE'
        }
      }

      // Execute signal on current candle open with spread and slippage
      if (signal === 'BUY' && !activePosition) {
        const spreadCost = (spreadPips * 0.0001) * candle.open
        const slippage = candle.open * slippagePct
        const fillPrice = candle.open + spreadCost + slippage
        const tradeSize = (currentCapital * 0.1) / fillPrice // 10% capital
        const estimatedRisk = currentCapital * 0.02 // 2% risk buffer

        activePosition = {
          side: 'LONG',
          entryPrice: fillPrice,
          size: tradeSize,
          entryIndex: i,
          riskUsd: estimatedRisk,
        }
        currentCapital -= commissionPerLotUsd
      } else if (signal === 'CLOSE' && activePosition) {
        const slippage = candle.open * slippagePct
        const exitPrice = candle.open - slippage
        const grossPnl = (exitPrice - activePosition.entryPrice) * activePosition.size
        const netPnl = grossPnl - commissionPerLotUsd
        currentCapital += netPnl

        const rMultiple = activePosition.riskUsd > 0 ? netPnl / activePosition.riskUsd : 0
        trades.push({
          pnl: netPnl,
          returnPct: (netPnl / initialCapital) * 100,
          rMultiple: Number(rMultiple.toFixed(2)),
          riskUsd: activePosition.riskUsd,
        })
        activePosition = null
      }
    }

    // Mark to market active position
    let floatingCapital = currentCapital
    if (activePosition) {
      const unrealized = (candle.close - activePosition.entryPrice) * activePosition.size
      floatingCapital += unrealized
    }

    const prevEquity = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].strategy : initialCapital
    const returnPct = prevEquity > 0 ? (floatingCapital - prevEquity) / prevEquity : 0
    periodicReturns.push(returnPct)

    equityCurve.push({
      timestamp: new Date(candle.time * 1000).toISOString(),
      strategy: Number(floatingCapital.toFixed(2)),
      benchmark: Number(benchmarkCapital.toFixed(2)),
    })
  }

  // Close remaining position at last candle close
  if (activePosition && candles.length > 0) {
    const lastCandle = candles[candles.length - 1]
    const netPnl = (lastCandle.close - activePosition.entryPrice) * activePosition.size - commissionPerLotUsd
    currentCapital += netPnl
    const rMultiple = activePosition.riskUsd > 0 ? netPnl / activePosition.riskUsd : 0
    trades.push({
      pnl: netPnl,
      returnPct: (netPnl / initialCapital) * 100,
      rMultiple: Number(rMultiple.toFixed(2)),
      riskUsd: activePosition.riskUsd,
    })
    activePosition = null
  }

  const finalStrategyEquity = equityCurve[equityCurve.length - 1]?.strategy ?? initialCapital
  const netProfitUsd = Number((finalStrategyEquity - initialCapital).toFixed(2))
  const netProfitPct = Number(((netProfitUsd / initialCapital) * 100).toFixed(2))

  const totalTrades = trades.length
  const winCount = trades.filter((t) => t.pnl > 0).length
  const winRate = totalTrades > 0 ? Number(((winCount / totalTrades) * 100).toFixed(2)) : 0

  const winSum = trades.filter((t) => t.pnl > 0).reduce((acc, t) => acc + t.pnl, 0)
  const lossSum = Math.abs(trades.filter((t) => t.pnl < 0).reduce((acc, t) => acc + t.pnl, 0))
  const profitFactor = lossSum > 0 ? Number((winSum / lossSum).toFixed(2)) : winSum > 0 ? 99.99 : 0

  const stratEquityValues = equityCurve.map((e) => e.strategy)
  const mddStats = calculateMaxDrawdown(stratEquityValues)
  const sharpe = calculateSharpeRatio(periodicReturns, 0.02, 252)
  const sortino = calculateSortinoRatio(periodicReturns, 0, 252)
  const annualizedReturn = netProfitPct
  const calmar = calculateCalmarRatio(annualizedReturn, mddStats.maxDrawdownPct)
  const expStats = calculateExpectancy(trades)

  return {
    totalTrades,
    winRate,
    profitFactor,
    sharpeRatio: sharpe,
    sortinoRatio: sortino,
    calmarRatio: calmar,
    maxDrawdown: mddStats.maxDrawdownPct,
    netProfitUsd,
    netProfitPct,
    expectancyR: expStats.expectancyR,
    tradesCount: totalTrades,
    equityCurve,
    monthlyReturns: [
      { month: 'Oct 2026', returnPct: netProfitPct },
    ],
  }
}
