import type { 
  CryptoAsset, 
  AIBotStrategy, 
  UserPortfolio, 
  TradeOrder, 
  ChartDataPoint, 
  Position, 
  OrderBook, 
  PublicTrade, 
  WhaleAlert, 
  BacktestResult,
  EconomicEvent,
  SMCPattern,
  JournalEntry,
  CandlestickPoint,
  AISwarmSignal
} from '../types/trading'
import { generateInstitutionalOrderBook } from '../services/marketDataSimulator'

export const INITIAL_ASSETS: CryptoAsset[] = [
  // --- FOREX & COMMODITIES (GOLD DEFAULT FOCUS) ---
  {
    id: 'xauusd',
    name: 'Gold (Spot)',
    symbol: 'XAU/USD',
    icon: 'https://cdn-icons-png.flaticon.com/512/2583/2583944.png',
    price: 4155.50,
    change24h: 1.31,
    volume24h: '184.2B',
    marketCap: '21.5T',
    high24h: 4174.20,
    low24h: 4138.40,
    spreadPips: 1.2,
    category: 'FOREX',
    sparkline: [4112, 4125, 4138, 4145, 4150, 4152, 4155.50],
    aiSignal: 'STRONG BUY',
    aiConfidence: 96.8,
    network: 'Global Spot FX',
    digits: 2,
  },
  // --- CRYPTO ASSETS ---
  {
    id: 'btc',
    name: 'Bitcoin',
    symbol: 'BTC',
    icon: 'https://assets.coingecko.com/coins/images/1/standard/bitcoin.png',
    price: 114884.00,
    change24h: 4.61,
    volume24h: '18.7B',
    marketCap: '4.8T',
    high24h: 116240.00,
    low24h: 110450.00,
    fundingRate: 0.0100,
    category: 'CRYPTO',
    sparkline: [108200, 109400, 111200, 110800, 112900, 113500, 114884],
    aiSignal: 'STRONG BUY',
    aiConfidence: 94.2,
    network: 'Bitcoin',
    digits: 2,
  },
  {
    id: 'eth',
    name: 'Ethereum',
    symbol: 'ETH',
    icon: 'https://assets.coingecko.com/coins/images/279/standard/ethereum.png',
    price: 3248.30,
    change24h: 3.45,
    volume24h: '32.5B',
    marketCap: '388.1B',
    high24h: 3310.00,
    low24h: 3140.00,
    fundingRate: 0.0085,
    category: 'CRYPTO',
    sparkline: [3100, 3140, 3120, 3180, 3210, 3220, 3248.30],
    aiSignal: 'BUY',
    aiConfidence: 88.7,
    network: 'Ethereum',
    digits: 2,
  },
  {
    id: 'sol',
    name: 'Solana',
    symbol: 'SOL',
    icon: 'https://assets.coingecko.com/coins/images/4128/standard/solana.png',
    price: 194.25,
    change24h: -2.48,
    volume24h: '4.3B',
    marketCap: '92.5B',
    high24h: 204.50,
    low24h: 189.10,
    fundingRate: 0.0050,
    category: 'CRYPTO',
    sparkline: [205, 201, 198, 196, 192, 193, 194.25],
    aiSignal: 'BUY',
    aiConfidence: 81.3,
    network: 'Solana',
    digits: 2,
  },
  {
    id: 'qnt',
    name: 'Quant',
    symbol: 'QNT',
    icon: 'https://assets.coingecko.com/coins/images/3370/standard/5833.png',
    price: 134.80,
    change24h: 8.74,
    volume24h: '12.9B',
    marketCap: '44.1B',
    high24h: 138.20,
    low24h: 122.40,
    fundingRate: 0.0125,
    category: 'CRYPTO',
    sparkline: [122, 124, 126, 129, 131, 133, 134.80],
    aiSignal: 'STRONG BUY',
    aiConfidence: 92.5,
    network: 'Ethereum',
    digits: 2,
  },
  {
    id: 'avax',
    name: 'Avalanche',
    symbol: 'AVAX',
    icon: 'https://assets.coingecko.com/coins/images/12559/standard/Avalanche_Circle_RedWhite_Trans.png',
    price: 36.40,
    change24h: 2.15,
    volume24h: '1.9B',
    marketCap: '14.5B',
    high24h: 37.80,
    low24h: 35.10,
    fundingRate: 0.0090,
    category: 'CRYPTO',
    sparkline: [34.5, 35.1, 35.0, 35.8, 36.1, 36.2, 36.40],
    aiSignal: 'HOLD',
    aiConfidence: 72.0,
    network: 'Avalanche',
    digits: 2,
  },

  // --- OTHER FOREX & COMMODITIES ASSETS ---
  {
    id: 'eurusd',
    name: 'Euro / US Dollar',
    symbol: 'EUR/USD',
    icon: 'https://cdn-icons-png.flaticon.com/512/197/197374.png',
    price: 1.08452,
    change24h: -0.32,
    volume24h: '284.1B',
    marketCap: 'Liquid FX',
    high24h: 1.08820,
    low24h: 1.08310,
    spreadPips: 0.4,
    category: 'FOREX',
    sparkline: [1.087, 1.0865, 1.0858, 1.085, 1.0842, 1.0844, 1.08452],
    aiSignal: 'BUY',
    aiConfidence: 84.5,
    network: 'Tier-1 Interbank',
    digits: 5,
  },
  {
    id: 'gbpusd',
    name: 'British Pound / USD',
    symbol: 'GBP/USD',
    icon: 'https://cdn-icons-png.flaticon.com/512/197/197374.png',
    price: 1.29840,
    change24h: 0.48,
    volume24h: '142.0B',
    marketCap: 'Liquid FX',
    high24h: 1.30210,
    low24h: 1.29450,
    spreadPips: 0.6,
    category: 'FOREX',
    sparkline: [1.292, 1.294, 1.295, 1.297, 1.2965, 1.298, 1.29840],
    aiSignal: 'HOLD',
    aiConfidence: 76.2,
    network: 'Tier-1 Interbank',
    digits: 5,
  },
  {
    id: 'usdjpy',
    name: 'US Dollar / Japanese Yen',
    symbol: 'USD/JPY',
    icon: 'https://cdn-icons-png.flaticon.com/512/197/197604.png',
    price: 152.350,
    change24h: -0.58,
    volume24h: '210.5B',
    marketCap: 'Liquid FX',
    high24h: 153.180,
    low24h: 151.920,
    spreadPips: 0.7,
    category: 'FOREX',
    sparkline: [153.2, 153.0, 152.8, 152.5, 152.2, 152.4, 152.350],
    aiSignal: 'SELL',
    aiConfidence: 89.1,
    network: 'Tier-1 Interbank',
    digits: 3,
  },

  // --- US EQUITIES (STOCKS) ---
  {
    id: 'nvda',
    name: 'NVIDIA Corporation',
    symbol: 'NVDA',
    icon: 'https://logo.clearbit.com/nvidia.com',
    price: 186.50,
    change24h: 7.85,
    volume24h: '3.63B',
    marketCap: '4.58T',
    high24h: 192.69,
    low24h: 170.31,
    category: 'STOCKS',
    sparkline: [171.2, 173.8, 175.5, 178.4, 182.1, 184.9, 186.50],
    aiSignal: 'STRONG BUY',
    aiConfidence: 97.4,
    network: 'NASDAQ GS',
    digits: 2,
  },
  {
    id: 'tsla',
    name: 'Tesla, Inc.',
    symbol: 'TSLA',
    icon: 'https://logo.clearbit.com/tesla.com',
    price: 218.40,
    change24h: 3.20,
    volume24h: '1.45B',
    marketCap: '698.2B',
    high24h: 224.50,
    low24h: 212.10,
    category: 'STOCKS',
    sparkline: [210.5, 212.0, 214.8, 213.2, 216.5, 217.4, 218.40],
    aiSignal: 'BUY',
    aiConfidence: 88.2,
    network: 'NASDAQ GS',
    digits: 2,
  },
  {
    id: 'aapl',
    name: 'Apple Inc.',
    symbol: 'AAPL',
    icon: 'https://logo.clearbit.com/apple.com',
    price: 232.15,
    change24h: 1.65,
    volume24h: '2.12B',
    marketCap: '3.52T',
    high24h: 235.80,
    low24h: 229.40,
    category: 'STOCKS',
    sparkline: [228.4, 229.1, 230.5, 231.0, 230.8, 231.5, 232.15],
    aiSignal: 'BUY',
    aiConfidence: 85.9,
    network: 'NASDAQ GS',
    digits: 2,
  },
]

