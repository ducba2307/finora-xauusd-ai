# Financial UI Patterns (Local Copy)
Summarized from C:\Users\ADMIN\.gemini\config\skills\financial-ui-patterns\SKILL.md:
- tabular-nums, right align numbers, decimal alignment.
- Ticker display font-mono.
- Semantic tokens only (text-positive, text-negative).
- Input preservation: user entered limit price/amount must never be stomped by background tick stream.
- AMM curve: constant product x*y=k or square-root slippage must bound price impact <= 100%, never produce negative output or NaN.
- Position mark price and unrealized PnL: calculate exact multiplier per asset class (FX: 100,000, Metals: 100, Crypto: 1).
