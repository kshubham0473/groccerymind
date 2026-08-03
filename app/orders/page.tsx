'use client'
import { useEffect, useState, useRef } from 'react'
import { cachedFetch, cacheInvalidate } from '@/lib/page-cache'
import { OrderItem } from '@/types'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/components/AppProvider'

type Status = 'pending' | 'maybe' | 'ordered'

/** Why an item is on the list — a word, not an emoji. */
const SOURCE_WORD: Record<string, string> = {
  pantry:    'From the kitchen',
  meal_plan: 'For the plan',
  smart:     'Suggested',
  discover:  'For a dish',
  manual:    '',
}

const QC_APPS: Record<string, { name: string; url: string }> = {
  blinkit:   { name: 'Blinkit',   url: 'https://blinkit.com' },
  zepto:     { name: 'Zepto',     url: 'https://www.zeptonow.com' },
  swiggy:    { name: 'Instamart', url: 'https://www.swiggy.com/instamart' },
  bigbasket: { name: 'BigBasket', url: 'https://www.bigbasket.com' },
}

function joinNames(names: string[]) {
  return names.join(', ')
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
  const [frequentItems, setFrequentItems] = useState<string[]>([])
  const [prefs, setPrefs] = useState<any>({})
  const [actionItem, setActionItem] = useState<any>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      cachedFetch('orders:items',    () => fetch('/api/orders').then(r => r.json()),          (d) => { if (Array.isArray(d)) { setItems(d); setLoading(false) } }),
      cachedFetch('orders:prefs',    () => fetch('/api/preferences').then(r => r.json()),     (d) => { if (!d?.error) setPrefs(d) }),
      cachedFetch('orders:frequent', () => fetch('/api/orders/frequent').then(r => r.json()),(d) => { if (Array.isArray(d)) setFrequentItems(d) }),
      fetch('/api/suggest/orders').then(r => r.json()).then(d => {
        setSuggestions(d.suggestions || [])
        setSuggestionsLoading(false)
      }).catch(() => setSuggestionsLoading(false)),
    ])
  }, [])

  // Realtime — dedup on id to prevent double-add
  useEffect(() => {
    if (!user) return
    const ch = supabase.channel('orders-s9')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'order_items',
        filter: `household_id=eq.${user.household_id}`
      }, payload => {
        if (payload.eventType === 'INSERT') {
          const r = payload.new as OrderItem
          setItems(p => p.some(i => i.id === r.id) ? p : [...p, {
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
    cacheInvalidate('orders:items', 'dashboard:orders')
    const res = await fetch('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_name: newItem.trim() })
    })
    const d = await res.json()
    if (!d.error) {
      setItems(p => p.some(i => i.id === d.id) ? p : [...p, d])
      setFrequentItems(p => p.filter(f => f.toLowerCase() !== newItem.trim().toLowerCase()))
      setNewItem('')
    }
    setAdding(false)
  }

  async function addNamed(name: string, source = 'manual') {
    setFrequentItems(p => p.filter(f => f !== name))
    cacheInvalidate('orders:items', 'dashboard:orders')
    const res = await fetch('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_name: name, source })
    })
    const d = await res.json()
    if (!d.error) setItems(p => p.some(i => i.id === d.id) ? p : [...p, d])
  }

  async function setStatus(id: string, status: Status) {
    setItems(p => p.map(i => i.id === id ? { ...i, status, is_checked: status === 'ordered' } as any : i))
    setActionItem(null)
    cacheInvalidate('orders:items', 'dashboard:orders')
    await fetch('/api/orders', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status })
    })
  }

  async function deleteItem(id: string) {
    setItems(p => p.filter(i => i.id !== id))
    setActionItem(null)
    cacheInvalidate('orders:items', 'dashboard:orders')
    await fetch('/api/orders', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
  }

  async function markAllOrdered() {
    setMarkingAll(true)
    setItems(p => p.map(i => (i as any).status === 'pending' ? { ...i, status: 'ordered', is_checked: true } as any : i))
    cacheInvalidate('orders:items', 'dashboard:orders')
    await fetch('/api/orders', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark_all_ordered: true })
    })
    setMarkingAll(false)
  }

  async function clearOrdered() {
    setItems(p => p.filter(i => (i as any).status !== 'ordered'))
    cacheInvalidate('orders:items', 'dashboard:orders')
    await fetch('/api/orders', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clear_ordered: true })
    })
  }

  async function addSuggestion(item: string) {
    setAddedSuggestions(p => new Set([...p, item]))
    await addNamed(item, 'smart')
  }

  const pending = items.filter(i => (i as any).status === 'pending' || (!((i as any).status) && !i.is_checked))
  const maybe   = items.filter(i => (i as any).status === 'maybe')
  const ordered = items.filter(i => (i as any).status === 'ordered' || (!(i as any).status && i.is_checked))
  const qcApps  = ((prefs.quickcommerce || []) as string[]).map((k: string) => QC_APPS[k]).filter(Boolean)

  const pendingNames = new Set(pending.map(p => p.item_name.toLowerCase()))
  const visibleFrequent = frequentItems.filter(f => !pendingNames.has(f.toLowerCase())).slice(0, 6)
  const openSuggestions = suggestions.filter(s => !addedSuggestions.has(s.item) && !pendingNames.has(s.item.toLowerCase())).slice(0, 3)

  // The partner's most recent addition, for the subhead.
  const lastByPartner = [...pending].reverse().find((i: any) => i.added_by_username && i.added_by_username !== user?.username)

  const headline =
    pending.length === 0 ? 'Nothing to order' :
    pending.length === 1 ? 'One to order' :
    `${pending.length} to order`

  function whyLine(item: any): string {
    const src = SOURCE_WORD[item.source] || ''
    if (src) return src
    if (item.added_by_username && item.added_by_username !== user?.username) return item.added_by_username
    return ''
  }

  if (loading) return (
    <div className="screen"><div className="screen-body" style={{ paddingTop: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="skeleton" style={{ height: 15, width: 90 }} />
      <div className="skeleton" style={{ height: 34, width: '60%' }} />
      <div className="skeleton" style={{ height: 46, width: '100%' }} />
      <div className="skeleton" style={{ height: 46, width: '100%' }} />
      <div className="skeleton" style={{ height: 46, width: '100%' }} />
    </div></div>
  )

  return (
    <div className="screen">

      <div className="screen-head">
        <span className="label">Shared list</span>
        <span style={{ display: 'flex', gap: 14 }}>
          {qcApps.map((app: any) => (
            <a key={app.url} href={app.url} target="_blank" rel="noopener noreferrer" className="label tap">{app.name}</a>
          ))}
        </span>
      </div>

      <div className="screen-body" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>

        <div style={{ paddingTop: 22 }}>
          <p className="font-display" style={{ fontSize: 'var(--t-page)', lineHeight: 1.15, fontWeight: 600, margin: 0 }}>
            {headline}
          </p>
          {lastByPartner && (
            <p style={{ fontSize: 15, color: 'var(--ink-soft)', margin: '8px 0 0' }}>
              {(lastByPartner as any).added_by_username} added {lastByPartner.item_name.toLowerCase()}.
            </p>
          )}
        </div>

        {/* ── The list itself ─────────────────────────────────────── */}
        <div data-tour="list" style={{ paddingTop: 24 }}>
          <div className="rule" />
          {pending.map(item => (
            <div key={item.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', minHeight: 48 }}>
                <button className="check tap" role="checkbox" aria-checked="false"
                        aria-label={`Mark ${item.item_name} ordered`}
                        onClick={() => setStatus(item.id, 'ordered')} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 16 }}>{item.item_name}</span>
                {whyLine(item) && <span className="status">{whyLine(item)}</span>}
                <button className="tap" aria-label="More" onClick={() => setActionItem(item)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)', fontSize: 18, lineHeight: 1, padding: '0 2px' }}>⋯</button>
              </div>
              <div className="rule" />
            </div>
          ))}

          {pending.length === 0 && (
            <>
              <p className="tail" style={{ padding: '16px 0' }}>The list is clear.</p>
              <div className="rule" />
            </>
          )}

          {/* Add line — a ruled field, not a card. */}
          <form onSubmit={addItem} style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 14 }}>
            <span style={{ fontSize: 20, color: 'var(--ochre)', lineHeight: 1 }}>+</span>
            <input ref={inputRef} className="field" value={newItem} onChange={e => setNewItem(e.target.value)}
                   placeholder="Add an item" disabled={adding} />
          </form>

          {/* Suggestions and frequents live under the add line, where they
              answer the question you just started asking. */}
          {(visibleFrequent.length > 0 || openSuggestions.length > 0) && (
            <p className="tail" style={{ paddingTop: 12, fontSize: 14 }}>
              {openSuggestions.length > 0 && (
                <>
                  {suggestionsLoading ? null : 'Suggested — '}
                  {openSuggestions.map((s, idx) => (
                    <span key={s.item}>
                      <button className="word word-ink tap" title={s.reason} onClick={() => addSuggestion(s.item)}
                              style={{ fontSize: 14, letterSpacing: 0, textTransform: 'none', fontFamily: 'inherit' }}>
                        {s.item}
                      </button>{idx < openSuggestions.length - 1 ? ', ' : '. '}
                    </span>
                  ))}
                </>
              )}
              {visibleFrequent.length > 0 && (
                <>
                  Usually —{' '}
                  {visibleFrequent.map((name, idx) => (
                    <span key={name}>
                      <button className="word word-quiet tap" onClick={() => addNamed(name)}
                              style={{ fontSize: 14, letterSpacing: 0, textTransform: 'none', fontFamily: 'inherit', color: 'var(--ink-soft)' }}>
                        {name}
                      </button>{idx < visibleFrequent.length - 1 ? ', ' : '.'}
                    </span>
                  ))}
                </>
              )}
            </p>
          )}
        </div>

        {/* ── The tail: things you are not acting on right now ────── */}
        {(maybe.length > 0 || ordered.length > 0) && (
          <div style={{ paddingTop: 26 }}>
            <p className="label" style={{ margin: '0 0 8px' }}>Not urgent</p>
            <p className="tail">
              {maybe.length > 0 && <>{maybe.length} can wait — {joinNames(maybe.slice(0, 4).map(i => i.item_name.toLowerCase()))}{maybe.length > 4 ? `, +${maybe.length - 4}` : ''}. </>}
              {ordered.length > 0 && <>{ordered.length} already ordered. </>}
              {ordered.length > 0 && (
                <button className="word word-quiet tap" onClick={clearOrdered}
                        style={{ fontSize: 15, letterSpacing: 0, textTransform: 'none', fontFamily: 'inherit' }}>
                  Clear those
                </button>
              )}
            </p>
          </div>
        )}

        <div style={{ flex: 1, minHeight: 24 }} />

        {pending.length > 0 && (
          <div style={{ paddingTop: 18 }}>
            <button className="action" onClick={markAllOrdered} disabled={markingAll}>
              {markingAll ? 'Marking…' : `Mark all ${pending.length} ordered`}
            </button>
          </div>
        )}
      </div>

      {/* ── Row action sheet ───────────────────────────────────────── */}
      {actionItem && (
        <div className="sheet-scrim" onClick={() => setActionItem(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <p className="sheet-title">{actionItem.item_name}</p>
            {whyLine(actionItem) && <p className="sheet-sub">{whyLine(actionItem)}</p>}

            <div style={{ paddingTop: 20 }}>
              <div className="rule" />
              {(actionItem.status === 'maybe' || actionItem.status === 'ordered') ? (
                <>
                  <button className="row" onClick={() => setStatus(actionItem.id, 'pending')}>
                    <span style={{ flex: 1 }}><p className="row-title" style={{ fontSize: 18 }}>Back to the list</p></span>
                  </button>
                  <div className="rule" />
                </>
              ) : (
                <>
                  <button className="row" onClick={() => setStatus(actionItem.id, 'maybe')}>
                    <span style={{ flex: 1 }}>
                      <p className="row-title" style={{ fontSize: 18 }}>It can wait</p>
                      <p className="row-meta">Moves out of the count</p>
                    </span>
                  </button>
                  <div className="rule" />
                </>
              )}
            </div>

            <button className="action-sm" style={{ width: '100%', marginTop: 18, borderColor: 'var(--rule)', color: 'var(--finished)' }}
                    onClick={() => deleteItem(actionItem.id)}>
              Remove from the list
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
