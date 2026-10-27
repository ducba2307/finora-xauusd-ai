## 2026-10-11T21:20:00Z
You are worker_m4 (teamwork_preview_worker).
Your working directory: d:\VIBECODE\finora-trading-ai\.agents\teamwork\worker_m4
Project workspace root: d:\VIBECODE\finora-trading-ai

MANDATORY FIRST STEP:
Read the authoritative user request at:
d:\VIBECODE\finora-trading-ai\.agents\teamwork\ORIGINAL_REQUEST.md

Also read the three Explorer blueprints:
1. F14 Blueprint: d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m4_1\handoff.md
2. F15 Blueprint: d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m4_2\handoff.md
3. F16 Blueprint: d:\VIBECODE\finora-trading-ai\.agents\teamwork\explorer_m4_3\handoff.md
Also read PROJECT.md at d:\VIBECODE\finora-trading-ai\.agents\teamwork\PROJECT.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Mission: Implement Milestone 4 (R4: Production Reliability, Error Boundaries & SaaS Hardening):

1. Feature F14 — Multi-Level Error Boundaries & Bounded Memory Buffers:
   - Create `src/components/ErrorBoundary.tsx` implementing:
     - `ErrorBoundary` class component supporting `fallback`, `fallbackType` ('root' | 'view' | 'widget'), and `onReset`.
     - `RootErrorFallback`, `ViewErrorFallback`, `WidgetErrorFallback` components.
     - `BoundedCandleBuffer<T>` class with strict eviction (`maxSize = 100`), `.push(item)`, `.get()`, `.clear()`, and `.size()`.
     - `NetworkStateMachine` and `NetworkState` exports conforming to `src/test/tier1_features/errorBoundaries.test.ts`.
   - Update `src/main.tsx` to wrap `<App />` in root `<ErrorBoundary fallback={<RootErrorFallback />}>`.
   - Update `src/App.tsx` to wrap each view tab (`terminal`, `quant_studio`, `journal`, `whale_radar`, `ai_intel`, `trader_tools`, `portfolio`, `landing`) in view-level `<ErrorBoundary>`.
   - Update `src/components/TradingDashboard.tsx` to wrap widgets (`TradingViewChart`, `OrderBookWidget`, `OrderEntryWidget`, `SwapWidget`, `AISwarmConsensusWidget`, `PositionsTable`) in widget-level `<ErrorBoundary>`.
   - Enforce bounded candle memory (`MAX_CANDLES = 100`) in `src/hooks/useLiveMarketFeed.ts`, and bounded trade/alert histories in `src/App.tsx`.

2. Feature F15 — Network State Machine & UI Telemetry:
   - Create `src/services/networkManager.ts` implementing `NetworkStateMachine` with exponential backoff (1s -> 2s -> 4s -> 8s -> 16s with ±25% jitter), max 5 retries before `OFFLINE`, browser online/offline event listeners, and ping/latency EMA smoothing.
   - Create `src/hooks/useNetworkState.ts` reactive hook.
   - Create `src/components/NetworkStatusBadge.tsx` with live green/amber/red indicators, ping latency, countdown timer, and manual "Reconnect Now" button.
   - Update `src/components/Navbar.tsx` to render `<NetworkStatusBadge />` in both desktop header and mobile menu.
   - Update `src/hooks/useLiveMarketFeed.ts` to sync WebSocket events with `defaultNetworkManager`.
   - Add sound chimes in `src/utils/soundEffects.ts` (`playNetworkRestoredSound` and `playNetworkLostSound`).
   - Add automated test suite `src/test/tier1_features/networkStateMachine.test.ts`.

3. Feature F16 — Vite Code-Splitting, Chunk Optimization & Oxlint Cleanliness:
   - Update `vite.config.ts` with `rollupOptions.output.manualChunks` per `explorer_m4_3`'s blueprint to split `charts-vendor` (`lightweight-charts`), `react-vendor` (`react`, `react-dom`), and `lucide-vendor` (`lucide-react`), ensuring all chunks are < 500 kB without Vite warnings.
   - Resolve Oxlint warnings across the files identified in `explorer_m4_3/handoff.md` so that `pnpm lint` completes cleanly with 0 errors and 0 warnings.
   - Ensure `tsc -b && vite build` and `pnpm test -- --run` pass cleanly.

Verification Steps to Execute:
1. `pnpm test -- --run`: verify all tests pass with 0 failures.
2. `tsc -b && vite build` (or `pnpm build`): verify exit code 0 and clean chunk sizes < 500 kB.
3. `pnpm lint`: verify exit code 0 and 0 errors.

Document everything in `d:\VIBECODE\finora-trading-ai\.agents\teamwork\worker_m4\handoff.md` with:
1. Observation
2. Logic Chain
3. Caveats
4. Conclusion
5. Verification Method & Output

Notify caller via send_message when done.
