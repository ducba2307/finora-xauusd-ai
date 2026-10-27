# Milestone 3 (R3) Architectural Blueprint: Feature F10 Autonomous AI Bot Execution Engine (`src/engine/botEngine.ts`)

**Investigator**: `explorer_m3_1` (Teamwork Explorer)  
**Date**: 2026-10-11T16:09:00Z  
**Workspace**: `d:\VIBECODE\finora-trading-ai`  
**Target File**: `src/engine/botEngine.ts` (with operational extensions in `src/types/trading.ts`)  

---

## 1. Observation

### 1.1 Current Bot Representation vs. Missing Execution Engine
1. **File**: `src/types/trading.ts` (lines 120–132)
   ```typescript
   export interface AIBotStrategy {
     id: string
     name: string
     model: string
     description: string
     status: 'ACTIVE' | 'PAUSED'
     winRate: number
     tradesCount: number
     profitPct: number
     riskLevel: 'LOW' | 'MEDIUM' | 'AGGRESSIVE'
     allocationUsd: number
     targetMarket?: MarketCategory
   }
   ```
   *Observation*: The existing `AIBotStrategy` interface is strictly descriptive UI metadata. It lacks runtime operational fields: `type` (`BotType`), `symbol`, `defaultLeverage`, `maxDrawdownPct`, `stopLossPct`, `takeProfitPct`, `trailingDistancePct`, `cooldownSec`, `maxOpenPositions`, `lastSignalTimestamp`, and live execution metrics (`activeOrdersCount`, `currentDailyLossUsd`). Furthermore, `status` only accepts `'ACTIVE' | 'PAUSED'` and does not support `'LOCKED_BY_CIRCUIT_BREAKER'`, which is required by the institutional risk circuit breaker.

2. **File**: `src/data/mockData.ts` (lines 713–766)
   Defines the 4 default AI Bots:
   - `bot-1`: `'Neural Alpha Scalper v4'` (Model: `Finora Deep Transformer 4.5`, Market: `CRYPTO`, WinRate: `88.4%`, Allocation: `$5,000`)
   - `bot-2`: `'XAUUSD Gold ICT Hunter'` (Model: `Smart Money M5/M15 SMC Engine`, Market: `FOREX`, WinRate: `94.6%`, Allocation: `$8,000`)
   - `bot-3`: `'Macro Sentinel News Bot'` (Model: `NLP Fed & NFP Economic Quant`, Market: `FOREX`, WinRate: `91.2%`, Allocation: `$4,500`)
   - `bot-4`: `'Whale Flow Accumulator'` (Model: `Smart Money On-Chain Radar`, Market: `CRYPTO`, WinRate: `93.1%`, Allocation: `$4,500`)

3. **File**: `src/App.tsx` (lines 58, 120–128) and `src/components/BotControlModal.tsx` (lines 120–130)
   ```typescript
   const [bots, setBots] = useState<AIBotStrategy[]>(INITIAL_AI_BOTS)
   ...
   const handleToggleBot = (botId: string) => {
     setBots((prev) =>
       prev.map((b) =>
         b.id === botId
           ? { ...b, status: b.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' }
           : b
       )
     )
   }
   ```
   *Observation*: Toggling a bot simply mutates a string flag in local component state. There is no active execution loop, no subscription to live market ticks, no indicator evaluation, and no signal emission.

### 1.2 Test Harness Expectations and Contract Architecture
1. **File**: `src/test/contracts/engine/botEngine.ts` (lines 8–67)
   ```typescript
   export type BotType = 'SCALPER' | 'GOLD_HUNTER' | 'MACRO_SENTINEL' | 'WHALE_FLOW'

   export interface BotInstance {
     id: string
     name: string
     type: BotType
     targetMarket: 'CRYPTO' | 'FOREX'
     symbol: string
     status: 'ACTIVE' | 'PAUSED' | 'LOCKED_BY_CIRCUIT_BREAKER'
     defaultLeverage: number
     riskAllocationUsd: number
     tradesCount: number
   }
   ```
   *Observation*: The test suite requires `BotType` union (`'SCALPER' | 'GOLD_HUNTER' | 'MACRO_SENTINEL' | 'WHALE_FLOW'`), `BotInstance` interface, `INITIAL_BOT_INSTANCES` constant, and `evaluateBotStrategy(bot: BotInstance, marketInput: ...): OrderSignal | null`.

2. **File**: `vitest.config.ts` (lines 8–35)
   ```typescript
   const contractFallbackPlugin = () => ({
     name: 'contract-fallback',
     resolveId(id: string) { ... if (!existsInSrc) { return p in src/test/contracts } }
   })
   ```
   *Observation*: The Vitest runner uses `contractFallbackPlugin` to resolve `@/engine/*` imports to `src/test/contracts/engine/*` when the real files do not exist in `src/engine/`. However, `tsconfig.app.json` excludes `src/test`, so production `pnpm build` (`tsc -b && vite build`) will fail until concrete implementations exist in `src/engine/`.

