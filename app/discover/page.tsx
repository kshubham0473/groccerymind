'use client'
import { useState } from 'react'

type Dish = { name: string; description: string; usesFromPantry: string[]; needsToBuy: string[]; prepTime: string; mood: string }
type Feedback = Record<string, 'like' | 'dislike'>

const MOOD_COLORS: Record<string, { bg: string; color: string }> = {
  light:     { bg: '#D1FAE5', color: '#065F46' },
  hearty:    { bg: '#FEF3C7', color: '#92400E' },
  quick:     { bg: '#DBEAFE', color: '#1E40AF' },
  indulgent: { bg: '#F3E8FF', color: '#6B21A8' },
  healthy:   { bg: '#DCFCE7', color: '#166534' },
}
const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']

export default function DiscoverPage() {
  const [dishes, setDishes] = useState<Dish[]>([])
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>({})
  const [savingFeedback, setSavingFeedback] = useState<string|null>(null)
  const [addedToday, setAddedToday] = useState<Set<string>>(new Set())
  const [addedMain, setAddedMain] = useState<Set<string>>(new Set())
  const [addedOrders, setAddedOrders] = useState<Set<string>>(new Set())

  // Sheet state
  const [actionDish, setActionDish] = useState<Dish|null>(null)
  const [actionType, setActionType] = useState<'plan'|'today'|null>(null)
  const [pickingDay, setPickingDay] = useState<string|null>(null)
  const [saving, setSaving] = useState(false)

  async function generate() {
    setLoading(true); setDishes([])
    try {
      const res = await fetch('/api/suggest/dish')
      const d = await res.json()
      setDishes(d.dishes || []); setGenerated(true)
    } finally { setLoading(false) }
  }

  async function giveFeedback(dish: Dish, signal: 'like' | 'dislike') {
    setSavingFeedback(dish.name)
    setFeedback(p => ({ ...p, [dish.name]: signal }))
    await fetch('/api/feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dish_name: dish.name, signal })
    })
    setSavingFeedback(null)
  }

  async function addToTodaySlot(dish: Dish, slot: string) {
    setSaving(true)
    const today = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date().getDay()]
    await fetch('/api/meal-plan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day: today, slot, dish_name: dish.name, ingredients: dish.usesFromPantry })
    })
    setAddedToday(p => new Set([...p, dish.name]))
    setActionDish(null); setActionType(null); setSaving(false)
  }

  async function addToMainPlan(dish: Dish, day: string, slot: string) {
    setSaving(true)
    await fetch('/api/meal-plan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day, slot, dish_name: dish.name, ingredients: dish.usesFromPantry })
    })
    setAddedMain(p => new Set([...p, dish.name]))
    setActionDish(null); setActionType(null); setPickingDay(null); setSaving(false)
  }

  async function addToOrder(items: string[]) {
    const toAdd = items.filter(i => !addedOrders.has(i))
    setAddedOrders(p => new Set([...p, ...toAdd]))
    for (const item of toAdd) {
      await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_name: item, source: 'discover' })
      })
    }
  }

  const closeSheet = () => { setActionDish(null); setActionType(null); setPickingDay(null) }

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <div className="page-header">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Kitchen Discovery</p>
          <h1 className="font-display" style={{ color: 'white', fontSize: 24, fontWeight: 700, margin: 0 }}>Discover Dishes</h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 2 }}>New ideas from what's in your pantry</p>
        </div>
      </div>

      <div style={{ padding: '16px 16px 24px' }}>

        {!generated && !loading && (
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12, letterSpacing: '0.08em' }}>How it works</p>
            {[
              { icon: '🥬', text: 'Scans your pantry for available ingredients' },
              { icon: '🧠', text: 'Suggests dishes with minimal extra shopping needed' },
              { icon: '👍', text: 'Like or dislike to teach it your taste' },
              { icon: '📅', text: 'Add to today\'s meal or permanently to your meal plan' },
            ].map(({ icon, text }, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < 3 ? 10 : 0 }}>
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

        {loading && [1,2,3].map(i => (
          <div key={i} className="card" style={{ padding: 16, marginBottom: 10 }}>
            <div className="skeleton" style={{ height: 14, width: '55%', marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 11, width: '90%', marginBottom: 6 }} />
            <div className="skeleton" style={{ height: 11, width: '70%', marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="skeleton" style={{ height: 32, flex: 1, borderRadius: 10 }} />
              <div className="skeleton" style={{ height: 32, flex: 1, borderRadius: 10 }} />
            </div>
          </div>
        ))}

        {!loading && dishes.map((dish) => {
          const mood = MOOD_COLORS[dish.mood] || MOOD_COLORS.light
          const fb = feedback[dish.name]
          const isDisliked = fb === 'dislike'
          const isLiked = fb === 'like'
          const isSaving = savingFeedback === dish.name
          const addedT = addedToday.has(dish.name)
          const addedM = addedMain.has(dish.name)

          return (
            <div key={dish.name} className="card" style={{ marginBottom: 12, overflow: 'hidden', opacity: isDisliked ? 0.45 : 1, transition: 'opacity 0.3s' }}>
              {/* Header row */}
              <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: mood.bg, color: mood.color }}>{dish.mood}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>⏱ {dish.prepTime}</span>
                  {/* Like/dislike */}
                  <button onClick={() => giveFeedback(dish, 'like')} disabled={isSaving} style={{
                    padding: '4px 8px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontSize: 13,
                    borderColor: isLiked ? '#22C55E' : 'var(--border)',
                    background: isLiked ? '#D1FAE5' : 'white',
                  }}>👍</button>
                  <button onClick={() => giveFeedback(dish, 'dislike')} disabled={isSaving} style={{
                    padding: '4px 8px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontSize: 13,
                    borderColor: isDisliked ? '#DC2626' : 'var(--border)',
                    background: isDisliked ? '#FEE2E2' : 'white',
                  }}>👎</button>
                </div>
              </div>

              <div style={{ padding: 14 }}>
                <p className="font-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{dish.name}</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: 12, lineHeight: 1.5 }}>{dish.description}</p>

                {/* Pantry ingredients */}
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--green-mid)', marginBottom: 6 }}>✅ From pantry</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {dish.usesFromPantry.map(ing => (
                      <span key={ing} style={{ padding: '3px 9px', borderRadius: 99, fontSize: 12, fontWeight: 600, background: 'var(--green-light)', color: 'var(--green-deep)' }}>{ing}</span>
                    ))}
                  </div>
                </div>

                {/* Need to buy */}
                {dish.needsToBuy.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)', marginBottom: 6 }}>🛒 Need to buy</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {dish.needsToBuy.map(ing => (
                        <span key={ing} style={{ padding: '3px 9px', borderRadius: 99, fontSize: 12, fontWeight: 600, background: '#FEF3C7', color: 'var(--amber)' }}>{ing}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {isDisliked ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>Marked as disliked — won't suggest again</p>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {addedT || addedM ? (
                      <div style={{ flex: 1, padding: '9px', borderRadius: 10, background: 'var(--green-pale)', border: '1px solid var(--green-light)', textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--green-deep)' }}>
                        ✓ Added to {addedT ? "today's plan" : 'meal plan'}
                      </div>
                    ) : (
                      <button onClick={() => { setActionDish(dish); setActionType('plan') }} style={{
                        flex: 1, padding: '9px', borderRadius: 10, border: 'none',
                        background: 'var(--green-mid)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                      }}>📅 Add to plan</button>
                    )}
                    {dish.needsToBuy.length > 0 && (
                      <button onClick={() => addToOrder(dish.needsToBuy)} style={{
                        padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border)',
                        background: addedOrders.has(dish.needsToBuy[0]) ? 'var(--green-pale)' : 'white',
                        fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)'
                      }}>🛒 {addedOrders.has(dish.needsToBuy[0]) ? '✓' : 'Order'}</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Action sheet — choose Today or Main Plan */}
      {actionDish && actionType === 'plan' && !pickingDay && (
        <div onClick={closeSheet} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 430, margin: '0 auto', borderRadius: '24px 24px 0 0', padding: '20px 20px 36px', border: 'none' }}>
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 99, margin: '0 auto 20px' }} />
            <p className="font-display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Add "{actionDish.name}"</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Where do you want to add it?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Today */}
              <div style={{ padding: 14, borderRadius: 14, border: '1px solid var(--border)', background: 'white' }}>
                <p className="font-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🌅 Today only</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Try it today without adding it permanently to your rotation</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['lunch','dinner'].map(slot => (
                    <button key={slot} onClick={() => addToTodaySlot(actionDish, slot)} disabled={saving} style={{
                      flex: 1, padding: '10px', borderRadius: 10, border: 'none',
                      background: 'var(--green-light)', color: 'var(--green-deep)', fontSize: 13, fontWeight: 700, cursor: 'pointer'
                    }}>{saving ? '...' : slot === 'lunch' ? '☀️ Lunch' : '🌙 Dinner'}</button>
                  ))}
                </div>
              </div>
              {/* Main plan */}
              <div style={{ padding: 14, borderRadius: 14, border: '1px solid var(--border)', background: 'white' }}>
                <p className="font-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>📋 Add to rotation</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Permanently add to your weekly meal plan so it shows up regularly</p>
                <button onClick={() => setPickingDay('choosing')} style={{
                  width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--border)',
                  background: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)'
                }}>Choose day & slot →</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Day picker for main plan */}
      {actionDish && pickingDay && (
        <div onClick={closeSheet} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 430, margin: '0 auto', borderRadius: '24px 24px 0 0', padding: '20px 20px 36px', border: 'none' }}>
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 99, margin: '0 auto 16px' }} />
            {pickingDay === 'choosing' ? (
              <>
                <p className="font-display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Which day?</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Adding "{actionDish.name}" to main plan</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                  {DAYS.map(day => (
                    <button key={day} onClick={() => setPickingDay(day)} style={{
                      padding: '10px 6px', borderRadius: 10, border: '1px solid var(--border)',
                      background: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: 'var(--text-secondary)', textTransform: 'capitalize'
                    }}>{day.slice(0,3)}</button>
                  ))}
                </div>
                <button onClick={() => setPickingDay(null)} style={{ marginTop: 12, width: '100%', padding: '10px', border: 'none', background: 'none', fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>← Back</button>
              </>
            ) : (
              <>
                <p className="font-display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 4, textTransform: 'capitalize' }}>{pickingDay} — which meal?</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                  {[{ slot: 'lunch', label: '☀️ Lunch' }, { slot: 'dinner', label: '🌙 Dinner' }].map(({ slot, label }) => (
                    <button key={slot} disabled={saving} onClick={() => addToMainPlan(actionDish, pickingDay, slot)} style={{
                      padding: '14px', borderRadius: 12, border: 'none', background: 'var(--green-light)', color: 'var(--green-deep)', fontSize: 15, fontWeight: 700, cursor: 'pointer'
                    }}>{saving ? 'Saving...' : label}</button>
                  ))}
                  <button onClick={() => setPickingDay('choosing')} style={{ padding: '10px', border: 'none', background: 'none', fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>← Back</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
