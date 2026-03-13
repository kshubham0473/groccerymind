'use client'
import { useState, useEffect } from 'react'
import { useApp } from '@/components/AppProvider'

const CUISINE_OPTIONS = ['Maharashtrian', 'North Indian', 'South Indian', 'Punjabi', 'Gujarati', 'Bengali', 'Continental', 'Chinese', 'Italian']
const QC_OPTIONS = [
  { key: 'blinkit',   name: 'Blinkit',           emoji: '🟡' },
  { key: 'zepto',     name: 'Zepto',             emoji: '🟣' },
  { key: 'swiggy',    name: 'Swiggy Instamart',  emoji: '🟠' },
  { key: 'bigbasket', name: 'BigBasket',         emoji: '🟢' },
]
const DIETARY_OPTIONS = ['No restrictions', 'Vegetarian', 'Vegan', 'Jain', 'Eggetarian']

export default function SettingsPage() {
  const { user, household } = useApp()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [members, setMembers] = useState<{ username: string }[]>([])

  const [householdName, setHouseholdName] = useState('')
  const [memberNames, setMemberNames] = useState<Record<string, string>>({})
  const [dietary, setDietary] = useState('No restrictions')
  const [cuisines, setCuisines] = useState<string[]>([])
  const [dislikes, setDislikes] = useState('')
  const [qcApps, setQcApps] = useState<string[]>([])

  useEffect(() => {
    if (household) setHouseholdName(household.name)
    fetch('/api/admin/users').then(r => r.json()).then(d => { if (Array.isArray(d)) setMembers(d) })
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

  async function save() {
    setSaving(true)
    await fetch('/api/preferences', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ household_name: householdName, member_names: memberNames, dietary, cuisine_prefs: cuisines, dislikes, quickcommerce: qcApps })
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
      </div>

      <div style={{ padding: '16px 16px 100px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Household name */}
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>Household Name</p>
          <input value={householdName} onChange={e => setHouseholdName(e.target.value)}
            style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 15, outline: 'none', fontFamily: 'inherit', background: 'white' }} />
        </div>

        {/* Member display names */}
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>Display Names</p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>Used in greetings and lock notifications</p>
          {members.map(m => (
            <div key={m.username} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, minWidth: 80 }}>@{m.username}</span>
              <input value={memberNames[m.username] || ''} onChange={e => setMemberNames(p => ({ ...p, [m.username]: e.target.value }))}
                placeholder="First name"
                style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
            </div>
          ))}
        </div>

        {/* Dietary */}
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>Dietary Preference</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {DIETARY_OPTIONS.map(d => (
              <button key={d} onClick={() => setDietary(d)} style={{
                padding: '7px 14px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: dietary === d ? 'var(--green-mid)' : 'white',
                color: dietary === d ? 'white' : 'var(--text-secondary)',
                boxShadow: 'var(--shadow)'
              }}>{d}</button>
            ))}
          </div>
        </div>

        {/* Cuisines */}
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>Cuisines You Cook</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CUISINE_OPTIONS.map(c => {
              const active = cuisines.includes(c)
              return (
                <button key={c} onClick={() => setCuisines(p => active ? p.filter(x => x !== c) : [...p, c])} style={{
                  padding: '7px 14px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: active ? 'var(--green-mid)' : 'white',
                  color: active ? 'white' : 'var(--text-secondary)',
                  boxShadow: 'var(--shadow)'
                }}>{c}</button>
              )
            })}
          </div>
        </div>

        {/* Dislikes */}
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>Avoid / Dislikes</p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>Gemini reads this every time it makes a suggestion</p>
          <textarea value={dislikes} onChange={e => setDislikes(e.target.value)}
            placeholder="e.g. nobody likes bitter gourd, avoid too much garlic..."
            rows={3}
            style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 14, outline: 'none', fontFamily: 'inherit', background: 'white', resize: 'none', lineHeight: 1.5 }} />
        </div>

        {/* Quick commerce */}
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>Quick Commerce Apps</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {QC_OPTIONS.map(app => {
              const active = qcApps.includes(app.key)
              return (
                <button key={app.key} onClick={() => setQcApps(p => active ? p.filter(k => k !== app.key) : [...p, app.key])} style={{
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

      {/* Save footer */}
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
