import { describe, it, expect } from 'vitest'
import {
  generateAnomalyInvestigation,
  compileNaturalLanguageToTeaScript,
  convertPineScriptToTea,
  AI_PROVIDERS,
} from '../../services/aiAgentService'

describe('AI Agent Service & Multi-LLM Hardcore Features', () => {
  it('1️⃣ AI Agent Charting: defines Codex, Claude, and Gemini providers with distinct specialties', () => {
    expect(AI_PROVIDERS).toHaveLength(3)
    const providerIds = AI_PROVIDERS.map((p) => p.id)
    expect(providerIds).toContain('CODEX')
    expect(providerIds).toContain('CLAUDE')
    expect(providerIds).toContain('GEMINI')
  })

  it('2️⃣ Natural Language Monitoring: compiles plain language into valid TeaScript with anomaly alerts', () => {
    const prompt = 'Canh NVDA vượt đỉnh $188 hoặc volume tăng gấp 3 lần 20MA'
    const result = compileNaturalLanguageToTeaScript(prompt, 'NVDA', 'CODEX')

    expect(result.teaScript).toContain('//@version=2.0 (TeaScript Engine)')
    expect(result.teaScript).toContain('strategy("NVDA Smart Anomaly Monitor", overlay=true)')
    expect(result.teaScript).toContain('sma(volume, volPeriod)')
    expect(result.teaScript).toContain('alertcondition(')
    expect(result.teaScript).toContain('DISPATCH_AI_INVESTIGATION')
    expect(result.title).toContain('NVDA')
  })

  it('3️⃣ Line Drawing & Anomaly Deep Dive: investigates NVDA with Foxconn/TSMC news citations', () => {
    const report = generateAnomalyInvestigation(
      'NVDA',
      {
        startPrice: 170.31,
        endPrice: 192.69,
        changePct: 13.14,
        volumeTotal: 3630000000,
      },
      'GEMINI'
    )

    expect(report.symbol).toBe('NVDA')
    expect(report.primaryCatalyst).toContain('Foxconn')
    expect(report.primaryCatalyst).toContain('TSMC')
    expect(report.technicalDrivers.length).toBeGreaterThan(0)
    expect(report.orderFlowBreakdown.cvdDivergence).toBeDefined()
    expect(report.citedSources.length).toBeGreaterThan(1)
    expect(report.citedSources[0].url).toContain('http')
    expect(report.confidenceScore).toBeGreaterThanOrEqual(90)
  })

  it('4️⃣ Smart Rise/Fall Analysis: investigates Bitcoin institutional inflows and short liquidations', () => {
    const report = generateAnomalyInvestigation(
      'BTC/USDT',
      {
        startPrice: 110500,
        endPrice: 114884,
        changePct: 3.96,
      },
      'CLAUDE'
    )

    expect(report.symbol).toBe('BTC/USDT')
    expect(report.primaryCatalyst).toContain('Coinbase Prime')
    expect(report.summary).toContain('Bitcoin')
    expect(report.orderFlowBreakdown.liquidationVolumeUsd).toBeDefined()
    expect(report.actionableThesis).toBeDefined()
  })

  it('6️⃣ Pine Script Migration: converts TradingView Pine v5 into TeaScript v2.0 AST', () => {
    const pineCode = `//@version=5
indicator("Supertrend ATR", overlay=true)
atrVal = ta.atr(14)
isBuy = ta.crossover(close, ta.sma(close, 20))
plot(atrVal, "ATR", color=color.green)`

    const result = convertPineScriptToTea(pineCode, 'CODEX')

    expect(result.convertedTeaScript).toContain('//@version=2.0 (TeaScript Auto-Migrated by CODEX)')
    expect(result.convertedTeaScript).toContain('study("Supertrend ATR", overlay=true)')
    expect(result.convertedTeaScript).toContain('atr(14)')
    expect(result.convertedTeaScript).toContain('crossover(close, sma(close, 20))')
    expect(result.convertedTeaScript).toContain('DISPATCH_AI_INVESTIGATION')
    expect(result.detectedIndicators).toContain('SMA Moving Average')
    expect(result.syntaxTreeValid).toBe(true)
  })
})