3. **File**: `src/test/tier3_pairwise/botSignalCircuitBreaker.test.ts` (lines 11–88)
   Directly tests:
   - `INITIAL_BOT_INSTANCES.find(b => b.type === 'GOLD_HUNTER')`
   - `evaluateBotStrategy(goldBot, { price: 2715.0, rsi: 25.0 })` returning a `BUY` signal on `XAU/USD`.
   - Passing signal into `processOrderPipeline(signal, safeBalanceSheet)`.
   - Bot status `'LOCKED_BY_CIRCUIT_BREAKER'` returning `null` (zero signals).

4. **File**: `src/test/tier4_realworld/cryptoCascadeCircuitTrip.test.ts` (lines 40–47)
   Directly tests:
   - `INITIAL_BOT_INSTANCES.find(b => b.type === 'SCALPER')`
   - `evaluateBotStrategy(scalperBot, { price: 112000.0, ema20: 112500.0, ema50: 112100.0, rsi: 62.0 })` returning momentum long signal on `BTC/USDT`.

### 1.3 Technical Indicators and Market Store Integration
1. **File**: `src/quant/indicators.ts`:
   - `calculateEMA(prices: number[], period: number): number[]` (lines 31–50)
   - `calculateRSI(prices: number[], period?: number): number[]` (lines 52–118)
   - `calculateMACD(prices: number[], fast?: number, slow?: number, signal?: number): MACDResult` (lines 126–154)
   - `calculateATR(candles: { high, low, close }[], period?: number): number[]` (lines 213–251)
   - `detectFairValueGaps(candles: ...): FairValueGap[]` (lines 262–314)
   - `detectOrderBlocks(candles: ...): OrderBlock[]` (lines 324–370)
   - `detectSMCZones(candles: ...): SMCZonesResult` (lines 377–387)
   *Observation*: All alpha indicator functions are 100% NaN-safe, zero look-ahead bias, and ready for point-in-time calculation by bot strategies.

2. **File**: `src/stores/marketStore.ts` (lines 26–334):
   - `defaultMarketStore.subscribeTicker(symbol, listener): () => void` (lines 275–285)
   - `defaultMarketStore.subscribeAll(listener): () => void` (lines 287–292)
   - `defaultMarketStore.calculateExecutionFill(symbol, side, lotOrSize)` (lines 228–273): applies square-root slippage and institutional spread.
   - `defaultMarketStore.getTicker(symbol): MarketTicker | undefined` (lines 181–184)
   *Observation*: `MarketDataStore` provides a decoupled pub/sub event bus with cleanup unsubscribe functions, making it the ideal streaming source for `BotExecutionEngine`.

---

## 2. Logic Chain

```
[Observation 1.1: AIBotStrategy lacks operational fields and execution loop]
  │
  ├─> Bots cannot execute trades without knowing leverage, target symbol, SL/TP geometry, or cooldown
  ├─> React state toggle does not trigger any background worker or tick subscription
  └─> Conclusion: A real BotExecutionEngine must run independently of React component render cycles.

[Observation 1.2: Test suites test BotInstance, INITIAL_BOT_INSTANCES & evaluateBotStrategy]
  │
  ├─> Existing test files (botSignalCircuitBreaker, cryptoCascadeCircuitTrip) strictly expect
  │   BotType ('SCALPER' | 'GOLD_HUNTER' | 'MACRO_SENTINEL' | 'WHALE_FLOW')
  │   and evaluateBotStrategy(bot, marketInput) returning OrderSignal | null
  └─> Conclusion: The engine must export both the pure functional evaluateBotStrategy for unit tests
      and the stateful BotExecutionEngine class for live runtime trading.

[Observation 1.3: Indicators & MarketStore pub/sub are fully implemented and NaN-safe]
  │
  ├─> marketStore emits ticks across Forex, Gold, and Crypto every 1.2s
  ├─> indicators.ts provides Wilder RSI, EMA, ATR, and SMC zones without lookahead bias
  └─> Conclusion: BotExecutionEngine can subscribe to defaultMarketStore, maintain rolling candle
      buffers per symbol (bounded to 100 bars to prevent memory leaks), and compute alpha signals on ticks.

[Observation 1.2.2 & 1.3.1: Circuit Breaker and Lifecycle Integration]
  │
  ├─> When daily drawdown >= 4.5%, riskEngine trips the circuit breaker
  ├─> When tripped, botEngine must automatically lock bots ('LOCKED_BY_CIRCUIT_BREAKER')
  └─> Conclusion: botEngine must inspect account balanceSheet or listen to riskEngine before firing.
```

---

## 3. Caveats

