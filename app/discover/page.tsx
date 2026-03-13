'use client'
import { useState } from 'react'

type Dish = { name: string; description: string; usesFromPantry: string[]; needsToBuy: string[]; prepTime: string; mood: string }
const MOOD_COLORS: Record<string, { bg: string; color: string }> = {
  light: { bg: '#D1FAE5', color: '#065F46' }, hearty: { bg: '#FEF3C7', color: '#92400E' },
  quick: { bg: '#DBEAFE', color: '#1E40AF' }, indulgent: { bg: '#F3E8FF', color: '#6B21A8' },
  healthy: { bg: '#DCFCE7', color: '#166534' }
}
const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']

export default function DiscoverPage() {
  const [dishes, setDishes] = useState<Dish[]>([])
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [selectedDish, setSelectedDish] = useState<Dish|null>(null)
  const [addedDishes, setAddedDishes] = useState<Set<string>>(new Set())
  const [pickingSlot, setPickingSlot] = useState<{ dish: Dish; day: string }|null>(null)
  const [saving, setSaving] = useState(false)

  async function generate() {
    setLoading(true); setDishes([])
    try {
      const res = await fetch('/api/suggest/dish')
      const d = await res.json()
      setDishes(d.dishes || []); setGenerated(true)
    } finally { setLoading(false) }
  }

  async function addToMealPlan(dish: Dish, day: string, slot: string) {
    setSaving(true)
    await fetch('/api/meal-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ day, slot, dish_name: dish.name, ingredients: dish.usesFromPantry }) })
    setAddedDishes(p => new Set([...p, dish.name])); setPickingSlot(null); setSelectedDish(null); setSaving(false)
  }

  async function addToOrder(items: string[]) {
    for (const item of items) {
      await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_name: item, source: 'discover' }) })
    }
  }

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <div className="page-header">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Kitchen Discovery</p>
          <h1 className="font-display" style={{ color: 'white', fontSize: 24, fontWeight: 700, margin: 0 }}>Discover Dishes</h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 2 }}>New ideas from your pantry</p>
        </div>
      </div>

      <div style={{ padding: '16px 16px 24px' }}>
        {/* How it works - only before first generate */}
        {!generated && !loading && (
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12, letterSpacing: '0.08em' }}>How it works</p>
            {[
              { icon: '🥬', text: 'Scans what\'s in your pantry right now' },
              { icon: '🧠', text: 'Suggests dishes you can cook with minimal shopping' },
              { icon: '📅', text: 'Add any dish directly to your meal plan' },
            ].map(({ icon, text }, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < 2 ? 10 : 0 }}>
                <span style={{ fontSize: 18, width: 28, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{text}</p>
              </div>
            ))}
          </div>
        )}

        <button onClick={generate} disabled={loading} style={{
          width: '100%', padding: '14px', borderRadius: 14, border: 'none', cursor: 'pointer',
          background: loading ? 'var(--green-soft)' : 'var(--green-mid)', color: 'white',
          fontSize: 15, fontWeight: 700, marginBottom: 16,
          boxShadow: loading ? 'none' : '0 4px 12px rgba(45,106,79,0.3)'
        }}>
          {loading ? '✨ Scanning your pantry...' : generated ? '🔄 Generate new ideas' : '✨ Generate dish ideas'}
        </button>

        {/* Loading skeletons */}
        {loading && [1,2,3].map(i => (
          <div key={i} className="card" style={{ padding: 16, marginBottom: 10 }}>
            <div className="skeleton" style={{ height: 14, width: '60%', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 11, width: '90%', marginBottom: 6 }} />
            <div className="skeleton" style={{ height: 11, width: '70%' }} />
          </div>
        ))}

        {/* Dish cards */}
        {!loading && dishes.map((dish, i) => {
          const mood = MOOD_COLORS[dish.mood] || MOOD_COLORS.light
          const isAdded = addedDishes.has(dish.name)
          return (
            <div key={dish.name} className="card" style={{ marginBottom: 10, overflow: 'hidden', opacity: isAdded ? 0.55 : 1 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: mood.bg, color: mood.color }}>
                  {dish.mood}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>⏱ {dish.prepTime}</span>
              </div>
              <div style={{ padding: 16 }}>
                <p className="font-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{isAdded ? '✓ ' : ''}{dish.name}</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: 12, lineHeight: 1.5 }}>{dish.description}</p>

                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--green-mid)', marginBottom: 6 }}>✅ From your pantry</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {dish.usesFromPantry.map(ing => (
                      <span key={ing} style={{ padding: '3px 9px', borderRadius: 99, fontSize: 12, fontWeight: 600, background: 'var(--green-light)', color: 'var(--green-deep)' }}>{ing}</span>
                    ))}
                  </div>
                </div>

                {dish.needsToBuy.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)', marginBottom: 6 }}>🛒 Need to buy</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {dish.needsToBuy.map(ing => (
                        <span key={ing} style={{ padding: '3px 9px', borderRadius: 99, fontSize: 12, fontWeight: 600, background: 'var(--amber-light)', color: 'var(--amber)' }}>{ing}</span>
                      ))}
                    </div>
                  </div>
                )}

                {!isAdded ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setSelectedDish(dish)} style={{
                      flex: 1, padding: '9px', borderRadius: 10, border: 'none',
                      background: 'var(--green-mid)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                    }}>📅 Add to meal plan</button>
                    {dish.needsToBuy.length > 0 && (
                      <button onClick={() => addToOrder(dish.needsToBuy)} style={{
                        padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border)',
                        background: 'white', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)'
                      }}>🛒</button>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--green-soft)', textAlign: 'center' }}>Added to meal plan ✓</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Day picker sheet */}
      {selectedDish && (
        <div onClick={() => { setSelectedDish(null); setPickingSlot(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 430, margin: '0 auto', borderRadius: '24px 24px 0 0', padding: '20px 20px 32px', border: 'none' }}>
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 99, margin: '0 auto 20px' }} />
            {!pickingSlot ? (
              <>
                <p className="font-display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Add "{selectedDish.name}" to...</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Pick a day</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                  {DAYS.map(day => (
                    <button key={day} onClick={() => setPickingSlot({ dish: selectedDish, day })} style={{
                      padding: '10px 6px', borderRadius: 10, border: '1px solid var(--border)',
                      background: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: 'var(--text-secondary)',
                      textTransform: 'capitalize'
                    }}>{day.slice(0,3)}</button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="font-display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
                  {pickingSlot.day.charAt(0).toUpperCase() + pickingSlot.day.slice(1)} — which meal?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                  {[{ slot: 'lunch', label: '☀️ Lunch' }, { slot: 'dinner', label: '🌙 Dinner' }].map(({ slot, label }) => (
                    <button key={slot} disabled={saving} onClick={() => addToMealPlan(selectedDish, pickingSlot.day, slot)} style={{
                      padding: '14px', borderRadius: 12, border: 'none',
                      background: 'var(--green-light)', color: 'var(--green-deep)', fontSize: 15, fontWeight: 700, cursor: 'pointer'
                    }}>{saving ? 'Saving...' : label}</button>
                  ))}
                  <button onClick={() => setPickingSlot(null)} style={{ padding: '10px', borderRadius: 12, border: 'none', background: 'none', fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>← Back</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
