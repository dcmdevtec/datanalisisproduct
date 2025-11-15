"use client"

import * as React from "react"
import { useEffect, useState, useRef } from "react"

interface LikertSliderProps {
  min: number
  max: number
  step?: number
  value: number
  onChange: (v: number) => void
  labels?: string[]
  showZero?: boolean
  zeroLabel?: string
  showNumbers?: boolean
  showTicks?: boolean
  showSelectedPanel?: boolean
  themeColors?: { primary: string; background: string; text: string }
}

export default function LikertSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  labels = [],
  showZero = false,
  zeroLabel = "No Sabe / No Responde",
  showNumbers = false,
  showTicks = true,
  showSelectedPanel = false,
  themeColors = { primary: '#10b981', background: '#f0fdf4', text: '#111827' }
}: LikertSliderProps) {
  const [local, setLocal] = useState<number>(value)
  const trackRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => setLocal(value), [value])

  const allValues: number[] = []
  if (showZero) allValues.push(0)
  for (let i = min; i <= max; i += step) {
    if (!showZero || i !== 0) allValues.push(i)
  }

  const actualMin = allValues.length ? allValues[0] : min
  const actualMax = allValues.length ? allValues[allValues.length - 1] : max
  const range = actualMax - actualMin || 1

  const toPercent = (v: number) => ((v - actualMin) / range) * 100

  const handleSelect = (v: number) => {
    setLocal(v)
    onChange(v)
  }

  // keyboard support when track is focused
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const idx = allValues.indexOf(local)
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      if (idx > 0) handleSelect(allValues[idx - 1])
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (idx < allValues.length - 1) handleSelect(allValues[idx + 1])
    } else if (e.key === 'Home') {
      e.preventDefault()
      handleSelect(allValues[0])
    } else if (e.key === 'End') {
      e.preventDefault()
      handleSelect(allValues[allValues.length - 1])
    }
  }

  const selectedLabel = (() => {
    if (local === 0 && showZero) return zeroLabel
    const offset = showZero ? 1 : 0
    const idx = Math.round((local - min) / (step || 1)) - offset
    return labels && labels[idx] ? labels[idx] : String(local)
  })()

  return (
    <div className="space-y-4">
      <div className="relative px-2 py-4">
        <div
          className="relative h-2 w-full flex items-center"
          ref={trackRef}
          tabIndex={0}
          role="slider"
          aria-valuemin={actualMin}
          aria-valuemax={actualMax}
          aria-valuenow={local}
          aria-valuetext={selectedLabel}
          aria-orientation="horizontal"
          onKeyDown={handleKeyDown}
        >
          <div className="absolute top-0 left-0 right-0 h-2 bg-gray-200 rounded-full" />
          <div
            className="absolute top-0 h-2 rounded-full"
            style={{ left: '0%', width: `${toPercent(local)}%`, backgroundColor: themeColors.primary }}
          />

          {/* interactive segments covering all steps */}
          {allValues.map((v, i) => {
            const left = toPercent(v)
            const next = i === allValues.length - 1 ? 100 : toPercent(allValues[i + 1])
            const width = Math.max(0.5, next - left)
            const isSelected = v === local
            return (
              <button
                key={`seg-${v}`}
                type="button"
                onClick={() => handleSelect(v)}
                aria-label={`Seleccionar ${v}`}
                className="absolute top-0 h-2 rounded-full"
                style={{ left: `${left}%`, width: `${width}%`, backgroundColor: isSelected ? themeColors.primary : 'transparent', cursor: 'pointer' }}
              />
            )
          })}

          {/* ticks */}
          {showTicks && allValues.map((v) => (
            <div key={`tick-${v}`} className="absolute top-0 w-px h-2 bg-gray-300" style={{ left: `${toPercent(v)}%` }} />
          ))}

          {/* SurveyMonkey-style value bubble positioned above the selected value */}
          <div
            aria-hidden
            className="absolute -top-10 transform -translate-x-1/2 flex flex-col items-center pointer-events-none"
            style={{ left: `${toPercent(local)}%` }}
          >
            <div className="px-3 py-1 rounded-full text-white font-semibold shadow" style={{ backgroundColor: themeColors.primary }}>
              {showNumbers ? String(local) : selectedLabel}
            </div>
            {/* small caret */}
            <div style={{ width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: `7px solid ${themeColors.primary}` }} />
          </div>
        </div>

        {/* labels - for large ranges avoid crowding by showing only anchors (min, mid, max) plus any explicit labels */}
        <div className="relative mt-6">
          {
            (() => {
              const smallRange = allValues.length <= 11
              let anchors: number[] = []
              if (smallRange) {
                anchors = [...allValues]
              } else {
                const set = new Set<number>()
                // always show min and max
                set.add(actualMin)
                set.add(actualMax)
                // show midpoint for context
                const mid = Math.round((actualMin + actualMax) / 2)
                set.add(mid)
                // include any values that have an explicit non-empty label
                allValues.forEach((v) => {
                  const idx = v === 0 ? -1 : v - min
                  const label = v === 0 ? zeroLabel : (labels && labels[idx] ? labels[idx] : '')
                  if (label && String(label).trim()) set.add(v)
                })
                anchors = Array.from(set).sort((a, b) => a - b)
              }

              return anchors.map((v) => {
                const idx = v === 0 ? -1 : v - min
                const label = v === 0 ? zeroLabel : (labels && labels[idx] ? labels[idx] : '')
                const left = toPercent(v)
                return (
                  <div key={`lab-${v}`} className="absolute text-xs text-muted-foreground" style={{ left: `${left}%`, transform: 'translateX(-50%)' }}>
                    {/* Show number only for anchors; the main bubble still shows the current value */}
                    <div className="font-medium">{v}</div>
                    {label && <div className="text-xs mt-1">{label}</div>}
                  </div>
                )
              })
            })()
          }
        </div>
      </div>

      <div className="text-center pt-4 border-t border-gray-200">
        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-lg font-semibold shadow-sm" style={{ backgroundColor: `${themeColors.primary}15`, color: themeColors.primary, border: `2px solid ${themeColors.primary}30` }}>
          <span className="text-sm">Opción seleccionada:</span>
          <span className="text-2xl font-bold">{local}</span>
          {selectedLabel && <span className="text-sm font-medium opacity-90">({selectedLabel})</span>}
        </div>
      </div>
    </div>
  )
}
