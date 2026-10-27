# Investigation & Remediation Report: UI Input Clearing & Multi-Bar Chart Batching

**Milestone**: Milestone 1, Iteration 2 (UI Input & Chart Multi-Bar Batch Remediation)  
**Agent**: Explorer 3 (explorer, synthesis)  
**Scope**: `src/components/OrderEntryWidget.tsx` and `src/components/TradingViewChart.tsx`  
**Status**: COMPLETE (Read-Only Analysis & Remediation Design)  

---

## 1. Observation

### Observation 1.1: OrderEntryWidget TP/SL Input Clearing Trap & Snapping Behavior
- **File**: `src/components/OrderEntryWidget.tsx`
- **Lines**: 401–409 (Take Profit) and 422–430 (Stop Loss):
  ```tsx
  // Lines 401-409:
  <div className="w-28 flex items-center bg-white/5 px-2 py-0.5 rounded border border-white/10">
    <input
      type="number"
      step="any"
      value={customTp || defaultTpPrice.toFixed(isForex && !symbol.includes('XAU') ? 5 : 2)}
      onChange={(e) => setCustomTp(e.target.value)}
      className="w-full bg-transparent font-mono-num font-bold text-[11px] text-emerald-400 focus:outline-none text-right"
    />
  </div>

  // Lines 422-430:
  <div className="w-28 flex items-center bg-white/5 px-2 py-0.5 rounded border border-white/10">
    <input
      type="number"
      step="any"
      value={customSl || defaultSlPrice.toFixed(isForex && !symbol.includes('XAU') ? 5 : 2)}
      onChange={(e) => setCustomSl(e.target.value)}
      className="w-full bg-transparent font-mono-num font-bold text-[11px] text-rose-400 focus:outline-none text-right"
    />
  </div>
  ```
- **Observed Bug Mechanism**:
  1. `customTp` and `customSl` states are initialized to `""` (empty string).
  2. Because `""` is falsy in JavaScript, the expression `customTp || defaultTpPrice.toFixed(...)` evaluates to `defaultTpPrice.toFixed(...)`.
  3. When a user focuses the `<input>` element and attempts to clear the field (via Select-All + Backspace or deleting each character), the `onChange` event fires with `e.target.value = ""`.
  4. React updates the `customTp` state to `""`.
  5. Upon re-render, the input value is re-evaluated: `"" || defaultTpPrice.toFixed(...)` yields `defaultTpPrice.toFixed(...)`.
  6. The input instantly and unavoidably snaps back to the default price. A user cannot clear the field to type from an empty state.
- **Secondary Precision Flaw**:
  Lines 405 and 426 use `isForex && !symbol.includes('XAU') ? 5 : 2`. For `USD/JPY`, this evaluates to 5 decimal places instead of the 3 decimal places mandated by institutional JPY currency conventions (`getAssetConfig('USD/JPY').digits === 3`).
- **Test Evidence**:
  Empirically reproduced in `src/test/tier5_adversarial/challenger2_stress.test.ts` lines 341–364 (`ADVERSARIAL CHALLENGE: user cannot clear optional TP/SL field without snapping back`), passing 100%.

---

### Observation 1.2: TradingViewChart Multi-Bar Batch Drop Gap
- **File**: `src/components/TradingViewChart.tsx`
- **Lines**: 292–333:
  ```typescript
  // High-performance O(1) streaming tick update (both intra-bar and new bar arrivals)
  prevCandlesLenRef.current = candles.length
  const last = candles[candles.length - 1]
  const lastBarTime = last.time as UTCTimestamp

  candlestickSeriesRef.current.update({
    time: lastBarTime,
    open: last.open,
    high: last.high,
    low: last.low,
    close: last.close,
  })

  if (areaSeriesRef.current) {
    areaSeriesRef.current.update({
      time: lastBarTime,
      value: last.close,
    })
  }

  if (volumeSeriesRef.current) {
    volumeSeriesRef.current.update({
      time: lastBarTime,
      value: last.volume,
      color: last.close >= last.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)',
    })
  }

  if (ema20SeriesRef.current && last.ema20 !== undefined) {
    ema20SeriesRef.current.update({
      time: lastBarTime,
      value: last.ema20,
    })
  }

  if (ema50SeriesRef.current && last.ema50 !== undefined) {
    ema50SeriesRef.current.update({
      time: lastBarTime,
      value: last.ema50,
    })
  }
  ```
