'use client'
import { useEffect, useState, useRef } from 'react'
import { useTour } from './TourProvider'
import { usePathname } from 'next/navigation'

interface Rect { top: number; left: number; width: number; height: number }

function waitForElement(selector: string, timeout = 2500): Promise<Element | null> {
  return new Promise(resolve => {
    const el = document.querySelector(selector)
    if (el) { resolve(el); return }
    const interval = setInterval(() => {
      const found = document.querySelector(selector)
      if (found) { clearInterval(interval); clearTimeout(timer); resolve(found) }
    }, 60)
    const timer = setTimeout(() => { clearInterval(interval); resolve(null) }, timeout)
  })
}

export default function TourOverlay() {
  const { active, currentStep, stepIndex, totalSteps, nextStep, skipTour } = useTour()
  const pathname = usePathname()
  const [targetRect, setTargetRect] = useState<Rect | null>(null)
  const [visible, setVisible] = useState(false)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!active || !currentStep) { setVisible(false); setTargetRect(null); return }
    if (pathname !== currentStep.page) { setVisible(false); return }

    setVisible(false)
    waitForElement(currentStep.selector).then(el => {
      if (!el) { setVisible(true); setTargetRect(null); return }
      const measure = () => {
        const rect = el.getBoundingClientRect()
        const pad  = currentStep.spotlightPadding ?? 8
        setTargetRect({
          top:    rect.top    - pad,
          left:   rect.left   - pad,
          width:  rect.width  + pad * 2,
          height: rect.height + pad * 2,
        })
        setVisible(true)
      }
      measure()
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      rafRef.current = window.requestAnimationFrame(() => {
        setTimeout(measure, 350)
      })
    })
    return () => { if (rafRef.current) window.cancelAnimationFrame(rafRef.current) }
  }, [active, currentStep, pathname])

  if (!active || !visible || !currentStep) return null
  if (pathname !== currentStep.page) return null

  const vw = typeof window !== 'undefined' ? window.innerWidth  : 430
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800

  const TOOLTIP_W = Math.min(vw - 32, 380)
  // Accurate height: dots row + title + body + buttons + padding
  const TOOLTIP_H = 230
  const MARGIN    = 16

  const tooltipLeft = Math.max(MARGIN, (vw - TOOLTIP_W) / 2)

  let tooltipTop: number
  if (!targetRect) {
    tooltipTop = vh / 2 - TOOLTIP_H / 2
  } else if (currentStep.position === 'bottom') {
    tooltipTop = targetRect.top + targetRect.height + MARGIN
    if (tooltipTop + TOOLTIP_H > vh - MARGIN) tooltipTop = targetRect.top - TOOLTIP_H - MARGIN
  } else if (currentStep.position === 'top') {
    tooltipTop = targetRect.top - TOOLTIP_H - MARGIN
    if (tooltipTop < MARGIN) tooltipTop = targetRect.top + targetRect.height + MARGIN
  } else {
    tooltipTop = vh / 2 - TOOLTIP_H / 2
  }
  // Hard clamp — tooltip never leaves the viewport
  tooltipTop = Math.max(MARGIN, Math.min(tooltipTop, vh - TOOLTIP_H - MARGIN))

  const isLast = stepIndex === totalSteps - 1

  // SVG cutout approach: single path with evenodd fill-rule punches a transparent
  // hole in the overlay — one opacity layer, no stacking/compounding
  const spotlightPath = targetRect
    ? `M0 0 H${vw} V${vh} H0 Z M${targetRect.left} ${targetRect.top} H${targetRect.left + targetRect.width} V${targetRect.top + targetRect.height} H${targetRect.left} Z`
    : `M0 0 H${vw} V${vh} H0 Z`

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}>

      {/* Single SVG overlay — one clean opacity layer with cutout hole */}
      <svg
        width={vw} height={vh}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'all', cursor: 'pointer' }}
        onClick={nextStep}
      >
        <path d={spotlightPath} fill="rgba(0,0,0,0.65)" fillRule="evenodd" />
        {targetRect && (
          <rect
            x={targetRect.left} y={targetRect.top}
            width={targetRect.width} height={targetRect.height}
            rx={12} fill="none"
            stroke="rgba(255,255,255,0.4)" strokeWidth={2}
          />
        )}
      </svg>

      {/* Tooltip card — always within viewport */}
      <div
        style={{
          position:      'absolute',
          top:           tooltipTop,
          left:          tooltipLeft,
          width:         TOOLTIP_W,
          background:    'white',
          borderRadius:  18,
          padding:       '18px 20px 16px',
          boxShadow:     '0 8px 40px rgba(0,0,0,0.25)',
          pointerEvents: 'all',
          animation:     'tourFadeUp 0.22s ease',
        }}
      >
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 12, flexWrap: 'wrap' }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{
              width:      i === stepIndex ? 18 : 6,
              height:     6,
              borderRadius: 99,
              background: i === stepIndex ? '#2D6A4F' : '#D1D5DB',
              transition: 'width 0.2s ease',
              flexShrink: 0,
            }} />
          ))}
        </div>

        <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 6px', lineHeight: 1.3 }}>
          {currentStep.title}
        </p>
        <p style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.55, margin: '0 0 16px' }}>
          {currentStep.body}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={e => { e.stopPropagation(); skipTour() }}
            style={{
              background: 'none', border: 'none', padding: '6px 0',
              fontSize: 13, color: '#9CA3AF', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {isLast ? '' : 'Skip tour'}
          </button>
          <button
            onClick={e => { e.stopPropagation(); nextStep() }}
            style={{
              padding: '9px 22px', borderRadius: 99, border: 'none',
              background: '#1B4332', color: 'white',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {isLast ? 'Done ✓' : 'Next →'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes tourFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
