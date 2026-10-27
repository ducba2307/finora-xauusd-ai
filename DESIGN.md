# FINORA QUANT AI — RESPONSIVE DESIGN SYSTEM SPECIFICATION (DESIGN.md)

> **Document Version:** 2.0.0 (Production Financial Grade)  
> **Target Products:** XAU/USD Quant AI Signal Desk, Institutional LightWeight TradingView, 1-Click Execution Terminal.  
> **Design Philosophy:** Emil Kowalski Design Engineering + Taste Skill Anti-Slop + Financial UI Patterns (TradingView / Binance Pro / Kraken / Robinhood).

---

## 1. Visual Atmosphere & Aesthetic Foundations

- **Density:** Cockpit Dense (8/10) for Desktop; Clean Focus (6/10) for Mobile.
- **Surface Elevation System:**
  - `Base Canvas`: Deep Space Charcoal `#06080F` (Never pure black `#000000`).
  - `Card Surface L1`: `#0A0E1A` with subtle border `rgba(255, 255, 255, 0.07)`.
  - `Card Surface L2 (Elevated)`: `#101626` with border `rgba(6, 182, 212, 0.20)` (Cyan tint).
  - `Highlight Surface`: Tinted overlays (`rgba(16, 185, 129, 0.12)` for Bullish, `rgba(244, 63, 94, 0.12)` for Bearish).
- **No-AI-Slop Directives:**
  - Banned: Purple/Blue neon gradients, floating cards obscuring chart data, unaligned tabular numbers, horizontal window overflow, screaming decorative animations.
  - Required: Hardware-accelerated transforms (`translate3d`, `opacity`), 44px minimum touch targets, sticky bottom execution sheets on mobile.

---

## 2. Responsive Breakpoint & Layout Architecture

```
Breakpoints:
  Mobile Compact (xs) : 320px  - 374px   (iPhone SE, narrow Android)
  Mobile Standard(sm) : 375px  - 639px   (iPhone 12-16, Samsung Galaxy)
  Tablet         (md) : 640px  - 1023px  (iPad Mini, iPad Air, Surface)
  Desktop        (lg) : 1024px - 1439px  (MacBook 13-14", standard laptops)
  Ultrawide      (xl) : 1440px+          (Pro monitors, iMac, multi-display)
```

### 2.1. Mobile Strategy (< 640px)
1. **Zero Obscuration Rule:** No floating panels (like SMC overlay or drawing toolbars) may cover the candlestick chart. All overlays must collapse into compact header pills or dock at the bottom.
2. **Dedicated Segmented Navigation:**
   - `⚡ Tín Hiệu AI` (Default focus: Recommendation, R:R, Entry, SL, TP, Rationale, Confluence).
   - `📊 Biểu Đồ Kỹ Thuật` (100% full-screen lightweight candlestick chart).
   - `📜 Sổ Cái Lịch Sử` (Translucent performance ledger and win rate stats).
3. **Sticky Bottom Order Execution Bar:**
   - Permanent 1-tap Buy/Sell execution bar docked to the viewport bottom (`fixed bottom-0 pb-safe`).
   - Accessible regardless of active scroll position.

### 2.2. Desktop Strategy (>= 1024px)
- **12-Column Asymmetric Grid:**
  - `Left 7 Columns (58%)`: Full TradingView interactive chart + timeframe pill bar + 1-click execution dock.
  - `Right 5 Columns (42%)`: Hero Signal Card + 4-Pillar Confluence Gauge Widget + Live Signal History Ledger.
- **Top Navigation Restraint:**
  - Primary tabs visible (Signal Desk, Terminal, News Trading, Quant Lab).
  - Secondary tools consolidated into an elegant `More Tools` dropdown to prevent horizontal wrapping on 1024px-1366px screens.

---

## 3. Financial Typography & Tabular Number Rules

- **Number Rendering:** Always `tabular-nums font-mono font-medium tracking-tight`.
- **Decimal Alignment:** Spot Gold XAU/USD fixed to 2 decimal places (`$4,012.51`). Pips fixed to 1-2 decimal places.
- **P&L Explicit Sign:** Always display `+` for positive return/pips (`+181.5 pips`, `+2.07R`).
- **Tick-Flash Feedback:** 300ms CSS tinted background flash on incoming WebSocket tick.

---

## 4. Touch Target & Accessibility Guidelines

- **Buttons & Interactive Controls:** Minimum height `44px` (touch friendly).
- **Safe Area Insets:** All fixed bottom elements respect `env(safe-area-inset-bottom)`.
- **No Overflow Policy:** `overflow-x: hidden` enforced on page wrapper; horizontal scrolling permitted exclusively in timeframe sliders and data tables with visible cues.
