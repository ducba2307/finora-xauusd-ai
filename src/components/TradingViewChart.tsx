import React, { useEffect, useRef, useState } from 'react'
import {
  createChart,
  CandlestickSeries,
  AreaSeries,
  HistogramSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  createSeriesMarkers
} from 'lightweight-charts'
import type {
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
  CandlestickData,
  WhitespaceData,
  HistogramData,
  SeriesMarker,
  IPriceLine
} from 'lightweight-charts'
import { 
  Sparkles, Layers, Eye, EyeOff, Maximize2, Minimize2, 
  Wifi, BarChart2, Activity, Zap, Bell, Code2, Bot, BoxSelect
} from 'lucide-react'
import type { CandlestickPoint, Position } from '../types/trading'
import { formatCurrency, formatPercent } from '../utils/formatters'
import { DrawingToolbar } from './charting/DrawingToolbar'
import { SelectExplainModal } from './charting/SelectExplainModal'
import { NaturalLanguageMonitorModal } from './charting/NaturalLanguageMonitorModal'
import { PineScriptMigrationModal } from './charting/PineScriptMigrationModal'
import { LineAlertBreachModal } from './charting/LineAlertBreachModal'
import { VolumeProfileOverlay } from './charting/VolumeProfileOverlay'
import { SMCOverlayPanel } from './charting/SMCOverlayPanel'
import { calculateVolumeProfile } from '../services/volumeProfileService'
import { generateAnomalyInvestigation } from '../services/aiAgentService'
import { analyzeSMCStructure, type SMCAnalysisResult, type SMCTradeSetup } from '../quant/smartMoneyConcepts'
import { playTakeProfitSound } from '../utils/soundEffects'
import type { ChartDrawingTool, DrawnObject, SelectExplainRange, VolumeProfileData } from '../types/aiCharting'

interface TradingViewChartProps {
  symbol: string
  currentPrice: number
  change24h: number
  candles: CandlestickPoint[]
  timeframe: string
  onTimeframeChange: (tf: string) => void
  showAiSignals: boolean
  onToggleAiSignals: () => void
  connectionStatus?: 'LIVE_WS' | 'SIMULATED' | 'CONNECTING'
  latencyMs?: number
  activePositions?: Position[]
  onOpenAlerts?: () => void
  onExecuteSmcSetup?: (setup: SMCTradeSetup) => void
}