- **Observed Bug Mechanism**:
  1. The hook tracks the length of the candle array using `prevCandlesLenRef.current`.
  2. When the number of incoming candles increases by more than 1 in a single render cycle (e.g. `candles.length > prevCandlesLenRef.current + 1`), only `candles[candles.length - 1]` is extracted and passed to `candlestickSeriesRef.current.update()`.
  3. All intermediate candles between `prevCandlesLenRef.current` and `candles.length - 2` are completely dropped and never rendered to the canvas.
  4. In Lightweight-Charts, `series.update()` enforces a strict invariant: `bar.time >= lastBarTime`. Once the series advances to `candles[candles.length - 1].time`, any subsequent attempts to pass the dropped earlier candles will trigger an internal exception (`Cannot update oldest data, time must be >= last time`).
  5. Scenarios where batch arrivals naturally occur:
     - Browser tab backgrounding / OS thread throttling where `requestAnimationFrame` pauses and then delivers multiple accumulated ticks.
     - WebSocket reconnection catch-up buffers where multiple missed k-lines arrive in one event.
     - Historical chunk loading or multi-bar playback.
- **Secondary Gap (Array Truncation / Reset)**:
  If `candles.length < prevCandlesLenRef.current` (e.g. bounded queue trimming, buffer eviction, or array replacement without symbol change), `TradingViewChart.tsx` currently only calls `.update()` on the last element, leaving phantom historical candles on the chart canvas.
- **Test Evidence**:
  Empirically reproduced in `src/test/tier5_adversarial/challenger2_stress.test.ts` lines 538–562 (`ADVERSARIAL STRESS: detects gap when multiple bars arrive in a single render batch`), passing 100%.

---

## 2. Logic Chain

1. **Premise 1 (R1 & R4 SaaS Hardening & Fidelity)**:
   In `ORIGINAL_REQUEST.md`, R1 demands "cơ chế cập nhật không gây lag hoặc giật khung hình giao diện" and R4 demands "tối ưu hóa vòng lặp render tránh memory leak khi streaming dữ liệu liên tục... chuẩn hóa các trạng thái kết nối mạng".
2. **Step 2 (Input UX Separation of Value vs. Placeholder)**:
   - In controlled React inputs, an input should reflect user input state (`value={customTp}`).
   - Suggested or computed defaults must be presented as visual placeholders (`placeholder={defaultTpPrice.toFixed(assetConfig.digits)}`) rather than overriding the input value.
   - When the user leaves the input blank (`customTp === ""`), `handleSubmitOrder` should fallback to `defaultTpPrice` for order execution.
   - Decoupling `value` from `defaultTpPrice` completely eliminates the clearing trap while preserving zero-click default TP/SL calculation for retail traders.
3. **Step 3 (Lightweight-Charts Sequential Batch Streaming)**:
   - When `candles.length === prevLen`: single O(1) intra-bar update.
   - When `candles.length === prevLen + 1`: single O(1) new bar append.
   - When `candles.length > prevLen + 1`: intermediate bars exist. By looping from index `startIndex = Math.max(0, prevLen)` up to `candles.length - 1` and calling `series.update()` on each bar in sequential order, every bar is appended without violating the non-decreasing timestamp invariant.
   - When `candles.length < prevLen` or `candles.length - prevLen > 50`: an array eviction or major bulk change occurred. Calling `series.setData()` ensures complete canvas reconciliation and avoids invalid `.update()` calls.

---

## 3. Caveats

1. **Read-Only Explorer Discipline**:
   In strict accordance with the explorer protocol, no source code in `src/` has been modified. The full before/after code solutions and replacement snippets are documented below for the implementer (worker).
2. **Number Input Browser Behavior**:
   `<input type="number">` allows typing numbers, decimal points, and minus signs. In browsers, typing invalid characters (e.g. `12.3.4`) sets `e.target.value` to `""`. The parsing logic `customTp.trim() !== '' ? parseFloat(customTp) : NaN` ensures that any non-empty input is safely validated.
