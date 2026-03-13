'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/components/AppProvider'

const CUISINE_OPTIONS = ['Maharashtrian', 'North Indian', 'South Indian', 'Punjabi', 'Gujarati', 'Bengali', 'Continental', 'Chinese', 'Italian']
const QC_OPTIONS = [
  { key: 'blinkit',   name: 'Blinkit',           emoji: '🟡' },
  { key: 'zepto',     name: 'Zepto',             emoji: '🟣' },
  { key: 'swiggy',    name: 'Swiggy Instamart',  emoji: '🟠' },
  { key: 'bigbasket', name: 'BigBasket',         emoji: '🟢' },
]
const DIETARY_OPTIONS = ['No restrictions', 'Vegetarian', 'Vegan', 'Jain', 'Eggetarian']
const TOTAL_STEPS = 4

export default function OnboardingPage() {
  const router = useRouter()
  const { user, household } = useApp()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Step 1 — household name
  const [householdName, setHouseholdName] = useState('')

  // Step 2 — member display names
  const [memberNames, setMemberNames] = useState<Record<string, string>>({})

  // Step 3 — food preferences
  const [dietary, setDietary] = useState('No restrictions')
  const [cuisines, setCuisines] = useState<string[]>([])
  const [dislikes, setDislikes] = useState('')

  // Step 4 — quick commerce
  const [qcApps, setQcApps] = useState<string[]>(['blinkit'])

  // Fetch existing household members for step 2
  const [members, setMembers] = useState<{ username: string }[]>([])
  useEffect(() => {
    if (household) setHouseholdName(household.name)
    fetch('/api/admin/users').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setMembers(d)
    })
    fetch('/api/preferences').then(r => r.json()).then(d => {
      if (!d.error) {
        if (d.member_names) setMemberNames(d.member_names)
        if (d.dietary) setDietary(d.dietary)
        if (d.cuisine_prefs) setCuisines(d.cuisine_prefs)
        if (d.dislikes) setDislikes(d.dislikes)
        if (d.quickcommerce) setQcApps(d.quickcommerce)
      }
    })
  }, [household])

  async function saveAndContinue() {
    setSaving(true)
    if (step === 1) {
      // Update household name
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
        body: JSON.stringify({ dietary, cuisine_prefs: cuisines, dislikes })
      })
    } else if (step === 4) {
      // Final step — save everything and mark complete
      await fetch('/api/preferences', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quickcommerce: qcApps, onboarding_complete: true })
      })
      setSaving(false)
      router.push('/dashboard')
      return
    }
    setSaving(false)
    setStep(s => s + 1)
  }

  if (!user) return null

  const progress = (step / TOTAL_STEPS) * 100

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column' }}>
      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--border)', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10 }}>
        <div style={{ height: '100%', background: 'var(--green-mid)', width: `${progress}%`, transition: 'width 0.4s ease', borderRadius: '0 2px 2px 0' }} />
      </div>

      {/* Header */}
      <div style={{ padding: '56px 24px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>
          {step === 1 ? '🏠' : step === 2 ? '👋' : step === 3 ? '🍽️' : '🛒'}
        </div>
        <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--green-mid)', marginBottom: 8 }}>
          Step {step} of {TOTAL_STEPS}
        </p>
        <h1 className="font-display" style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
          {step === 1 ? "Your Kitchen's Name" : step === 2 ? "Who's in the Kitchen?" : step === 3 ? 'Your Food Preferences' : 'Where Do You Order From?'}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {step === 1 ? "Give your household a name — this appears in your app header" :
           step === 2 ? "Add display names so greetings feel personal" :
           step === 3 ? "This helps GroceryMind suggest meals you'll actually want to eat" :
           "We'll add quick links to the order list for faster grocery runs"}
        </p>
      </div>

      {/* Step content */}
      <div style={{ flex: 1, padding: '0 24px 120px' }}>

        {/* Step 1 — Household name */}
        {step === 1 && (
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>Household name</label>
            <input autoFocus value={householdName} onChange={e => setHouseholdName(e.target.value)}
              placeholder="e.g. The Sharma Home"
              style={{ width: '100%', padding: '14px 16px', borderRadius: 14, border: '1.5px solid var(--border)', fontSize: 16, outline: 'none', fontFamily: 'inherit', background: 'white' }} />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>You can always change this later in Settings.</p>
          </div>
        )}

        {/* Step 2 — Member names */}
        {step === 2 && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Set a display name for each household member (username → first name).
            </p>
            {members.map(m => (
              <div key={m.username} style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>
                  @{m.username}
                </label>
                <input
                  value={memberNames[m.username] || ''}
                  onChange={e => setMemberNames(p => ({ ...p, [m.username]: e.target.value }))}
                  placeholder={`Display name for ${m.username}`}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 15, outline: 'none', fontFamily: 'inherit', background: 'white' }} />
              </div>
            ))}
          </div>
        )}

        {/* Step 3 — Food preferences */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>Dietary preference</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {DIETARY_OPTIONS.map(d => (
                  <button key={d} onClick={() => setDietary(d)} style={{
                    padding: '8px 16px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    background: dietary === d ? 'var(--green-mid)' : 'white',
                    color: dietary === d ? 'white' : 'var(--text-secondary)',
                    boxShadow: 'var(--shadow)'
                  }}>{d}</button>
                ))}
              </div>
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>Cuisines you cook most</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {CUISINE_OPTIONS.map(c => {
                  const active = cuisines.includes(c)
                  return (
                    <button key={c} onClick={() => setCuisines(p => active ? p.filter(x => x !== c) : [...p, c])} style={{
                      padding: '8px 14px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                      background: active ? 'var(--green-mid)' : 'white',
                      color: active ? 'white' : 'var(--text-secondary)',
                      boxShadow: 'var(--shadow)'
                    }}>{c}</button>
                  )
                })}
              </div>
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>Ingredients or dishes to avoid</p>
              <textarea value={dislikes} onChange={e => setDislikes(e.target.value)}
                placeholder="e.g. nobody likes bitter gourd, avoid too much garlic, no karela..."
                rows={3}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 14, outline: 'none', fontFamily: 'inherit', background: 'white', resize: 'none', lineHeight: 1.5 }} />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Gemini reads this every time it makes a suggestion.</p>
            </div>
          </div>
        )}

        {/* Step 4 — Quick commerce */}
        {step === 4 && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Select apps you use — quick links will appear on your order list.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {QC_OPTIONS.map(app => {
                const active = qcApps.includes(app.key)
                return (
                  <button key={app.key} onClick={() => setQcApps(p => active ? p.filter(k => k !== app.key) : [...p, app.key])} style={{
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
      </div>

      {/* Footer CTA */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px 24px 32px', background: 'rgba(250,250,248,0.97)', backdropFilter: 'blur(10px)', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 430, margin: '0 auto' }}>
          <button onClick={saveAndContinue} disabled={saving || (step === 1 && !householdName.trim())} style={{
            width: '100%', padding: '15px', borderRadius: 14, border: 'none',
            background: saving ? 'var(--green-soft)' : 'var(--green-mid)', color: 'white',
            fontSize: 16, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(45,106,79,0.3)',
            opacity: (step === 1 && !householdName.trim()) ? 0.5 : 1
          }}>
            {saving ? 'Saving...' : step === TOTAL_STEPS ? "Let's go 🎉" : 'Continue →'}
          </button>
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)} style={{ width: '100%', marginTop: 10, padding: '10px', border: 'none', background: 'none', fontSize: 14, color: 'var(--text-muted)', cursor: 'pointer' }}>
              ← Back
            </button>
          )}
          {step < TOTAL_STEPS && (
            <button onClick={() => setStep(s => s + 1)} style={{ width: '100%', marginTop: 4, padding: '8px', border: 'none', background: 'none', fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>
              Skip for now
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
