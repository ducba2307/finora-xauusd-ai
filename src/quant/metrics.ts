/**
 * Universal Financial Math Engine
 * Institutional-grade statistical metrics with guaranteed finite outputs (100% NaN and Infinity immune).
 * Conforms to Requirement R2 & F06 specification.
 */

export function safeDivide(numerator: number, denominator: number, fallback: number = 0): number {
  const safeFallback = Number.isFinite(fallback) ? fallback : 0
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return safeFallback
  }
  const result = numerator / denominator
  return Number.isFinite(result) ? result : safeFallback
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
  const safePeriods = Number.isFinite(periodsPerYear) && periodsPerYear > 0 ? periodsPerYear : 252
  const safeRf = Number.isFinite(riskFreeRate) ? riskFreeRate : 0
  const periodicRf = safeRf / safePeriods
  const excessMean = meanReturn - periodicRf

  // Sample variance using Bessel's correction (n - 1)
  const sumSquaredDiff = validReturns.reduce((acc, r) => acc + Math.pow(r - meanReturn, 2), 0)
  const variance = Math.max(0, sumSquaredDiff / (n - 1))
  const stdDev = Math.sqrt(variance)

  if (stdDev <= 1e-8 || !Number.isFinite(stdDev)) return 0

  const annualizedSharpe = (excessMean / stdDev) * Math.sqrt(safePeriods)
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
  const safePeriods = Number.isFinite(periodsPerYear) && periodsPerYear > 0 ? periodsPerYear : 252
  const safeMar = Number.isFinite(mar) ? mar : 0
  const periodicMar = safeMar / safePeriods
  const excessMean = meanReturn - periodicMar

  // Downside semi-variance: only returns below MAR are penalized
  const downsideSquaredSum = validReturns.reduce((acc, r) => {
    const diff = r - periodicMar
    return diff < 0 ? acc + diff * diff : acc
  }, 0)

  const downsideVariance = Math.max(0, downsideSquaredSum / n)
  const downsideDeviation = Math.sqrt(downsideVariance)

  if (downsideDeviation <= 1e-8 || !Number.isFinite(downsideDeviation)) {
    // If no negative returns below MAR and excessMean > 0, return capped high finite ratio
    return excessMean > 0 ? 99.99 : 0
  }

  const annualizedSortino = (excessMean / downsideDeviation) * Math.sqrt(safePeriods)
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

export function calculateWinRate(winCount: number, totalCount: number): number {
  if (!Number.isFinite(winCount) || !Number.isFinite(totalCount) || totalCount <= 0) return 0
  const rate = (winCount / totalCount) * 100
  return Number.isFinite(rate) ? Number(rate.toFixed(2)) : 0
}

export function calculateProfitFactor(grossWin: number, grossLoss: number): number {
  if (!Number.isFinite(grossWin) || !Number.isFinite(grossLoss)) return 0
  const absLoss = Math.abs(grossLoss)
  if (absLoss === 0 || absLoss <= 1e-12) {
    return grossWin > 0 ? 99.99 : 0
  }
  const pf = grossWin / absLoss
  if (!Number.isFinite(pf)) {
    return grossWin > 0 ? 99.99 : 0
  }
  return Number(pf.toFixed(2))
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

  const validTrades = trades.filter((t) => t && Number.isFinite(t.pnl))
  const total = validTrades.length
  if (total === 0) {
    return { expectancyUsd: 0, expectancyR: 0, avgWinR: 0, avgLossR: 0, winRate: 0, profitFactor: 0 }
  }

  const wins = validTrades.filter((t) => t.pnl > 0)
  const losses = validTrades.filter((t) => t.pnl < 0)

  const winCount = wins.length
  const rawWinRate = (winCount / total) * 100
  const winRate = Number.isFinite(rawWinRate) ? Number(rawWinRate.toFixed(2)) : 0

  let totalWinUsd = wins.reduce((acc, t) => acc + t.pnl, 0)
  if (!Number.isFinite(totalWinUsd)) {
    totalWinUsd = Number.MAX_VALUE
  }
  let totalLossUsd = Math.abs(losses.reduce((acc, t) => acc + t.pnl, 0))
  if (!Number.isFinite(totalLossUsd)) {
    totalLossUsd = Number.MAX_VALUE
  }

  // Two-stage average recovery using scaled increments for net PnL
  let rawExpUsd = 0
  const netPnl = validTrades.reduce((acc, t) => acc + t.pnl, 0)
  if (Number.isFinite(netPnl)) {
    rawExpUsd = netPnl / total
  } else {
    rawExpUsd = validTrades.reduce((acc, t) => acc + (t.pnl / total), 0)
  }
  const expectancyUsd = Number.isFinite(rawExpUsd) ? Number(rawExpUsd.toFixed(2)) : 0

  const profitFactor = calculateProfitFactor(totalWinUsd, totalLossUsd)

  // R-Multiple calculations with division by zero guard on zero risk
  const rValues = validTrades.map((t) => {
    if (t.rMultiple !== undefined && Number.isFinite(t.rMultiple)) {
      return t.rMultiple
    }
    if (t.riskUsd !== undefined && Number.isFinite(t.riskUsd) && t.riskUsd > 0) {
      const r = safeDivide(t.pnl, t.riskUsd, 0)
      return Number.isFinite(r) ? r : 0
    }
    return 0
  })

  const winRs = rValues.filter((r) => r > 0)
  const lossRs = rValues.filter((r) => r < 0)

  let rawAvgWinR = 0
  if (winRs.length > 0) {
    const sumWinR = winRs.reduce((a, b) => a + b, 0)
    if (Number.isFinite(sumWinR)) {
      rawAvgWinR = sumWinR / winRs.length
    } else {
      rawAvgWinR = winRs.reduce((a, b) => a + (b / winRs.length), 0)
    }
  }
  const avgWinR = Number.isFinite(rawAvgWinR) ? Number(rawAvgWinR.toFixed(2)) : 0

  let rawAvgLossR = 0
  if (lossRs.length > 0) {
    const sumLossR = lossRs.reduce((a, b) => a + Math.abs(b), 0)
    if (Number.isFinite(sumLossR)) {
      rawAvgLossR = sumLossR / lossRs.length
    } else {
      rawAvgLossR = lossRs.reduce((a, b) => a + (Math.abs(b) / lossRs.length), 0)
    }
  }
  const avgLossR = Number.isFinite(rawAvgLossR) ? Number(rawAvgLossR.toFixed(2)) : 0

  let rawExpR = 0
  const sumR = rValues.reduce((a, b) => a + b, 0)
  if (Number.isFinite(sumR)) {
    rawExpR = sumR / total
  } else {
    rawExpR = rValues.reduce((a, b) => a + (b / total), 0)
  }
  const expectancyR = Number.isFinite(rawExpR) ? Number(rawExpR.toFixed(2)) : 0

  return {
    expectancyUsd,
    expectancyR,
    avgWinR,
    avgLossR,
    winRate,
    profitFactor,
  }
}

