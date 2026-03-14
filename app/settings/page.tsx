'use client'
import { useState, useEffect } from 'react'
import { useApp } from '@/components/AppProvider'

const DIETARY_OPTIONS = ['No restrictions', 'Vegetarian', 'Vegan', 'Jain', 'Eggetarian']
const CUISINE_OPTIONS = ['Maharashtrian', 'North Indian', 'South Indian', 'Punjabi', 'Gujarati', 'Bengali', 'Continental', 'Chinese', 'Italian']
const COMPLEXITY_OPTIONS = ['Simple & familiar', 'Some new things', 'Love experimenting']
const COOKING_TIME_OPTIONS = ['Under 20 mins', '20–40 mins', 'No limit']
const SPICE_OPTIONS = ['Mild', 'Medium', 'Spicy']
const VARIETY_OPTIONS = ['Stick to favourites', 'Some variety', 'Always try new']
const PROTEIN_OPTIONS = ['Paneer', 'Dal / Lentils', 'Eggs', 'Chicken', 'Tofu', 'Rajma / Chole', 'Soya']
const TEXTURE_OPTIONS = ['Dry sabzi', 'Gravy dishes', 'Rice meals', 'Breads & rotis', 'One-pot meals', 'Snacky / chaat']
const HEALTH_OPTIONS = ['No specific goals', 'High protein', 'Low oil', 'Gut-friendly', 'Weight loss', 'Kid-friendly']
const OCCASION_OPTIONS = ['Weekday lunch', 'Weekday dinner', 'Weekend special', 'Guests / occasions', 'Meal prep / batch cook']
const QC_OPTIONS = [
  { key: 'blinkit', name: 'Blinkit', emoji: '🟡' },
  { key: 'zepto', name: 'Zepto', emoji: '🟣' },
  { key: 'swiggy', name: 'Swiggy Instamart', emoji: '🟠' },
  { key: 'bigbasket', name: 'BigBasket', emoji: '🟢' },
]

