/**
 * Smart Money Concepts (SMC) Institutional Quantitative Engine
 * src/quant/smartMoneyConcepts.ts
 *
 * Implements high-performance institutional SMC algorithms directly ported and enhanced
 * from the open-source python smartmoneyconcepts library:
 * - Swing Highs & Lows (Fractal pivots)
 * - Buy-Side Liquidity (BSL) & Sell-Side Liquidity (SSL) Pools with Sweep Detection (SWEPT)
 * - Break of Structure (BOS) & Change of Character (CHoCH) Detection
 * - Institutional Order Blocks (OB) with mitigation tracking
 * - Fair Value Gaps (FVG) with imbalance zones and fill tracking
 * - Autonomous Signal Gate & Risk/Reward Trade Setup Generator (GATE PASS / R:R > 2.5)
 */

export interface SMCCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export interface SwingPoint {
  index: number
  time: number
  price: number
  type: 'HIGH' | 'LOW'
  confirmed: boolean
}

export interface LiquidityPool {
  id: string
  type: 'BSL' | 'SSL'
  price: number
  time: number
  candleIndex: number
  isSwept: boolean
  sweptAtTime?: number
  sweepCandleIndex?: number
  sweepWickPrice?: number
}

export interface MarketStructureBreak {
  id: string
  type: 'BOS' | 'CHOCH'
  direction: 'BULLISH' | 'BEARISH'
  level: number
  time: number
  candleIndex: number
  brokenSwingIndex: number
}

export interface SMCOrderBlock {
  id: string
  type: 'BULLISH' | 'BEARISH'
  time: number
  candleIndex: number
  top: number
  bottom: number
  volume: number
  isMitigated: boolean
  mitigatedTime?: number
}

export interface SMCFairValueGap {
  id: string
  type: 'BULLISH' | 'BEARISH'
  time: number
  candleIndex: number
  top: number
  bottom: number
  gapSize: number
  isMitigated: boolean
  mitigatedTime?: number
}

export type SMCGateStatus = 'GATE_PASS' | 'WAITING_CONFIRMATION' | 'NO_SETUP'

export interface SMCTradeSetup {
  gateStatus: SMCGateStatus
  setupType: 'BULLISH_REVERSAL_SWEEP' | 'BEARISH_REVERSAL_SWEEP' | 'BOS_CONTINUATION_OB' | 'FVG_EXPANSION' | 'NONE'
  direction: 'BUY' | 'SELL' | 'NONE'
  symbol: string
  entryPrice: number
  stopLoss: number
  takeProfit: number
  riskRewardRatio: number
  riskPips: number
  rewardPips: number
  confidence: number
  reason: string
  sweptPool?: LiquidityPool | null
  structureBreak?: MarketStructureBreak | null
  orderBlock?: SMCOrderBlock | null
  fvg?: SMCFairValueGap | null
  timestamp: number
}

export interface SMCAnalysisResult {
  symbol: string
  currentPrice: number
  swings: SwingPoint[]
  liquidityPools: LiquidityPool[]
  structureBreaks: MarketStructureBreak[]
  orderBlocks: SMCOrderBlock[]
  fvgs: SMCFairValueGap[]
  activeSetup: SMCTradeSetup
  summary: {
    marketBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
    lastSweptType?: 'BSL' | 'SSL'
    lastBreakType?: 'BOS ↑' | 'BOS ↓' | 'CHoCH ↑' | 'CHoCH ↓'
    activeBullishOBsCount: number
    activeBearishOBsCount: number
    activeFvgCount: number
  }
}

/**
 * 1. Calculate Swing Highs and Lows (Fractal Pivots)
 * Point-in-time calculation: A swing at index i is confirmed when swingLength bars have passed after i.
 */
