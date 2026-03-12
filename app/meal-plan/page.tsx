'use client'
import { useEffect, useState } from 'react'

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const DAY_LABELS: Record<string, string> = {
  monday:'Mon', tuesday:'Tue', wednesday:'Wed',
  thursday:'Thu', friday:'Fri', saturday:'Sat', sunday:'Sun'
}
const DAY_FULL: Record<string, string> = {
  monday:'Monday', tuesday:'Tuesday', wednesday:'Wednesday',
  thursday:'Thursday', friday:'Friday', saturday:'Saturday', sunday:'Sunday'
}

export default function MealPlanPage() {
  const [slots, setSlots] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState(() => {
    const d = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
    return d[new Date().getDay()]
  })
  const [adding, setAdding] = useState<{ day: string; slot: string } | null>(null)
  const [newDish, setNewDish] = useState('')
  const [saving, setSaving] = useState(false)
  const [parsingIngredients, setParsingIngredients] = useState(false)
  const [parsedIngredients, setParsedIngredients] = useState<string[]>([])
  const [showIngredients, setShowIngredients] = useState(false)

  useEffect(() => {
    fetch('/api/meal-plan').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setSlots(data)
      setLoading(false)
    })
  }, [])

  // Auto-parse ingredients when dish name is entered (debounced)
  useEffect(() => {
    if (!newDish.trim() || newDish.length < 3) { setParsedIngredients([]); setShowIngredients(false); return }
    const timer = setTimeout(async () => {
      setParsingIngredients(true)
      try {
        const res = await fetch('/api/suggest/ingredients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dish_name: newDish.trim() })
        })
        const data = await res.json()
        if (data.ingredients?.length) {
          setParsedIngredients(data.ingredients)
          setShowIngredients(true)
        }
      } finally {
        setParsingIngredients(false)
      }
    }, 800)
    return () => clearTimeout(timer)
  }, [newDish])

  const daySlots = slots.filter(s => s.day === selectedDay)
  const lunch = daySlots.filter(s => s.slot === 'lunch')
  const dinner = daySlots.filter(s => s.slot === 'dinner')

  async function addDish() {
    if (!newDish.trim() || !adding) return
    setSaving(true)
    const res = await fetch('/api/meal-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day: adding.day, slot: adding.slot, dish_name: newDish.trim(), ingredients: parsedIngredients })
    })
    const data = await res.json()
    if (!data.error) setSlots(prev => [...prev, data])
    setNewDish('')
    setParsedIngredients([])
    setShowIngredients(false)
    setAdding(null)
    setSaving(false)
  }

  async function removeSlot(slotId: string) {
    await fetch('/api/meal-plan', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot_id: slotId })
    })
    setSlots(prev => prev.filter(s => s.id !== slotId))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-2xl animate-bounce">🥗</div>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto px-4 py-6 animate-slide-up">
      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Playfair Display', color: 'var(--green-deep)' }}>
        Meal Plan
      </h1>
      <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>Your weekly menu</p>

      {/* Day selector */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 -mx-4 px-4">
        {DAYS.map(day => {
          const isToday = day === ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date().getDay()]
          const active = day === selectedDay
          return (
            <button key={day} onClick={() => setSelectedDay(day)}
              className="flex-shrink-0 flex flex-col items-center px-3.5 py-2.5 rounded-2xl border transition-all text-sm font-medium"
              style={{
                background: active ? 'var(--green-mid)' : isToday ? 'var(--green-pale)' : 'white',
                color: active ? 'white' : isToday ? 'var(--green-mid)' : 'var(--text-secondary)',
                borderColor: active ? 'var(--green-mid)' : isToday ? 'var(--green-light)' : 'var(--border)',
                minWidth: '52px'
              }}>
              <span className="text-xs">{DAY_LABELS[day]}</span>
              {isToday && <span className="text-xs mt-0.5" style={{ opacity: active ? 0.8 : 0.6 }}>today</span>}
            </button>
          )
        })}
      </div>

      <h2 className="text-xl font-semibold mb-4" style={{ fontFamily: 'Playfair Display', color: 'var(--green-deep)' }}>
        {DAY_FULL[selectedDay]}
      </h2>

      {[{ label: '☀️ Lunch', key: 'lunch', items: lunch }, { label: '🌙 Dinner', key: 'dinner', items: dinner }].map(({ label, key, items }) => (
        <div key={key} className="kitchen-card p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-base">{label}</h3>
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--green-light)', color: 'var(--green-deep)' }}>
              {items.length} option{items.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-2 mb-3">
            {items.map((s: any) => (
              <div key={s.id} className="group flex items-start justify-between p-3 rounded-xl"
                style={{ background: 'var(--warm-white)' }}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{s.dish?.name}</p>
                  {s.dish?.ingredients?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {s.dish.ingredients.slice(0, 5).map((ing: string) => (
                        <span key={ing} className="text-xs px-1.5 py-0.5 rounded-full"
                          style={{ background: 'var(--green-light)', color: 'var(--green-deep)' }}>
                          {ing}
                        </span>
                      ))}
                      {s.dish.ingredients.length > 5 && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
                          +{s.dish.ingredients.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button onClick={() => removeSlot(s.id)}
                  className="opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded-lg ml-2 flex-shrink-0 transition-all"
                  style={{ color: 'var(--red-soft)', background: '#FFF0F0' }}>
                  ✕
                </button>
              </div>
            ))}
            {items.length === 0 && (
              <p className="text-sm py-2" style={{ color: 'var(--text-muted)' }}>No options yet — add one below</p>
            )}
          </div>

          {adding?.day === selectedDay && adding?.slot === key ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    autoFocus
                    value={newDish}
                    onChange={e => setNewDish(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addDish()}
                    placeholder="Dish name..."
                    className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                    style={{ borderColor: 'var(--green-mid)', background: 'white' }}
                  />
                  {parsingIngredients && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs animate-pulse"
                      style={{ color: 'var(--green-soft)' }}>✨ parsing...</span>
                  )}
                </div>
                <button onClick={addDish} disabled={saving}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
                  style={{ background: 'var(--green-mid)', color: 'white' }}>
                  {saving ? '...' : 'Add'}
                </button>
                <button onClick={() => { setAdding(null); setNewDish(''); setParsedIngredients([]); setShowIngredients(false) }}
                  className="px-3 py-2 rounded-xl text-sm border transition-all"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  ✕
                </button>
              </div>

              {/* Parsed ingredients preview */}
              {showIngredients && parsedIngredients.length > 0 && (
                <div className="p-3 rounded-xl" style={{ background: 'var(--green-pale)', border: '1px solid var(--green-light)' }}>
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--green-mid)' }}>
                    ✨ Ingredients auto-detected
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {parsedIngredients.map(ing => (
                      <span key={ing} className="text-xs px-2 py-1 rounded-full flex items-center gap-1"
                        style={{ background: 'white', color: 'var(--green-deep)', border: '1px solid var(--green-light)' }}>
                        {ing}
                        <button onClick={() => setParsedIngredients(prev => prev.filter(i => i !== ing))}
                          style={{ color: 'var(--text-muted)' }}>×</button>
                      </span>
                    ))}
                  </div>
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                    Tap × to remove any ingredient before saving
                  </p>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => setAdding({ day: selectedDay, slot: key })}
              className="w-full py-2 rounded-xl text-sm font-medium border-2 border-dashed transition-all"
              style={{ borderColor: 'var(--green-light)', color: 'var(--green-mid)' }}>
              + Add option
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
