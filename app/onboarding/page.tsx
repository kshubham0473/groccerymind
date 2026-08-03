'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/components/AppProvider'

/* ── patch-4 · app/onboarding/page.tsx ─────────────────────────────────
   Render-only rewrite onto the editorial paper theme (mocks 4b + 4c).
   Every fetch, endpoint and payload key is unchanged. One behavioural
   cut: per-dish day assignment is gone — `days` is still sent on each
   selected dish, always [], so /api/onboarding/starter needs no change.
   The Week screen (patch-3) is where days get assigned now. ─────────── */

const DIETARY_OPTIONS = ['Vegetarian', 'Eggetarian', 'Jain', 'Vegan', 'No restrictions']
const CUISINE_OPTIONS = ['Maharashtrian', 'North Indian', 'South Indian', 'Punjabi', 'Gujarati', 'Bengali', 'Continental', 'Chinese', 'Italian']
const COMPLEXITY_OPTIONS = ['Simple & familiar', 'Some new things', 'Love experimenting']
const COOKING_TIME_OPTIONS = ['Under 20 mins', '20–40 mins', 'No limit']
const SPICE_OPTIONS   = ['Mild', 'Medium', 'Spicy']
const VARIETY_OPTIONS = ['Stick to favourites', 'Some variety', 'Always try new']
const PROTEIN_OPTIONS = ['Paneer', 'Dal / Lentils', 'Eggs', 'Chicken', 'Tofu', 'Rajma / Chole', 'Soya']
const TEXTURE_OPTIONS = ['No preference', 'Dry sabzi', 'Gravy dishes', 'Rice meals', 'Breads & rotis', 'One-pot meals', 'Snacky / chaat']
const HEALTH_OPTIONS  = ['No specific goals', 'High protein', 'Low oil', 'Gut-friendly', 'Weight loss', 'Kid-friendly']
const OCCASION_OPTIONS = ['Weekday lunch', 'Weekday dinner', 'Weekend special', 'Guests / occasions', 'Meal prep / batch cook']
const QC_OPTIONS = [
  { key: 'blinkit',   name: 'Blinkit' },
  { key: 'zepto',     name: 'Zepto' },
  { key: 'swiggy',    name: 'Swiggy Instamart' },
  { key: 'bigbasket', name: 'BigBasket' },
]
const TOTAL_STEPS = 6

