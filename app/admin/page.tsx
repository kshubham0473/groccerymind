'use client'
import { useEffect, useState } from 'react'
import { useApp } from '@/components/AppProvider'

/* ── patch-4 · app/admin/page.tsx ──────────────────────────────────────
   Render-only rewrite onto the editorial paper theme (mock 4d).
   Same endpoints as before, plus GET/POST /api/invites — which already
   existed and was only reachable from Settings. ─────────────────────── */

interface Invite { id: string; code: string; max_uses: number; uses_so_far: number; expires_at: string }

function daysLeft(iso: string) {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
  return d
}

export default function AdminPage() {
  const { user } = useApp()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', role: 'member' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [invites, setInvites] = useState<Invite[]>([])
  const [minting, setMinting] = useState(false)

  useEffect(() => {
    fetch('/api/admin/users').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setUsers(d)
      setLoading(false)
    })
    fetch('/api/invites').then(r => r.json()).then(d => { if (Array.isArray(d)) setInvites(d) }).catch(() => {})
  }, [])

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    if (data.error) { setError(data.error); setSaving(false); return }
    setUsers(p => [...p, data]); setAdding(false)
    setForm({ username: '', password: '', role: 'member' })
    setSaving(false)
  }

  async function mintInvite() {
    setMinting(true)
    const res = await fetch('/api/invites', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_type: 'member' })
    })
    const d = await res.json()
    if (d && d.code) setInvites(p => [d, ...p])
    setMinting(false)
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="screen" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <p className="label">Admin only</p>
      </div>
    )
  }

  const live = invites.find(i => daysLeft(i.expires_at) > 0 && i.uses_so_far < i.max_uses)
  const cooks = users.length

  return (
    <div className="screen">
      <div className="screen-head">
        <span className="label">{user.username} · admin</span>
        <a href="/settings" className="word">Settings</a>
      </div>

      <div style={{ padding: '22px 24px 0' }}>
        <h1 className="font-display" style={{ fontSize: 'var(--t-page)', lineHeight: 1.15, fontWeight: 600, margin: 0 }}>
          The household
        </h1>
        <p style={{ fontSize: 15, color: 'var(--ink-soft)', margin: '8px 0 0' }}>
          {loading ? '\u00a0' : cooks === 1 ? 'Only you, so far.' : `${cooks} people cook here.`}
        </p>
      </div>

      <div className="screen-body" style={{ paddingTop: 26 }}>

        {/* Members — rows, not cards. Role printed only when notable. */}
        <div className="rule" />
        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 48, margin: '10px 0' }} />)
        ) : users.map(u => (
          <div key={u.id}>
            <div className="row" style={{ cursor: 'default' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="row-title">{u.display_name || u.username}</p>
                <p className="row-meta">@{u.username}</p>
              </div>
              {u.role === 'admin' && <span className="status" style={{ color: 'var(--ochre)' }}>Admin</span>}
            </div>
            <div className="rule" />
          </div>
        ))}

        {/* Add someone directly (password set by you) */}
        {!adding ? (
          <div style={{ padding: '20px 0 0' }}>
            <button onClick={() => setAdding(true)} className="word word-ink" style={{ minHeight: 44 }}>Add someone</button>
          </div>
        ) : (
          <form onSubmit={createUser} style={{ padding: '22px 0 0', display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div>
              <label className="label" style={{ display: 'block', marginBottom: 6 }}>Username</label>
              <input required autoFocus className="field" value={form.username}
                onChange={e => setForm(p => ({ ...p, username: e.target.value.toLowerCase() }))} />
            </div>
            <div>
              <label className="label" style={{ display: 'block', marginBottom: 6 }}>Temporary password</label>
              <input required type="password" className="field" value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 20 }}>
              {['member', 'admin'].map(r => (
                <button type="button" key={r} onClick={() => setForm(p => ({ ...p, role: r }))}
                  className={form.role === r ? 'word word-ink' : 'word word-quiet'} style={{ minHeight: 44 }}>
                  {r}
                </button>
              ))}
            </div>
            {error && <p style={{ fontSize: 14, color: 'var(--finished)', margin: 0 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={saving} className="action" style={{ flex: 1 }}>
                {saving ? 'Adding…' : 'Add to household'}
              </button>
              <button type="button" onClick={() => { setAdding(false); setError('') }} className="action-ghost" aria-label="Cancel">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
          </form>
        )}

        {/* The reason an admin opens this page */}
        <div style={{ padding: '38px 0 0' }}>
          <p className="label" style={{ margin: 0 }}>Invite code</p>
          {live ? (
            <>
              <p className="font-mono" style={{ fontSize: 26, letterSpacing: '0.14em', color: 'var(--ink)', margin: '10px 0 0' }}>
                {live.code}
              </p>
              <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: '10px 0 0', lineHeight: 1.6 }}>
                Share this and they set their own password. {live.max_uses - live.uses_so_far} use
                {live.max_uses - live.uses_so_far === 1 ? '' : 's'} left · expires in {daysLeft(live.expires_at)} days.
              </p>
            </>
          ) : (
            <p style={{ fontSize: 15, color: 'var(--ink-soft)', margin: '10px 0 0', lineHeight: 1.6 }}>
              No live code right now.
            </p>
          )}
          <div style={{ paddingTop: 14 }}>
            <button onClick={mintInvite} disabled={minting} className="word" style={{ minHeight: 44 }}>
              {minting ? 'Making one…' : live ? 'New code' : 'Make a code'}
            </button>
          </div>
        </div>

        {/* Housekeeping */}
        <div style={{ padding: '38px 0 0' }}>
          <div className="rule" style={{ marginBottom: 16 }} />
          <p className="label" style={{ margin: '0 0 14px' }}>Housekeeping</p>
          <p style={{ margin: '0 0 12px' }}>
            <a href="/onboarding" style={{ fontSize: 15, borderBottom: '1px solid var(--ink)', paddingBottom: 2 }}>Re-run onboarding</a>
          </p>
          <button onClick={() => {
            if (!confirm("Forget today's suggestion? The next visit fetches a fresh one.")) return
            localStorage.removeItem('gm_suggestion')
          }} style={{
            background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: 15,
            color: 'var(--ink)', borderBottom: '1px solid var(--ink)', cursor: 'pointer', minHeight: 28,
          }}>
            Forget today&rsquo;s suggestion
          </button>
        </div>
      </div>
    </div>
  )
}
