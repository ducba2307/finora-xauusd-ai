# Project: Finora Quant AI Trading Platform Institutional Upgrade

## Architecture
Finora is a multi-asset quantitative trading platform (Forex, Gold XAU/USD, Crypto BTC/ETH/SOL) designed for institutional precision and professional SaaS stability.
The platform architecture consists of four tightly-coupled foundational layers:
1. **Market Data & Execution Layer**: High-frequency streaming ticker registry, hybrid Binance WebSocket for Crypto, Geometric Brownian Motion ECN simulation for Forex/Gold, square-root slippage model, dynamic spreads, and sub-frame chart updates.
2. **Quantitative Mathematics & Backtesting Engine**: Deterministic bar-by-bar simulator with zero look-ahead bias, point-in-time technical alpha indicators (EMA, SMA, RSI, MACD, Bollinger, ATR, SMC Fair Value Gaps), and guaranteed finite statistical metrics (Sharpe, Sortino, Calmar, Max Drawdown, Expectancy in R, R-Distribution).
3. **Autonomous AI Bot & Account Risk Layer**: Continuous background strategy loops for 4 AI bots, full 6-stage order lifecycle (`Signal -> Validation -> Risk Check -> Execution -> Trailing -> Exit`), and strict account-level safeguards (Daily Max Drawdown Circuit Breaker at 4.5%, Max Position Count, Margin verification, Slippage guard).
4. **Production SaaS Hardening & Reliability**: Multi-level Error Boundaries (global, view, widget), memory-leak prevention via bounded buffers, 3-state network manager (`ONLINE`, `RECONNECTING`, `OFFLINE`), and Vite code-splitting for sub-second page loads.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F01 | Centralized Market Data Store | Multi-asset ticker registry (bid, ask, spread, 24h stats, connection status) decoupled from page lifecycle | M1 | survey_explorer_1 |
| F02 | Calibrated Market Feed Engine | Hybrid Binance WS for Crypto + ECN GBM simulation for Forex/Gold; eliminate WS & fallbackInterval collision; clean candle boundaries | M1 | survey_explorer_1 |
| F03 | Realistic Spread & Slippage Model | Institutional spreads (FX: 0.2-0.4 pips, Gold: 1.2-2.5 pips, BTC: $1-3); square-root volume slippage; realistic depth; dynamic swap rates | M1 | survey_explorer_1 |
| F04 | High-Performance Chart & UI Jitter Fix | Lightweight-charts O(1) `series.update()` on ticks; RAF tick batching; fix OrderEntryWidget limit price overwrite bug | M1 | survey_explorer_1 |
| F05 | High-Precision Currency & Pip Formatter | 5 decimals for EUR/USD & GBP/USD; 3 for JPY; 2 for Metals/Crypto; no '$' prefix on Forex exchange rates | M1 | survey_explorer_1 |
| F06 | Universal Financial Math Engine (`metrics.ts`) | Sharpe, Sortino (downside semi-variance), Calmar ($CAGR/\|MDD\|$), Max Drawdown, Expectancy ($ and R), R-Distribution, 100% NaN/Infinity immune | M2 | survey_explorer_2 |
| F07 | Point-in-Time Alpha Indicator Library (`indicators.ts`) | EMA, SMA, RSI 14 (Wilder), MACD (fast/slow/signal), Bollinger Bands (20, 2σ), ATR 14, SMC Fair Value Gaps & Order Blocks | M2 | survey_explorer_2 |
| F08 | Deterministic Bar-by-Bar Backtest Engine (`backtestEngine.ts`) | Sequential candle simulator with next-bar execution modeling, slippage, spread, fees, dynamic equity curve; UI integration in QuantStudioView | M2 | survey_explorer_2 |
| F09 | Dynamic Trading Journal Analytics | Real calculations replacing static mock text in TradingJournalView; dynamic 7-bucket R-distribution; fix SVG `(idx / (length - 1))` NaN crash | M2 | survey_explorer_2 |
| F10 | Autonomous AI Bot Execution Engine (`botEngine.ts`) | Background strategy loops for the 4 AI bots (Scalper, Gold Hunter, Macro Sentinel, Whale Flow) across Crypto & Forex | M3 | survey_explorer_3 |
| F11 | 6-Stage Order Lifecycle Pipeline | `Signal -> Validation -> Risk Check -> Execution -> Trailing -> Exit`; high-water mark trailing stop ratchet; automated TP/SL/Liquidation tick monitor | M3 | survey_explorer_3 |
| F12 | Account Risk Engine & Circuit Breaker (`riskEngine.ts`) | Real-time `peakDailyEquity` tracking; Daily Max Drawdown Circuit Breaker (auto-lock at 4.5%); max position limits; margin sufficiency check | M3 | survey_explorer_3 |
| F13 | Dynamic Balance Sheet & Position Synchronization | Live position mark price and floating PnL updating on every tick; dynamic portfolio equity, margin used, free margin, margin level % | M3 | survey_explorer_3 |
| F14 | Error Boundaries & Buffer Memory Management | Global Error Boundary in main.tsx, view-level and widget-level fallbacks; bounded candle buffer (`MAX_CANDLES = 100`) preventing memory leaks | M4 | survey_explorer_3 |
| F15 | Network State Machine & Active Alerts | `ONLINE`, `RECONNECTING`, `OFFLINE` state machine with reconnect backoff; navbar status indicator; tick alert engine with Web Audio chime | M4 | survey_explorer_3 |
| F16 | Vite Code-Splitting & Oxlint Cleanliness | Vite rollup manualChunks for vendor charts/icons (< 500 kB chunks); eliminate all 12 oxlint warnings | M4 | survey_explorer_3 |
| F17 | Comprehensive Automated E2E Test Suite | Vitest test runner; comprehensive tests across Tiers 1-4 covering all features; requirement-driven opaque-box verification | E2E Testing Track | Survey synthesis |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Market Data Engine & Execution Fidelity (R1) | F01, F02, F03, F04, F05 | none | DONE |
| M2 | Quant Math, Alpha Indicators & Backtest Engine (R2) | F06, F07, F08, F09 | none | DONE |
| M3 | AI Trading Bots, Order Lifecycle & Account Risk Engine (R3) | F10, F11, F12, F13 | M1, M2 | DONE |
| M4 | Production Reliability, Error Boundaries & SaaS Hardening (R4) | F14, F15, F16 | M1 | IN_PROGRESS |
| E2E | E2E Testing Track (Tiers 1-4) | F17 (Opaque-box test suite derivation) | none | READY (130/130 pass) |
| Final | Final Milestone: 100% E2E Pass + Tier 5 Adversarial Hardening | Pass all E2E tests + Tier 5 coverage audit | M1, M2, M3, M4, E2E | PLANNED |

