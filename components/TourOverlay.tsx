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

  // When step changes or page changes, find the target element and measure it
  useEffect(() => {
    if (!active || !currentStep) { setVisible(false); setTargetRect(null); return }
    // Only show overlay when we're on the correct page for this step
    if (pathname !== currentStep.page) { setVisible(false); return }

    setVisible(false)
    waitForElement(currentStep.selector).then(el => {
      if (!el) { setVisible(true); setTargetRect(null); return }  // no element — show centered tooltip
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
      // Scroll element into view smoothly
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Re-measure after scroll settles
      rafRef.current = window.requestAnimationFrame(() => {
        setTimeout(measure, 350)
      })
    })
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
    }
  }, [active, currentStep, pathname])

  if (!active || !visible || !currentStep) return null
  if (pathname !== currentStep.page) return null

  const vw = typeof window !== 'undefined' ? window.innerWidth  : 430
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const TOOLTIP_W = Math.min(vw - 32, 380)
  const TOOLTIP_H = 160  // approximate

  // Compute tooltip position
  let tooltipTop: number
  let tooltipLeft: number = Math.max(16, (vw - TOOLTIP_W) / 2)

  if (!targetRect) {
    // No element found — centre the tooltip
    tooltipTop  = vh / 2 - TOOLTIP_H / 2
  } else if (currentStep.position === 'bottom') {
    tooltipTop = targetRect.top + targetRect.height + 16
    if (tooltipTop + TOOLTIP_H > vh - 20) tooltipTop = targetRect.top - TOOLTIP_H - 16
  } else if (currentStep.position === 'top') {
    tooltipTop = targetRect.top - TOOLTIP_H - 16
    if (tooltipTop < 20) tooltipTop = targetRect.top + targetRect.height + 16
  } else {
    tooltipTop = vh / 2 - TOOLTIP_H / 2
  }

  const isLast = stepIndex === totalSteps - 1

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}>
      {/* Full-screen dark overlay — clickable to advance */}
      <div
        onClick={nextStep}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.72)',
          pointerEvents: 'all',
        }}
      />

      {/* Spotlight cutout — punches a hole in the overlay using box-shadow */}
      {targetRect && (
        <div
          onClick={nextStep}
          style={{
            position: 'absolute',
            top:    targetRect.top,
            left:   targetRect.left,
            width:  targetRect.width,
            height: targetRect.height,
            borderRadius: 12,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.72)',
            border: '2px solid rgba(255,255,255,0.35)',
            pointerEvents: 'all',
            cursor: 'pointer',
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        style={{
          position:  'absolute',
          top:       tooltipTop,
          left:      tooltipLeft,
          width:     TOOLTIP_W,
          background: 'white',
          borderRadius: 18,
          padding:   '18px 20px 16px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
          pointerEvents: 'all',
          animation: 'tourFadeUp 0.22s ease',
        }}
      >
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{
              width:  i === stepIndex ? 18 : 6,
              height: 6,
              borderRadius: 99,
              background: i === stepIndex ? 'var(--green-mid, #2D6A4F)' : '#D1D5DB',
              transition: 'width 0.2s ease',
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
