'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login'|'join'>('login')

  // Login state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // Join state
  const [inviteCode, setInviteCode] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Login failed'); setLoading(false); return }
      router.push('/')
    } catch { setError('Something went wrong.'); setLoading(false) }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/invites/join', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteCode, username: newUsername, password: newPassword })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to join'); setLoading(false); return }
      router.push('/')
    } catch { setError('Something went wrong.'); setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: 'var(--green-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 14px' }}>🥬</div>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 700, color: 'var(--green-deep)', margin: 0 }}>GroceryMind</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>Your Indian kitchen companion</p>
      </div>

      {/* Mode toggle */}
      <div style={{ display: 'flex', background: 'white', borderRadius: 12, padding: 4, border: '1px solid var(--border)', marginBottom: 24, width: '100%', maxWidth: 340 }}>
        {(['login', 'join'] as const).map(m => (
          <button key={m} onClick={() => { setMode(m); setError('') }} style={{
            flex: 1, padding: '9px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            background: mode === m ? 'var(--green-mid)' : 'transparent',
            color: mode === m ? 'white' : 'var(--text-muted)'
          }}>
            {m === 'login' ? 'Sign in' : 'Join with code'}
          </button>
        ))}
      </div>

      <div className="card" style={{ width: '100%', maxWidth: 340, padding: 24 }}>
        {mode === 'login' ? (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>Username</label>
              <input autoFocus value={username} onChange={e => setUsername(e.target.value)} required
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 15, outline: 'none', fontFamily: 'inherit' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 15, outline: 'none', fontFamily: 'inherit' }} />
            </div>
            {error && <p style={{ fontSize: 13, color: 'var(--red)', background: '#FEE2E2', padding: '8px 12px', borderRadius: 8, margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading} style={{
              marginTop: 4, padding: '13px', borderRadius: 12, border: 'none',
              background: loading ? 'var(--green-soft)' : 'var(--green-mid)',
              color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer'
            }}>{loading ? 'Signing in...' : 'Sign in'}</button>
          </form>
        ) : (
          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>Invite Code</label>
              <input autoFocus value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} required
                placeholder="e.g. XKCD7829"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 15, outline: 'none', fontFamily: 'monospace', letterSpacing: '0.1em' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>Choose a username</label>
              <input value={newUsername} onChange={e => setNewUsername(e.target.value)} required placeholder="e.g. shubham"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 15, outline: 'none', fontFamily: 'inherit' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>Set a password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 15, outline: 'none', fontFamily: 'inherit' }} />
            </div>
            {error && <p style={{ fontSize: 13, color: 'var(--red)', background: '#FEE2E2', padding: '8px 12px', borderRadius: 8, margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading} style={{
              marginTop: 4, padding: '13px', borderRadius: 12, border: 'none',
              background: loading ? 'var(--green-soft)' : 'var(--green-mid)',
              color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer'
            }}>{loading ? 'Joining...' : 'Join household'}</button>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
              You'll be added to the household that shared this code.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
