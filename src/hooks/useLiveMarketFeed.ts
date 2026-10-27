// oxlint-disable react/set-state-in-effect
import { useState, useEffect, useRef, useCallback } from 'react'
import type { CandlestickPoint, MarketCategory } from '../types/trading'
import { GENERATE_CANDLESTICK_SERIES } from '../data/mockData'
import { defaultMarketStore, type MarketTicker } from '../stores/marketStore'
import { defaultNetworkManager } from '../services/networkManager'
import {
  simulateNextGBMTick,
  getTimeframeSeconds,
  alignTimestampToInterval,
  calculateClosedBarEMA,
  calculateProvisionalEMA,
  getAssetConfig,
} from '../services/marketDataSimulator'

export interface LiveMarketFeedState {
  candles: CandlestickPoint[]
  currentPrice: number
  change24h: number
  high24h: number
  low24h: number
  volume24h: string
  connectionStatus: 'LIVE_WS' | 'SIMULATED' | 'CONNECTING'
  tickDirection: 'up' | 'down' | null
  latencyMs: number
}

const MAX_CANDLES = 100

function mapTimeframeToBinance(tf: string): string {
  switch (tf) {
    case '1m': return '1m'
    case '5m': return '5m'
    case '15m': return '15m'
    case '1H': case '1h': return '1h'
    case '4H': case '4h': return '4h'
    case '1D': case '1d': return '1d'
    case '1W': case '1w': return '1w'
    default: return '1h'
  }
}

