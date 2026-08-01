'use client'
import { usePathname } from 'next/navigation'
import BottomNav from './BottomNav'

const NO_NAV_PATHS = ['/login', '/onboarding', '/settings']

export default function BottomNavWrapper() {
  const pathname = usePathname()
  // Hide bottom nav on auth, onboarding, and settings (full-screen flows)
  if (NO_NAV_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) return null
  return <BottomNav />
}
