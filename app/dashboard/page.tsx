'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/components/AppProvider'
import { useTour } from '@/components/TourProvider'
import { PantryItem, OrderItem, DailyLock, HouseholdPreferences } from '@/types'
import { cachedFetch } from '@/lib/page-cache'
import Icon from '@/components/Icon'
import Card from '@/components/Card'

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

// ── Insights from behaviour_log ───────────────────────────────────────────────
interface BehaviourEvent { event_type: string; metadata: any; created_at: string }
interface Insight { emoji: string; headline: string; subline: string }

function computeInsight(events: BehaviourEvent[]): Insight | null {
  if (!events.length) return null
  const now = Date.now()
  const DAY = 86400000

  const cooked   = events.filter(e => e.event_type === 'cooked')
  const locked   = events.filter(e => e.event_type === 'meal_locked')
  const discover = events.filter(e => e.event_type === 'discover_prompt')

  const cookedDays = new Set(cooked.map(e => new Date(e.created_at).toDateString()))
  let streak = 0
  for (let i = 0; i < 14; i++) {
    const d = new Date(now - i * DAY).toDateString()
    if (cookedDays.has(d)) streak++
    else if (i > 0) break
  }
  if (streak >= 3) {
    return { emoji: '🔥', headline: `${streak}-day streak`, subline: `Cooked every day for ${streak} days` }
  }

  const last30 = cooked.filter(e => now - new Date(e.created_at).getTime() < 30 * DAY)
  const dishCount: Record<string, number> = {}
  for (const e of last30) {
    const name = e.metadata?.dish_name
    if (name) dishCount[name] = (dishCount[name] || 0) + 1
  }
  const topDish = Object.entries(dishCount).sort((a, b) => b[1] - a[1])[0]
  if (topDish && topDish[1] >= 3) {
    return { emoji: '👨‍🍳', headline: `${topDish[0]} — ${topDish[1]}x this month`, subline: 'Your household favourite right now' }
  }

  const last7Days = new Set(Array.from({ length: 7 }, (_, i) => new Date(now - i * DAY).toDateString()))
  const lockedThisWeek = new Set(
    locked.filter(e => now - new Date(e.created_at).getTime() < 7 * DAY)
          .map(e => `${e.metadata?.lock_date}_${e.metadata?.slot}`)
  )
  const cookedThisWeek = cooked.filter(e => last7Days.has(new Date(e.created_at).toDateString())).length
  const lockedCount = lockedThisWeek.size
  if (lockedCount >= 3 && cookedThisWeek >= 2) {
    const pct = Math.round((cookedThisWeek / lockedCount) * 100)
    return {
      emoji: '📊',
      headline: `${cookedThisWeek} of ${lockedCount} planned meals cooked`,
      subline: pct >= 80 ? 'Solid week in the kitchen' : 'Room to cook more this week',
    }
  }

  const discoverLast14 = discover.filter(e => now - new Date(e.created_at).getTime() < 14 * DAY)
  if (discoverLast14.length >= 3) {
    return { emoji: '✨', headline: `${discoverLast14.length} new dishes explored`, subline: 'In the last two weeks' }
  }

  const lunchCount  = cooked.filter(e => e.metadata?.slot === 'lunch').length
  const dinnerCount = cooked.filter(e => e.metadata?.slot === 'dinner').length
  if (lunchCount + dinnerCount >= 6) {
    const more = lunchCount > dinnerCount ? 'lunch' : 'dinner'
    const less = more === 'lunch' ? 'dinner' : 'lunch'
    return {
      emoji: more === 'lunch' ? '☀️' : '🌙',
      headline: `You cook ${more} more than ${less}`,
      subline: `${Math.max(lunchCount, dinnerCount)} ${more}s logged so far`,
    }
  }

  if (cooked.length >= 2) {
    return { emoji: '🍳', headline: `${cooked.length} meals cooked and logged`, subline: 'Insights get richer over time' }
  }
  return null
}