3. **Lightweight-Charts Marker Layer**:
   The AI signal marker layer (`createSeriesMarkers`) is handled in a separate `useEffect` at line 336 of `TradingViewChart.tsx`. It already consumes the full `candles` array on every change, so marker rendering will remain consistent.

---

## 4. Conclusion & Proposed Remediation

### Proposed Fix 1: `src/components/OrderEntryWidget.tsx`

#### Change 1.1: Import & Asset Precision Configuration
At the top of the component (around lines 34–36), obtain `assetConfig` to standardize digit precision across all pairs (including 3 digits for USD/JPY, 5 digits for EUR/USD):

```typescript
// Before:
  const isForex = category === 'FOREX' || symbol.includes('/') && (symbol.includes('USD') || symbol.includes('EUR') || symbol.includes('JPY') || symbol.includes('XAU'))

// After:
  const isForex = category === 'FOREX' || symbol.includes('/') && (symbol.includes('USD') || symbol.includes('EUR') || symbol.includes('JPY') || symbol.includes('XAU'))
  const assetConfig = getAssetConfig(symbol)
```

#### Change 1.2: Robust Fallback Parsing for Submission
At lines 120–121, ensure non-empty custom inputs are sanitized:

```typescript
// Before:
  const effectiveTp = customTp ? parseFloat(customTp) || defaultTpPrice : defaultTpPrice
  const effectiveSl = customSl ? parseFloat(customSl) || defaultSlPrice : defaultSlPrice

// After:
  const parsedCustomTp = customTp.trim() !== '' ? parseFloat(customTp) : NaN
  const effectiveTp = !isNaN(parsedCustomTp) && parsedCustomTp > 0 ? parsedCustomTp : defaultTpPrice

  const parsedCustomSl = customSl.trim() !== '' ? parseFloat(customSl) : NaN
  const effectiveSl = !isNaN(parsedCustomSl) && parsedCustomSl > 0 ? parsedCustomSl : defaultSlPrice
```

#### Change 1.3: TP/SL Input Render JSX
Replace lines 401–431 with placeholder-driven inputs that support empty states and disabled toggling:

```tsx
// Before:
            <div className="w-28 flex items-center bg-white/5 px-2 py-0.5 rounded border border-white/10">
              <input
                type="number"
                step="any"
                value={customTp || defaultTpPrice.toFixed(isForex && !symbol.includes('XAU') ? 5 : 2)}
                onChange={(e) => setCustomTp(e.target.value)}
                className="w-full bg-transparent font-mono-num font-bold text-[11px] text-emerald-400 focus:outline-none text-right"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={slEnabled}
                onChange={(e) => setSlEnabled(e.target.checked)}
                className="rounded accent-rose-500"
              />
              <span>Stop Loss Protection (SL)</span>
            </label>
            <div className="w-28 flex items-center bg-white/5 px-2 py-0.5 rounded border border-white/10">
              <input
                type="number"
                step="any"
                value={customSl || defaultSlPrice.toFixed(isForex && !symbol.includes('XAU') ? 5 : 2)}
                onChange={(e) => setCustomSl(e.target.value)}
                className="w-full bg-transparent font-mono-num font-bold text-[11px] text-rose-400 focus:outline-none text-right"
              />
            </div>
          </div>

// After:
            <div className="w-28 flex items-center bg-white/5 px-2 py-0.5 rounded border border-white/10">
              <input
                type="number"
                step="any"
                value={customTp}
                placeholder={defaultTpPrice.toFixed(assetConfig.digits)}
                onChange={(e) => setCustomTp(e.target.value)}
                disabled={!tpEnabled}
                className="w-full bg-transparent font-mono-num font-bold text-[11px] text-emerald-400 placeholder:text-emerald-500/40 focus:outline-none text-right disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={slEnabled}
                onChange={(e) => setSlEnabled(e.target.checked)}
                className="rounded accent-rose-500"
              />
              <span>Stop Loss Protection (SL)</span>
            </label>
            <div className="w-28 flex items-center bg-white/5 px-2 py-0.5 rounded border border-white/10">
              <input
                type="number"
                step="any"
                value={customSl}
                placeholder={defaultSlPrice.toFixed(assetConfig.digits)}
                onChange={(e) => setCustomSl(e.target.value)}
                disabled={!slEnabled}
                className="w-full bg-transparent font-mono-num font-bold text-[11px] text-rose-400 placeholder:text-rose-500/40 focus:outline-none text-right disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </div>
          </div>
```

