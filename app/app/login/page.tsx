'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Login failed'); setLoading(false); return }
      router.push('/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--cream)' }}>
      {/* Decorative top band */}
      <div className="h-2 w-full" style={{
        background: 'linear-gradient(90deg, var(--green-deep), var(--green-soft), var(--amber-warm), var(--green-mid))'
      }} />

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Illustrations */}
        <div className="flex gap-3 mb-6 animate-slide-down">
          {['🥬','🧅','🍅','🧄','🫙'].map((e, i) => (
            <span key={i} className="text-2xl" style={{
              animationDelay: `${i * 0.06}s`,
              opacity: 0.7 + (i % 2) * 0.3,
              transform: `rotate(${(i - 2) * 5}deg)`
            }}>{e}</span>
          ))}
        </div>

        {/* Logo */}
        <div className="text-center mb-8 animate-slide-up">
          <h1 className="text-4xl font-bold" style={{
            fontFamily: 'Lora, serif',
            color: 'var(--green-deep)',
            letterSpacing: '-0.5px'
          }}>
            GroceryMind
          </h1>
          <p className="mt-2 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            Your smart kitchen companion
          </p>
        </div>

        {/* Card */}
        <div className="w-full max-w-sm animate-slide-up stagger-2">
          <div className="kitchen-card p-7">
            <h2 className="text-xl font-semibold mb-1" style={{ fontFamily: 'Lora, serif', color: 'var(--text-primary)' }}>
              Welcome back
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Sign in to your kitchen</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-700 mb-1.5 uppercase tracking-wide"
                  style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>Username</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                  required autoFocus
                  className="w-full px-4 py-3 rounded-2xl border text-sm outline-none transition-all"
                  style={{ borderColor: 'var(--border)', background: 'var(--warm-white)', fontFamily: 'Nunito' }}
                  onFocus={e => e.target.style.borderColor = 'var(--green-mid)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  placeholder="your username" />
              </div>
              <div>
                <label className="block text-xs font-700 mb-1.5 uppercase tracking-wide"
                  style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-2xl border text-sm outline-none transition-all"
                  style={{ borderColor: 'var(--border)', background: 'var(--warm-white)', fontFamily: 'Nunito' }}
                  onFocus={e => e.target.style.borderColor = 'var(--green-mid)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  placeholder="••••••••" />
              </div>
              {error && (
                <p className="text-xs px-3 py-2 rounded-xl font-medium"
                  style={{ color: 'var(--red-soft)', background: '#FEE2E2' }}>{error}</p>
              )}
              <button type="submit" disabled={loading}
                className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95"
                style={{
                  background: loading ? 'var(--green-soft)' : 'var(--green-mid)',
                  color: 'white',
                  letterSpacing: '0.3px',
                  boxShadow: '0 4px 12px rgba(45,106,79,0.3)'
                }}>
                {loading ? '✦ Signing in...' : 'Sign in →'}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
          Access by invitation only
        </p>
      </div>
    </div>
  )
}