1. **Dual Bot Identification**: In `src/data/mockData.ts`, bot IDs are `'bot-1'`, `'bot-2'`, `'bot-3'`, `'bot-4'`, while in test contracts they are `'bot_scalper_btc'`, `'bot_gold_hunter'`, `'bot_macro_sentinel'`, `'bot_whale_flow'`. The engine design must support dual ID resolution (aliasing `'bot-1'` to `SCALPER`, `'bot-2'` to `GOLD_HUNTER`, etc.) so that both the existing UI and the test suites work seamlessly without regressions.
2. **Execution Timing & Cooldowns**: While unit tests evaluate single point-in-time ticks without delays, live market execution requires a cooldown timer (e.g. 15s to 60s) and open position check to prevent rapid duplicate order generation on consecutive market ticks.
3. **Execution Environment**: In browser environments, ticks are fed via WebSocket/GBM simulator; in Vitest Node environments, timer intervals in `marketStore` are disabled by default. The engine must support both event-driven tick processing (`onTick`) and pure functional evaluation (`evaluateBotStrategy`).

---

## 4. Conclusion & Complete Architectural Blueprint

### 4.1 Type System Extensions (`src/types/trading.ts` & `src/engine/botEngine.ts`)

#### Extension to `src/types/trading.ts`:
```typescript
export type BotType = 'SCALPER' | 'GOLD_HUNTER' | 'MACRO_SENTINEL' | 'WHALE_FLOW'
export type BotExecutionStatus = 'ACTIVE' | 'PAUSED' | 'LOCKED_BY_CIRCUIT_BREAKER'

export interface AIBotStrategy {
  id: string
  name: string
  model: string
  description: string
  status: BotExecutionStatus
  winRate: number
  tradesCount: number
  profitPct: number
  riskLevel: 'LOW' | 'MEDIUM' | 'AGGRESSIVE'
  allocationUsd: number
  targetMarket?: MarketCategory
  // Operational extensions for institutional execution
  type?: BotType
  symbol?: string
  defaultLeverage?: number
  maxDrawdownPct?: number
  stopLossPct?: number
  takeProfitPct?: number
  trailingStopTriggerPct?: number
  trailingDistancePct?: number
  cooldownSec?: number
  maxOpenPositions?: number
  activeOrdersCount?: number
  currentDailyLossUsd?: number
  lastSignalTimestamp?: number
}
```

#### Exact Operational Interface in `src/engine/botEngine.ts`:
```typescript
import type { MarketCategory } from '@/types/trading'
import type { OrderSignal } from './orderLifecycle'

export type BotType = 'SCALPER' | 'GOLD_HUNTER' | 'MACRO_SENTINEL' | 'WHALE_FLOW'
export type BotExecutionStatus = 'ACTIVE' | 'PAUSED' | 'LOCKED_BY_CIRCUIT_BREAKER'

export interface BotInstance {
  id: string
  name: string
  type: BotType
  targetMarket: MarketCategory
  symbol: string
  status: BotExecutionStatus
  defaultLeverage: number
  riskAllocationUsd: number
  tradesCount: number
  // Operational parameters
  stopLossPct?: number
  takeProfitPct?: number
  trailingDistance?: number
  cooldownSec?: number
  maxOpenPositions?: number
  activeOrdersCount?: number
  lastSignalTimestamp?: number
}

export interface BotMarketInput {
  price: number
  rsi?: number
  ema20?: number
  ema50?: number
  atr?: number
  macdHistogram?: number
  whaleBias?: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL'
  smcZoneType?: 'BULLISH_FVG' | 'BEARISH_FVG' | 'BULLISH_OB' | 'BEARISH_OB' | 'NONE'
  economicImpact?: 'HIGH' | 'MEDIUM' | 'LOW'
  economicSentiment?: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'VOLATILITY_ALERT'
}
```

---

### 4.2 Exact Strategy Logic & Mathematical Formulas for the 4 Bots

