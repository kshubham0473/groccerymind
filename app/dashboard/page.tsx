'use client'
import { useEffect, useState } from 'react'
import { useApp } from '@/components/AppProvider'
import { PantryItem } from '@/types'

const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']

export default function Dashboard() {
  const { user, household, logout } = useApp()
  const [lowItems, setLowItems] = useState<PantryItem[]>([])
  const [todaySlots, setTodaySlots] = useState<any[]>([])
  const [suggestion, setSuggestion] = useState<{ lunch: string|null; dinner: string|null; reason: string }|null>(null)
  const [suggestionLoading, setSuggestionLoading] = useState(true)
  const [confirmed, setConfirmed] = useState<Record<string,boolean>>({})
  const today = DAYS[new Date().getDay()]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    fetch('/api/pantry/estimate', { method: 'POST' }).catch(() => {})
    fetch('/api/pantry').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setLowItems(d.filter((i: PantryItem) => i.stock_status !== 'good'))
    })
    fetch('/api/meal-plan').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setTodaySlots(d.filter((s: any) => s.day === today))
    })
    fetch(`/api/suggest/meal?day=${today}`)
      .then(r => r.json())
      .then(d => { setSuggestion(d.suggestion); setSuggestionLoading(false) })
      .catch(() => setSuggestionLoading(false))
  }, [today])

  async function confirmMeal(slot: string, dish: string) {
    setConfirmed(p => ({ ...p, [slot]: true }))
    await fetch('/api/log', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'cooked', metadata: { dish_name: dish, slot, day: today } })
    })
  }

  async function addToOrder(name: string) {
    await fetch('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_name: name, source: 'pantry' })
    })
    setLowItems(p => p.filter(i => i.name !== name))
  }

  const lunch = todaySlots.filter(s => s.slot === 'lunch')
  const dinner = todaySlots.filter(s => s.slot === 'dinner')
  if (!user) return null

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="page-header">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="font-display" style={{ color: 'white', fontSize: 24, fontWeight: 700, margin: 0 }}>
            {greeting}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 2 }}>{household?.name}</p>
        </div>
        <button onClick={logout} style={{
          position: 'absolute', top: 48, right: 20,
          background: 'rgba(255,255,255,0.15)', border: 'none', color: 'rgba(255,255,255,0.8)',
          padding: '6px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer'
        }}>Sign out</button>
      </div>

      <div style={{ padding: '16px 16px 24px' }}>

        {/* Smart Pick */}
        <div className="card fade-up" style={{ marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>✨</span>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--green-mid)' }}>Smart Pick · Today</span>
          </div>
          <div style={{ padding: 16 }}>
            {suggestionLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="skeleton" style={{ height: 12, width: '80%' }} />
                <div className="skeleton" style={{ height: 12, width: '60%' }} />
                <div className="skeleton" style={{ height: 44, width: '100%', marginTop: 4, borderRadius: 12 }} />
              </div>
            ) : suggestion ? (
              <>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: 12, lineHeight: 1.5 }}>
                  "{suggestion.reason}"
                </p>
                {[{ slot: 'lunch', label: 'Lunch', emoji: '☀️', dish: suggestion.lunch },
                  { slot: 'dinner', label: 'Dinner', emoji: '🌙', dish: suggestion.dinner }
                ].filter(s => s.dish).map(({ slot, label, emoji, dish }) => (
                  <div key={slot} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderRadius: 12, marginBottom: 8,
                    background: confirmed[slot] ? 'var(--green-light)' : 'var(--cream)'
                  }}>
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{emoji} {label}</p>
                      <p className="font-display" style={{ fontSize: 15, fontWeight: 700, marginTop: 1 }}>{dish}</p>
                    </div>
                    {confirmed[slot] ? (
                      <span className="pill badge-good">✓ Confirmed</span>
                    ) : (
                      <button onClick={() => confirmMeal(slot, dish!)} style={{
                        background: 'var(--green-deep)', color: 'white', border: 'none',
                        padding: '7px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer'
                      }}>Making this</button>
                    )}
                  </div>
                ))}
              </>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Add meal options and pantry items to get smart suggestions.</p>
            )}
          </div>
        </div>

        {/* Today's menu */}
        <div className="card fade-up delay-1" style={{ marginBottom: 12, background: '#1E3A2F', border: 'none' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>🍽️</span>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.5)' }}>Today's Menu</span>
          </div>
          <div style={{ padding: 16 }}>
            {[{ label: '☀️ Lunch', items: lunch }, { label: '🌙 Dinner', items: dinner }].map(({ label, items }) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginBottom: 6 }}>{label}</p>
                {items.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>Nothing planned</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {items.map((s: any) => (
                      <button key={s.id} onClick={() => confirmMeal(s.slot, s.dish?.name)} style={{
                        background: confirmed[s.slot] && s.dish?.name === confirmed[s.slot] ? 'var(--green-soft)' : 'rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.12)',
                        padding: '5px 12px', borderRadius: 99, fontSize: 13, fontWeight: 500, cursor: 'pointer'
                      }}>
                        {s.dish?.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Pantry alerts */}
        {lowItems.length > 0 && (
          <div className="card fade-up delay-2" style={{ marginBottom: 12, borderLeft: '3px solid var(--amber)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>⚠️</span>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--amber)' }}>
                Pantry Alerts · {lowItems.length}
              </span>
            </div>
            <div style={{ padding: '8px 16px 12px' }}>
              {lowItems.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: item.stock_status === 'finished' ? 'var(--red)' : 'var(--amber)', flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{item.name}</span>
                    <span className={`pill ${item.stock_status === 'finished' ? 'badge-finished' : 'badge-low'}`} style={{ fontSize: 11 }}>
                      {item.stock_status}
                    </span>
                  </div>
                  <button onClick={() => addToOrder(item.name)} style={{
                    background: 'var(--green-light)', color: 'var(--green-deep)', border: 'none',
                    padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer'
                  }}>+ Order</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick nav */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }} className="fade-up delay-3">
          {[
            { href: '/pantry',    emoji: '🥬', label: 'Pantry',    sub: 'Check stock' },
            { href: '/orders',    emoji: '🛒', label: 'Orders',    sub: 'Shopping list' },
            { href: '/meal-plan', emoji: '📋', label: 'Meal Plan', sub: 'Weekly menu' },
            { href: '/discover',  emoji: '🍳', label: 'Discover',  sub: 'New dishes' },
          ].map(({ href, emoji, label, sub }) => (
            <a key={href} href={href} className="card" style={{
              padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
              textDecoration: 'none', color: 'inherit'
            }}>
              <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{emoji}</span>
              <div style={{ minWidth: 0 }}>
                <p className="font-display" style={{ fontSize: 14, fontWeight: 700, color: 'var(--green-deep)' }}>{label}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</p>
              </div>
            </a>
          ))}
        </div>

        {user.role === 'admin' && (
          <a href="/admin" className="card fade-up delay-4" style={{
            padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
            textDecoration: 'none', color: 'inherit', marginTop: 10
          }}>
            <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>⚙️</span>
            <div>
              <p className="font-display" style={{ fontSize: 14, fontWeight: 700, color: 'var(--green-deep)' }}>Admin</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>Manage members</p>
            </div>
          </a>
        )}
      </div>
    </div>
  )
}
