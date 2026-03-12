'use client'
import { useEffect, useState } from 'react'
import { PantryItem, PantryTier, StockStatus } from '@/types'

const TIER_CFG: Record<PantryTier,{ label:string; emoji:string; bg:string }> = {
  fresh:  { label:'Fresh & Daily',   emoji:'🥬', bg:'#F0FFF4' },
  weekly: { label:'Weekly Supplies', emoji:'📦', bg:'#FFFBEB' },
  staple: { label:'Monthly Staples', emoji:'🏪', bg:'#F5F3FF' },
}
const STATUS_CFG: Record<StockStatus,{ dot:string; bg:string; text:string; label:string }> = {
  good:     { dot:'#22C55E', bg:'#DCFCE7', text:'#166534', label:'Good' },
  low:      { dot:'#F59E0B', bg:'#FEF3C7', text:'#92400E', label:'Low' },
  finished: { dot:'#EF4444', bg:'#FEE2E2', text:'#991B1B', label:'Finished' },
}

export default function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all'|PantryTier>('all')
  const [search, setSearch] = useState('')
  const [actionItem, setActionItem] = useState<PantryItem|null>(null)
  const [adding, setAdding] = useState(false)
  const [newItem, setNewItem] = useState({ name:'', tier:'fresh' as PantryTier, category:'Vegetables', depletion_days:7 })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/pantry/estimate', { method: 'POST' }).catch(()=>{})
    fetch('/api/pantry').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setItems(d)
      setLoading(false)
    })
  }, [])

  async function updateStatus(id: string, stock_status: StockStatus) {
    const item = items.find(i => i.id === id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, stock_status } : i))
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
    if (!d.error) setItems(prev => [...prev, d])
    setAdding(false); setNewItem({ name:'', tier:'fresh', category:'Vegetables', depletion_days:7 }); setSaving(false)
  }

  async function deleteItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id)); setActionItem(null)
    await fetch('/api/pantry', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
  }

  const filtered = items.filter(i =>
    (filter === 'all' || i.tier === filter) &&
    i.name.toLowerCase().includes(search.toLowerCase())
  )
  const alertCount = items.filter(i => i.stock_status !== 'good').length

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-3xl" style={{ animation: 'wiggle 1s ease infinite' }}>🥬</div>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      {/* ── Header ── */}
      <div className="page-header px-5 pt-10 pb-10">
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.55)' }}>Kitchen</p>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Lora, serif' }}>🥬 Pantry</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>{items.length} items tracked</p>
          </div>
          {alertCount > 0 && (
            <div className="mt-1 px-3 py-1.5 rounded-full font-bold text-xs"
              style={{ background: 'rgba(231,111,81,0.9)', color: 'white' }}>
              ⚠️ {alertCount} alert{alertCount > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 -mt-2 pb-8 space-y-4">
        {/* ── Search ── */}
        <div className="relative animate-slide-up stagger-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search pantry..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl border text-sm outline-none"
            style={{ borderColor: 'var(--border)', background: 'white', fontFamily: 'Nunito' }} />
        </div>

        {/* ── Tier filters ── */}
        <div className="flex gap-2 overflow-x-auto pb-1 animate-slide-up stagger-2">
          {(['all','fresh','weekly','staple'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="flex-shrink-0 px-3.5 py-2 rounded-full text-xs font-bold border transition-all"
              style={{
                background: filter === f ? 'var(--green-mid)' : 'white',
                color: filter === f ? 'white' : 'var(--text-secondary)',
                borderColor: filter === f ? 'var(--green-mid)' : 'var(--border)',
                boxShadow: filter === f ? '0 4px 12px rgba(45,106,79,0.25)' : 'none'
              }}>
              {f === 'all' ? '🏠 All items' : `${TIER_CFG[f].emoji} ${TIER_CFG[f].label}`}
            </button>
          ))}
        </div>

        {/* ── Shelves ── */}
        {(['fresh','weekly','staple'] as PantryTier[]).map((tier, ti) => {
          const tierItems = filtered.filter(i => i.tier === tier)
          if (filter !== 'all' && filter !== tier) return null
          const cfg = TIER_CFG[tier]
          return (
            <div key={tier} className={`animate-slide-up stagger-${ti+2}`}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <span>{cfg.emoji}</span>
                <h3 className="font-bold text-sm" style={{ color: 'var(--text-secondary)', fontFamily: 'Lora, serif' }}>{cfg.label}</h3>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({tierItems.length})</span>
              </div>

              {/* Shelf unit */}
              <div className="rounded-2xl p-4 pb-2" style={{ background: cfg.bg, border: '1px solid var(--border)' }}>
                {tierItems.length === 0 ? (
                  <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>Empty shelf</p>
                ) : (
                  <div className="flex flex-wrap gap-2 pb-3">
                    {tierItems.map(item => {
                      const sc = STATUS_CFG[item.stock_status]
                      return (
                        <button key={item.id} onClick={() => setActionItem(item)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-semibold transition-all active:scale-95"
                          style={{
                            background: item.stock_status === 'good' ? 'white' : sc.bg,
                            borderColor: item.stock_status === 'good' ? 'var(--border)' : sc.dot + '44',
                            color: item.stock_status === 'good' ? 'var(--text-primary)' : sc.text,
                            transform: item.stock_status === 'low' ? 'rotate(-1.5deg)' : 'none',
                            opacity: item.stock_status === 'finished' ? 0.55 : 1,
                            boxShadow: 'var(--shadow-sm)',
                            fontFamily: 'Nunito'
                          }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot, flexShrink: 0 }} />
                          {item.name}
                        </button>
                      )
                    })}
                  </div>
                )}
                {/* Shelf plank */}
                <div className="shelf-plank mx-2" />
              </div>
            </div>
          )
        })}

        {/* ── Add button ── */}
        <button onClick={() => setAdding(true)}
          className="w-full py-3.5 rounded-2xl border-2 border-dashed text-sm font-bold transition-all active:scale-95 animate-slide-up stagger-5"
          style={{ borderColor: 'var(--green-light)', color: 'var(--green-mid)' }}>
          + Add item to pantry
        </button>
      </div>

      {/* ── Action sheet ── */}
      {actionItem && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setActionItem(null)}>
          <div className="w-full max-w-lg mx-auto" onClick={e => e.stopPropagation()}>
            <div className="kitchen-card rounded-b-none rounded-t-3xl p-6 animate-slide-up">
              <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'var(--border)' }} />
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-bold" style={{ fontFamily: 'Lora, serif' }}>{actionItem.name}</h3>
                <button onClick={() => setActionItem(null)} style={{ color: 'var(--text-muted)', fontSize: 20 }}>×</button>
              </div>
              <p className="text-xs mb-5 capitalize" style={{ color: 'var(--text-muted)' }}>
                {actionItem.tier} · {actionItem.category} · refreshes every {actionItem.depletion_days} days
              </p>
              <div className="space-y-2">
                {(['good','low','finished'] as StockStatus[]).map(status => {
                  const sc = STATUS_CFG[status]
                  const isActive = actionItem.stock_status === status
                  return (
                    <button key={status} onClick={() => updateStatus(actionItem.id, status)}
                      className="w-full py-3.5 px-4 rounded-2xl text-sm font-bold flex items-center gap-3 transition-all active:scale-98"
                      style={{
                        background: isActive ? sc.bg : 'var(--warm-white)',
                        color: isActive ? sc.text : 'var(--text-secondary)',
                        border: `1px solid ${isActive ? sc.dot + '44' : 'var(--border)'}`,
                        fontFamily: 'Nunito'
                      }}>
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: sc.dot }} />
                      {status === 'good' ? '✅ Good — well stocked' : status === 'low' ? '⚠️ Running low' : '🚫 Finished — add to order list'}
                    </button>
                  )
                })}
                <button onClick={() => deleteItem(actionItem.id)}
                  className="w-full py-3 px-4 rounded-2xl text-sm font-bold transition-all"
                  style={{ background: '#FEE2E2', color: '#991B1B' }}>
                  🗑️ Remove from pantry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add item sheet ── */}
      {adding && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setAdding(false)}>
          <div className="w-full max-w-lg mx-auto" onClick={e => e.stopPropagation()}>
            <div className="kitchen-card rounded-b-none rounded-t-3xl p-6 animate-slide-up">
              <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'var(--border)' }} />
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold" style={{ fontFamily: 'Lora, serif' }}>Add to Pantry</h3>
                <button onClick={() => setAdding(false)} style={{ color: 'var(--text-muted)', fontSize: 20 }}>×</button>
              </div>
              <div className="space-y-3">
                <input autoFocus value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
                  placeholder="Item name (e.g. Curd)"
                  className="w-full px-4 py-3.5 rounded-2xl border text-sm outline-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--warm-white)', fontFamily: 'Nunito' }} />
                <div className="grid grid-cols-3 gap-2">
                  {(['fresh','weekly','staple'] as PantryTier[]).map(t => (
                    <button key={t} onClick={() => setNewItem(p => ({ ...p, tier: t }))}
                      className="py-2.5 rounded-xl border text-xs font-bold transition-all"
                      style={{
                        background: newItem.tier === t ? 'var(--green-mid)' : 'white',
                        color: newItem.tier === t ? 'white' : 'var(--text-secondary)',
                        borderColor: newItem.tier === t ? 'var(--green-mid)' : 'var(--border)'
                      }}>
                      {TIER_CFG[t].emoji}<br/>{TIER_CFG[t].label.split(' ')[0]}
                    </button>
                  ))}
                </div>
                <input value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))}
                  placeholder="Category (e.g. Dairy)"
                  className="w-full px-4 py-3.5 rounded-2xl border text-sm outline-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--warm-white)', fontFamily: 'Nunito' }} />
                <div className="flex items-center gap-3">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Lasts approx.</span>
                  <input type="number" value={newItem.depletion_days} onChange={e => setNewItem(p => ({ ...p, depletion_days: +e.target.value }))}
                    className="w-20 px-3 py-3 rounded-xl border text-sm outline-none text-center"
                    style={{ borderColor: 'var(--border)', background: 'var(--warm-white)' }} />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>days</span>
                </div>
                <button onClick={addItem} disabled={saving || !newItem.name.trim()}
                  className="w-full py-4 rounded-2xl text-sm font-bold transition-all active:scale-95"
                  style={{ background: 'var(--green-mid)', color: 'white', opacity: saving ? 0.7 : 1, boxShadow: '0 4px 12px rgba(45,106,79,0.3)' }}>
                  {saving ? 'Adding...' : 'Add to Pantry →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
