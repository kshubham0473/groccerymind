'use client'
import { useEffect, useState } from 'react'
import { useApp } from '@/components/AppProvider'
import { PantryItem } from '@/types'

const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']

export default function Dashboard() {
  const { user, household, logout } = useApp()
  const [lowItems, setLowItems] = useState<PantryItem[]>([])
  const [todaySlots, setTodaySlots] = useState<any[]>([])
  const [suggestion, setSuggestion] = useState<{ lunch: string | null; dinner: string | null; reason: string } | null>(null)
  const [suggestionLoading, setSuggestionLoading] = useState(true)
  const [confirmedMeals, setConfirmedMeals] = useState<{ lunch?: string; dinner?: string }>({})
  const today = DAYS[new Date().getDay()]

  useEffect(() => {
    fetch('/api/pantry').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setLowItems(data.filter((i: PantryItem) => i.stock_status !== 'good'))
    })
    fetch('/api/meal-plan').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setTodaySlots(data.filter((s: any) => s.day === today))
    })
    // Fetch LLM suggestion
    fetch(`/api/suggest/meal?day=${today}`)
      .then(r => r.json())
      .then(data => { setSuggestion(data.suggestion); setSuggestionLoading(false) })
      .catch(() => setSuggestionLoading(false))
  }, [today])

  const todayLunch = todaySlots.filter(s => s.slot === 'lunch')
  const todayDinner = todaySlots.filter(s => s.slot === 'dinner')

  async function confirmMeal(slot: 'lunch' | 'dinner', dishName: string) {
    setConfirmedMeals(prev => ({ ...prev, [slot]: dishName }))
    await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'cooked', metadata: { dish_name: dishName, slot, day: today } })
    })
  }

  async function addToOrder(itemName: string) {
    await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_name: itemName, source: 'pantry' })
    })
    setLowItems(prev => prev.filter(i => i.name !== itemName))
  }

  if (!user) return null

  const greetingHour = new Date().getHours()
  const greeting = greetingHour < 12 ? 'Good morning' : greetingHour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="max-w-lg mx-auto px-4 py-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="text-2xl font-bold mt-0.5" style={{ fontFamily: 'Playfair Display', color: 'var(--green-deep)' }}>
            {greeting} 👋
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{household?.name}</p>
        </div>
        <button onClick={logout} className="text-xs px-3 py-1.5 rounded-full border transition-all"
          style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
          Sign out
        </button>
      </div>

      {/* LLM Smart suggestion card */}
      <div className="kitchen-card p-5 mb-4" style={{ borderLeft: '3px solid var(--green-mid)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">✨</span>
          <h2 className="font-semibold text-sm uppercase tracking-wide" style={{ color: 'var(--green-mid)' }}>
            Smart Pick for Today
          </h2>
        </div>

        {suggestionLoading ? (
          <div className="space-y-2">
            <div className="h-4 rounded-full animate-pulse" style={{ background: 'var(--green-light)', width: '70%' }} />
            <div className="h-4 rounded-full animate-pulse" style={{ background: 'var(--green-light)', width: '50%' }} />
          </div>
        ) : suggestion ? (
          <>
            <p className="text-xs mb-3 italic" style={{ color: 'var(--text-muted)' }}>
              {suggestion.reason}
            </p>
            <div className="space-y-2">
              {suggestion.lunch && (
                <div className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: confirmedMeals.lunch ? 'var(--green-light)' : 'var(--warm-white)' }}>
                  <div>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>☀️ Lunch</p>
                    <p className="font-semibold text-sm mt-0.5">{suggestion.lunch}</p>
                  </div>
                  {confirmedMeals.lunch ? (
                    <span className="text-xs font-semibold px-3 py-1.5 rounded-full"
                      style={{ background: 'var(--green-mid)', color: 'white' }}>✓ Confirmed</span>
                  ) : (
                    <button onClick={() => confirmMeal('lunch', suggestion.lunch!)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all active:scale-95"
                      style={{ background: 'var(--green-light)', color: 'var(--green-deep)' }}>
                      Making this
                    </button>
                  )}
                </div>
              )}
              {suggestion.dinner && (
                <div className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: confirmedMeals.dinner ? 'var(--green-light)' : 'var(--warm-white)' }}>
                  <div>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>🌙 Dinner</p>
                    <p className="font-semibold text-sm mt-0.5">{suggestion.dinner}</p>
                  </div>
                  {confirmedMeals.dinner ? (
                    <span className="text-xs font-semibold px-3 py-1.5 rounded-full"
                      style={{ background: 'var(--green-mid)', color: 'white' }}>✓ Confirmed</span>
                  ) : (
                    <button onClick={() => confirmMeal('dinner', suggestion.dinner!)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all active:scale-95"
                      style={{ background: 'var(--green-light)', color: 'var(--green-deep)' }}>
                      Making this
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Add meal options and pantry items to get smart suggestions.
          </p>
        )}
      </div>

      {/* All options for today */}
      <div className="kitchen-card p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">📋</span>
          <h2 className="font-semibold text-sm uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            All Options Today
          </h2>
        </div>
        <div className="space-y-3">
          {[{ label: '☀️ Lunch', items: todayLunch }, { label: '🌙 Dinner', items: todayDinner }].map(({ label, items }) => (
            <div key={label}>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>{label}</p>
              {items.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nothing planned</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {items.map((s: any) => {
                    const isConfirmed = confirmedMeals[s.slot as 'lunch'|'dinner'] === s.dish?.name
                    return (
                      <button key={s.id}
                        onClick={() => confirmMeal(s.slot, s.dish?.name)}
                        className="px-3 py-1.5 rounded-full text-sm font-medium transition-all active:scale-95"
                        style={{
                          background: isConfirmed ? 'var(--green-mid)' : 'var(--green-light)',
                          color: isConfirmed ? 'white' : 'var(--green-deep)'
                        }}>
                        {isConfirmed ? '✓ ' : ''}{s.dish?.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pantry alerts */}
      {lowItems.length > 0 && (
        <div className="kitchen-card p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">⚠️</span>
            <h2 className="font-semibold text-sm uppercase tracking-wide" style={{ color: 'var(--amber)' }}>
              Pantry Alerts
            </h2>
          </div>
          <div className="space-y-2">
            {lowItems.map(item => (
              <div key={item.id} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: item.stock_status === 'finished' ? 'var(--red-soft)' : 'var(--amber)' }} />
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                    style={{ background: item.stock_status === 'finished' ? '#FFF0F0' : 'var(--amber-light)',
                             color: item.stock_status === 'finished' ? 'var(--red-soft)' : '#C47A2A' }}>
                    {item.stock_status}
                  </span>
                </div>
                <button onClick={() => addToOrder(item.name)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all active:scale-95"
                  style={{ background: 'var(--green-light)', color: 'var(--green-deep)' }}>
                  + Order
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick nav */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { href: '/pantry', emoji: '🥬', label: 'Pantry', sub: 'Check stock' },
          { href: '/orders', emoji: '🛒', label: 'Orders', sub: 'Your list' },
          { href: '/meal-plan', emoji: '📅', label: 'Meal Plan', sub: 'Full week' },
          ...(user.role === 'admin' ? [{ href: '/admin', emoji: '⚙️', label: 'Admin', sub: 'Manage users' }] : [])
        ].map(({ href, emoji, label, sub }) => (
          <a key={href} href={href} className="kitchen-card p-4 flex items-center gap-3 active:scale-95 transition-all">
            <span className="text-2xl">{emoji}</span>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--green-deep)' }}>{label}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
