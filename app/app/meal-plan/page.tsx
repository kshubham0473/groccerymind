'use client'
import { useEffect, useState } from 'react'

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const DAY_SHORT: Record<string,string> = { monday:'Mon',tuesday:'Tue',wednesday:'Wed',thursday:'Thu',friday:'Fri',saturday:'Sat',sunday:'Sun' }
const DAY_FULL: Record<string,string>  = { monday:'Monday',tuesday:'Tuesday',wednesday:'Wednesday',thursday:'Thursday',friday:'Friday',saturday:'Saturday',sunday:'Sunday' }

export default function MealPlanPage() {
  const [slots, setSlots] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState(() => {
    return ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date().getDay()]
  })
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
        const res = await fetch('/api/suggest/ingredients', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dish_name: newDish.trim() })
        })
        const d = await res.json()
        if (d.ingredients?.length) setParsedIngredients(d.ingredients)
      } finally { setParsing(false) }
    }, 800)
    return () => clearTimeout(t)
  }, [newDish])

  const daySlots = slots.filter(s => s.day === selectedDay)
  const lunch  = daySlots.filter(s => s.slot === 'lunch')
  const dinner = daySlots.filter(s => s.slot === 'dinner')
  const todayKey = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date().getDay()]

  async function addDish() {
    if (!newDish.trim() || !adding) return
    setSaving(true)
    const res = await fetch('/api/meal-plan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day: adding.day, slot: adding.slot, dish_name: newDish.trim(), ingredients: parsedIngredients })
    })
    const d = await res.json()
    if (!d.error) setSlots(prev => [...prev, d])
    setNewDish(''); setParsedIngredients([]); setAdding(null); setSaving(false)
  }

  async function removeSlot(id: string) {
    await fetch('/api/meal-plan', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slot_id: id }) })
    setSlots(prev => prev.filter(s => s.id !== id))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-3xl" style={{ animation: 'wiggle 1s ease infinite' }}>🍽️</div>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      {/* ── Header — chalkboard style ── */}
      <div className="page-header px-5 pt-10 pb-10">
        <div className="relative z-10">
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.55)' }}>Weekly Menu</p>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Lora, serif' }}>📋 Meal Plan</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>
            {slots.length} dishes across {DAYS.length} days
          </p>
        </div>
      </div>

      <div className="px-4 -mt-2 pb-8">
        {/* ── Day selector ── */}
        <div className="flex gap-2 overflow-x-auto py-4 -mx-4 px-4">
          {DAYS.map(day => {
            const isToday = day === todayKey
            const active = day === selectedDay
            const daySlotCount = slots.filter(s => s.day === day).length
            return (
              <button key={day} onClick={() => setSelectedDay(day)}
                className="flex-shrink-0 flex flex-col items-center px-3 py-2.5 rounded-2xl border transition-all"
                style={{
                  background: active ? 'var(--green-mid)' : isToday ? 'var(--green-pale)' : 'white',
                  color: active ? 'white' : isToday ? 'var(--green-mid)' : 'var(--text-secondary)',
                  borderColor: active ? 'var(--green-mid)' : isToday ? 'var(--green-light)' : 'var(--border)',
                  minWidth: '54px',
                  boxShadow: active ? '0 4px 12px rgba(45,106,79,0.3)' : 'var(--shadow-sm)'
                }}>
                <span className="text-xs font-bold">{DAY_SHORT[day]}</span>
                <span className="text-xs mt-0.5" style={{ opacity: 0.7 }}>
                  {isToday ? 'today' : `${daySlotCount}d`}
                </span>
              </button>
            )
          })}
        </div>

        {/* ── Day title ── */}
        <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Lora, serif', color: 'var(--green-deep)' }}>
          {DAY_FULL[selectedDay]}
          {selectedDay === todayKey && (
            <span className="ml-2 text-sm font-normal pill" style={{ background: 'var(--green-light)', color: 'var(--green-deep)', verticalAlign: 'middle' }}>today</span>
          )}
        </h2>

        {/* ── Meal slots ── */}
        {[{ label: '☀️ Lunch', key: 'lunch', items: lunch, bg: '#FFFBEB' },
          { label: '🌙 Dinner', key: 'dinner', items: dinner, bg: '#F0F4FF' }
        ].map(({ label, key, items, bg }) => (
          <div key={key} className="kitchen-card mb-4 overflow-hidden">
            {/* Slot header */}
            <div className="px-5 py-3.5 flex items-center justify-between border-b" style={{ borderColor: 'var(--border)', background: bg }}>
              <h3 className="font-bold text-sm" style={{ fontFamily: 'Lora, serif' }}>{label}</h3>
              <span className="pill text-xs" style={{ background: 'white', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                {items.length} option{items.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Recipe cards */}
            <div className="p-4 space-y-2">
              {items.map((s: any) => (
                <div key={s.id} className="recipe-card group p-3.5 flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm" style={{ fontFamily: 'Lora, serif' }}>{s.dish?.name}</p>
                    {s.dish?.ingredients?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {s.dish.ingredients.slice(0, 4).map((ing: string) => (
                          <span key={ing} className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: 'var(--green-light)', color: 'var(--green-deep)', fontWeight: 600 }}>
                            {ing}
                          </span>
                        ))}
                        {s.dish.ingredients.length > 4 && (
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
                            +{s.dish.ingredients.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <button onClick={() => removeSlot(s.id)}
                    className="opacity-0 group-hover:opacity-100 ml-2 p-1.5 rounded-lg transition-all flex-shrink-0"
                    style={{ color: 'var(--red-soft)', background: '#FEE2E2' }}>✕</button>
                </div>
              ))}

              {items.length === 0 && (
                <p className="text-sm py-2 text-center" style={{ color: 'var(--text-muted)' }}>
                  No options yet
                </p>
              )}

              {/* Add form */}
              {adding?.day === selectedDay && adding?.slot === key ? (
                <div className="space-y-2 pt-1">
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input autoFocus value={newDish} onChange={e => setNewDish(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addDish()}
                        placeholder="Dish name..."
                        className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                        style={{ borderColor: 'var(--green-mid)', fontFamily: 'Nunito' }} />
                      {parsing && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs animate-pulse"
                          style={{ color: 'var(--green-soft)' }}>✨</span>
                      )}
                    </div>
                    <button onClick={addDish} disabled={saving}
                      className="px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
                      style={{ background: 'var(--green-mid)', color: 'white' }}>
                      {saving ? '...' : 'Add'}
                    </button>
                    <button onClick={() => { setAdding(null); setNewDish(''); setParsedIngredients([]) }}
                      className="px-3 py-2 rounded-xl text-sm border"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>✕</button>
                  </div>
                  {parsedIngredients.length > 0 && (
                    <div className="p-3 rounded-xl" style={{ background: 'var(--green-pale)', border: '1px solid var(--green-light)' }}>
                      <p className="text-xs font-bold mb-2" style={{ color: 'var(--green-mid)' }}>✨ Ingredients detected</p>
                      <div className="flex flex-wrap gap-1">
                        {parsedIngredients.map(ing => (
                          <span key={ing} className="text-xs px-2 py-1 rounded-full flex items-center gap-1"
                            style={{ background: 'white', color: 'var(--green-deep)', border: '1px solid var(--green-light)', fontWeight: 600 }}>
                            {ing}
                            <button onClick={() => setParsedIngredients(p => p.filter(i => i !== ing))}
                              style={{ color: 'var(--text-muted)', marginLeft: 2 }}>×</button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={() => setAdding({ day: selectedDay, slot: key })}
                  className="w-full py-2.5 rounded-xl text-sm font-bold border-2 border-dashed transition-all"
                  style={{ borderColor: 'var(--green-light)', color: 'var(--green-mid)' }}>
                  + Add option
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
