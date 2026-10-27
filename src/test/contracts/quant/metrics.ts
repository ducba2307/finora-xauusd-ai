/**
 * Universal Financial Math Engine Contract
 * Authoritative reference derived from PROJECT.md and ORIGINAL_REQUEST.md (R2)
 */

export function safeDivide(numerator: number, denominator: number, fallback: number = 0): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return fallback
  }
  const result = numerator / denominator
  return Number.isFinite(result) ? result : fallback
}

export function calculateSharpeRatio(
  returns: number[],
  riskFreeRate: number = 0,
  periodsPerYear: number = 252
): number {
  if (!returns || returns.length < 2) return 0

  const validReturns = returns.filter((r) => Number.isFinite(r))
  if (validReturns.length < 2) return 0

  const n = validReturns.length
  const meanReturn = validReturns.reduce((acc, r) => acc + r, 0) / n
  const periodicRf = riskFreeRate / periodsPerYear
  const excessMean = meanReturn - periodicRf

  const variance = validReturns.reduce((acc, r) => acc + Math.pow(r - meanReturn, 2), 0) / (n - 1)
  const stdDev = Math.sqrt(variance)

  if (stdDev <= 1e-8 || !Number.isFinite(stdDev)) return 0

  const annualizedSharpe = (excessMean / stdDev) * Math.sqrt(periodsPerYear)
  return Number.isFinite(annualizedSharpe) ? Number(annualizedSharpe.toFixed(4)) : 0
}

export function calculateSortinoRatio(
  returns: number[],
  mar: number = 0, // Minimum Acceptable Return
  periodsPerYear: number = 252
): number {
  if (!returns || returns.length < 2) return 0

  const validReturns = returns.filter((r) => Number.isFinite(r))
  if (validReturns.length < 2) return 0

  const n = validReturns.length
  const meanReturn = validReturns.reduce((acc, r) => acc + r, 0) / n
  const periodicMar = mar / periodsPerYear
  const excessMean = meanReturn - periodicMar

  // Downside semi-variance: only returns below MAR
  const downsideSquaredSum = validReturns.reduce((acc, r) => {
    const diff = r - periodicMar
    return diff < 0 ? acc + diff * diff : acc
  }, 0)

  const downsideVariance = downsideSquaredSum / n
  const downsideDeviation = Math.sqrt(downsideVariance)

  if (downsideDeviation <= 1e-8 || !Number.isFinite(downsideDeviation)) {
    // If no negative returns and excessMean > 0, return capped high finite ratio
    return excessMean > 0 ? 99.99 : 0
  }

  const annualizedSortino = (excessMean / downsideDeviation) * Math.sqrt(periodsPerYear)
  return Number.isFinite(annualizedSortino) ? Number(annualizedSortino.toFixed(4)) : 0
}

export function calculateCalmarRatio(
  annualizedReturnPct: number,
  maxDrawdownPct: number
): number {
  if (!Number.isFinite(annualizedReturnPct) || !Number.isFinite(maxDrawdownPct)) return 0
  const absMdd = Math.abs(maxDrawdownPct)
  if (absMdd === 0) {
    return annualizedReturnPct > 0 ? 99.99 : 0
  }
  const ratio = annualizedReturnPct / absMdd
  return Number.isFinite(ratio) ? Number(ratio.toFixed(4)) : 0
}

export function calculateMaxDrawdown(equityCurve: number[]): {
  maxDrawdownPct: number
  maxDrawdownUsd: number
  peakEquity: number
  troughEquity: number
} {
  if (!equityCurve || equityCurve.length === 0) {
    return { maxDrawdownPct: 0, maxDrawdownUsd: 0, peakEquity: 0, troughEquity: 0 }
  }

  const cleanCurve = equityCurve.filter((v) => Number.isFinite(v) && v >= 0)
  if (cleanCurve.length === 0) {
    return { maxDrawdownPct: 0, maxDrawdownUsd: 0, peakEquity: 0, troughEquity: 0 }
  }

  let peak = cleanCurve[0]
  let maxDdUsd = 0
  let maxDdPct = 0
  let peakAtMaxDd = peak
  let troughAtMaxDd = peak

  for (const equity of cleanCurve) {
    if (equity > peak) {
      peak = equity
    }
    const currentDdUsd = peak - equity
    const currentDdPct = peak > 0 ? (currentDdUsd / peak) * 100 : 0

    if (currentDdPct > maxDdPct) {
      maxDdPct = currentDdPct
      maxDdUsd = currentDdUsd
      peakAtMaxDd = peak
      troughAtMaxDd = equity
    }
  }

  return {
    maxDrawdownPct: Number.isFinite(maxDdPct) ? Number(maxDdPct.toFixed(2)) : 0,
    maxDrawdownUsd: Number.isFinite(maxDdUsd) ? Number(maxDdUsd.toFixed(2)) : 0,
    peakEquity: peakAtMaxDd,
    troughEquity: troughAtMaxDd,
  }
}

