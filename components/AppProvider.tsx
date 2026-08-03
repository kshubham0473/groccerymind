'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { cacheClear } from '@/lib/page-cache'

interface User { id: string; username: string; role: string; household_id: string }
interface Household { id: string; name: string; member_count: number }
interface AppCtx { user: User | null; household: Household | null; loading: boolean; logout: () => void }

const AppContext = createContext<AppCtx>({ user: null, household: null, loading: true, logout: () => {} })

// Module-level cache — survives re-mounts within the same JS session (tab lifetime)
// Cleared on logout so a fresh fetch happens on next sign-in
let _cachedAuth: { user: User; household: Household } | null = null

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(_cachedAuth?.user || null)
  const [household, setHousehold] = useState<Household | null>(_cachedAuth?.household || null)
  const [loading, setLoading] = useState(!_cachedAuth)
  const router = useRouter()

  useEffect(() => {
    // If we already have a cached session, skip the network call entirely
    if (_cachedAuth) return

    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          _cachedAuth = { user: data.user, household: data.household }
          setUser(data.user)
          setHousehold(data.household)
        } else {
          router.push('/login')
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    _cachedAuth = null
    cacheClear()
    setUser(null)
    setHousehold(null)
    router.push('/login')
  }

  return <AppContext.Provider value={{ user, household, loading, logout }}>{children}</AppContext.Provider>
}

export const useApp = () => useContext(AppContext)
