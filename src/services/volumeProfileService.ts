import type { CandlestickPoint } from '../types/trading'
import type { VolumeProfileData, VolumeProfileBin } from '../types/aiCharting'

/**
 * Calculates Institutional Volume Profile (VPVR) across visible candlestick series.
 * Identifies:
 * - POC (Point of Control): Highest volume horizontal node
 * - VAH (Value Area High): Upper boundary of 70% volume distribution
 * - VAL (Value Area Low): Lower boundary of 70% volume distribution
 */
export function calculateVolumeProfile(
  symbol: string,
  candles: CandlestickPoint[],
  bucketsCount: number = 24
): VolumeProfileData {
  if (!candles || candles.length === 0) {
    return {
      symbol,
      bins: [],
      pocPrice: 0,
      vahPrice: 0,
      valPrice: 0,
      totalVolume: 0,
    }
  }

  let minPrice = Infinity
  let maxPrice = -Infinity
  let totalVolume = 0

  for (const c of candles) {
    if (c.low < minPrice) minPrice = c.low
    if (c.high > maxPrice) maxPrice = c.high
    totalVolume += c.volume || 1
  }

  if (minPrice === maxPrice || !Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) {
    minPrice = candles[0]?.close || 100
    maxPrice = minPrice * 1.02
  }

  const step = (maxPrice - minPrice) / bucketsCount
  const bins: VolumeProfileBin[] = []

  for (let i = 0; i < bucketsCount; i++) {
    const level = minPrice + (i + 0.5) * step
    bins.push({
      priceLevel: Number(level.toFixed(4)),
      volume: 0,
      buyVolume: 0,
      sellVolume: 0,
      pctOfTotal: 0,
      isPoc: false,
      isValueArea: false,
    })
  }

  // Distribute volume into bins
  for (const c of candles) {
    const vol = c.volume || 1
    const isBullish = c.close >= c.open
    const buyVol = isBullish ? vol * 0.65 : vol * 0.35
    const sellVol = vol - buyVol

    // Span candle range across overlapping bins
    const lowBinIdx = Math.max(0, Math.min(bucketsCount - 1, Math.floor((c.low - minPrice) / step)))
    const highBinIdx = Math.max(0, Math.min(bucketsCount - 1, Math.floor((c.high - minPrice) / step)))
    const span = Math.max(1, highBinIdx - lowBinIdx + 1)
    const volPerBin = vol / span
    const buyPerBin = buyVol / span
    const sellPerBin = sellVol / span

    for (let b = lowBinIdx; b <= highBinIdx; b++) {
      bins[b].volume += volPerBin
      bins[b].buyVolume += buyPerBin
      bins[b].sellVolume += sellPerBin
    }
  }

  // Find POC
  let maxBinVol = -1
  let pocIdx = 0
  for (let i = 0; i < bins.length; i++) {
    bins[i].pctOfTotal = totalVolume > 0 ? (bins[i].volume / totalVolume) * 100 : 0
    if (bins[i].volume > maxBinVol) {
      maxBinVol = bins[i].volume
      pocIdx = i
    }
  }

  if (bins[pocIdx]) {
    bins[pocIdx].isPoc = true
  }

  // Calculate 70% Value Area starting from POC expanding outwards
  const targetVaVolume = totalVolume * 0.7
  let currentVaVolume = bins[pocIdx]?.volume || 0
  let upIdx = pocIdx
  let downIdx = pocIdx
  if (bins[pocIdx]) bins[pocIdx].isValueArea = true

  while (currentVaVolume < targetVaVolume && (upIdx < bucketsCount - 1 || downIdx > 0)) {
    const nextUpVol = upIdx < bucketsCount - 1 ? bins[upIdx + 1].volume : -1
    const nextDownVol = downIdx > 0 ? bins[downIdx - 1].volume : -1

    if (nextUpVol >= nextDownVol && upIdx < bucketsCount - 1) {
      upIdx++
      bins[upIdx].isValueArea = true
      currentVaVolume += bins[upIdx].volume
    } else if (downIdx > 0) {
      downIdx--
      bins[downIdx].isValueArea = true
      currentVaVolume += bins[downIdx].volume
    } else if (upIdx < bucketsCount - 1) {
      upIdx++
      bins[upIdx].isValueArea = true
      currentVaVolume += bins[upIdx].volume
    } else {
      break
    }
  }

  const pocPrice = bins[pocIdx]?.priceLevel || candles[candles.length - 1].close
  const vahPrice = bins[upIdx]?.priceLevel || maxPrice
  const valPrice = bins[downIdx]?.priceLevel || minPrice

  return {
    symbol,
    bins,
    pocPrice,
    vahPrice,
    valPrice,
    totalVolume,
  }
}
