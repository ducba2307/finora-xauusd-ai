# E2E Test Infra: Finora Quant AI Trading Platform

## Test Philosophy
- Opaque-box, requirement-driven derived from `ORIGINAL_REQUEST.md` and `PROJECT.md`.
- No dependency on implementation internals; tests exercise public module interfaces and API contracts.
- Methodology: Category-Partition, Boundary Value Analysis (BVA), Pairwise Combinatorial Testing, and Real-World Workload Testing across Tiers 1-4.
- Test runner: Vitest (`pnpm test`).

## Feature Inventory Coverage
| # | Feature | Requirements Source | Tier 1 (Coverage) | Tier 2 (Boundary) | Tier 3 (Cross-Feature) | Tier 4 (Scenario) |
|---|---------|---------------------|:-----------------:|:-----------------:|:----------------------:|:-----------------:|
| 1 | F01: Market Data Store | R1: Market Data Fidelity | ≥5 tests | ≥5 tests | ✓ | ✓ |
| 2 | F02: Calibrated Feed (Hybrid/ECN) | R1: Price simulation | ≥5 tests | ≥5 tests | ✓ | ✓ |
| 3 | F03: Spread & Slippage Model | R1: Realistic execution | ≥5 tests | ≥5 tests | ✓ | ✓ |
| 4 | F04: Chart & UI Jitter/Performance | R1: Smooth 60fps updates | ≥5 tests | ≥5 tests | ✓ | ✓ |
| 5 | F05: Currency & Pip Formatter | R1: Forex/Metal precision | ≥5 tests | ≥5 tests | ✓ | ✓ |
| 6 | F06: Financial Math Metrics Engine | R2: Sharpe, Sortino, Calmar, MDD | ≥5 tests | ≥5 tests | ✓ | ✓ |
| 7 | F07: Alpha Indicators | R2: RSI, MACD, BB, ATR, SMC FVG | ≥5 tests | ≥5 tests | ✓ | ✓ |
| 8 | F08: Deterministic Backtest Engine | R2: Zero look-ahead simulator | ≥5 tests | ≥5 tests | ✓ | ✓ |
| 9 | F09: Dynamic Journal & NaN Guard | R2: R-Distribution, SVG safety | ≥5 tests | ≥5 tests | ✓ | ✓ |
| 10 | F10: Autonomous AI Bot Engine | R3: 4 Bots background execution | ≥5 tests | ≥5 tests | ✓ | ✓ |
| 11 | F11: 6-Stage Order Lifecycle | R3: Signal->Exit, Trailing stop | ≥5 tests | ≥5 tests | ✓ | ✓ |
| 12 | F12: Account Risk & Circuit Breaker | R3: Max DD 4.5% Breaker, Limits | ≥5 tests | ≥5 tests | ✓ | ✓ |
| 13 | F13: Dynamic Balance Sheet Sync | R3: Live equity/margin/PnL sync | ≥5 tests | ≥5 tests | ✓ | ✓ |
| 14 | F14: Multi-level Error Boundaries | R4: Production crash protection | ≥5 tests | ≥5 tests | ✓ | ✓ |
| 15 | F15: Network Connectivity Machine | R4: Online/Reconnecting/Offline | ≥5 tests | ≥5 tests | ✓ | ✓ |
| 16 | F16: Production Build & Oxlint | R4: Clean build, zero warnings | ≥5 tests | ≥5 tests | ✓ | ✓ |

## Test Architecture
- Test Framework: `vitest` (configured in `vitest.config.ts`, script `"test": "vitest run"` in `package.json`).
- Directory: `src/test/`
  - `src/test/tier1_features/` - Happy path tests for all 16 features.
  - `src/test/tier2_boundaries/` - Edge cases (empty arrays, single candle, zero trades, flat equity, extreme leverage, zero division, NaN guards).
  - `src/test/tier3_pairwise/` - Cross-feature combinations (Market feed + Order execution, Backtest + Risk limits, Bot engine + Circuit Breaker, etc.).
  - `src/test/tier4_realworld/` - Real-world workload scenarios (Gold news volatility breakout, Crypto flash-crash drawdown circuit trip, 100-trade journal analysis).
- Coordination: Publish `TEST_READY.md` upon completion.