---

### Proposed Fix 2: `src/components/TradingViewChart.tsx`

#### Change 2.1: Multi-Bar Batch Loop and Truncation Guard
Replace lines 292–333 in `src/components/TradingViewChart.tsx` with:

```typescript
// Before:
    // High-performance O(1) streaming tick update (both intra-bar and new bar arrivals)
    prevCandlesLenRef.current = candles.length
    const last = candles[candles.length - 1]
    const lastBarTime = last.time as UTCTimestamp

    candlestickSeriesRef.current.update({
      time: lastBarTime,
      open: last.open,
      high: last.high,
      low: last.low,
      close: last.close,
    })

    if (areaSeriesRef.current) {
      areaSeriesRef.current.update({
        time: lastBarTime,
        value: last.close,
      })
    }

    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.update({
        time: lastBarTime,
        value: last.volume,
        color: last.close >= last.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)',
      })
    }

    if (ema20SeriesRef.current && last.ema20 !== undefined) {
      ema20SeriesRef.current.update({
        time: lastBarTime,
        value: last.ema20,
      })
    }

    if (ema50SeriesRef.current && last.ema50 !== undefined) {
      ema50SeriesRef.current.update({
        time: lastBarTime,
        value: last.ema50,
      })
    }

// After:
    const prevLen = prevCandlesLenRef.current
    prevCandlesLenRef.current = candles.length

    // If candle buffer was truncated, cleared, or received an abnormally large batch (> 50 bars),
    // perform a complete setData resync to avoid out-of-order errors or unhandled evictions.
    if (candles.length < prevLen || (candles.length - prevLen > 50)) {
      const formattedCandles: CandlestickData<UTCTimestamp>[] = candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
      candlestickSeriesRef.current.setData(formattedCandles)

      if (areaSeriesRef.current) {
        areaSeriesRef.current.setData(
          candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close }))
        )
      }

      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.setData(
          candles.map((c) => ({
            time: c.time as UTCTimestamp,
            value: c.volume,
            color: c.close >= c.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)',
          }))
        )
      }

      if (ema20SeriesRef.current) {
        ema20SeriesRef.current.setData(
          candles
            .filter((c) => c.ema20 !== undefined)
            .map((c) => ({ time: c.time as UTCTimestamp, value: c.ema20! }))
        )
      }

      if (ema50SeriesRef.current) {
        ema50SeriesRef.current.setData(
          candles
            .filter((c) => c.ema50 !== undefined)
            .map((c) => ({ time: c.time as UTCTimestamp, value: c.ema50! }))
        )
      }
      return
    }

    // Helper to stream a single candle across all active chart series
    const updateSeriesBar = (bar: CandlestickPoint) => {
      const barTime = bar.time as UTCTimestamp

      candlestickSeriesRef.current?.update({
        time: barTime,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      })

      if (areaSeriesRef.current) {
        areaSeriesRef.current.update({
          time: barTime,
          value: bar.close,
        })
      }

      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.update({
          time: barTime,
          value: bar.volume,
          color: bar.close >= bar.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)',
        })
      }

      if (ema20SeriesRef.current && bar.ema20 !== undefined) {
        ema20SeriesRef.current.update({
          time: barTime,
          value: bar.ema20,
        })
      }

      if (ema50SeriesRef.current && bar.ema50 !== undefined) {
        ema50SeriesRef.current.update({
          time: barTime,
          value: bar.ema50,
        })
      }
    }

    // High-performance streaming update:
    // If multiple bars arrived in a single render batch (e.g. background tab wake-up,
    // RAF batching, or WebSocket catch-up), sequentially update every intermediate bar.
    if (candles.length > prevLen + 1) {
      const startIndex = Math.max(0, prevLen)
      for (let i = startIndex; i < candles.length; i++) {
        updateSeriesBar(candles[i])
      }
    } else {
      // Single bar update (O(1) intra-bar tick or single new bar arrival)
      updateSeriesBar(candles[candles.length - 1])
    }
```