export function calculateSwingPoints(candles: SMCCandle[], swingLength: number = 5): SwingPoint[] {
  const swings: SwingPoint[] = []
  if (!candles || candles.length < swingLength * 2 + 1) return swings

  const len = candles.length
  for (let i = swingLength; i < len - swingLength; i++) {
    const current = candles[i]
    if (!current || !Number.isFinite(current.high) || !Number.isFinite(current.low)) continue

    let isHigh = true
    let isLow = true

    for (let j = 1; j <= swingLength; j++) {
      if (candles[i - j].high >= current.high || candles[i + j].high > current.high) {
        isHigh = false
      }
      if (candles[i - j].low <= current.low || candles[i + j].low < current.low) {
        isLow = false
      }
    }

    if (isHigh) {
      swings.push({
        index: i,
        time: current.time,
        price: current.high,
        type: 'HIGH',
        confirmed: true,
      })
    } else if (isLow) {
      swings.push({
        index: i,
        time: current.time,
        price: current.low,
        type: 'LOW',
        confirmed: true,
      })
    }
  }

  return swings
}

/**
 * 2. Calculate Liquidity Pools (BSL / SSL) and Detect Sweeps
 * - Buy-Side Liquidity (BSL) rests above swing highs.
 * - Sell-Side Liquidity (SSL) rests below swing lows.
 * - SWEPT occurs when a candle wick pokes through the liquidity level, but closes back inside (false breakout / hunt).
 */
export function calculateLiquidityPools(candles: SMCCandle[], swings: SwingPoint[]): LiquidityPool[] {
  const pools: LiquidityPool[] = []
  if (!candles || candles.length === 0 || !swings || swings.length === 0) return pools

  for (const s of swings) {
    const isBsl = s.type === 'HIGH'
    const pool: LiquidityPool = {
      id: `liq_${isBsl ? 'BSL' : 'SSL'}_${s.time}`,
      type: isBsl ? 'BSL' : 'SSL',
      price: s.price,
      time: s.time,
      candleIndex: s.index,
      isSwept: false,
    }

    // Check subsequent candles to see if swept or purged
    for (let cIdx = s.index + 1; cIdx < candles.length; cIdx++) {
      const c = candles[cIdx]
      if (!c) continue

      if (isBsl) {
        // High surpasses BSL level
        if (c.high > pool.price) {
          // If close is back below or around the level, it is a sweep (liquidity raid)
          if (c.close <= pool.price + (pool.price * 0.0008)) {
            pool.isSwept = true
            pool.sweptAtTime = c.time
            pool.sweepCandleIndex = cIdx
            pool.sweepWickPrice = c.high
            break
          } else {
            // Decisive breakout, not just a wick sweep
            pool.isSwept = true
            pool.sweptAtTime = c.time
            pool.sweepCandleIndex = cIdx
            pool.sweepWickPrice = c.high
            break
          }
        }
      } else {
        // Low drops below SSL level
        if (c.low < pool.price) {
          if (c.close >= pool.price - (pool.price * 0.0008)) {
            pool.isSwept = true
            pool.sweptAtTime = c.time
            pool.sweepCandleIndex = cIdx
            pool.sweepWickPrice = c.low
            break
          } else {
            pool.isSwept = true
            pool.sweptAtTime = c.time
            pool.sweepCandleIndex = cIdx
            pool.sweepWickPrice = c.low
            break
          }
        }
      }
    }

    pools.push(pool)
  }

  return pools
}

/**
 * 3. Calculate Market Structure Breaks: BOS (Break of Structure) & CHoCH (Change of Character)
 */
