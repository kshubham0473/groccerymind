'use client'
import { useEffect, useState } from 'react'
import { PantryItem, PantryTier, StockStatus } from '@/types'

const TIERS: { key: PantryTier; label: string; emoji: string }[] = [
  { key: 'fresh',  label: 'Fresh & Daily',   emoji: '🥬' },
  { key: 'weekly', label: 'Weekly Supplies', emoji: '📦' },
  { key: 'staple', label: 'Monthly Staples', emoji: '🏪' },
]
const STATUS_STYLE: Record<StockStatus, { dot: string; cls: string; label: string }> = {
  good:     { dot: '#22C55E', cls: 'badge-good',     label: 'Good'     },
  low:      { dot: '#D97706', cls: 'badge-low',      label: 'Low'      },
  finished: { dot: '#DC2626', cls: 'badge-finished', label: 'Finished' },
}

// Smart depletion day defaults by category
const DEPLETION_DEFAULTS: Record<string, { days: number; tier: PantryTier }> = {
  'Vegetables':    { days: 5,   tier: 'fresh'  },
  'Leafy Greens':  { days: 3,   tier: 'fresh'  },
  'Fruits':        { days: 5,   tier: 'fresh'  },
  'Dairy':         { days: 4,   tier: 'fresh'  },
  'Eggs':          { days: 10,  tier: 'fresh'  },
  'Bread':         { days: 4,   tier: 'fresh'  },
  'Grains & Rice': { days: 30,  tier: 'staple' },
  'Lentils & Dal': { days: 30,  tier: 'staple' },
  'Spices':        { days: 60,  tier: 'staple' },
  'Oil & Ghee':    { days: 30,  tier: 'staple' },
  'Flour':         { days: 21,  tier: 'weekly' },
  'Onion & Garlic':{ days: 14,  tier: 'weekly' },
  'Canned & Dry':  { days: 45,  tier: 'staple' },
  'Snacks':        { days: 14,  tier: 'weekly' },
  'Beverages':     { days: 14,  tier: 'weekly' },
  'Other':         { days: 7,   tier: 'weekly' },
}
const CATEGORIES = Object.keys(DEPLETION_DEFAULTS)

