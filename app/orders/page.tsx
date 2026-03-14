'use client'
import { useEffect, useState, useRef } from 'react'
import { OrderItem } from '@/types'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/components/AppProvider'

type Status = 'pending' | 'maybe' | 'ordered'

const SOURCE_LABEL: Record<string, string> = {
  manual: '', pantry: '🥬', meal_plan: '📋', smart: '✨', discover: '🍳'
}

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
  const [showMaybe, setShowMaybe] = useState(false)
  const [showOrdered, setShowOrdered] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/orders').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setItems(d)
      setLoading(false)
    })
    fetch('/api/suggest/orders').then(r => r.json()).then(d => {
      setSuggestions(d.suggestions || [])
      setSuggestionsLoading(false)
    }).catch(() => setSuggestionsLoading(false))
  }, [])

  // Realtime sync
  useEffect(() => {
    if (!user) return
    const ch = supabase.channel('orders-s8')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'order_items',
        filter: `household_id=eq.${user.household_id}`
      }, payload => {
        if (payload.eventType === 'INSERT') {
          const r = payload.new as OrderItem
          setItems(p => p.find(i => i.id === r.id) ? p : [...p, {
            ...r, added_by_username: r.added_by === user.id ? user.username : 'partner'
          }])
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
    const res = await fetch('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_name: newItem.trim() })
    })
    const d = await res.json()
    if (!d.error) { setItems(p => [...p, d]); setNewItem('') }
    setAdding(false)
  }

  async function setStatus(id: string, status: Status) {
    setItems(p => p.map(i => i.id === id ? { ...i, status, is_checked: status === 'ordered' } as any : i))
    await fetch('/api/orders', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status })
    })
  }

  async function deleteItem(id: string) {
    setItems(p => p.filter(i => i.id !== id))
    await fetch('/api/orders', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
  }

  async function markAllOrdered() {
    setMarkingAll(true)
    setItems(p => p.map(i => (i as any).status === 'pending' ? { ...i, status: 'ordered', is_checked: true } as any : i))
    await fetch('/api/orders', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark_all_ordered: true })
    })
    setMarkingAll(false)
  }

  async function clearOrdered() {
    setItems(p => p.filter(i => (i as any).status !== 'ordered'))
    await fetch('/api/orders', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clear_ordered: true })
    })
  }

  async function addSuggestion(item: string) {
    setAddedSuggestions(p => new Set([...p, item]))
    const res = await fetch('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_name: item, source: 'smart' })
    })
    const d = await res.json()
    if (!d.error) setItems(p => [...p, d])
  }

  const pending = items.filter(i => (i as any).status === 'pending' || (!((i as any).status) && !i.is_checked))
  const maybe   = items.filter(i => (i as any).status === 'maybe')
  const ordered = items.filter(i => (i as any).status === 'ordered' || (!(i as any).status && i.is_checked))

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <span style={{ fontSize: 28 }}>🛒</span>
    </div>
  )

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <div className="page-header">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Weekly Shop</p>
          <h1 className="font-display" style={{ color: 'white', fontSize: 24, fontWeight: 700, margin: 0 }}>Order List</h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 2 }}>
            {pending.length} to order{maybe.length > 0 ? ` · ${maybe.length} maybe` : ''}
          </p>
        </div>
        {pending.length > 0 && (
          <button onClick={markAllOrdered} disabled={markingAll} style={{
            position: 'absolute', top: 48, right: 20, zIndex: 2,
            background: 'rgba(255,255,255,0.15)', border: 'none',
            color: 'rgba(255,255,255,0.9)', padding: '6px 12px',
            borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer'
          }}>✓ All ordered</button>
        )}
      </div>

      <div style={{ padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Add item */}
        <div className="card" style={{ padding: 14 }}>
          <form onSubmit={addItem} style={{ display: 'flex', gap: 8 }}>
            <input ref={inputRef} value={newItem} onChange={e => setNewItem(e.target.value)}
              placeholder="Add item to order..."
              style={{ flex: 1, padding: '10px 14px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 14, outline: 'none', fontFamily: 'inherit', background: 'white' }} />
            <button type="submit" disabled={adding || !newItem.trim()} style={{
              padding: '10px 16px', borderRadius: 12, border: 'none',
              background: 'var(--green-mid)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer'
            }}>Add</button>
          </form>
        </div>

        {/* ── TO ORDER section ── */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>To Order</span>
              {pending.length > 0 && (
                <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: 'var(--amber-light)', color: 'var(--amber)' }}>{pending.length}</span>
              )}
            </div>
          </div>

          {pending.length === 0 ? (
            <p style={{ padding: '16px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>Nothing to order right now</p>
          ) : (
            <div>
              {pending.map(item => (
                <OrderRow key={item.id} item={item as any}
                  onSetStatus={setStatus} onDelete={deleteItem} />
              ))}
            </div>
          )}
        </div>

        {/* ── MAYBE section ── */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <button onClick={() => setShowMaybe(p => !p)} style={{
            width: '100%', padding: '11px 16px', background: 'none', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: showMaybe && maybe.length > 0 ? '1px solid var(--border)' : 'none'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Maybe</span>
              {maybe.length > 0 && (
                <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: 'var(--cream)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{maybe.length}</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Not sure if needed</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{showMaybe ? '▲' : '▼'}</span>
            </div>
          </button>

          {showMaybe && (
            maybe.length === 0 ? (
              <p style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Move items here when you're not sure if you'll need them soon.
              </p>
            ) : (
              <div>
                {maybe.map(item => (
                  <OrderRow key={item.id} item={item as any}
                    onSetStatus={setStatus} onDelete={deleteItem} isMaybe />
                ))}
              </div>
            )
          )}
        </div>

        {/* ── SMART SUGGESTIONS ── */}
        {(suggestionsLoading || suggestions.length > 0) && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--green-mid)' }}>✨ Smart Suggestions</span>
            </div>
            <div style={{ padding: '6px 0' }}>
              {suggestionsLoading ? (
                [1,2,3].map(i => (
                  <div key={i} style={{ padding: '10px 16px', display: 'flex', gap: 10 }}>
                    <div className="skeleton" style={{ flex: 1, height: 14, borderRadius: 6 }} />
                    <div className="skeleton" style={{ width: 60, height: 28, borderRadius: 8 }} />
                  </div>
                ))
              ) : suggestions.filter(s => !addedSuggestions.has(s.item)).map(s => (
                <div key={s.item} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{s.item}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>{s.reason}</p>
                  </div>
                  <button onClick={() => addSuggestion(s.item)} style={{
                    padding: '6px 14px', borderRadius: 99, border: 'none',
                    background: 'var(--green-light)', color: 'var(--green-deep)',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0
                  }}>+ Add</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ORDERED section ── */}
        {ordered.length > 0 && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <button onClick={() => setShowOrdered(p => !p)} style={{
              width: '100%', padding: '11px 16px', background: 'none', border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: showOrdered ? '1px solid var(--border)' : 'none'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Ordered</span>
                <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: '#D1FAE5', color: '#065F46' }}>{ordered.length}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={e => { e.stopPropagation(); clearOrdered() }} style={{
                  padding: '4px 10px', borderRadius: 99, border: '1px solid var(--border)',
                  background: 'white', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600
                }}>Clear</button>
                <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{showOrdered ? '▲' : '▼'}</span>
              </div>
            </button>
            {showOrdered && (
              <div>
                {ordered.map(item => (
                  <OrderRow key={item.id} item={item as any}
                    onSetStatus={setStatus} onDelete={deleteItem} isOrdered />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Individual order row ──────────────────────────────────────────────────────
function OrderRow({ item, onSetStatus, onDelete, isMaybe = false, isOrdered = false }: {
  item: any
  onSetStatus: (id: string, s: Status) => void
  onDelete: (id: string) => void
  isMaybe?: boolean
  isOrdered?: boolean
}) {
  const [showActions, setShowActions] = useState(false)
  const src = SOURCE_LABEL[item.source] || ''

  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '11px 16px',
      borderBottom: '1px solid var(--border)', gap: 10,
      background: isMaybe ? '#FAFAFA' : isOrdered ? '#F0FDF4' : 'white',
      opacity: isOrdered ? 0.65 : 1
    }}>
      {/* Status toggle circle */}
      <button onClick={() => {
        if (isOrdered) onSetStatus(item.id, 'pending')
        else onSetStatus(item.id, 'ordered')
      }} style={{
        width: 24, height: 24, borderRadius: '50%', flexShrink: 0, border: '2px solid',
        borderColor: isOrdered ? 'var(--green-mid)' : isMaybe ? 'var(--border)' : 'var(--green-soft)',
        background: isOrdered ? 'var(--green-mid)' : 'transparent',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontSize: 13
      }}>{isOrdered ? '✓' : ''}</button>

      {/* Name + source */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: isOrdered ? 400 : 500, color: isOrdered ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: isOrdered ? 'line-through' : 'none' }}>
          {src && <span style={{ marginRight: 4 }}>{src}</span>}
          {item.item_name}
        </span>
        {item.added_by_username && !isOrdered && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>· {item.added_by_username}</span>
        )}
      </div>

      {/* Action menu */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button onClick={() => setShowActions(p => !p)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '2px 6px', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1
        }}>⋯</button>
        {showActions && (
          <div onClick={() => setShowActions(false)} style={{
            position: 'absolute', right: 0, top: 28, zIndex: 10,
            background: 'white', borderRadius: 12, border: '1px solid var(--border)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 140, overflow: 'hidden'
          }}>
            {!isMaybe && !isOrdered && (
              <button onClick={() => onSetStatus(item.id, 'maybe')} style={{ width: '100%', padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                🤔 Move to Maybe
              </button>
            )}
            {isMaybe && (
              <button onClick={() => onSetStatus(item.id, 'pending')} style={{ width: '100%', padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: 500, color: 'var(--green-mid)', borderBottom: '1px solid var(--border)' }}>
                ← Move to Order
              </button>
            )}
            {isOrdered && (
              <button onClick={() => onSetStatus(item.id, 'pending')} style={{ width: '100%', padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                ↩ Move back
              </button>
            )}
            <button onClick={() => onDelete(item.id)} style={{ width: '100%', padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: 500, color: 'var(--red)' }}>
              🗑️ Remove
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