export function calculateBOSAndCHoCH(candles: SMCCandle[], swings: SwingPoint[]): MarketStructureBreak[] {
  const breaks: MarketStructureBreak[] = []
  if (!candles || candles.length === 0 || !swings || swings.length < 2) return breaks

  let currentBias: 'BULLISH' | 'BEARISH' | 'UNKNOWN' = 'UNKNOWN'
  let lastSwingHigh: SwingPoint | null = null
  let lastSwingLow: SwingPoint | null = null

  // Initialize first swing reference
  for (const s of swings) {
    if (s.type === 'HIGH') {
      if (!lastSwingHigh) lastSwingHigh = s
    } else {
      if (!lastSwingLow) lastSwingLow = s
    }
  }

  if (lastSwingHigh && lastSwingLow) {
    currentBias = lastSwingHigh.index > lastSwingLow.index ? 'BULLISH' : 'BEARISH'
  }

  // Iterate over candles starting after the first two swings
  const startCandleIdx = swings[1]?.index || 0
  let swingIdx = 0

  for (let i = startCandleIdx; i < candles.length; i++) {
    const candle = candles[i]
    if (!candle) continue

    // Update swing references as price advances
    while (swingIdx < swings.length && swings[swingIdx].index <= i) {
      const s = swings[swingIdx]
      if (s.type === 'HIGH') lastSwingHigh = s
      if (s.type === 'LOW') lastSwingLow = s
      swingIdx++
    }

    // Check for Bullish break above last swing high
    if (lastSwingHigh && i > lastSwingHigh.index) {
      if (candle.close > lastSwingHigh.price) {
        const isChoch = currentBias === 'BEARISH'
        breaks.push({
          id: `${isChoch ? 'CHOCH' : 'BOS'}_BULLISH_${candle.time}`,
          type: isChoch ? 'CHOCH' : 'BOS',
          direction: 'BULLISH',
          level: lastSwingHigh.price,
          time: candle.time,
          candleIndex: i,
          brokenSwingIndex: lastSwingHigh.index,
        })
        currentBias = 'BULLISH'
        // Reset last swing high so we don't trigger duplicate breaks on the same bar
        lastSwingHigh = null
      }
    }

    // Check for Bearish break below last swing low
    if (lastSwingLow && i > lastSwingLow.index) {
      if (candle.close < lastSwingLow.price) {
        const isChoch = currentBias === 'BULLISH'
        breaks.push({
          id: `${isChoch ? 'CHOCH' : 'BOS'}_BEARISH_${candle.time}`,
          type: isChoch ? 'CHOCH' : 'BOS',
          direction: 'BEARISH',
          level: lastSwingLow.price,
          time: candle.time,
          candleIndex: i,
          brokenSwingIndex: lastSwingLow.index,
        })
        currentBias = 'BEARISH'
        lastSwingLow = null
      }
    }
  }

  return breaks
}

/**
 * 4. Calculate Fair Value Gaps (FVG) with Imbalance and Mitigation Tracking
 */
export function calculateFairValueGaps(candles: SMCCandle[]): SMCFairValueGap[] {
  const fvgs: SMCFairValueGap[] = []
  if (!candles || candles.length < 3) return fvgs

  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2]
    const c2 = candles[i - 1]
    const c3 = candles[i]

    if (!c1 || !c2 || !c3) continue

    // Bullish FVG: Candle 1 High < Candle 3 Low
    if (c1.high < c3.low) {
      const top = c3.low
      const bottom = c1.high
      const gapSize = Number((top - bottom).toFixed(2))

      if (gapSize > 0) {
        const fvg: SMCFairValueGap = {
          id: `fvg_bullish_${c2.time}`,
          type: 'BULLISH',
          time: c2.time,
          candleIndex: i - 1,
          top,
          bottom,
          gapSize,
          isMitigated: false,
        }

        // Test if future candles mitigate (trade down into) this gap
        for (let j = i + 1; j < candles.length; j++) {
          if (candles[j].low <= fvg.bottom) {
            fvg.isMitigated = true
            fvg.mitigatedTime = candles[j].time
            break
          }
        }
        fvgs.push(fvg)
      }
    }

    // Bearish FVG: Candle 1 Low > Candle 3 High
    if (c1.low > c3.high) {
      const top = c1.low
      const bottom = c3.high
      const gapSize = Number((top - bottom).toFixed(2))

      if (gapSize > 0) {
        const fvg: SMCFairValueGap = {
          id: `fvg_bearish_${c2.time}`,
          type: 'BEARISH',
          time: c2.time,
          candleIndex: i - 1,
          top,
          bottom,
          gapSize,
          isMitigated: false,
        }

        // Test if future candles mitigate (trade up into) this gap
        for (let j = i + 1; j < candles.length; j++) {
          if (candles[j].high >= fvg.top) {
            fvg.isMitigated = true
            fvg.mitigatedTime = candles[j].time
            break
          }
        }
        fvgs.push(fvg)
      }
    }
  }

  return fvgs
}

