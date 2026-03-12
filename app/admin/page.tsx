'use client'
import { useEffect, useState } from 'react'
import { useApp } from '@/components/AppProvider'
import { AppProvider } from '@/components/AppProvider'
import BottomNav from '@/components/BottomNav'

function AdminContent() {
  const { user } = useApp()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', role: 'member' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetch('/api/admin/users').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setUsers(data)
      setLoading(false)
    })
  }, [])

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    const data = await res.json()
    if (data.error) { setError(data.error); setSaving(false); return }
    setUsers(prev => [...prev, data])
    setAdding(false)
    setForm({ username: '', password: '', role: 'member' })
    setSuccess('User created successfully!')
    setTimeout(() => setSuccess(''), 3000)
    setSaving(false)
  }

  if (!user || user.role !== 'admin') {
    return <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>Access denied</div>
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 animate-slide-up">
      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Playfair Display', color: 'var(--green-deep)' }}>Admin</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Manage household access</p>

      {success && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--green-light)', color: 'var(--green-deep)' }}>
          ✅ {success}
        </div>
      )}

      <div className="kitchen-card p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold" style={{ fontFamily: 'Playfair Display' }}>Household Members</h2>
          <button onClick={() => setAdding(true)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
            style={{ background: 'var(--green-light)', color: 'var(--green-deep)' }}>
            + New user
          </button>
        </div>
        {loading ? <p style={{ color: 'var(--text-muted)' }} className="text-sm">Loading...</p> : (
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl"
                style={{ background: 'var(--warm-white)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
                    style={{ background: 'var(--green-light)', color: 'var(--green-deep)' }}>
                    {u.username[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{u.username}</p>
                    <p className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{u.role}</p>
                  </div>
                </div>
                {u.id === user.id && (
                  <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--green-light)', color: 'var(--green-mid)' }}>you</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add user form */}
      {adding && (
        <div className="kitchen-card p-5">
          <h3 className="font-semibold mb-4" style={{ fontFamily: 'Playfair Display' }}>Create New User</h3>
          <form onSubmit={createUser} className="space-y-3">
            <input required autoFocus value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
              placeholder="Username"
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
              style={{ borderColor: 'var(--border)', background: 'var(--warm-white)' }} />
            <input required type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder="Password"
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
              style={{ borderColor: 'var(--border)', background: 'var(--warm-white)' }} />
            <div className="flex gap-2">
              {['member','admin'].map(r => (
                <button key={r} type="button" onClick={() => setForm(p => ({ ...p, role: r }))}
                  className="flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all capitalize"
                  style={{
                    background: form.role === r ? 'var(--green-mid)' : 'white',
                    color: form.role === r ? 'white' : 'var(--text-secondary)',
                    borderColor: form.role === r ? 'var(--green-mid)' : 'var(--border)'
                  }}>
                  {r}
                </button>
              ))}
            </div>
            {error && <p className="text-sm" style={{ color: 'var(--red-soft)' }}>{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ background: 'var(--green-mid)', color: 'white' }}>
                {saving ? 'Creating...' : 'Create User'}
              </button>
              <button type="button" onClick={() => { setAdding(false); setError('') }}
                className="px-4 py-3 rounded-xl text-sm border transition-all"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default function AdminPage() {
  return (
    <AppProvider>
      <div className="min-h-screen pb-20" style={{ background: 'var(--cream)' }}>
        <AdminContent />
      </div>
      <BottomNav />
    </AppProvider>
  )
}