export const TOP_MOVERS = [
  { name: 'Gold (Spot)', symbol: 'XAU/USD', price: 4155.50, change: 1.31, icon: '🏆' },
  { name: 'Bitcoin', symbol: 'BTC', price: 114884.00, change: 4.61, icon: '₿' },
  { name: 'Quant', symbol: 'QNT', price: 134.80, change: 8.74, icon: '🔷' },
  { name: 'Solana', symbol: 'SOL', price: 194.25, change: 5.76, icon: '🟣' },
]

export const INITIAL_PORTFOLIO: UserPortfolio = {
  totalBalance: 48950.00,
  tradeCapital: 22540.00,
  maxLoss: 12950.00,
  realizedProfit: 19645.00,
  dailyChangePct: 24.8,
  balances: {
    USDT: 28400,
    USD: 14500,
    ETH: 3.2,
    BTC: 0.15,
    XAU: 2.5,
  },
}

export const INITIAL_POSITIONS: Position[] = [
  {
    id: 'pos-1',
    symbol: 'BTC/USDT',
    side: 'LONG',
    size: 0.25,
    entryPrice: 112400.00,
    markPrice: 114884.00,
    liquidationPrice: 102150.00,
    leverage: 10,
    margin: 2810.00,
    unrealizedPnl: 621.00,
    unrealizedPnlPct: 22.10,
    tpPrice: 122500.00,
    slPrice: 109800.00,
    market: 'CRYPTO',
  },
  {
    id: 'pos-2',
    symbol: 'XAU/USD',
    side: 'LONG',
    size: 5.0,
    entryPrice: 2715.00,
    markPrice: 2734.50,
    liquidationPrice: 2580.00,
    leverage: 100,
    margin: 1357.50,
    unrealizedPnl: 975.00,
    unrealizedPnlPct: 71.82,
    tpPrice: 2760.00,
    slPrice: 2698.00,
    market: 'FOREX',
    lots: 0.50,
    pips: 195,
  },
  {
    id: 'pos-3',
    symbol: 'ETH/USDT',
    side: 'LONG',
    size: 4.0,
    entryPrice: 3180.00,
    markPrice: 3248.30,
    liquidationPrice: 2640.00,
    leverage: 5,
    margin: 2544.00,
    unrealizedPnl: 273.20,
    unrealizedPnlPct: 10.74,
    tpPrice: 3580.00,
    slPrice: 3080.00,
    market: 'CRYPTO',
  },
]

