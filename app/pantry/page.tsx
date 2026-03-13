'use client'
import { useEffect, useState } from 'react'
import { PantryItem, PantryTier, StockStatus } from '@/types'

const TIERS: { key: PantryTier; label: string; emoji: string }[] = [
  { key: 'fresh',  label: 'Fresh & Daily',    emoji: '🥬' },
  { key: 'weekly', label: 'Weekly Supplies',  emoji: '📦' },
  { key: 'staple', label: 'Monthly Staples',  emoji: '🏪' },
]
const STATUS_STYLE: Record<StockStatus, { dot: string; className: string; label: string }> = {
  good:     { dot: '#22C55E', className: 'badge-good',     label: 'Good'     },
  low:      { dot: '#D97706', className: 'badge-low',      label: 'Low'      },
  finished: { dot: '#DC2626', className: 'badge-finished', label: 'Finished' },
}

export default function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTier, setFilterTier] = useState<'all'|PantryTier>('all')
  const [actionItem, setActionItem] = useState<PantryItem|null>(null)
  const [adding, setAdding] = useState(false)
  const [newItem, setNewItem] = useState({ name: '', tier: 'fresh' as PantryTier, category: 'Vegetables', depletion_days: 7 })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/pantry/estimate', { method: 'POST' }).catch(() => {})
    fetch('/api/pantry').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setItems(d)
      setLoading(false)
    })
  }, [])

  async function updateStatus(id: string, stock_status: StockStatus) {
    const item = items.find(i => i.id === id)
    setItems(p => p.map(i => i.id === id ? { ...i, stock_status } : i))
    setActionItem(null)
    await fetch('/api/pantry', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, stock_status }) })
    if (stock_status === 'finished' && item) {
      await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_name: item.name, source: 'pantry' }) })
    }
  }

  async function addItem() {
    if (!newItem.name.trim()) return
    setSaving(true)
    const res = await fetch('/api/pantry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newItem, name: newItem.name.trim(), stock_status: 'good' }) })
    const d = await res.json()
    if (!d.error) setItems(p => [...p, d])
    setAdding(false); setNewItem({ name: '', tier: 'fresh', category: 'Vegetables', depletion_days: 7 }); setSaving(false)
  }

  async function deleteItem(id: string) {
    setItems(p => p.filter(i => i.id !== id)); setActionItem(null)
    await fetch('/api/pantry', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
  }

  const filtered = items.filter(i =>
    (filterTier === 'all' || i.tier === filterTier) &&
    i.name.toLowerCase().includes(search.toLowerCase())
  )
  const alertCount = items.filter(i => i.stock_status !== 'good').length

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><span style={{ fontSize: 28 }}>🥬</span></div>

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <div className="page-header">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Kitchen</p>
          <h1 className="font-display" style={{ color: 'white', fontSize: 24, fontWeight: 700, margin: 0 }}>Pantry</h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 2 }}>{items.length} items tracked{alertCount > 0 ? ` · ⚠️ ${alertCount} alert${alertCount > 1 ? 's' : ''}` : ''}</p>
        </div>
      </div>

      <div style={{ padding: '16px 16px 24px' }}>
        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search pantry..."
            style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 14, outline: 'none', background: 'white', fontFamily: 'inherit' }} />
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 14 }}>🔍</span>
        </div>

        {/* Tier filter */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
          {([{ key: 'all', label: 'All', emoji: '🏠' }, ...TIERS] as any[]).map(f => (
            <button key={f.key} onClick={() => setFilterTier(f.key)} style={{
              flexShrink: 0, padding: '6px 12px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: filterTier === f.key ? 'var(--green-mid)' : 'white',
              color: filterTier === f.key ? 'white' : 'var(--text-secondary)',
              boxShadow: filterTier === f.key ? '0 2px 8px rgba(45,106,79,0.25)' : 'var(--shadow)'
            }}>{f.emoji} {f.label}</button>
          ))}
        </div>

        {/* Shelf sections */}
        {TIERS.map(tier => {
          const tierItems = filtered.filter(i => i.tier === tier.key)
          if (filterTier !== 'all' && filterTier !== tier.key) return null
          return (
            <div key={tier.key} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>{tier.emoji}</span>
                <span className="font-display" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>{tier.label}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>({tierItems.length})</span>
              </div>
              <div className="card" style={{ padding: '8px 12px 12px' }}>
                {tierItems.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>Empty</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 4 }}>
                    {tierItems.map(item => {
                      const ss = STATUS_STYLE[item.stock_status]
                      return (
                        <button key={item.id} onClick={() => setActionItem(item)} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '6px 10px', borderRadius: 10, border: '1px solid',
                          borderColor: item.stock_status === 'good' ? 'var(--border)' : ss.dot + '44',
                          background: item.stock_status === 'good' ? 'white' : ss.dot + '15',
                          cursor: 'pointer', fontSize: 13, fontWeight: 500,
                          color: item.stock_status === 'good' ? 'var(--text-primary)' : ss.dot
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: ss.dot, flexShrink: 0, display: 'inline-block' }} />
                          {item.name}
                        </button>
                      )
                    })}
                  </div>
                )}
                {/* Shelf plank */}
                <div style={{ height: 6, background: 'linear-gradient(180deg, #D4B896 0%, #B8956E 100%)', borderRadius: 3, marginTop: 10, boxShadow: '0 2px 4px rgba(139,111,71,0.3)' }} />
              </div>
            </div>
          )
        })}

        <button onClick={() => setAdding(true)} style={{
          width: '100%', padding: '12px', borderRadius: 12, border: '1.5px dashed var(--green-light)',
          background: 'none', color: 'var(--green-mid)', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 4
        }}>+ Add item to pantry</button>
      </div>

      {/* Action sheet */}
      {actionItem && (
        <div onClick={() => setActionItem(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 430, margin: '0 auto', borderRadius: '24px 24px 0 0', padding: '20px 20px 32px', border: 'none' }}>
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 99, margin: '0 auto 20px' }} />
            <p className="font-display" style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{actionItem.name}</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{actionItem.tier} · refreshes every {actionItem.depletion_days} days</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(['good','low','finished'] as StockStatus[]).map(status => {
                const ss = STATUS_STYLE[status]
                const active = actionItem.stock_status === status
                return (
                  <button key={status} onClick={() => updateStatus(actionItem.id, status)} style={{
                    padding: '13px 16px', borderRadius: 14, border: `1px solid ${active ? ss.dot + '44' : 'var(--border)'}`,
                    background: active ? ss.dot + '15' : 'white', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 10
                  }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: ss.dot, flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: active ? ss.dot : 'var(--text-primary)' }}>
                      {status === 'good' ? '✅ Well stocked' : status === 'low' ? '⚠️ Running low' : '🚫 Finished — add to order list'}
                    </span>
                  </button>
                )
              })}
              <button onClick={() => deleteItem(actionItem.id)} style={{ padding: '13px 16px', borderRadius: 14, border: '1px solid var(--red-light)', background: 'var(--red-light)', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--red)' }}>
                🗑️ Remove from pantry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add item sheet */}
      {adding && (
        <div onClick={() => setAdding(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 430, margin: '0 auto', borderRadius: '24px 24px 0 0', padding: '20px 20px 32px', border: 'none' }}>
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 99, margin: '0 auto 20px' }} />
            <p className="font-display" style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Add to Pantry</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input autoFocus value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
                placeholder="Item name (e.g. Curd)" style={{ padding: '11px 14px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {TIERS.map(t => (
                  <button key={t.key} onClick={() => setNewItem(p => ({ ...p, tier: t.key }))} style={{
                    padding: '9px 6px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: newItem.tier === t.key ? 'var(--green-mid)' : 'white',
                    color: newItem.tier === t.key ? 'white' : 'var(--text-secondary)',
                    boxShadow: 'var(--shadow)'
                  }}>{t.emoji} {t.key.charAt(0).toUpperCase() + t.key.slice(1)}</button>
                ))}
              </div>
              <input value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))}
                placeholder="Category (e.g. Dairy)" style={{ padding: '11px 14px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Lasts approx.</span>
                <input type="number" value={newItem.depletion_days} onChange={e => setNewItem(p => ({ ...p, depletion_days: +e.target.value }))}
                  style={{ width: 64, padding: '9px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 14, outline: 'none', textAlign: 'center', fontFamily: 'inherit' }} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>days</span>
              </div>
              <button onClick={addItem} disabled={saving || !newItem.name.trim()} style={{
                padding: '13px', borderRadius: 12, border: 'none', background: 'var(--green-mid)', color: 'white',
                fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1
              }}>{saving ? 'Adding...' : 'Add to Pantry'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
