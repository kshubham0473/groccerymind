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
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Login failed'); setLoading(false); return }
      router.push('/dashboard')
    } catch { setError('Something went wrong.'); setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🥬</div>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 700, color: 'var(--green-deep)', margin: 0 }}>GroceryMind</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>Your smart kitchen companion</p>
      </div>
      <div className="card" style={{ width: '100%', maxWidth: 360, padding: 24 }}>
        <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Welcome back</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Sign in to your kitchen</p>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: 6 }}>Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} required autoFocus placeholder="your username"
              style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 14, outline: 'none', fontFamily: 'inherit', background: 'white' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: 6 }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
              style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 14, outline: 'none', fontFamily: 'inherit', background: 'white' }} />
          </div>
          {error && <p style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-light)', padding: '8px 12px', borderRadius: 8, marginBottom: 12 }}>{error}</p>}
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '13px', borderRadius: 12, border: 'none',
            background: loading ? 'var(--green-soft)' : 'var(--green-mid)', color: 'white',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(45,106,79,0.3)'
          }}>{loading ? 'Signing in...' : 'Sign in →'}</button>
        </form>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 20 }}>Access by invitation only</p>
    </div>
  )
}
