'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import DishImage from '@/components/DishImage'

type Dish = { name: string; description: string; usesFromPantry: string[]; needsToBuy: string[]; prepTime: string; mood: string; youtube_url?: string; image_url?: string; meal_pairing?: string; error?: string }
type Feedback = Record<string, 'like' | 'dislike'>

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const SHORT: Record<string,string> = { monday:'Mon',tuesday:'Tue',wednesday:'Wed',thursday:'Thu',friday:'Fri',saturday:'Sat',sunday:'Sun' }

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
function getRandomPrompts(n = 4) {
  return [...PROMPT_POOL].sort(() => Math.random() - 0.5).slice(0, n)
}

/** Time and what's missing — the only two things worth printing. */
function dishMeta(dish: Dish): { text: string; warn: boolean } {
  const time = dish.prepTime ? dish.prepTime.replace(/\s*mins?\b/i, ' min') : ''
  const missing = dish.needsToBuy || []
  if (missing.length === 0) return { text: time ? `${time} · everything in stock` : 'Everything in stock', warn: false }
  if (missing.length === 1) return { text: time ? `${time} · needs ${missing[0].toLowerCase()}` : `Needs ${missing[0].toLowerCase()}`, warn: true }
  return { text: time ? `${time} · needs ${missing.length} things` : `Needs ${missing.length} things`, warn: true }
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
  const [pantryOnly, setPantryOnly] = useState(false)
  const [fetchingIngredients, setFetchingIngredients] = useState<string|null>(null)
  const [selected, setSelected] = useState<string|null>(null)
  const [promptChips] = useState(() => getRandomPrompts())

  useEffect(() => {
    const urlPrompt = searchParams.get('prompt')
    if (urlPrompt) { setPrompt(urlPrompt); handleGenerate(urlPrompt, false) }
    else if (isLockMode) { handleGenerate('', false) }
  }, [])

  async function handleGenerate(overridePrompt?: string, usePantryOnly?: boolean) {
    const usePrompt = (overridePrompt ?? prompt).trim()
    const useFilter = usePantryOnly ?? pantryOnly
    setLoading(true); setDishes([]); setErrorMsg(''); setGenerated(false); setSelected(null)
    try {
      let url = '/api/suggest/dish'
      const params = new URLSearchParams()
      if (usePrompt) params.set('prompt', usePrompt)
      if (useFilter) params.set('pantry_only', '1')
      if (params.toString()) url += '?' + params.toString()
      const res = await fetch(url)
      const d = await res.json()
      const result: Dish[] = d.dishes || []
      if (result.length === 1 && result[0].error) { setErrorMsg(result[0].error); setDishes([]) }
      else { setDishes(result); setSelected(result[0]?.name ?? null) }
      if (d.message && !result.length) setErrorMsg(d.message)
      setGenerated(true)
    } finally { setLoading(false) }
  }

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
      const notInPantry = ingredients.filter(ing => !dish.usesFromPantry.some(p => p.toLowerCase() === ing.toLowerCase()))
      setDishes(prev => prev.map(x => x.name === dish.name ? { ...x, needsToBuy: notInPantry } : x))
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

  /** The commitment. Cook it now, or lock it into the slot we came from. */
  async function commit(dish: Dish) {
    if (isLockMode) {
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
      setTimeout(() => router.push('/meal-plan'), 700)
      return
    }
    const slot = new Date().getHours() < 15 ? 'lunch' : 'dinner'
    await fetch('/api/locks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lock_date: new Date().toISOString().split('T')[0], slot, dish_name: dish.name })
    }).catch(() => {})
    setAddedToday(p => new Set([...p, dish.name]))
    setTimeout(() => router.push('/dashboard'), 700)
  }

  const closeSheet = () => { setActionDish(null); setPickingDay(null) }
  const visible = dishes.filter(d => feedback[d.name] !== 'dislike')
  const chosen = visible.find(d => d.name === selected) || visible[0] || null
  const committed = chosen ? addedToday.has(chosen.name) || addedMain.has(chosen.name) : false

  return (
    <div className="screen">

      <div className="screen-head">
        <a href={isLockMode ? '/meal-plan' : '/dashboard'} className="label tap">
          {isLockMode ? '← Week' : '← Tonight'}
        </a>
        <span className="label">{isLockMode ? `Locking ${lockSlot}` : 'Browse all'}</span>
      </div>

      <div className="screen-body" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>

        <div style={{ paddingTop: 22 }}>
          <p className="font-display" style={{ fontSize: 'var(--t-page)', lineHeight: 1.15, fontWeight: 600, margin: 0 }}>
            What are you in the mood for?
          </p>
        </div>

        {/* ── The ask ─────────────────────────────────────────────── */}
        <div style={{ paddingTop: 18 }}>
          <input ref={inputRef} className="field" value={prompt}
                 onChange={e => setPrompt(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && !loading && handleGenerate()}
                 placeholder="Something light, under 30 min"
                 style={{ fontFamily: 'var(--font-lora), Georgia, serif', fontSize: 20, fontStyle: 'italic', borderBottomColor: 'var(--ink)' }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', paddingTop: 14 }}>
            {promptChips.map(ex => (
              <button key={ex} className="word tap"
                      onClick={() => { setPrompt(ex); handleGenerate(ex) }}>{ex}</button>
            ))}
          </div>
        </div>

        {errorMsg && <p className="tail" style={{ paddingTop: 22, color: 'var(--finished)' }}>{errorMsg}</p>}

        {/* ── Results ─────────────────────────────────────────────── */}
        <div style={{ paddingTop: 26 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
            <span className="label">
              {loading ? 'Looking' : generated ? `${visible.length} dish${visible.length === 1 ? '' : 'es'}` : 'Your kitchen'}
            </span>
            <button className="word toggle tap" aria-pressed={pantryOnly}
                    onClick={() => { const next = !pantryOnly; setPantryOnly(next); if (generated) handleGenerate(undefined, next) }}>
              In stock only
            </button>
          </div>

          <div className="rule" />

          {loading && [1,2,3].map(i => (
            <div key={i} style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--rule)' }}>
              <div className="skeleton" style={{ width: 64, height: 64 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 6 }}>
                <div className="skeleton" style={{ height: 18, width: '55%' }} />
                <div className="skeleton" style={{ height: 13, width: '40%' }} />
              </div>
            </div>
          ))}

          {!loading && visible.map(dish => {
            const meta = dishMeta(dish)
            const isChosen = chosen?.name === dish.name
            return (
              <div key={dish.name}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0' }}>
                  <button onClick={() => setSelected(dish.name)}
                          style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                    <DishImage name={dish.name} youtubeUrl={dish.youtube_url} imageUrl={dish.image_url} height={64} size="sm" style={{ width: 64, flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <p className="row-title" style={isChosen ? { borderBottom: '1.5px solid var(--ink)', display: 'inline-block', paddingBottom: 2 } : undefined}>
                        {dish.name}
                      </p>
                      <p className="row-meta" style={meta.warn ? { color: 'var(--ochre)' } : undefined}>{meta.text}</p>
                    </span>
                  </button>
                  <button className="tap" aria-label="More" onClick={() => setActionDish(dish)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)', fontSize: 18, lineHeight: 1, padding: '0 2px' }}>⋯</button>
                </div>
                <div className="rule" />
              </div>
            )
          })}

          {!loading && generated && visible.length === 0 && (
            <>
              <p className="tail" style={{ padding: '16px 0' }}>Nothing came back. Try a different mood.</p>
              <div className="rule" />
            </>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 24 }} />

        {/* ── One commitment, same shape as home ──────────────────── */}
        {chosen && !loading && (
          <div style={{ paddingTop: 18, display: 'flex', gap: 10 }}>
            <button className="action" onClick={() => commit(chosen)} disabled={committed}>
              {committed
                ? (isLockMode ? 'Locked ✓' : 'Cooking ✓')
                : isLockMode ? `Lock for ${lockSlot}` : `Cook ${chosen.name}`}
            </button>
            <button className="action-ghost" aria-label="Suggest another" onClick={() => handleGenerate()}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 12a8 8 0 1 1-2.5-5.8" /><path d="M20 4v5h-5" />
              </svg>
            </button>
          </div>
        )}

        {!generated && !loading && (
          <div style={{ paddingTop: 18 }}>
            <button className="action" onClick={() => handleGenerate()}>Find dishes</button>
          </div>
        )}
      </div>

      {/* ── Dish sheet — plan, order, recipe, feedback ─────────────── */}
      {actionDish && !pickingDay && (
        <div className="sheet-scrim" onClick={closeSheet}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <p className="sheet-title">{actionDish.name}</p>
            {actionDish.description && <p className="sheet-sub" style={{ fontStyle: 'italic' }}>{actionDish.description}</p>}

            {actionDish.usesFromPantry.length > 0 && (
              <p className="tail" style={{ paddingTop: 14, fontSize: 14 }}>
                Uses {actionDish.usesFromPantry.slice(0, 5).join(', ').toLowerCase()} from your kitchen.
              </p>
            )}
            {actionDish.needsToBuy.length > 0 && (
              <p className="tail" style={{ paddingTop: 6, fontSize: 14 }}>
                Needs <em>{actionDish.needsToBuy.join(', ').toLowerCase()}</em>.
              </p>
            )}

            <div style={{ paddingTop: 20 }}>
              <div className="rule" />
              <button className="row" onClick={() => addToTodaySlot(actionDish, new Date().getHours() < 15 ? 'lunch' : 'dinner')} disabled={saving}>
                <span style={{ flex: 1 }}>
                  <p className="row-title" style={{ fontSize: 18 }}>Put it on today</p>
                  <p className="row-meta">Today only — stays out of the rotation</p>
                </span>
              </button>
              <div className="rule" />
              <button className="row" onClick={() => setPickingDay('choosing')}>
                <span style={{ flex: 1 }}>
                  <p className="row-title" style={{ fontSize: 18 }}>Add to the rotation</p>
                  <p className="row-meta">Pick a day and a meal</p>
                </span>
              </button>
              <div className="rule" />
              {(actionDish.needsToBuy.length > 0 || fetchingIngredients === actionDish.name) && (
                <>
                  <button className="row" onClick={() => handleOrderMissing(actionDish)} disabled={fetchingIngredients === actionDish.name}>
                    <span style={{ flex: 1 }}>
                      <p className="row-title" style={{ fontSize: 18 }}>
                        {actionDish.needsToBuy.every(i => addedOrders.has(i)) && actionDish.needsToBuy.length > 0 ? 'On the list' : 'Order what\u2019s missing'}
                      </p>
                      <p className="row-meta">{fetchingIngredients === actionDish.name ? 'Reading the recipe…' : actionDish.needsToBuy.join(', ').toLowerCase()}</p>
                    </span>
                  </button>
                  <div className="rule" />
                </>
              )}
              {actionDish.youtube_url && (
                <>
                  <a className="row" href={actionDish.youtube_url} target="_blank" rel="noopener noreferrer">
                    <span style={{ flex: 1 }}>
                      <p className="row-title" style={{ fontSize: 18 }}>Watch the recipe</p>
                      <p className="row-meta">Opens YouTube</p>
                    </span>
                  </a>
                  <div className="rule" />
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button className="action-sm" style={{ flex: 1 }} disabled={savingFeedback === actionDish.name}
                      onClick={() => giveFeedback(actionDish, 'like')}>
                {feedback[actionDish.name] === 'like' ? 'More like this ✓' : 'More like this'}
              </button>
              <button className="action-sm" style={{ flex: 1, color: 'var(--ink-soft)' }} disabled={savingFeedback === actionDish.name}
                      onClick={() => { giveFeedback(actionDish, 'dislike'); closeSheet() }}>
                Not for us
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Day / slot picker ──────────────────────────────────────── */}
      {actionDish && pickingDay && (
        <div className="sheet-scrim" onClick={closeSheet}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            {pickingDay === 'choosing' ? (
              <>
                <button className="word word-quiet tap" style={{ alignSelf: 'flex-start', marginBottom: 14 }} onClick={() => setPickingDay(null)}>Back</button>
                <p className="sheet-title" style={{ fontSize: 20 }}>Which day?</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 22px', paddingTop: 18 }}>
                  {DAYS.map(day => (
                    <button key={day} className="word tap" onClick={() => setPickingDay(day)}>{SHORT[day]}</button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <button className="word word-quiet tap" style={{ alignSelf: 'flex-start', marginBottom: 14 }} onClick={() => setPickingDay('choosing')}>Back</button>
                <p className="sheet-title" style={{ fontSize: 20, textTransform: 'capitalize' }}>{pickingDay} — which meal?</p>
                <div style={{ paddingTop: 18 }}>
                  <div className="rule" />
                  {['lunch','dinner'].map(slot => (
                    <div key={slot}>
                      <button className="row" disabled={saving} onClick={() => addToMainPlan(actionDish, pickingDay, slot)}>
                        <span style={{ flex: 1 }}>
                          <p className="row-title" style={{ fontSize: 18, textTransform: 'capitalize' }}>{saving ? 'Saving…' : slot}</p>
                        </span>
                      </button>
                      <div className="rule" />
                    </div>
                  ))}
                </div>
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
    <Suspense fallback={
      <div className="screen"><div className="screen-body" style={{ paddingTop: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="skeleton" style={{ height: 34, width: '80%' }} />
        <div className="skeleton" style={{ height: 46, width: '100%' }} />
      </div></div>
    }>
      <DiscoverContent />
    </Suspense>
  )
}
