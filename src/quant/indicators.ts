/**
 * Point-in-Time Alpha Indicator Library
 * Zero look-ahead bias technical analysis indicators and Smart Money Concepts (SMC) zones.
 * Conforms to Requirement R2 & F07 specification.
 */

export function calculateSMA(prices: number[], period: number): number[] {
  if (!prices || prices.length === 0 || !Number.isFinite(period) || period <= 0) return []
  const safePeriod = Math.floor(period)
  if (safePeriod <= 0) return []
  const result: number[] = []

  for (let i = 0; i < prices.length; i++) {
    const currentPrice = Number.isFinite(prices[i]) ? prices[i] : 0
    if (i < safePeriod - 1) {
      result.push(currentPrice) // Initial pad
    } else {
      let sum = 0
      for (let j = 0; j < safePeriod; j++) {
        const p = prices[i - j]
        sum += Number.isFinite(p) ? p : 0
      }
      const val = sum / safePeriod
      result.push(Number.isFinite(val) ? Number(val.toFixed(4)) : currentPrice)
    }
  }

  return result
}

export function calculateEMA(prices: number[], period: number): number[] {
  if (!prices || prices.length === 0 || !Number.isFinite(period) || period <= 0) return []
  const safePeriod = Math.floor(period)
  if (safePeriod <= 0) return []
  const result: number[] = []
  const alpha = 2 / (safePeriod + 1)

  let prevEma = Number.isFinite(prices[0]) ? prices[0] : 0
  result.push(Number(prevEma.toFixed(4)))

  for (let i = 1; i < prices.length; i++) {
    const currentPrice = Number.isFinite(prices[i]) ? prices[i] : prevEma
    const currentEma = alpha * currentPrice + (1 - alpha) * prevEma
    const safeEma = Number.isFinite(currentEma) ? currentEma : prevEma
    result.push(Number(safeEma.toFixed(4)))
    prevEma = safeEma
  }

  return result
}

export function calculateRSI(prices: number[], period: number = 14): number[] {
  if (!prices || prices.length === 0 || !Number.isFinite(period) || period <= 0) return []
  if (prices.length < 2) return [50] // Default neutral

  const safePeriod = Math.floor(period)
  if (safePeriod <= 0) return []

  const result: number[] = new Array(prices.length).fill(50)
  if (prices.length <= safePeriod) return result

  let gains = 0
  let losses = 0

  // Initial average gain and loss
  for (let i = 1; i <= safePeriod; i++) {
    const curr = Number.isFinite(prices[i]) ? prices[i] : 0
    const prev = Number.isFinite(prices[i - 1]) ? prices[i - 1] : 0
    const diff = curr - prev
    if (diff > 0) gains += diff
    else losses += Math.abs(diff)
  }

  let avgGain = gains / safePeriod
  let avgLoss = losses / safePeriod

  let rsi = 50
  if (avgLoss === 0 && avgGain === 0) {
    rsi = 50
  } else if (avgLoss === 0) {
    rsi = 100
  } else if (avgGain === 0) {
    rsi = 0
  } else {
    const rs = avgGain / avgLoss
    rsi = 100 - 100 / (1 + rs)
  }
  const safeInitialRsi = Number.isFinite(rsi) ? Math.max(0, Math.min(100, rsi)) : 50
  result[safePeriod] = Number(safeInitialRsi.toFixed(2))

  // Wilder's smoothing method
  for (let i = safePeriod + 1; i < prices.length; i++) {
    const curr = Number.isFinite(prices[i]) ? prices[i] : 0
    const prev = Number.isFinite(prices[i - 1]) ? prices[i - 1] : 0
    const diff = curr - prev
    const currentGain = diff > 0 ? diff : 0
    const currentLoss = diff < 0 ? Math.abs(diff) : 0

    avgGain = (avgGain * (safePeriod - 1) + currentGain) / safePeriod
    avgLoss = (avgLoss * (safePeriod - 1) + currentLoss) / safePeriod

    if (avgLoss === 0 && avgGain === 0) {
      rsi = 50
    } else if (avgLoss === 0) {
      rsi = 100
    } else if (avgGain === 0) {
      rsi = 0
    } else {
      const rs = avgGain / avgLoss
      rsi = 100 - 100 / (1 + rs)
    }

    const safeRsi = Number.isFinite(rsi) ? Math.max(0, Math.min(100, rsi)) : 50
    result[i] = Number(safeRsi.toFixed(2))
  }

  return result
}

