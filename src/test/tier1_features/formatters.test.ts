import { describe, it, expect } from 'vitest'
import { formatCurrency, formatPercent, formatCompact, formatPrice, formatPips } from '@/utils/formatters'

describe('Tier 1: F05 Currency & Pip Formatter', () => {
  it('formatCurrency: formats standard institutional balances with comma thousands and 2 decimals', () => {
    expect(formatCurrency(100000)).toBe('$100,000.00')
    expect(formatCurrency(54936.3)).toBe('$54,936.30')
    expect(formatCurrency(1250.75)).toBe('$1,250.75')
  })

  it('formatCurrency: handles negative balances and optional sign indicator', () => {
    expect(formatCurrency(-450.25)).toBe('-$450.25')
    expect(formatCurrency(250.5, true)).toBe('+$250.50')
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('formatCurrency: formats sub-dollar fractional values with up to 6 decimals', () => {
    expect(formatCurrency(0.0456)).toBe('$0.0456')
    expect(formatCurrency(0.000125)).toBe('$0.000125')
  })

  it('formatPercent: renders percentage string with explicit positive and negative signs', () => {
    expect(formatPercent(4.61)).toBe('+4.61%')
    expect(formatPercent(-2.48)).toBe('-2.48%')
    expect(formatPercent(0)).toBe('0.00%')
    expect(formatPercent(12.3456, 3)).toBe('+12.346%')
  })

  it('formatCompact: outputs human-readable volume notation (T, B, M, K)', () => {
    expect(formatCompact(4.8e12)).toBe('$4.8T')
    expect(formatCompact(18.7e9)).toBe('$18.7B')
    expect(formatCompact(388.1e6)).toBe('$388.1M')
    expect(formatCompact(45000)).toBe('$45.0K')
    expect(formatCompact(250)).toBe('$250.00')
  })

  it('F05 requirement specification check: Forex exchange rate precision vs fiat currency', () => {
    // EUR/USD requires 5 decimals (e.g. 1.08250) without '$' prefix
    // USD/JPY requires 3 decimals (e.g. 152.450) without '$' prefix
    // Gold/Crypto requires 2 decimals (e.g. 2,734.50 or 114,884.00)
    expect(formatPrice(1.0825, 'EUR/USD')).toBe('1.08250')
    expect(formatPrice(1.29456, 'GBP/USD')).toBe('1.29456')
    expect(formatPrice(152.45, 'USD/JPY')).toBe('152.450')
    expect(formatPrice(2734.5, 'XAU/USD')).toBe('2,734.50')
    expect(formatPrice(114884, 'BTC/USDT')).toBe('114,884.00')
  })

  it('F05: formatPips formats spreads and pip diffs with fractional pipette accuracy', () => {
    expect(formatPips(1.5, true, 1)).toBe('+1.5 pips')
    expect(formatPips(-0.8, true, 1)).toBe('-0.8 pips')
    expect(formatPips(0.4, false, 1)).toBe('0.4 pips')
    expect(formatPips(12.35, true, 2)).toBe('+12.35 pips')
    expect(formatPips(NaN)).toBe('0.0 pips')
  })
})