```
+--------------------------------------------------------------------------------------------------+
|                                4 INSTITUTIONAL AI BOT ALPHA MODELS                               |
+--------------------------------------------------------------------------------------------------+
| Bot 1: SCALPER (Neural Alpha Scalper v4)                                                         |
| - Target: BTC/USDT (Crypto Perps) | Leverage: 20x | Cooldown: 15s                                  |
| - Long Entry: ema20 > ema50 AND 55 < rsi < 75 AND price > 0                                      |
| - Sizing: size = Number(((riskAllocationUsd * 0.05) / price).toFixed(4)) (5% risk chunk)        |
| - SL: price * 0.995 (-0.5%) | TP: price * 1.015 (+1.5%, 1:3 R/R) | Trailing: price * 0.003 (0.3%) |
+--------------------------------------------------------------------------------------------------+
| Bot 2: GOLD_HUNTER (XAUUSD Gold ICT Hunter)                                                     |
| - Target: XAU/USD (Forex Metals) | Leverage: 30x | Cooldown: 30s                                  |
| - Long Entry: rsi < 30 (Oversold ICT liquidity sweep / rebound)                                 |
| - Short Entry: rsi > 70 (Overbought liquidity sweep / rejection)                                 |
| - Sizing: 0.5 standard lots (50 oz Gold)                                                         |
| - Long SL: price - 12.00 | Long TP: price + 25.00 (1:2.08 R/R) | Trailing: 8.00 USD               |
| - Short SL: price + 12.00 | Short TP: price - 25.00 | Trailing: 8.00 USD                         |
+--------------------------------------------------------------------------------------------------+
| Bot 3: MACRO_SENTINEL (Macro Sentinel News Bot)                                                  |
| - Target: EUR/USD (Forex Majors) | Leverage: 50x | Cooldown: 60s                                  |
| - Short Entry: ema20 < ema50 AND rsi < 45 (USD Strength / Euro Trend Breakdown)                  |
| - Long Entry: ema20 > ema50 AND rsi > 55 (USD Weakness / Euro Trend Breakout)                   |
| - Sizing: 1.0 standard lot (100,000 EUR)                                                         |
| - Short SL: price + 0.0030 (30 pips) | Short TP: price - 0.0075 (75 pips, 1:2.5 R/R)             |
| - Long SL: price - 0.0030 (30 pips) | Long TP: price + 0.0075 (75 pips, 1:2.5 R/R)               |
+--------------------------------------------------------------------------------------------------+
| Bot 4: WHALE_FLOW (Whale Flow Accumulator)                                                       |
| - Target: SOL/USDT (Crypto Perps) | Leverage: 10x | Cooldown: 45s                                  |
| - Long Entry: whaleBias === 'ACCUMULATION' (Heavy on-chain CEX outflow / cluster buying)         |
| - Short Entry: whaleBias === 'DISTRIBUTION' (Heavy on-chain CEX inflow / cluster dumping)        |
| - Sizing: size = Number(((riskAllocationUsd * 0.10) / price).toFixed(2)) (10% allocation)       |
| - Long SL: price * 0.96 (-4.0%) | Long TP: price * 1.10 (+10.0%, 1:2.5 R/R)                      |
| - Short SL: price * 1.04 (+4.0%) | Short TP: price * 0.90 (-10.0%, 1:2.5 R/R)                     |
+--------------------------------------------------------------------------------------------------+
```

#### Pure Function Implementation (`evaluateBotStrategy`):
```typescript
export function evaluateBotStrategy(
  bot: BotInstance,
  marketInput: BotMarketInput
): OrderSignal | null {
  // 1. Guard against inactive or circuit-locked states
  if (bot.status !== 'ACTIVE') return null
  if (!Number.isFinite(marketInput.price) || marketInput.price <= 0) return null

  const { price, rsi, ema20, ema50, whaleBias } = marketInput
  const now = Date.now()

  // 2. SCALPER: Momentum breakout with EMA20 > EMA50 and RSI in bullish acceleration band (55..75)
  if (bot.type === 'SCALPER') {
    if (ema20 && ema50 && ema20 > ema50 && rsi && rsi > 55 && rsi < 75) {
      const size = Number(((bot.riskAllocationUsd * 0.05) / price).toFixed(4))
      if (size <= 0 || !Number.isFinite(size)) return null
      return {
        id: `sig_${bot.id}_${now}`,
        symbol: bot.symbol,
        side: 'BUY',
        size,
        price,
        leverage: bot.defaultLeverage,
        slPrice: Number((price * 0.995).toFixed(2)),
        tpPrice: Number((price * 1.015).toFixed(2)),
        trailingDistance: Number((price * 0.003).toFixed(2)),
        botId: bot.id,
      }
    }
  }

  // 3. GOLD_HUNTER: Volatility bounce on extreme oversold Gold (RSI < 30)
  if (bot.type === 'GOLD_HUNTER') {
    if (rsi && rsi < 30) {
      return {
        id: `sig_${bot.id}_${now}`,
        symbol: bot.symbol,
        side: 'BUY',
        size: 0.5, // 0.5 standard lot
        price,
        leverage: bot.defaultLeverage,
        slPrice: Number((price - 12.0).toFixed(2)),
        tpPrice: Number((price + 25.0).toFixed(2)),
        trailingDistance: 8.0,
        botId: bot.id,
      }
    }
    // Symmetrical overbought sweep
    if (rsi && rsi > 70) {
      return {
        id: `sig_${bot.id}_${now}`,
        symbol: bot.symbol,
        side: 'SELL',
        size: 0.5,
        price,
        leverage: bot.defaultLeverage,
        slPrice: Number((price + 12.0).toFixed(2)),
        tpPrice: Number((price - 25.0).toFixed(2)),
        trailingDistance: 8.0,
        botId: bot.id,
      }
    }
  }

  // 4. MACRO_SENTINEL: Trend following breakdown on Forex majors (EMA20 < EMA50 & RSI < 45)
  if (bot.type === 'MACRO_SENTINEL') {
    if (ema20 && ema50 && ema20 < ema50 && rsi && rsi < 45) {
      return {
        id: `sig_${bot.id}_${now}`,
        symbol: bot.symbol,
        side: 'SELL',
        size: 1.0, // 1.0 standard lot
        price,
        leverage: bot.defaultLeverage,
        slPrice: Number((price + 0.0030).toFixed(5)),
        tpPrice: Number((price - 0.0075).toFixed(5)),
        botId: bot.id,
      }
    }
    // Symmetrical Euro breakout
    if (ema20 && ema50 && ema20 > ema50 && rsi && rsi > 55) {
      return {
        id: `sig_${bot.id}_${now}`,
        symbol: bot.symbol,
        side: 'BUY',
        size: 1.0,
        price,
        leverage: bot.defaultLeverage,
        slPrice: Number((price - 0.0030).toFixed(5)),
        tpPrice: Number((price + 0.0075).toFixed(5)),
        botId: bot.id,
      }
    }
  }

  // 5. WHALE_FLOW: High conviction large order accumulation
  if (bot.type === 'WHALE_FLOW') {
    if (whaleBias === 'ACCUMULATION') {
      const size = Number(((bot.riskAllocationUsd * 0.1) / price).toFixed(2))
      if (size <= 0 || !Number.isFinite(size)) return null
      return {
        id: `sig_${bot.id}_${now}`,
        symbol: bot.symbol,
        side: 'BUY',
        size,
        price,
        leverage: bot.defaultLeverage,
        slPrice: Number((price * 0.96).toFixed(2)),
        tpPrice: Number((price * 1.10).toFixed(2)),
        trailingDistance: Number((price * 0.025).toFixed(2)),
        botId: bot.id,
      }
    }
    if (whaleBias === 'DISTRIBUTION') {
      const size = Number(((bot.riskAllocationUsd * 0.1) / price).toFixed(2))
      if (size <= 0 || !Number.isFinite(size)) return null
      return {
        id: `sig_${bot.id}_${now}`,
        symbol: bot.symbol,
        side: 'SELL',
        size,
        price,
        leverage: bot.defaultLeverage,
        slPrice: Number((price * 1.04).toFixed(2)),
        tpPrice: Number((price * 0.90).toFixed(2)),
        trailingDistance: Number((price * 0.025).toFixed(2)),
        botId: bot.id,
      }
    }
  }

  return null
}
```

