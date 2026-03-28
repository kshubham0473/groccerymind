'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

type Dish = { name: string; description: string; usesFromPantry: string[]; needsToBuy: string[]; prepTime: string; mood: string; youtube_url?: string; meal_pairing?: string; error?: string }
type Feedback = Record<string, 'like' | 'dislike'>

const MOOD_COLORS: Record<string, { bg: string; color: string }> = {
  light:     { bg: '#D1FAE5', color: '#065F46' },
  hearty:    { bg: '#FEF3C7', color: '#92400E' },
  quick:     { bg: '#DBEAFE', color: '#1E40AF' },
  indulgent: { bg: '#F3E8FF', color: '#6B21A8' },
  healthy:   { bg: '#DCFCE7', color: '#166534' },
}
const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']

const PROMPT_POOL = [
  'Something with paneer', 'Quick under 20 mins', 'Light lunch today',
  'Comfort food for dinner', 'Something healthy', 'Use up the potatoes',
  'South Indian style', 'Something hearty', 'No onion today',
  'Something warm for monsoon', 'High protein today', 'Dal but different',
  'Use up the tomatoes', 'Street food style', 'Light on the stomach',
  'Something kids will eat', 'Breakfast for dinner', 'Something creamy',
  'Quick rice meal', 'No dairy today', 'Weekend special',
  'Something with eggs', 'Bengali style', 'Maharashtrian flavours',
]
function getRandomPrompts(n = 6) {
  return [...PROMPT_POOL].sort(() => Math.random() - 0.5).slice(0, n)
}

function DiscoverContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [prompt, setPrompt] = useState(searchParams.get('prompt') || '')
  const lockSlot = searchParams.get('lockSlot') || null
  const lockDate = searchParams.get('lockDate') || null
  const isLockMode = !!(lockSlot && lockDate)

  const [dishes, setDishes] = useState<Dish[]>([])
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [feedback, setFeedback] = useState<Feedback>({})
  const [savingFeedback, setSavingFeedback] = useState<string|null>(null)
  const [addedToday, setAddedToday] = useState<Set<string>>(new Set())
  const [addedMain, setAddedMain] = useState<Set<string>>(new Set())
  const [addedOrders, setAddedOrders] = useState<Set<string>>(new Set())
  const [actionDish, setActionDish] = useState<Dish|null>(null)
  const [pickingDay, setPickingDay] = useState<string|null>(null)
  const [saving, setSaving] = useState(false)
  const [editingDish, setEditingDish] = useState<Dish|null>(null)

  // Pantry-only toggle
  const [pantryOnly, setPantryOnly] = useState(false)
  // Per-dish "fetch ingredients" loading state
  const [fetchingIngredients, setFetchingIngredients] = useState<string|null>(null)

  useEffect(() => {
    const urlPrompt = searchParams.get('prompt')
    if (urlPrompt) {
      setPrompt(urlPrompt)
      handleGenerate(urlPrompt, false)
    } else if (isLockMode) {
      handleGenerate('', false)
    }
  }, [])

  async function handleGenerate(overridePrompt?: string, usePantryOnly?: boolean) {
    const usePrompt    = (overridePrompt ?? prompt).trim()
    const useFilter    = usePantryOnly ?? pantryOnly
    setLoading(true); setDishes([]); setErrorMsg(''); setGenerated(false)
    try {
      let url = '/api/suggest/dish'
      const params = new URLSearchParams()
      if (usePrompt)  params.set('prompt', usePrompt)
      if (useFilter)  params.set('pantry_only', '1')
      if (params.toString()) url += '?' + params.toString()
      const res = await fetch(url)
      const d = await res.json()
      const result: Dish[] = d.dishes || []
      if (result.length === 1 && result[0].error) {
        setErrorMsg(result[0].error); setDishes([])
      } else {
        setDishes(result)
      }
      if (d.message && !result.length) setErrorMsg(d.message)
      setGenerated(true)
    } finally { setLoading(false) }
  }

  // Fetch what a dish needs to buy (called lazily when user wants to order)
  async function fetchNeedsToBuy(dish: Dish): Promise<string[]> {
    if (dish.needsToBuy.length > 0) return dish.needsToBuy
    setFetchingIngredients(dish.name)
    try {
      const res = await fetch('/api/suggest/ingredients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dish_name: dish.name })
      })
      const d = await res.json()
      const ingredients: string[] = d.ingredients || []
      // Filter out items already in pantry
      const notInPantry = ingredients.filter(ing =>
        !dish.usesFromPantry.some(p => p.toLowerCase() === ing.toLowerCase())
      )
      // Update dish in state
      setDishes(prev => prev.map(d =>
        d.name === dish.name ? { ...d, needsToBuy: notInPantry } : d
      ))
      return notInPantry
    } catch { return [] } finally { setFetchingIngredients(null) }
  }

  async function giveFeedback(dish: Dish, signal: 'like' | 'dislike') {
    setSavingFeedback(dish.name)
    setFeedback(p => ({ ...p, [dish.name]: signal }))
    await fetch('/api/feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dish_name: dish.name, signal, reason: prompt.trim() || undefined })
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
    setActionDish(null); setPickingDay(null); setSaving(false)
  }

  async function addToMainPlan(dish: Dish, day: string, slot: string) {
    setSaving(true)
    await fetch('/api/meal-plan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day, slot, dish_name: dish.name, ingredients: dish.usesFromPantry })
    })
    setAddedMain(p => new Set([...p, dish.name]))
    setActionDish(null); setPickingDay(null); setSaving(false)
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

  async function handleOrderMissing(dish: Dish) {
    const items = await fetchNeedsToBuy(dish)
    if (items.length > 0) addToOrder(items)
  }

  const closeSheet = () => { setActionDish(null); setPickingDay(null) }

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="page-header">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Kitchen Discovery</p>
          <h1 className="font-display" style={{ color: 'white', fontSize: 24, fontWeight: 700, margin: 0 }}>Discover</h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 2 }}>
            {isLockMode ? `Locking ${lockSlot} — tap a dish to confirm` : "Tell it what you're craving"}
          </p>
        </div>
      </div>

      <div className="page-body">

        {/* ── Chatbox ── */}
        <div className="card" style={{ padding: 14, marginBottom: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>
            What are you in the mood for?
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              ref={inputRef}
              data-tour="discover-input"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && handleGenerate()}
              placeholder="e.g. something light with paneer, quick South Indian..."
              style={{
                flex: 1, padding: '11px 14px', borderRadius: 12,
                border: '1.5px solid var(--border)', fontSize: 14,
                outline: 'none', fontFamily: 'inherit', background: 'white'
              }}
            />
            {prompt && (
              <button onClick={() => setPrompt('')} style={{ padding: '0 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'white', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>×</button>
            )}
          </div>

          {/* Pantry-only toggle + example prompt chips */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {/* Pantry toggle chip */}
            <button
              data-tour="pantry-toggle"
              onClick={() => {
                const next = !pantryOnly
                setPantryOnly(next)
                if (generated) handleGenerate(undefined, next)
              }}
              style={{
                padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700,
                border: '1.5px solid',
                borderColor: pantryOnly ? 'var(--green-mid)' : 'var(--border)',
                background: pantryOnly ? 'var(--green-light)' : 'white',
                color: pantryOnly ? 'var(--green-deep)' : 'var(--text-muted)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
              }}
            >
              🧺 {pantryOnly ? 'Pantry only' : 'Pantry only'}
            </button>

            {/* Example prompt chips — only shown before first generation */}
            {!generated && getRandomPrompts().map(ex => (
              <button key={ex} onClick={() => { setPrompt(ex); setTimeout(() => inputRef.current?.focus(), 50) }} style={{
                padding: '5px 10px', borderRadius: 99, fontSize: 12, fontWeight: 500,
                border: '1px solid var(--border)', background: 'white',
                color: 'var(--text-secondary)', cursor: 'pointer'
              }}>{ex}</button>
            ))}
          </div>

          {pantryOnly && (
            <p style={{ fontSize: 11, color: 'var(--green-mid)', fontWeight: 600, marginBottom: 8 }}>
              🧺 Showing dishes you can make from what's in your pantry
            </p>
          )}

          <button onClick={() => handleGenerate()} disabled={loading} style={{
            width: '100%', padding: '12px', borderRadius: 12, border: 'none',
            background: loading ? 'var(--green-soft)' : 'var(--green-mid)', color: 'white',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            boxShadow: loading ? 'none' : '0 3px 10px rgba(45,106,79,0.28)'
          }}>
            {loading
              ? '✨ Finding dishes...'
              : prompt.trim()
                ? `✨ Find "${prompt.trim().slice(0, 28)}${prompt.length > 28 ? '…' : ''}"`
                : generated ? '🔄 Generate new ideas' : '✨ Generate dish ideas'}
          </button>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div style={{ padding: '14px 16px', borderRadius: 14, background: '#FEF3C7', border: '1px solid #FDE68A', marginBottom: 14 }}>
            <p style={{ fontSize: 14, color: '#92400E', margin: 0 }}>⚠️ {errorMsg}</p>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && [1,2,3].map(i => (
          <div key={i} className="card" style={{ padding: 16, marginBottom: 10 }}>
            <div className="skeleton" style={{ height: 14, width: '50%', marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 11, width: '85%', marginBottom: 6 }} />
            <div className="skeleton" style={{ height: 11, width: '65%', marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <div className="skeleton" style={{ height: 22, width: 60, borderRadius: 99 }} />
              <div className="skeleton" style={{ height: 22, width: 70, borderRadius: 99 }} />
              <div className="skeleton" style={{ height: 22, width: 50, borderRadius: 99 }} />
            </div>
          </div>
        ))}

        {/* Dish cards */}
        {!loading && dishes.map(dish => {
          const mood = MOOD_COLORS[dish.mood] || MOOD_COLORS.light
          const fb = feedback[dish.name]
          const isDisliked = fb === 'dislike'
          const isLiked = fb === 'like'
          const addedT = addedToday.has(dish.name)
          const addedM = addedMain.has(dish.name)
          const allOrdersAdded = dish.needsToBuy.length > 0 && dish.needsToBuy.every(i => addedOrders.has(i))
          const isFetchingThis = fetchingIngredients === dish.name

          return (
            <div key={dish.name} className="card fade-up" style={{ marginBottom: 12, overflow: 'hidden', opacity: isDisliked ? 0.4 : 1, transition: 'opacity 0.3s' }}>
              {/* Card header row */}
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: mood.bg, color: mood.color }}>{dish.mood}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>⏱ {dish.prepTime}</span>
                  <button onClick={() => giveFeedback(dish, 'like')} disabled={savingFeedback === dish.name} style={{
                    padding: '4px 8px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontSize: 13,
                    borderColor: isLiked ? '#22C55E' : 'var(--border)', background: isLiked ? '#D1FAE5' : 'white'
                  }}>👍</button>
                  <button onClick={() => giveFeedback(dish, 'dislike')} disabled={savingFeedback === dish.name} style={{
                    padding: '4px 8px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontSize: 13,
                    borderColor: isDisliked ? '#DC2626' : 'var(--border)', background: isDisliked ? '#FEE2E2' : 'white'
                  }}>👎</button>
                </div>
              </div>

              <div style={{ padding: 14 }}>
                {/* Dish name + YouTube + edit */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
                  <p className="font-display" onClick={() => setEditingDish(dish)} style={{ fontSize: 16, fontWeight: 700, margin: 0, cursor: 'pointer', textDecoration: 'underline dotted', textDecorationColor: 'var(--border)' }}>{dish.name}</p>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {dish.youtube_url && (
                      <a href={dish.youtube_url} target="_blank" rel="noopener noreferrer" style={{
                        padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border)',
                        background: 'white', fontSize: 13, textDecoration: 'none', lineHeight: 1
                      }} title="Watch recipe">▶</a>
                    )}
                    <button onClick={() => setEditingDish(dish)} style={{
                      padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border)',
                      background: 'white', fontSize: 12, cursor: 'pointer', color: 'var(--text-muted)'
                    }} title="Dish info">✎</button>
                  </div>
                </div>

                <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: 12, lineHeight: 1.5 }}>{dish.description}</p>

                {/* From pantry */}
                {dish.usesFromPantry.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--green-mid)', marginBottom: 6 }}>✅ From pantry</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {dish.usesFromPantry.map(ing => (
                        <span key={ing} style={{ padding: '3px 9px', borderRadius: 99, fontSize: 12, fontWeight: 600, background: 'var(--green-light)', color: 'var(--green-deep)' }}>{ing}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Need to buy — shown after fetching */}
                {dish.needsToBuy.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)', marginBottom: 6 }}>🛒 Need to order</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {dish.needsToBuy.map(ing => (
                        <span key={ing} style={{ padding: '3px 9px', borderRadius: 99, fontSize: 12, fontWeight: 600, background: '#FEF3C7', color: 'var(--amber)' }}>{ing}</span>
                      ))}
                    </div>
                  </div>
                )}

                {isDisliked ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '4px 0' }}>Marked as disliked · won't suggest again</p>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {isLockMode ? (
                      addedT ? (
                        <div style={{ flex: 1, padding: '9px', borderRadius: 10, background: 'var(--green-pale)', border: '1px solid var(--green-light)', textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--green-deep)' }}>
                          🔒 Locked for {lockSlot}
                        </div>
                      ) : (
                        <button onClick={async () => {
                          await fetch('/api/locks', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ lock_date: lockDate, slot: lockSlot, dish_name: dish.name })
                          })
                          setAddedToday(p => new Set([...p, dish.name]))
                          const dayName = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date(lockDate + 'T12:00:00').getDay()]
                          await fetch('/api/meal-plan', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ day: dayName, slot: lockSlot, dish_name: dish.name, ingredients: dish.usesFromPantry })
                          })
                          setTimeout(() => router.push('/meal-plan'), 800)
                        }} style={{
                          flex: 1, padding: '9px', borderRadius: 10, border: 'none',
                          background: 'var(--green-mid)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer'
                        }}>🔒 Lock for {lockSlot}</button>
                      )
                    ) : addedT || addedM ? (
                      <div style={{ flex: 1, padding: '9px', borderRadius: 10, background: 'var(--green-pale)', border: '1px solid var(--green-light)', textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--green-deep)' }}>
                        ✓ Added to {addedT ? "today's plan" : 'meal plan'}
                      </div>
                    ) : (
                      <button onClick={() => setActionDish(dish)} style={{
                        flex: 1, padding: '9px', borderRadius: 10, border: 'none',
                        background: 'var(--green-mid)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                      }}>📅 Add to plan</button>
                    )}

                    {/* Order missing ingredients button — lazy fetches on first tap */}
                    {!isLockMode && (
                      <button
                        onClick={() => handleOrderMissing(dish)}
                        disabled={isFetchingThis || allOrdersAdded}
                        style={{
                          padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border)',
                          background: allOrdersAdded ? 'var(--green-pale)' : 'white',
                          fontSize: 13, cursor: isFetchingThis ? 'wait' : 'pointer',
                          color: allOrdersAdded ? 'var(--green-deep)' : 'var(--text-secondary)',
                          minWidth: 64
                        }}
                      >
                        {isFetchingThis ? '⏳' : allOrdersAdded ? '✓ Ordered' : '🛒 Order'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Add to plan sheet ── */}
      {actionDish && !pickingDay && (
        <div onClick={closeSheet} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 430, margin: '0 auto', borderRadius: '24px 24px 0 0', padding: '20px 20px 36px', border: 'none' }}>
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 99, margin: '0 auto 20px' }} />
            <p className="font-display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Add "{actionDish.name}"</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>Today only, or add to your regular rotation?</p>

            <div style={{ padding: 14, borderRadius: 14, border: '1px solid var(--border)', background: 'white', marginBottom: 10 }}>
              <p className="font-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🌅 Today only</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Try it today — doesn't change your regular meal plan</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {['lunch','dinner'].map(slot => (
                  <button key={slot} onClick={() => addToTodaySlot(actionDish, slot)} disabled={saving} style={{
                    flex: 1, padding: '10px', borderRadius: 10, border: 'none',
                    background: 'var(--green-light)', color: 'var(--green-deep)', fontSize: 13, fontWeight: 700, cursor: 'pointer'
                  }}>{saving ? '...' : slot === 'lunch' ? '☀️ Lunch' : '🌙 Dinner'}</button>
                ))}
              </div>
            </div>

            <div style={{ padding: 14, borderRadius: 14, border: '1px solid var(--border)', background: 'white' }}>
              <p className="font-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>📋 Add to rotation</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Permanently add to your weekly meal plan</p>
              <button onClick={() => setPickingDay('choosing')} style={{
                width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--border)',
                background: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)'
              }}>Choose day & slot →</button>
            </div>
          </div>
        </div>
      )}

      {/* Dish info sheet */}
      {editingDish && (
        <div onClick={() => setEditingDish(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: 430, margin: '0 auto',
            background: 'white', borderRadius: '24px 24px 0 0',
            padding: '20px 20px 40px',
          }}>
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 99, margin: '0 auto 18px' }} />
            <p className="font-display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{editingDish.name}</p>
            {editingDish.meal_pairing && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Pairs with: {editingDish.meal_pairing}</p>
            )}
            {editingDish.youtube_url ? (
              <a href={editingDish.youtube_url} target="_blank" rel="noopener noreferrer" style={{
                display: 'block', padding: '14px 16px', borderRadius: 14,
                background: '#FFF1F0', border: '1px solid #FECACA',
                textDecoration: 'none', marginBottom: 12, textAlign: 'center' as const
              }}>
                <span style={{ fontSize: 20 }}>▶</span>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#DC2626', margin: '6px 0 0' }}>Watch Recipe on YouTube</p>
              </a>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>No recipe link available for this dish.</p>
            )}
            <button onClick={() => setEditingDish(null)} style={{
              width: '100%', padding: '13px', borderRadius: 12, border: '1px solid var(--border)',
              background: 'white', fontSize: 14, cursor: 'pointer', color: 'var(--text-muted)'
            }}>Close</button>
          </div>
        </div>
      )}

      {/* Day picker */}
      {actionDish && pickingDay && (
        <div onClick={closeSheet} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 430, margin: '0 auto', borderRadius: '24px 24px 0 0', padding: '20px 20px 36px', border: 'none' }}>
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 99, margin: '0 auto 16px' }} />
            {pickingDay === 'choosing' ? (
              <>
                <p className="font-display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>Which day?</p>
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
                <p className="font-display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 14, textTransform: 'capitalize' }}>{pickingDay} — which meal?</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[{ slot: 'lunch', label: '☀️ Lunch' }, { slot: 'dinner', label: '🌙 Dinner' }].map(({ slot, label }) => (
                    <button key={slot} disabled={saving} onClick={() => addToMainPlan(actionDish, pickingDay, slot)} style={{
                      padding: '14px', borderRadius: 12, border: 'none', background: 'var(--green-light)', color: 'var(--green-deep)', fontSize: 15, fontWeight: 700, cursor: 'pointer'
                    }}>{saving ? 'Saving...' : label}</button>
                  ))}
                </div>
                <button onClick={() => setPickingDay('choosing')} style={{ marginTop: 10, padding: '10px', border: 'none', background: 'none', fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer', width: '100%' }}>← Back</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><span style={{ fontSize: 28 }}>🍳</span></div>}>
      <DiscoverContent />
    </Suspense>
  )
}
