/**
 * Format currency with proper decimal precision based on magnitude
 * Guarded against NaN, Infinity, -Infinity.
 */
export function formatCurrency(amount: number, showSign: boolean = false): string {
  if (!Number.isFinite(amount)) {
    return '$0.00'
  }
  const abs = Math.abs(amount)
  let formatted = ''

  if (abs >= 1000) {
    formatted = abs.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  } else if (abs >= 1) {
    formatted = abs.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })
  } else if (abs > 0) {
    formatted = abs.toLocaleString('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    })
  } else {
    formatted = '0.00'
  }

  if (amount < 0) {
    return `-$${formatted}`
  }
  if (showSign && amount > 0) {
    return `+$${formatted}`
  }
  return `$${formatted}`
}

/**
 * Format percentage with strict sign according to financial-ui-patterns
 * Guarded against NaN, Infinity, -Infinity.
 */
export function formatPercent(value: number, decimals: number = 2): string {
  if (!Number.isFinite(value)) {
    const zeros = '0'.repeat(decimals)
    return `0.${zeros}%`
  }
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

/**
 * Compact notation for volumes & market caps
 * Guarded against NaN, Infinity, -Infinity.
 */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) {
    return '$0.00'
  }
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`
  return `$${value.toFixed(2)}`
}

/**
 * Symbol-aware precision price formatter conforming to F05.
 * 5 decimals for EUR/USD & GBP/USD; 3 for USD/JPY; 2 for Metals/Crypto.
 * Never prepends '$' to Forex exchange rates.
 */
export function formatPrice(price: number, symbol: string = '', includeCommas: boolean = true): string {
  if (!Number.isFinite(price)) return '0.00'
  const clean = (symbol || '').toUpperCase().trim()
  const isJpy = clean.includes('JPY')
  const isFxMajors = (clean.includes('EUR') || clean.includes('GBP')) && !clean.includes('USDT')
  const digits = isFxMajors ? 5 : isJpy ? 3 : 2

  if (!includeCommas || isFxMajors || isJpy) {
    return price.toFixed(digits)
  }

  return price.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/**
 * Pip difference and spread formatter with fractional pipette precision.
 */
export function formatPips(pips: number, showSign: boolean = true, decimals: number = 1): string {
  if (!Number.isFinite(pips)) return '0.0 pips'
  const sign = showSign && pips > 0 ? '+' : ''
  return `${sign}${pips.toFixed(decimals)} pips`
}
