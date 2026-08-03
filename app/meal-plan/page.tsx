'use client'
import { useEffect, useState } from 'react'
import { cachedFetch, cacheInvalidate } from '@/lib/page-cache'
import { useRouter } from 'next/navigation'
import { DailyLock } from '@/types'
import DishImage from '@/components/DishImage'

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const SHORT: Record<string,string> = { monday:'Mon',tuesday:'Tue',wednesday:'Wed',thursday:'Thu',friday:'Fri',saturday:'Sat',sunday:'Sun' }
const SLOTS = [{ key: 'lunch', label: 'Lunch' }, { key: 'dinner', label: 'Dinner' }]

function todayISO() { return new Date().toISOString().split('T')[0] }
function dateForDay(dayName: string): string {
  const today = new Date()
  const todayIdx = today.getDay()
  const dayIdx = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].indexOf(dayName)
  const diff = (dayIdx - todayIdx + 7) % 7
  const target = new Date(today)
  target.setDate(today.getDate() + diff)
  return target.toISOString().split('T')[0]
}
function getTodayDayName() {
  return ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date().getDay()]
}
/** The week reads forward from today, not from Monday. */
function weekFromToday(): string[] {
  const start = DAYS.indexOf(getTodayDayName())
  return Array.from({ length: 7 }, (_, i) => DAYS[(start + i) % 7])
}

