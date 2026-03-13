'use client'
import { useEffect, useState } from 'react'
import { DailyLock } from '@/types'

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const SHORT: Record<string,string> = { monday:'Mon',tuesday:'Tue',wednesday:'Wed',thursday:'Thu',friday:'Fri',saturday:'Sat',sunday:'Sun' }

function todayISO() {
  const d = new Date(); return d.toISOString().split('T')[0]
}
function dateForDay(dayName: string): string {
  const today = new Date()
  const todayIdx = today.getDay() // 0=sun
  const dayIdx = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].indexOf(dayName)
  const diff = (dayIdx - todayIdx + 7) % 7
  const target = new Date(today)
  target.setDate(today.getDate() + diff)
  return target.toISOString().split('T')[0]
}
function getTodayDayName() {
  return ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date().getDay()]
}

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
  const [lockingSlot, setLockingSlot] = useState<string|null>(null)
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
  const lunch = daySlots.filter(s => s.slot === 'lunch')
  const dinner = daySlots.filter(s => s.slot === 'dinner')
  const selectedDate = dateForDay(selectedDay)
  const isLockable = ['today', '0','1','2'].includes('') || true // lockable for any day up to 3 from today

  function getLockForSlot(slot: string): DailyLock | undefined {
    return locks.find(l => l.lock_date === selectedDate && l.slot === slot)
  }

  async function lockMeal(slot: string, dish_name: string, dish_id?: string) {
    setLockingSlot(slot)
    const res = await fetch('/api/locks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lock_date: selectedDate, slot, dish_name, dish_id: dish_id || null })
    })
    const d = await res.json()
    if (!d.error) setLocks(p => [...p.filter(l => !(l.lock_date === selectedDate && l.slot === slot)), d])
    setLockingSlot(null)
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
    const res = await fetch('/api/meal-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ day: adding.day, slot: adding.slot, dish_name: newDish.trim(), ingredients: parsedIngredients }) })
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
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 }}>🔒 Lock a dish to confirm the day's decision</p>
        </div>
      </div>

      <div style={{ padding: '0 16px 24px' }}>
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
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>{new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
        </div>

        {[{ key: 'lunch', label: '☀️ Lunch', items: lunch, bg: '#FFFBEB' },
          { key: 'dinner', label: '🌙 Dinner', items: dinner, bg: '#F5F3FF' }
        ].map(({ key, label, items, bg }) => {
          const lock = getLockForSlot(key)
          return (
            <div key={key} className="card" style={{ marginBottom: 14, overflow: 'hidden' }}>
              {/* Slot header */}
              <div style={{ padding: '11px 14px', background: bg, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
                {lock ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--green-deep)', fontWeight: 700 }}>🔒 {lock.dish_name}</span>
                    <button onClick={() => unlockMeal(key)} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 4px' }}>unlock</button>
                  </div>
                ) : (
                  <span className="pill" style={{ background: 'white', color: 'var(--text-muted)', border: '1px solid var(--border)', fontSize: 11 }}>
                    {items.length} option{items.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Locked banner */}
              {lock && (
                <div style={{ padding: '10px 14px', background: 'var(--green-light)', borderBottom: '1px solid var(--green-soft)' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-deep)', margin: 0 }}>
                    🔒 Confirmed: {lock.dish_name}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--green-mid)', margin: '2px 0 0' }}>
                    Locked by {lock.locked_by_username} · decision made
                  </p>
                </div>
              )}

              <div style={{ padding: 12 }}>
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
                            {s.dish?.ingredients?.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                                {s.dish.ingredients.slice(0, 4).map((ing: string) => (
                                  <span key={ing} className="pill badge-good" style={{ fontSize: 10 }}>{ing}</span>
                                ))}
                                {s.dish.ingredients.length > 4 && (
                                  <span className="pill" style={{ background: 'var(--border)', color: 'var(--text-muted)', fontSize: 10 }}>+{s.dish.ingredients.length - 4}</span>
                                )}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            {!lock && (
                              <button onClick={() => lockMeal(key, s.dish?.name, s.dish?.id)} disabled={lockingSlot === key} style={{
                                padding: '5px 10px', borderRadius: 8, border: 'none',
                                background: 'var(--green-mid)', color: 'white',
                                fontSize: 11, fontWeight: 700, cursor: 'pointer'
                              }}>
                                {lockingSlot === key ? '...' : '🔒 Lock'}
                              </button>
                            )}
                            <button onClick={() => removeSlot(s.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: '0 2px' }}>×</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Add dish input */}
                {adding?.day === selectedDay && adding?.slot === key ? (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <input autoFocus value={newDish} onChange={e => setNewDish(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addDish()}
                          placeholder="Dish name..." style={{
                            width: '100%', padding: '9px 32px 9px 12px', borderRadius: 10,
                            border: '1.5px solid var(--green-mid)', fontSize: 14, outline: 'none', fontFamily: 'inherit', background: 'white'
                          }} />
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
                  }}>+ Add option</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
