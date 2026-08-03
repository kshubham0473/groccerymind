'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/components/AppProvider'
import { useTour } from '@/components/TourProvider'
import { PantryItem, OrderItem, DailyLock, HouseholdPreferences } from '@/types'
import { cachedFetch, cacheInvalidate } from '@/lib/page-cache'
import DishImage from '@/components/DishImage'

const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
const todayKey = () => DAYS[new Date().getDay()]
const todayISO = () => new Date().toISOString().split('T')[0]

// Until the corpus carries real timings, complexity is the honest proxy.
const MINUTES: Record<string, number> = { quick: 20, moderate: 45, elaborate: 90 }
const minutesFor = (dish: any) => MINUTES[dish?.complexity] ?? 40

/** Which meal are we deciding? Before 3pm it's lunch, after that dinner. */
const activeSlot = () => (new Date().getHours() < 15 ? 'lunch' : 'dinner')

export default function Tonight() {
  const { user, household } = useApp()
  const router = useRouter()
  const { triggerIfNew } = useTour()

  const [slots, setSlots]       = useState<any[]>([])
  const [locks, setLocks]       = useState<DailyLock[]>([])
  const [pantry, setPantry]     = useState<PantryItem[]>([])
  const [orders, setOrders]     = useState<OrderItem[]>([])
  const [prefs, setPrefs]       = useState<HouseholdPreferences>({})
  const [activity, setActivity] = useState<{ who: string; what: string } | null>(null)
  const [loading, setLoading]   = useState(true)

  const [pick, setPick]     = useState(0)      // index into today's options
  const [cooked, setCooked] = useState(false)

  const slot = activeSlot()
  const day = todayKey()

  useEffect(() => {
    fetch('/api/pantry/estimate', { method: 'POST' }).catch(() => {})
    Promise.all([
      cachedFetch('dashboard:meal-plan', () => fetch('/api/meal-plan').then(r => r.json()),                      (d) => { if (Array.isArray(d)) setSlots(d.filter((s: any) => s.day === day)) }),
      cachedFetch('dashboard:locks',     () => fetch(`/api/locks?from=${todayISO()}&days=1`).then(r => r.json()),(d) => { if (Array.isArray(d)) setLocks(d) }),
      cachedFetch('dashboard:pantry',    () => fetch('/api/pantry').then(r => r.json()),                         (d) => { if (Array.isArray(d)) setPantry(d) }),
      cachedFetch('dashboard:orders',    () => fetch('/api/orders').then(r => r.json()),                         (d) => { if (Array.isArray(d)) setOrders(d.filter((o: any) => o.status === 'pending' || (!o.status && !o.is_checked))) }),
      cachedFetch('dashboard:prefs',     () => fetch('/api/preferences').then(r => r.json()),                    (d) => { if (!d?.error) setPrefs(d) }),
      // See README-PATCH: /api/log/summary should return the partner's last action.
      cachedFetch('dashboard:log',       () => fetch('/api/log/summary').then(r => r.json()),                    (d) => { if (d && !Array.isArray(d) && d.partner_action) setActivity(d.partner_action) }),
    ]).finally(() => setLoading(false))
    triggerIfNew()
  }, [day])

  const options = useMemo(() => slots.filter(s => s.slot === slot), [slots, slot])
  const lock    = locks.find(l => l.slot === slot)

  const chosen    = lock ? null : options[pick % Math.max(options.length, 1)]
  const chosenName = lock ? lock.dish_name : chosen?.dish?.name
  const chosenDish = chosen?.dish
  const alternates = options.filter((_, i) => i !== pick % Math.max(options.length, 1)).slice(0, 2)

  const lowItems = pantry.filter(i => i.stock_status !== 'good')
  const memberName = (u?: string) => prefs.member_names?.[u || ''] || u || 'Someone'

  async function cook() {
    if (!chosenName) return
    setCooked(true)
    cacheInvalidate('dashboard:log')
    await fetch('/api/log', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'cooked', metadata: { dish_name: chosenName, slot, day } })
    })
    // Locks the slot too, so the partner sees the same answer.
    if (!lock) {
      await fetch('/api/locks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lock_date: todayISO(), slot, dish_name: chosenName })
      }).catch(() => {})
    }
  }

  if (!user) return null

  return (
    <div className="screen">

      <div className="screen-head">
        <span className="label">
          {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
          {' · '}
          {new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
        </span>
        <a href="/settings" className="label tap">{household?.name || 'Settings'}</a>
      </div>

      <div className="screen-body" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>

        {/* ── The pick ───────────────────────────────────────────── */}
        {loading ? (
          <div style={{ paddingTop: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="skeleton" style={{ height: 15, width: 70 }} />
            <div className="skeleton" style={{ height: 38, width: '75%' }} />
            <div className="skeleton" style={{ height: 158, width: '100%' }} />
            <div className="skeleton" style={{ height: 60, width: '100%' }} />
          </div>
        ) : chosenName ? (
          <>
            <div data-tour="tonight" style={{ paddingTop: 22 }}>
              <p className="font-display" style={{ fontSize: 15, fontStyle: 'italic', color: 'var(--ochre)', margin: 0 }}>
                {cooked ? 'Cooked' : slot === 'lunch' ? 'Today' : 'Tonight'}
              </p>
              <p className="font-display" style={{ fontSize: 'var(--t-hero)', lineHeight: 1.1, fontWeight: 600, margin: '6px 0 0' }}>
                {chosenName}
              </p>
              <p style={{ fontSize: 15, color: 'var(--ink-soft)', margin: '8px 0 0' }}>
                {chosenDish ? `${minutesFor(chosenDish)} min` : 'Locked in'}
                {chosenDish?.cuisine_type ? ` · ${chosenDish.cuisine_type}` : ''}
              </p>
            </div>

            <div style={{ paddingTop: 18 }}>
              <DishImage name={chosenName} youtubeUrl={chosenDish?.youtube_url} height={158} />
            </div>

            <div data-tour="commit" style={{ paddingTop: 18, display: 'flex', gap: 10 }}>
              <button className="action" onClick={cook} disabled={cooked}>
                {cooked ? 'Cooked ✓' : 'Cook this'}
              </button>
              {!lock && options.length > 1 && !cooked && (
                <button className="action-ghost" onClick={() => setPick(p => p + 1)} aria-label="Suggest another">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 12a8 8 0 1 1-2.5-5.8" /><path d="M20 4v5h-5" />
                  </svg>
                </button>
              )}
            </div>
          </>
        ) : (
          <div style={{ paddingTop: 22 }}>
            <p className="font-display" style={{ fontSize: 'var(--t-page)', lineHeight: 1.15, fontWeight: 600, margin: 0 }}>
              Nothing planned for {slot}
            </p>
            <p style={{ fontSize: 15, color: 'var(--ink-soft)', margin: '8px 0 18px' }}>Pick a few dishes and we&apos;ll choose between them.</p>
            <button className="action" onClick={() => router.push('/meal-plan')}>Plan the week</button>
          </div>
        )}

        {/* ── Alternates ─────────────────────────────────────────── */}
        {!loading && alternates.length > 0 && !cooked && (
          <div style={{ paddingTop: 26 }}>
            <p className="label" style={{ margin: '0 0 14px' }}>Or instead</p>
            <div className="rule" />
            {alternates.map((o: any) => (
              <div key={o.id}>
                <button className="row" onClick={() => setPick(options.indexOf(o))}>
                  <DishImage name={o.dish?.name} youtubeUrl={o.dish?.youtube_url} height={58} size="sm"
                             style={{ width: 58, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <p className="row-title">{o.dish?.name}</p>
                    <p className="row-meta">{minutesFor(o.dish)} min{o.dish?.meal_pairing ? ` · ${o.dish.meal_pairing}` : ''}</p>
                  </span>
                </button>
                <div className="rule" />
              </div>
            ))}
            <p style={{ fontSize: 15, color: 'var(--ink-soft)', margin: '18px 0 0' }}>
              Something else <a href="/discover" style={{ color: 'var(--ink)', fontWeight: 600, borderBottom: '1px solid var(--ink)', paddingBottom: 2 }}>Browse all</a>
            </p>
          </div>
        )}

        <div style={{ flex: 1, minHeight: 24 }} />

        {/* ── The rest of the app, as one sentence ───────────────── */}
        {!loading && (lowItems.length > 0 || orders.length > 0 || activity) && (
          <div data-tour="news" style={{ paddingTop: 18 }}>
            <div className="rule" style={{ marginBottom: 16 }} />
            <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.65 }}>
              {lowItems.length > 0 && (
                <>
                  <a href="/pantry" style={{ color: 'var(--ochre)', fontWeight: 600 }}>
                    {lowItems.length} running low
                  </a>
                  {' — '}{lowItems.slice(0, 2).map(i => i.name.toLowerCase()).join(', ')}
                  {lowItems.length > 2 ? `, +${lowItems.length - 2}` : ''}.<br />
                </>
              )}
              {orders.length > 0 && (
                <><a href="/orders" style={{ color: 'var(--ink)' }}>{orders.length} on the list</a>.{' '}</>
              )}
              {activity && (
                <><span style={{ color: 'var(--ink)' }}>{memberName(activity.who)}</span> {activity.what}.</>
              )}
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