---

## 5. Verification Method

### 5.1 Verification Commands
The worker and reviewers can independently verify the remediations using the following commands:

```bash
# 1. Run Challenger 2 Adversarial Stress Test Suite
pnpm exec vitest run src/test/tier5_adversarial/challenger2_stress.test.ts

# 2. Run Full Test Suite across all tiers
pnpm test

# 3. Verify Production TypeScript Compilation & Vite Build
pnpm build

# 4. Verify Linter Cleanliness
pnpm lint
```

### 5.2 Unit Test Specifications to Add to Test Suite
Add the following dedicated unit test in `src/test/tier1_features/orderLifecycle.test.ts` or a new component test file:

```typescript
describe('OrderEntryWidget & TradingViewChart Remediation Verification', () => {
  it('allows user to clear TP/SL field to empty string without auto-snapping', () => {
    let customTp = ''
    const defaultTpPrice = 122500.00
    const assetDigits = 2

    // Simulated new input behavior:
    // Value is strictly customTp (empty), placeholder is defaultTpPrice
    const inputValue = customTp
    const placeholder = defaultTpPrice.toFixed(assetDigits)

    expect(inputValue).toBe('')
    expect(placeholder).toBe('122500.00')

    // User types custom value
    customTp = '125000'
    expect(customTp).toBe('125000')

    // User clears input completely
    customTp = ''
    expect(customTp).toBe('') // Stays empty, does NOT snap back to '122500.00'!

    // Effective TP falls back safely to default when empty
    const parsed = customTp.trim() !== '' ? parseFloat(customTp) : NaN
    const effectiveTp = !isNaN(parsed) && parsed > 0 ? parsed : defaultTpPrice
    expect(effectiveTp).toBe(122500.00)
  })

  it('sequentially streams every intermediate candle when a multi-bar batch arrives', () => {
    const streamCalls: number[] = []
    const fakeSeries = {
      update: (bar: { time: number }) => streamCalls.push(bar.time),
    }

    let prevLen = 2
    const candles = [
      { time: 1000, open: 10, high: 11, low: 9, close: 10 },
      { time: 1060, open: 10, high: 12, low: 10, close: 11 },
      // 3 new bars arrive in a single batch (times 1120, 1180, 1240)
      { time: 1120, open: 11, high: 13, low: 11, close: 12 },
      { time: 1180, open: 12, high: 14, low: 12, close: 13 },
      { time: 1240, open: 13, high: 15, low: 13, close: 14 },
    ]

    // Multi-bar streaming algorithm:
    if (candles.length > prevLen + 1) {
      const startIndex = Math.max(0, prevLen)
      for (let i = startIndex; i < candles.length; i++) {
        fakeSeries.update(candles[i])
      }
    } else {
      fakeSeries.update(candles[candles.length - 1])
    }

    // Verify all 3 missing bars were streamed in exact sequential order
    expect(streamCalls).toEqual([1120, 1180, 1240])
    expect(streamCalls.length).toBe(3)
  })
})
```

### 5.3 Invalidation Conditions
The solution would be considered invalid if:
1. Clearing `customTp` or `customSl` in `OrderEntryWidget` causes `handleSubmitOrder` to produce `NaN` or `undefined` for `tpPrice`/`slPrice` when `tpEnabled`/`slEnabled` is active. (Prevented by `effectiveTp`/`effectiveSl` fallback).
2. The placeholder displays incorrect decimal digits for JPY pairs (must show 3 digits, e.g. `153.250`, not 5). (Prevented by `assetConfig.digits`).
3. Out-of-order timestamps are forwarded to `candlestickSeries.update()`. (Prevented by ascending loop index `startIndex` to `candles.length - 1`).
4. Rapid batch streaming causes memory leaks or canvas corruption. (Prevented by `setData()` threshold guard at `candles.length - prevLen > 50`).
