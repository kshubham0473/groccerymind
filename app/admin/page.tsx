'use client'
import { useEffect, useState } from 'react'
import { useApp } from '@/components/AppProvider'

export default function AdminPage() {
  const { user } = useApp()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', role: 'member' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetch('/api/admin/users').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setUsers(d)
      setLoading(false)
    })
  }, [])

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    if (data.error) { setError(data.error); setSaving(false); return }
    setUsers(p => [...p, data]); setAdding(false)
    setForm({ username: '', password: '', role: 'member' })
    setSuccess('Member added!'); setTimeout(() => setSuccess(''), 3000)
    setSaving(false)
  }

  if (!user || user.role !== 'admin') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <p style={{ color: 'var(--text-muted)' }}>Admin access only</p>
      </div>
    )
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><span style={{ fontSize: 24 }}>⚙️</span></div>

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <div className="page-header">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Management</p>
          <h1 className="font-display" style={{ color: 'white', fontSize: 24, fontWeight: 700, margin: 0 }}>Admin</h1>
        </div>
        <a href="/settings" style={{ position: 'absolute', top: 48, right: 20, background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)', padding: '6px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Settings →</a>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {success && (
          <div style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--green-light)', color: 'var(--green-deep)', fontSize: 14, fontWeight: 600 }}>✓ {success}</div>
        )}

        {/* Members list */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>
              Household Members · {users.length}
            </span>
          </div>
          <div style={{ padding: '4px 0' }}>
            {users.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>@{u.username}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0', textTransform: 'capitalize' }}>{u.role}</p>
                </div>
                <span className={`pill ${u.role === 'admin' ? 'badge-good' : ''}`} style={{ background: u.role === 'admin' ? 'var(--green-light)' : 'var(--cream)', color: u.role === 'admin' ? 'var(--green-deep)' : 'var(--text-muted)', border: '1px solid var(--border)', fontSize: 11 }}>
                  {u.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Add member */}
        {!adding ? (
          <button onClick={() => setAdding(true)} style={{ width: '100%', padding: '13px', borderRadius: 12, border: '1.5px dashed var(--green-light)', background: 'none', color: 'var(--green-mid)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + Add household member
          </button>
        ) : (
          <div className="card" style={{ padding: 16 }}>
            <p className="font-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>New Member</p>
            <form onSubmit={createUser} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input required value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value.toLowerCase() }))}
                placeholder="Username" style={{ padding: '11px 14px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
              <input required type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="Temporary password" style={{ padding: '11px 14px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                {['member','admin'].map(r => (
                  <button type="button" key={r} onClick={() => setForm(p => ({ ...p, role: r }))} style={{
                    flex: 1, padding: '9px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    background: form.role === r ? 'var(--green-mid)' : 'white', color: form.role === r ? 'white' : 'var(--text-secondary)', boxShadow: 'var(--shadow)'
                  }}>{r.charAt(0).toUpperCase() + r.slice(1)}</button>
                ))}
              </div>
              {error && <p style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-light)', padding: '8px 12px', borderRadius: 8 }}>{error}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={saving} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: 'var(--green-mid)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {saving ? 'Creating...' : 'Create'}
                </button>
                <button type="button" onClick={() => { setAdding(false); setError('') }} style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'white', fontSize: 14, cursor: 'pointer', color: 'var(--text-muted)' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Data management */}
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>Data Management</p>
          <a href="/onboarding" style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'inherit'
          }}>
            <span style={{ fontSize: 18 }}>🔄</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Re-run onboarding</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>Reset household preferences from scratch</p>
            </div>
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 18 }}>›</span>
          </a>
          <button onClick={async () => {
            if (!confirm('Clear Smart Pick cache? Next visit will fetch a fresh suggestion.')) return
            localStorage.removeItem('gm_suggestion')
            alert('Cache cleared.')
          }} style={{
            width: '100%', padding: '12px 0', display: 'flex', alignItems: 'center', gap: 10,
            background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', marginTop: 4
          }}>
            <span style={{ fontSize: 18 }}>🗑️</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Clear Smart Pick cache</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>Forces a fresh Gemini suggestion today</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