export default function Dashboard() {
  const { user, household } = useApp()
  const router = useRouter()
  const [lowItems, setLowItems] = useState<PantryItem[]>([])
  const [todaySlots, setTodaySlots] = useState<any[]>([])
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [todayLocks, setTodayLocks] = useState<DailyLock[]>([])
  const [prefs, setPrefs] = useState<HouseholdPreferences>({})
  const [cookedToday, setCookedToday] = useState<Record<string, string>>({})
  const [insight, setInsight] = useState<Insight | null>(null)

  const { triggerIfNew } = useTour()

  const [moodNudge, setMoodNudge] = useState<{ message: string; chips: string[] } | null>(null)
  const [moodNudgeDismissed, setMoodNudgeDismissed] = useState(true)
  const [moodNudgeLoading, setMoodNudgeLoading] = useState(false)
  const [moodNudgeExpanded, setMoodNudgeExpanded] = useState(false)

  const today = getTodayKey()
  const hour = new Date().getHours()

  const displayName = prefs.member_names?.[user?.username || ''] || user?.username || ''
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    fetch('/api/pantry/estimate', { method: 'POST' }).catch(() => {})
    const locksUrl = `/api/locks?from=${getTodayISO()}&days=1`

    Promise.all([
      cachedFetch('dashboard:pantry',    () => fetch('/api/pantry').then(r => r.json()),      (d) => { if (Array.isArray(d)) setLowItems(d.filter((i: any) => i.stock_status !== 'good' && i.depletion_source === 'auto')) }),
      cachedFetch('dashboard:meal-plan', () => fetch('/api/meal-plan').then(r => r.json()),   (d) => { if (Array.isArray(d)) setTodaySlots(d.filter((s: any) => s.day === today)) }),
      cachedFetch('dashboard:orders',    () => fetch('/api/orders').then(r => r.json()),      (d) => { if (Array.isArray(d)) setOrders(d.filter((o: any) => o.status === 'pending' || (!o.status && !o.is_checked))) }),
      cachedFetch('dashboard:locks',     () => fetch(locksUrl).then(r => r.json()),           (d) => { if (Array.isArray(d)) setTodayLocks(d) }),
      cachedFetch('dashboard:prefs',     () => fetch('/api/preferences').then(r => r.json()), (d) => { if (!d?.error) setPrefs(d) }),
      cachedFetch('dashboard:log',       () => fetch('/api/log/summary').then(r => r.json()), (d) => { if (Array.isArray(d)) setInsight(computeInsight(d)) }),
    ])

    triggerIfNew()

    const cached = getMoodNudgeCache()
    if (cached) {
      setMoodNudge(cached.data)
      setMoodNudgeDismissed(cached.dismissed)
    } else {
      setMoodNudgeLoading(true)
      setMoodNudgeDismissed(false)
      fetch('/api/suggest/mood').then(r => r.json()).then(d => {
        if (d.nudge) { setMoodNudge(d.nudge); setMoodNudgeCache(d.nudge, false) }
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

  if (!user) return null

  const SLOTS = [
    { slot: 'lunch',  label: 'Lunch',  lock: lunchLock,  options: lunch  },
    { slot: 'dinner', label: 'Dinner', lock: dinnerLock, options: dinner },
  ]

  return (
    <div style={{ background: 'var(--surface)', minHeight: '100vh' }}>

      {/* ── Header — one ink, flex actions, safe-area aware ── */}
      <div className="page-header" data-tour="header">
        <div>
          <p className="page-eyebrow">
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
            {household?.name ? ` · ${household.name}` : ''}
          </p>
          <h1 className="page-title">{greeting},<br />{displayName}</h1>
        </div>
        <a href="/settings" className="header-btn" aria-label="Settings"><Icon name="settings" size={21} strokeWidth={1.6} /></a>
      </div>

      <div className="page-body">

        {/* ── PRIMARY: today's plan. The one hero on this screen. ── */}
        <div data-tour="todays-decision" style={{
          background: 'var(--green-deep)', borderRadius: 'var(--r-lg)',
          padding: '14px var(--s4)', display: 'flex', flexDirection: 'column', gap: 'var(--s3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--t-label)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.55)' }}>Today&apos;s plan</span>
            <a href="/meal-plan" style={{ fontSize: 14, fontWeight: 600, color: 'var(--mint)' }}>Change</a>
          </div>

          {SLOTS.map(({ slot, label, lock, options }, i) => (
            <div key={slot} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
              {i > 0 && <div style={{ height: 1, background: 'rgba(255,255,255,0.12)' }} />}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 'var(--t-label)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                    {label}{!lock && options.length > 0 ? ` · ${options.length} options` : ''}
                  </p>
                  {lock ? (
                    <p className="font-display" style={{ fontSize: 22, fontWeight: 600, color: '#fff', margin: '4px 0 0' }}>{lock.dish_name}</p>
                  ) : options.length > 0 ? (
                    <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.8)', margin: '4px 0 0' }}>
                      {options.slice(0, 2).map((s: any) => s.dish?.name).filter(Boolean).join(', ')}
                      {options.length > 2 ? '…' : ''}
                    </p>
                  ) : (
                    <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', margin: '4px 0 0' }}>Nothing planned</p>
                  )}
                </div>

                {lock
                  ? cookedToday[slot] === lock.dish_name
                    ? <span className="btn btn-sm" style={{ background: 'rgba(149,213,178,0.16)', color: 'var(--mint)', cursor: 'default' }}><Icon name="check" size={15} strokeWidth={2.4} />Cooked</span>
                    : <button className="btn btn-on-dark" onClick={() => logCooked(slot, lock.dish_name)}><Icon name="check" size={16} strokeWidth={2.4} />Cooked</button>
                  : <a href="/meal-plan" className="btn btn-on-dark">{options.length > 0 ? 'Choose' : 'Plan'}</a>
                }
              </div>
            </div>
          ))}
        </div>

        {/* ── Mood nudge — demoted from full gradient card to one quiet line ── */}
        {(moodNudgeLoading || (!moodNudgeDismissed && moodNudge)) && (
          moodNudgeLoading ? (
            <div className="skeleton" style={{ height: 15, width: '70%', margin: '2px' }} />
          ) : moodNudgeExpanded ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '2px' }}>
              <p style={{ fontSize: 'var(--t-body)', color: 'var(--text-secondary)', margin: 0 }}>{moodNudge!.message}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {moodNudge!.chips.map(chip => (
                  <button key={chip} className="btn btn-sm btn-secondary" onClick={() => handleMoodChip(chip)}>{chip}</button>
                ))}
                <button className="btn btn-sm btn-ghost" onClick={() => { dismissMoodNudge(); router.push('/discover') }}>Explore all</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setMoodNudgeExpanded(true)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '2px',
              background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit', minHeight: 44,
            }}>
              <Icon name="spark" size={16} style={{ color: 'var(--green-mid)' }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--t-body)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{moodNudge!.message}</span>
              <span style={{ fontSize: 'var(--t-body)', fontWeight: 600, color: 'var(--green-mid)', flexShrink: 0 }}>See ideas</span>
            </button>
          )
        )}

        {/* ── Running out — above the order list: time-sensitive beats a list ── */}
        {lowItems.length > 0 && (
          <Card title="Running out" icon="alert" tone="warn" count={lowItems.length}>
            {lowItems.map(item => (
              <div key={item.id} className="card-row">
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: item.stock_status === 'finished' ? 'var(--red)' : 'var(--amber)' }} />
                  <span style={{ fontSize: 'var(--t-item)', fontWeight: 500 }}>{item.name}</span>
                  <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{item.stock_status}</span>
                </span>
                <button className="btn btn-sm btn-secondary" onClick={() => addToOrder(item.name)}>Order</button>
              </div>
            ))}
          </Card>
        )}

        {/* ── Order list ── */}
        <Card title={`Order list${orders.length ? ` · ${orders.length}` : ''}`} icon="orders" action="View" onAction={() => router.push('/orders')}>
          <div style={{ padding: 'var(--s3) var(--s4)' }}>
            {orders.length === 0
              ? <p style={{ fontSize: 'var(--t-body)', color: 'var(--text-muted)', margin: 0 }}>Nothing to order right now</p>
              : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {orders.slice(0, 5).map(o => (
                    <span key={o.id} style={{
                      padding: '7px 11px', borderRadius: 'var(--r-full)', fontSize: 14, fontWeight: 500,
                      background: 'var(--sunken)', border: '1px solid var(--border)'
                    }}>{o.item_name}</span>
                  ))}
                  {orders.length > 5 && (
                    <span style={{ padding: '7px 11px', fontSize: 14, color: 'var(--text-muted)' }}>+{orders.length - 5} more</span>
                  )}
                </div>
              )}
          </div>
        </Card>

        {/* ── Insight — the one place emoji still earns its keep ── */}
        {insight && (
          <div data-tour="insight-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 4px' }}>
            <span style={{ fontSize: 22 }}>{insight.emoji}</span>
            <p style={{ fontSize: 'var(--t-body)', color: 'var(--text-secondary)', margin: 0 }}>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{insight.headline}</span> — {insight.subline}
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
