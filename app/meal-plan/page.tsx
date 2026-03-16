'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DailyLock } from '@/types'

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const SHORT: Record<string,string> = { monday:'Mon',tuesday:'Tue',wednesday:'Wed',thursday:'Thu',friday:'Fri',saturday:'Sat',sunday:'Sun' }

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

// ── Lock action sheet ─────────────────────────────────────────────────────────
function LockSheet({ slot, label, dayName, date, allSlots, locks, onLock, onClose }: {
  slot: string; label: string; dayName: string; date: string
  allSlots: any[]; locks: DailyLock[]
  onLock: (dish_name: string, dish_id?: string) => void
  onClose: () => void
}) {
  const router = useRouter()
  const [mode, setMode] = useState<'choose'|'thisDay'|'otherDay'|'manual'>('choose')
  const [manualDish, setManualDish] = useState('')
  const [otherDay, setOtherDay] = useState('')

  // Dishes on this day/slot from weekly plan
  const thisDayOptions = allSlots
    .filter(s => s.day === dayName && s.slot === slot)
    .map(s => s.dish)
    .filter(Boolean)

  // All unique dishes across the whole meal plan (for "other day" picker)
  const allDishes = Array.from(
    new Map(allSlots.map(s => [s.dish?.name, s.dish])).values()
  ).filter(Boolean) as any[]

  // Dishes from a specific other day
  const otherDayDishes = otherDay
    ? allSlots.filter(s => s.day === otherDay && s.slot === slot).map(s => s.dish).filter(Boolean)
    : []

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 430, margin: '0 auto',
        background: 'white', borderRadius: '24px 24px 0 0',
        padding: '20px 20px 40px', maxHeight: '85vh',
        display: 'flex', flexDirection: 'column'
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 99, margin: '0 auto 16px' }} />

        {mode === 'choose' && (
          <>
            <p className="font-display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
              🔒 Lock {label}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>
              {new Date(date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Option 1 — This week's menu */}
              <button onClick={() => setMode('thisDay')} style={{
                padding: '14px 16px', borderRadius: 14, border: '1.5px solid var(--border)',
                background: 'white', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12
              }}>
                <span style={{ fontSize: 22 }}>📋</span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>From this day's menu</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    {thisDayOptions.length} option{thisDayOptions.length !== 1 ? 's' : ''} on {SHORT[dayName]}
                  </p>
                </div>
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>›</span>
              </button>

              {/* Option 2 — Another day's menu */}
              <button onClick={() => setMode('otherDay')} style={{
                padding: '14px 16px', borderRadius: 14, border: '1.5px solid var(--border)',
                background: 'white', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12
              }}>
                <span style={{ fontSize: 22 }}>📅</span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>From another day's menu</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>Browse the full weekly rotation</p>
                </div>
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>›</span>
              </button>

              {/* Option 3 — Discover */}
              <button onClick={() => {
                onClose()
                router.push(`/discover?lockSlot=${slot}&lockDate=${date}`)
              }} style={{
                padding: '14px 16px', borderRadius: 14, border: '1.5px solid var(--border)',
                background: 'white', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12
              }}>
                <span style={{ fontSize: 22 }}>🍳</span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Discover something new</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>AI suggestions from your pantry</p>
                </div>
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>›</span>
              </button>

              {/* Option 4 — Manual */}
              <button onClick={() => setMode('manual')} style={{
                padding: '14px 16px', borderRadius: 14, border: '1.5px solid var(--border)',
                background: 'white', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12
              }}>
                <span style={{ fontSize: 22 }}>✏️</span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Type a dish name</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>One-time — won't add to weekly plan</p>
                </div>
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>›</span>
              </button>
            </div>
          </>
        )}

        {mode === 'thisDay' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <button onClick={() => setMode('choose')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)', padding: 0 }}>←</button>
              <p className="font-display" style={{ fontSize: 16, fontWeight: 700, margin: 0, textTransform: 'capitalize' }}>{SHORT[dayName]} · {label} options</p>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {thisDayOptions.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No dishes on this day's menu yet.</p>
              ) : thisDayOptions.map((dish: any) => (
                <button key={dish.id} onClick={() => onLock(dish.name, dish.id)} style={{
                  padding: '13px 14px', borderRadius: 12, border: '1.5px solid var(--border)',
                  background: 'white', cursor: 'pointer', textAlign: 'left'
                }}>
                  <p className="font-display" style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{dish.name}</p>
                  {dish.meal_pairing && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>{dish.meal_pairing}</p>}
                </button>
              ))}
            </div>
          </>
        )}

        {mode === 'otherDay' && !otherDay && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <button onClick={() => setMode('choose')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)', padding: 0 }}>←</button>
              <p className="font-display" style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Which day?</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {DAYS.filter(d => d !== dayName).map(d => (
                <button key={d} onClick={() => setOtherDay(d)} style={{
                  padding: '10px 6px', borderRadius: 10, border: '1px solid var(--border)',
                  background: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize'
                }}>{SHORT[d]}</button>
              ))}
            </div>
          </>
        )}

        {mode === 'otherDay' && otherDay && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <button onClick={() => setOtherDay('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)', padding: 0 }}>←</button>
              <p className="font-display" style={{ fontSize: 16, fontWeight: 700, margin: 0, textTransform: 'capitalize' }}>{SHORT[otherDay]} · {label} dishes</p>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {otherDayDishes.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No dishes on {SHORT[otherDay]}'s {slot} menu.</p>
              ) : otherDayDishes.map((dish: any) => (
                <button key={dish.id} onClick={() => onLock(dish.name, dish.id)} style={{
                  padding: '13px 14px', borderRadius: 12, border: '1.5px solid var(--border)',
                  background: 'white', cursor: 'pointer', textAlign: 'left'
                }}>
                  <p className="font-display" style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{dish.name}</p>
                  {dish.meal_pairing && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>{dish.meal_pairing}</p>}
                </button>
              ))}
            </div>
          </>
        )}

        {mode === 'manual' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <button onClick={() => setMode('choose')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)', padding: 0 }}>←</button>
              <p className="font-display" style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Type a dish name</p>
            </div>
            <input autoFocus value={manualDish} onChange={e => setManualDish(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && manualDish.trim() && onLock(manualDish.trim())}
              placeholder="e.g. Maggi, Leftover curry..."
              style={{ padding: '13px 14px', borderRadius: 12, border: '1.5px solid var(--green-mid)', fontSize: 15, outline: 'none', fontFamily: 'inherit', marginBottom: 10 }} />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>This just locks today's decision — it won't be added to your weekly rotation.</p>
            <button onClick={() => manualDish.trim() && onLock(manualDish.trim())} disabled={!manualDish.trim()} style={{
              padding: '13px', borderRadius: 12, border: 'none',
              background: manualDish.trim() ? 'var(--green-mid)' : 'var(--border)',
              color: manualDish.trim() ? 'white' : 'var(--text-muted)',
              fontSize: 14, fontWeight: 700, cursor: 'pointer'
            }}>🔒 Lock this dish</button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MealPlanPage() {
  const [slots, setSlots] = useState<any[]>([])
  const [locks, setLocks] = useState<DailyLock[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState(getTodayDayName())
  const [adding, setAdding] = useState<{ day: string; slot: string }|null>(null)
  const [newDish, setNewDish] = useState('')
  const [saving, setSaving] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parsedIngredients, setParsedIngredients] = useState<string[]>([])
  const [lockSheet, setLockSheet] = useState<{ slot: string; label: string }|null>(null)
  const todayName = getTodayDayName()

  useEffect(() => {
    Promise.all([
      fetch('/api/meal-plan').then(r => r.json()),
      fetch(`/api/locks?from=${todayISO()}&days=7`).then(r => r.json()),
    ]).then(([slotsData, locksData]) => {
      if (Array.isArray(slotsData)) setSlots(slotsData)
      if (Array.isArray(locksData)) setLocks(locksData)
      setLoading(false)
    })
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

  const daySlots = slots.filter(s => s.day === selectedDay)
  const selectedDate = dateForDay(selectedDay)

  function getLockForSlot(slot: string): DailyLock | undefined {
    return locks.find(l => l.lock_date === selectedDate && l.slot === slot)
  }

  async function lockMeal(slot: string, dish_name: string, dish_id?: string) {
    setLockSheet(null)
    const res = await fetch('/api/locks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lock_date: selectedDate, slot, dish_name, dish_id: dish_id || null })
    })
    const d = await res.json()
    if (!d.error) setLocks(p => [...p.filter(l => !(l.lock_date === selectedDate && l.slot === slot)), d])
  }

  async function unlockMeal(slot: string) {
    await fetch('/api/locks', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lock_date: selectedDate, slot })
    })
    setLocks(p => p.filter(l => !(l.lock_date === selectedDate && l.slot === slot)))
  }

  async function addDish() {
    if (!newDish.trim() || !adding) return
    setSaving(true)
    const res = await fetch('/api/meal-plan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day: adding.day, slot: adding.slot, dish_name: newDish.trim(), ingredients: parsedIngredients })
    })
    const d = await res.json()
    if (!d.error) setSlots(p => [...p, d])
    setNewDish(''); setParsedIngredients([]); setAdding(null); setSaving(false)
  }

  async function removeSlot(id: string) {
    await fetch('/api/meal-plan', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slot_id: id }) })
    setSlots(p => p.filter(s => s.id !== id))
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><span style={{ fontSize: 28 }}>🍽️</span></div>

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <div className="page-header">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Weekly Menu</p>
          <h1 className="font-display" style={{ color: 'white', fontSize: 24, fontWeight: 700, margin: 0 }}>Meal Plan</h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 }}>Tap 🔒 to decide what you're making</p>
        </div>
      </div>

      <div className="page-body" style={{ paddingTop: 0 }}>
        {/* Day selector */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '16px 0', marginBottom: 4 }}>
          {DAYS.map(day => {
            const date = dateForDay(day)
            const dayLocks = locks.filter(l => l.lock_date === date)
            const isToday = day === todayName
            const active = day === selectedDay
            return (
              <button key={day} onClick={() => setSelectedDay(day)} style={{
                flexShrink: 0, minWidth: 58, padding: '8px 10px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: active ? 'var(--green-mid)' : 'white',
                color: active ? 'white' : 'var(--text-secondary)',
                boxShadow: active ? '0 2px 8px rgba(45,106,79,0.3)' : 'var(--shadow)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3
              }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{SHORT[day]}</span>
                <span style={{ fontSize: 10, opacity: 0.7 }}>{isToday ? 'today' : ''}</span>
                {dayLocks.length > 0 && (
                  <span style={{ fontSize: 10, color: active ? 'rgba(255,255,255,0.8)' : 'var(--green-soft)', fontWeight: 700 }}>
                    {'🔒'.repeat(dayLocks.length)}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--green-deep)', margin: 0, textTransform: 'capitalize' }}>{selectedDay}</h2>
          {selectedDay === todayName && <span className="pill badge-good" style={{ fontSize: 11 }}>today</span>}
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </span>
        </div>

        {[
          { key: 'lunch', label: '☀️ Lunch', bg: '#FFFBEB' },
          { key: 'dinner', label: '🌙 Dinner', bg: '#F5F3FF' }
        ].map(({ key, label, bg }) => {
          const lock = getLockForSlot(key)
          const items = daySlots.filter(s => s.slot === key)

          return (
            <div key={key} className="card" style={{ marginBottom: 14, overflow: 'hidden' }}>
              {/* Slot header */}
              <div style={{ padding: '11px 14px', background: bg, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
                {!lock ? (
                  <button onClick={() => setLockSheet({ slot: key, label })} style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                    borderRadius: 99, border: 'none', background: 'var(--green-mid)', color: 'white',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer'
                  }}>🔒 Lock</button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green-deep)' }}>
                      🔒 {lock.dish_name}
                    </span>
                    {/* Unlock is right next to the locked name — labelled clearly */}
                    <button onClick={() => unlockMeal(key)} style={{
                      padding: '3px 10px', borderRadius: 99, border: '1px solid var(--green-soft)',
                      background: 'white', fontSize: 11, fontWeight: 600, color: 'var(--green-mid)', cursor: 'pointer'
                    }}>Unlock</button>
                  </div>
                )}
              </div>

              {/* Locked confirmation banner */}
              {lock && (
                <div style={{ padding: '10px 14px', background: 'var(--green-light)', borderBottom: '1px solid var(--green-soft)' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-deep)', margin: 0 }}>
                    Confirmed: {lock.dish_name}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--green-mid)', margin: '2px 0 0' }}>
                    Locked by {lock.locked_by_username}
                  </p>
                </div>
              )}

              <div style={{ padding: 12 }}>
                {/* Options list */}
                {items.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>No options yet</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                    {items.map((s: any) => {
                      const isLocked = lock?.dish_name === s.dish?.name
                      return (
                        <div key={s.id} style={{
                          padding: '10px 12px', borderRadius: 12, border: '1px solid',
                          borderColor: isLocked ? 'var(--green-soft)' : 'var(--border)',
                          background: isLocked ? 'var(--green-pale)' : 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}>
                          <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                            <p className="font-display" style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
                              {isLocked ? '🔒 ' : ''}{s.dish?.name}
                            </p>
                            {(s.dish?.meal_pairing || s.dish?.ingredients?.length > 0) && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                {s.dish?.meal_pairing && (
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>{s.dish.meal_pairing}</span>
                                )}
                                {!s.dish?.meal_pairing && s.dish?.ingredients?.slice(0, 3).map((ing: any) => (
                                  <span key={typeof ing === 'string' ? ing : ing.name} className="pill badge-good" style={{ fontSize: 10 }}>
                                    {typeof ing === 'string' ? ing : ing.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            {!lock && (
                              <button onClick={() => lockMeal(key, s.dish?.name, s.dish?.id)} style={{
                                padding: '5px 10px', borderRadius: 8, border: 'none',
                                background: 'var(--green-light)', color: 'var(--green-deep)',
                                fontSize: 11, fontWeight: 700, cursor: 'pointer'
                              }}>🔒</button>
                            )}
                            <button onClick={() => removeSlot(s.id)} style={{
                              background: 'none', border: 'none', color: 'var(--text-muted)',
                              cursor: 'pointer', fontSize: 16, padding: '0 2px'
                            }}>×</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Add to weekly plan */}
                {adding?.day === selectedDay && adding?.slot === key ? (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <input autoFocus value={newDish} onChange={e => setNewDish(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addDish()}
                          placeholder="Dish name..."
                          style={{ width: '100%', padding: '9px 32px 9px 12px', borderRadius: 10, border: '1.5px solid var(--green-mid)', fontSize: 14, outline: 'none', fontFamily: 'inherit', background: 'white' }} />
                        {parsing && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--green-soft)' }}>✨</span>}
                      </div>
                      <button onClick={addDish} disabled={saving} style={{ background: 'var(--green-mid)', color: 'white', border: 'none', padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        {saving ? '...' : 'Add'}
                      </button>
                      <button onClick={() => { setAdding(null); setNewDish(''); setParsedIngredients([]) }} style={{ background: 'none', border: '1px solid var(--border)', padding: '9px 12px', borderRadius: 10, fontSize: 13, cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
                    </div>
                    {parsedIngredients.length > 0 && (
                      <div style={{ padding: 10, background: 'var(--green-pale)', borderRadius: 10, border: '1px solid var(--green-light)' }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--green-mid)', marginBottom: 6 }}>✨ Key ingredients</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {parsedIngredients.map(ing => (
                            <span key={ing} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'white', border: '1px solid var(--green-light)', borderRadius: 99, fontSize: 12, fontWeight: 600, color: 'var(--green-deep)' }}>
                              {ing}
                              <button onClick={() => setParsedIngredients(p => p.filter(i => i !== ing))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, fontSize: 13, lineHeight: 1 }}>×</button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <button onClick={() => setAdding({ day: selectedDay, slot: key })} style={{
                    width: '100%', padding: '9px', borderRadius: 10, border: '1.5px dashed var(--green-light)',
                    background: 'none', color: 'var(--green-mid)', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                  }}>+ Add to weekly rotation</button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Lock sheet */}
      {lockSheet && (
        <LockSheet
          slot={lockSheet.slot}
          label={lockSheet.label}
          dayName={selectedDay}
          date={selectedDate}
          allSlots={slots}
          locks={locks}
          onLock={(dish_name, dish_id) => lockMeal(lockSheet.slot, dish_name, dish_id)}
          onClose={() => setLockSheet(null)}
        />
      )}
    </div>
  )
}
