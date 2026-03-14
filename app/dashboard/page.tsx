'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/components/AppProvider'
import { PantryItem, OrderItem, DailyLock, HouseholdPreferences } from '@/types'

const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']

function getTodayKey() { return DAYS[new Date().getDay()] }
function getTodayISO() { return new Date().toISOString().split('T')[0] }

// ── Mood nudge cache — 4 slots per day ───────────────────────────────
function getTimeSlot(hour: number): string {
  if (hour >= 6 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 15) return 'midday'
  if (hour >= 15 && hour < 19) return 'afternoon'
  return 'evening'
}
function nudgeCacheKey() {
  const h = new Date().getHours()
  return `gm_mood_${new Date().toDateString()}_${getTimeSlot(h)}`
}
function getMoodNudgeCache() {
  try {
    const raw = localStorage.getItem(nudgeCacheKey())
    if (!raw) return null
    const { data, dismissed } = JSON.parse(raw)
    return { data, dismissed }
  } catch { return null }
}
function setMoodNudgeCache(data: any, dismissed = false) {
  try { localStorage.setItem(nudgeCacheKey(), JSON.stringify({ data, dismissed })) } catch {}
}

const QC_APPS: Record<string, { name: string; emoji: string; url: string }> = {
  blinkit:   { name: 'Blinkit',    emoji: '🟡', url: 'https://blinkit.com' },
  zepto:     { name: 'Zepto',      emoji: '🟣', url: 'https://www.zeptonow.com' },
  swiggy:    { name: 'Swiggy Instamart', emoji: '🟠', url: 'https://www.swiggy.com/instamart' },
  bigbasket: { name: 'BigBasket',  emoji: '🟢', url: 'https://www.bigbasket.com' },
}

