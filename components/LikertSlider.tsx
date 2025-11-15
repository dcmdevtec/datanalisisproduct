"use client"

import * as React from "react"
import { useEffect, useLayoutEffect, useState, useRef } from "react"

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
  const [bubbleLeftPx, setBubbleLeftPx] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const draggingPointerId = useRef<number | null>(null)

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

  // Determine start value that corresponds to labels[0].
  // When showZero is true the labels array usually represents the original range (e.g. 1..N),
  // while min === 0 for the slider. Compute labelStart accordingly so indexing stays stable.
  const labelStart = showZero ? (min + 1) : min
  const selectedLabel = (() => {
    if (local === 0 && showZero) return zeroLabel
    const idx = Math.round((local - labelStart) / (step || 1))
    return labels && labels[idx] ? labels[idx] : String(local)
  })()

  // Calculate precise bubble pixel position so it lines up with the labels below.
  const updateBubblePos = () => {
    const track = trackRef.current
    if (!track) return setBubbleLeftPx(null)
    const width = track.offsetWidth || 0
    const percent = toPercent(local)
    let px = (percent / 100) * width
    // clamp to [0, width]
    if (px < 0) px = 0
    if (px > width) px = width
    setBubbleLeftPx(px)
  }

  // helper: compute nearest value from clientX on the track
  const updateValueFromClientX = (clientX: number) => {
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    let pct = (clientX - rect.left) / (rect.width || 1)
    if (pct < 0) pct = 0
    if (pct > 1) pct = 1
    // map percent to raw value and then choose nearest available value
    const rawVal = actualMin + pct * range
    let nearest = allValues[0]
    let bestDiff = Math.abs(rawVal - nearest)
    for (const v of allValues) {
      const d = Math.abs(rawVal - v)
      if (d < bestDiff) {
        bestDiff = d
        nearest = v
      }
    }
    handleSelect(nearest)
    // update bubble px to immediate position
    setBubbleLeftPx(pct * rect.width)
  }

  // Pointer drag handlers
  const onPointerDown = (e: React.PointerEvent) => {
    // Only handle primary button
    if (e.button && e.button !== 0) return
    const track = trackRef.current
    if (!track) return
    draggingPointerId.current = e.pointerId
    track.setPointerCapture(e.pointerId)
    setIsDragging(true)
    updateValueFromClientX(e.clientX)

    const onMove = (ev: PointerEvent) => {
      if (draggingPointerId.current !== null && ev.pointerId !== draggingPointerId.current) return
      updateValueFromClientX(ev.clientX)
    }

    const onUp = (ev: PointerEvent) => {
      if (draggingPointerId.current !== null && ev.pointerId !== draggingPointerId.current) return
      try { track.releasePointerCapture(ev.pointerId) } catch (_) {}
      draggingPointerId.current = null
      setIsDragging(false)
      // cleanup
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  useLayoutEffect(() => {
    updateBubblePos()
    const onResize = () => updateBubblePos()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [local, min, max, step, showZero])

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
            className={`absolute -top-10 flex flex-col items-center ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={bubbleLeftPx !== null ? { left: bubbleLeftPx, transform: 'translateX(-50%)' } : { left: `${toPercent(local)}%`, transform: 'translateX(-50%)' }}
            onPointerDown={onPointerDown}
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
                const idx = v === 0 ? -1 : Math.round((v - labelStart) / (step || 1))
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