export const INITIAL_WHALE_ALERTS: WhaleAlert[] = [
  {
    id: 'w-1',
    timestamp: '3 mins ago',
    from: 'Binance Hot 1',
    to: 'Institutional Custody (0x918...f8)',
    amount: 3850,
    symbol: 'BTC',
    usdValue: 442303400,
    type: 'WHALE_ACCUMULATION',
    conviction: 'EXTREME',
  },
  {
    id: 'w-2',
    timestamp: '8 mins ago',
    from: 'London Gold Vault',
    to: 'Central Bank Allocation',
    amount: 15000,
    symbol: 'XAU',
    usdValue: 41017500,
    type: 'WHALE_ACCUMULATION',
    conviction: 'EXTREME',
  },
  {
    id: 'w-3',
    timestamp: '14 mins ago',
    from: 'Whale Cluster #44',
    to: 'Coinbase Prime',
    amount: 14200,
    symbol: 'ETH',
    usdValue: 46125860,
    type: 'CEX_INFLOW',
    conviction: 'MEDIUM',
  },
  {
    id: 'w-4',
    timestamp: '28 mins ago',
    from: 'Kraken Exchange',
    to: 'Ledger Cold 0x7a...4b',
    amount: 85000,
    symbol: 'QNT',
    usdValue: 11458000,
    type: 'CEX_OUTFLOW',
    conviction: 'HIGH',
  },
]

export const INITIAL_ECONOMIC_EVENTS: EconomicEvent[] = [
  {
    id: 'eco-1',
    time: 'Today 19:30',
    currency: 'USD',
    flag: '🇺🇸',
    event: 'US Core CPI Inflation (YoY)',
    impact: 'HIGH',
    forecast: '3.1%',
    previous: '3.3%',
    actual: '3.0%',
    aiSentiment: 'BULLISH',
  },
  {
    id: 'eco-2',
    time: 'Tomorrow 01:00',
    currency: 'USD',
    flag: '🇺🇸',
    event: 'FOMC Federal Funds Rate Decision',
    impact: 'HIGH',
    forecast: '4.75%',
    previous: '5.00%',
    aiSentiment: 'VOLATILITY_ALERT',
  },
  {
    id: 'eco-3',
    time: 'Fri 19:30',
    currency: 'USD',
    flag: '🇺🇸',
    event: 'Non-Farm Payrolls (NFP Employment)',
    impact: 'HIGH',
    forecast: '145K',
    previous: '254K',
    aiSentiment: 'BULLISH',
  },
  {
    id: 'eco-4',
    time: 'Fri 15:00',
    currency: 'EUR',
    flag: '🇪🇺',
    event: 'ECB Monetary Policy Statement',
    impact: 'MEDIUM',
    forecast: '3.25%',
    previous: '3.50%',
    aiSentiment: 'NEUTRAL',
  },
]

export const INITIAL_SMC_PATTERNS: SMCPattern[] = [
  {
    id: 'smc-1',
    symbol: 'XAU/USD',
    timeframe: 'M15',
    patternName: 'Bullish Order Block (OB)',
    direction: 'BULLISH',
    priceRange: '$2,718.50 - $2,722.00',
    aiConfidence: 96.2,
    status: 'ACTIVE',
  },
  {
    id: 'smc-2',
    symbol: 'XAU/USD',
    timeframe: 'H1',
    patternName: 'Fair Value Gap (FVG) Imbalance',
    direction: 'BULLISH',
    priceRange: '$2,728.00 - $2,731.50',
    aiConfidence: 91.8,
    status: 'ACTIVE',
  },
  {
    id: 'smc-3',
    symbol: 'BTC/USDT',
    timeframe: 'H4',
    patternName: 'Liquidity Sweep & BOS',
    direction: 'BULLISH',
    priceRange: '$112,200 - $112,800',
    aiConfidence: 94.7,
    status: 'ACTIVE',
  },
  {
    id: 'smc-4',
    symbol: 'EUR/USD',
    timeframe: 'M30',
    patternName: 'Bearish Breaker Block',
    direction: 'BEARISH',
    priceRange: '1.0875 - 1.0890',
    aiConfidence: 83.4,
    status: 'ACTIVE',
  },
]