export default function Dashboard() {
  const { user, household, logout } = useApp()
  const router = useRouter()
  const [lowItems, setLowItems] = useState<PantryItem[]>([])
  const [todaySlots, setTodaySlots] = useState<any[]>([])
  const [allSlots, setAllSlots] = useState<any[]>([])
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [todayLocks, setTodayLocks] = useState<DailyLock[]>([])
  const [prefs, setPrefs] = useState<HouseholdPreferences>({})
  const [cookedToday, setCookedToday] = useState<Record<string, string>>({})
  const [showCookAnything, setShowCookAnything] = useState(false)

  // Mood nudge
  const [moodNudge, setMoodNudge] = useState<{ message: string; chips: string[] } | null>(null)
  const [moodNudgeDismissed, setMoodNudgeDismissed] = useState(true) // start hidden
  const [moodNudgeLoading, setMoodNudgeLoading] = useState(false)

  const today = getTodayKey()
  const hour = new Date().getHours()

  const displayName = prefs.member_names?.[user?.username || ''] || user?.username || ''
  const greeting = hour < 12 ? `Good morning${displayName ? ', ' + displayName : ''}`
    : hour < 17 ? `Good afternoon${displayName ? ', ' + displayName : ''}`
    : `Good evening${displayName ? ', ' + displayName : ''}`

  useEffect(() => {
    fetch('/api/pantry/estimate', { method: 'POST' }).catch(() => {})

    fetch('/api/pantry').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setLowItems(d.filter((i: PantryItem) => i.stock_status !== 'good'))
    })
    fetch('/api/meal-plan').then(r => r.json()).then(d => {
      if (Array.isArray(d)) { setAllSlots(d); setTodaySlots(d.filter((s: any) => s.day === today)) }
    })
    fetch('/api/orders').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setOrders(d.filter((o: OrderItem) => !o.is_checked))
    })
    fetch(`/api/locks?from=${getTodayISO()}&days=1`).then(r => r.json()).then(d => {
      if (Array.isArray(d)) setTodayLocks(d)
    })
    fetch('/api/preferences').then(r => r.json()).then(d => {
      if (!d.error) setPrefs(d)
    })

    // Mood nudge — 4 slots per day, slot-based cache
    const cached = getMoodNudgeCache()
    if (cached) {
      setMoodNudge(cached.data)
      setMoodNudgeDismissed(cached.dismissed)
    } else {
      setMoodNudgeLoading(true)
      setMoodNudgeDismissed(false)
      fetch('/api/suggest/mood').then(r => r.json()).then(d => {
        if (d.nudge) {
          setMoodNudge(d.nudge)
          setMoodNudgeCache(d.nudge, false)
        }
        setMoodNudgeLoading(false)
      }).catch(() => setMoodNudgeLoading(false))
    }
  }, [today])

  function dismissMoodNudge() {
    setMoodNudgeDismissed(true)
    if (moodNudge) setMoodNudgeCache(moodNudge, true)
  }

  function handleMoodChip(chip: string) {
    dismissMoodNudge()
    router.push(`/discover?prompt=${encodeURIComponent(chip)}`)
  }

  async function logCooked(slot: string, dish: string) {
    setCookedToday(p => ({ ...p, [slot]: dish }))
    await fetch('/api/log', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'cooked', metadata: { dish_name: dish, slot, day: today } })
    })
  }

  async function addToOrder(name: string) {
    const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_name: name, source: 'pantry' }) })
    const d = await res.json()
    if (!d.error) { setOrders(p => [...p, d]); setLowItems(p => p.filter(i => i.name !== name)) }
  }

  const lunch = todaySlots.filter(s => s.slot === 'lunch')
  const dinner = todaySlots.filter(s => s.slot === 'dinner')
  const lunchLock = todayLocks.find(l => l.slot === 'lunch')
  const dinnerLock = todayLocks.find(l => l.slot === 'dinner')
  const allDishes = Array.from(new Map(allSlots.map(s => [s.dish?.name, s.dish])).values()).filter(Boolean)
  const qcApps = ((prefs.quickcommerce || []) as string[]).map((k: string) => QC_APPS[k]).filter(Boolean)

  if (!user) return null

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="page-header">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="font-display" style={{ color: 'white', fontSize: 24, fontWeight: 700, margin: 0 }}>{greeting}</h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 2 }}>{household?.name}</p>
        </div>
        <a href="/settings" style={{
          position: 'absolute', top: 16, right: 20, zIndex: 2,
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          textDecoration: 'none', fontSize: 18, lineHeight: 1
        }}>⚙️</a>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Mood nudge (4x daily, dismissible) ── */}
        {(moodNudgeLoading || (!moodNudgeDismissed && moodNudge)) && (
          <div style={{ borderRadius: 16, overflow: 'hidden', background: 'linear-gradient(135deg, #1B4332 0%, #2D6A4F 100%)', padding: 16, position: 'relative' }}>
            <button onClick={dismissMoodNudge} style={{ position: 'absolute', top: 10, right: 12, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 18, lineHeight: 1, zIndex: 2 }}>×</button>
            {moodNudgeLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="skeleton" style={{ height: 11, width: '70%', opacity: 0.3 }} />
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 32, width: 80, borderRadius: 99, opacity: 0.2 }} />)}
                </div>
              </div>
            ) : moodNudge && (
              <>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, marginBottom: 12, paddingRight: 20 }}>
                  {moodNudge.message}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {moodNudge.chips.map(chip => (
                    <button key={chip} onClick={() => handleMoodChip(chip)} style={{
                      padding: '7px 14px', borderRadius: 99, border: '1px solid rgba(255,255,255,0.25)',
                      background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer'
                    }}>{chip}</button>
                  ))}
                  <button onClick={() => { dismissMoodNudge(); router.push('/discover') }} style={{
                    padding: '7px 14px', borderRadius: 99, border: '1px solid rgba(255,255,255,0.25)',
                    background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)',
                    fontSize: 13, cursor: 'pointer'
                  }}>Explore all →</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Today's Decision (locks) ── */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🔒</span>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>Today's Decision</span>
            </div>
            <a href="/meal-plan" style={{ fontSize: 12, color: 'var(--green-mid)', fontWeight: 600, textDecoration: 'none' }}>Change →</a>
          </div>
          <div style={{ padding: 14 }}>
            {[{ slot: 'lunch', label: '☀️ Lunch', lock: lunchLock, options: lunch },
              { slot: 'dinner', label: '🌙 Dinner', lock: dinnerLock, options: dinner }
            ].map(({ slot, label, lock, options }) => (
              <div key={slot} style={{ marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>{label}</p>
                  {lock
                    ? <p className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--green-deep)', margin: '3px 0 0' }}>{lock.dish_name}</p>
                    : <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', margin: '3px 0 0' }}>
                        {options.length > 0 ? `${options.length} options — not locked` : 'Nothing planned'}
                      </p>
                  }
                </div>
                <div style={{ flexShrink: 0 }}>
                  {lock
                    ? cookedToday[slot] === lock.dish_name
                      ? <span className="pill badge-good">✓ Cooked</span>
                      : <button onClick={() => logCooked(slot, lock.dish_name)} style={{ padding: '6px 14px', borderRadius: 99, border: 'none', background: 'var(--green-deep)', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cooked ✓</button>
                    : options.length > 0
                      ? <a href="/meal-plan" style={{ padding: '6px 12px', borderRadius: 99, border: '1px solid var(--border)', background: 'white', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>Lock →</a>
                      : null
                  }
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Order list gist ── */}
        <a href="/orders" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🛒</span>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>Order List</span>
                {orders.length > 0 && <span className="pill badge-low" style={{ fontSize: 11 }}>{orders.length}</span>}
              </div>
              <span style={{ fontSize: 12, color: 'var(--green-mid)', fontWeight: 600 }}>View →</span>
            </div>
            <div style={{ padding: '10px 16px 14px' }}>
              {orders.length === 0
                ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing to order right now</p>
                : <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {orders.slice(0, 5).map(o => (
                        <span key={o.id} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, background: 'var(--cream)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>{o.item_name}</span>
                      ))}
                    </div>
                    {orders.length > 5 && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>+{orders.length - 5} more</p>}

                  </>
              }
            </div>
          </div>
        </a>

        {/* ── Pantry alerts ── */}
        {lowItems.length > 0 && (
          <div className="card" style={{ overflow: 'hidden', borderLeft: '3px solid var(--amber)' }}>
            <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⚠️</span>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--amber)' }}>Pantry Alerts · {lowItems.length}</span>
            </div>
            <div style={{ padding: '4px 0' }}>
              {lowItems.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: item.stock_status === 'finished' ? 'var(--red)' : 'var(--amber)', flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{item.name}</span>
                    <span className={`pill ${item.stock_status === 'finished' ? 'badge-finished' : 'badge-low'}`} style={{ fontSize: 11 }}>{item.stock_status}</span>
                  </div>
                  <button onClick={() => addToOrder(item.name)} style={{ background: 'var(--green-light)', color: 'var(--green-deep)', border: 'none', padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Order</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Cook anything ── */}
        <button onClick={() => setShowCookAnything(true)} style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid var(--border)', background: 'white', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
          🍳 Cooking something not on the plan?
        </button>

      </div>

      {/* Cook anything sheet */}
      {showCookAnything && (
        <div onClick={() => setShowCookAnything(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 430, margin: '0 auto', borderRadius: '24px 24px 0 0', padding: '20px 20px 36px', border: 'none', maxHeight: '70vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 99, margin: '0 auto 16px' }} />
            <p className="font-display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Log a meal</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Pick from your rotation</p>
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {allDishes.map((dish: any) => (
                <div key={dish.name} style={{ display: 'flex', gap: 6 }}>
                  {['lunch','dinner'].map(slot => (
                    <button key={slot} onClick={() => { logCooked(slot, dish.name); setShowCookAnything(false) }} style={{
                      flex: 1, padding: '9px 10px', borderRadius: 10, border: '1px solid var(--border)',
                      background: cookedToday[slot] === dish.name ? 'var(--green-light)' : 'white',
                      fontSize: 12, fontWeight: 500, cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left'
                    }}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>{slot === 'lunch' ? '☀️' : '🌙'}</span>
                      {dish.name}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