---

### 4.3 Default Bot Instances Definition (`INITIAL_BOT_INSTANCES`)

```typescript
export const INITIAL_BOT_INSTANCES: BotInstance[] = [
  {
    id: 'bot_scalper_btc',
    name: 'Neural Alpha Scalper v4',
    type: 'SCALPER',
    targetMarket: 'CRYPTO',
    symbol: 'BTC/USDT',
    status: 'ACTIVE',
    defaultLeverage: 20,
    riskAllocationUsd: 15000,
    tradesCount: 412,
    stopLossPct: 0.5,
    takeProfitPct: 1.5,
    trailingDistance: 345.0, // 0.3% of BTC price
    cooldownSec: 15,
    maxOpenPositions: 1,
    activeOrdersCount: 0,
  },
  {
    id: 'bot_gold_hunter',
    name: 'XAUUSD Gold ICT Hunter',
    type: 'GOLD_HUNTER',
    targetMarket: 'FOREX',
    symbol: 'XAU/USD',
    status: 'ACTIVE',
    defaultLeverage: 30,
    riskAllocationUsd: 20000,
    tradesCount: 185,
    stopLossPct: 0.44,
    takeProfitPct: 0.92,
    trailingDistance: 8.0,
    cooldownSec: 30,
    maxOpenPositions: 1,
    activeOrdersCount: 0,
  },
  {
    id: 'bot_macro_sentinel',
    name: 'Macro Sentinel News Bot',
    type: 'MACRO_SENTINEL',
    targetMarket: 'FOREX',
    symbol: 'EUR/USD',
    status: 'ACTIVE',
    defaultLeverage: 50,
    riskAllocationUsd: 10000,
    tradesCount: 94,
    stopLossPct: 0.28,
    takeProfitPct: 0.70,
    trailingDistance: 0.0020,
    cooldownSec: 60,
    maxOpenPositions: 1,
    activeOrdersCount: 0,
  },
  {
    id: 'bot_whale_flow',
    name: 'Whale Flow Accumulator',
    type: 'WHALE_FLOW',
    targetMarket: 'CRYPTO',
    symbol: 'SOL/USDT',
    status: 'ACTIVE',
    defaultLeverage: 10,
    riskAllocationUsd: 12000,
    tradesCount: 78,
    stopLossPct: 4.0,
    takeProfitPct: 10.0,
    trailingDistance: 4.85, // 2.5% of SOL price
    cooldownSec: 45,
    maxOpenPositions: 1,
    activeOrdersCount: 0,
  },
]
```