export const INITIAL_JOURNAL_ENTRIES: JournalEntry[] = [
  {
    id: 'j-1',
    date: 'Oct 10, 2026',
    dayNumber: 10,
    symbol: 'XAU/USD',
    market: 'FOREX',
    side: 'BUY',
    lotsOrSize: 0.50,
    entryPrice: 2715.00,
    exitPrice: 2734.50,
    pnl: 975.00,
    rMultiple: 3.5,
    setup: 'SMC Order Block + FVG',
    outcome: 'WIN',
    notes: 'Swept London SSL liquidity at $2,708. Clean bounce off M15 institutional discount zone.',
    tag: '#A+Setup',
    mistake: 'None',
    duration: '2h 15m',
    fees: 3.50,
  },
  {
    id: 'j-2',
    date: 'Oct 10, 2026',
    dayNumber: 10,
    symbol: 'BTC/USDT',
    market: 'CRYPTO',
    side: 'BUY',
    lotsOrSize: 0.20,
    entryPrice: 112450.00,
    exitPrice: 114880.00,
    pnl: 486.00,
    rMultiple: 2.8,
    setup: 'Neural Transformer Scalp',
    outcome: 'WIN',
    notes: 'Order book bid wall detected on Coinbase Prime with normalized funding rate.',
    tag: '#Disciplined',
    mistake: 'None',
    duration: '1h 40m',
    fees: 4.80,
  },
  {
    id: 'j-3',
    date: 'Oct 09, 2026',
    dayNumber: 9,
    symbol: 'EUR/USD',
    market: 'FOREX',
    side: 'SELL',
    lotsOrSize: 1.00,
    entryPrice: 1.0885,
    exitPrice: 1.0850,
    pnl: 350.00,
    rMultiple: 2.1,
    setup: 'London High Sweep',
    outcome: 'WIN',
    notes: 'Asia high liquidity grabbed, aggressive displacement lower into London open.',
    tag: '#A+Setup',
    mistake: 'None',
    duration: '3h 10m',
    fees: 3.00,
  },
  {
    id: 'j-4',
    date: 'Oct 09, 2026',
    dayNumber: 9,
    symbol: 'SOL/USDT',
    market: 'CRYPTO',
    side: 'BUY',
    lotsOrSize: 15.0,
    entryPrice: 202.40,
    exitPrice: 198.00,
    pnl: -66.00,
    rMultiple: -1.0,
    setup: 'Breakout Retest',
    outcome: 'LOSS',
    notes: 'Stopped out during BTC flush. Risk disciplined at 1R.',
    tag: '#Disciplined',
    mistake: 'None',
    duration: '45m',
    fees: 1.50,
  },
  {
    id: 'j-5',
    date: 'Oct 08, 2026',
    dayNumber: 8,
    symbol: 'XAU/USD',
    market: 'FOREX',
    side: 'BUY',
    lotsOrSize: 0.50,
    entryPrice: 2708.00,
    exitPrice: 2724.00,
    pnl: 800.00,
    rMultiple: 2.9,
    setup: 'SMC Order Block + FVG',
    outcome: 'WIN',
    notes: 'NY session open continuation above daily pivot.',
    tag: '#A+Setup',
    mistake: 'None',
    duration: '1h 55m',
    fees: 3.50,
  },
  {
    id: 'j-6',
    date: 'Oct 08, 2026',
    dayNumber: 8,
    symbol: 'ETH/USDT',
    market: 'CRYPTO',
    side: 'SELL',
    lotsOrSize: 2.50,
    entryPrice: 3280.00,
    exitPrice: 3215.00,
    pnl: 162.50,
    rMultiple: 1.8,
    setup: 'Bearish Breaker Block',
    outcome: 'WIN',
    notes: 'Weekly resistance rejection with divergence on CVD.',
    tag: '#Disciplined',
    mistake: 'None',
    duration: '4h 20m',
    fees: 2.80,
  },
  {
    id: 'j-7',
    date: 'Oct 07, 2026',
    dayNumber: 7,
    symbol: 'GBP/USD',
    market: 'FOREX',
    side: 'BUY',
    lotsOrSize: 1.00,
    entryPrice: 1.2940,
    exitPrice: 1.2910,
    pnl: -300.00,
    rMultiple: -1.8,
    setup: 'News Straddle',
    outcome: 'LOSS',
    notes: 'Moved stop loss wider during UK GDP announcement. Rule broken: cost -$86.90 excess.',
    tag: '#RuleBreaker',
    mistake: 'Moved stop',
    duration: '1h 10m',
    fees: 3.00,
  },
  {
    id: 'j-8',
    date: 'Oct 07, 2026',
    dayNumber: 7,
    symbol: 'BTC/USDT',
    market: 'CRYPTO',
    side: 'BUY',
    lotsOrSize: 0.15,
    entryPrice: 111200.00,
    exitPrice: 113100.00,
    pnl: 285.00,
    rMultiple: 2.2,
    setup: 'Neural Transformer Scalp',
    outcome: 'WIN',
    notes: 'Mean reversion off lower Bollinger and 4H 200 EMA.',
    tag: '#A+Setup',
    mistake: 'None',
    duration: '2h 00m',
    fees: 3.80,
  },
  {
    id: 'j-9',
    date: 'Oct 06, 2026',
    dayNumber: 6,
    symbol: 'XAU/USD',
    market: 'FOREX',
    side: 'SELL',
    lotsOrSize: 0.50,
    entryPrice: 2740.00,
    exitPrice: 2728.50,
    pnl: 575.00,
    rMultiple: 2.5,
    setup: 'Asian High Liquidity Sweep',
    outcome: 'WIN',
    notes: 'Clean scalp of premium zone into London fix.',
    tag: '#A+Setup',
    mistake: 'None',
    duration: '1h 15m',
    fees: 3.50,
  },
  {
    id: 'j-10',
    date: 'Oct 06, 2026',
    dayNumber: 6,
    symbol: 'SOL/USDT',
    market: 'CRYPTO',
    side: 'BUY',
    lotsOrSize: 20.0,
    entryPrice: 195.00,
    exitPrice: 193.50,
    pnl: -30.00,
    rMultiple: -0.6,
    setup: 'Momentum Scalp',
    outcome: 'LOSS',
    notes: 'Exited early out of fear before the price reached TP. Left +$180 on the table.',
    tag: '#Mistake',
    mistake: 'Exited early',
    duration: '15m',
    fees: 1.80,
  },
  {
    id: 'j-11',
    date: 'Oct 05, 2026',
    dayNumber: 5,
    symbol: 'USD/JPY',
    market: 'FOREX',
    side: 'SELL',
    lotsOrSize: 1.00,
    entryPrice: 153.20,
    exitPrice: 152.40,
    pnl: 524.80,
    rMultiple: 2.6,
    setup: 'BOJ Intervention Flow',
    outcome: 'WIN',
    notes: 'Trend change confirmed on M30 BOS.',
    tag: '#Disciplined',
    mistake: 'None',
    duration: '5h 30m',
    fees: 3.20,
  },
  {
    id: 'j-12',
    date: 'Oct 04, 2026',
    dayNumber: 4,
    symbol: 'BTC/USDT',
    market: 'CRYPTO',
    side: 'BUY',
    lotsOrSize: 0.10,
    entryPrice: 110500.00,
    exitPrice: 109200.00,
    pnl: -130.00,
    rMultiple: -1.0,
    setup: 'Trend Continuation',
    outcome: 'LOSS',
    notes: 'Overtraded on weekend low volume. Traded without institutional edge.',
    tag: '#RuleBreaker',
    mistake: 'Overtraded',
    duration: '3h 45m',
    fees: 2.50,
  },
  {
    id: 'j-13',
    date: 'Oct 03, 2026',
    dayNumber: 3,
    symbol: 'XAU/USD',
    market: 'FOREX',
    side: 'BUY',
    lotsOrSize: 0.50,
    entryPrice: 2695.00,
    exitPrice: 2718.00,
    pnl: 1150.00,
    rMultiple: 3.8,
    setup: 'SMC Order Block + FVG',
    outcome: 'WIN',
    notes: 'Non-Farm Payroll whip liquidity sweep into 4H Bullish OB.',
    tag: '#A+Setup',
    mistake: 'None',
    duration: '4h 10m',
    fees: 3.50,
  },
  {
    id: 'j-14',
    date: 'Oct 02, 2026',
    dayNumber: 2,
    symbol: 'ETH/USDT',
    market: 'CRYPTO',
    side: 'BUY',
    lotsOrSize: 3.0,
    entryPrice: 3120.00,
    exitPrice: 3195.00,
    pnl: 225.00,
    rMultiple: 1.9,
    setup: 'Divergence Scalp',
    outcome: 'WIN',
    notes: 'RSI bullish divergence on H1 with positive delta volume.',
    tag: '#Disciplined',
    mistake: 'None',
    duration: '2h 40m',
    fees: 3.10,
  },
  {
    id: 'j-15',
    date: 'Oct 01, 2026',
    dayNumber: 1,
    symbol: 'EUR/USD',
    market: 'FOREX',
    side: 'BUY',
    lotsOrSize: 1.00,
    entryPrice: 1.0820,
    exitPrice: 1.0805,
    pnl: -150.00,
    rMultiple: -1.0,
    setup: 'Morning Breakout',
    outcome: 'LOSS',
    notes: 'FOMO chased green candle after London open without waiting for FVG retest.',
    tag: '#Mistake',
    mistake: 'FOMO entered',
    duration: '25m',
    fees: 3.00,
  },
]