/* Near-square chips: hairline outline unselected, solid ink selected. */
function Chips({ options, value, onChange, single = false }: {
  options: string[]; value: string | string[]; onChange: (v: any) => void; single?: boolean
}) {
  const arr = single ? [] : (value as string[])
  const sv = single ? (value as string) : ''
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(opt => {
        const active = single ? sv === opt : arr.includes(opt)
        return (
          <button key={opt} type="button"
            onClick={() => single ? onChange(opt) : onChange(active ? arr.filter((x: string) => x !== opt) : [...arr, opt])}
            style={{
              padding: '10px 15px', minHeight: 44,
              borderRadius: 'var(--r)',
              border: '1.5px solid',
              borderColor: active ? 'var(--ink)' : 'var(--rule-firm)',
              background: active ? 'var(--ink)' : 'none',
              color: active ? 'var(--paper)' : 'var(--ink-soft)',
              font: 'inherit', fontSize: 14, fontWeight: active ? 600 : 400,
              cursor: 'pointer',
            }}>{opt}</button>
        )
      })}
    </div>
  )
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label" style={{ margin: hint ? '0 0 4px' : '0 0 12px' }}>{title}</p>
      {hint && <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 12px', lineHeight: 1.5 }}>{hint}</p>}
      {children}
    </div>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const { user, household } = useApp()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  const [householdName, setHouseholdName] = useState('')
  const [memberNames, setMemberNames] = useState<Record<string, string>>({})
  const [members, setMembers] = useState<{ username: string }[]>([])

  const [dietary, setDietary] = useState('No restrictions')
  const [cuisines, setCuisines] = useState<string[]>([])
  const [complexity, setComplexity] = useState('Simple & familiar')
  const [cookingTime, setCookingTime] = useState('20–40 mins')
  const [spiceLevel, setSpiceLevel] = useState('Medium')
  const [variety, setVariety] = useState('Some variety')
  const [proteinPrefs, setProteinPrefs] = useState<string[]>(['Dal / Lentils', 'Paneer'])
  const [texturePrefs, setTexturePrefs] = useState<string[]>(['No preference'])
  const [healthGoals, setHealthGoals] = useState<string[]>(['No specific goals'])
  const [occasions, setOccasions] = useState<string[]>(['Weekday lunch', 'Weekday dinner'])
  const [dislikes, setDislikes] = useState('')
  const [qcApps, setQcApps] = useState<string[]>(['blinkit'])

  const [starterDishes, setStarterDishes] = useState<any[]>([])
  const [starterLoading, setStarterLoading] = useState(false)
  const [starterError, setStarterError] = useState('')
  const [selectedDishes, setSelectedDishes] = useState<Set<string>>(new Set())
  const [regeneratingDish, setRegeneratingDish] = useState<string | null>(null)
  const seenDishNames = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (household) setHouseholdName(household.name)
    fetch('/api/admin/users').then(r => r.json()).then(d => { if (Array.isArray(d)) setMembers(d) })
    fetch('/api/preferences').then(r => r.json()).then(d => {
      if (d.error) return
      if (d.member_names) setMemberNames(d.member_names)
      if (d.dietary) setDietary(d.dietary)
      if (d.cuisine_prefs) setCuisines(d.cuisine_prefs)
      if (d.meal_complexity) setComplexity(d.meal_complexity)
      if (d.cooking_time) setCookingTime(d.cooking_time)
      if (d.spice_level) setSpiceLevel(d.spice_level)
      if (d.meal_variety) setVariety(d.meal_variety)
      if (d.protein_prefs) setProteinPrefs(d.protein_prefs)
      if (d.texture_prefs) setTexturePrefs(d.texture_prefs)
      if (d.health_goals) setHealthGoals(d.health_goals)
      if (d.meal_occasions) setOccasions(d.meal_occasions)
      if (d.dislikes) setDislikes(d.dislikes)
      if (d.quickcommerce) setQcApps(d.quickcommerce)
    })
  }, [household])

  const fetchStarterDishes = useCallback(() => {
    setStarterLoading(true); setStarterError('')
    fetch('/api/onboarding/starter').then(r => r.json()).then(d => {
      if (d.dishes?.length) {
        setStarterDishes(d.dishes)
        setSelectedDishes(new Set(d.dishes.map((x: any) => x.name)))
        d.dishes.forEach((x: any) => seenDishNames.current.add(x.name))
      } else if (d.no_corpus) {
        setStarterError('The recipe library isn\u2019t ready yet. Skip this — you can build the rotation from Week later.')
      } else {
        setStarterError('Couldn\u2019t load suggestions. Try again, or skip.')
      }
      setStarterLoading(false)
    }).catch(() => { setStarterError('Network error — try again or skip.'); setStarterLoading(false) })
  }, [])

  useEffect(() => {
    if (step === 6 && starterDishes.length === 0 && !starterLoading) fetchStarterDishes()
  }, [step])

  async function regenerateDish(oldName: string) {
    setRegeneratingDish(oldName)
    const excludeNames = [...seenDishNames.current]
    const res = await fetch('/api/onboarding/reassign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exclude_names: excludeNames, dish_being_replaced: oldName })
    })
    const d = await res.json()
    if (d.dish) {
      seenDishNames.current.add(d.dish.name)
      setStarterDishes(p => p.map(dish => dish.name === oldName ? d.dish : dish))
      setSelectedDishes(p => {
        const n = new Set(p)
        if (n.has(oldName)) { n.delete(oldName); n.add(d.dish.name) }
        return n
      })
    }
    setRegeneratingDish(null)
  }

  async function saveAndContinue() {
    setSaving(true)
    if (step === 1) {
      await fetch('/api/preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ household_name: householdName }) })
    } else if (step === 2) {
      await fetch('/api/preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_names: memberNames }) })
    } else if (step === 3) {
      await fetch('/api/preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dietary, cuisine_prefs: cuisines, dislikes }) })
    } else if (step === 4) {
      await fetch('/api/preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meal_complexity: complexity, cooking_time: cookingTime,
          spice_level: spiceLevel, meal_variety: variety,
          protein_prefs: proteinPrefs, texture_prefs: texturePrefs,
          health_goals: healthGoals, meal_occasions: occasions }) })
    } else if (step === 5) {
      await fetch('/api/preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quickcommerce: qcApps }) })
    } else if (step === 6) {
      // days stays in the payload, always empty — the Week screen assigns days now
      const selected = starterDishes
        .filter(d => selectedDishes.has(d.name))
        .map(d => ({ ...d, days: [] as string[] }))
      await fetch('/api/onboarding/starter', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected }) })
      await fetch('/api/preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding_complete: true }) })
      setSaving(false); router.push('/dashboard'); return
    }
    setSaving(false); setStep(s => s + 1)
  }

  function handleTextureChange(v: string[]) {
    if (v.includes('No preference') && !texturePrefs.includes('No preference')) setTexturePrefs(['No preference'])
    else setTexturePrefs(v.filter(x => x !== 'No preference'))
  }

  function toggleDish(name: string) {
    setSelectedDishes(p => { const n = new Set(p); n.has(name) ? n.delete(name) : n.add(name); return n })
  }

  /* Titles say what the step is for, not what data it stores. */
  const STEP_META = [
    { kicker: 'One of six',   title: 'What this kitchen is called', sub: 'It sits at the top of every screen. Changeable later.' },
    { kicker: 'Two of six',   title: 'Who cooks here',              sub: 'First names, so the app can say who added what.' },
    { kicker: 'Three of six', title: 'What you never eat',          sub: 'Hard rules. GroceryMind will never suggest against these — the softer stuff comes next.' },
    { kicker: 'Four of six',  title: 'How you like to cook',        sub: 'Preferences, not rules. These tilt suggestions rather than block them.' },
    { kicker: 'Five of six',  title: 'Where you order from',        sub: 'Your list gets a one-tap link to these.' },
    { kicker: 'Last one',     title: 'Your rotation',               sub: 'Built from your answers. Drop the ones you\u2019d never cook — swap any single one with \u21bb.' },
  ]
  const meta = STEP_META[step - 1]

  const isNextDisabled = saving
    || (step === 1 && !householdName.trim())
    || (step === 6 && starterLoading)

  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', display: 'flex', flexDirection: 'column', maxWidth: 430, margin: '0 auto' }}>

      {/* Six ruled segments — where you are, not a filling bar */}
      <div style={{ display: 'flex', gap: 5, padding: 'calc(20px + env(safe-area-inset-top, 0px)) 24px 0', flexShrink: 0 }}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 2,
            background: i < step - 1 ? 'var(--ink)' : i === step - 1 ? 'var(--ochre)' : 'var(--rule)',
          }} />
        ))}
      </div>

      <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
        <p className="label" style={{ color: 'var(--ochre)', margin: 0 }}>{meta.kicker}</p>
        <h1 className="font-display" style={{ fontSize: 'var(--t-page)', lineHeight: 1.15, fontWeight: 600, margin: '10px 0 0' }}>{meta.title}</h1>
        <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--ink-soft)', margin: '8px 0 0' }}>{meta.sub}</p>
      </div>

      <div style={{ flex: 1, padding: '28px 24px 150px', display: 'flex', flexDirection: 'column', gap: 26 }}>

        {step === 1 && (
          <div>
            <input autoFocus className="field" value={householdName}
              onChange={e => setHouseholdName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && householdName.trim() && saveAndContinue()}
              placeholder="The Kapoor kitchen" style={{ fontSize: 20 }} />
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {members.map(m => (
              <div key={m.username}>
                <label className="label" style={{ display: 'block', marginBottom: 6 }}>@{m.username}</label>
                <input className="field" value={memberNames[m.username] || ''} placeholder="First name"
                  onChange={e => setMemberNames(p => ({ ...p, [m.username]: e.target.value }))} />
              </div>
            ))}
          </div>
        )}

        {step === 3 && (
          <>
            <Group title="Diet"><Chips options={DIETARY_OPTIONS} value={dietary} onChange={setDietary} single /></Group>
            <Group title="Kitchens you cook from"><Chips options={CUISINE_OPTIONS} value={cuisines} onChange={setCuisines} /></Group>
            <Group title="Always avoid">
              <textarea value={dislikes} onChange={e => setDislikes(e.target.value)} rows={2}
                placeholder="no karela, no okra, easy on garlic"
                className="field" style={{ resize: 'none', lineHeight: 1.5 }} />
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '10px 0 0' }}>
                Plain words are fine — &ldquo;nothing too oily on weeknights&rdquo; works.
              </p>
            </Group>
          </>
        )}

        {step === 4 && (
          <>
            <Group title="Proteins you cook with"><Chips options={PROTEIN_OPTIONS} value={proteinPrefs} onChange={setProteinPrefs} /></Group>
            <Group title="Dishes you gravitate to"><Chips options={TEXTURE_OPTIONS} value={texturePrefs} onChange={handleTextureChange} /></Group>
            <Group title="On a weeknight you want"><Chips options={COMPLEXITY_OPTIONS} value={complexity} onChange={setComplexity} single /></Group>
            <Group title="Time at the stove"><Chips options={COOKING_TIME_OPTIONS} value={cookingTime} onChange={setCookingTime} single /></Group>
            <Group title="Spice"><Chips options={SPICE_OPTIONS} value={spiceLevel} onChange={setSpiceLevel} single /></Group>
            <Group title="Appetite for something new"><Chips options={VARIETY_OPTIONS} value={variety} onChange={setVariety} single /></Group>
            <Group title="Anything you're working towards">
              <Chips options={HEALTH_OPTIONS} value={healthGoals} onChange={(v: string[]) => {
                if (v.includes('No specific goals') && !healthGoals.includes('No specific goals')) setHealthGoals(['No specific goals'])
                else setHealthGoals(v.filter((x: string) => x !== 'No specific goals'))
              }} />
            </Group>
            <Group title="Meals you plan for"><Chips options={OCCASION_OPTIONS} value={occasions} onChange={setOccasions} /></Group>
          </>
        )}

        {step === 5 && (
          <div>
            <div className="rule" />
            {QC_OPTIONS.map(app => {
              const active = qcApps.includes(app.key)
              return (
                <div key={app.key}>
                  <button type="button" className="row"
                    onClick={() => setQcApps(p => active ? p.filter(k => k !== app.key) : [...p, app.key])}>
                    <span className="check" aria-checked={active} role="checkbox">{active ? '✓' : ''}</span>
                    <span className="row-title" style={{ flex: 1 }}>{app.name}</span>
                  </button>
                  <div className="rule" />
                </div>
              )
            })}
          </div>
        )}

        {step === 6 && (
          <div>
            {starterLoading ? (
              <div>
                <p className="label" style={{ margin: '0 0 16px' }}>Curating from your answers…</p>
                {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: 56, marginBottom: 10 }} />)}
              </div>
            ) : starterError ? (
              <div>
                <p style={{ fontSize: 15, color: 'var(--ink-soft)', margin: '0 0 18px', lineHeight: 1.6 }}>{starterError}</p>
                <button onClick={fetchStarterDishes} className="action-sm">Try again</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span className="label">{selectedDishes.size} of {starterDishes.length} keeping</span>
                  <button type="button" className="word"
                    onClick={() => setSelectedDishes(new Set(starterDishes.map(d => d.name)))}>Keep all</button>
                </div>
                <div className="rule" />
                {starterDishes.map(dish => {
                  const on = selectedDishes.has(dish.name)
                  const busy = regeneratingDish === dish.name
                  return (
                    <div key={dish.name}>
                      <div className="row" style={{ cursor: 'default' }}>
                        {busy ? (
                          <>
                            <span className="check" style={{ background: 'var(--paper-alt)', borderColor: 'var(--rule)' }} />
                            <p className="row-title" style={{ flex: 1, fontWeight: 500, fontStyle: 'italic', color: 'var(--ink-soft)' }}>Finding another…</p>
                          </>
                        ) : (
                          <>
                            <button type="button" className="check tap" role="checkbox" aria-checked={on}
                              onClick={() => toggleDish(dish.name)}>{on ? '✓' : ''}</button>
                            <button type="button" onClick={() => toggleDish(dish.name)}
                              style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'left', font: 'inherit', cursor: 'pointer' }}>
                              <p className="row-title" style={{
                                fontWeight: on ? 600 : 500,
                                color: on ? 'var(--ink)' : 'var(--ink-soft)',
                                textDecoration: on ? 'none' : 'line-through',
                                textDecorationColor: 'var(--rule-firm)',
                              }}>{dish.name}</p>
                              <p className="row-meta">{on ? [dish.cuisine_type, dish.description].filter(Boolean).join(' · ') : 'Dropped'}</p>
                            </button>
                            <button type="button" onClick={() => regenerateDish(dish.name)} title="Swap this one"
                              className="tap" style={{
                                background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
                                fontFamily: 'var(--font-mono), ui-monospace, monospace', fontSize: 15, color: 'var(--ink-soft)',
                                width: 36, minHeight: 36,
                              }}>↻</button>
                          </>
                        )}
                      </div>
                      <div className="rule" />
                    </div>
                  )
                })}
                <p className="tail" style={{ padding: '18px 0 0' }}>
                  Nothing here is a shopping list. It&rsquo;s the pool tonight&rsquo;s suggestion draws from — editable forever from <em>Week → Edit menu</em>.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer — ink slab, ghost back */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10,
        maxWidth: 430, margin: '0 auto',
        background: 'var(--paper)', borderTop: '1px solid var(--rule)',
        padding: '16px 24px calc(26px + env(safe-area-inset-bottom, 0px))',
      }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {step > 1 && (
            <button type="button" onClick={() => setStep(s => s - 1)} className="action-ghost" aria-label="Back">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          )}
          <button onClick={saveAndContinue} disabled={isNextDisabled} className="action" style={{ flex: 1 }}>
            {saving ? 'Saving…' : step === 6 ? (selectedDishes.size > 0 ? 'Start cooking' : 'Skip for now') : 'Next'}
          </button>
        </div>
        {step > 1 && step < TOTAL_STEPS && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10 }}>
            <button type="button" onClick={() => { setSaving(false); setStep(s => s + 1) }}
              className="word word-quiet" style={{ minHeight: 44 }}>Skip this</button>
          </div>
        )}
      </div>
    </div>
  )
}
