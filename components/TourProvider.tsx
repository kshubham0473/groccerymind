'use client'
import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TOUR_STEPS, TOUR_STORAGE_KEY, TOUR_STEP_KEY, TourStep } from '@/lib/tour-steps'

interface TourCtx {
  active:      boolean
  currentStep: TourStep | null
  stepIndex:   number
  totalSteps:  number
  startTour:   () => void
  nextStep:    () => void
  skipTour:    () => void
}

const TourContext = createContext<TourCtx>({
  active: false, currentStep: null, stepIndex: 0, totalSteps: TOUR_STEPS.length,
  startTour: () => {}, nextStep: () => {}, skipTour: () => {},
})

export function TourProvider({ children }: { children: ReactNode }) {
  const router   = useRouter()
  const [active, setActive]   = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  // On mount: auto-start if first login
  useEffect(() => {
    try {
      const seen = localStorage.getItem(TOUR_STORAGE_KEY)
      if (!seen) {
        // Small delay so the dashboard loads first
        setTimeout(() => startTour(), 1200)
      }
    } catch {}
  }, [])

  const startTour = useCallback(() => {
    setStepIndex(0)
    setActive(true)
    try { localStorage.setItem(TOUR_STEP_KEY, '0') } catch {}
    const firstStep = TOUR_STEPS[0]
    if (firstStep) router.push(firstStep.page)
  }, [router])

  const nextStep = useCallback(() => {
    const next = stepIndex + 1
    if (next >= TOUR_STEPS.length) {
      // Tour complete
      setActive(false)
      try {
        localStorage.setItem(TOUR_STORAGE_KEY, 'done')
        localStorage.removeItem(TOUR_STEP_KEY)
      } catch {}
      return
    }
    setStepIndex(next)
    try { localStorage.setItem(TOUR_STEP_KEY, String(next)) } catch {}
    const nextStepDef = TOUR_STEPS[next]
    const currentStepDef = TOUR_STEPS[stepIndex]
    // Navigate if next step is on a different page
    if (nextStepDef.page !== currentStepDef.page) {
      router.push(nextStepDef.page)
    }
  }, [stepIndex, router])

  const skipTour = useCallback(() => {
    setActive(false)
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, 'skipped')
      localStorage.removeItem(TOUR_STEP_KEY)
    } catch {}
  }, [])

  const currentStep = active ? TOUR_STEPS[stepIndex] : null

  return (
    <TourContext.Provider value={{
      active, currentStep, stepIndex,
      totalSteps: TOUR_STEPS.length,
      startTour, nextStep, skipTour,
    }}>
      {children}
    </TourContext.Provider>
  )
}

export const useTour = () => useContext(TourContext)