export const INITIAL_AI_BOTS: AIBotStrategy[] = [
  {
    id: 'bot-1',
    name: 'Neural Alpha Scalper v4',
    model: 'Finora Deep Transformer 4.5',
    description: 'High frequency crypto order book imbalance & liquidation hunting',
    status: 'ACTIVE',
    winRate: 88.4,
    tradesCount: 1420,
    profitPct: 42.8,
    riskLevel: 'MEDIUM',
    allocationUsd: 5000,
    targetMarket: 'CRYPTO',
  },
  {
    id: 'bot-2',
    name: 'XAUUSD Gold ICT Hunter',
    model: 'Smart Money M5/M15 SMC Engine',
    description: 'Gold liquidity sweeps, London/NY session imbalance, ICT killzones',
    status: 'ACTIVE',
    winRate: 94.6,
    tradesCount: 512,
    profitPct: 82.4,
    riskLevel: 'LOW',
    allocationUsd: 8000,
    targetMarket: 'FOREX',
  },
  {
    id: 'bot-3',
    name: 'Macro Sentinel News Bot',
    model: 'NLP Fed & NFP Economic Quant',
    description: 'Sub-millisecond economic release trading (CPI, NFP, Rate Cuts)',
    status: 'ACTIVE',
    winRate: 91.2,
    tradesCount: 184,
    profitPct: 54.0,
    riskLevel: 'MEDIUM',
    allocationUsd: 4500,
    targetMarket: 'FOREX',
  },
  {
    id: 'bot-4',
    name: 'Whale Flow Accumulator',
    model: 'Smart Money On-Chain Radar',
    description: 'Tracks top 100 whale wallet cluster inflows and CEX outflows',
    status: 'ACTIVE',
    winRate: 93.1,
    tradesCount: 384,
    profitPct: 68.2,
    riskLevel: 'LOW',
    allocationUsd: 4500,
    targetMarket: 'CRYPTO',
  },
]

export const INITIAL_PUBLIC_TRADES: PublicTrade[] = [
  { id: 't-1', time: '00:10:04', price: 114884.00, size: 0.452, side: 'BUY' },
  { id: 't-2', time: '00:10:02', price: 114882.50, size: 1.120, side: 'BUY' },
  { id: 't-3', time: '00:09:59', price: 114880.00, size: 0.185, side: 'SELL' },
  { id: 't-4', time: '00:09:55', price: 114883.00, size: 2.450, side: 'BUY' },
  { id: 't-5', time: '00:09:50', price: 114879.50, size: 0.640, side: 'SELL' },
  { id: 't-6', time: '00:09:46', price: 114884.00, size: 0.320, side: 'BUY' },
  { id: 't-7', time: '00:09:42', price: 114881.00, size: 0.950, side: 'SELL' },
]