function Chips({ options, value, onChange, single = false }: { options: string[]; value: string | string[]; onChange: (v: any) => void; single?: boolean }) {
  const arr = single ? [] : (value as string[])
  const sv = single ? (value as string) : ''
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(opt => {
        const active = single ? sv === opt : arr.includes(opt)
        return (
          <button key={opt} type="button" onClick={() => single ? onChange(opt) : onChange(active ? arr.filter((x: string) => x !== opt) : [...arr, opt])} style={{
            padding: '7px 14px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: active ? 'var(--green-mid)' : 'white',
            color: active ? 'white' : 'var(--text-secondary)',
            boxShadow: 'var(--shadow)'
          }}>{opt}</button>
        )
      })}
    </div>
  )
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>{title}</p>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const { user, household } = useApp()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [members, setMembers] = useState<{ username: string }[]>([])

  const [householdName, setHouseholdName] = useState('')
  const [memberNames, setMemberNames] = useState<Record<string, string>>({})
  const [dietary, setDietary] = useState('No restrictions')
  const [cuisines, setCuisines] = useState<string[]>([])
  const [complexity, setComplexity] = useState('Simple & familiar')
  const [cookingTime, setCookingTime] = useState('20–40 mins')
  const [spiceLevel, setSpiceLevel] = useState('Medium')
  const [variety, setVariety] = useState('Some variety')
  const [proteinPrefs, setProteinPrefs] = useState<string[]>([])
  const [texturePrefs, setTexturePrefs] = useState<string[]>([])
  const [healthGoals, setHealthGoals] = useState<string[]>([])
  const [occasions, setOccasions] = useState<string[]>([])
  const [dislikes, setDislikes] = useState('')
  const [qcApps, setQcApps] = useState<string[]>([])

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

  async function save() {
    setSaving(true)
    await fetch('/api/preferences', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        household_name: householdName, member_names: memberNames,
        dietary, cuisine_prefs: cuisines, dislikes,
        meal_complexity: complexity, cooking_time: cookingTime,
        spice_level: spiceLevel, meal_variety: variety,
        protein_prefs: proteinPrefs, texture_prefs: texturePrefs,
        health_goals: healthGoals, meal_occasions: occasions,
        quickcommerce: qcApps
      })
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (!user) return null

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <div className="page-header">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Household</p>
          <h1 className="font-display" style={{ color: 'white', fontSize: 24, fontWeight: 700, margin: 0 }}>Settings</h1>
        </div>
        <a href="/dashboard" style={{ position: 'absolute', top: 48, right: 20, zIndex: 2, background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)', padding: '6px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>← Home</a>
      </div>

      <div style={{ padding: '16px 16px 100px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        <div className="card" style={{ padding: 16 }}>
          <Sec title="Household Name">
            <input value={householdName} onChange={e => setHouseholdName(e.target.value)}
              style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 15, outline: 'none', fontFamily: 'inherit', background: 'white' }} />
          </Sec>
          <Sec title="Display Names">
            {members.map(m => (
              <div key={m.username} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, minWidth: 80 }}>@{m.username}</span>
                <input value={memberNames[m.username] || ''} onChange={e => setMemberNames(p => ({ ...p, [m.username]: e.target.value }))}
                  placeholder="First name" style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
              </div>
            ))}
          </Sec>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-deep)', marginBottom: 16 }}>🍽️ Food Preferences</p>
          <Sec title="Dietary"><Chips options={DIETARY_OPTIONS} value={dietary} onChange={setDietary} single /></Sec>
          <Sec title="Cuisines you cook"><Chips options={CUISINE_OPTIONS} value={cuisines} onChange={setCuisines} /></Sec>
          <Sec title="Protein sources"><Chips options={PROTEIN_OPTIONS} value={proteinPrefs} onChange={setProteinPrefs} /></Sec>
          <Sec title="Preferred dish styles"><Chips options={TEXTURE_OPTIONS} value={texturePrefs} onChange={setTexturePrefs} /></Sec>
          <Sec title="Cooking complexity"><Chips options={COMPLEXITY_OPTIONS} value={complexity} onChange={setComplexity} single /></Sec>
          <Sec title="Cooking time"><Chips options={COOKING_TIME_OPTIONS} value={cookingTime} onChange={setCookingTime} single /></Sec>
          <Sec title="Spice level"><Chips options={SPICE_OPTIONS} value={spiceLevel} onChange={setSpiceLevel} single /></Sec>
          <Sec title="Meal variety"><Chips options={VARIETY_OPTIONS} value={variety} onChange={setVariety} single /></Sec>
          <Sec title="Health goals"><Chips options={HEALTH_OPTIONS} value={healthGoals} onChange={setHealthGoals} /></Sec>
          <Sec title="You cook for"><Chips options={OCCASION_OPTIONS} value={occasions} onChange={setOccasions} /></Sec>
          <Sec title="Always avoid">
            <textarea value={dislikes} onChange={e => setDislikes(e.target.value)}
              placeholder="e.g. nobody likes bitter gourd, avoid too much garlic..."
              rows={3} style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 14, outline: 'none', fontFamily: 'inherit', background: 'white', resize: 'none', lineHeight: 1.5 }} />
          </Sec>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-deep)', marginBottom: 14 }}>🛒 Quick Commerce</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {QC_OPTIONS.map(app => {
              const active = qcApps.includes(app.key)
              return (
                <button key={app.key} type="button" onClick={() => setQcApps(p => active ? p.filter(k => k !== app.key) : [...p, app.key])} style={{
                  padding: '12px 16px', borderRadius: 12, border: '2px solid', cursor: 'pointer',
                  borderColor: active ? 'var(--green-mid)' : 'var(--border)',
                  background: active ? 'var(--green-pale)' : 'white',
                  display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left'
                }}>
                  <span style={{ fontSize: 20 }}>{app.emoji}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: active ? 'var(--green-deep)' : 'var(--text-primary)', flex: 1 }}>{app.name}</span>
                  {active && <span style={{ color: 'var(--green-mid)', fontWeight: 700 }}>✓</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px 32px', background: 'rgba(250,250,248,0.97)', backdropFilter: 'blur(10px)', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 430, margin: '0 auto' }}>
          <button onClick={save} disabled={saving} style={{
            width: '100%', padding: '14px', borderRadius: 14, border: 'none',
            background: saved ? 'var(--green-soft)' : saving ? 'var(--green-soft)' : 'var(--green-mid)',
            color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(45,106,79,0.25)'
          }}>
            {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
