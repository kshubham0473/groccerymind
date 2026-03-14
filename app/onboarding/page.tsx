'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/components/AppProvider'

// ── Preference options ────────────────────────────────────────────────────────
const DIETARY_OPTIONS = ['No restrictions', 'Vegetarian', 'Vegan', 'Jain', 'Eggetarian']
const CUISINE_OPTIONS = ['Maharashtrian', 'North Indian', 'South Indian', 'Punjabi', 'Gujarati', 'Bengali', 'Continental', 'Chinese', 'Italian']
const COMPLEXITY_OPTIONS = ['Simple & familiar', 'Some new things', 'Love experimenting']
const COOKING_TIME_OPTIONS = ['Under 20 mins', '20–40 mins', 'No limit']
const SPICE_OPTIONS  = ['Mild', 'Medium', 'Spicy']
const VARIETY_OPTIONS = ['Stick to favourites', 'Some variety', 'Always try new']
const PROTEIN_OPTIONS = ['Paneer', 'Dal / Lentils', 'Eggs', 'Chicken', 'Tofu', 'Rajma / Chole', 'Soya']
const TEXTURE_OPTIONS = ['Dry sabzi', 'Gravy dishes', 'Rice meals', 'Breads & rotis', 'One-pot meals', 'Snacky / chaat']
const HEALTH_OPTIONS  = ['No specific goals', 'High protein', 'Low oil', 'Gut-friendly', 'Weight loss', 'Kid-friendly']
const OCCASION_OPTIONS = ['Weekday lunch', 'Weekday dinner', 'Weekend special', 'Guests / occasions', 'Meal prep / batch cook']
const QC_OPTIONS = [
  { key: 'blinkit',   name: 'Blinkit',           emoji: '🟡' },
  { key: 'zepto',     name: 'Zepto',             emoji: '🟣' },
  { key: 'swiggy',    name: 'Swiggy Instamart',  emoji: '🟠' },
  { key: 'bigbasket', name: 'BigBasket',         emoji: '🟢' },
]

const TOTAL_STEPS = 5

// ── Pill multi-select ─────────────────────────────────────────────────────────
function PillSelect({ options, value, onChange, single = false }: {
  options: string[]; value: string | string[]; onChange: (v: any) => void; single?: boolean
}) {
  const arr = single ? [] : (value as string[])
  const singleVal = single ? (value as string) : ''
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(opt => {
        const active = single ? singleVal === opt : arr.includes(opt)
        return (
          <button key={opt} type="button" onClick={() => {
            if (single) onChange(opt)
            else onChange(active ? arr.filter(x => x !== opt) : [...arr, opt])
          }} style={{
            padding: '8px 16px', borderRadius: 99, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
            background: active ? 'var(--green-mid)' : 'white',
            color: active ? 'white' : 'var(--text-secondary)',
            boxShadow: active ? '0 2px 8px rgba(45,106,79,0.25)' : 'var(--shadow)'
          }}>{opt}</button>
        )
      })}
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: hint ? 4 : 10 }}>{title}</p>
      {hint && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.4 }}>{hint}</p>}
      {children}
    </div>
  )
}