export function useLiveMarketFeed(
  symbol: string,
  timeframe: string = '1H',
  category: MarketCategory = 'CRYPTO',
  initialPrice: number = 114884.00
): LiveMarketFeedState {
  const isGold =
    symbol.toUpperCase().includes('XAU') || symbol.toUpperCase().includes('GOLD')
  const isForex =
    (category === 'FOREX' ||
      (symbol.includes('/') &&
        (symbol.includes('USD') ||
          symbol.includes('EUR') ||
          symbol.includes('JPY') ||
          symbol.includes('XAU')))) &&
    !isGold

  const [candles, setCandles] = useState<CandlestickPoint[]>(() =>
    GENERATE_CANDLESTICK_SERIES(symbol, timeframe, 80)
  )
  const [currentPrice, setCurrentPrice] = useState<number>(initialPrice)
  const [change24h, setChange24h] = useState<number>(isForex ? 1.15 : 4.61)
  const [high24h, setHigh24h] = useState<number>(initialPrice * 1.025)
  const [low24h, setLow24h] = useState<number>(initialPrice * 0.975)
  const [volume24h, setVolume24h] = useState<string>(isForex ? '128.4B' : '18.7B')
  const [connectionStatus, setConnectionStatus] = useState<
    'LIVE_WS' | 'SIMULATED' | 'CONNECTING'
  >(isForex ? 'SIMULATED' : 'CONNECTING')
  const [tickDirection, setTickDirection] = useState<'up' | 'down' | null>(null)
  const [latencyMs, setLatencyMs] = useState<number>(14)

  const prevPriceRef = useRef(initialPrice)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null)
  const isComponentMountedRef = useRef<boolean>(true)

  // Generation epoch counter to prevent async WS/timeout collisions
  const connectionEpochRef = useRef<number>(0)
  // Track last bar time finalized to prevent double EMA decay
  const lastFinalizedBarTimeRef = useRef<number | null>(null)
  // RAF batching refs for incoming high-frequency ticks
  const rafIdRef = useRef<number | null>(null)
  const pendingTickRef = useRef<{
    closeP: number
    openP: number
    highP: number
    lowP: number
    vol: number
    candleTime: number
    isBarClosed: boolean
  } | null>(null)

  // Track the closed-bar EMA baseline so intra-bar ticks never degrade the historical smoothing
  const closedEma20Ref = useRef<number | undefined>(undefined)
  const closedEma50Ref = useRef<number | undefined>(undefined)

  // Helper to sync marketStore ticker on incoming price
  const syncMarketStore = useCallback(
    (
      sym: string,
      price: number,
      status: 'LIVE_WS' | 'SIMULATED' | 'CONNECTING',
      chgPct?: number,
      high?: number,
      low?: number,
      vol?: number
    ) => {
      const existing = defaultMarketStore.getTicker(sym)
      const cfg = getAssetConfig(sym)
      const spreadUsd = existing?.spreadUsd ?? cfg.defaultSpreadPips * cfg.pipSize
      const spreadPips = existing?.spreadPips ?? cfg.defaultSpreadPips

      const updatedTicker: MarketTicker = {
        symbol: sym,
        category: isForex ? 'FOREX' : 'CRYPTO',
        midPrice: price,
        bidPrice: Number((price - spreadUsd / 2).toFixed(cfg.digits)),
        askPrice: Number((price + spreadUsd / 2).toFixed(cfg.digits)),
        spreadPips,
        spreadUsd,
        high24h: high ?? existing?.high24h ?? price * 1.02,
        low24h: low ?? existing?.low24h ?? price * 0.98,
        change24hPct: chgPct ?? existing?.change24hPct ?? (isForex ? 1.15 : 4.61),
        volume24h: vol ?? existing?.volume24h ?? 18700000000,
        lastUpdateTimestamp: Date.now(),
        connectionStatus: status,
      }

      defaultMarketStore.setTicker(updatedTicker)
    },
    [isForex]
  )

  // Synchronize candle series and store on symbol or timeframe change
  useEffect(() => {
    const initialSeries = GENERATE_CANDLESTICK_SERIES(symbol, timeframe, 80)
    setCandles(initialSeries)

    if (initialSeries.length > 1) {
      const secondToLast = initialSeries[initialSeries.length - 2]
      closedEma20Ref.current = secondToLast.ema20
      closedEma50Ref.current = secondToLast.ema50
    } else {
      closedEma20Ref.current = initialPrice
      closedEma50Ref.current = initialPrice
    }

    const latestClose = initialSeries[initialSeries.length - 1]?.close || initialPrice
    setCurrentPrice(latestClose)
    prevPriceRef.current = latestClose
    const initialHigh = latestClose * 1.02
    const initialLow = latestClose * 0.98
    setHigh24h(initialHigh)
    setLow24h(initialLow)

    syncMarketStore(symbol, latestClose, isForex ? 'SIMULATED' : 'CONNECTING', undefined, initialHigh, initialLow)
  }, [symbol, timeframe, isForex, initialPrice, syncMarketStore])


  // Streaming Engine: Hybrid Binance WebSocket for Crypto + Calibrated GBM for Forex/Gold
  useEffect(() => {
    const epochRef = connectionEpochRef
    const currentEpoch = ++epochRef.current
    lastFinalizedBarTimeRef.current = null
    isComponentMountedRef.current = true
    let fallbackInterval: ReturnType<typeof setInterval> | null = null
    const intervalSec = getTimeframeSeconds(timeframe)

    const stopFallbackSimulation = () => {
      if (fallbackInterval) {
        clearInterval(fallbackInterval)
        fallbackInterval = null
      }
    }

    const startFallbackSimulation = () => {
      if (currentEpoch !== connectionEpochRef.current) return
      if (fallbackInterval) return
      setConnectionStatus('SIMULATED')
      setLatencyMs(Math.floor(5 + Math.random() * 8))

      fallbackInterval = setInterval(() => {
        if (currentEpoch !== connectionEpochRef.current || !isComponentMountedRef.current) return

        setCandles((prevCandles) => {
          if (prevCandles.length === 0) return prevCandles

          const lastIdx = prevCandles.length - 1
          const lastCandle = prevCandles[lastIdx]

          // Calibrated GBM step with session volatility
          const tickResult = simulateNextGBMTick(symbol, lastCandle.close, 1.5)
          const nextClose = tickResult.nextPrice
          const dir = nextClose > lastCandle.close ? 'up' : nextClose < lastCandle.close ? 'down' : null

          prevPriceRef.current = nextClose
          setCurrentPrice(nextClose)
          setTickDirection(dir)

          // Align current time to clean boundary
          const nowSec = Math.floor(Date.now() / 1000)
          const alignedNow = alignTimestampToInterval(nowSec, intervalSec)

          const updated = [...prevCandles]

          if (alignedNow > lastCandle.time) {
            // New Bar: Finalize previous candle closed EMA exactly once
            if (lastFinalizedBarTimeRef.current !== lastCandle.time) {
              closedEma20Ref.current = calculateClosedBarEMA(closedEma20Ref.current, lastCandle.close, 20)
              closedEma50Ref.current = calculateClosedBarEMA(closedEma50Ref.current, lastCandle.close, 50)
              lastFinalizedBarTimeRef.current = lastCandle.time
            }

            // Start new bar with provisional EMA preview
            const newEma20 = calculateProvisionalEMA(closedEma20Ref.current, nextClose, 20)
            const newEma50 = calculateProvisionalEMA(closedEma50Ref.current, nextClose, 50)

            updated.push({
              time: alignedNow,
              open: nextClose,
              high: nextClose,
              low: nextClose,
              close: nextClose,
              volume: Math.round(10 + Math.random() * 20),
              ema20: newEma20,
              ema50: newEma50,
            })

            // Strict memory bounding (F14)
            if (updated.length > MAX_CANDLES) {
              updated.shift()
            }
          } else {
            // Intra-bar update: compute provisional EMA preview without mutating closed baseline
            const provEma20 = calculateProvisionalEMA(closedEma20Ref.current, nextClose, 20)
            const provEma50 = calculateProvisionalEMA(closedEma50Ref.current, nextClose, 50)

            updated[lastIdx] = {
              ...lastCandle,
              close: nextClose,
              high: Math.max(lastCandle.high, nextClose),
              low: Math.min(lastCandle.low, nextClose),
              volume: lastCandle.volume + Math.round(Math.random() * 3),
              ema20: provEma20,
              ema50: provEma50,
            }
          }

          syncMarketStore(symbol, nextClose, 'SIMULATED')
          return updated
        })
      }, 1500)
    }

    // Subscribe to manual reconnect trigger from NetworkStateMachine
    const unsubscribeManualReconnect = defaultNetworkManager.subscribeToReconnect(() => {
      if (currentEpoch === connectionEpochRef.current && isComponentMountedRef.current) {
        if (wsRef.current) {
          wsRef.current.close()
          wsRef.current = null
        }
        if (!isForex) {
          connectWebSocket()
        }
      }
    })

    const connectWebSocket = () => {
      if (!isComponentMountedRef.current || currentEpoch !== connectionEpochRef.current) return

      const cleanSym = symbol.replace(/[^a-zA-Z]/g, '').toLowerCase()
      const streamSymbol = isGold ? 'paxgusdt' : cleanSym.endsWith('usdt') ? cleanSym : `${cleanSym}usdt`
      const tfStr = mapTimeframeToBinance(timeframe)
      const wsUrl = `wss://stream.binance.com:9443/ws/${streamSymbol}@kline_${tfStr}`

      setConnectionStatus('CONNECTING')

      // Pre-fetch real 24/7 historical klines from Binance REST
      fetch(`https://api.binance.com/api/v3/klines?symbol=${streamSymbol.toUpperCase()}&interval=${tfStr}&limit=80`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (Array.isArray(data) && data.length > 0 && currentEpoch === connectionEpochRef.current && isComponentMountedRef.current) {
            let pEma20: number | undefined
            let pEma50: number | undefined
            const realKlines: CandlestickPoint[] = data.map((item: (string | number)[]) => {
              const time = Math.floor(Number(item[0]) / 1000)
              const open = parseFloat(String(item[1]))
              const high = parseFloat(String(item[2]))
              const low = parseFloat(String(item[3]))
              const close = parseFloat(String(item[4]))
              const vol = parseFloat(String(item[5]))

              pEma20 = pEma20 === undefined ? close : calculateClosedBarEMA(pEma20, close, 20)
              pEma50 = pEma50 === undefined ? close : calculateClosedBarEMA(pEma50, close, 50)

              return {
                time,
                open,
                high,
                low,
                close,
                volume: vol,
                ema20: pEma20,
                ema50: pEma50,
              }
            })

            setCandles(realKlines)
            if (realKlines.length > 1) {
              closedEma20Ref.current = realKlines[realKlines.length - 2].ema20
              closedEma50Ref.current = realKlines[realKlines.length - 2].ema50
            }
            const lastCandle = realKlines[realKlines.length - 1]
            setCurrentPrice(lastCandle.close)
            prevPriceRef.current = lastCandle.close
            syncMarketStore(symbol, lastCandle.close, 'LIVE_WS')
          }
        })
        .catch(() => {
          // Fallback or WS will handle seamlessly
        })

      try {
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          if (currentEpoch !== connectionEpochRef.current || !isComponentMountedRef.current) {
            ws.close()
            return
          }
          // CRITICAL: Stop fallback simulation immediately to prevent dual-stream collision
          stopFallbackSimulation()
          setConnectionStatus('LIVE_WS')
          setLatencyMs(Math.floor(8 + Math.random() * 10))
          defaultNetworkManager.handleReconnectSuccess()
        }

        const flushPendingTick = (data: {
          closeP: number
          openP: number
          highP: number
          lowP: number
          vol: number
          candleTime: number
          isBarClosed: boolean
        }) => {
          if (currentEpoch !== connectionEpochRef.current || !isComponentMountedRef.current) return

          const { closeP, openP, highP, lowP, vol, candleTime, isBarClosed } = data
          const prevP = prevPriceRef.current
          const dir = closeP > prevP ? 'up' : closeP < prevP ? 'down' : null
          prevPriceRef.current = closeP

          setCurrentPrice(closeP)
          setTickDirection(dir)
          setLatencyMs(Math.floor(9 + Math.random() * 8))
          setVolume24h(`${vol.toFixed(1)} Vol`)
          const calculatedChange = Number((((closeP - openP) / (openP || 1)) * 100).toFixed(2))
          setChange24h(calculatedChange)

          setCandles((prevCandles) => {
            const updated = [...prevCandles]
            const lastIdx = updated.length - 1
            if (lastIdx >= 0) {
              const lastCandle = updated[lastIdx]

              if (candleTime === lastCandle.time) {
                // Intra-bar update: calculate safe provisional EMA preview
                const provEma20 = calculateProvisionalEMA(closedEma20Ref.current, closeP, 20)
                const provEma50 = calculateProvisionalEMA(closedEma50Ref.current, closeP, 50)

                if (isBarClosed && lastFinalizedBarTimeRef.current !== candleTime) {
                  closedEma20Ref.current = calculateClosedBarEMA(closedEma20Ref.current, closeP, 20)
                  closedEma50Ref.current = calculateClosedBarEMA(closedEma50Ref.current, closeP, 50)
                  lastFinalizedBarTimeRef.current = candleTime
                }

                updated[lastIdx] = {
                  ...lastCandle,
                  high: Math.max(lastCandle.high, highP),
                  low: Math.min(lastCandle.low, lowP),
                  close: closeP,
                  volume: vol,
                  ema20: provEma20,
                  ema50: provEma50,
                }
              } else if (candleTime > lastCandle.time) {
                // New bar arrived: finalize previous candle closed EMA exactly once
                if (lastFinalizedBarTimeRef.current !== lastCandle.time) {
                  closedEma20Ref.current = calculateClosedBarEMA(closedEma20Ref.current, lastCandle.close, 20)
                  closedEma50Ref.current = calculateClosedBarEMA(closedEma50Ref.current, lastCandle.close, 50)
                  lastFinalizedBarTimeRef.current = lastCandle.time
                }

                const provEma20 = calculateProvisionalEMA(closedEma20Ref.current, closeP, 20)
                const provEma50 = calculateProvisionalEMA(closedEma50Ref.current, closeP, 50)

                updated.push({
                  time: candleTime,
                  open: openP,
                  high: highP,
                  low: lowP,
                  close: closeP,
                  volume: vol,
                  ema20: provEma20,
                  ema50: provEma50,
                })

                // Strict memory bounding (F14)
                if (updated.length > MAX_CANDLES) {
                  updated.shift()
                }
              }
            }
            return updated
          })

          syncMarketStore(symbol, closeP, 'LIVE_WS', calculatedChange)
        }

        ws.onmessage = (event) => {
          if (currentEpoch !== connectionEpochRef.current || !isComponentMountedRef.current) return
          try {
            const msg = JSON.parse(event.data)
            if (msg.e === 'kline' && msg.k) {
              if (msg.E) {
                const ping = Math.max(1, Date.now() - msg.E)
                defaultNetworkManager.recordLatency(ping)
              }

              const k = msg.k
              const rawCandleTime = Math.floor(k.t / 1000)
              const candleTime = alignTimestampToInterval(rawCandleTime, intervalSec)
              const closeP = parseFloat(k.c)
              const openP = parseFloat(k.o)
              const highP = parseFloat(k.h)
              const lowP = parseFloat(k.l)
              const vol = parseFloat(k.v)
              const isBarClosed = Boolean(k.x)

              pendingTickRef.current = { closeP, openP, highP, lowP, vol, candleTime, isBarClosed }

              // Batch updates via requestAnimationFrame if in browser, otherwise flush immediately
              if (typeof requestAnimationFrame !== 'undefined') {
                if (rafIdRef.current === null) {
                  rafIdRef.current = requestAnimationFrame(() => {
                    rafIdRef.current = null
                    if (pendingTickRef.current) {
                      flushPendingTick(pendingTickRef.current)
                    }
                  })
                }
              } else {
                flushPendingTick(pendingTickRef.current)
              }
            }
          } catch {
            // ignore parse errors
          }
        }

        ws.onerror = () => {
          if (currentEpoch !== connectionEpochRef.current) return
          defaultNetworkManager.handleDisconnect()
          startFallbackSimulation()
        }

        ws.onclose = () => {
          if (currentEpoch !== connectionEpochRef.current || !isComponentMountedRef.current) return
          defaultNetworkManager.handleDisconnect()
          startFallbackSimulation()

          if (defaultNetworkManager.getState() !== 'OFFLINE') {
            const attempts = defaultNetworkManager.getRetryAttempts()
            const backoffMs = defaultNetworkManager.calculateBackoff(attempts - 1)

            reconnectTimeoutRef.current = setTimeout(() => {
              if (currentEpoch === connectionEpochRef.current && isComponentMountedRef.current) {
                connectWebSocket()
              }
            }, backoffMs)
          }
        }
      } catch {
        defaultNetworkManager.handleDisconnect()
        startFallbackSimulation()
      }
    }

    if (isForex) {
      // Forex / Gold: Pure Calibrated ECN Simulation
      startFallbackSimulation()
    } else {
      // Crypto: Binance Public WebSocket with Exponential Backoff
      connectWebSocket()
    }

    return () => {
      unsubscribeManualReconnect()
      epochRef.current++
      isComponentMountedRef.current = false
      if (rafIdRef.current !== null && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.onopen = null
        wsRef.current.onmessage = null
        wsRef.current.onerror = null
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      stopFallbackSimulation()
    }
  }, [symbol, timeframe, isForex, isGold, syncMarketStore])

  return {
    candles,
    currentPrice,
    change24h,
    high24h,
    low24h,
    volume24h,
    connectionStatus,
    tickDirection,
    latencyMs,
  }
}