export function calculateExpectancy(
  trades: { pnl: number; rMultiple?: number; riskUsd?: number }[]
): {
  expectancyUsd: number
  expectancyR: number
  avgWinR: number
  avgLossR: number
  winRate: number
  profitFactor: number
} {
  if (!trades || trades.length === 0) {
    return {
      expectancyUsd: 0,
      expectancyR: 0,
      avgWinR: 0,
      avgLossR: 0,
      winRate: 0,
      profitFactor: 0,
    }
  }

  const validTrades = trades.filter((t) => Number.isFinite(t.pnl))
  const total = validTrades.length
  if (total === 0) {
    return { expectancyUsd: 0, expectancyR: 0, avgWinR: 0, avgLossR: 0, winRate: 0, profitFactor: 0 }
  }

  const wins = validTrades.filter((t) => t.pnl > 0)
  const losses = validTrades.filter((t) => t.pnl < 0)

  const winCount = wins.length
  const winRate = Number(((winCount / total) * 100).toFixed(2))


  const totalWinUsd = wins.reduce((acc, t) => acc + t.pnl, 0)
  const totalLossUsd = Math.abs(losses.reduce((acc, t) => acc + t.pnl, 0))
  const netPnl = validTrades.reduce((acc, t) => acc + t.pnl, 0)
  const expectancyUsd = Number((netPnl / total).toFixed(2))

  const profitFactor = totalLossUsd > 0
    ? Number((totalWinUsd / totalLossUsd).toFixed(2))
    : totalWinUsd > 0
    ? 99.99
    : 0

  // R-Multiple calculations
  const rValues = validTrades.map((t) => t.rMultiple ?? (t.riskUsd && t.riskUsd > 0 ? t.pnl / t.riskUsd : 0))
  const winRs = rValues.filter((r) => r > 0)
  const lossRs = rValues.filter((r) => r < 0)

  const avgWinR = winRs.length > 0 ? Number((winRs.reduce((a, b) => a + b, 0) / winRs.length).toFixed(2)) : 0
  const avgLossR = lossRs.length > 0 ? Number((Math.abs(lossRs.reduce((a, b) => a + b, 0)) / lossRs.length).toFixed(2)) : 0
  const expectancyR = Number((rValues.reduce((a, b) => a + b, 0) / total).toFixed(2))

  return {
    expectancyUsd,
    expectancyR,
    avgWinR,
    avgLossR,
    winRate,
    profitFactor,
  }
}

export function calculateRDistribution(
  trades: { rMultiple: number; pnl: number }[]
): {
  buckets: { bucket: string; count: number; pnl: number; pct: number; isWin?: boolean; isLoss?: boolean }[]
  skewness: number
} {
  const bucketDefs = [
    { bucket: '< -2R', min: -Infinity, max: -2, isLoss: true },
    { bucket: '-2R to -1R', min: -2, max: -1, isLoss: true },
    { bucket: '-1R to 0R', min: -1, max: 0, isLoss: true },
    { bucket: '0R to 1R', min: 0, max: 1, isWin: true },
    { bucket: '1R to 2R', min: 1, max: 2, isWin: true },
    { bucket: '2R to 3R', min: 2, max: 3, isWin: true },
    { bucket: '> 3R', min: 3, max: Infinity, isWin: true },
  ]

  if (!trades || trades.length === 0) {
    return {
      buckets: bucketDefs.map((b) => ({
        bucket: b.bucket,
        count: 0,
        pnl: 0,
        pct: 0,
        isWin: b.isWin,
        isLoss: b.isLoss,
      })),
      skewness: 0,
    }
  }

  const validTrades = trades.filter((t) => Number.isFinite(t.rMultiple))
  const total = validTrades.length

  const buckets = bucketDefs.map((b) => {
    const matching = validTrades.filter((t) => {
      if (b.min === -Infinity) return t.rMultiple < b.max
      if (b.max === Infinity) return t.rMultiple >= b.min
      return t.rMultiple >= b.min && t.rMultiple < b.max
    })
    const count = matching.length
    const pnl = Number(matching.reduce((acc, t) => acc + t.pnl, 0).toFixed(2))
    const pct = total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0
    return {
      bucket: b.bucket,
      count,
      pnl,
      pct,
      isWin: b.isWin,
      isLoss: b.isLoss,
    }
  })

  // Calculate Fisher-Pearson Skewness of R-Multiples
  let skewness = 0
  if (total >= 3) {
    const rVals = validTrades.map((t) => t.rMultiple)
    const mean = rVals.reduce((a, b) => a + b, 0) / total
    const variance = rVals.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / (total - 1)
    const stdDev = Math.sqrt(variance)

    if (stdDev > 0) {
      const m3 = rVals.reduce((acc, r) => acc + Math.pow(r - mean, 3), 0) / total
      skewness = Number((m3 / Math.pow(stdDev, 3)).toFixed(3))
    }
  }

  return { buckets, skewness }
}
