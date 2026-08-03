'use client'
import { useEffect, useState, useRef } from 'react'
import { useTour } from './TourProvider'
import { usePathname } from 'next/navigation'

/* ── patch-4 · components/TourOverlay.tsx ──────────────────────────────
   Same measuring / cutout mechanics as before. Restyled onto paper:
   the sheet matches Kitchen and List (paper, 3px, ink top rule), the
   spotlight is square, and eleven dots become one mono count plus the
   screen name. Reads the new `screen` field from tour-steps. ───────── */

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
      rafRef.current = window.requestAnimationFrame(() => { setTimeout(measure, 350) })
    })
    return () => { if (rafRef.current) window.cancelAnimationFrame(rafRef.current) }
  }, [active, currentStep, pathname])

  if (!active || !visible || !currentStep) return null
  if (pathname !== currentStep.page) return null

  const vw = typeof window !== 'undefined' ? window.innerWidth  : 430
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800

  const SHEET_W = Math.min(vw - 32, 398)
  const SHEET_H = 250
  const MARGIN  = 16

  const sheetLeft = Math.max(MARGIN, (vw - SHEET_W) / 2)

  let sheetTop: number
  if (!targetRect) {
    sheetTop = vh / 2 - SHEET_H / 2
  } else if (currentStep.position === 'bottom') {
    sheetTop = targetRect.top + targetRect.height + MARGIN
    if (sheetTop + SHEET_H > vh - MARGIN) sheetTop = targetRect.top - SHEET_H - MARGIN
  } else if (currentStep.position === 'top') {
    sheetTop = targetRect.top - SHEET_H - MARGIN
    if (sheetTop < MARGIN) sheetTop = targetRect.top + targetRect.height + MARGIN
  } else {
    sheetTop = vh / 2 - SHEET_H / 2
  }
  sheetTop = Math.max(MARGIN, Math.min(sheetTop, vh - SHEET_H - MARGIN))

  const isLast = stepIndex === totalSteps - 1

  const spotlightPath = targetRect
    ? `M0 0 H${vw} V${vh} H0 Z M${targetRect.left} ${targetRect.top} H${targetRect.left + targetRect.width} V${targetRect.top + targetRect.height} H${targetRect.left} Z`
    : `M0 0 H${vw} V${vh} H0 Z`

  const MONO = 'var(--font-mono), ui-monospace, monospace'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}>

      <svg
        width={vw} height={vh}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'all', cursor: 'pointer' }}
        onClick={nextStep}
      >
        <path d={spotlightPath} fill="rgba(26,26,24,0.62)" fillRule="evenodd" />
        {targetRect && (
          <rect
            x={targetRect.left} y={targetRect.top}
            width={targetRect.width} height={targetRect.height}
            rx={3} fill="none"
            stroke="rgba(251,250,247,0.55)" strokeWidth={1.5}
          />
        )}
      </svg>

      <div
        style={{
          position: 'absolute',
          top: sheetTop, left: sheetLeft, width: SHEET_W,
          background: 'var(--paper)',
          borderTop: '1.5px solid var(--ink)',
          borderRadius: 'var(--r)',
          padding: '20px 20px 18px',
          boxShadow: '0 18px 50px rgba(26,26,24,0.35)',
          pointerEvents: 'all',
          animation: 'tourRise 0.22s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ochre)', fontWeight: 500 }}>
            Step {stepIndex + 1} of {totalSteps}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
            {(currentStep as any).screen || ''}
          </span>
        </div>

        <p className="font-display" style={{ fontSize: 22, lineHeight: 1.25, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
          {currentStep.title}
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ink-soft)', margin: '10px 0 0' }}>
          {currentStep.body}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 }}>
          <button
            onClick={e => { e.stopPropagation(); skipTour() }}
            style={{
              background: 'none', border: 'none', padding: '0 0 3px', cursor: 'pointer',
              fontFamily: MONO, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'var(--ink-soft)', borderBottom: '1.5px solid var(--rule)',
              minHeight: 44, visibility: isLast ? 'hidden' : 'visible',
            }}
          >
            Skip
          </button>
          <button
            onClick={e => { e.stopPropagation(); nextStep() }}
            style={{
              height: 48, padding: '0 26px', borderRadius: 'var(--r)', border: 'none',
              background: 'var(--ink)', color: 'var(--paper)',
              fontFamily: 'inherit', fontSize: 16, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {isLast ? 'Start cooking' : 'Next'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes tourRise {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