export interface MACDResult {
  macdLine: number[]
  signalLine: number[]
  histogram: number[]
}

export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult {
  if (!prices || prices.length === 0) {
    return { macdLine: [], signalLine: [], histogram: [] }
  }

  const safeFast = Number.isFinite(fastPeriod) && fastPeriod > 0 ? fastPeriod : 12
  const safeSlow = Number.isFinite(slowPeriod) && slowPeriod > 0 ? slowPeriod : 26
  const safeSignal = Number.isFinite(signalPeriod) && signalPeriod > 0 ? signalPeriod : 9

  const fastEma = calculateEMA(prices, safeFast)
  const slowEma = calculateEMA(prices, safeSlow)

  const macdLine = fastEma.map((f, i) => {
    const diff = f - (slowEma[i] ?? 0)
    return Number.isFinite(diff) ? Number(diff.toFixed(4)) : 0
  })
  const signalLine = calculateEMA(macdLine, safeSignal)
  const histogram = macdLine.map((m, i) => {
    const diff = m - (signalLine[i] ?? 0)
    return Number.isFinite(diff) ? Number(diff.toFixed(4)) : 0
  })

  return { macdLine, signalLine, histogram }
}

export interface BollingerBandsResult {
  upper: number[]
  middle: number[]
  lower: number[]
  bandwidth: number[]
}

