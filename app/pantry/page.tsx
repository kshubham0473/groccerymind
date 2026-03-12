'use client'
import { useEffect, useState } from 'react'
import { PantryItem, PantryTier, StockStatus } from '@/types'

const TIER_CONFIG: Record<PantryTier, { label: string; emoji: string; desc: string }> = {
  fresh:  { label: 'Fresh & Daily',      emoji: '🥬', desc: 'Veggies, fruits, dairy' },
  weekly: { label: 'Weekly Supplies',    emoji: '📦', desc: 'Milk, butter, breakfast' },
  staple: { label: 'Monthly Staples',    emoji: '🏪', desc: 'Grains, lentils, packaged' },
}

const STATUS_CONFIG: Record<StockStatus, { color: string; bg: string; label: string }> = {
  good:     { color: '#2D6A4F', bg: '#D8F3DC', label: 'Good' },
  low:      { color: '#C47A2A', bg: '#FFF3E8', label: 'Low' },
  finished: { color: '#E63946', bg: '#FFF0F0', label: 'Finished' },
}

export default function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<'all'|PantryTier>('all')
  const [actionItem, setActionItem] = useState<PantryItem|null>(null)
  const [adding, setAdding] = useState(false)
  const [newItem, setNewItem] = useState({ name: '', tier: 'fresh' as PantryTier, category: 'Vegetables', depletion_days: 7 })
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/pantry').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setItems(data)
      setLoading(false)
    })
  }, [])

  async function updateStatus(id: string, stock_status: StockStatus) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, stock_status } : i))
    setActionItem(null)
    await fetch('/api/pantry', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, stock_status })
    })
    // If finished, also add to order list
    if (stock_status === 'finished') {
      const item = items.find(i => i.id === id)
      if (item) {
        await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_name: item.name, source: 'pantry' })
        })
      }
    }
  }

  async function addItem() {
    if (!newItem.name.trim()) return
    setSaving(true)
    const res = await fetch('/api/pantry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newItem, name: newItem.name.trim(), stock_status: 'good' })
    })
    const data = await res.json()
    if (!data.error) setItems(prev => [...prev, data])
    setAdding(false)
    setNewItem({ name: '', tier: 'fresh', category: 'Vegetables', depletion_days: 7 })
    setSaving(false)
  }

  async function deleteItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    setActionItem(null)
    await fetch('/api/pantry', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
  }

  const filtered = items.filter(i => {
    const matchesTier = activeFilter === 'all' || i.tier === activeFilter
    const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase())
    return matchesTier && matchesSearch
  })

  const byTier = (tier: PantryTier) => filtered.filter(i => i.tier === tier)
  const alertCount = items.filter(i => i.stock_status !== 'good').length

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-2xl animate-bounce">🥬</div></div>

  return (
    <div className="max-w-lg mx-auto px-4 py-6 animate-slide-up">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display', color: 'var(--green-deep)' }}>Pantry</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{items.length} items tracked</p>
        </div>
        {alertCount > 0 && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full mt-1" style={{ background: 'var(--amber-light)', color: '#C47A2A' }}>
            ⚠️ {alertCount} alert{alertCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Search */}
      <div className="relative mt-4 mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }}>🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search pantry..."
          className="w-full pl-8 pr-4 py-2.5 rounded-xl border text-sm outline-none"
          style={{ borderColor: 'var(--border)', background: 'white' }} />
      </div>

      {/* Tier filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5">
        {(['all', 'fresh', 'weekly', 'staple'] as const).map(f => (
          <button key={f} onClick={() => setActiveFilter(f)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all capitalize"
            style={{
              background: activeFilter === f ? 'var(--green-mid)' : 'white',
              color: activeFilter === f ? 'white' : 'var(--text-secondary)',
              borderColor: activeFilter === f ? 'var(--green-mid)' : 'var(--border)'
            }}>
            {f === 'all' ? 'All items' : TIER_CONFIG[f].emoji + ' ' + TIER_CONFIG[f].label}
          </button>
        ))}
      </div>

      {/* Shelves */}
      {(['fresh','weekly','staple'] as PantryTier[]).map(tier => {
        const tierItems = byTier(tier)
        if (activeFilter !== 'all' && activeFilter !== tier) return null
        const cfg = TIER_CONFIG[tier]
        return (
          <div key={tier} className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span>{cfg.emoji}</span>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-secondary)' }}>{cfg.label}</h3>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({tierItems.length})</span>
            </div>

            {/* Shelf background */}
            <div className="rounded-2xl p-3 pb-4 relative" style={{ background: 'var(--warm-white)', border: '1px solid var(--border)' }}>
              {tierItems.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>No items in this shelf</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tierItems.map(item => {
                    const sc = STATUS_CONFIG[item.stock_status]
                    return (
                      <button key={item.id} onClick={() => setActionItem(item)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all active:scale-95"
                        style={{
                          background: item.stock_status === 'good' ? 'white' : sc.bg,
                          borderColor: item.stock_status === 'good' ? 'var(--border)' : sc.color + '33',
                          color: item.stock_status === 'good' ? 'var(--text-primary)' : sc.color,
                          transform: item.stock_status === 'low' ? 'rotate(-1deg)' : 'none',
                          opacity: item.stock_status === 'finished' ? 0.6 : 1,
                        }}>
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: sc.color }} />
                        {item.name}
                      </button>
                    )
                  })}
                </div>
              )}
              {/* Shelf plank */}
              <div className="shelf-row h-2 mt-3 mx-1" />
            </div>
          </div>
        )
      })}

      {/* Add item button */}
      <button onClick={() => setAdding(true)}
        className="w-full py-3 rounded-2xl border-2 border-dashed text-sm font-medium transition-all"
        style={{ borderColor: 'var(--green-light)', color: 'var(--green-mid)' }}>
        + Add item to pantry
      </button>

      {/* Action sheet */}
      {actionItem && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setActionItem(null)}>
          <div className="w-full max-w-lg mx-auto" onClick={e => e.stopPropagation()}>
            <div className="kitchen-card rounded-b-none p-5 animate-slide-up">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-semibold" style={{ fontFamily: 'Playfair Display' }}>{actionItem.name}</h3>
                <button onClick={() => setActionItem(null)} style={{ color: 'var(--text-muted)' }}>✕</button>
              </div>
              <p className="text-xs mb-4 capitalize" style={{ color: 'var(--text-muted)' }}>
                {actionItem.tier} · {actionItem.category} · {actionItem.depletion_days}d depletion
              </p>
              <div className="space-y-2">
                {(['good','low','finished'] as StockStatus[]).map(status => {
                  const sc = STATUS_CONFIG[status]
                  const isActive = actionItem.stock_status === status
                  return (
                    <button key={status} onClick={() => updateStatus(actionItem.id, status)}
                      className="w-full py-3 px-4 rounded-xl text-sm font-medium flex items-center gap-3 transition-all"
                      style={{ background: isActive ? sc.bg : 'var(--warm-white)', color: isActive ? sc.color : 'var(--text-secondary)', border: isActive ? `1px solid ${sc.color}33` : '1px solid var(--border)' }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: sc.color }} />
                      {status === 'good' ? '✅ Mark as Good / Restocked' : status === 'low' ? '⚠️ Mark as Running Low' : '🚫 Mark as Finished — add to order'}
                    </button>
                  )
                })}
                <button onClick={() => deleteItem(actionItem.id)}
                  className="w-full py-3 px-4 rounded-xl text-sm font-medium transition-all"
                  style={{ background: '#FFF0F0', color: 'var(--red-soft)' }}>
                  🗑️ Remove from pantry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add item modal */}
      {adding && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setAdding(false)}>
          <div className="w-full max-w-lg mx-auto" onClick={e => e.stopPropagation()}>
            <div className="kitchen-card rounded-b-none p-5 animate-slide-up">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold" style={{ fontFamily: 'Playfair Display' }}>Add to Pantry</h3>
                <button onClick={() => setAdding(false)} style={{ color: 'var(--text-muted)' }}>✕</button>
              </div>
              <div className="space-y-3">
                <input autoFocus value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
                  placeholder="Item name (e.g. Curd)"
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--warm-white)' }} />
                <div className="grid grid-cols-2 gap-2">
                  {(['fresh','weekly','staple'] as PantryTier[]).map(t => (
                    <button key={t} onClick={() => setNewItem(p => ({ ...p, tier: t }))}
                      className="py-2.5 rounded-xl border text-sm font-medium transition-all"
                      style={{
                        background: newItem.tier === t ? 'var(--green-mid)' : 'white',
                        color: newItem.tier === t ? 'white' : 'var(--text-secondary)',
                        borderColor: newItem.tier === t ? 'var(--green-mid)' : 'var(--border)'
                      }}>
                      {TIER_CONFIG[t].emoji} {TIER_CONFIG[t].label.split(' ')[0]}
                    </button>
                  ))}
                </div>
                <input value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))}
                  placeholder="Category (e.g. Dairy)"
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--warm-white)' }} />
                <div className="flex items-center gap-3">
                  <label className="text-sm flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>Lasts ~</label>
                  <input type="number" value={newItem.depletion_days} onChange={e => setNewItem(p => ({ ...p, depletion_days: +e.target.value }))}
                    className="w-20 px-3 py-2.5 rounded-xl border text-sm outline-none text-center"
                    style={{ borderColor: 'var(--border)', background: 'var(--warm-white)' }} />
                  <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>days</label>
                </div>
                <button onClick={addItem} disabled={saving || !newItem.name.trim()}
                  className="w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
                  style={{ background: 'var(--green-mid)', color: 'white', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Adding...' : 'Add to Pantry'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
