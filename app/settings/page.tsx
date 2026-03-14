'use client'
import { useState, useEffect } from 'react'
import { useApp } from '@/components/AppProvider'
import { useRouter } from 'next/navigation'

const DIETARY_OPTIONS = ['No restrictions', 'Vegetarian', 'Vegan', 'Jain', 'Eggetarian']
const CUISINE_OPTIONS = ['Maharashtrian', 'North Indian', 'South Indian', 'Punjabi', 'Gujarati', 'Bengali', 'Continental', 'Chinese', 'Italian']
const COMPLEXITY_OPTIONS = ['Simple & familiar', 'Some new things', 'Love experimenting']
const COOKING_TIME_OPTIONS = ['Under 20 mins', '20–40 mins', 'No limit']
const SPICE_OPTIONS = ['Mild', 'Medium', 'Spicy']
const VARIETY_OPTIONS = ['Stick to favourites', 'Some variety', 'Always try new']
const PROTEIN_OPTIONS = ['Paneer', 'Dal / Lentils', 'Eggs', 'Chicken', 'Tofu', 'Rajma / Chole', 'Soya']
const TEXTURE_OPTIONS = ['No preference', 'Dry sabzi', 'Gravy dishes', 'Rice meals', 'Breads & rotis', 'One-pot meals', 'Snacky / chaat']
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
  const { user, household, logout } = useApp()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [members, setMembers] = useState<{ id: string; username: string; role: string }[]>([])

  const [householdName, setHouseholdName] = useState('')
  const [memberNames, setMemberNames] = useState<Record<string, string>>({})
  const [dietary, setDietary] = useState('No restrictions')
  const [cuisines, setCuisines] = useState<string[]>([])
  const [complexity, setComplexity] = useState('Simple & familiar')
  const [cookingTime, setCookingTime] = useState('20–40 mins')
  const [spiceLevel, setSpiceLevel] = useState('Medium')
  const [variety, setVariety] = useState('Some variety')
  const [proteinPrefs, setProteinPrefs] = useState<string[]>([])
  const [texturePrefs, setTexturePrefs] = useState<string[]>(['No preference'])
  const [healthGoals, setHealthGoals] = useState<string[]>([])
  const [occasions, setOccasions] = useState<string[]>([])
  const [dislikes, setDislikes] = useState('')
  const [qcApps, setQcApps] = useState<string[]>([])

  // Admin state
  const [addingMember, setAddingMember] = useState(false)
  const [newMemberForm, setNewMemberForm] = useState({ username: '', password: '', role: 'member' })
  const [adminSaving, setAdminSaving] = useState(false)
  const [adminError, setAdminError] = useState('')

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
        dietary, cuisine_prefs: cuisines, dislikes, meal_complexity: complexity,
        cooking_time: cookingTime, spice_level: spiceLevel, meal_variety: variety,
        protein_prefs: proteinPrefs, texture_prefs: texturePrefs,
        health_goals: healthGoals, meal_occasions: occasions, quickcommerce: qcApps
      })
    })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  async function createMember(e: React.FormEvent) {
    e.preventDefault()
    setAdminSaving(true); setAdminError('')
    const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newMemberForm) })
    const d = await res.json()
    if (d.error) { setAdminError(d.error); setAdminSaving(false); return }
    setMembers(p => [...p, d]); setAddingMember(false)
    setNewMemberForm({ username: '', password: '', role: 'member' }); setAdminSaving(false)
  }

  const handleTextureChange = (v: string[]) => {
    if (v.includes('No preference') && !texturePrefs.includes('No preference')) setTexturePrefs(['No preference'])
    else setTexturePrefs(v.filter((x: string) => x !== 'No preference'))
  }

  if (!user) return null

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <div className="page-header">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Household</p>
          <h1 className="font-display" style={{ color: 'white', fontSize: 24, fontWeight: 700, margin: 0 }}>Settings</h1>
        </div>
        <a href="/dashboard" style={{ position: 'absolute', top: 48, right: 20, zIndex: 2, background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)', padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>← Home</a>
      </div>

      <div style={{ padding: '16px 16px 120px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Identity ── */}
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--green-deep)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🏠 Household</p>
          <Sec title="Name">
            <input value={householdName} onChange={e => setHouseholdName(e.target.value)}
              style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 15, outline: 'none', fontFamily: 'inherit', background: 'white' }} />
          </Sec>
          <Sec title="Display Names">
            {members.map(m => (
              <div key={m.username} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, minWidth: 88 }}>@{m.username}</span>
                <input value={memberNames[m.username] || ''} onChange={e => setMemberNames(p => ({ ...p, [m.username]: e.target.value }))}
                  placeholder="First name" style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
              </div>
            ))}
          </Sec>
        </div>

        {/* ── Food prefs ── */}
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--green-deep)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🍽️ Food Preferences</p>
          <Sec title="Dietary"><Chips options={DIETARY_OPTIONS} value={dietary} onChange={setDietary} single /></Sec>
          <Sec title="Cuisines you cook"><Chips options={CUISINE_OPTIONS} value={cuisines} onChange={setCuisines} /></Sec>
          <Sec title="Protein sources"><Chips options={PROTEIN_OPTIONS} value={proteinPrefs} onChange={setProteinPrefs} /></Sec>
          <Sec title="Preferred dish styles"><Chips options={TEXTURE_OPTIONS} value={texturePrefs} onChange={handleTextureChange} /></Sec>
          <Sec title="Cooking complexity"><Chips options={COMPLEXITY_OPTIONS} value={complexity} onChange={setComplexity} single /></Sec>
          <Sec title="Cooking time"><Chips options={COOKING_TIME_OPTIONS} value={cookingTime} onChange={setCookingTime} single /></Sec>
          <Sec title="Spice level"><Chips options={SPICE_OPTIONS} value={spiceLevel} onChange={setSpiceLevel} single /></Sec>
          <Sec title="Meal variety"><Chips options={VARIETY_OPTIONS} value={variety} onChange={setVariety} single /></Sec>
          <Sec title="Health goals"><Chips options={HEALTH_OPTIONS} value={healthGoals} onChange={setHealthGoals} /></Sec>
          <Sec title="You cook for"><Chips options={OCCASION_OPTIONS} value={occasions} onChange={setOccasions} /></Sec>
          <Sec title="Always avoid">
            <textarea value={dislikes} onChange={e => setDislikes(e.target.value)}
              placeholder="e.g. nobody likes bitter gourd..."
              rows={3} style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 14, outline: 'none', fontFamily: 'inherit', background: 'white', resize: 'none', lineHeight: 1.5 }} />
          </Sec>
        </div>

        {/* ── Quick commerce ── */}
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--green-deep)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🛒 Quick Commerce</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {QC_OPTIONS.map(app => {
              const active = qcApps.includes(app.key)
              return (
                <button key={app.key} type="button" onClick={() => setQcApps(p => active ? p.filter(k => k !== app.key) : [...p, app.key])} style={{
                  padding: '12px 16px', borderRadius: 12, border: '2px solid', cursor: 'pointer',
                  borderColor: active ? 'var(--green-mid)' : 'var(--border)',
                  background: active ? 'var(--green-pale)' : 'white',
                  display: 'flex', alignItems: 'center', gap: 12
                }}>
                  <span style={{ fontSize: 20 }}>{app.emoji}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: active ? 'var(--green-deep)' : 'var(--text-primary)', flex: 1 }}>{app.name}</span>
                  {active && <span style={{ color: 'var(--green-mid)', fontWeight: 700 }}>✓</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Admin section (admin only) ── */}
        {user.role === 'admin' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--green-deep)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>⚙️ Admin</p>
            </div>
            <div style={{ padding: '4px 0' }}>
              {members.map(m => (
                <div key={m.username} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>@{m.username}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0', textTransform: 'capitalize' }}>{m.role}</p>
                  </div>
                  <span className="pill" style={{ background: m.role === 'admin' ? 'var(--green-light)' : 'var(--cream)', color: m.role === 'admin' ? 'var(--green-deep)' : 'var(--text-muted)', border: '1px solid var(--border)', fontSize: 11 }}>{m.role}</span>
                </div>
              ))}
              {!addingMember ? (
                <button onClick={() => setAddingMember(true)} style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: 'var(--green-mid)', fontWeight: 600 }}>
                  + Add household member
                </button>
              ) : (
                <form onSubmit={createMember} style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input required value={newMemberForm.username} onChange={e => setNewMemberForm(p => ({ ...p, username: e.target.value.toLowerCase() }))}
                    placeholder="Username" style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
                  <input required type="password" value={newMemberForm.password} onChange={e => setNewMemberForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="Temporary password" style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
                  {adminError && <p style={{ fontSize: 13, color: 'var(--red)', margin: 0 }}>{adminError}</p>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" disabled={adminSaving} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--green-mid)', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                      {adminSaving ? 'Creating...' : 'Create'}
                    </button>
                    <button type="button" onClick={() => { setAddingMember(false); setAdminError('') }} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>Cancel</button>
                  </div>
                </form>
              )}
            </div>
            <div style={{ padding: '0 16px 4px', borderTop: '1px solid var(--border)' }}>
              <a href="/onboarding" style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'inherit', gap: 10 }}>
                <span>🔄</span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Re-run onboarding</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>Regenerate your meal plan from scratch</p>
                </div>
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 16 }}>›</span>
              </a>
              <button onClick={() => {
                Object.keys(localStorage).filter(k => k.startsWith('gm_mood_')).forEach(k => localStorage.removeItem(k))
                alert("Today's nudge reset — reopen dashboard to get a fresh one.")
              }} style={{
                width: '100%', padding: '12px 0', display: 'flex', alignItems: 'center', gap: 10,
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left'
              }}>
                <span>🗑️</span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Reset today's nudge</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>Clears cached nudge, shows a fresh one on next open</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── Sign out ── */}
        <button onClick={logout} style={{
          width: '100%', padding: '14px', borderRadius: 14,
          border: '1.5px solid var(--red-light)', background: 'var(--red-light)',
          color: 'var(--red)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit'
        }}>
          Sign out
        </button>
      </div>

      {/* Save footer */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '12px 16px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 8px))',
        background: 'rgba(250,250,248,0.97)', backdropFilter: 'blur(10px)',
        borderTop: '1px solid var(--border)', zIndex: 10
      }}>
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
