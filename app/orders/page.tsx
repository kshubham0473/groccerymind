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
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/orders').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setItems(data)
      setLoading(false)
    })
  }, [])

  // Real-time sync via Supabase
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('order_items')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'order_items',
        filter: `household_id=eq.${user.household_id}`,
      }, payload => {
        if (payload.eventType === 'INSERT') {
          const newRow = payload.new as OrderItem
          setItems(prev => {
            if (prev.find(i => i.id === newRow.id)) return prev
            return [...prev, { ...newRow, added_by_username: newRow.added_by === user.id ? user.username : 'partner' }]
          })
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
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_name: newItem.trim() })
    })
    const data = await res.json()
    if (!data.error) setItems(prev => [...prev, data])
    setNewItem('')
    setAdding(false)
    inputRef.current?.focus()
  }

  async function toggleCheck(id: string, current: boolean) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, is_checked: !current } : i))
    await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_checked: !current })
    })
  }

  async function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    await fetch('/api/orders', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
  }

  async function clearChecked() {
    setItems(prev => prev.filter(i => !i.is_checked))
    await fetch('/api/orders', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clear_checked: true })
    })
  }

  const unchecked = items.filter(i => !i.is_checked)
  const checked = items.filter(i => i.is_checked)

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-2xl animate-bounce">🛒</div></div>

  return (
    <div className="max-w-lg mx-auto px-4 py-6 animate-slide-up">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display', color: 'var(--green-deep)' }}>Order List</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--green-soft)' }} />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Live — synced with your partner</p>
          </div>
        </div>
        {checked.length > 0 && (
          <button onClick={clearChecked}
            className="text-xs font-medium px-3 py-1.5 rounded-full border transition-all mt-1"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            Clear checked ({checked.length})
          </button>
        )}
      </div>

      {/* Add item input */}
      <form onSubmit={addItem} className="flex gap-2 mb-5">
        <input ref={inputRef} value={newItem} onChange={e => setNewItem(e.target.value)}
          placeholder="Add an item..."
          className="flex-1 px-4 py-3 rounded-xl border text-sm outline-none transition-all"
          style={{ borderColor: 'var(--border)', background: 'white' }}
          onFocus={e => e.target.style.borderColor = 'var(--green-mid)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'} />
        <button type="submit" disabled={adding || !newItem.trim()}
          className="px-5 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
          style={{ background: 'var(--green-mid)', color: 'white', opacity: !newItem.trim() ? 0.5 : 1 }}>
          Add
        </button>
      </form>

      {/* Items to get */}
      {unchecked.length > 0 && (
        <div className="kitchen-card p-4 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
            To get · {unchecked.length} item{unchecked.length !== 1 ? 's' : ''}
          </p>
          <div className="space-y-1">
            {unchecked.map(item => (
              <div key={item.id} className="group flex items-center gap-3 py-2.5 px-1 rounded-xl transition-all hover:bg-gray-50">
                <button onClick={() => toggleCheck(item.id, false)}
                  className="w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all"
                  style={{ borderColor: 'var(--green-soft)' }} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium block truncate">{item.item_name}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    added by {item.added_by_username}
                    {item.source !== 'manual' && <span className="ml-1 capitalize" style={{ color: 'var(--green-soft)' }}>· from {item.source}</span>}
                  </span>
                </div>
                <button onClick={() => removeItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 text-xs p-1.5 rounded-lg transition-all"
                  style={{ color: 'var(--text-muted)' }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Checked items */}
      {checked.length > 0 && (
        <div className="kitchen-card p-4 mb-4" style={{ opacity: 0.7 }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
            Ordered · {checked.length}
          </p>
          <div className="space-y-1">
            {checked.map(item => (
              <div key={item.id} className="flex items-center gap-3 py-2.5 px-1">
                <button onClick={() => toggleCheck(item.id, true)}
                  className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
                  style={{ background: 'var(--green-soft)' }}>
                  <span className="text-white text-xs">✓</span>
                </button>
                <span className="text-sm line-through flex-1" style={{ color: 'var(--text-muted)' }}>{item.item_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">🛒</div>
          <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>Your order list is empty</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Add items above or mark pantry items as finished</p>
        </div>
      )}
    </div>
  )
}