export const GENERATE_ORDER_BOOK = (basePrice: number, symbol: string = 'BTC/USDT'): OrderBook => {
  return generateInstitutionalOrderBook(symbol, basePrice)
}

export const GENERATE_CHART_SERIES = (timeframe: string, symbol: string = 'BTC'): ChartDataPoint[] => {
  const points: ChartDataPoint[] = []
  const isGold = symbol.includes('XAU')
  const isForex = symbol.includes('EUR') || symbol.includes('GBP')
  
  let basePrice = isGold ? 2715 : isForex ? 1.0845 : 111500
  const steps = timeframe === '1D' ? 24 : timeframe === '7D' ? 35 : timeframe === '1M' ? 30 : 40

  const now = new Date()
  for (let i = steps; i >= 0; i--) {
    const time = new Date(now.getTime() - i * (timeframe === '1D' ? 3600000 : 86400000))
    const volatilityMultiplier = isGold ? 4.5 : isForex ? 0.0006 : 650
    const volatility = (Math.random() - 0.44) * volatilityMultiplier
    basePrice = Math.max(isForex ? 1.0 : isGold ? 2000 : 90000, basePrice + volatility)

    const finalPrice = isForex ? Number(basePrice.toFixed(5)) : Number(basePrice.toFixed(2))

    const dPoint: ChartDataPoint = {
      timestamp: timeframe === '1D' 
        ? `${time.getHours()}:00` 
        : `${time.toLocaleString('default', { month: 'short' })} ${time.getDate()}`,
      price: finalPrice,
      volume: Math.round(1500 + Math.random() * 4000),
      ema20: isForex ? Number((basePrice * 0.999).toFixed(5)) : Number((basePrice * 0.995).toFixed(2)),
      ema50: isForex ? Number((basePrice * 0.998).toFixed(5)) : Number((basePrice * 0.988).toFixed(2)),
      aiUpperBand: isForex ? Number((basePrice * 1.002).toFixed(5)) : Number((basePrice * 1.018).toFixed(2)),
      aiLowerBand: isForex ? Number((basePrice * 0.998).toFixed(5)) : Number((basePrice * 0.982).toFixed(2)),
    }

    if (i === 18) {
      dPoint.signal = 'BUY'
      dPoint.signalText = isGold ? 'SMC FVG Buy (96.8%)' : 'AI Long Signal (96% Conf)'
    } else if (i === 6) {
      dPoint.signal = 'TAKE_PROFIT'
      dPoint.signalText = 'Partial TP (+4.8%)'
    } else if (i === 0) {
      dPoint.price = isGold ? 4155.50 : isForex ? 1.08452 : 114884
    }

    points.push(dPoint)
  }
  return points
}

export const GENERATE_CANDLESTICK_SERIES = (
  symbol: string = 'BTC',
  timeframe: string = '1H',
  count: number = 70,
  overrideCurrentPrice?: number
): CandlestickPoint[] => {
  const isGold = symbol.includes('XAU')
  const isForex = symbol.includes('EUR') || symbol.includes('GBP') || symbol.includes('JPY')
  const isJpy = symbol.includes('JPY')
  const isNvda = symbol.includes('NVDA')
  const isTsla = symbol.includes('TSLA')
  const isAapl = symbol.includes('AAPL')

  let basePrice =
    overrideCurrentPrice ??
    (isGold
      ? 4155.0
      : isForex
      ? (isJpy ? 152.0 : 1.0820)
      : isNvda
      ? 186.50
      : isTsla
      ? 218.40
      : isAapl
      ? 232.15
      : symbol.includes('ETH')
      ? 4120
      : symbol.includes('SOL')
      ? 190.0
      : 112500)

  const digits = isForex ? (isJpy ? 3 : 5) : 2
  const volatilityMultiplier = isGold
    ? 3.5
    : isForex
    ? (isJpy ? 0.15 : 0.00045)
    : isNvda
    ? 1.85
    : isTsla
    ? 2.20
    : isAapl
    ? 1.40
    : symbol.includes('SOL')
    ? 1.2
    : symbol.includes('ETH')
    ? 22
    : 450

  const intervalSeconds = timeframe === '1m' ? 60 
    : timeframe === '5m' ? 300 
    : timeframe === '15m' ? 900 
    : timeframe === '1H' ? 3600 
    : timeframe === '4H' ? 14400 
    : 86400

  const nowSec = Math.floor(Date.now() / 1000)
  const currentBarTime = Math.floor(nowSec / intervalSeconds) * intervalSeconds
  const startSec = currentBarTime - (count - 1) * intervalSeconds

  const candles: CandlestickPoint[] = []
  let prevEma20 = basePrice
  let prevEma50 = basePrice * 0.995

  for (let i = 0; i < count; i++) {
    const time = startSec + i * intervalSeconds
    const delta = (Math.random() - 0.47) * volatilityMultiplier
    const open = Number(basePrice.toFixed(digits))
    const close = Number(Math.max(digits === 5 ? 1.0 : 10, open + delta).toFixed(digits))
    const wickHigh = Math.random() * (volatilityMultiplier * 0.6)
    const wickLow = Math.random() * (volatilityMultiplier * 0.6)
    const high = Number((Math.max(open, close) + wickHigh).toFixed(digits))
    const low = Number((Math.min(open, close) - wickLow).toFixed(digits))
    const volume = Math.round(isForex ? 2500 + Math.random() * 5000 : 45 + Math.random() * 120)

    // EMA calculation
    const alpha20 = 2 / (20 + 1)
    const alpha50 = 2 / (50 + 1)
    prevEma20 = Number((close * alpha20 + prevEma20 * (1 - alpha20)).toFixed(digits))
    prevEma50 = Number((close * alpha50 + prevEma50 * (1 - alpha50)).toFixed(digits))

    const candle: CandlestickPoint = {
      time,
      open,
      high,
      low,
      close,
      volume,
      ema20: prevEma20,
      ema50: prevEma50,
    }

    // Embed realistic AI & SMC Signals
    if (i === Math.floor(count * 0.35)) {
      candle.signal = 'BUY'
      candle.signalText = isGold ? '⚡ SMC Order Block Bullish' : '⚡ AI Long Entry (96.4%)'
    } else if (i === Math.floor(count * 0.65)) {
      candle.signal = 'SMC_FVG'
      candle.signalText = '🔷 M15 Fair Value Gap Support'
    } else if (i === Math.floor(count * 0.88)) {
      candle.signal = 'TAKE_PROFIT'
      candle.signalText = '🎯 Partial TP (+3.5R)'
    }

    candles.push(candle)
    basePrice = close
  }

  return candles
}