---

### 4.4 Autonomous Engine Architecture & Memory-Leak Prevention (`BotExecutionEngine`)

```
                                  [defaultMarketStore]
                                           │
                         subscribeAll(tickers) / onTick
                                           │
                                           ▼
                      +─────────────────────────────────────────+
                      |         BotExecutionEngine              |
                      +─────────────────────────────────────────+
                      | - Bounded price buffer (MAX_BARS = 100) |
                      | - Point-in-time Wilder RSI & EMA20/50   |
                      | - Re-entrancy evaluation lock           |
                      | - Per-bot cooldown timer map (15s-60s)  |
                      | - Circuit Breaker check (< 4.5% DD)     |
                      +─────────────────────────────────────────+
                                           │
                     evaluateBotStrategy(bot, marketInput)
                                           │
                                           ▼
                                 [Generated OrderSignal]
                                           │
                                           ▼
                          [processOrderPipeline(signal)]
                                           │
                          Stage 2: validateOrderSignal()
                          Stage 3: evaluateOrderRisk()
                          Stage 4: calculateExecutionFill()
                                           │
                                           ▼
                             [Position Created & App Sync]
```

#### Engine Class Design:
```typescript
export class BotExecutionEngine {
  private bots: Map<string, BotInstance> = new Map()
  private priceHistory: Map<string, number[]> = new Map()
  private lastSignalTimes: Map<string, number> = new Map()
  private signalListeners: Set<(signal: OrderSignal) => void> = new Set()
  private unsubscribeFeed: (() => void) | null = null
  private isEvaluating: boolean = false
  private readonly MAX_HISTORY_LEN = 100

  constructor(initialBots: BotInstance[] = INITIAL_BOT_INSTANCES) {
    for (const b of initialBots) {
      this.bots.set(b.id, { ...b })
    }
  }

  public start(marketStore: MarketDataStore = defaultMarketStore): void {
    if (this.unsubscribeFeed) return // Already running
    this.unsubscribeFeed = marketStore.subscribeAll((tickers) => {
      this.handleMarketTick(tickers)
    })
  }

  public stop(): void {
    if (this.unsubscribeFeed) {
      this.unsubscribeFeed()
      this.unsubscribeFeed = null
    }
    this.isEvaluating = false
  }

  public toggleBot(botId: string): void {
    const bot = this.bots.get(botId) || Array.from(this.bots.values()).find(b => b.id === botId || b.type === botId)
    if (!bot) return
    const nextStatus: BotExecutionStatus = bot.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    bot.status = nextStatus
    this.bots.set(bot.id, bot)
  }

  public lockAllBots(): void {
    for (const bot of this.bots.values()) {
      if (bot.status === 'ACTIVE') {
        bot.status = 'LOCKED_BY_CIRCUIT_BREAKER'
      }
    }
  }

  public unlockAllBots(): void {
    for (const bot of this.bots.values()) {
      if (bot.status === 'LOCKED_BY_CIRCUIT_BREAKER') {
        bot.status = 'ACTIVE'
      }
    }
  }

  public getBots(): BotInstance[] {
    return Array.from(this.bots.values())
  }

  public subscribeSignals(listener: (signal: OrderSignal) => void): () => void {
    this.signalListeners.add(listener)
    return () => {
      this.signalListeners.delete(listener)
    }
  }

  public handleMarketTick(tickers: Record<string, MarketTicker>): void {
    if (this.isEvaluating) return // Re-entrancy guard
    this.isEvaluating = true

    try {
      const now = Date.now()

      for (const bot of this.bots.values()) {
        if (bot.status !== 'ACTIVE') continue

        // 1. Cooldown check
        const cooldownMs = (bot.cooldownSec ?? 30) * 1000
        const lastSignal = this.lastSignalTimes.get(bot.id) ?? 0
        if (now - lastSignal < cooldownMs) continue

        // 2. Open positions limit check
        if ((bot.activeOrdersCount ?? 0) >= (bot.maxOpenPositions ?? 1)) continue

        // 3. Ticker lookup
        const ticker = tickers[bot.symbol]
        if (!ticker || !ticker.midPrice || ticker.midPrice <= 0) continue

        // 4. Bounded rolling price buffer update (prevents memory leak)
        let history = this.priceHistory.get(bot.symbol)
        if (!history) {
          history = [ticker.midPrice]
          this.priceHistory.set(bot.symbol, history)
        } else {
          history.push(ticker.midPrice)
          if (history.length > this.MAX_HISTORY_LEN) {
            history.shift() // O(1) bounded FIFO window
          }
        }

        // 5. Point-in-time indicator calculation
        const rsiSeries = calculateRSI(history, 14)
        const currentRsi = rsiSeries[rsiSeries.length - 1] ?? 50
        const ema20Series = calculateEMA(history, 20)
        const currentEma20 = ema20Series[ema20Series.length - 1] ?? ticker.midPrice
        const ema50Series = calculateEMA(history, 50)
        const currentEma50 = ema50Series[ema50Series.length - 1] ?? ticker.midPrice

        // 6. Evaluate Strategy
        const signal = evaluateBotStrategy(bot, {
          price: ticker.midPrice,
          rsi: currentRsi,
          ema20: currentEma20,
          ema50: currentEma50,
          whaleBias: bot.type === 'WHALE_FLOW' ? 'ACCUMULATION' : undefined,
        })

        if (signal) {
          this.lastSignalTimes.set(bot.id, now)
          // Dispatch signal to registered pipeline listeners
          this.signalListeners.forEach((fn) => {
            try { fn(signal) } catch { /* listener error protection */ }
          })
        }
      }
    } finally {
      this.isEvaluating = false
    }
  }
}

export const defaultBotEngine = new BotExecutionEngine()
```

