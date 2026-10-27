import React from 'react'
import type { VolumeProfileData } from '../../types/aiCharting'

interface VolumeProfileOverlayProps {
  data: VolumeProfileData | null
  visible: boolean
  containerHeight: number
  containerWidth: number
}

export const VolumeProfileOverlay: React.FC<VolumeProfileOverlayProps> = ({
  data,
  visible,
  containerHeight,
  containerWidth,
}) => {
  if (!visible || !data || data.bins.length === 0) return null

  const maxBinVolume = Math.max(...data.bins.map((b) => b.volume), 1)
  const maxHistogramWidth = Math.min(160, containerWidth * 0.22)
  const binHeight = containerHeight / data.bins.length

  return (
    <div className="absolute inset-y-0 right-14 pointer-events-none z-10 flex flex-col justify-between py-6">
      {/* Volume Profile Bars SVG */}
      <svg
        className="w-full h-full overflow-visible"
        style={{ width: `${maxHistogramWidth + 40}px` }}
      >
        {data.bins.map((bin, idx) => {
          // Bins are ordered from lowPrice to highPrice; chart Y is inverted (top is highPrice)
          const yPos = containerHeight - (idx + 1) * binHeight
          const totalWidth = (bin.volume / maxBinVolume) * maxHistogramWidth
          const buyRatio = bin.volume > 0 ? bin.buyVolume / bin.volume : 0.5
          const buyWidth = totalWidth * buyRatio
          const sellWidth = totalWidth - buyWidth

          return (
            <g key={idx} className="transition-all duration-300">
              {/* Buy Volume (Emerald) */}
              <rect
                x={maxHistogramWidth - totalWidth}
                y={yPos}
                width={buyWidth}
                height={Math.max(1, binHeight - 1)}
                fill={bin.isPoc ? '#f59e0b' : bin.isValueArea ? '#10b981' : 'rgba(16, 185, 129, 0.35)'}
                opacity={bin.isPoc ? 0.9 : bin.isValueArea ? 0.75 : 0.4}
                rx={1}
              />
              {/* Sell Volume (Rose) */}
              <rect
                x={maxHistogramWidth - totalWidth + buyWidth}
                y={yPos}
                width={sellWidth}
                height={Math.max(1, binHeight - 1)}
                fill={bin.isPoc ? '#f59e0b' : bin.isValueArea ? '#f43f5e' : 'rgba(244, 63, 94, 0.35)'}
                opacity={bin.isPoc ? 0.9 : bin.isValueArea ? 0.75 : 0.4}
                rx={1}
              />

              {/* POC Badge Indicator */}
              {bin.isPoc && (
                <g>
                  <line
                    x1={0}
                    y1={yPos + binHeight / 2}
                    x2={maxHistogramWidth + 30}
                    y2={yPos + binHeight / 2}
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                  />
                  <rect
                    x={maxHistogramWidth + 5}
                    y={yPos + binHeight / 2 - 8}
                    width={52}
                    height={16}
                    fill="#f59e0b"
                    rx={3}
                  />
                  <text
                    x={maxHistogramWidth + 31}
                    y={yPos + binHeight / 2 + 4}
                    fill="#000"
                    fontSize={9}
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    POC ${bin.priceLevel.toFixed(1)}
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
