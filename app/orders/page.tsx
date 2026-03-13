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
  const [markingAll, setMarkingAll] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/orders').then(r => r.json()).then(d => { if (Array.isArray(d)) setItems(d); setLoading(false) })
    fetch('/api/suggest/orders').then(r => r.json()).then(d => { setSuggestions(d.suggestions || []); setSuggestionsLoading(false) }).catch(() => setSuggestionsLoading(false))
  }, [])

  useEffect(() => {
    if (!user) return
    const ch = supabase.channel('orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items', filter: `household_id=eq.${user.household_id}` }, payload => {
        if (payload.eventType === 'INSERT') {
          const r = payload.new as OrderItem
          setItems(p => p.find(i => i.id === r.id) ? p : [...p, { ...r, added_by_username: r.added_by === user.id ? user.username : 'partner' }])
        } else if (payload.eventType === 'UPDATE') {
          setItems(p => p.map(i => i.id === payload.new.id ? { ...i, ...payload.new } : i))
        } else if (payload.eventType === 'DELETE') {
          setItems(p => p.filter(i => i.id !== payload.old.id))
        }
      }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user])

  async function addItem(e: React.FormEvent) {
    e.preventDefault()
    if (!newItem.trim()) return
    setAdding(true)
    const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_name: newItem.trim() }) })
    const d = await res.json()
    if (!d.error) setItems(p => [...p, d])
    setNewItem(''); setAdding(false); inputRef.current?.focus()
  }

  async function addSuggestion(item: string) {
    setAddedSuggestions(p => new Set([...p, item]))
    const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_name: item, source: 'smart' }) })
    const d = await res.json()
    if (!d.error) setItems(p => [...p, d])
  }

  async function toggleCheck(id: string, current: boolean) {
    setItems(p => p.map(i => i.id === id ? { ...i, is_checked: !current } : i))
    await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_checked: !current }) })
  }

  async function removeItem(id: string) {
    setItems(p => p.filter(i => i.id !== id))
    await fetch('/api/orders', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
  }

  async function clearChecked() {
    setItems(p => p.filter(i => !i.is_checked))
    await fetch('/api/orders', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clear_checked: true }) })
  }

  async function markAllOrdered() {
    const unchecked = items.filter(i => !i.is_checked)
    if (unchecked.length === 0) return
    setMarkingAll(true)
    // Optimistic update
    setItems(p => p.map(i => ({ ...i, is_checked: true })))
    // Fire all PATCH calls
    await Promise.all(unchecked.map(i =>
      fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: i.id, is_checked: true }) })
    ))
    setMarkingAll(false)
  }

  const unchecked = items.filter(i => !i.is_checked)
  const checked = items.filter(i => i.is_checked)
  const currentNames = new Set(items.map(i => i.item_name.toLowerCase()))
  const visibleSuggestions = suggestions.filter(s => !currentNames.has(s.item.toLowerCase()) && !addedSuggestions.has(s.item))

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><span style={{ fontSize: 28 }}>🛒</span></div>

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <div className="page-header">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Shopping</p>
          <h1 className="font-display" style={{ color: 'white', fontSize: 24, fontWeight: 700, margin: 0 }}>Order List</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#86EFAC', display: 'inline-block' }} />
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, margin: 0 }}>Live sync with partner</p>
          </div>
        </div>
        {checked.length > 0 && (
          <button onClick={clearChecked} style={{
            position: 'absolute', top: 48, right: 20,
            background: 'rgba(255,255,255,0.15)', border: 'none', color: 'rgba(255,255,255,0.8)',
            padding: '6px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer'
          }}>Clear {checked.length} ✓</button>
        )}
      </div>

      <div style={{ padding: '16px 16px 24px' }}>

        {/* Add input */}
        <form onSubmit={addItem} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input ref={inputRef} value={newItem} onChange={e => setNewItem(e.target.value)}
            placeholder="Add an item to order..."
            style={{ flex: 1, padding: '11px 14px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 14, outline: 'none', background: 'white', fontFamily: 'inherit' }} />
          <button type="submit" disabled={adding || !newItem.trim()} style={{
            padding: '11px 18px', borderRadius: 12, border: 'none',
            background: 'var(--green-mid)', color: 'white',
            fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !newItem.trim() ? 0.5 : 1
          }}>Add</button>
        </form>

        {/* Smart suggestions */}
        {(suggestionsLoading || visibleSuggestions.length > 0) && (
          <div className="card" style={{ marginBottom: 12, overflow: 'hidden', borderLeft: '3px solid var(--green-soft)' }}>
            <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13 }}>✨</span>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--green-mid)' }}>Smart Suggestions</span>
            </div>
            <div style={{ padding: '8px 14px 12px' }}>
              {suggestionsLoading
                ? [70, 50, 60].map(w => <div key={w} className="skeleton" style={{ height: 10, width: `${w}%`, marginBottom: 8 }} />)
                : visibleSuggestions.map(s => (
                  <div key={s.item} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{s.item}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>{s.reason}</p>
                    </div>
                    <button onClick={() => addSuggestion(s.item)} style={{
                      flexShrink: 0, padding: '5px 12px', borderRadius: 99, border: 'none',
                      background: 'var(--green-light)', color: 'var(--green-deep)', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                    }}>+ Add</button>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* To get */}
        {unchecked.length > 0 && (
          <div className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
            <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>To get</span>
                <span className="pill badge-good" style={{ fontSize: 11 }}>{unchecked.length} item{unchecked.length !== 1 ? 's' : ''}</span>
              </div>
              <button onClick={markAllOrdered} disabled={markingAll} style={{
                padding: '5px 12px', borderRadius: 99, border: 'none', cursor: 'pointer',
                background: 'var(--green-deep)', color: 'white', fontSize: 11, fontWeight: 700,
                opacity: markingAll ? 0.6 : 1
              }}>
                {markingAll ? 'Marking...' : '✓ Mark all ordered'}
              </button>
            </div>
            <div style={{ padding: '4px 0' }}>
              {unchecked.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                  <button onClick={() => toggleCheck(item.id, false)} style={{
                    width: 22, height: 22, borderRadius: '50%', border: '2px solid var(--green-soft)',
                    background: 'none', cursor: 'pointer', flexShrink: 0
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{item.item_name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                      {item.added_by_username}
                      {item.source !== 'manual' && (
                        <span style={{ color: 'var(--green-soft)', marginLeft: 4 }}>
                          · {item.source === 'smart' ? '✨ smart' : item.source === 'discover' ? '🍳 discover' : item.source}
                        </span>
                      )}
                    </p>
                  </div>
                  <button onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Checked / ordered */}
        {checked.length > 0 && (
          <div className="card" style={{ overflow: 'hidden', opacity: 0.55 }}>
            <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                Ordered · {checked.length}
              </span>
              <button onClick={clearChecked} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>
                Clear all
              </button>
            </div>
            <div style={{ padding: '4px 0' }}>
              {checked.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                  <button onClick={() => toggleCheck(item.id, true)} style={{
                    width: 22, height: 22, borderRadius: '50%', background: 'var(--green-soft)', border: 'none',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <span style={{ color: 'white', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>
                  </button>
                  <p style={{ fontSize: 14, color: 'var(--text-muted)', textDecoration: 'line-through', margin: 0, flex: 1 }}>{item.item_name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {items.length === 0 && !suggestionsLoading && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
            <p className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)' }}>Basket is empty</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Add items above or mark pantry items as finished</p>
          </div>
        )}
      </div>
    </div>
  )
}