export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): BollingerBandsResult {
  if (!prices || prices.length === 0 || !Number.isFinite(period) || period <= 0) {
    return { upper: [], middle: [], lower: [], bandwidth: [] }
  }

  const safePeriod = Math.floor(period)
  if (safePeriod <= 0) return { upper: [], middle: [], lower: [], bandwidth: [] }
  const safeMultiplier = Number.isFinite(stdDevMultiplier) ? stdDevMultiplier : 2

  const middle = calculateSMA(prices, safePeriod)
  const upper: number[] = []
  const lower: number[] = []
  const bandwidth: number[] = []

  for (let i = 0; i < prices.length; i++) {
    const currentPrice = Number.isFinite(prices[i]) ? prices[i] : 0
    if (i < safePeriod - 1) {
      upper.push(currentPrice)
      lower.push(currentPrice)
      bandwidth.push(0)
    } else {
      const window = prices.slice(i - safePeriod + 1, i + 1)
      const mean = middle[i] ?? currentPrice
      const variance = Math.max(
        0,
        window.reduce((acc, p) => acc + Math.pow((Number.isFinite(p) ? p : mean) - mean, 2), 0) / safePeriod
      )
      const stdDev = Math.sqrt(variance)

      const rawU = mean + safeMultiplier * stdDev
      const rawL = mean - safeMultiplier * stdDev
      const u = Number.isFinite(rawU) ? Number(rawU.toFixed(4)) : mean
      const l = Number.isFinite(rawL) ? Number(rawL.toFixed(4)) : mean

      const rawBw = mean > 1e-8 ? (((u - l) / mean) * 100) : 0
      const bw = Number.isFinite(rawBw) ? Number(rawBw.toFixed(2)) : 0

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
  if (!candles || candles.length === 0 || !Number.isFinite(period) || period <= 0) return []
  const safePeriod = Math.floor(period)
  if (safePeriod <= 0) return []

  const cleanCandle0 = {
    high: Number.isFinite(candles[0]?.high) ? candles[0].high : 0,
    low: Number.isFinite(candles[0]?.low) ? candles[0].low : 0,
    close: Number.isFinite(candles[0]?.close) ? candles[0].close : 0,
  }

  if (candles.length === 1) {
    const tr0 = Math.max(0, cleanCandle0.high - cleanCandle0.low)
    return [Number.isFinite(tr0) ? tr0 : 0]
  }

  const trs: number[] = []
  trs.push(Math.max(0, cleanCandle0.high - cleanCandle0.low))

  for (let i = 1; i < candles.length; i++) {
    const c = {
      high: Number.isFinite(candles[i]?.high) ? candles[i].high : 0,
      low: Number.isFinite(candles[i]?.low) ? candles[i].low : 0,
      close: Number.isFinite(candles[i]?.close) ? candles[i].close : 0,
    }
    const prevC = Number.isFinite(candles[i - 1]?.close) ? candles[i - 1].close : c.high
    const tr = Math.max(
      c.high - c.low,
      Math.abs(c.high - prevC),
      Math.abs(c.low - prevC)
    )
    trs.push(Number.isFinite(tr) && tr >= 0 ? tr : 0)
  }

  return calculateSMA(trs, safePeriod)
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

    if (
      !Number.isFinite(candle1?.high) ||
      !Number.isFinite(candle1?.low) ||
      !Number.isFinite(candle2?.open) ||
      !Number.isFinite(candle2?.close) ||
      !Number.isFinite(candle3?.high) ||
      !Number.isFinite(candle3?.low)
    ) {
      continue
    }

    // Bullish FVG: Low of candle 3 is higher than High of candle 1 with bullish displacement
    if (candle3.low > candle1.high && candle2.close > candle2.open) {
      const rawGap = candle3.low - candle1.high
      const gapSize = Number.isFinite(rawGap) ? Number(rawGap.toFixed(4)) : 0
      fvgs.push({
        type: 'BULLISH',
        time: candle2.time,
        top: candle3.low,
        bottom: candle1.high,
        gapSize,
        startIndex: i - 1,
      })
    }

    // Bearish FVG: High of candle 3 is lower than Low of candle 1 with bearish displacement
    if (candle3.high < candle1.low && candle2.close < candle2.open) {
      const rawGap = candle1.low - candle3.high
      const gapSize = Number.isFinite(rawGap) ? Number(rawGap.toFixed(4)) : 0
      fvgs.push({
        type: 'BEARISH',
        time: candle2.time,
        top: candle1.low,
        bottom: candle3.high,
        gapSize,
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

    if (
      !Number.isFinite(curr?.open) ||
      !Number.isFinite(curr?.close) ||
      !Number.isFinite(curr?.high) ||
      !Number.isFinite(curr?.low) ||
      !Number.isFinite(next1?.close) ||
      !Number.isFinite(next2?.close)
    ) {
      continue
    }

    // Bullish OB: Bearish candle followed by strong bullish displacement breaking structure
    if (curr.close < curr.open && next1.close > curr.high && next2.close > next1.close) {
      obs.push({
        type: 'BULLISH',
        time: curr.time,
        priceHigh: curr.high,
        priceLow: curr.low,
        volume: Number.isFinite(curr.volume) ? curr.volume : 0,
      })
    }

    // Bearish OB: Bullish candle followed by strong bearish displacement breaking structure
    if (curr.close > curr.open && next1.close < curr.low && next2.close < next1.close) {
      obs.push({
        type: 'BEARISH',
        time: curr.time,
        priceHigh: curr.high,
        priceLow: curr.low,
        volume: Number.isFinite(curr.volume) ? curr.volume : 0,
      })
    }
  }

  return obs
}

export interface SMCZonesResult {
  fvgZones: FairValueGap[]
  orderBlocks: OrderBlock[]
}

export function detectSMCZones(
  candles: { time: number; open: number; high: number; low: number; close: number; volume?: number }[]
): SMCZonesResult {
  const fvgZones = detectFairValueGaps(candles)
  const candlesWithVol = candles.map((c) => ({
    ...c,
    volume: c.volume !== undefined && Number.isFinite(c.volume) ? c.volume : 1000,
  }))
  const orderBlocks = detectOrderBlocks(candlesWithVol)
  return { fvgZones, orderBlocks }
}