export const INITIAL_TRADES: TradeOrder[] = [
  {
    id: 'tx-001',
    assetSymbol: 'XAU/USD',
    type: 'BUY',
    amount: 0.50,
    price: 2715.00,
    total: 1357.50,
    time: '4 mins ago',
    status: 'AI_TRIGGERED',
    pnl: 975.00,
    aiStrategy: 'XAUUSD Gold ICT Hunter',
    market: 'FOREX',
  },
  {
    id: 'tx-002',
    assetSymbol: 'BTC',
    type: 'BUY',
    amount: 0.05,
    price: 112450.00,
    total: 5622.50,
    time: '12 mins ago',
    status: 'AI_TRIGGERED',
    pnl: 121.70,
    aiStrategy: 'Neural Alpha Scalper',
    market: 'CRYPTO',
  },
  {
    id: 'tx-003',
    assetSymbol: 'EUR/USD',
    type: 'SELL',
    amount: 1.0,
    price: 1.0885,
    total: 1088.50,
    time: '1 hour ago',
    status: 'COMPLETED',
    pnl: 350.00,
    aiStrategy: 'Macro Sentinel News Bot',
    market: 'FOREX',
  },
]

export const MOCK_BACKTEST_RESULT: BacktestResult = {
  totalTrades: 1248,
  winRate: 89.4,
  profitFactor: 3.12,
  sharpeRatio: 2.85,
  sortinoRatio: 3.42,
  maxDrawdown: -4.2,
  netProfitUsd: 48920.00,
  netProfitPct: 142.8,
  equityCurve: [
    { timestamp: 'Jan', strategy: 10000, benchmark: 10000 },
    { timestamp: 'Feb', strategy: 11400, benchmark: 10400 },
    { timestamp: 'Mar', strategy: 13100, benchmark: 10100 },
    { timestamp: 'Apr', strategy: 14800, benchmark: 11200 },
    { timestamp: 'May', strategy: 17200, benchmark: 11800 },
    { timestamp: 'Jun', strategy: 19500, benchmark: 11400 },
    { timestamp: 'Jul', strategy: 22800, benchmark: 12100 },
    { timestamp: 'Aug', strategy: 26400, benchmark: 12900 },
    { timestamp: 'Sep', strategy: 30100, benchmark: 12500 },
    { timestamp: 'Oct', strategy: 34500, benchmark: 13800 },
  ],
  monthlyReturns: [
    { month: 'Jan', returnPct: 14.0 },
    { month: 'Feb', returnPct: 14.9 },
    { month: 'Mar', returnPct: 13.0 },
    { month: 'Apr', returnPct: 16.2 },
    { month: 'May', returnPct: 13.4 },
    { month: 'Jun', returnPct: 16.9 },
    { month: 'Jul', returnPct: 15.8 },
    { month: 'Aug', returnPct: 14.0 },
    { month: 'Sep', returnPct: 14.6 },
    { month: 'Oct', returnPct: 12.8 },
  ],
}