// ── Lock action sheet ─────────────────────────────────────────────────────────
function LockSheet({ slot, label, dayName, date, allSlots, onLock, onClose }: {
  slot: string; label: string; dayName: string; date: string
  allSlots: any[]
  onLock: (dish_name: string, dish_id?: string) => void
  onClose: () => void
}) {
  const router = useRouter()
  const [mode, setMode] = useState<'choose'|'thisDay'|'otherDay'|'manual'>('choose')
  const [manualDish, setManualDish] = useState('')
  const [otherDay, setOtherDay] = useState('')

  const thisDayOptions = allSlots.filter(s => s.day === dayName && s.slot === slot).map(s => s.dish).filter(Boolean)
  const otherDayDishes = otherDay ? allSlots.filter(s => s.day === otherDay && s.slot === slot).map(s => s.dish).filter(Boolean) : []

  const DishRows = ({ list, empty }: { list: any[]; empty: string }) => (
    <div style={{ overflowY: 'auto', flex: 1 }}>
      <div className="rule" />
      {list.length === 0
        ? <><p className="tail" style={{ padding: '16px 0' }}>{empty}</p><div className="rule" /></>
        : list.map((dish: any) => (
            <div key={dish.id}>
              <button className="row" onClick={() => onLock(dish.name, dish.id)}>
                <DishImage name={dish.name} youtubeUrl={dish.youtube_url} imageUrl={dish.image_url} height={46} size="sm" style={{ width: 46, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <p className="row-title">{dish.name}</p>
                  {dish.meal_pairing && <p className="row-meta">{dish.meal_pairing}</p>}
                </span>
              </button>
              <div className="rule" />
            </div>
          ))}
    </div>
  )

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>

        {mode === 'choose' && (
          <>
            <p className="sheet-title">Lock {label.toLowerCase()}</p>
            <p className="sheet-sub">{new Date(date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
            <div style={{ paddingTop: 20 }}>
              <div className="rule" />
              <button className="row" onClick={() => setMode('thisDay')}>
                <span style={{ flex: 1 }}>
                  <p className="row-title" style={{ fontSize: 18 }}>From {SHORT[dayName]}&apos;s menu</p>
                  <p className="row-meta">{thisDayOptions.length} option{thisDayOptions.length !== 1 ? 's' : ''}</p>
                </span>
              </button>
              <div className="rule" />
              <button className="row" onClick={() => setMode('otherDay')}>
                <span style={{ flex: 1 }}>
                  <p className="row-title" style={{ fontSize: 18 }}>From another day</p>
                  <p className="row-meta">The full weekly rotation</p>
                </span>
              </button>
              <div className="rule" />
              <button className="row" onClick={() => { onClose(); router.push(`/discover?lockSlot=${slot}&lockDate=${date}`) }}>
                <span style={{ flex: 1 }}>
                  <p className="row-title" style={{ fontSize: 18 }}>Something new</p>
                  <p className="row-meta">Browse all, from your kitchen</p>
                </span>
              </button>
              <div className="rule" />
              <button className="row" onClick={() => setMode('manual')}>
                <span style={{ flex: 1 }}>
                  <p className="row-title" style={{ fontSize: 18 }}>Type a dish name</p>
                  <p className="row-meta">One-time — stays out of the rotation</p>
                </span>
              </button>
              <div className="rule" />
            </div>
          </>
        )}

        {mode === 'thisDay' && (
          <>
            <button className="word word-quiet tap" style={{ alignSelf: 'flex-start', marginBottom: 14 }} onClick={() => setMode('choose')}>Back</button>
            <p className="sheet-title" style={{ fontSize: 20 }}>{SHORT[dayName]} · {label.toLowerCase()}</p>
            <div style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <DishRows list={thisDayOptions} empty="Nothing on this day's menu yet." />
            </div>
          </>
        )}

        {mode === 'otherDay' && !otherDay && (
          <>
            <button className="word word-quiet tap" style={{ alignSelf: 'flex-start', marginBottom: 14 }} onClick={() => setMode('choose')}>Back</button>
            <p className="sheet-title" style={{ fontSize: 20 }}>Which day?</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 22px', paddingTop: 18 }}>
              {DAYS.filter(d => d !== dayName).map(d => (
                <button key={d} className="word tap" onClick={() => setOtherDay(d)}>{SHORT[d]}</button>
              ))}
            </div>
          </>
        )}

        {mode === 'otherDay' && otherDay && (
          <>
            <button className="word word-quiet tap" style={{ alignSelf: 'flex-start', marginBottom: 14 }} onClick={() => setOtherDay('')}>Back</button>
            <p className="sheet-title" style={{ fontSize: 20 }}>{SHORT[otherDay]} · {label.toLowerCase()}</p>
            <div style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <DishRows list={otherDayDishes} empty={`Nothing on ${SHORT[otherDay]}'s menu.`} />
            </div>
          </>
        )}

        {mode === 'manual' && (
          <>
            <button className="word word-quiet tap" style={{ alignSelf: 'flex-start', marginBottom: 14 }} onClick={() => setMode('choose')}>Back</button>
            <p className="sheet-title" style={{ fontSize: 20 }}>Type a dish name</p>
            <input autoFocus className="field" style={{ marginTop: 16 }} value={manualDish}
              onChange={e => setManualDish(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && manualDish.trim() && onLock(manualDish.trim())}
              placeholder="Maggi, leftover curry…" />
            <p className="tail" style={{ fontSize: 14, paddingTop: 12 }}>This locks the decision only — it won&apos;t join your weekly rotation.</p>
            <button className="action" style={{ marginTop: 22 }} onClick={() => manualDish.trim() && onLock(manualDish.trim())} disabled={!manualDish.trim()}>
              Lock this dish
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Dish edit sheet ───────────────────────────────────────────────────────────
function DishEditSheet({ dish, onSave, onClose }: {
  dish: any; onSave: (updated: any) => void; onClose: () => void
}) {
  const [name, setName] = useState(dish.name || '')
  const [pairing, setPairing] = useState(dish.meal_pairing || '')
  const [ytUrl, setYtUrl] = useState(dish.youtube_url || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!name.trim()) { setError('A dish needs a name'); return }
    setSaving(true)
    const res = await fetch('/api/dishes', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: dish.id, name: name.trim(), meal_pairing: pairing.trim(), youtube_url: ytUrl.trim() })
    })
    const d = await res.json()
    if (d.error) { setError(d.error); setSaving(false); return }
    onSave(d)
    setSaving(false)
  }

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <p className="sheet-title">Edit dish</p>
        <div style={{ paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <p className="label" style={{ margin: '0 0 2px' }}>Dish name</p>
            <input className="field" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <p className="label" style={{ margin: '0 0 2px' }}>Serves with</p>
            <input className="field" value={pairing} onChange={e => setPairing(e.target.value)} placeholder="Steamed rice, roti, standalone" />
          </div>
          <div>
            <p className="label" style={{ margin: '0 0 2px' }}>Recipe link</p>
            <input className="field" style={{ fontSize: 14 }} value={ytUrl} onChange={e => setYtUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" />
          </div>
        </div>
        {error && <p style={{ fontSize: 14, color: 'var(--finished)', margin: '14px 0 0' }}>{error}</p>}
        <button className="action" style={{ marginTop: 24 }} onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button className="action-sm" style={{ width: '100%', marginTop: 10, border: 'none', color: 'var(--ink-soft)' }} onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MealPlanPage() {
  const [slots, setSlots] = useState<any[]>([])
  const [locks, setLocks] = useState<DailyLock[]>([])
  const [loading, setLoading] = useState(true)
  const [openDay, setOpenDay] = useState<string|null>(null)
  const [adding, setAdding] = useState<{ day: string; slot: string }|null>(null)
  const [newDish, setNewDish] = useState('')
  const [saving, setSaving] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parsedIngredients, setParsedIngredients] = useState<string[]>([])
  const [lockSheet, setLockSheet] = useState<{ slot: string; label: string; day: string }|null>(null)
  const [editingDish, setEditingDish] = useState<any>(null)
  const todayName = getTodayDayName()
  const week = weekFromToday()

  useEffect(() => {
    const locksUrl = `/api/locks?from=${todayISO()}&days=7`
    let slotsReady = false, locksReady = false
    const tryDone = () => { if (slotsReady && locksReady) setLoading(false) }
    cachedFetch('mealplan:slots', () => fetch('/api/meal-plan').then(r => r.json()), (d) => { if (Array.isArray(d)) { setSlots(d); slotsReady = true; tryDone() } })
    cachedFetch('mealplan:locks', () => fetch(locksUrl).then(r => r.json()),         (d) => { if (Array.isArray(d)) { setLocks(d); locksReady = true; tryDone() } })
  }, [])

  useEffect(() => {
    if (!newDish.trim() || newDish.length < 3) { setParsedIngredients([]); return }
    const t = setTimeout(async () => {
      setParsing(true)
      try {
        const res = await fetch('/api/suggest/ingredients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dish_name: newDish.trim() }) })
        const d = await res.json()
        if (d.ingredients?.length) setParsedIngredients(d.ingredients)
      } finally { setParsing(false) }
    }, 800)
    return () => clearTimeout(t)
  }, [newDish])

  const lockFor = (day: string, slot: string) => locks.find(l => l.lock_date === dateForDay(day) && l.slot === slot)
  const optionsFor = (day: string, slot: string) => slots.filter(s => s.day === day && s.slot === slot)

  /** The one line the day row shows: what's decided, or what's on offer. */
  function dayHeadline(day: string) {
    const dinnerLock = lockFor(day, 'dinner')
    const lunchLock  = lockFor(day, 'lunch')
    if (dinnerLock) return { name: dinnerLock.dish_name, meta: day === todayName ? 'Locked for tonight' : 'Locked', dish: null as any, ochre: true }
    if (lunchLock)  return { name: lunchLock.dish_name,  meta: 'Lunch locked', dish: null as any, ochre: true }
    const opts = optionsFor(day, 'dinner')
    if (opts.length === 0) return null
    const rest = opts.slice(1).map((o: any) => o.dish?.name).filter(Boolean)
    return {
      name: opts[0].dish?.name,
      meta: rest.length ? `or ${rest.slice(0, 2).join(', ')}` : 'One option',
      dish: opts[0].dish,
      ochre: false,
    }
  }

  async function lockMeal(day: string, slot: string, dish_name: string, dish_id?: string) {
    const date = dateForDay(day)
    setLockSheet(null)
    cacheInvalidate('mealplan:locks', 'dashboard:locks')
    const res = await fetch('/api/locks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lock_date: date, slot, dish_name, dish_id: dish_id || null })
    })
    const d = await res.json()
    if (!d.error) setLocks(p => [...p.filter(l => !(l.lock_date === date && l.slot === slot)), d])
  }

  async function unlockMeal(day: string, slot: string) {
    const date = dateForDay(day)
    cacheInvalidate('mealplan:locks', 'dashboard:locks')
    await fetch('/api/locks', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lock_date: date, slot })
    })
    setLocks(p => p.filter(l => !(l.lock_date === date && l.slot === slot)))
  }

  async function addDish() {
    if (!newDish.trim() || !adding) return
    setSaving(true)
    cacheInvalidate('mealplan:slots', 'dashboard:meal-plan')
    const res = await fetch('/api/meal-plan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day: adding.day, slot: adding.slot, dish_name: newDish.trim(), ingredients: parsedIngredients })
    })
    const d = await res.json()
    if (!d.error) setSlots(p => [...p, d])
    setNewDish(''); setParsedIngredients([]); setAdding(null); setSaving(false)
  }

  function handleDishSaved(updated: any) {
    setSlots(p => p.map(s => s.dish?.id === updated.id ? { ...s, dish: { ...s.dish, ...updated } } : s))
    setEditingDish(null)
  }

  async function removeSlot(id: string) {
    cacheInvalidate('mealplan:slots', 'dashboard:meal-plan')
    await fetch('/api/meal-plan', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slot_id: id }) })
    setSlots(p => p.filter(s => s.id !== id))
  }

  const decided = week.filter(d => lockFor(d, 'dinner')).length
  const planned = week.filter(d => !lockFor(d, 'dinner') && optionsFor(d, 'dinner').length > 0).length
  const openNights = 7 - decided - planned

  if (loading) return (
    <div className="screen"><div className="screen-body" style={{ paddingTop: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="skeleton" style={{ height: 15, width: 90 }} />
      <div className="skeleton" style={{ height: 34, width: '50%' }} />
      {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 54, width: '100%' }} />)}
    </div></div>
  )

  return (
    <div className="screen">

      <div className="screen-head">
        <span className="label">
          {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          {' – '}
          {new Date(Date.now() + 6 * 864e5).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </span>
        <span className="label">Dinner</span>
      </div>

      <div className="screen-body" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>

        <div style={{ paddingTop: 22 }}>
          <p className="font-display" style={{ fontSize: 'var(--t-page)', lineHeight: 1.15, fontWeight: 600, margin: 0 }}>The week</p>
          <p style={{ fontSize: 15, color: 'var(--ink-soft)', margin: '8px 0 0' }}>
            {decided > 0 ? `${decided} decided` : 'Nothing locked yet'}
            {planned > 0 ? `, ${planned} with options` : ''}
            {openNights > 0 ? `, ${openNights} still open.` : '.'}
          </p>
        </div>

        {/* ── Seven rows, one per day ─────────────────────────────── */}
        <div style={{ paddingTop: 22 }}>
          <div className="rule" />
          {week.map(day => {
            const head = dayHeadline(day)
            const isToday = day === todayName
            const isOpen = openDay === day
            return (
              <div key={day}>
                <button className="row" onClick={() => { setOpenDay(isOpen ? null : day); setAdding(null) }}
                        aria-expanded={isOpen}>
                  <span className="label" style={{ width: 42, flexShrink: 0, color: isToday ? 'var(--ochre)' : 'var(--ink-soft)', fontWeight: isToday ? 500 : 400 }}>
                    {SHORT[day]}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {head ? (
                      <>
                        <p className="row-title">{head.name}</p>
                        <p className="row-meta" style={head.ochre ? { color: 'var(--ochre)' } : undefined}>{head.meta}</p>
                      </>
                    ) : (
                      <p className="row-title" style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--ink-soft)' }}>Nothing yet</p>
                    )}
                  </span>
                  {head?.dish
                    ? <DishImage name={head.name} youtubeUrl={head.dish?.youtube_url} imageUrl={head.dish?.image_url} height={46} size="sm" style={{ width: 46, flexShrink: 0 }} />
                    : head
                      ? <DishImage name={head.name} height={46} size="sm" style={{ width: 46, flexShrink: 0 }} />
                      : <span className="word">Add</span>}
                </button>
                <div className="rule" />

                {/* Expanded day — both slots, options, lock, add */}
                {isOpen && (
                  <div style={{ padding: '4px 0 20px 56px' }}>
                    {SLOTS.map(({ key, label }) => {
                      const lock = lockFor(day, key)
                      const opts = optionsFor(day, key)
                      return (
                        <div key={key} style={{ paddingTop: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span className="label">{label}</span>
                            {lock
                              ? <button className="word word-quiet tap" onClick={() => unlockMeal(day, key)}>Unlock</button>
                              : <button className="word tap" onClick={() => setLockSheet({ slot: key, label, day })}>Choose</button>}
                          </div>

                          {lock && <p className="font-display" style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px', color: 'var(--ochre)' }}>{lock.dish_name}</p>}

                          {opts.length === 0 && !lock && <p className="tail" style={{ fontSize: 14 }}>No options on the rotation.</p>}

                          {opts.map((s: any) => (
                            <div key={s.id} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '5px 0' }}>
                              <button onClick={() => setEditingDish(s.dish)}
                                      style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }}>
                                <span className="font-display" style={{ fontSize: 17, fontWeight: 600 }}>{s.dish?.name}</span>
                                {s.dish?.meal_pairing && <span style={{ fontSize: 14, color: 'var(--ink-soft)' }}> · {s.dish.meal_pairing}</span>}
                              </button>
                              <button className="tap" aria-label="Remove" onClick={() => removeSlot(s.id)}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)', fontSize: 16, padding: 0 }}>×</button>
                            </div>
                          ))}

                          {adding?.day === day && adding?.slot === key ? (
                            <div style={{ paddingTop: 6 }}>
                              <input autoFocus className="field" value={newDish} onChange={e => setNewDish(e.target.value)}
                                     onKeyDown={e => e.key === 'Enter' && addDish()} placeholder="Dish name" />
                              {parsedIngredients.length > 0 && (
                                <p className="tail" style={{ fontSize: 14, paddingTop: 8 }}>{parsedIngredients.join(', ')}.</p>
                              )}
                              {parsing && <p className="tail" style={{ fontSize: 14, paddingTop: 8 }}>Reading the ingredients…</p>}
                              <div style={{ display: 'flex', gap: 10, paddingTop: 12 }}>
                                <button className="action-sm action-sm-solid" onClick={addDish} disabled={saving}>{saving ? 'Adding…' : 'Add'}</button>
                                <button className="action-sm" onClick={() => { setAdding(null); setNewDish(''); setParsedIngredients([]) }}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <button className="word word-quiet tap" style={{ marginTop: 8 }} onClick={() => setAdding({ day, slot: key })}>
                              Add to rotation
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ flex: 1, minHeight: 20 }} />

        {openNights > 0 && (
          <div style={{ paddingTop: 18 }}>
            <p className="tail" style={{ fontSize: 14 }}>
              {openNights} night{openNights !== 1 ? 's' : ''} open.{' '}
              <a href="/discover" className="word word-ink" style={{ fontSize: 14, letterSpacing: 0, textTransform: 'none', fontFamily: 'inherit' }}>
                Fill them from your rotation
              </a>
            </p>
          </div>
        )}
      </div>

      {editingDish && <DishEditSheet dish={editingDish} onSave={handleDishSaved} onClose={() => setEditingDish(null)} />}

      {lockSheet && (
        <LockSheet
          slot={lockSheet.slot}
          label={lockSheet.label}
          dayName={lockSheet.day}
          date={dateForDay(lockSheet.day)}
          allSlots={slots}
          onLock={(dish_name, dish_id) => lockMeal(lockSheet.day, lockSheet.slot, dish_name, dish_id)}
          onClose={() => setLockSheet(null)}
        />
      )}
    </div>
  )
}