// ── Dish card for step 5 ──────────────────────────────────────────────────────
function DishCard({ dish, selected, onToggle, onDayToggle, pickedDays }: {
  dish: any; selected: boolean; onToggle: () => void
  onDayToggle: (daySlot: string) => void; pickedDays: string[]
}) {
  const DAY_SLOTS = [
    { key: 'monday_lunch', label: 'Mon L' }, { key: 'monday_dinner', label: 'Mon D' },
    { key: 'tuesday_lunch', label: 'Tue L' }, { key: 'tuesday_dinner', label: 'Tue D' },
    { key: 'wednesday_lunch', label: 'Wed L' }, { key: 'wednesday_dinner', label: 'Wed D' },
    { key: 'thursday_lunch', label: 'Thu L' }, { key: 'thursday_dinner', label: 'Thu D' },
    { key: 'friday_lunch', label: 'Fri L' }, { key: 'friday_dinner', label: 'Fri D' },
    { key: 'saturday_lunch', label: 'Sat L' }, { key: 'saturday_dinner', label: 'Sat D' },
    { key: 'sunday_lunch', label: 'Sun L' }, { key: 'sunday_dinner', label: 'Sun D' },
  ]
  return (
    <div style={{
      borderRadius: 14, border: '2px solid', marginBottom: 10,
      borderColor: selected ? 'var(--green-mid)' : 'var(--border)',
      background: selected ? 'var(--green-pale)' : 'white',
      overflow: 'hidden', transition: 'all 0.2s'
    }}>
      <button type="button" onClick={onToggle} style={{
        width: '100%', padding: '12px 14px', background: 'none', border: 'none',
        cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10
      }}>
        <span style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: selected ? 'var(--green-mid)' : 'var(--border)', color: 'white', fontSize: 13, fontWeight: 700
        }}>{selected ? '✓' : ''}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="font-display" style={{ fontSize: 14, fontWeight: 700, margin: 0, color: selected ? 'var(--green-deep)' : 'var(--text-primary)' }}>{dish.name}</p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0', fontStyle: 'italic' }}>{dish.description}</p>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{dish.cuisine_type}</span>
      </button>
      {selected && (
        <div style={{ padding: '0 14px 12px', borderTop: '1px solid var(--green-light)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--green-mid)', margin: '10px 0 6px' }}>Which day(s) to schedule? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {DAY_SLOTS.map(ds => (
              <button key={ds.key} type="button" onClick={() => onDayToggle(ds.key)} style={{
                padding: '4px 8px', borderRadius: 6, border: '1px solid', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                borderColor: pickedDays.includes(ds.key) ? 'var(--green-mid)' : 'var(--border)',
                background: pickedDays.includes(ds.key) ? 'var(--green-light)' : 'white',
                color: pickedDays.includes(ds.key) ? 'var(--green-deep)' : 'var(--text-muted)'
              }}>{ds.label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter()
  const { user, household } = useApp()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Step 1
  const [householdName, setHouseholdName] = useState('')

  // Step 2
  const [memberNames, setMemberNames] = useState<Record<string, string>>({})
  const [members, setMembers] = useState<{ username: string }[]>([])

  // Step 3 — expanded preferences
  const [dietary, setDietary] = useState('No restrictions')
  const [cuisines, setCuisines] = useState<string[]>([])
  const [complexity, setComplexity] = useState('Simple & familiar')
  const [cookingTime, setCookingTime] = useState('20–40 mins')
  const [spiceLevel, setSpiceLevel] = useState('Medium')
  const [variety, setVariety] = useState('Some variety')
  const [proteinPrefs, setProteinPrefs] = useState<string[]>(['Dal / Lentils', 'Paneer'])
  const [texturePrefs, setTexturePrefs] = useState<string[]>([])
  const [healthGoals, setHealthGoals] = useState<string[]>(['No specific goals'])
  const [occasions, setOccasions] = useState<string[]>(['Weekday lunch', 'Weekday dinner'])
  const [dislikes, setDislikes] = useState('')

  // Step 4 — quick commerce
  const [qcApps, setQcApps] = useState<string[]>(['blinkit'])

  // Step 5 — starter dishes
  const [starterDishes, setStarterDishes] = useState<any[]>([])
  const [starterLoading, setStarterLoading] = useState(false)
  const [starterError, setStarterError] = useState('')
  const [selectedDishes, setSelectedDishes] = useState<Set<string>>(new Set())
  const [dishDays, setDishDays] = useState<Record<string, string[]>>({})

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

  // Fetch starter dishes when entering step 5
  useEffect(() => {
    if (step !== 5 || starterDishes.length > 0) return
    setStarterLoading(true)
    setStarterError('')
    fetch('/api/onboarding/starter').then(r => r.json()).then(d => {
      if (d.dishes?.length) {
        setStarterDishes(d.dishes)
        // Pre-select all
        setSelectedDishes(new Set(d.dishes.map((x: any) => x.name)))
      } else {
        setStarterError('Could not generate dishes. You can skip and add manually.')
      }
      setStarterLoading(false)
    }).catch(() => { setStarterError('Network error. You can skip and add manually.'); setStarterLoading(false) })
  }, [step])

  async function saveAndContinue() {
    setSaving(true)

    if (step === 1) {
      await fetch('/api/preferences', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ household_name: householdName })
      })
    } else if (step === 2) {
      await fetch('/api/preferences', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_names: memberNames })
      })
    } else if (step === 3) {
      await fetch('/api/preferences', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dietary, cuisine_prefs: cuisines, dislikes,
          meal_complexity: complexity, cooking_time: cookingTime,
          spice_level: spiceLevel, meal_variety: variety,
          protein_prefs: proteinPrefs, texture_prefs: texturePrefs,
          health_goals: healthGoals, meal_occasions: occasions
        })
      })
    } else if (step === 4) {
      await fetch('/api/preferences', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quickcommerce: qcApps })
      })
    } else if (step === 5) {
      // Save selected dishes + mark onboarding complete
      const selected = starterDishes
        .filter(d => selectedDishes.has(d.name))
        .map(d => ({ ...d, days: dishDays[d.name] || [] }))

      await fetch('/api/onboarding/starter', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected })
      })
      await fetch('/api/preferences', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding_complete: true })
      })
      setSaving(false)
      router.push('/dashboard')
      return
    }

    setSaving(false)
    setStep(s => s + 1)
  }

  function toggleDish(name: string) {
    setSelectedDishes(p => {
      const n = new Set(p)
      n.has(name) ? n.delete(name) : n.add(name)
      return n
    })
  }

  function toggleDishDay(name: string, daySlot: string) {
    setDishDays(p => {
      const cur = p[name] || []
      return { ...p, [name]: cur.includes(daySlot) ? cur.filter(d => d !== daySlot) : [...cur, daySlot] }
    })
  }

  const progress = (step / TOTAL_STEPS) * 100
  const STEP_META = [
    { emoji: '🏠', title: "Your Kitchen's Name", sub: 'Appears in your app header' },
    { emoji: '👋', title: "Who's Cooking?", sub: 'Display names for personal greetings' },
    { emoji: '🍽️', title: 'Your Food Preferences', sub: 'Helps Gemini suggest meals you actually want' },
    { emoji: '🛒', title: 'Where Do You Order?', sub: 'Quick links on your order list' },
    { emoji: '✨', title: 'Build Your Meal Plan', sub: 'Pick dishes from your personalised starter set' },
  ]
  const meta = STEP_META[step - 1]
  const canContinue = step !== 1 || householdName.trim().length > 0

  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column' }}>

      {/* Progress bar */}
      <div style={{ height: 3, background: 'var(--border)', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10 }}>
        <div style={{ height: '100%', background: 'var(--green-mid)', width: `${progress}%`, transition: 'width 0.4s ease' }} />
      </div>

      {/* Header */}
      <div style={{ padding: '44px 24px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 38, marginBottom: 10, lineHeight: 1 }}>{meta.emoji}</div>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--green-mid)', marginBottom: 6 }}>
          Step {step} of {TOTAL_STEPS}
        </p>
        <h1 className="font-display" style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>{meta.title}</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{meta.sub}</p>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '4px 20px 130px' }}>

        {/* ── Step 1: Household name ── */}
        {step === 1 && (
          <div>
            <input autoFocus value={householdName} onChange={e => setHouseholdName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && canContinue && saveAndContinue()}
              placeholder="e.g. The Sharma Home"
              style={{ width: '100%', padding: '14px 16px', borderRadius: 14, border: '1.5px solid var(--border)', fontSize: 16, outline: 'none', fontFamily: 'inherit', background: 'white' }} />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>Changeable anytime in Settings.</p>
          </div>
        )}

        {/* ── Step 2: Member names ── */}
        {step === 2 && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Assign a first name to each account so greetings feel personal.
            </p>
            {members.map(m => (
              <div key={m.username} style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>@{m.username}</label>
                <input value={memberNames[m.username] || ''} onChange={e => setMemberNames(p => ({ ...p, [m.username]: e.target.value }))}
                  placeholder={`First name for ${m.username}`}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 15, outline: 'none', fontFamily: 'inherit', background: 'white' }} />
              </div>
            ))}
          </div>
        )}

        {/* ── Step 3: Food preferences (expanded) ── */}
        {step === 3 && (
          <div>
            <Section title="Dietary preference">
              <PillSelect options={DIETARY_OPTIONS} value={dietary} onChange={setDietary} single />
            </Section>

            <Section title="Cuisines you cook most">
              <PillSelect options={CUISINE_OPTIONS} value={cuisines} onChange={setCuisines} />
            </Section>

            <Section title="Protein sources you use" hint="Gemini uses this to suggest dishes with ingredients you actually buy.">
              <PillSelect options={PROTEIN_OPTIONS} value={proteinPrefs} onChange={setProteinPrefs} />
            </Section>

            <Section title="Preferred dish styles" hint="What kinds of dishes do you enjoy most?">
              <PillSelect options={TEXTURE_OPTIONS} value={texturePrefs} onChange={setTexturePrefs} />
            </Section>

            <Section title="Cooking complexity" hint="How adventurous do you want suggestions to be?">
              <PillSelect options={COMPLEXITY_OPTIONS} value={complexity} onChange={setComplexity} single />
            </Section>

            <Section title="Typical cooking time">
              <PillSelect options={COOKING_TIME_OPTIONS} value={cookingTime} onChange={setCookingTime} single />
            </Section>

            <Section title="Spice level">
              <PillSelect options={SPICE_OPTIONS} value={spiceLevel} onChange={setSpiceLevel} single />
            </Section>

            <Section title="Meal variety appetite" hint="Do you prefer a fixed rotation, or do you like discovering new dishes?">
              <PillSelect options={VARIETY_OPTIONS} value={variety} onChange={setVariety} single />
            </Section>

            <Section title="Health goals" hint="Select all that apply — or none if food is just food.">
              <PillSelect options={HEALTH_OPTIONS} value={healthGoals} onChange={(v: string[]) => {
                // If "No specific goals" selected, clear others
                if (v.includes('No specific goals') && !healthGoals.includes('No specific goals')) setHealthGoals(['No specific goals'])
                else setHealthGoals(v.filter(x => x !== 'No specific goals'))
              }} />
            </Section>

            <Section title="You typically cook for" hint="Helps calibrate portion and occasion awareness.">
              <PillSelect options={OCCASION_OPTIONS} value={occasions} onChange={setOccasions} />
            </Section>

            <Section title="Ingredients or dishes to avoid">
              <textarea value={dislikes} onChange={e => setDislikes(e.target.value)}
                placeholder="e.g. nobody likes bitter gourd, avoid too much garlic, no raw onion in cooked dishes..."
                rows={3}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 14, outline: 'none', fontFamily: 'inherit', background: 'white', resize: 'none', lineHeight: 1.5 }} />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Gemini reads this every time it suggests meals or dishes.</p>
            </Section>
          </div>
        )}

        {/* ── Step 4: Quick commerce ── */}
        {step === 4 && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Quick links appear on your order list for one-tap ordering.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {QC_OPTIONS.map(app => {
                const active = qcApps.includes(app.key)
                return (
                  <button key={app.key} type="button" onClick={() => setQcApps(p => active ? p.filter(k => k !== app.key) : [...p, app.key])} style={{
                    padding: '16px 18px', borderRadius: 14, border: '2px solid', cursor: 'pointer',
                    borderColor: active ? 'var(--green-mid)' : 'var(--border)',
                    background: active ? 'var(--green-pale)' : 'white',
                    display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
                    boxShadow: active ? '0 2px 8px rgba(45,106,79,0.15)' : 'var(--shadow)'
                  }}>
                    <span style={{ fontSize: 24 }}>{app.emoji}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: active ? 'var(--green-deep)' : 'var(--text-primary)' }}>{app.name}</span>
                    {active && <span style={{ marginLeft: 'auto', color: 'var(--green-mid)', fontWeight: 700 }}>✓</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Step 5: Starter dish selection ── */}
        {step === 5 && (
          <div>
            {starterLoading ? (
              <div>
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>✨</div>
                  <p className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--green-deep)' }}>Building your personalised meal list...</p>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>Gemini is curating dishes based on your preferences</p>
                </div>
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="skeleton" style={{ height: 60, borderRadius: 14, marginBottom: 10 }} />
                ))}
              </div>
            ) : starterError ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>{starterError}</p>
                <button onClick={() => { setStarterError(''); setStarterLoading(true); setStarterDishes([]); setTimeout(() => setStep(5), 10) }} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'var(--green-mid)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginRight: 10 }}>Try again</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--green-deep)' }}>{selectedDishes.size}</strong> of {starterDishes.length} selected
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => setSelectedDishes(new Set(starterDishes.map(d => d.name)))} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: 'var(--green-mid)', fontWeight: 600 }}>All</button>
                    <button type="button" onClick={() => setSelectedDishes(new Set())} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 600 }}>None</button>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
                  ✓ Deselect dishes you don't cook. Tap a selected dish to assign it to specific days.
                </p>
                {starterDishes.map(dish => (
                  <DishCard key={dish.name} dish={dish}
                    selected={selectedDishes.has(dish.name)}
                    onToggle={() => toggleDish(dish.name)}
                    pickedDays={dishDays[dish.name] || []}
                    onDayToggle={ds => toggleDishDay(dish.name, ds)} />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Footer CTA ── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '14px 20px 30px', background: 'rgba(250,250,248,0.97)', backdropFilter: 'blur(10px)', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 430, margin: '0 auto' }}>
          <button onClick={saveAndContinue} disabled={saving || !canContinue || (step === 5 && starterLoading)} style={{
            width: '100%', padding: '14px', borderRadius: 14, border: 'none',
            background: (!canContinue || (step === 5 && starterLoading)) ? 'var(--border)' : saving ? 'var(--green-soft)' : 'var(--green-mid)',
            color: (!canContinue || (step === 5 && starterLoading)) ? 'var(--text-muted)' : 'white',
            fontSize: 15, fontWeight: 700, cursor: 'pointer',
            boxShadow: canContinue ? '0 4px 14px rgba(45,106,79,0.28)' : 'none'
          }}>
            {saving ? 'Saving...' : step === 5 ? (selectedDishes.size > 0 ? `Save ${selectedDishes.size} dishes & go 🎉` : 'Skip & go to dashboard →') : 'Continue →'}
          </button>
          {step > 1 && (
            <button type="button" onClick={() => setStep(s => s - 1)} style={{ width: '100%', marginTop: 8, padding: '9px', border: 'none', background: 'none', fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>
              ← Back
            </button>
          )}
          {step < TOTAL_STEPS && step !== 1 && (
            <button type="button" onClick={() => setStep(s => s + 1)} style={{ width: '100%', marginTop: 2, padding: '7px', border: 'none', background: 'none', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>
              Skip for now
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
