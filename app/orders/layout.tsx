'use client'
import { AppProvider } from '@/components/AppProvider'
import BottomNav from '@/components/BottomNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <div className="min-h-screen pb-20" style={{ background: 'var(--cream)' }}>
        {children}
      </div>
      <BottomNav />
    </AppProvider>
  )
}