## Interface Contracts

### 1. `MarketDataStore` ↔ `TradingEngine & BotEngine & UI`
- **Location**: `src/stores/marketStore.ts` or `src/services/marketDataService.ts`
- **Data Types**:
  ```typescript
  export interface MarketTicker {
    symbol: string
    category: 'CRYPTO' | 'FOREX'
    midPrice: number
    bidPrice: number
    askPrice: number
    spreadPips: number
    spreadUsd: number
    high24h: number
    low24h: number
    change24hPct: number
    volume24h: number
    lastUpdateTimestamp: number
    connectionStatus: 'LIVE_WS' | 'SIMULATED' | 'CONNECTING' | 'DISCONNECTED'
  }
  ```
- **Methods**:
  - `getTicker(symbol: string): MarketTicker | undefined`
  - `getAllTickers(): Record<string, MarketTicker>`
  - `calculateExecutionFill(symbol: string, side: 'BUY' | 'SELL', lotOrSize: number): { fillPrice: number, spreadCost: number, slippageCost: number, commission: number }`
  - `subscribeTicker(symbol: string, listener: (ticker: MarketTicker) => void): () => void`

### 2. `QuantMath` ↔ `BacktestEngine & TradingJournal & RiskEngine`
- **Location**: `src/quant/metrics.ts`
- **Methods**:
  - `safeDivide(n: number, d: number, fallback?: number): number`
  - `calculateSharpeRatio(returns: number[], riskFreeRate?: number, periodsPerYear?: number): number` (returns 0 on zero variance)
  - `calculateSortinoRatio(returns: number[], mar?: number, periodsPerYear?: number): number`
  - `calculateCalmarRatio(annualizedReturnPct: number, maxDrawdownPct: number): number`
  - `calculateMaxDrawdown(equityCurve: number[]): { maxDrawdownPct: number, maxDrawdownUsd: number, peakEquity: number, troughEquity: number }`
  - `calculateExpectancy(trades: { pnl: number, rMultiple?: number, riskUsd?: number }[]): { expectancyUsd: number, expectancyR: number, avgWinR: number, avgLossR: number, winRate: number, profitFactor: number }`
  - `calculateRDistribution(trades: { rMultiple: number, pnl: number }[]): { buckets: { bucket: string, count: number, pnl: number, pct: number, isWin?: boolean, isLoss?: boolean }[], skewness: number }`

### 3. `RiskEngine` ↔ `OrderLifecycle & App`
- **Location**: `src/engine/riskEngine.ts`
- **Methods**:
  - `evaluateOrderRisk(order: NewOrderRequest, balanceSheet: AccountBalanceSheet, riskConfig: RiskConfig): { allowed: boolean, reason?: string }`
  - `recalculateBalanceSheet(positions: Position[], cashBalance: number, peakDailyEquity: number, dailyStartEquity: number): AccountBalanceSheet`
  - `checkCircuitBreaker(dailyDrawdownPct: number, maxThresholdPct: number): { isTripped: boolean, reason?: string }`

## Code Layout
- `src/stores/` - Central state management (marketStore.ts, tradingStore.ts)
- `src/services/` - External connections & simulators (binanceWebSocket.ts, ecnSimulator.ts)
- `src/quant/` - Quantitative calculations (metrics.ts, indicators.ts, backtestEngine.ts)
- `src/engine/` - Trading and risk orchestration (botEngine.ts, riskEngine.ts, orderLifecycle.ts)
- `src/components/` - React UI views and widgets (ErrorBoundary.tsx, TradingDashboard.tsx, etc.)
- `src/utils/` - Utilities & formatters (formatters.ts, soundEffects.ts)
- `src/test/` - Automated test suites (unit, integration, e2e)