---

### 4.5 6-Stage Order Lifecycle Pipeline Integration

The emitted `OrderSignal` flows directly into `processOrderPipeline` in `src/engine/orderLifecycle.ts`:
1. **Stage 1 (Signal)**: `botEngine` generates `OrderSignal`.
2. **Stage 2 (Validation)**: `validateOrderSignal(signal)` checks price sanity, positive size, valid leverage (>= 1), and stop-loss geometry (`sl < price` for BUY, `sl > price` for SELL).
3. **Stage 3 (Risk Check)**: `evaluateOrderRisk(order, balanceSheet)` validates:
   - `balanceSheet.isCircuitBreakerTripped === false`
   - `order.marginRequired <= balanceSheet.freeMargin`
   - `balanceSheet.dailyDrawdownPct < 4.5%`
   - `currentOpenPositions < maxOpenPositions`
4. **Stage 4 (Execution)**: Calculates fill price with spread & square-root slippage via `marketStore.calculateExecutionFill()`, produces DMA `Position`, reserves margin, and plays order fill chime.
5. **Stage 5 (Trailing)**: `updateTrailingStop(position, currentPrice, trailingDistance)` ratchets SL favorably on price advances; never regresses on pullbacks.
6. **Stage 6 (Exit)**: `checkPositionExitTriggers(position, currentPrice)` triggers automated exit on TP touch (`TP_HIT`), SL touch (`SL_HIT`), or liquidation threshold (`LIQUIDATION_TRIGGERED`).

---

### 4.6 Comprehensive Unit & Integration Test Scenarios (`src/test/unit/botEngine.test.ts`)

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  evaluateBotStrategy,
  BotExecutionEngine,
  INITIAL_BOT_INSTANCES,
  type BotInstance,
} from '@/engine/botEngine'
import { MarketDataStore } from '@/stores/marketStore'

