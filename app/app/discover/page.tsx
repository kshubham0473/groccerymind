'use client'
import { useState } from 'react'

type Dish = {
  name: string
  description: string
  usesFromPantry: string[]
  needsToBuy: string[]
  prepTime: string
  mood: 'light' | 'hearty' | 'quick' | 'indulgent' | 'healthy'
}

const MOOD_CFG: Record<string, { emoji: string; color: string; bg: string }> = {
  light:     { emoji: '🌿', color: '#065F46', bg: '#D1FAE5' },
  hearty:    { emoji: '🍲', color: '#92400E', bg: '#FEF3C7' },
  quick:     { emoji: '⚡', color: '#1E40AF', bg: '#DBEAFE' },
  indulgent: { emoji: '✨', color: '#6B21A8', bg: '#F3E8FF' },
  healthy:   { emoji: '💚', color: '#065F46', bg: '#DCFCE7' },
}

const CARD_ROTATIONS = [-2.5, 1.5, -1, 2, -0.5]

export default function DiscoverPage() {
  const [dishes, setDishes] = useState<Dish[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null)
  const [addedDishes, setAddedDishes] = useState<Set<string>>(new Set())
  const [addingToDay, setAddingToDay] = useState<{ dish: Dish; day: string; slot: string } | null>(null)
  const [savingToMeal, setSavingToMeal] = useState(false)
  const [generated, setGenerated] = useState(false)

  const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']

  async function generate() {
    setLoading(true)
    setDishes([])
    setGenerated(false)
    try {
      const res = await fetch('/api/suggest/dish')
      const d = await res.json()
      setDishes(d.dishes || [])
      setGenerated(true)
    } finally {
      setLoading(false)
    }
  }

  async function addToMealPlan(dish: Dish, day: string, slot: string) {
    setSavingToMeal(true)
    await fetch('/api/meal-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        day, slot,
        dish_name: dish.name,
        ingredients: dish.usesFromPantry
      })
    })
    setAddedDishes(prev => new Set([...prev, dish.name]))
    setAddingToDay(null)
    setSelectedDish(null)
    setSavingToMeal(false)
  }

  async function addToOrderList(items: string[]) {
    for (const item of items) {
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_name: item, source: 'discover' })
      })
    }
  }

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      {/* ── Header ── */}
      <div className="page-header px-5 pt-10 pb-10">
        <div className="relative z-10">
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.55)' }}>Kitchen Discovery</p>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Lora, serif' }}>🍳 Discover Dishes</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>New ideas from your pantry</p>
        </div>
      </div>

      <div className="px-4 -mt-2 pb-8">

        {/* ── How it works ── */}
        {!generated && !loading && (
          <div className="kitchen-card-warm p-5 mb-5 animate-slide-up stagger-1">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>How it works</p>
            <div className="space-y-2">
              {[
                { icon: '🥬', text: 'Looks at what\'s currently in your pantry' },
                { icon: '🧠', text: 'Suggests dishes you can make with minimal shopping' },
                { icon: '📅', text: 'Add any dish directly to your meal plan' },
              ].map(({ icon, text }, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-lg w-7 text-center flex-shrink-0">{icon}</span>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Generate button ── */}
        <button onClick={generate} disabled={loading}
          className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95 mb-6 animate-slide-up stagger-2"
          style={{
            background: loading
              ? 'var(--green-soft)'
              : 'linear-gradient(135deg, var(--green-deep) 0%, var(--green-mid) 100%)',
            color: 'white',
            boxShadow: loading ? 'none' : '0 6px 20px rgba(27,67,50,0.35)',
            fontFamily: 'Lora, serif',
            letterSpacing: '0.3px'
          }}>
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-pulse">✨</span> Thinking about your pantry...
            </span>
          ) : generated ? '🔄 Generate new ideas' : '✨ Generate dish ideas'}
        </button>

        {/* ── Corkboard with recipe cards ── */}
        {loading && (
          <div className="corkboard p-6 animate-fade-in">
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="pin-card p-4" style={{ transform: `rotate(${CARD_ROTATIONS[i]}deg)` }}>
                  <div className="shimmer h-4 w-2/3 mb-2 mt-2" />
                  <div className="shimmer h-3 w-full mb-1" />
                  <div className="shimmer h-3 w-4/5" />
                </div>
              ))}
            </div>
            <p className="text-center text-xs font-semibold mt-4" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Scanning your pantry...
            </p>
          </div>
        )}

        {!loading && dishes.length > 0 && (
          <div className="corkboard p-5 animate-pop-in">
            <p className="text-xs font-bold uppercase tracking-widest mb-4 text-center" style={{ color: 'rgba(255,255,255,0.7)' }}>
              📌 Pinned for you · {dishes.length} ideas
            </p>
            <div className="space-y-4">
              {dishes.map((dish, i) => {
                const moodCfg = MOOD_CFG[dish.mood] || MOOD_CFG.light
                const isAdded = addedDishes.has(dish.name)
                return (
                  <div key={dish.name} className="pin-card p-4 pt-5"
                    style={{
                      transform: `rotate(${CARD_ROTATIONS[i % CARD_ROTATIONS.length]}deg)`,
                      opacity: isAdded ? 0.55 : 1,
                      transition: 'all 0.3s ease'
                    }}>
                    {/* Mood tag */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: moodCfg.bg, color: moodCfg.color }}>
                        {moodCfg.emoji} {dish.mood}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                        ⏱ {dish.prepTime}
                      </span>
                    </div>

                    <h3 className="font-bold text-base mb-1" style={{ fontFamily: 'Lora, serif', color: 'var(--text-primary)' }}>
                      {isAdded && '✓ '}{dish.name}
                    </h3>
                    <p className="text-xs mb-3 leading-relaxed italic" style={{ color: 'var(--text-secondary)' }}>
                      {dish.description}
                    </p>

                    {/* From pantry */}
                    <div className="mb-2">
                      <p className="text-xs font-bold mb-1" style={{ color: 'var(--green-mid)' }}>✅ From your pantry</p>
                      <div className="flex flex-wrap gap-1">
                        {dish.usesFromPantry.map(ing => (
                          <span key={ing} className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: 'var(--green-light)', color: 'var(--green-deep)' }}>
                            {ing}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Needs to buy */}
                    {dish.needsToBuy.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-bold mb-1" style={{ color: 'var(--amber)' }}>🛒 Need to buy</p>
                        <div className="flex flex-wrap gap-1">
                          {dish.needsToBuy.map(ing => (
                            <span key={ing} className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: 'var(--amber-light)', color: '#92400E' }}>
                              {ing}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {!isAdded ? (
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => setSelectedDish(dish)}
                          className="flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                          style={{ background: 'var(--green-mid)', color: 'white', boxShadow: '0 2px 8px rgba(45,106,79,0.3)' }}>
                          📅 Add to meal plan
                        </button>
                        {dish.needsToBuy.length > 0 && (
                          <button onClick={() => addToOrderList(dish.needsToBuy)}
                            className="py-2 px-3 rounded-xl text-xs font-bold border transition-all active:scale-95"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'white' }}>
                            🛒
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs font-bold text-center mt-2" style={{ color: 'var(--green-soft)' }}>
                        Added to meal plan ✓
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Meal plan picker sheet ── */}
      {selectedDish && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSelectedDish(null)}>
          <div className="w-full max-w-lg mx-auto" onClick={e => e.stopPropagation()}>
            <div className="kitchen-card rounded-b-none rounded-t-3xl p-6 animate-slide-up">
              <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'var(--border)' }} />
              <h3 className="text-lg font-bold mb-1" style={{ fontFamily: 'Lora, serif' }}>
                Add "{selectedDish.name}" to...
              </h3>
              <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>Choose a day and meal slot</p>

              {addingToDay ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                    {addingToDay.day.charAt(0).toUpperCase() + addingToDay.day.slice(1)} · which slot?
                  </p>
                  {[{ slot: 'lunch', label: '☀️ Lunch' }, { slot: 'dinner', label: '🌙 Dinner' }].map(({ slot, label }) => (
                    <button key={slot} disabled={savingToMeal}
                      onClick={() => addToMealPlan(selectedDish, addingToDay.day, slot)}
                      className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95"
                      style={{ background: 'var(--green-light)', color: 'var(--green-deep)' }}>
                      {savingToMeal ? 'Saving...' : label}
                    </button>
                  ))}
                  <button onClick={() => setAddingToDay(null)}
                    className="w-full py-2 text-sm"
                    style={{ color: 'var(--text-muted)' }}>← Back</button>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {DAYS.map(day => (
                    <button key={day} onClick={() => setAddingToDay({ dish: selectedDish, day, slot: '' })}
                      className="py-2.5 rounded-xl border text-xs font-bold capitalize transition-all active:scale-95"
                      style={{ borderColor: 'var(--border)', background: 'var(--warm-white)', color: 'var(--text-secondary)' }}>
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