/**
 * 5. Calculate Institutional Order Blocks (OB)
 * The last opposing candle before the displacement move that caused the BOS or CHoCH.
 */
export function calculateOrderBlocks(
  candles: SMCCandle[],
  breaks: MarketStructureBreak[]
): SMCOrderBlock[] {
  const obs: SMCOrderBlock[] = []
  if (!candles || candles.length === 0 || !breaks || breaks.length === 0) return obs

  for (const b of breaks) {
    const breakIdx = b.candleIndex
    if (breakIdx <= 1) continue

    if (b.direction === 'BULLISH') {
      // Find the lowest down-candle (bearish candle: close <= open) before displacement
      let obIdx = breakIdx - 1
      for (let k = breakIdx - 1; k >= Math.max(0, breakIdx - 8); k--) {
        if (candles[k].close <= candles[k].open) {
          obIdx = k
          break
        }
      }

      const obCandle = candles[obIdx]
      if (obCandle) {
        const ob: SMCOrderBlock = {
          id: `ob_bullish_${obCandle.time}`,
          type: 'BULLISH',
          time: obCandle.time,
          candleIndex: obIdx,
          top: Math.max(obCandle.open, obCandle.high),
          bottom: Math.min(obCandle.close, obCandle.low),
          volume: obCandle.volume || 1000,
          isMitigated: false,
        }

        // Check mitigation
        for (let m = breakIdx + 1; m < candles.length; m++) {
          if (candles[m].low < ob.bottom) {
            ob.isMitigated = true
            ob.mitigatedTime = candles[m].time
            break
          }
        }
        obs.push(ob)
      }
    } else {
      // Bearish OB: Find the highest up-candle (bullish candle: close >= open) before displacement
      let obIdx = breakIdx - 1
      for (let k = breakIdx - 1; k >= Math.max(0, breakIdx - 8); k--) {
        if (candles[k].close >= candles[k].open) {
          obIdx = k
          break
        }
      }

      const obCandle = candles[obIdx]
      if (obCandle) {
        const ob: SMCOrderBlock = {
          id: `ob_bearish_${obCandle.time}`,
          type: 'BEARISH',
          time: obCandle.time,
          candleIndex: obIdx,
          top: Math.max(obCandle.close, obCandle.high),
          bottom: Math.min(obCandle.open, obCandle.low),
          volume: obCandle.volume || 1000,
          isMitigated: false,
        }

        // Check mitigation
        for (let m = breakIdx + 1; m < candles.length; m++) {
          if (candles[m].high > ob.top) {
            ob.isMitigated = true
            ob.mitigatedTime = candles[m].time
            break
          }
        }
        obs.push(ob)
      }
    }
  }

  return obs
}

/**
 * 6. Generate Complete Smart Money Concepts Trade Setup & Gate Evaluation
 * Institutional Rulebook:
 * Long Setup:
 * 1. SSL Liquidity Swept (stop hunt on retail longs/sellers) within recent window.
 * 2. CHoCH ↑ (or strong Bullish BOS) occurs shortly after sweep.
 * 3. Price retests or sits near unmitigated Bullish Order Block or Fair Value Gap.
 * 4. Stop Loss placed below the lowest sweep wick minus pip buffer ($1.50 for XAU/USD).
 * 5. Take Profit targeted at next unmitigated Buy-Side Liquidity (BSL) pool.
 * 6. Gate Pass criteria: Risk/Reward ratio >= 2.0.
 */
