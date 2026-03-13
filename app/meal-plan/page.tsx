'use client'
import { useEffect, useState } from 'react'

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const SHORT: Record<string,string> = { monday:'Mon',tuesday:'Tue',wednesday:'Wed',thursday:'Thu',friday:'Fri',saturday:'Sat',sunday:'Sun' }
const FULL: Record<string,string>  = { monday:'Monday',tuesday:'Tuesday',wednesday:'Wednesday',thursday:'Thursday',friday:'Friday',saturday:'Saturday',sunday:'Sunday' }

export default function MealPlanPage() {
  const [slots, setSlots] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const todayKey = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date().getDay()]
  const [selectedDay, setSelectedDay] = useState(todayKey)
  const [adding, setAdding] = useState<{ day: string; slot: string }|null>(null)
  const [newDish, setNewDish] = useState('')
  const [saving, setSaving] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parsedIngredients, setParsedIngredients] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/meal-plan').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setSlots(d)
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
        </div>
      </div>

      <div style={{ padding: '0 16px 24px' }}>
        {/* Day selector */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '16px 0', marginBottom: 4 }}>
          {DAYS.map(day => {
            const active = day === selectedDay
            const isToday = day === todayKey
            const count = slots.filter(s => s.day === day).length
            return (
              <button key={day} onClick={() => setSelectedDay(day)} style={{
                flexShrink: 0, minWidth: 56, padding: '8px 10px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: active ? 'var(--green-mid)' : 'white',
                color: active ? 'white' : 'var(--text-secondary)',
                boxShadow: active ? '0 2px 8px rgba(45,106,79,0.3)' : 'var(--shadow)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2
              }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{SHORT[day]}</span>
                <span style={{ fontSize: 10, opacity: 0.7 }}>{isToday ? 'today' : `${count}d`}</span>
              </button>
            )
          })}
        </div>

        <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--green-deep)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          {FULL[selectedDay]}
          {selectedDay === todayKey && <span className="pill badge-good" style={{ fontSize: 11 }}>today</span>}
        </h2>

        {[{ key: 'lunch', label: '☀️ Lunch', items: lunch, bg: '#FFFBEB' },
          { key: 'dinner', label: '🌙 Dinner', items: dinner, bg: '#F5F3FF' }
        ].map(({ key, label, items, bg }) => (
          <div key={key} className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
            <div style={{ padding: '11px 16px', background: bg, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
              <span className="pill" style={{ background: 'white', color: 'var(--text-secondary)', border: '1px solid var(--border)', fontSize: 11 }}>
                {items.length} option{items.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ padding: 12 }}>
              {items.map((s: any) => (
                <div key={s.id} className="card" style={{ padding: '10px 12px', marginBottom: 8, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', boxShadow: 'none', borderLeft: '3px solid var(--green-soft)' }}>
                  <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                    <p className="font-display" style={{ fontSize: 14, fontWeight: 600 }}>{s.dish?.name}</p>
                    {s.dish?.ingredients?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                        {s.dish.ingredients.slice(0, 4).map((ing: string) => (
                          <span key={ing} className="pill badge-good" style={{ fontSize: 11 }}>{ing}</span>
                        ))}
                        {s.dish.ingredients.length > 4 && (
                          <span className="pill" style={{ background: 'var(--border)', color: 'var(--text-muted)', fontSize: 11 }}>+{s.dish.ingredients.length - 4}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <button onClick={() => removeSlot(s.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: '0 2px', flexShrink: 0 }}>×</button>
                </div>
              ))}
              {items.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>No options yet</p>
              )}
              {adding?.day === selectedDay && adding?.slot === key ? (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input autoFocus value={newDish} onChange={e => setNewDish(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addDish()}
                        placeholder="Dish name..." style={{
                          width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid var(--green-mid)',
                          fontSize: 14, outline: 'none', fontFamily: 'inherit', background: 'white'
                        }} />
                      {parsing && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--green-soft)' }}>✨</span>}
                    </div>
                    <button onClick={addDish} disabled={saving} style={{ background: 'var(--green-mid)', color: 'white', border: 'none', padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {saving ? '...' : 'Add'}
                    </button>
                    <button onClick={() => { setAdding(null); setNewDish(''); setParsedIngredients([]) }} style={{ background: 'none', border: '1px solid var(--border)', padding: '9px 12px', borderRadius: 10, fontSize: 13, cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
                  </div>
                  {parsedIngredients.length > 0 && (
                    <div style={{ padding: 12, background: 'var(--green-pale)', borderRadius: 10, border: '1px solid var(--green-light)' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--green-mid)', marginBottom: 8 }}>✨ Ingredients detected</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
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
                  width: '100%', padding: '9px', marginTop: 4, borderRadius: 10, border: '1.5px dashed var(--green-light)',
                  background: 'none', color: 'var(--green-mid)', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                }}>+ Add option</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
