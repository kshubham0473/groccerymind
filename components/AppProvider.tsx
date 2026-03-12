'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

interface User { id: string; username: string; role: string; household_id: string }
interface Household { id: string; name: string; member_count: number }
interface AppCtx { user: User | null; household: Household | null; loading: boolean; logout: () => void }

const AppContext = createContext<AppCtx>({ user: null, household: null, loading: true, logout: () => {} })

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [household, setHousehold] = useState<Household | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) { setUser(data.user); setHousehold(data.household) }
        else router.push('/login')
      })
      .finally(() => setLoading(false))
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    router.push('/login')
  }

  return <AppContext.Provider value={{ user, household, loading, logout }}>{children}</AppContext.Provider>
}

export const useApp = () => useContext(AppContext)