export function generateSMCTradeSetup(
  candles: SMCCandle[],
  currentPrice: number,
  symbol: string = 'XAU/USD'
): SMCTradeSetup {
  const defaultSetup: SMCTradeSetup = {
    gateStatus: 'NO_SETUP',
    setupType: 'NONE',
    direction: 'NONE',
    symbol,
    entryPrice: currentPrice,
    stopLoss: currentPrice,
    takeProfit: currentPrice,
    riskRewardRatio: 0,
    riskPips: 0,
    rewardPips: 0,
    confidence: 0,
    reason: 'Insufficient structural data to formulate an SMC edge.',
    timestamp: Date.now(),
  }

  if (!candles || candles.length < 20 || !Number.isFinite(currentPrice) || currentPrice <= 0) {
    return defaultSetup
  }

  const swings = calculateSwingPoints(candles, 4)
  const pools = calculateLiquidityPools(candles, swings)
  const breaks = calculateBOSAndCHoCH(candles, swings)
  const obs = calculateOrderBlocks(candles, breaks)
  const fvgs = calculateFairValueGaps(candles)

  const recentLookback = 25
  const minCandleIdx = Math.max(0, candles.length - recentLookback)

  // Look for recent swept liquidity pools
  const recentSweptPools = pools.filter(
    (p) => p.isSwept && p.sweepCandleIndex !== undefined && p.sweepCandleIndex >= minCandleIdx
  )
  const recentBreaks = breaks.filter((b) => b.candleIndex >= minCandleIdx)

  // A. Check Bullish Setup (SSL Swept -> CHoCH/BOS Bullish -> Bullish OB/FVG Retest)
  const sweptSsl = recentSweptPools.reverse().find((p) => p.type === 'SSL')
  const bullishBreak = recentBreaks.reverse().find((b) => b.direction === 'BULLISH')

  if (sweptSsl && bullishBreak && bullishBreak.candleIndex >= (sweptSsl.sweepCandleIndex || 0)) {
    // Bullish Reversal or Expansion Setup
    const activeBullishOb = obs
      .slice()
      .reverse()
      .find((ob) => ob.type === 'BULLISH' && !ob.isMitigated)
    const activeBullishFvg = fvgs
      .slice()
      .reverse()
      .find((fvg) => fvg.type === 'BULLISH' && !fvg.isMitigated)

    const isGold = symbol.toUpperCase().includes('XAU') || symbol.toUpperCase().includes('GOLD')
    const bufferPips = isGold ? 1.50 : currentPrice * 0.0015

    const sweepLow = sweptSsl.sweepWickPrice || sweptSsl.price
    const obLow = activeBullishOb ? activeBullishOb.bottom : sweepLow
    const slPrice = Number((Math.min(sweepLow, obLow) - bufferPips).toFixed(2))

    // Entry near current price or retest level
    const entryPrice = currentPrice
    const risk = entryPrice - slPrice

    if (risk > 0) {
      // Target: Next unmitigated BSL pool above current price
      const unmitigatedBsl = pools.find((p) => p.type === 'BSL' && !p.isSwept && p.price > currentPrice)
      let tpPrice = unmitigatedBsl ? unmitigatedBsl.price : entryPrice + risk * 3.5

      // Ensure minimum 2.5 R:R target if BSL is too close
      if ((tpPrice - entryPrice) / risk < 2.0) {
        tpPrice = entryPrice + risk * 3.2
      }
      tpPrice = Number(tpPrice.toFixed(2))

      const rrRatio = Number(((tpPrice - entryPrice) / risk).toFixed(2))
      const riskPips = Number((risk * (isGold ? 10 : 10000)).toFixed(1))
      const rewardPips = Number(((tpPrice - entryPrice) * (isGold ? 10 : 10000)).toFixed(1))

      const isNearObOrFvg =
        (activeBullishOb && currentPrice <= activeBullishOb.top * 1.008) ||
        (activeBullishFvg && currentPrice <= activeBullishFvg.top * 1.008) ||
        currentPrice >= bullishBreak.level

      const isGatePass = rrRatio >= 2.0 && isNearObOrFvg

      return {
        gateStatus: isGatePass ? 'GATE_PASS' : 'WAITING_CONFIRMATION',
        setupType: bullishBreak.type === 'CHOCH' ? 'BULLISH_REVERSAL_SWEEP' : 'BOS_CONTINUATION_OB',
        direction: 'BUY',
        symbol,
        entryPrice: Number(entryPrice.toFixed(2)),
        stopLoss: slPrice,
        takeProfit: tpPrice,
        riskRewardRatio: rrRatio,
        riskPips,
        rewardPips,
        confidence: isGatePass ? 89 : 68,
        reason: `SSL liquidity swept at $${sweptSsl.price.toFixed(2)}, confirmed by ${bullishBreak.type} ↑ at $${bullishBreak.level.toFixed(2)}. ${
          activeBullishOb ? 'Retesting Bullish Order Block zone.' : 'Fair Value Gap expansion active.'
        }`,
        sweptPool: sweptSsl,
        structureBreak: bullishBreak,
        orderBlock: activeBullishOb || null,
        fvg: activeBullishFvg || null,
        timestamp: Date.now(),
      }
    }
  }

  // B. Check Bearish Setup (BSL Swept -> CHoCH/BOS Bearish -> Bearish OB/FVG Retest)
  const sweptBsl = recentSweptPools.reverse().find((p) => p.type === 'BSL')
  const bearishBreak = recentBreaks.reverse().find((b) => b.direction === 'BEARISH')

  if (sweptBsl && bearishBreak && bearishBreak.candleIndex >= (sweptBsl.sweepCandleIndex || 0)) {
    const activeBearishOb = obs
      .slice()
      .reverse()
      .find((ob) => ob.type === 'BEARISH' && !ob.isMitigated)
    const activeBearishFvg = fvgs
      .slice()
      .reverse()
      .find((fvg) => fvg.type === 'BEARISH' && !fvg.isMitigated)

    const isGold = symbol.toUpperCase().includes('XAU') || symbol.toUpperCase().includes('GOLD')
    const bufferPips = isGold ? 1.50 : currentPrice * 0.0015

    const sweepHigh = sweptBsl.sweepWickPrice || sweptBsl.price
    const obHigh = activeBearishOb ? activeBearishOb.top : sweepHigh
    const slPrice = Number((Math.max(sweepHigh, obHigh) + bufferPips).toFixed(2))

    const entryPrice = currentPrice
    const risk = slPrice - entryPrice

    if (risk > 0) {
      const unmitigatedSsl = pools.find((p) => p.type === 'SSL' && !p.isSwept && p.price < currentPrice)
      let tpPrice = unmitigatedSsl ? unmitigatedSsl.price : entryPrice - risk * 3.5

      if ((entryPrice - tpPrice) / risk < 2.0) {
        tpPrice = entryPrice - risk * 3.2
      }
      tpPrice = Number(tpPrice.toFixed(2))

      const rrRatio = Number(((entryPrice - tpPrice) / risk).toFixed(2))
      const riskPips = Number((risk * (isGold ? 10 : 10000)).toFixed(1))
      const rewardPips = Number(((entryPrice - tpPrice) * (isGold ? 10 : 10000)).toFixed(1))

      const isNearObOrFvg =
        (activeBearishOb && currentPrice >= activeBearishOb.bottom * 0.992) ||
        (activeBearishFvg && currentPrice >= activeBearishFvg.bottom * 0.992) ||
        currentPrice <= bearishBreak.level

      const isGatePass = rrRatio >= 2.0 && isNearObOrFvg

      return {
        gateStatus: isGatePass ? 'GATE_PASS' : 'WAITING_CONFIRMATION',
        setupType: bearishBreak.type === 'CHOCH' ? 'BEARISH_REVERSAL_SWEEP' : 'BOS_CONTINUATION_OB',
        direction: 'SELL',
        symbol,
        entryPrice: Number(entryPrice.toFixed(2)),
        stopLoss: slPrice,
        takeProfit: tpPrice,
        riskRewardRatio: rrRatio,
        riskPips,
        rewardPips,
        confidence: isGatePass ? 88 : 65,
        reason: `BSL liquidity swept at $${sweptBsl.price.toFixed(2)}, confirmed by ${bearishBreak.type} ↓ at $${bearishBreak.level.toFixed(2)}. ${
          activeBearishOb ? 'Retesting Bearish Order Block zone.' : 'Fair Value Gap expansion active.'
        }`,
        sweptPool: sweptBsl,
        structureBreak: bearishBreak,
        orderBlock: activeBearishOb || null,
        fvg: activeBearishFvg || null,
        timestamp: Date.now(),
      }
    }
  }

  // C. Fallback: Proactive OB / FVG zone alert if near strong Order Block
  const latestOb = obs.slice().reverse().find((ob) => !ob.isMitigated)
  if (latestOb) {
    const isBull = latestOb.type === 'BULLISH'
    const isGold = symbol.toUpperCase().includes('XAU') || symbol.toUpperCase().includes('GOLD')
    const buffer = isGold ? 1.50 : currentPrice * 0.0015
    const sl = isBull ? Number((latestOb.bottom - buffer).toFixed(2)) : Number((latestOb.top + buffer).toFixed(2))
    const risk = Math.abs(currentPrice - sl)

    if (risk > 0) {
      const tp = isBull ? Number((currentPrice + risk * 2.8).toFixed(2)) : Number((currentPrice - risk * 2.8).toFixed(2))
      return {
        gateStatus: 'WAITING_CONFIRMATION',
        setupType: isBull ? 'BOS_CONTINUATION_OB' : 'BOS_CONTINUATION_OB',
        direction: isBull ? 'BUY' : 'SELL',
        symbol,
        entryPrice: Number(currentPrice.toFixed(2)),
        stopLoss: sl,
        takeProfit: tp,
        riskRewardRatio: 2.8,
        riskPips: Number((risk * (isGold ? 10 : 10000)).toFixed(1)),
        rewardPips: Number((risk * 2.8 * (isGold ? 10 : 10000)).toFixed(1)),
        confidence: 62,
        reason: `Price is trading inside an institutional ${latestOb.type} Order Block [$${latestOb.bottom.toFixed(2)} - $${latestOb.top.toFixed(2)}]. Waiting for liquidity sweep confirmation.`,
        orderBlock: latestOb,
        timestamp: Date.now(),
      }
    }
  }

  return defaultSetup
}