export const TradingViewChart = React.memo<TradingViewChartProps>(({
  symbol,
  currentPrice,
  change24h,
  candles,
  timeframe,
  onTimeframeChange,
  showAiSignals,
  onToggleAiSignals,
  connectionStatus = 'LIVE_WS',
  latencyMs = 12,
  activePositions = [],
  onOpenAlerts,
  onExecuteSmcSetup,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  
  // Series refs
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const areaSeriesRef = useRef<ISeriesApi<'Area'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const ema20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const ema50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const positionPriceLinesRef = useRef<IPriceLine[]>([])
  const isInitializedRef = useRef<boolean>(false)
  const prevCandlesLenRef = useRef<number>(0)
  const prevSymbolRef = useRef<string>(symbol)
  const prevTimeframeRef = useRef<string>(timeframe)

  // Chart settings state
  const [chartType, setChartType] = useState<'CANDLES' | 'AREA'>('CANDLES')
  const [showEma, setShowEma] = useState<boolean>(true)
  const [showVolume, setShowVolume] = useState<boolean>(true)
  const [showSmcZones, setShowSmcZones] = useState<boolean>(true)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)

  // AI & Advanced Charting states
  const [activeTool, setActiveTool] = useState<ChartDrawingTool>('CURSOR')
  const [isLocked, setIsLocked] = useState(false)
  const [showVolumeProfile, setShowVolumeProfile] = useState(false)
  const [isSelectExplainOpen, setIsSelectExplainOpen] = useState(false)
  const [isNlMonitorOpen, setIsNlMonitorOpen] = useState(false)
  const [isPineMigrationOpen, setIsPineMigrationOpen] = useState(false)
  const [selectExplainRange, setSelectExplainRange] = useState<SelectExplainRange | null>(null)
  const [drawnObjects, setDrawnObjects] = useState<DrawnObject[]>([])
  const [breachedLine, setBreachedLine] = useState<DrawnObject | null>(null)
  const drawnPriceLinesRef = useRef<IPriceLine[]>([])
  const smcPriceLinesRef = useRef<IPriceLine[]>([])

  // Hover Crosshair Legend state
  const [hoverData, setHoverData] = useState<{
    open: number
    high: number
    low: number
    close: number
    volume?: number
    time?: string
  } | null>(null)

  const TIMEFRAMES = ['1m', '5m', '15m', '1H', '4H', '1D', '1W']

  // Smart Money Concepts (SMC) Institutional Engine Analysis
  const smcResult = React.useMemo<SMCAnalysisResult | null>(() => {
    if (!candles || candles.length < 5) return null
    return analyzeSMCStructure(candles, currentPrice, symbol)
  }, [candles, currentPrice, symbol])

  // Volume Profile (VPVR) Data
  const volumeProfileData = React.useMemo<VolumeProfileData | null>(() => {
    if (!showVolumeProfile || !candles || candles.length === 0) return null
    return calculateVolumeProfile(symbol, candles, 24)
  }, [showVolumeProfile, candles, symbol])

  // Open Select -> Explain with captured coordinates from recent bars
  const handleOpenSelectExplain = () => {
    if (!candles || candles.length === 0) return
    const sliceLen = Math.min(20, candles.length)
    const selectedCandles = candles.slice(candles.length - sliceLen)
    const firstC = selectedCandles[0]
    const lastC = selectedCandles[selectedCandles.length - 1]

    let high = -Infinity
    let low = Infinity
    let volTotal = 0
    for (const c of selectedCandles) {
      if (c.high > high) high = c.high
      if (c.low < low) low = c.low
      volTotal += c.volume || 100
    }

    const changePct = firstC.open > 0 ? ((lastC.close - firstC.open) / firstC.open) * 100 : 0
    const avgVol = 1500
    const ratio = avgVol > 0 ? (volTotal / sliceLen) / avgVol : 2.4

    const range: SelectExplainRange = {
      id: `range-${Date.now()}`,
      symbol,
      startTime: firstC.time,
      endTime: lastC.time,
      startPrice: firstC.open,
      endPrice: lastC.close,
      highPrice: high,
      lowPrice: low,
      changePct: Number(changePct.toFixed(2)),
      barsCount: sliceLen,
      volumeTotal: volTotal,
      volumeRatioVsAvg: Number(ratio.toFixed(1)),
    }

    setSelectExplainRange(range)
    setIsSelectExplainOpen(true)
  }

  // Handle Drawing Toolbar Selection
  const handleSelectTool = (tool: ChartDrawingTool) => {
    setActiveTool(tool)
    if (tool === 'VOLUME_PROFILE') {
      setShowVolumeProfile((prev) => !prev)
    } else if (tool === 'SELECT_EXPLAIN') {
      handleOpenSelectExplain()
    } else if (tool === 'HORIZONTAL_LINE') {
      const price = Number(currentPrice.toFixed(2))
      const newObj: DrawnObject = {
        id: `draw-${Date.now()}`,
        type: 'HORIZONTAL_LINE',
        symbol,
        points: [{ time: Math.floor(Date.now() / 1000), price }],
        label: `AI Watcher @ $${price}`,
        color: '#ec4899',
        enableAiAlert: true,
        aiProvider: 'GEMINI',
      }
      setDrawnObjects((prev) => [...prev, newObj])

      if (candlestickSeriesRef.current) {
        const line = candlestickSeriesRef.current.createPriceLine({
          price,
          color: '#ec4899',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `[AI Alert Line] $${price}`,
        })
        drawnPriceLinesRef.current.push(line)
      }
    } else if (tool === 'TRENDLINE') {
      const price = Number((currentPrice * 0.985).toFixed(2))
      const newObj: DrawnObject = {
        id: `draw-${Date.now()}`,
        type: 'TRENDLINE',
        symbol,
        points: [
          { time: Math.floor(Date.now() / 1000) - 7200, price },
          { time: Math.floor(Date.now() / 1000), price: Number((currentPrice * 0.995).toFixed(2)) },
        ],
        label: `Ascending Trendline Support`,
        color: '#06b6d4',
        enableAiAlert: true,
        aiProvider: 'CLAUDE',
      }
      setDrawnObjects((prev) => [...prev, newObj])

      if (candlestickSeriesRef.current) {
        const line = candlestickSeriesRef.current.createPriceLine({
          price,
          color: '#06b6d4',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `[Trendline Level] $${price}`,
        })
        drawnPriceLinesRef.current.push(line)
      }
    } else if (tool === 'PRICE_ZONE') {
      const topPrice = Number((currentPrice * 1.015).toFixed(2))
      const bottomPrice = Number((currentPrice * 0.985).toFixed(2))
      const newObj: DrawnObject = {
        id: `draw-${Date.now()}`,
        type: 'PRICE_ZONE',
        symbol,
        points: [
          { time: Math.floor(Date.now() / 1000), price: topPrice },
          { time: Math.floor(Date.now() / 1000), price: bottomPrice },
        ],
        label: `SMC Order Block Zone`,
        color: '#a855f7',
        enableAiAlert: true,
        aiProvider: 'CODEX',
      }
      setDrawnObjects((prev) => [...prev, newObj])

      if (candlestickSeriesRef.current) {
        const line1 = candlestickSeriesRef.current.createPriceLine({
          price: topPrice,
          color: '#a855f7',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `[SMC Zone Top]`,
        })
        const line2 = candlestickSeriesRef.current.createPriceLine({
          price: bottomPrice,
          color: '#a855f7',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `[SMC Zone Bottom]`,
        })
        drawnPriceLinesRef.current.push(line1, line2)
      }
    }
  }

  // Clear all drawings
  const handleClearDrawings = () => {
    drawnPriceLinesRef.current.forEach((line) => {
      try {
        candlestickSeriesRef.current?.removePriceLine(line)
      } catch {}
    })
    drawnPriceLinesRef.current = []
    setDrawnObjects([])
  }

  // Tick-by-tick Line Breach Detection: triggers audio alert and instant AI root-cause investigation
  const lastCheckedPriceRef = useRef<number>(currentPrice)
  useEffect(() => {
    const prev = lastCheckedPriceRef.current
    lastCheckedPriceRef.current = currentPrice

    for (const obj of drawnObjects) {
      if (!obj.enableAiAlert || obj.isBreached) continue
      const targetP = obj.points[0]?.price || 0
      const isCrossed =
        (prev <= targetP && currentPrice >= targetP) ||
        (prev >= targetP && currentPrice <= targetP)

      if (isCrossed) {
        const updatedReport = generateAnomalyInvestigation(
          symbol,
          {
            changePct: ((currentPrice - targetP) / targetP) * 100,
            triggerReason: `Price breached user drawn ${obj.type} at $${targetP}`,
          },
          obj.aiProvider
        )
        const updatedObj: DrawnObject = {
          ...obj,
          isBreached: true,
          breachPrice: currentPrice,
          breachedAt: Date.now(),
          investigationReport: updatedReport,
        }

        setDrawnObjects((prevObjs) =>
          prevObjs.map((o) => (o.id === obj.id ? updatedObj : o))
        )
        playTakeProfitSound()
        setBreachedLine(updatedObj)
        break
      }
    }
  }, [currentPrice, drawnObjects, symbol])

  // 1. Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return

    const container = chartContainerRef.current

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 480,
      layout: {
        background: { type: ColorType.Solid, color: '#07090e' },
        textColor: '#9ca3af',
        fontSize: 11,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(236, 72, 153, 0.4)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#ec4899',
        },
        horzLine: {
          color: 'rgba(236, 72, 153, 0.4)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#ec4899',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        scaleMargins: {
          top: 0.1,
          bottom: 0.22,
        },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    })

    chartRef.current = chart

    // 2. Add Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    })
    candlestickSeriesRef.current = candleSeries

    // 3. Add Area Series (fallback/toggle)
    const areaSeries = chart.addSeries(AreaSeries, {
      topColor: 'rgba(236, 72, 153, 0.35)',
      bottomColor: 'rgba(236, 72, 153, 0.0)',
      lineColor: '#ec4899',
      lineWidth: 2,
      visible: false,
    })
    areaSeriesRef.current = areaSeries

    // 4. Add Volume Histogram Series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: '',
      priceFormat: { type: 'volume' },
    })
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
    })
    volumeSeriesRef.current = volumeSeries

    // 5. Add EMA 20 & EMA 50 Lines
    const ema20Series = chart.addSeries(LineSeries, {
      color: '#06b6d4',
      lineWidth: 2,
      title: 'EMA 20',
    })
    ema20SeriesRef.current = ema20Series

    const ema50Series = chart.addSeries(LineSeries, {
      color: '#ec4899',
      lineWidth: 2,
      title: 'EMA 50',
    })
    ema50SeriesRef.current = ema50Series

    // Subscribe to crosshair move for interactive legend
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setHoverData(null)
        return
      }

      const candleData = param.seriesData.get(candleSeries) as (CandlestickData<UTCTimestamp> | WhitespaceData<UTCTimestamp>) | undefined
      const volData = param.seriesData.get(volumeSeries) as (HistogramData<UTCTimestamp> | WhitespaceData<UTCTimestamp>) | undefined

      if (candleData && 'open' in candleData) {
        setHoverData({
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: volData && 'value' in volData ? volData.value : undefined,
          time: new Date((param.time as number) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        })
      } else {
        setHoverData(null)
      }
    })

    // Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !chartRef.current) return
      const { width, height } = entries[0].contentRect
      chartRef.current.applyOptions({ width, height })
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
    }
  }, [])

  // 2. Synchronize Data with Series: O(1) streaming updates, setData ONLY on reset
  useEffect(() => {
    if (!candles || candles.length === 0 || !candlestickSeriesRef.current) return

    const isSymbolOrTfChange =
      prevSymbolRef.current !== symbol ||
      prevTimeframeRef.current !== timeframe ||
      !isInitializedRef.current

    if (isSymbolOrTfChange) {
      // Full series rebuild only on symbol/timeframe switch or initial load
      prevSymbolRef.current = symbol
      prevTimeframeRef.current = timeframe
      prevCandlesLenRef.current = candles.length
      isInitializedRef.current = true

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
  }, [candles, symbol, timeframe])

  // Dedicated AI & SMC Markers Synchronization Effect
  useEffect(() => {
    if (!candlestickSeriesRef.current) return

    const markers: SeriesMarker<UTCTimestamp>[] = []

    if (showAiSignals) {
      candles.forEach((c) => {
        if (c.signal === 'BUY') {
          markers.push({
            time: c.time as UTCTimestamp,
            position: 'belowBar',
            color: '#10b981',
            shape: 'arrowUp',
            text: c.signalText || '⚡ AI BUY',
          })
        } else if (c.signal === 'TAKE_PROFIT') {
          markers.push({
            time: c.time as UTCTimestamp,
            position: 'aboveBar',
            color: '#f59e0b',
            shape: 'circle',
            text: c.signalText || '🎯 TAKE PROFIT',
          })
        } else if (c.signal === 'SMC_FVG' && showSmcZones) {
          markers.push({
            time: c.time as UTCTimestamp,
            position: 'belowBar',
            color: '#38bdf8',
            shape: 'arrowUp',
            text: c.signalText || '🔷 FVG ZONE',
          })
        }
      })
    }

    // Add Smart Money Concepts (SMC) Institutional Markers matching the video
    if (showSmcZones && smcResult) {
      // 1. Swept Liquidity Pools (SSL Swept / BSL Swept)
      smcResult.liquidityPools.forEach((pool) => {
        if (pool.isSwept && pool.sweptAtTime) {
          markers.push({
            time: pool.sweptAtTime as UTCTimestamp,
            position: pool.type === 'SSL' ? 'belowBar' : 'aboveBar',
            color: pool.type === 'SSL' ? '#10b981' : '#f43f5e',
            shape: pool.type === 'SSL' ? 'arrowUp' : 'arrowDown',
            text: pool.type === 'SSL' ? '⚡ SSL SWEPT' : '⚡ BSL SWEPT',
          })
        }
      })

      // 2. Market Structure Breaks: CHoCH (Change of Character) & BOS (Break of Structure)
      smcResult.structureBreaks.forEach((brk) => {
        const isBull = brk.direction === 'BULLISH'
        markers.push({
          time: brk.time as UTCTimestamp,
          position: isBull ? 'belowBar' : 'aboveBar',
          color: brk.type === 'CHOCH' ? (isBull ? '#06b6d4' : '#f97316') : '#a855f7',
          shape: brk.type === 'CHOCH' ? (isBull ? 'arrowUp' : 'arrowDown') : 'circle',
          text: `${brk.type} ${isBull ? '↑' : '↓'}`,
        })
      })

      // 3. Unmitigated FVGs (top 3)
      smcResult.fvgs.slice(-3).forEach((fvg) => {
        if (!fvg.isMitigated) {
          markers.push({
            time: fvg.time as UTCTimestamp,
            position: fvg.type === 'BULLISH' ? 'belowBar' : 'aboveBar',
            color: '#38bdf8',
            shape: 'square',
            text: fvg.type === 'BULLISH' ? '🔷 FVG' : '🔶 FVG',
          })
        }
      })
    }

    if (markers.length > 0) {
      markers.sort((a, b) => (Number(a.time) || 0) - (Number(b.time) || 0))
      createSeriesMarkers(candlestickSeriesRef.current, markers)
    } else {
      createSeriesMarkers(candlestickSeriesRef.current, [])
    }
  }, [showAiSignals, showSmcZones, candles, symbol, smcResult])

  // 3. Toggle Visibility based on controls
  useEffect(() => {
    if (candlestickSeriesRef.current && areaSeriesRef.current) {
      candlestickSeriesRef.current.applyOptions({ visible: chartType === 'CANDLES' })
      areaSeriesRef.current.applyOptions({ visible: chartType === 'AREA' })
    }
  }, [chartType])

  useEffect(() => {
    if (ema20SeriesRef.current && ema50SeriesRef.current) {
      ema20SeriesRef.current.applyOptions({ visible: showEma })
      ema50SeriesRef.current.applyOptions({ visible: showEma })
    }
  }, [showEma])

  useEffect(() => {
    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.applyOptions({ visible: showVolume })
    }
  }, [showVolume])

  // Synchronize Active Positions as Visual Price Lines
  useEffect(() => {
    if (!candlestickSeriesRef.current) return

    // Safely remove previous position lines
    positionPriceLinesRef.current.forEach((line) => {
      try {
        candlestickSeriesRef.current?.removePriceLine(line)
      } catch {
        // ignore
      }
    })
    positionPriceLinesRef.current = []

    if (!activePositions || activePositions.length === 0) return

    // Filter positions relevant to this symbol
    const cleanCurSym = symbol.replace(/[^a-zA-Z]/g, '').toUpperCase()
    const matchingPositions = activePositions.filter((pos) => {
      const cleanPosSym = pos.symbol.replace(/[^a-zA-Z]/g, '').toUpperCase()
      return cleanPosSym.includes(cleanCurSym) || cleanCurSym.includes(cleanPosSym)
    })

    matchingPositions.forEach((pos) => {
      // 1. Entry Price Line (Cyan solid)
      const entryLine = candlestickSeriesRef.current?.createPriceLine({
        price: pos.entryPrice,
        color: '#06b6d4',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `[ENTRY ${pos.side} ${pos.size}${pos.market === 'FOREX' ? 'L' : ''}]`,
      })
      if (entryLine) positionPriceLinesRef.current.push(entryLine)

      // 2. Take Profit Line (Emerald dashed)
      if (pos.tpPrice) {
        const tpLine = candlestickSeriesRef.current?.createPriceLine({
          price: pos.tpPrice,
          color: '#10b981',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `[TP]`,
        })
        if (tpLine) positionPriceLinesRef.current.push(tpLine)
      }

      // 3. Stop Loss Line (Rose dashed)
      if (pos.slPrice) {
        const slLine = candlestickSeriesRef.current?.createPriceLine({
          price: pos.slPrice,
          color: '#f43f5e',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `[SL]`,
        })
        if (slLine) positionPriceLinesRef.current.push(slLine)
      }

      // 4. Liquidation Line (Amber dotted)
      if (pos.liquidationPrice > 0) {
        const liqLine = candlestickSeriesRef.current?.createPriceLine({
          price: pos.liquidationPrice,
          color: '#f59e0b',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `[LIQ]`,
        })
        if (liqLine) positionPriceLinesRef.current.push(liqLine)
      }
    })
  }, [activePositions, symbol])

  // SMC Institutional Price Lines Synchronization
  useEffect(() => {
    if (!candlestickSeriesRef.current) return

    // Clear previous SMC price lines
    smcPriceLinesRef.current.forEach((line) => {
      try {
        candlestickSeriesRef.current?.removePriceLine(line)
      } catch {}
    })
    smcPriceLinesRef.current = []

    if (!showSmcZones || !smcResult) return

    const { activeSetup, orderBlocks } = smcResult

    // 1. If active setup exists, render Entry, SL, and TP lines
    if (activeSetup && activeSetup.direction !== 'NONE') {
      const entryLine = candlestickSeriesRef.current.createPriceLine({
        price: activeSetup.entryPrice,
        color: '#06b6d4',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `[SMC ENTRY ${activeSetup.direction}]`,
      })
      if (entryLine) smcPriceLinesRef.current.push(entryLine)

      const slLine = candlestickSeriesRef.current.createPriceLine({
        price: activeSetup.stopLoss,
        color: '#f43f5e',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `[SMC SL] -${activeSetup.riskPips}p`,
      })
      if (slLine) smcPriceLinesRef.current.push(slLine)

      const tpLine = candlestickSeriesRef.current.createPriceLine({
        price: activeSetup.takeProfit,
        color: '#10b981',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `[SMC TP] +${activeSetup.rewardPips}p (1:${activeSetup.riskRewardRatio})`,
      })
      if (tpLine) smcPriceLinesRef.current.push(tpLine)
    }

    // 2. Render latest active Bullish & Bearish Order Blocks
    const activeBullOb = orderBlocks.slice().reverse().find((ob) => ob.type === 'BULLISH' && !ob.isMitigated)
    if (activeBullOb) {
      const bullLine = candlestickSeriesRef.current.createPriceLine({
        price: activeBullOb.top,
        color: '#10b981',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: `[BULLISH OB]`,
      })
      if (bullLine) smcPriceLinesRef.current.push(bullLine)
    }

    const activeBearOb = orderBlocks.slice().reverse().find((ob) => ob.type === 'BEARISH' && !ob.isMitigated)
    if (activeBearOb) {
      const bearLine = candlestickSeriesRef.current.createPriceLine({
        price: activeBearOb.bottom,
        color: '#f43f5e',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: `[BEARISH OB]`,
      })
      if (bearLine) smcPriceLinesRef.current.push(bearLine)
    }
  }, [showSmcZones, smcResult])

  const latestCandle = candles[candles.length - 1]
  const displayO = hoverData?.open ?? latestCandle?.open ?? currentPrice
  const displayH = hoverData?.high ?? latestCandle?.high ?? currentPrice
  const displayL = hoverData?.low ?? latestCandle?.low ?? currentPrice
  const displayC = hoverData?.close ?? latestCandle?.close ?? currentPrice
  const displayVol = hoverData?.volume ?? latestCandle?.volume ?? 2450

  return (
    <div className={`fin-card relative flex flex-col overflow-hidden transition-all duration-300 ${
      isFullscreen ? 'fixed inset-4 z-50 bg-[#07090e] shadow-2xl border-pink-500/50' : 'h-[580px]'
    }`}>
      {/* Top Bar: Asset Symbol, Live Ticks & Control Panels */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 border-b border-white/5 bg-[#080a11]/90 backdrop-blur-md">
        {/* Left: Symbol & Price Meta */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-extrabold text-white font-mono-num tracking-tight">
              {symbol}
            </h2>
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              connectionStatus === 'LIVE_WS'
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            }`}>
              <Wifi className={`w-3 h-3 ${connectionStatus === 'LIVE_WS' ? 'animate-pulse' : ''}`} />
              <span>{connectionStatus === 'LIVE_WS' ? `Live DMA (${latencyMs}ms)` : 'Simulated Feed'}</span>
            </div>
          </div>

          {/* Current Price & 24h PnL */}
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-extrabold text-white font-mono-num">
              {formatCurrency(currentPrice)}
            </span>
            <span className={`text-xs font-bold font-mono-num ${change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatPercent(change24h)}
            </span>
          </div>
        </div>

        {/* Center: Timeframe Picker */}
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5 text-xs">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              className={`px-2.5 py-1 rounded-lg font-bold font-mono-num transition-all cursor-pointer ${
                timeframe === tf
                  ? 'bg-pink-500/25 text-pink-300 border border-pink-500/40 shadow-[0_0_10px_rgba(236,72,153,0.3)]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Right: Technical Indicators & Tool Toggles */}
        <div className="flex items-center gap-1.5 text-xs flex-wrap overflow-x-auto no-scrollbar py-0.5">
          {/* Select -> Explain (OpenChart Feature) */}
          <button
            onClick={handleOpenSelectExplain}
            className="hidden sm:flex px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold text-[11px] shadow-[0_0_15px_rgba(236,72,153,0.4)] items-center gap-1.5 cursor-pointer transition-all shrink-0"
            title="OpenChart Feature: Select a range of candles to investigate anomaly causes"
          >
            <BoxSelect className="w-3.5 h-3.5" />
            <span>Select → Explain</span>
          </button>

          {/* Natural Language Monitoring (TeaScript) */}
          <button
            onClick={() => setIsNlMonitorOpen(true)}
            className="hidden sm:flex px-2 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 font-bold text-[11px] items-center gap-1 cursor-pointer transition-all shrink-0"
            title="Autonomous Natural Language Monitor & TeaScript"
          >
            <Bot className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">NL Monitor</span>
          </button>

          {/* Pine Script Migration Studio */}
          <button
            onClick={() => setIsPineMigrationOpen(true)}
            className="hidden sm:flex px-2 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 font-bold text-[11px] items-center gap-1 cursor-pointer transition-all shrink-0"
            title="Convert TradingView Pine Script into TeaScript"
          >
            <Code2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Pine Migration</span>
          </button>

          {/* Volume Profile (VPVR) Toggle */}
          <button
            onClick={() => setShowVolumeProfile(!showVolumeProfile)}
            className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold font-mono-num transition-all cursor-pointer flex items-center gap-1 ${
              showVolumeProfile
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                : 'bg-white/5 border-white/5 text-gray-500 hover:text-gray-300'
            }`}
            title="Toggle Institutional Volume Profile (POC / VAH / VAL)"
          >
            <BarChart2 className="w-3 h-3 text-amber-400" />
            <span>VPVR</span>
          </button>

          {/* Chart Type Toggle (Candles vs Area) */}
          <button
            onClick={() => setChartType(chartType === 'CANDLES' ? 'AREA' : 'CANDLES')}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
              chartType === 'CANDLES'
                ? 'bg-white/10 border-white/10 text-white'
                : 'bg-pink-500/20 border-pink-500/40 text-pink-300'
            }`}
            title="Toggle Chart Type"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold">{chartType === 'CANDLES' ? 'Candles' : 'Area Line'}</span>
          </button>

          {/* EMA 20/50 Toggle */}
          <button
            onClick={() => setShowEma(!showEma)}
            className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold font-mono-num transition-all cursor-pointer flex items-center gap-1 ${
              showEma
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                : 'bg-white/5 border-white/5 text-gray-500 hover:text-gray-300'
            }`}
            title="Toggle EMA 20/50 Ribbon"
          >
            <Activity className="w-3 h-3 text-cyan-400" />
            <span>EMA 20/50</span>
          </button>

          {/* Volume Toggle */}
          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`p-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
              showVolume
                ? 'bg-white/10 border-white/10 text-emerald-400'
                : 'bg-white/5 border-white/5 text-gray-500'
            }`}
            title="Toggle Volume Bars"
          >
            VOL
          </button>

          {/* SMC Desktop Institutional AI Engine Toggle */}
          <button
            onClick={() => setShowSmcZones(!showSmcZones)}
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              showSmcZones
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : 'bg-white/5 border-white/5 text-gray-500 hover:text-gray-300'
            }`}
            title="Toggle SMC Desktop Institutional Engine (Liquidity Sweeps, CHoCH, OBs, FVGs)"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>SMC Desktop</span>
            {smcResult?.activeSetup.gateStatus === 'GATE_PASS' && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
          </button>

          {/* AI Alpha Signals Toggle */}
          <button
            onClick={onToggleAiSignals}
            className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1.5 ${
              showAiSignals
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.4)]'
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{showAiSignals ? 'AI Signals ON' : 'AI Signals OFF'}</span>
            {showAiSignals ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          </button>

          {/* Price Alert Desk Modal Trigger */}
          {onOpenAlerts && (
            <button
              onClick={onOpenAlerts}
              className="px-2 py-1.5 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 border border-pink-500/30 text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1 shadow-sm"
              title="Set Live Price Alert for this Symbol"
            >
              <Bell className="w-3.5 h-3.5 text-pink-400" />
              <span>Alert</span>
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Floating Crosshair OHLC Legend Bar */}
      <div className="px-4 py-1.5 bg-[#07090e]/80 border-b border-white/5 flex flex-wrap items-center gap-4 text-[11px] font-mono-num text-gray-400 select-none">
        <div className="flex items-center gap-1">
          <span className="text-gray-500">O:</span>
          <span className="text-white font-bold">{formatCurrency(displayO)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">H:</span>
          <span className="text-emerald-400 font-bold">{formatCurrency(displayH)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">L:</span>
          <span className="text-rose-400 font-bold">{formatCurrency(displayL)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">C:</span>
          <span className={`font-bold ${displayC >= displayO ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatCurrency(displayC)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">Vol:</span>
          <span className="text-white font-bold">{displayVol.toLocaleString()}</span>
        </div>
        {hoverData?.time && (
          <div className="flex items-center gap-1 text-gray-500 ml-auto">
            <span>Bar Time:</span>
            <span className="text-gray-300">{hoverData.time}</span>
          </div>
        )}
      </div>

      {/* Interactive Chart Canvas with Drawing Toolbar & Volume Profile Overlay */}
      <div className="relative flex-1 w-full min-h-[380px] overflow-hidden">
        {/* Left Drawing Toolbar - Visible on tablet/desktop */}
        <div className="hidden md:block">
          <DrawingToolbar
            activeTool={activeTool}
            onSelectTool={handleSelectTool}
            onClearAll={handleClearDrawings}
            isLocked={isLocked}
            onToggleLock={() => setIsLocked(!isLocked)}
            onOpenSelectExplain={handleOpenSelectExplain}
            hasDrawings={drawnObjects.length > 0}
          />
        </div>

        {/* Volume Profile (VPVR) Overlay */}
        <VolumeProfileOverlay
          data={volumeProfileData}
          visible={showVolumeProfile}
          containerHeight={480}
          containerWidth={800}
        />

        {/* Canvas Chart Container */}
        <div ref={chartContainerRef} className="w-full h-full" />

        {/* SMC Institutional Desktop HUD Overlay (matching video UI) */}
        <SMCOverlayPanel
          smcResult={smcResult}
          visible={showSmcZones}
          onExecuteSetup={onExecuteSmcSetup}
        />

        {/* Floating Smart Money Concepts Status Pill (Bottom Overlay) */}
        {showSmcZones && (
          <div className="absolute bottom-4 left-14 z-10 flex items-center gap-2 bg-[#090d18]/90 border border-cyan-500/30 backdrop-blur-md px-3 py-1.5 rounded-xl text-[11px] text-gray-300 shadow-xl">
            <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>
              SMC Target:{' '}
              <strong className="text-white font-mono-num">
                {smcResult?.activeSetup.takeProfit && smcResult.activeSetup.direction !== 'NONE'
                  ? `${smcResult.activeSetup.direction === 'BUY' ? 'BSL Target' : 'SSL Target'} @ $${smcResult.activeSetup.takeProfit.toFixed(2)}`
                  : `Nearest Liquidity Pool @ $${(currentPrice * 1.008).toFixed(2)}`}
              </strong>
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                smcResult?.activeSetup.gateStatus === 'GATE_PASS'
                  ? 'bg-emerald-400 animate-ping'
                  : 'bg-cyan-400'
              }`}
            />
          </div>
        )}
      </div>

      {/* Select -> Explain Modal */}
      <SelectExplainModal
        isOpen={isSelectExplainOpen}
        rangeData={selectExplainRange}
        onClose={() => setIsSelectExplainOpen(false)}
        onPinAnnotation={(report) => {
          if (candlestickSeriesRef.current && selectExplainRange) {
            candlestickSeriesRef.current.createPriceLine({
              price: selectExplainRange.endPrice,
              color: '#ec4899',
              lineWidth: 2,
              lineStyle: LineStyle.Solid,
              axisLabelVisible: true,
              title: `[AI Annotated] ${report.primaryCatalyst.substring(0, 24)}...`,
            })
          }
        }}
      />

      {/* Natural Language Monitor Modal */}
      <NaturalLanguageMonitorModal
        isOpen={isNlMonitorOpen}
        currentSymbol={symbol}
        onClose={() => setIsNlMonitorOpen(false)}
        onSelectInvestigation={() => {
          handleOpenSelectExplain()
        }}
      />

      {/* Pine Script Migration Modal */}
      <PineScriptMigrationModal
        isOpen={isPineMigrationOpen}
        onClose={() => setIsPineMigrationOpen(false)}
        onApplyToChart={(scriptName) => {
          if (candlestickSeriesRef.current) {
            candlestickSeriesRef.current.createPriceLine({
              price: currentPrice * 1.008,
              color: '#10b981',
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: `[${scriptName}] Bullish Threshold`,
            })
          }
        }}
      />

      {/* Line Breach Alert Popover */}
      <LineAlertBreachModal
        breachedObject={breachedLine}
        onClose={() => setBreachedLine(null)}
        onOpenFullInvestigation={() => {
          handleOpenSelectExplain()
        }}
      />
    </div>
  )
})