export interface RDistributionBucket {
  bucket: string
  count: number
  pnl: number
  pct: number
  isWin?: boolean
  isLoss?: boolean
}

export interface RDistributionResult {
  buckets: RDistributionBucket[]
  skewness: number
}

export function calculateRDistribution(
  trades: { rMultiple: number; pnl: number }[]
): RDistributionResult {
  const bucketDefs = [
    { bucket: '< -2R', min: -Infinity, max: -2, isLoss: true },
    { bucket: '-2R to -1R', min: -2, max: -1, isLoss: true },
    { bucket: '-1R to 0R', min: -1, max: 0, isLoss: true },
    { bucket: '0R to 1R', min: 0, max: 1, isWin: true },
    { bucket: '1R to 2R', min: 1, max: 2, isWin: true },
    { bucket: '2R to 3R', min: 2, max: 3, isWin: true },
    { bucket: '> 3R', min: 3, max: Infinity, isWin: true },
  ]

  const emptyBuckets = () =>
    bucketDefs.map((b) => ({
      bucket: b.bucket,
      count: 0,
      pnl: 0,
      pct: 0,
      isWin: b.isWin,
      isLoss: b.isLoss,
    }))

  if (!trades || trades.length === 0) {
    return {
      buckets: emptyBuckets(),
      skewness: 0,
    }
  }

  const validTrades = trades
    .filter((t) => t && Number.isFinite(t.rMultiple))
    .map((t) => ({
      rMultiple: t.rMultiple,
      pnl: Number.isFinite(t.pnl) ? t.pnl : 0,
    }))
  const total = validTrades.length

  const buckets = bucketDefs.map((b) => {
    const matching = validTrades.filter((t) => {
      if (b.min === -Infinity) return t.rMultiple < b.max
      if (b.max === Infinity) return t.rMultiple >= b.min
      return t.rMultiple >= b.min && t.rMultiple < b.max
    })
    const count = matching.length
    const rawPnl = matching.reduce((acc, t) => acc + t.pnl, 0)
    const pnl = Number.isFinite(rawPnl) ? Number(rawPnl.toFixed(2)) : 0
    const rawPct = total > 0 ? (count / total) * 100 : 0
    const pct = Number.isFinite(rawPct) ? Number(rawPct.toFixed(1)) : 0
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
    const sumSqDiff = rVals.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0)
    const variance = Math.max(0, sumSqDiff / (total - 1))
    const stdDev = Math.sqrt(variance)

    if (stdDev > 0) {
      const denom = Math.pow(stdDev, 3)
      if (denom > 0 && Number.isFinite(denom)) {
        const m3 = rVals.reduce((acc, r) => acc + Math.pow(r - mean, 3), 0) / total
        const rawSkewness = m3 / denom
        skewness = Number.isFinite(rawSkewness) ? Number(rawSkewness.toFixed(3)) : 0
      }
    }
  }

  return { buckets, skewness }
}
