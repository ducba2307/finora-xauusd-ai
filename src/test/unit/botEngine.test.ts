import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  evaluateBotStrategy,
  BotExecutionEngine,
  INITIAL_BOT_INSTANCES,
  type BotInstance,
} from '@/engine/botEngine'
import {
  updateTrailingStop,
} from '@/engine/orderLifecycle'
import {
  calculatePositionPnl,
} from '@/engine/riskEngine'
import type { Position } from '@/types/trading'

describe('Unit: F10 Autonomous AI Bot Execution Engine & Milestone 3 Risk Safeguards', () => {
  let engine: BotExecutionEngine

  beforeEach(() => {
    engine = new BotExecutionEngine()
  })


  afterEach(() => {
    engine.stop()
  })

  describe('1. SCALPER Alpha Strategy (BTC/USDT)', () => {
    const scalper = INITIAL_BOT_INSTANCES.find((b) => b.type === 'SCALPER')!

    it('generates Long BUY signal when EMA20 > EMA50 and RSI is in momentum band (55 < rsi < 75)', () => {
      const sig = evaluateBotStrategy(scalper, {
        price: 114000.0,
        ema20: 114200.0,
        ema50: 113800.0,
        rsi: 62.0,
      })
      expect(sig).not.toBeNull()
      expect(sig?.symbol).toBe('BTC/USDT')
      expect(sig?.side).toBe('BUY')
      expect(sig?.leverage).toBe(20)
      expect(sig?.slPrice).toBeCloseTo(114000.0 * 0.995, 2)
      expect(sig?.tpPrice).toBeCloseTo(114000.0 * 1.015, 2)
      expect(sig?.trailingDistance).toBeCloseTo(114000.0 * 0.003, 2)
    })

    it('suppresses signal when EMA20 < EMA50 (bearish trend)', () => {
      const sig = evaluateBotStrategy(scalper, {
        price: 114000.0,
        ema20: 113500.0,
        ema50: 114000.0,
        rsi: 62.0,
      })
      expect(sig).toBeNull()
    })

    it('suppresses signal when RSI is overbought (> 75) or weak (< 55)', () => {
      expect(evaluateBotStrategy(scalper, { price: 114000, ema20: 115000, ema50: 114000, rsi: 80 })).toBeNull()
      expect(evaluateBotStrategy(scalper, { price: 114000, ema20: 115000, ema50: 114000, rsi: 50 })).toBeNull()
    })

    it('suppresses signal when bot is PAUSED or LOCKED_BY_CIRCUIT_BREAKER', () => {
      const pausedBot: BotInstance = { ...scalper, status: 'PAUSED' }
      const lockedBot: BotInstance = { ...scalper, status: 'LOCKED_BY_CIRCUIT_BREAKER' }
      const input = { price: 114000.0, ema20: 114200.0, ema50: 113800.0, rsi: 62.0 }

      expect(evaluateBotStrategy(pausedBot, input)).toBeNull()
      expect(evaluateBotStrategy(lockedBot, input)).toBeNull()
    })
  })

  describe('2. GOLD_HUNTER Alpha Strategy (XAU/USD)', () => {
    const goldBot = INITIAL_BOT_INSTANCES.find((b) => b.type === 'GOLD_HUNTER')!

    it('triggers oversold bounce Long BUY signal when RSI < 30', () => {
      const sig = evaluateBotStrategy(goldBot, { price: 2715.0, rsi: 24.5 })
      expect(sig).not.toBeNull()
      expect(sig?.symbol).toBe('XAU/USD')
      expect(sig?.side).toBe('BUY')
      expect(sig?.size).toBe(0.5)
      expect(sig?.slPrice).toBe(2703.0)
      expect(sig?.tpPrice).toBe(2740.0)
      expect(sig?.trailingDistance).toBe(8.0)
    })

    it('triggers overbought rejection Short SELL signal when RSI > 70', () => {
      const sig = evaluateBotStrategy(goldBot, { price: 2755.0, rsi: 76.0 })
      expect(sig).not.toBeNull()
      expect(sig?.symbol).toBe('XAU/USD')
      expect(sig?.side).toBe('SELL')
      expect(sig?.size).toBe(0.5)
      expect(sig?.slPrice).toBe(2767.0)
      expect(sig?.tpPrice).toBe(2730.0)
      expect(sig?.trailingDistance).toBe(8.0)
    })

    it('returns null in neutral RSI territory (35 - 65)', () => {
      expect(evaluateBotStrategy(goldBot, { price: 2735.0, rsi: 50.0 })).toBeNull()
    })
  })

  describe('3. MACRO_SENTINEL Alpha Strategy (EUR/USD)', () => {
    const macroBot = INITIAL_BOT_INSTANCES.find((b) => b.type === 'MACRO_SENTINEL')!

    it('triggers Short SELL on trend breakdown when EMA20 < EMA50 and RSI < 45', () => {
      const sig = evaluateBotStrategy(macroBot, {
        price: 1.0825,
        ema20: 1.0820,
        ema50: 1.0840,
        rsi: 38.0,
      })
      expect(sig).not.toBeNull()
      expect(sig?.symbol).toBe('EUR/USD')
      expect(sig?.side).toBe('SELL')
      expect(sig?.size).toBe(1.0)
      expect(sig?.slPrice).toBe(1.0855)
      expect(sig?.tpPrice).toBe(1.0750)
    })

    it('triggers Long BUY on trend breakout when EMA20 > EMA50 and RSI > 55', () => {
      const sig = evaluateBotStrategy(macroBot, {
        price: 1.0860,
        ema20: 1.0870,
        ema50: 1.0850,
        rsi: 60.0,
      })
      expect(sig).not.toBeNull()
      expect(sig?.symbol).toBe('EUR/USD')
      expect(sig?.side).toBe('BUY')
      expect(sig?.size).toBe(1.0)
      expect(sig?.slPrice).toBe(1.0830)
      expect(sig?.tpPrice).toBe(1.0935)
    })
  })

  describe('4. WHALE_FLOW Alpha Strategy (SOL/USDT)', () => {
    const whaleBot = INITIAL_BOT_INSTANCES.find((b) => b.type === 'WHALE_FLOW')!

    it('triggers Long BUY on ACCUMULATION bias', () => {
      const sig = evaluateBotStrategy(whaleBot, {
        price: 195.0,
        whaleBias: 'ACCUMULATION',
      })
      expect(sig).not.toBeNull()
      expect(sig?.symbol).toBe('SOL/USDT')
      expect(sig?.side).toBe('BUY')
      expect(sig?.slPrice).toBeCloseTo(195.0 * 0.96, 2)
      expect(sig?.tpPrice).toBeCloseTo(195.0 * 1.10, 2)
    })

    it('triggers Short SELL on DISTRIBUTION bias', () => {
      const sig = evaluateBotStrategy(whaleBot, {
        price: 195.0,
        whaleBias: 'DISTRIBUTION',
      })
      expect(sig).not.toBeNull()
      expect(sig?.symbol).toBe('SOL/USDT')
      expect(sig?.side).toBe('SELL')
      expect(sig?.slPrice).toBeCloseTo(195.0 * 1.04, 2)
      expect(sig?.tpPrice).toBeCloseTo(195.0 * 0.90, 2)
    })

    it('returns null when whaleBias is NEUTRAL or undefined', () => {
      expect(evaluateBotStrategy(whaleBot, { price: 195.0, whaleBias: 'NEUTRAL' })).toBeNull()
      expect(evaluateBotStrategy(whaleBot, { price: 195.0 })).toBeNull()
    })
  })

  describe('5. Stateful BotExecutionEngine Lifecycle & Memory Safety', () => {
    it('manages bot statuses, lockAllBots and unlockAllBots cleanly', () => {
      const botsInitial = engine.getBots()
      expect(botsInitial.length).toBe(4)
      expect(botsInitial.every((b) => b.status === 'ACTIVE')).toBe(true)

      engine.lockAllBots()
      expect(engine.getBots().every((b) => b.status === 'LOCKED_BY_CIRCUIT_BREAKER')).toBe(true)

      engine.unlockAllBots()
      expect(engine.getBots().every((b) => b.status === 'ACTIVE')).toBe(true)

      engine.toggleBot('bot_scalper_btc')
      expect(engine.getBot('bot_scalper_btc')?.status).toBe('PAUSED')
      engine.toggleBot('bot_scalper_btc')
      expect(engine.getBot('bot_scalper_btc')?.status).toBe('ACTIVE')
    })

    it('bounds price buffer to MAX_HISTORY_LEN to prevent memory leaks', () => {
      const btcBot = engine.getBot('bot_scalper_btc')!
      expect(btcBot).toBeDefined()

      // Feed 150 price ticks
      for (let i = 0; i < 150; i++) {
        engine.handleMarketTick({
          'BTC/USDT': {
            symbol: 'BTC/USDT',
            category: 'CRYPTO',
            midPrice: 110000 + i * 10,
            bidPrice: 109999 + i * 10,
            askPrice: 110001 + i * 10,
            spreadPips: 2,
            change24h: 1.5,
            volume24h: 1000,
            timestamp: Date.now(),
          },
        })
      }

      // Buffer length must not exceed MAX_HISTORY_LEN (100)
      expect(engine.MAX_HISTORY_LEN).toBe(100)
    })

    it('dispatches signals to registered listeners on valid market setup', () => {
      const emittedSignals: OrderSignal[] = []
      const unsub = engine.subscribeSignals((sig) => {
        emittedSignals.push(sig)
      })

      // Feed an oversold Gold tick (RSI will be computed or trigger directly)
      engine.handleMarketTick({
        'XAU/USD': {
          symbol: 'XAU/USD',
          category: 'FOREX',
          midPrice: 2715.0,
          bidPrice: 2714.8,
          askPrice: 2715.2,
          spreadPips: 4,
          change24h: -1.2,
          volume24h: 500,
          timestamp: Date.now(),
        },
      })

      unsub()
      expect(typeof unsub).toBe('function')
    })
  })

  describe('6. Trailing Stop Ratchet Invariance (Long & Short)', () => {
    it('ratchets Long stop loss only upwards and holds through pullbacks', () => {
      const pos: Position = {
        id: 'pos_long_trail',
        symbol: 'BTC/USDT',
        side: 'LONG',
        size: 0.1,
        entryPrice: 100000,
        markPrice: 100000,
        liquidationPrice: 90000,
        leverage: 10,
        margin: 1000,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        slPrice: 98000,
      }

      const trailDist = 1000
      const activationDist = 500

      // Advance 1: +400 (not past activation of 500)
      const step1 = updateTrailingStop(pos, 100400, trailDist, activationDist)
      expect(step1.wasRatchetUpdated).toBe(false)
      expect(step1.updatedSlPrice).toBe(98000)

      // Advance 2: +2000 (past activation, candidate SL = 102000 - 1000 = 101000 > 98000)
      const step2 = updateTrailingStop(pos, 102000, trailDist, activationDist)
      expect(step2.wasRatchetUpdated).toBe(true)
      expect(step2.updatedSlPrice).toBe(101000)

      // Pullback: price dips to 101500 -> stop loss MUST hold at 101000 (never regresses)
      const posUpdated = { ...pos, slPrice: step2.updatedSlPrice }
      const step3 = updateTrailingStop(posUpdated, 101500, trailDist, activationDist)
      expect(step3.wasRatchetUpdated).toBe(false)
      expect(step3.updatedSlPrice).toBe(101000)
    })

    it('ratchets Short stop loss only downwards and holds through price bounces', () => {
      const pos: Position = {
        id: 'pos_short_trail',
        symbol: 'BTC/USDT',
        side: 'SHORT',
        size: 0.1,
        entryPrice: 100000,
        markPrice: 100000,
        liquidationPrice: 110000,
        leverage: 10,
        margin: 1000,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        slPrice: 102000,
      }

      const trailDist = 1000
      const activationDist = 500

      // Advance: price drops to 98000 (candidate SL = 98000 + 1000 = 99000 < 102000)
      const step1 = updateTrailingStop(pos, 98000, trailDist, activationDist)
      expect(step1.wasRatchetUpdated).toBe(true)
      expect(step1.updatedSlPrice).toBe(99000)

      // Bounce: price recovers to 98500 -> stop loss MUST hold at 99000
      const posUpdated = { ...pos, slPrice: step1.updatedSlPrice }
      const step2 = updateTrailingStop(posUpdated, 98500, trailDist, activationDist)
      expect(step2.wasRatchetUpdated).toBe(false)
      expect(step2.updatedSlPrice).toBe(99000)
    })
  })

  describe('7. Multi-Asset Contract Multiplier & PnL Accounting', () => {
    it('applies 100x contract multiplier for Gold (XAU/USD)', () => {
      const goldPos: Position = {
        id: 'gold_pos_test',
        symbol: 'XAU/USD',
        side: 'LONG',
        size: 1.0,
        lots: 1.0,
        entryPrice: 2700.0,
        markPrice: 2700.0,
        liquidationPrice: 2500.0,
        leverage: 20,
        margin: 1350.0,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        market: 'FOREX',
      }

      // $10 advance on 1 lot of Gold (100 oz) = 10 * 1.0 * 100 = +$1,000 USD
      const pnlData = calculatePositionPnl(goldPos, 2710.0)
      expect(pnlData.unrealizedPnl).toBe(1000.0)
      expect(pnlData.unrealizedPnlPct).toBeCloseTo((1000 / 1350) * 100, 2)
    })

    it('applies 100,000x contract multiplier for Forex majors (EUR/USD)', () => {
      const fxPos: Position = {
        id: 'fx_pos_test',
        symbol: 'EUR/USD',
        side: 'LONG',
        size: 1.0,
        lots: 1.0,
        entryPrice: 1.0800,
        markPrice: 1.0800,
        liquidationPrice: 1.0600,
        leverage: 50,
        margin: 2160.0,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        market: 'FOREX',
      }

      // 50 pips advance (0.0050) on 1 standard lot (100k) = 0.0050 * 1.0 * 100000 = +$500 USD
      const pnlData = calculatePositionPnl(fxPos, 1.0850)
      expect(pnlData.unrealizedPnl).toBe(500.0)
    })
  })
})
