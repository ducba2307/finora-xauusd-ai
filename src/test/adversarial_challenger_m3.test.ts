import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  evaluateBotStrategy,
  BotExecutionEngine,
  INITIAL_BOT_INSTANCES,
  type BotInstance,
} from '@/engine/botEngine'
import {
  processOrderPipeline,
  type OrderSignal,
} from '@/engine/orderLifecycle'
import {
  recalculateBalanceSheet,
  evaluateOrderRisk,
  type AccountBalanceSheet,
  type NewOrderRequest,
} from '@/engine/riskEngine'
import type { Position } from '@/types/trading'


describe('Adversarial Challenger M3: Bot Execution Engine & Institutional Balance Sheet Synchronization', () => {
  let engine: BotExecutionEngine

  beforeEach(() => {
    engine = new BotExecutionEngine()
  })

  afterEach(() => {
    engine.stop()
    vi.restoreAllMocks()
  })

  // =========================================================================
  // 1. Bot Execution Engine behavior under high-frequency ticks & 100-bar rolling buffer
  // =========================================================================
  describe('Vector 1: High-Frequency Ticks & 100-Bar Rolling Buffer Memory Boundedness', () => {
    it('strictly caps rolling priceHistory length to MAX_HISTORY_LEN (100) after 50,000 rapid ticks', () => {
      expect(engine.MAX_HISTORY_LEN).toBe(100)

      // Feed 50,000 rapid price ticks for BTC/USDT (neutral prices so Scalper does not trigger)
      for (let i = 0; i < 50000; i++) {
        engine.handleMarketTick({
          'BTC/USDT': {
            symbol: 'BTC/USDT',
            category: 'CRYPTO',
            midPrice: 110000 + (i % 500) * 2,
            bidPrice: 109999 + (i % 500) * 2,
            askPrice: 110001 + (i % 500) * 2,
            spreadPips: 2,
            spreadUsd: 2,
            high24h: 120000,
            low24h: 100000,
            change24hPct: 1.5,
            volume24h: 1000000,
            lastUpdateTimestamp: Date.now(),
            connectionStatus: 'LIVE_WS',
          },
        })
      }

      // Check internal priceHistory map
      const internalHistory = (engine as unknown as { priceHistory: Map<string, number[]> }).priceHistory
      const btcHistory = internalHistory.get('BTC/USDT')

      expect(btcHistory).toBeDefined()
      expect(btcHistory!.length).toBeLessThanOrEqual(100)
      expect(btcHistory!.length).toBe(100)
    })

    it('identifies priceHistory buffer behavior across multi-symbol streaming', () => {
      const symbols = ['BTC/USDT', 'XAU/USD', 'EUR/USD', 'SOL/USDT']
      const internalHistory = (engine as unknown as { priceHistory: Map<string, number[]> }).priceHistory

      // Feed 200 tick cycles with time advances beyond cooldown to observe buffer behavior
      let mockTime = 1700000000000
      vi.spyOn(Date, 'now').mockImplementation(() => mockTime)

      for (let i = 0; i < 200; i++) {
        mockTime += 65000 // Advance beyond all bot cooldowns (max cooldown is Macro Sentinel 60s)
        const tickRecord: Record<string, any> = {}
        for (const sym of symbols) {
          const isFx = sym.includes('/') && (sym.includes('XAU') || sym.includes('EUR'))
          const basePrice = sym === 'BTC/USDT' ? 114000 : sym === 'XAU/USD' ? 2700 : sym === 'EUR/USD' ? 1.08 : 190
          tickRecord[sym] = {
            symbol: sym,
            category: isFx ? 'FOREX' : 'CRYPTO',
            midPrice: basePrice + (Math.sin(i * 0.1) * 2),
            bidPrice: basePrice + (Math.sin(i * 0.1) * 2) - 0.1,
            askPrice: basePrice + (Math.sin(i * 0.1) * 2) + 0.1,
            spreadPips: 1,
            spreadUsd: 1,
            high24h: basePrice * 1.05,
            low24h: basePrice * 0.95,
            change24hPct: 0.5,
            volume24h: 50000,
            lastUpdateTimestamp: mockTime,
            connectionStatus: 'LIVE_WS',
          }
        }
        engine.handleMarketTick(tickRecord)
      }

      // Validate that every tracked symbol's history buffer stays strictly <= 100
      for (const sym of symbols) {
        const hist = internalHistory.get(sym)
        expect(hist).toBeDefined()
        expect(hist!.length).toBeLessThanOrEqual(100)
        expect(hist!.length).toBe(100)
        expect(hist!.every((val) => Number.isFinite(val) && val > 0)).toBe(true)
      }
    })

    it('rejects Infinity ticks and prevents corruption of rolling priceHistory buffer in botEngine.ts', () => {
      const internalHistory = (engine as unknown as { priceHistory: Map<string, number[]> }).priceHistory

      // Feed an Infinity tick
      engine.handleMarketTick({
        'BTC/USDT': {
          symbol: 'BTC/USDT',
          category: 'CRYPTO',
          midPrice: Infinity,
          bidPrice: 100000,
          askPrice: 100002,
          spreadPips: 2,
          spreadUsd: 2,
          high24h: 110000,
          low24h: 90000,
          change24hPct: 0,
          volume24h: 100,
          lastUpdateTimestamp: Date.now(),
          connectionStatus: 'LIVE_WS',
        },
      })

      // Buffer must NOT allocate or store Infinity
      const hist = internalHistory.get('BTC/USDT')
      expect(hist).toBeUndefined()
    })

    it('rejects negative, zero, and NaN ticks properly', () => {
      const internalHistory = (engine as unknown as { priceHistory: Map<string, number[]> }).priceHistory

      // Seed with 1 valid tick
      engine.handleMarketTick({
        'BTC/USDT': {
          symbol: 'BTC/USDT',
          category: 'CRYPTO',
          midPrice: 100000,
          bidPrice: 99999,
          askPrice: 100001,
          spreadPips: 2,
          spreadUsd: 2,
          high24h: 110000,
          low24h: 90000,
          change24hPct: 0,
          volume24h: 100,
          lastUpdateTimestamp: Date.now(),
          connectionStatus: 'LIVE_WS',
        },
      })
      expect(internalHistory.get('BTC/USDT')!.length).toBe(1)

      // Feed NaN, negative, 0
      const badPrices = [NaN, -500, 0]
      for (const badPrice of badPrices) {
        engine.handleMarketTick({
          'BTC/USDT': {
            symbol: 'BTC/USDT',
            category: 'CRYPTO',
            midPrice: badPrice,
            bidPrice: badPrice,
            askPrice: badPrice,
            spreadPips: 2,
            spreadUsd: 2,
            high24h: 110000,
            low24h: 90000,
            change24hPct: 0,
            volume24h: 100,
            lastUpdateTimestamp: Date.now(),
            connectionStatus: 'LIVE_WS',
          },
        })
      }

      // Buffer must remain strictly 1 item
      expect(internalHistory.get('BTC/USDT')!.length).toBe(1)
    })

    it('handles unknown or unsolicited symbols gracefully without memory leaks', () => {
      const internalHistory = (engine as unknown as { priceHistory: Map<string, number[]> }).priceHistory

      // Feed 1,000 ticks for an untracked symbol 'DOGE/USDT'
      for (let i = 0; i < 1000; i++) {
        engine.handleMarketTick({
          'DOGE/USDT': {
            symbol: 'DOGE/USDT',
            category: 'CRYPTO',
            midPrice: 0.25,
            bidPrice: 0.249,
            askPrice: 0.251,
            spreadPips: 1,
            spreadUsd: 0.001,
            high24h: 0.3,
            low24h: 0.2,
            change24hPct: 2,
            volume24h: 100000,
            lastUpdateTimestamp: Date.now(),
            connectionStatus: 'LIVE_WS',
          },
        })
      }

      // Since no active bot targets DOGE/USDT, priceHistory must not allocate an entry for DOGE/USDT
      expect(internalHistory.has('DOGE/USDT')).toBe(false)
    })
  })

  // =========================================================================
  // 2. Cooldown timer enforcement
  // =========================================================================
  describe('Vector 2: Cooldown Timer Enforcement Against Rapid Duplicate Signals', () => {
    it('never emits rapid duplicate signals on 1,000 consecutive ticks within the cooldown window', () => {
      const emittedSignals: OrderSignal[] = []
      engine.subscribeSignals((sig) => {
        emittedSignals.push(sig)
      })

      // Whale Flow (SOL/USDT) triggers on ACCUMULATION bias (active by default in botEngine.ts)
      const now = 1700000000000
      vi.spyOn(Date, 'now').mockReturnValue(now)

      for (let i = 0; i < 1000; i++) {
        engine.handleMarketTick({
          'SOL/USDT': {
            symbol: 'SOL/USDT',
            category: 'CRYPTO',
            midPrice: 195.0,
            bidPrice: 194.9,
            askPrice: 195.1,
            spreadPips: 2,
            spreadUsd: 0.02,
            high24h: 205,
            low24h: 190,
            change24hPct: 1.0,
            volume24h: 10000,
            lastUpdateTimestamp: now,
            connectionStatus: 'LIVE_WS',
          },
        })
      }

      // Exactly ONE signal must be emitted; remaining 999 must be suppressed by cooldown
      expect(emittedSignals.length).toBe(1)
      expect(emittedSignals[0]?.symbol).toBe('SOL/USDT')
      expect(emittedSignals[0]?.side).toBe('BUY')
    })

    it('allows a subsequent signal ONLY after the full cooldownSec period has elapsed', () => {
      const emittedSignals: OrderSignal[] = []
      engine.subscribeSignals((sig) => {
        emittedSignals.push(sig)
      })

      const whaleBot = engine.getBot('bot_whale_flow')!
      expect(whaleBot).toBeDefined()
      const cooldownSec = whaleBot.cooldownSec ?? 45
      const cooldownMs = cooldownSec * 1000

      let currentTime = 1700000000000
      vi.spyOn(Date, 'now').mockImplementation(() => currentTime)

      const tick = {
        'SOL/USDT': {
          symbol: 'SOL/USDT',
          category: 'CRYPTO' as const,
          midPrice: 195.0,
          bidPrice: 194.9,
          askPrice: 195.1,
          spreadPips: 2,
          spreadUsd: 0.02,
          high24h: 205,
          low24h: 190,
          change24hPct: 1.0,
          volume24h: 10000,
          lastUpdateTimestamp: currentTime,
          connectionStatus: 'LIVE_WS' as const,
        },
      }

      // 1. Initial tick at t=0 -> Signal 1 emitted
      engine.handleMarketTick(tick)
      expect(emittedSignals.length).toBe(1)

      // 2. Advance time to 20s (halfway through 45s cooldown)
      currentTime += 20000
      engine.handleMarketTick(tick)
      expect(emittedSignals.length).toBe(1) // Still 1!

      // 3. Advance time to 44.999s (1ms before cooldown expires)
      currentTime = 1700000000000 + cooldownMs - 1
      engine.handleMarketTick(tick)
      expect(emittedSignals.length).toBe(1) // Still 1!

      // 4. Advance time to exactly cooldownMs + 1ms (cooldown expired)
      currentTime = 1700000000000 + cooldownMs + 1
      engine.handleMarketTick(tick)
      expect(emittedSignals.length).toBe(2) // Exactly 2!
      expect(emittedSignals[1]?.id).not.toBe(emittedSignals[0]?.id)

      // 5. Immediate consecutive tick at cooldownMs + 2ms -> suppressed again!
      currentTime += 1
      engine.handleMarketTick(tick)
      expect(emittedSignals.length).toBe(2)
    })

    it('enforces independent cooldown timers across bots with different cooldown configurations', () => {
      const emittedSignals: OrderSignal[] = []
      engine.subscribeSignals((sig) => {
        emittedSignals.push(sig)
      })

      let currentTime = 1700000000000
      vi.spyOn(Date, 'now').mockImplementation(() => currentTime)

      // Seed history for Scalper (BTC) and Whale Flow (SOL)
      // Scalper requires EMA20 > EMA50 and 55 < RSI < 75
      // Whale Flow triggers immediately on ACCUMULATION
      const solBot = engine.getBot('bot_whale_flow')!
      expect(solBot.cooldownSec).toBe(45)

      // Trigger Whale Flow (SOL) at t=0
      engine.handleMarketTick({
        'SOL/USDT': {
          symbol: 'SOL/USDT',
          category: 'CRYPTO',
          midPrice: 195.0,
          bidPrice: 194.9,
          askPrice: 195.1,
          spreadPips: 2,
          spreadUsd: 0.02,
          high24h: 205,
          low24h: 190,
          change24hPct: 1.0,
          volume24h: 10000,
          lastUpdateTimestamp: currentTime,
          connectionStatus: 'LIVE_WS',
        },
      })
      expect(emittedSignals.length).toBe(1)

      // Advance by 20s: Whale Flow is still on cooldown (needs 45s)
      currentTime += 20000
      engine.handleMarketTick({
        'SOL/USDT': {
          symbol: 'SOL/USDT',
          category: 'CRYPTO',
          midPrice: 196.0,
          bidPrice: 195.9,
          askPrice: 196.1,
          spreadPips: 2,
          spreadUsd: 0.02,
          high24h: 205,
          low24h: 190,
          change24hPct: 1.0,
          volume24h: 10000,
          lastUpdateTimestamp: currentTime,
          connectionStatus: 'LIVE_WS',
        },
      })
      expect(emittedSignals.length).toBe(1) // Still 1!

      // Advance to 46s: Whale Flow cooldown (45s) has expired
      currentTime += 26000
      engine.handleMarketTick({
        'SOL/USDT': {
          symbol: 'SOL/USDT',
          category: 'CRYPTO',
          midPrice: 197.0,
          bidPrice: 196.9,
          askPrice: 197.1,
          spreadPips: 2,
          spreadUsd: 0.02,
          high24h: 205,
          low24h: 190,
          change24hPct: 1.0,
          volume24h: 10000,
          lastUpdateTimestamp: currentTime,
          connectionStatus: 'LIVE_WS',
        },
      })
      expect(emittedSignals.length).toBe(2) // Fired 2nd signal!
    })

    it('demonstrates vulnerability: evaluateBotStrategy treats rsi === 0 as falsy in `rsi && rsi < 30`', () => {
      const goldBot = INITIAL_BOT_INSTANCES.find((b) => b.type === 'GOLD_HUNTER')!

      // Case A: RSI is 20 (valid oversold) -> Triggers BUY
      const resWith20 = evaluateBotStrategy(goldBot, {
        price: 2715.0,
        rsi: 20.0,
      })
      expect(resWith20).not.toBeNull()
      expect(resWith20?.side).toBe('BUY')

      // Case B: RSI is 0 (maximum catastrophic oversold condition)
      // Because line 160 uses `if (rsi && rsi < 30)`, 0 evaluates to falsy!
      const resWith0 = evaluateBotStrategy(goldBot, {
        price: 2715.0,
        rsi: 0.0, // 0 is falsy in JavaScript!
      })

      // Empirical proof: Returns null due to truthiness check bug
      expect(resWith0).toBeNull()
    })
  })

  // =========================================================================
  // 3. Bot status locking under Circuit Breaker (LOCKED_BY_CIRCUIT_BREAKER)
  // =========================================================================
  describe('Vector 3: Bot Status Locking & Circuit Breaker Signal Halting', () => {
    it('completely ceases all signal generation when active bots are locked by circuit breaker', () => {
      const emittedSignals: OrderSignal[] = []
      engine.subscribeSignals((sig) => {
        emittedSignals.push(sig)
      })

      // Lock all bots via circuit breaker trigger
      engine.lockAllBots()
      const lockedBots = engine.getBots()
      expect(lockedBots.every((b) => b.status === 'LOCKED_BY_CIRCUIT_BREAKER')).toBe(true)

      // Feed 1,000 market ticks that would otherwise trigger strategies
      for (let i = 0; i < 1000; i++) {
        engine.handleMarketTick({
          'SOL/USDT': {
            symbol: 'SOL/USDT',
            category: 'CRYPTO',
            midPrice: 195.0,
            bidPrice: 194.9,
            askPrice: 195.1,
            spreadPips: 2,
            spreadUsd: 0.02,
            high24h: 205,
            low24h: 190,
            change24hPct: 1.0,
            volume24h: 10000,
            lastUpdateTimestamp: Date.now(),
            connectionStatus: 'LIVE_WS',
          },
        })
      }

      // Zero signals emitted during circuit breaker lockout
      expect(emittedSignals.length).toBe(0)
    })

    it('pure strategy evaluation strictly returns null for any bot in LOCKED_BY_CIRCUIT_BREAKER status', () => {
      const activeBot = INITIAL_BOT_INSTANCES[0]!
      const lockedBot: BotInstance = { ...activeBot, status: 'LOCKED_BY_CIRCUIT_BREAKER' }

      // Even with an ideal market setup
      const result = evaluateBotStrategy(lockedBot, {
        price: 114000.0,
        ema20: 114200.0,
        ema50: 113800.0,
        rsi: 62.0,
        whaleBias: 'ACCUMULATION',
      })

      expect(result).toBeNull()
    })

    it('order lifecycle pipeline rejects signals at Stage 3 RISK_CHECK if circuit breaker is tripped', () => {
      const sampleSignal: OrderSignal = {
        id: 'sig_test_cb',
        symbol: 'BTC/USDT',
        side: 'BUY',
        size: 0.1,
        price: 114000.0,
        leverage: 10,
        slPrice: 113000.0,
        tpPrice: 116000.0,
      }

      const trippedBalanceSheet: AccountBalanceSheet = {
        cashBalance: 45000,
        equity: 45000,
        marginUsed: 5000,
        freeMargin: 40000,
        marginLevelPct: 900,
        peakDailyEquity: 50000,
        dailyStartEquity: 50000,
        dailyDrawdownPct: 10.0, // 10% > 4.5% threshold
        dailyDrawdownUsd: 5000,
        isCircuitBreakerTripped: true,
        circuitBreakerReason: 'Daily Max Drawdown Circuit Breaker Tripped: 10.00% >= 4.5% threshold.',
      }

      const processed = processOrderPipeline(sampleSignal, trippedBalanceSheet)
      expect(processed.status).toBe('REJECTED')
      expect(processed.stageReached).toBe('RISK_CHECK')
      expect(processed.rejectReason).toContain('CIRCUIT_BREAKER_ACTIVE')
    })

    it('preserves PAUSED bot status when locking and unlocking bots', () => {
      // Pause Scalper manually
      engine.toggleBot('bot_scalper_btc')
      expect(engine.getBot('bot_scalper_btc')?.status).toBe('PAUSED')
      expect(engine.getBot('bot_gold_hunter')?.status).toBe('ACTIVE')

      // Trip circuit breaker
      engine.lockAllBots()
      expect(engine.getBot('bot_scalper_btc')?.status).toBe('PAUSED') // Remains paused!
      expect(engine.getBot('bot_gold_hunter')?.status).toBe('LOCKED_BY_CIRCUIT_BREAKER')

      // Recover circuit breaker
      engine.unlockAllBots()
      expect(engine.getBot('bot_scalper_btc')?.status).toBe('PAUSED') // Still paused, not activated!
      expect(engine.getBot('bot_gold_hunter')?.status).toBe('ACTIVE') // Resumed active
    })
  })

  // =========================================================================
  // 4. Pre-trade risk checks in evaluateOrderRisk
  // =========================================================================
  describe('Vector 4: Pre-Trade Risk Checks in evaluateOrderRisk', () => {
    const baseSheet: AccountBalanceSheet = {
      cashBalance: 50000,
      equity: 50000,
      marginUsed: 10000,
      freeMargin: 40000,
      marginLevelPct: 500,
      peakDailyEquity: 50000,
      dailyStartEquity: 50000,
      dailyDrawdownPct: 0,
      dailyDrawdownUsd: 0,
      isCircuitBreakerTripped: false,
    }

    it('strictly rejects orders exceeding available free margin', () => {
      // 1. Order requesting margin greater than freeMargin ($40,000.01 vs $40,000.00)
      const excessiveMarginOrder: NewOrderRequest = {
        symbol: 'BTC/USDT',
        side: 'BUY',
        size: 0.1,
        price: 114000,
        leverage: 10,
        marginRequired: 40000.01,
      }
      const res1 = evaluateOrderRisk(excessiveMarginOrder, baseSheet)
      expect(res1.allowed).toBe(false)
      expect(res1.reason).toContain('INSUFFICIENT_MARGIN')

      // 2. Order requesting exact free margin ($40,000.00) -> Allowed
      const exactMarginOrder: NewOrderRequest = {
        ...excessiveMarginOrder,
        marginRequired: 40000.00,
      }
      const res2 = evaluateOrderRisk(exactMarginOrder, baseSheet)
      expect(res2.allowed).toBe(true)

      // 3. Zero free margin rejects any non-zero margin order
      const zeroFreeSheet: AccountBalanceSheet = { ...baseSheet, freeMargin: 0 }
      const anyMarginOrder: NewOrderRequest = {
        ...excessiveMarginOrder,
        marginRequired: 0.01,
      }
      const res3 = evaluateOrderRisk(anyMarginOrder, zeroFreeSheet)
      expect(res3.allowed).toBe(false)
      expect(res3.reason).toContain('INSUFFICIENT_MARGIN')
    })

    it('strictly rejects orders when account already has 10 or more open positions', () => {
      const order: NewOrderRequest = {
        symbol: 'BTC/USDT',
        side: 'BUY',
        size: 0.1,
        price: 114000,
        leverage: 10,
        marginRequired: 1140,
        currentOpenPositionsCount: 10,
      }

      // At exactly 10 positions -> REJECTED
      const res10 = evaluateOrderRisk(order, baseSheet)
      expect(res10.allowed).toBe(false)
      expect(res10.reason).toContain('MAX_POSITIONS_REACHED')
      expect(res10.reason).toContain('10 open positions')

      // At 11 positions -> REJECTED
      const res11 = evaluateOrderRisk({ ...order, currentOpenPositionsCount: 11 }, baseSheet)
      expect(res11.allowed).toBe(false)
      expect(res11.reason).toContain('MAX_POSITIONS_REACHED')

      // At 9 positions -> ALLOWED
      const res9 = evaluateOrderRisk({ ...order, currentOpenPositionsCount: 9 }, baseSheet)
      expect(res9.allowed).toBe(true)
    })

    it('strictly rejects orders exceeding $50,000 notional value', () => {
      // 1. Notional = $50,000.01 ($0.50 * $100,000.02) -> REJECTED
      const excessiveNotionalOrder: NewOrderRequest = {
        symbol: 'BTC/USDT',
        side: 'BUY',
        size: 0.5,
        price: 100000.02, // 0.5 * 100000.02 = $50,000.01
        leverage: 10,
        marginRequired: 5000,
      }
      const res1 = evaluateOrderRisk(excessiveNotionalOrder, baseSheet)
      expect(res1.allowed).toBe(false)
      expect(res1.reason).toContain('MAX_SIZE_EXCEEDED')
      expect(res1.reason).toContain('limit $50000')

      // 2. Notional = $50,000.00 (exact boundary) -> ALLOWED
      const exactNotionalOrder: NewOrderRequest = {
        ...excessiveNotionalOrder,
        price: 100000.00, // 0.5 * 100000.00 = $50,000.00
      }
      const res2 = evaluateOrderRisk(exactNotionalOrder, baseSheet)
      expect(res2.allowed).toBe(true)

      // 3. Massive institutional order ($150,000 notional) -> REJECTED
      const hugeOrder: NewOrderRequest = {
        symbol: 'BTC/USDT',
        side: 'BUY',
        size: 1.5,
        price: 100000.00, // $150,000
        leverage: 10,
        marginRequired: 15000,
      }
      const res3 = evaluateOrderRisk(hugeOrder, baseSheet)
      expect(res3.allowed).toBe(false)
      expect(res3.reason).toContain('MAX_SIZE_EXCEEDED')
    })

    it('strictly rejects orders with excessive leverage (>100x)', () => {
      const highLeverageOrder: NewOrderRequest = {
        symbol: 'EUR/USD',
        side: 'BUY',
        size: 1.0,
        price: 1.08,
        leverage: 101, // > 100x
        marginRequired: 100,
      }
      const res = evaluateOrderRisk(highLeverageOrder, baseSheet)
      expect(res.allowed).toBe(false)
      expect(res.reason).toContain('LEVERAGE_EXCEEDED')
    })
  })

  // =========================================================================
  // 5. Free margin calculation non-negativity
  // =========================================================================
  describe('Vector 5: Free Margin Calculation Non-Negativity & Balance Sheet Sync', () => {
    it('guarantees freeMargin = Math.max(0, equity - marginUsed) is strictly non-negative when underwater', () => {
      // Scenario A: Massive unrealized losses exceeding cash balance (account equity negative)
      const underwaterPositions: Position[] = [
        {
          id: 'pos_underwater',
          symbol: 'BTC/USDT',
          side: 'LONG',
          size: 1.0,
          entryPrice: 100000,
          markPrice: 70000,
          liquidationPrice: 60000,
          leverage: 10,
          margin: 10000,
          unrealizedPnl: -30000, // -$30k loss on $10k cash
          unrealizedPnlPct: -300,
        },
      ]

      const sheetA = recalculateBalanceSheet(underwaterPositions, 10000, 10000, 10000)
      // equity = 10000 + (-30000) = -20000
      // marginUsed = 10000
      // raw equity - marginUsed = -30000
      expect(sheetA.equity).toBe(-20000)
      expect(sheetA.marginUsed).toBe(10000)
      expect(sheetA.freeMargin).toBe(0) // NEVER negative!
      expect(sheetA.freeMargin).not.toBeLessThan(0)

      // Scenario B: Equity is positive ($4,000) but marginUsed is greater ($6,000)
      const highMarginPositions: Position[] = [
        {
          id: 'pos_high_margin',
          symbol: 'ETH/USDT',
          side: 'LONG',
          size: 10.0,
          entryPrice: 3000,
          markPrice: 2800,
          liquidationPrice: 2500,
          leverage: 5,
          margin: 6000,
          unrealizedPnl: -2000,
          unrealizedPnlPct: -33.33,
        },
      ]

      const sheetB = recalculateBalanceSheet(highMarginPositions, 6000, 10000, 10000)
      // equity = 6000 - 2000 = 4000
      // marginUsed = 6000
      // equity - marginUsed = -2000
      expect(sheetB.equity).toBe(4000)
      expect(sheetB.marginUsed).toBe(6000)
      expect(sheetB.freeMargin).toBe(0) // Math.max(0, 4000 - 6000) = 0
      expect(sheetB.freeMargin).toBeGreaterThanOrEqual(0)
    })

    it('ratchets peakDailyEquity strictly upwards and never regresses', () => {
      const positions: Position[] = []
      let peak = 50000
      const start = 50000

      // 1. Balance = 50,000 -> Peak = 50,000
      let sheet = recalculateBalanceSheet(positions, 50000, peak, start)
      expect(sheet.peakDailyEquity).toBe(50000)

      // 2. Balance rises to 55,000 -> Peak ratchets up to 55,000
      peak = sheet.peakDailyEquity
      sheet = recalculateBalanceSheet(positions, 55000, peak, start)
      expect(sheet.peakDailyEquity).toBe(55000)

      // 3. Balance drops to 48,000 -> Peak HOLDS at 55,000 (never drops)
      peak = sheet.peakDailyEquity
      sheet = recalculateBalanceSheet(positions, 48000, peak, start)
      expect(sheet.peakDailyEquity).toBe(55000)
      expect(sheet.dailyDrawdownUsd).toBe(7000) // 55000 - 48000
      expect(sheet.dailyDrawdownPct).toBeCloseTo((7000 / 55000) * 100, 2)
    })

    it('safely handles zero margin without division by zero NaN in marginLevelPct', () => {
      const sheet = recalculateBalanceSheet([], 50000, 50000, 50000)
      expect(sheet.marginUsed).toBe(0)
      expect(sheet.marginLevelPct).toBe(999.99) // Institutional ceiling
      expect(Number.isFinite(sheet.marginLevelPct)).toBe(true)
      expect(Number.isNaN(sheet.marginLevelPct)).toBe(false)
    })

    it('Monte Carlo Fuzz verification across 10,000 random balance sheet configurations', () => {
      for (let i = 0; i < 10000; i++) {
        const cash = (Math.random() - 0.3) * 200000 // -60,000 to +140,000
        const numPositions = Math.floor(Math.random() * 8)
        const mockPositions: Position[] = []

        for (let p = 0; p < numPositions; p++) {
          const margin = Math.random() * 10000
          const pnl = (Math.random() - 0.5) * 40000 // -20,000 to +20,000
          mockPositions.push({
            id: `fuzz_pos_${p}`,
            symbol: 'BTC/USDT',
            side: 'LONG',
            size: 1.0,
            entryPrice: 100000,
            markPrice: 100000,
            liquidationPrice: 90000,
            leverage: 10,
            margin,
            unrealizedPnl: pnl,
            unrealizedPnlPct: 10,
          })
        }

        const peak = Math.max(50000, cash)
        const sheet = recalculateBalanceSheet(mockPositions, cash, peak, 50000)

        // INVARIANTS:
        expect(Number.isFinite(sheet.freeMargin)).toBe(true)
        expect(sheet.freeMargin).toBeGreaterThanOrEqual(0)
        expect(sheet.freeMargin.toString()).not.toBe('-0')
        expect(Number.isFinite(sheet.equity)).toBe(true)
        expect(Number.isFinite(sheet.marginUsed)).toBe(true)
        expect(Number.isFinite(sheet.marginLevelPct)).toBe(true)
        expect(Number.isFinite(sheet.dailyDrawdownPct)).toBe(true)
        expect(sheet.dailyDrawdownPct).toBeGreaterThanOrEqual(0)
      }
    })
  })
})
