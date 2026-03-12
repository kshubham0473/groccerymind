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
    setLoading(true)
    setError('')
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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--cream)' }}>
      <div className="w-full max-w-sm animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-3">🛒</div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Playfair Display', color: 'var(--green-deep)' }}>
            GroceryMind
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Your kitchen companion</p>
        </div>

        {/* Card */}
        <div className="kitchen-card p-8">
          <h2 className="text-xl font-semibold mb-6" style={{ fontFamily: 'Playfair Display', color: 'var(--text-primary)' }}>
            Welcome back
          </h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
                className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all"
                style={{ borderColor: 'var(--border)', background: 'var(--warm-white)', fontFamily: 'DM Sans' }}
                onFocus={e => e.target.style.borderColor = 'var(--green-mid)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
                placeholder="your username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all"
                style={{ borderColor: 'var(--border)', background: 'var(--warm-white)', fontFamily: 'DM Sans' }}
                onFocus={e => e.target.style.borderColor = 'var(--green-mid)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p className="text-sm px-3 py-2 rounded-lg" style={{ color: 'var(--red-soft)', background: '#FFF0F0' }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95"
              style={{ background: loading ? 'var(--green-soft)' : 'var(--green-mid)', color: 'white', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
          Access is by invitation only.
        </p>
      </div>
    </div>
  )
}