describe('Unit: F10 Autonomous AI Bot Execution Engine', () => {
  let engine: BotExecutionEngine
  let store: MarketDataStore

  beforeEach(() => {
    engine = new BotExecutionEngine()
    store = new MarketDataStore()
  })

  afterEach(() => {
    engine.stop()
  })

  describe('1. SCALPER Alpha Strategy', () => {
    const scalper = INITIAL_BOT_INSTANCES.find(b => b.type === 'SCALPER')!

    it('generates Long BUY signal when EMA20 > EMA50 and RSI is in momentum band (60)', () => {
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
      expect(sig?.slPrice).toBe(114000.0 * 0.995)
      expect(sig?.tpPrice).toBe(114000.0 * 1.015)
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
  })

  describe('2. GOLD_HUNTER Alpha Strategy', () => {
    const goldBot = INITIAL_BOT_INSTANCES.find(b => b.type === 'GOLD_HUNTER')!

    it('triggers oversold bounce Long BUY signal when RSI < 30', () => {
      const sig = evaluateBotStrategy(goldBot, { price: 2715.0, rsi: 24.5 })
      expect(sig).not.toBeNull()
      expect(sig?.symbol).toBe('XAU/USD')
      expect(sig?.side).toBe('BUY')
      expect(sig?.size).toBe(0.5)
      expect(sig?.slPrice).toBe(2703.0) // 2715 - 12
      expect(sig?.tpPrice).toBe(2740.0) // 2715 + 25
      expect(sig?.trailingDistance).toBe(8.0)
    })

    it('triggers overbought rejection Short SELL signal when RSI > 70', () => {
      const sig = evaluateBotStrategy(goldBot, { price: 2755.0, rsi: 76.0 })
      expect(sig).not.toBeNull()
      expect(sig?.symbol).toBe('XAU/USD')
      expect(sig?.side).toBe('SELL')
      expect(sig?.slPrice).toBe(2767.0) // 2755 + 12
      expect(sig?.tpPrice).toBe(2730.0) // 2755 - 25
    })

    it('returns null in neutral RSI territory (35 - 65)', () => {
      expect(evaluateBotStrategy(goldBot, { price: 2735.0, rsi: 50.0 })).toBeNull()
    })
  })

  describe('3. MACRO_SENTINEL Alpha Strategy', () => {
    const macroBot = INITIAL_BOT_INSTANCES.find(b => b.type === 'MACRO_SENTINEL')!

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
      expect(sig?.slPrice).toBe(1.0855) // 1.0825 + 0.0030
      expect(sig?.tpPrice).toBe(1.0750) // 1.0825 - 0.0075
    })
  })

  describe('4. WHALE_FLOW Alpha Strategy', () => {
    const whaleBot = INITIAL_BOT_INSTANCES.find(b => b.type === 'WHALE_FLOW')!

    it('triggers Long BUY on ACCUMULATION bias', () => {
      const sig = evaluateBotStrategy(whaleBot, {
        price: 195.0,
        whaleBias: 'ACCUMULATION',
      })
      expect(sig).not.toBeNull()
      expect(sig?.symbol).toBe('SOL/USDT')
      expect(sig?.side).toBe('BUY')
      expect(sig?.slPrice).toBe(195.0 * 0.96)
      expect(sig?.tpPrice).toBe(195.0 * 1.10)
    })

    it('returns null when whaleBias is NEUTRAL or undefined', () => {
      expect(evaluateBotStrategy(whaleBot, { price: 195.0, whaleBias: 'NEUTRAL' })).toBeNull()
      expect(evaluateBotStrategy(whaleBot, { price: 195.0 })).toBeNull()
    })
  })

  describe('5. Safety Guards, Bounded Buffer & Memory Safety', () => {
    it('returns null on non-finite, negative or zero prices without throwing exceptions', () => {
      const scalper = INITIAL_BOT_INSTANCES.find(b => b.type === 'SCALPER')!
      expect(evaluateBotStrategy(scalper, { price: 0 })).toBeNull()
      expect(evaluateBotStrategy(scalper, { price: -100 })).toBeNull()
      expect(evaluateBotStrategy(scalper, { price: NaN })).toBeNull()
      expect(evaluateBotStrategy(scalper, { price: Infinity })).toBeNull()
    })

    it('returns null when bot is PAUSED or LOCKED_BY_CIRCUIT_BREAKER', () => {
      const bot = { ...INITIAL_BOT_INSTANCES[0], status: 'PAUSED' as const }
      expect(evaluateBotStrategy(bot, { price: 114000, ema20: 115000, ema50: 113000, rsi: 65 })).toBeNull()

      const lockedBot = { ...INITIAL_BOT_INSTANCES[0], status: 'LOCKED_BY_CIRCUIT_BREAKER' as const }
      expect(evaluateBotStrategy(lockedBot, { price: 114000, ema20: 115000, ema50: 113000, rsi: 65 })).toBeNull()
    })

    it('enforces rolling price buffer bound of 100 items preventing memory leaks', () => {
      for (let i = 0; i < 250; i++) {
        engine.handleMarketTick({
          'BTC/USDT': {
            symbol: 'BTC/USDT',
            category: 'CRYPTO',
            midPrice: 114000 + i,
            bidPrice: 114000 + i - 1,
            askPrice: 114000 + i + 1,
            spreadPips: 2,
            spreadUsd: 2,
            high24h: 116000,
            low24h: 112000,
            change24hPct: 2.5,
            volume24h: 1e9,
            lastUpdateTimestamp: Date.now(),
            connectionStatus: 'LIVE_WS',
          },
        })
      }
      // Access private or internal buffer verification
      const buf = (engine as unknown as { priceHistory: Map<string, number[]> }).priceHistory.get('BTC/USDT')
      expect(buf).toBeDefined()
      expect(buf!.length).toBeLessThanOrEqual(100)
    })
  })
})
```

---

## 5. Verification Method

### 5.1 Independent Verification Commands
1. **TypeScript Typecheck**:
   ```powershell
   pnpm exec tsc -b
   ```
   *Expected Result*: Clean exit with code 0 once `src/engine/botEngine.ts` is created.
2. **Full Vitest Test Suite Execution**:
   ```powershell
   pnpm test
   ```
   *Expected Result*: All existing tests (191 tests across 25 suites) + new `botEngine.test.ts` pass with 100% pass rate.
3. **Production Vite Build**:
   ```powershell
   pnpm build
   ```
   *Expected Result*: Clean exit with code 0.

### 5.2 Post-Implementation Invalidation Conditions
This architecture blueprint will be invalidated if:
1. `evaluateBotStrategy` returns non-finite numbers (NaN/Infinity) under any market input condition.
2. An active bot fires repeated orders on every tick without respecting `cooldownSec`.
3. Toggling a bot in `BotControlModal.tsx` does not activate signal processing in `defaultBotEngine`.
4. Bot signal generation continues after `isCircuitBreakerTripped === true`.
5. Price history buffer grows unbounded past 100 bars during continuous tick streaming.
