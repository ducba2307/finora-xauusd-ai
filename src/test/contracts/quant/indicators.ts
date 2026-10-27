/**
 * Point-in-Time Alpha Indicator Library Contract
 * Authoritative reference derived from PROJECT.md (F07) and ORIGINAL_REQUEST.md (R2)
 */

export function calculateSMA(prices: number[], period: number): number[] {
  if (!prices || prices.length === 0 || period <= 0) return []
  const result: number[] = []

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(prices[i]) // Pad with initial prices or prefix
    } else {
      let sum = 0
      for (let j = 0; j < period; j++) {
        sum += prices[i - j]
      }
      result.push(Number((sum / period).toFixed(4)))
    }
  }

  return result
}

export function calculateEMA(prices: number[], period: number): number[] {
  if (!prices || prices.length === 0 || period <= 0) return []
  const result: number[] = []
  const alpha = 2 / (period + 1)

  let prevEma = prices[0]
  result.push(prevEma)

  for (let i = 1; i < prices.length; i++) {
    const currentPrice = prices[i]
    const currentEma = alpha * currentPrice + (1 - alpha) * prevEma
    result.push(Number(currentEma.toFixed(4)))
    prevEma = currentEma
  }

  return result
}

export function calculateRSI(prices: number[], period: number = 14): number[] {
  if (!prices || prices.length === 0 || period <= 0) return []
  if (prices.length < 2) return [50] // Default neutral

  const result: number[] = new Array(prices.length).fill(50)
  if (prices.length <= period) return result

  let gains = 0
  let losses = 0

  // Initial average gain and loss
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1]
    if (diff > 0) gains += diff
    else losses += Math.abs(diff)
  }

  let avgGain = gains / period
  let avgLoss = losses / period

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss
  let rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs)
  result[period] = Number(Math.max(0, Math.min(100, rsi)).toFixed(2))

  // Wilder's smoothing method
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1]
    const currentGain = diff > 0 ? diff : 0
    const currentLoss = diff < 0 ? Math.abs(diff) : 0

    avgGain = (avgGain * (period - 1) + currentGain) / period
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period

    if (avgLoss === 0) {
      rsi = 100
    } else {
      rs = avgGain / avgLoss
      rsi = 100 - 100 / (1 + rs)
    }

    result[i] = Number(Math.max(0, Math.min(100, rsi)).toFixed(2))
  }

  return result
}

export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): {
  macdLine: number[]
  signalLine: number[]
  histogram: number[]
} {
  if (!prices || prices.length === 0) {
    return { macdLine: [], signalLine: [], histogram: [] }
  }

  const fastEma = calculateEMA(prices, fastPeriod)
  const slowEma = calculateEMA(prices, slowPeriod)

  const macdLine = fastEma.map((f, i) => Number((f - (slowEma[i] ?? 0)).toFixed(4)))
  const signalLine = calculateEMA(macdLine, signalPeriod)
  const histogram = macdLine.map((m, i) => Number((m - (signalLine[i] ?? 0)).toFixed(4)))

  return { macdLine, signalLine, histogram }
}

export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): {
  upper: number[]
  middle: number[]
  lower: number[]
  bandwidth: number[]
} {
  if (!prices || prices.length === 0 || period <= 0) {
    return { upper: [], middle: [], lower: [], bandwidth: [] }
  }

  const middle = calculateSMA(prices, period)
  const upper: number[] = []
  const lower: number[] = []
  const bandwidth: number[] = []

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      upper.push(prices[i])
      lower.push(prices[i])
      bandwidth.push(0)
    } else {
      const window = prices.slice(i - period + 1, i + 1)
      const mean = middle[i]
      const variance = window.reduce((acc, p) => acc + Math.pow(p - mean, 2), 0) / period
      const stdDev = Math.sqrt(variance)

      const u = Number((mean + stdDevMultiplier * stdDev).toFixed(4))
      const l = Number((mean - stdDevMultiplier * stdDev).toFixed(4))
      const bw = mean > 0 ? Number((((u - l) / mean) * 100).toFixed(2)) : 0

      upper.push(u)
      lower.push(l)
      bandwidth.push(bw)
    }
  }

  return { upper, middle, lower, bandwidth }
}

export function calculateATR(
  candles: { high: number; low: number; close: number }[],
  period: number = 14
): number[] {
  if (!candles || candles.length === 0 || period <= 0) return []
  if (candles.length === 1) return [candles[0].high - candles[0].low]

  const trs: number[] = []
  trs.push(candles[0].high - candles[0].low)

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]
    const prevC = candles[i - 1].close
    const tr = Math.max(
      c.high - c.low,
      Math.abs(c.high - prevC),
      Math.abs(c.low - prevC)
    )
    trs.push(tr)
  }

  return calculateSMA(trs, period)
}

export interface FairValueGap {
  type: 'BULLISH' | 'BEARISH'
  time: number
  top: number
  bottom: number
  gapSize: number
  startIndex: number
}

export function detectFairValueGaps(
  candles: { time: number; open: number; high: number; low: number; close: number }[]
): FairValueGap[] {
  const fvgs: FairValueGap[] = []
  if (!candles || candles.length < 3) return fvgs

  for (let i = 2; i < candles.length; i++) {
    const candle1 = candles[i - 2]
    const candle2 = candles[i - 1] // displacement candle
    const candle3 = candles[i]

    // Bullish FVG: Low of candle 3 is higher than High of candle 1
    if (candle3.low > candle1.high && candle2.close > candle2.open) {
      fvgs.push({
        type: 'BULLISH',
        time: candle2.time,
        top: candle3.low,
        bottom: candle1.high,
        gapSize: Number((candle3.low - candle1.high).toFixed(4)),
        startIndex: i - 1,
      })
    }

    // Bearish FVG: High of candle 3 is lower than Low of candle 1
    if (candle3.high < candle1.low && candle2.close < candle2.open) {
      fvgs.push({
        type: 'BEARISH',
        time: candle2.time,
        top: candle1.low,
        bottom: candle3.high,
        gapSize: Number((candle1.low - candle3.high).toFixed(4)),
        startIndex: i - 1,
      })
    }
  }

  return fvgs
}

export interface OrderBlock {
  type: 'BULLISH' | 'BEARISH'
  time: number
  priceHigh: number
  priceLow: number
  volume: number
}

export function detectOrderBlocks(
  candles: { time: number; open: number; high: number; low: number; close: number; volume: number }[]
): OrderBlock[] {
  const obs: OrderBlock[] = []
  if (!candles || candles.length < 4) return obs

  for (let i = 1; i < candles.length - 2; i++) {
    const curr = candles[i]
    const next1 = candles[i + 1]
    const next2 = candles[i + 2]


    // Bullish OB: Bearish candle followed by strong bullish displacement breaking structure
    if (curr.close < curr.open && next1.close > curr.high && next2.close > next1.close) {
      obs.push({
        type: 'BULLISH',
        time: curr.time,
        priceHigh: curr.high,
        priceLow: curr.low,
        volume: curr.volume,
      })
    }

    // Bearish OB: Bullish candle followed by strong bearish displacement breaking structure
    if (curr.close > curr.open && next1.close < curr.low && next2.close < next1.close) {
      obs.push({
        type: 'BEARISH',
        time: curr.time,
        priceHigh: curr.high,
        priceLow: curr.low,
        volume: curr.volume,
      })
    }
  }

  return obs
}