export default function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string|null>(null)
  const [search, setSearch] = useState('')
  const [filterTier, setFilterTier] = useState<'all'|PantryTier>('all')
  const [actionItem, setActionItem] = useState<PantryItem|null>(null)
  const [adding, setAdding] = useState(false)
  const [newItem, setNewItem] = useState({ name: '', tier: 'fresh' as PantryTier, category: 'Vegetables', depletion_days: 5 })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/pantry/estimate', { method: 'POST' }).catch(() => {})
    fetch('/api/pantry').then(r => r.json()).then(d => {
      if (Array.isArray(d)) {
        setItems(d)
      } else {
        setFetchError(d.error || 'Failed to load pantry')
      }
      setLoading(false)
    }).catch(e => {
      setFetchError(e.message || 'Network error')
      setLoading(false)
    })
  }, [])

  function onCategoryChange(cat: string) {
    const def = DEPLETION_DEFAULTS[cat] || { days: 7, tier: 'weekly' as PantryTier }
    setNewItem(p => ({ ...p, category: cat, depletion_days: def.days, tier: def.tier }))
  }

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
    setAdding(false)
    setNewItem({ name: '', tier: 'fresh', category: 'Vegetables', depletion_days: 5 })
    setSaving(false)
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
  if (fetchError) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', padding: 24, textAlign: 'center' }}>
      <span style={{ fontSize: 32, marginBottom: 12 }}>⚠️</span>
      <p className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Pantry failed to load</p>
      <p style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-light)', padding: '8px 14px', borderRadius: 10, fontFamily: 'monospace' }}>{fetchError}</p>
    </div>
  )

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <div className="page-header">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Kitchen</p>
          <h1 className="font-display" style={{ color: 'white', fontSize: 24, fontWeight: 700, margin: 0 }}>Pantry</h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 2 }}>
            {items.length} items{alertCount > 0 ? ` · ⚠️ ${alertCount} need attention` : ' · all good'}
          </p>
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
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 16, paddingBottom: 2 }}>
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
              <div className="card" style={{ padding: '10px 12px 14px' }}>
                {tierItems.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>Empty shelf</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingBottom: 10 }}>
                    {tierItems.map(item => {
                      const ss = STATUS_STYLE[item.stock_status]
                      return (
                        <button key={item.id} onClick={() => setActionItem(item)} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '6px 10px', borderRadius: 10,
                          border: `1px solid ${item.stock_status === 'good' ? 'var(--border)' : ss.dot + '44'}`,
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
                <div style={{ height: 6, background: 'linear-gradient(180deg, #D4B896 0%, #B8956E 100%)', borderRadius: 3, boxShadow: '0 2px 4px rgba(139,111,71,0.3)' }} />
              </div>
            </div>
          )
        })}

        <button onClick={() => setAdding(true)} style={{
          width: '100%', padding: '12px', borderRadius: 12, border: '1.5px dashed var(--green-light)',
          background: 'none', color: 'var(--green-mid)', fontSize: 13, fontWeight: 600, cursor: 'pointer'
        }}>+ Add item to pantry</button>
      </div>

      {/* Action sheet */}
      {actionItem && (
        <div onClick={() => setActionItem(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 430, margin: '0 auto', borderRadius: '24px 24px 0 0', padding: '20px 20px 36px', border: 'none' }}>
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 99, margin: '0 auto 16px' }} />
            <p className="font-display" style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>{actionItem.name}</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{actionItem.tier} · {actionItem.category} · refreshes every {actionItem.depletion_days} days</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(['good','low','finished'] as StockStatus[]).map(status => {
                const ss = STATUS_STYLE[status]
                const active = actionItem.stock_status === status
                return (
                  <button key={status} onClick={() => updateStatus(actionItem.id, status)} style={{
                    padding: '13px 16px', borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 10,
                    border: `1px solid ${active ? ss.dot + '44' : 'var(--border)'}`,
                    background: active ? ss.dot + '15' : 'white',
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
          <div onClick={e => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 430, margin: '0 auto', borderRadius: '24px 24px 0 0', padding: '20px 20px 36px', border: 'none' }}>
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 99, margin: '0 auto 16px' }} />
            <p className="font-display" style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Add to Pantry</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input autoFocus value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
                placeholder="Item name (e.g. Curd)"
                style={{ padding: '11px 14px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />

              {/* Category selector — drives tier + days automatically */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>Category</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => onCategoryChange(cat)} style={{
                      padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 600, textAlign: 'left',
                      background: newItem.category === cat ? 'var(--green-mid)' : 'white',
                      color: newItem.category === cat ? 'white' : 'var(--text-secondary)',
                      boxShadow: 'var(--shadow)'
                    }}>{cat}</button>
                  ))}
                </div>
              </div>

              {/* Auto-filled hint */}
              <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--green-pale)', border: '1px solid var(--green-light)', display: 'flex', gap: 16 }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>Shelf</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-deep)', textTransform: 'capitalize' }}>{newItem.tier}</p>
                </div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>Lasts approx.</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="number" value={newItem.depletion_days}
                      onChange={e => setNewItem(p => ({ ...p, depletion_days: +e.target.value }))}
                      style={{ width: 48, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--green-light)', fontSize: 13, fontWeight: 700, outline: 'none', textAlign: 'center', fontFamily: 'inherit', color: 'var(--green-deep)', background: 'white' }} />
                    <span style={{ fontSize: 13, color: 'var(--green-deep)', fontWeight: 600 }}>days</span>
                  </div>
                </div>
              </div>

              <button onClick={addItem} disabled={saving || !newItem.name.trim()} style={{
                padding: '13px', borderRadius: 12, border: 'none',
                background: saving || !newItem.name.trim() ? 'var(--green-soft)' : 'var(--green-mid)',
                color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer'
              }}>{saving ? 'Adding...' : 'Add to Pantry'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