export const GENERATE_AI_SWARM_SIGNAL = (symbol: string, currentPrice: number): AISwarmSignal => {
  const isGold = symbol.includes('XAU')
  const isForex = symbol.includes('EUR') || symbol.includes('GBP') || symbol.includes('JPY')

  if (isGold) {
    const sl = Number((currentPrice - 13.50).toFixed(2))
    const tp = Number((currentPrice + 32.50).toFixed(2))
    const tp2 = Number((currentPrice + 64.00).toFixed(2))
    const rr = Number(((tp - currentPrice) / (currentPrice - sl)).toFixed(2))

    return {
      symbol: 'XAU/USD',
      side: 'BUY',
      consensusScore: 95.8,
      bias: 'STRONG_BUY',
      entryPrice: currentPrice,
      slPrice: sl,
      tpPrice: tp,
      tp2Price: tp2,
      riskReward: rr,
      recommendedLotsOrSize: 0.50,
      agentsAnalysis: [
        {
          id: 'agent-macro',
          name: 'Macro Yields Sentinel',
          role: 'Global Macro / DXY / Rates',
          conviction: 97.2,
          bias: 'BULLISH',
          rationale: 'DXY 104.2 rejection, US 10Y Yields softened to 4.18%. Central banks net gold buying +78 tonnes provides powerful institutional tailwind.',
          icon: '🛰️',
        },
        {
          id: 'agent-smc',
          name: 'SMC Orderflow Hunter',
          role: 'Smart Money / Liquidity Sweeps',
          conviction: 96.5,
          bias: 'BULLISH',
          rationale: 'London open swept Asia session low SSL liquidity ($2,708). Inverted M15 Fair Value Gap confirmed as institutional discount support.',
          icon: '🎯',
        },
        {
          id: 'agent-micro',
          name: 'Microstructure Quant',
          role: 'Order Book CVD & Aggression',
          conviction: 92.4,
          bias: 'BULLISH',
          rationale: 'Positive Cumulative Volume Delta (CVD +5,420 oz). Aggressive market takers absorbing passive liquidity on Tier-1 ECN book.',
          icon: '⚡',
        },
        {
          id: 'agent-risk',
          name: 'Institutional Risk Governor',
          role: 'VaR 95% & Kelly Optimization',
          conviction: 98.0,
          bias: 'BULLISH',
          rationale: 'Recommended 1.5% portfolio risk ($735). Risk:Reward at 1:2.41R with runner potential to 1:4.7R. Drawdown buffer well within safety bounds.',
          icon: '🛡️',
        },
      ],
    }
  }

  if (isForex) {
    const isJpy = symbol.includes('JPY')
    const digits = isJpy ? 3 : 5
    const pipDiff = isJpy ? 0.40 : 0.0035
    const sl = Number((currentPrice - pipDiff).toFixed(digits))
    const tp = Number((currentPrice + pipDiff * 2.5).toFixed(digits))
    const tp2 = Number((currentPrice + pipDiff * 4.5).toFixed(digits))
    const rr = 2.5

    return {
      symbol,
      side: 'BUY',
      consensusScore: 91.4,
      bias: 'BUY',
      entryPrice: currentPrice,
      slPrice: sl,
      tpPrice: tp,
      tp2Price: tp2,
      riskReward: rr,
      recommendedLotsOrSize: 1.00,
      agentsAnalysis: [
        {
          id: 'agent-macro',
          name: 'Macro Yields Sentinel',
          role: 'Central Bank Rate Differentials',
          conviction: 90.0,
          bias: 'BULLISH',
          rationale: 'ECB/BOJ policy divergence creates favorable swap conditions. EUR momentum supported by industrial rebound.',
          icon: '🛰️',
        },
        {
          id: 'agent-smc',
          name: 'SMC Orderflow Hunter',
          role: 'Liquidity Pools & Equilibrium',
          conviction: 93.0,
          bias: 'BULLISH',
          rationale: 'Key breaker block tested successfully during Frankfurt session. Market structure shift (MSS) confirmed on H1.',
          icon: '🎯',
        },
        {
          id: 'agent-micro',
          name: 'Microstructure Quant',
          role: 'Interbank Spread & Depth',
          conviction: 89.0,
          bias: 'BULLISH',
          rationale: 'Interbank spread compressed to 0.4 pips. Institutional bidding volume concentrated at London VWAP.',
          icon: '⚡',
        },
        {
          id: 'agent-risk',
          name: 'Institutional Risk Governor',
          role: 'Margin & Exposure Guard',
          conviction: 96.0,
          bias: 'BULLISH',
          rationale: 'Optimal lot allocation 1.00 Lot with strict 35 pips stop loss. Expected value +$875 at primary objective.',
          icon: '🛡️',
        },
      ],
    }
  }

  // CRYPTO ASSET (BTC, ETH, SOL)
  const sl = Number((currentPrice * 0.976).toFixed(2))
  const tp = Number((currentPrice * 1.058).toFixed(2))
  const tp2 = Number((currentPrice * 1.115).toFixed(2))
  const rr = Number(((tp - currentPrice) / (currentPrice - sl)).toFixed(2))

  return {
    symbol,
    side: 'BUY',
    consensusScore: 94.6,
    bias: 'STRONG_BUY',
    entryPrice: currentPrice,
    slPrice: sl,
    tpPrice: tp,
    tp2Price: tp2,
    riskReward: rr,
    recommendedLotsOrSize: symbol.includes('BTC') ? 0.20 : symbol.includes('ETH') ? 2.5 : 15.0,
    agentsAnalysis: [
      {
        id: 'agent-macro',
        name: 'Macro Yields Sentinel',
        role: 'Global M2 Liquidity & ETF Flows',
        conviction: 96.0,
        bias: 'BULLISH',
        rationale: 'Global aggregate M2 expanding at 7.8% annualized. Net US Spot Bitcoin ETF inflows average +$420M/day this week.',
        icon: '🛰️',
      },
      {
        id: 'agent-smc',
        name: 'SMC Orderflow Hunter',
        role: 'Market Structure & BSL Targets',
        conviction: 95.5,
        bias: 'BULLISH',
        rationale: 'Liquidity sweep below weekly range lows completed. Price reclaimed the daily Fair Value Gap with aggressive displacement.',
        icon: '🎯',
      },
      {
        id: 'agent-micro',
        name: 'Microstructure Quant',
        role: 'Order Book Delta & Aggression',
        conviction: 92.8,
        bias: 'BULLISH',
        rationale: 'Coinbase Prime institutional TWAP accumulation detected. Binance Perp funding rate normalized at 0.008% (healthy open interest).',
        icon: '⚡',
      },
      {
        id: 'agent-risk',
        name: 'Institutional Risk Governor',
        role: 'Liquidation Distance & VaR',
        conviction: 97.0,
        bias: 'BULLISH',
        rationale: 'Isolated margin allocation limits max portfolio loss to 1.5%. Liquidation price isolated at $74,200 (well below macro support).',
        icon: '🛡️',
      },
    ],
  }
}
