'use client'
import { useEffect, useState, useRef } from 'react'
import { OrderItem } from '@/types'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/components/AppProvider'

export default function OrdersPage() {
  const { user } = useApp()
  const [items, setItems] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newItem, setNewItem] = useState('')
  const [adding, setAdding] = useState(false)
  const [suggestions, setSuggestions] = useState<{ item: string; reason: string }[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(true)
  const [addedSuggestions, setAddedSuggestions] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/orders').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setItems(d)
      setLoading(false)
    })
    fetch('/api/suggest/orders')
      .then(r => r.json())
      .then(d => { setSuggestions(d.suggestions || []); setSuggestionsLoading(false) })
      .catch(() => setSuggestionsLoading(false))
  }, [])

  useEffect(() => {
    if (!user) return
    const channel = supabase.channel('order_items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items', filter: `household_id=eq.${user.household_id}` },
        payload => {
          if (payload.eventType === 'INSERT') {
            const r = payload.new as OrderItem
            setItems(prev => prev.find(i => i.id === r.id) ? prev : [...prev, { ...r, added_by_username: r.added_by === user.id ? user.username : 'partner' }])
          } else if (payload.eventType === 'UPDATE') {
            setItems(prev => prev.map(i => i.id === payload.new.id ? { ...i, ...payload.new } : i))
          } else if (payload.eventType === 'DELETE') {
            setItems(prev => prev.filter(i => i.id !== payload.old.id))
          }
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  async function addItem(e: React.FormEvent) {
    e.preventDefault()
    if (!newItem.trim()) return
    setAdding(true)
    const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_name: newItem.trim() }) })
    const d = await res.json()
    if (!d.error) setItems(prev => [...prev, d])
    setNewItem(''); setAdding(false); inputRef.current?.focus()
  }

  async function addSuggestion(item: string) {
    setAddedSuggestions(prev => new Set([...prev, item]))
    const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_name: item, source: 'smart' }) })
    const d = await res.json()
    if (!d.error) setItems(prev => [...prev, d])
  }

  async function toggleCheck(id: string, current: boolean) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, is_checked: !current } : i))
    await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_checked: !current }) })
  }

  async function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    await fetch('/api/orders', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
  }

  async function clearChecked() {
    setItems(prev => prev.filter(i => !i.is_checked))
    await fetch('/api/orders', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clear_checked: true }) })
  }

  const unchecked = items.filter(i => !i.is_checked)
  const checked = items.filter(i => i.is_checked)
  const currentNames = new Set(items.map(i => i.item_name.toLowerCase()))
  const visibleSuggestions = suggestions.filter(s => !currentNames.has(s.item.toLowerCase()) && !addedSuggestions.has(s.item))

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-3xl" style={{ animation: 'wiggle 1s ease infinite' }}>🛒</div>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      {/* ── Header ── */}
      <div className="page-header px-5 pt-10 pb-10">
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.55)' }}>Shopping</p>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Lora, serif' }}>🛒 Order List</h1>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#86EFAC' }} />
              <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.65)' }}>Live sync with partner</p>
            </div>
          </div>
          {checked.length > 0 && (
            <button onClick={clearChecked}
              className="mt-1 text-xs font-bold px-3 py-1.5 rounded-full transition-all"
              style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}>
              Clear {checked.length} ✓
            </button>
          )}
        </div>
      </div>

      <div className="px-4 -mt-2 pb-8 space-y-4">
        {/* ── Add input ── */}
        <form onSubmit={addItem} className="flex gap-2 animate-slide-up stagger-1">
          <input ref={inputRef} value={newItem} onChange={e => setNewItem(e.target.value)}
            placeholder="Add an item to order..."
            className="flex-1 px-4 py-3.5 rounded-2xl border text-sm outline-none transition-all"
            style={{ borderColor: 'var(--border)', background: 'white', fontFamily: 'Nunito' }}
            onFocus={e => e.target.style.borderColor = 'var(--green-mid)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'} />
          <button type="submit" disabled={adding || !newItem.trim()}
            className="px-5 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95"
            style={{ background: 'var(--green-mid)', color: 'white', opacity: !newItem.trim() ? 0.5 : 1, boxShadow: '0 4px 12px rgba(45,106,79,0.3)' }}>
            Add
          </button>
        </form>

        {/* ── Smart suggestions ── */}
        {(suggestionsLoading || visibleSuggestions.length > 0) && (
          <div className="kitchen-card-warm overflow-hidden animate-slide-up stagger-2" style={{ borderLeft: '3px solid var(--green-soft)' }}>
            <div className="px-4 pt-4 pb-2 flex items-center gap-2">
              <span>✨</span>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--green-mid)' }}>Smart Suggestions</p>
            </div>
            <div className="px-4 pb-4 space-y-2">
              {suggestionsLoading ? (
                [75,55,65].map(w => <div key={w} className={`shimmer h-3`} style={{ width: `${w}%` }} />)
              ) : visibleSuggestions.map(s => (
                <div key={s.item} className="basket-item p-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="text-sm font-bold">{s.item}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.reason}</p>
                  </div>
                  <button onClick={() => addSuggestion(s.item)}
                    className="pill transition-all active:scale-95 flex-shrink-0"
                    style={{ background: 'var(--green-light)', color: 'var(--green-deep)' }}>
                    + Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── To get ── */}
        {unchecked.length > 0 && (
          <div className="kitchen-card animate-slide-up stagger-3">
            <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                To get
              </p>
              <span className="pill text-xs" style={{ background: 'var(--green-light)', color: 'var(--green-deep)' }}>
                {unchecked.length} item{unchecked.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="p-3 space-y-1">
              {unchecked.map(item => (
                <div key={item.id}
                  className="basket-item group flex items-center gap-3 p-3">
                  <button onClick={() => toggleCheck(item.id, false)}
                    className="w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all"
                    style={{ borderColor: 'var(--green-soft)' }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold block truncate">{item.item_name}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {item.added_by_username}
                      {item.source !== 'manual' && (
                        <span className="ml-1" style={{ color: 'var(--green-soft)' }}>
                          · {item.source === 'smart' ? '✨ smart' : `from ${item.source}`}
                        </span>
                      )}
                    </span>
                  </div>
                  <button onClick={() => removeItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all"
                    style={{ color: 'var(--text-muted)' }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Checked off ── */}
        {checked.length > 0 && (
          <div className="kitchen-card animate-slide-up stagger-4" style={{ opacity: 0.65 }}>
            <div className="px-5 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                Ordered · {checked.length}
              </p>
            </div>
            <div className="p-3 space-y-1">
              {checked.map(item => (
                <div key={item.id} className="flex items-center gap-3 p-3">
                  <button onClick={() => toggleCheck(item.id, true)}
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--green-soft)' }}>
                    <span className="text-white text-xs font-bold">✓</span>
                  </button>
                  <span className="text-sm line-through flex-1" style={{ color: 'var(--text-muted)' }}>{item.item_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {items.length === 0 && !suggestionsLoading && (
          <div className="text-center py-16 animate-fade-in">
            <div className="text-5xl mb-4">🛒</div>
            <p className="font-bold" style={{ fontFamily: 'Lora, serif', color: 'var(--text-secondary)' }}>Your basket is empty</p>
            <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Add items above or mark pantry items as finished</p>
          </div>
        )}
      </div>
    </div>
  )
}