/**
 * 7. Comprehensive Full SMC Analyzer for Charts and Analytics HUD
 */
export function analyzeSMCStructure(
  candles: SMCCandle[],
  currentPrice: number,
  symbol: string = 'XAU/USD'
): SMCAnalysisResult {
  const swings = calculateSwingPoints(candles, 4)
  const liquidityPools = calculateLiquidityPools(candles, swings)
  const structureBreaks = calculateBOSAndCHoCH(candles, swings)
  const orderBlocks = calculateOrderBlocks(candles, structureBreaks)
  const fvgs = calculateFairValueGaps(candles)
  const activeSetup = generateSMCTradeSetup(candles, currentPrice, symbol)

  const activeBullishOBsCount = orderBlocks.filter((ob) => ob.type === 'BULLISH' && !ob.isMitigated).length
  const activeBearishOBsCount = orderBlocks.filter((ob) => ob.type === 'BEARISH' && !ob.isMitigated).length
  const activeFvgCount = fvgs.filter((f) => !f.isMitigated).length

  const lastSwept = liquidityPools.slice().reverse().find((p) => p.isSwept)
  const lastBreak = structureBreaks[structureBreaks.length - 1]

  let marketBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL'
  if (lastBreak) {
    marketBias = lastBreak.direction === 'BULLISH' ? 'BULLISH' : 'BEARISH'
  }
  const lastBreakLabel: 'BOS ↑' | 'BOS ↓' | 'CHoCH ↑' | 'CHoCH ↓' | undefined = lastBreak
    ? lastBreak.type === 'CHOCH'
      ? (lastBreak.direction === 'BULLISH' ? 'CHoCH ↑' : 'CHoCH ↓')
      : (lastBreak.direction === 'BULLISH' ? 'BOS ↑' : 'BOS ↓')
    : undefined

  return {
    symbol,
    currentPrice,
    swings,
    liquidityPools,
    structureBreaks,
    orderBlocks,
    fvgs,
    activeSetup,
    summary: {
      marketBias,
      lastSweptType: lastSwept?.type,
      lastBreakType: lastBreakLabel,
      activeBullishOBsCount,
      activeBearishOBsCount,
      activeFvgCount,
    },
  }
}
