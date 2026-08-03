'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/* ── patch-4 · app/login/page.tsx ──────────────────────────────────────
   Render-only rewrite onto the editorial paper theme (mock 4a).
   Endpoints, payloads and the gm_tour_seen localStorage write are
   byte-identical to the original. ──────────────────────────────────── */

const LABEL: React.CSSProperties = {
  fontFamily: 'var(--font-mono), ui-monospace, monospace',
  fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase',
  color: 'var(--ink-soft)', margin: '0 0 6px', display: 'block',
}

function Field({ label, mono, ...input }: { label: string; mono?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label style={LABEL}>{label}</label>
      <input {...input} className="field"
        style={mono ? { fontFamily: 'var(--font-mono), ui-monospace, monospace', letterSpacing: '0.14em' } : undefined} />
    </div>
  )
}

function LoginContent() {
  const router = useRouter()
  const [mode, setMode] = useState<'login'|'join'>('login')

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const [inviteCode, setInviteCode] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const searchParams = useSearchParams()
  useEffect(() => {
    const code = searchParams.get('code')
    if (code) {
      setMode('join')
      setInviteCode(code.toUpperCase())
    }
  }, [])

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
      router.refresh()
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
      // Suppress tour for new sign-ups — they go through onboarding first
      try { localStorage.setItem('gm_tour_seen', 'new_user') } catch {}
      window.location.href = '/'
    } catch { setError('Something went wrong.'); setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--paper)',
      display: 'flex', flexDirection: 'column',
      padding: '0 24px', maxWidth: 430, margin: '0 auto',
    }}>
      <div style={{ height: 'clamp(72px, 16vh, 132px)', flexShrink: 0 }} />

      {/* Title page */}
      <div style={{ flexShrink: 0 }}>
        <p className="label" style={{ margin: 0 }}>Est. 2026 · your kitchen</p>
        <h1 className="font-display" style={{ fontSize: 44, lineHeight: 1.05, fontWeight: 600, color: 'var(--ink)', margin: '14px 0 0' }}>
          GroceryMind
        </h1>
        <p className="font-display" style={{ fontSize: 16, fontStyle: 'italic', color: 'var(--ochre)', margin: '10px 0 0' }}>
          Decides dinner, so you don&rsquo;t have to
        </p>
      </div>

      <div className="rule" style={{ margin: '30px 0 0' }} />

      {/* Mode — two words, not a switch */}
      <div style={{ display: 'flex', gap: 24, padding: '18px 0 0', flexShrink: 0 }}>
        {(['login', 'join'] as const).map(m => (
          <button key={m} onClick={() => { setMode(m); setError('') }}
            className={mode === m ? 'word word-ink' : 'word word-quiet'}
            style={{ minHeight: 44, borderBottomColor: mode === m ? 'var(--ink)' : 'transparent' }}>
            {m === 'login' ? 'Sign in' : 'Join with a code'}
          </button>
        ))}
      </div>

      {/* Forms */}
      <div style={{ paddingTop: 28, flexShrink: 0 }}>
        {mode === 'login' ? (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
            <Field label="Username" autoFocus value={username} onChange={e => setUsername(e.target.value)} required />
            <Field label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            {error && <p style={{ fontSize: 14, color: 'var(--finished)', margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading} className="action" style={{ marginTop: 8 }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
            <Field label="Invite code" mono autoFocus value={inviteCode} placeholder="XKCD7829"
              onChange={e => setInviteCode(e.target.value.toUpperCase())} required />
            <Field label="Pick a username" value={newUsername} placeholder="shubham"
              onChange={e => setNewUsername(e.target.value)} required />
            <Field label="Set a password" type="password" value={newPassword}
              onChange={e => setNewPassword(e.target.value)} required />
            {error && <p style={{ fontSize: 14, color: 'var(--finished)', margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading} className="action" style={{ marginTop: 8 }}>
              {loading ? 'Joining…' : 'Join this kitchen'}
            </button>
          </form>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 40 }} />

      <div style={{ flexShrink: 0, padding: '0 0 40px' }}>
        <div className="rule" style={{ margin: '0 0 16px' }} />
        {mode === 'login' ? (
          <p className="tail" style={{ fontSize: 14 }}>
            Someone in the house already using GroceryMind? Ask them for an invite code and{' '}
            <button onClick={() => { setMode('join'); setError('') }} className="word word-ink"
              style={{ fontFamily: 'inherit', fontSize: 14, letterSpacing: 0, textTransform: 'none', fontWeight: 600 }}>
              join their kitchen
            </button>{' '}instead.
          </p>
        ) : (
          <p className="tail" style={{ fontSize: 14 }}>
            You&rsquo;ll join the household that shared this code — their week, pantry and list, shared with you.
          </p>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--paper)' }} />}>
      <LoginContent />
    </Suspense>
  )
}
