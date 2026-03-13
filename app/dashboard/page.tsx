'use client'
import { useEffect, useState } from 'react'
import { useApp } from '@/components/AppProvider'
import { PantryItem, OrderItem } from '@/types'

const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']

function getDayKey() { return DAYS[new Date().getDay()] }
function getTodayDateStr() { return new Date().toDateString() }

// ── Smart Pick cache (localStorage, 1 per day) ──────────────────────────────
function getCachedSuggestion() {
  try {
    const raw = localStorage.getItem('gm_suggestion')
    if (!raw) return null
    const { date, data } = JSON.parse(raw)
    if (date !== getTodayDateStr()) return null
    return data
  } catch { return null }
}
function cacheSuggestion(data: any) {
  try { localStorage.setItem('gm_suggestion', JSON.stringify({ date: getTodayDateStr(), data })) } catch {}
}

export default function Dashboard() {
  const { user, household, logout } = useApp()
  const [lowItems, setLowItems] = useState<PantryItem[]>([])
  const [todaySlots, setTodaySlots] = useState<any[]>([])
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [suggestion, setSuggestion] = useState<{ lunch: string|null; dinner: string|null; reason: string }|null>(null)
  const [suggestionLoading, setSuggestionLoading] = useState(true)
  const [cookedToday, setCookedToday] = useState<Record<string, string>>({}) // slot → dish
  const [showCookAnything, setShowCookAnything] = useState(false)
  const [allSlots, setAllSlots] = useState<any[]>([])
  const today = getDayKey()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    fetch('/api/pantry/estimate', { method: 'POST' }).catch(() => {})

    fetch('/api/pantry').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setLowItems(d.filter((i: PantryItem) => i.stock_status !== 'good'))
    })

    fetch('/api/meal-plan').then(r => r.json()).then(d => {
      if (Array.isArray(d)) {
        setAllSlots(d)
        setTodaySlots(d.filter((s: any) => s.day === today))
      }
    })

    fetch('/api/orders').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setOrders(d.filter((o: OrderItem) => !o.is_checked))
    })

    // Smart Pick — use cache if same day, otherwise fetch
    const cached = getCachedSuggestion()
    if (cached) {
      setSuggestion(cached)
      setSuggestionLoading(false)
    } else {
      fetch(`/api/suggest/meal?day=${today}`)
        .then(r => r.json())
        .then(d => {
          if (d.suggestion) cacheSuggestion(d.suggestion)
          setSuggestion(d.suggestion)
          setSuggestionLoading(false)
        })
        .catch(() => setSuggestionLoading(false))
    }
  }, [today])

  async function logCooked(slot: string, dish: string) {
    setCookedToday(p => ({ ...p, [slot]: dish }))
    await fetch('/api/log', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'cooked', metadata: { dish_name: dish, slot, day: today } })
    })
  }

  async function addToOrder(name: string) {
    await fetch('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_name: name, source: 'pantry' })
    })
    setLowItems(p => p.filter(i => i.name !== name))
  }

  const lunch = todaySlots.filter(s => s.slot === 'lunch')
  const dinner = todaySlots.filter(s => s.slot === 'dinner')

  // All dishes from all days for "cook anything" picker
  const allDishes = Array.from(new Map(allSlots.map(s => [s.dish?.name, s.dish])).values()).filter(Boolean)

  if (!user) return null

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="page-header">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="font-display" style={{ color: 'white', fontSize: 24, fontWeight: 700, margin: 0 }}>
            {greeting}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 2 }}>{household?.name}</p>
        </div>
        <button onClick={logout} style={{
          position: 'absolute', top: 48, right: 20,
          background: 'rgba(255,255,255,0.15)', border: 'none', color: 'rgba(255,255,255,0.8)',
          padding: '6px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer'
        }}>Sign out</button>
      </div>

      <div style={{ padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Smart Pick ── */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13 }}>✨</span>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--green-mid)' }}>Smart Pick · Today</span>
            </div>
            {!suggestionLoading && (
              <button onClick={() => {
                localStorage.removeItem('gm_suggestion')
                setSuggestionLoading(true)
                fetch(`/api/suggest/meal?day=${today}`).then(r => r.json()).then(d => {
                  if (d.suggestion) cacheSuggestion(d.suggestion)
                  setSuggestion(d.suggestion); setSuggestionLoading(false)
                }).catch(() => setSuggestionLoading(false))
              }} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 6px' }}>
                ↻ Refresh
              </button>
            )}
          </div>
          <div style={{ padding: 16 }}>
            {suggestionLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="skeleton" style={{ height: 11, width: '80%' }} />
                <div className="skeleton" style={{ height: 11, width: '60%' }} />
                <div className="skeleton" style={{ height: 44, borderRadius: 10, marginTop: 4 }} />
              </div>
            ) : suggestion ? (
              <>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: 12, lineHeight: 1.5 }}>
                  "{suggestion.reason}"
                </p>
                {[{ slot: 'lunch', label: 'Lunch', emoji: '☀️', dish: suggestion.lunch },
                  { slot: 'dinner', label: 'Dinner', emoji: '🌙', dish: suggestion.dinner }
                ].filter(s => s.dish).map(({ slot, label, emoji, dish }) => (
                  <div key={slot} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderRadius: 12, marginBottom: 8,
                    background: cookedToday[slot] === dish ? 'var(--green-light)' : 'var(--cream)'
                  }}>
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>{emoji} {label}</p>
                      <p className="font-display" style={{ fontSize: 15, fontWeight: 700, margin: '2px 0 0' }}>{dish}</p>
                    </div>
                    {cookedToday[slot] === dish ? (
                      <span className="pill badge-good">✓ Logged</span>
                    ) : (
                      <button onClick={() => logCooked(slot, dish!)} style={{
                        background: 'var(--green-deep)', color: 'white', border: 'none',
                        padding: '7px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer'
                      }}>Making this</button>
                    )}
                  </div>
                ))}
              </>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Add meal options and pantry items to get smart suggestions.</p>
            )}
          </div>
        </div>

        {/* ── Today's Options — read only, log cooked ── */}
        <div className="card" style={{ background: '#1E3A2F', border: 'none', overflow: 'hidden' }}>
          <div style={{ padding: '11px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13 }}>🍽️</span>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.5)' }}>Today's Options</span>
            </div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>tap to log as cooked</span>
          </div>
          <div style={{ padding: 16 }}>
            {[{ label: '☀️ Lunch', items: lunch, slot: 'lunch' },
              { label: '🌙 Dinner', items: dinner, slot: 'dinner' }
            ].map(({ label, items, slot }) => (
              <div key={slot} style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginBottom: 8 }}>{label}</p>
                {items.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>Nothing planned</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {items.map((s: any) => {
                      const isCooked = cookedToday[slot] === s.dish?.name
                      return (
                        <button key={s.id} onClick={() => logCooked(slot, s.dish?.name)} style={{
                          padding: '6px 14px', borderRadius: 99, border: '1px solid',
                          borderColor: isCooked ? 'var(--green-soft)' : 'rgba(255,255,255,0.15)',
                          background: isCooked ? 'var(--green-soft)' : 'rgba(255,255,255,0.08)',
                          color: isCooked ? 'white' : 'rgba(255,255,255,0.8)',
                          fontSize: 13, fontWeight: 500, cursor: 'pointer'
                        }}>
                          {isCooked ? '✓ ' : ''}{s.dish?.name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
            <button onClick={() => setShowCookAnything(true)} style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)',
              fontSize: 12, cursor: 'pointer', padding: '4px 0', textDecoration: 'underline'
            }}>
              Cooking something else today?
            </button>
          </div>
        </div>

        {/* ── Order list gist ── */}
        <a href="/orders" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13 }}>🛒</span>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>Order List</span>
              </div>
              <span style={{ fontSize: 12, color: 'var(--green-mid)', fontWeight: 600 }}>View all →</span>
            </div>
            <div style={{ padding: '10px 16px 14px' }}>
              {orders.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing to order right now</p>
              ) : (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: orders.length > 3 ? 8 : 0 }}>
                    {orders.slice(0, 4).map(o => (
                      <span key={o.id} style={{
                        padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                        background: 'var(--cream)', border: '1px solid var(--border)', color: 'var(--text-primary)'
                      }}>{o.item_name}</span>
                    ))}
                  </div>
                  {orders.length > 4 && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>+{orders.length - 4} more items</p>
                  )}
                </>
              )}
            </div>
          </div>
        </a>

        {/* ── Pantry alerts ── */}
        {lowItems.length > 0 && (
          <div className="card" style={{ overflow: 'hidden', borderLeft: '3px solid var(--amber)' }}>
            <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13 }}>⚠️</span>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--amber)' }}>
                Pantry Alerts · {lowItems.length}
              </span>
            </div>
            <div style={{ padding: '4px 0' }}>
              {lowItems.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: item.stock_status === 'finished' ? 'var(--red)' : 'var(--amber)', flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{item.name}</span>
                    <span className={`pill ${item.stock_status === 'finished' ? 'badge-finished' : 'badge-low'}`} style={{ fontSize: 11 }}>
                      {item.stock_status}
                    </span>
                  </div>
                  <button onClick={() => addToOrder(item.name)} style={{
                    background: 'var(--green-light)', color: 'var(--green-deep)', border: 'none',
                    padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer'
                  }}>+ Order</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Cook anything sheet ── */}
      {showCookAnything && (
        <div onClick={() => setShowCookAnything(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 430, margin: '0 auto', borderRadius: '24px 24px 0 0', padding: '20px 20px 36px', border: 'none', maxHeight: '70vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 99, margin: '0 auto 16px' }} />
            <p className="font-display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Cooking something else?</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Pick any dish from your rotation</p>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {['lunch','dinner'].map(slot => (
                <div key={slot} style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>
                    {slot === 'lunch' ? '☀️ For Lunch' : '🌙 For Dinner'}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {allDishes.map((dish: any) => {
                      const isCooked = cookedToday[slot] === dish.name
                      return (
                        <button key={dish.name} onClick={() => { logCooked(slot, dish.name); setShowCookAnything(false) }} style={{
                          padding: '11px 14px', borderRadius: 12, border: '1px solid',
                          borderColor: isCooked ? 'var(--green-soft)' : 'var(--border)',
                          background: isCooked ? 'var(--green-light)' : 'white',
                          fontSize: 14, fontWeight: 500, cursor: 'pointer', textAlign: 'left',
                          color: isCooked ? 'var(--green-deep)' : 'var(--text-primary)'
                        }}>
                          {isCooked ? '✓ ' : ''}{dish.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
