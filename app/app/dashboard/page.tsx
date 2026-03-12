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
  const [confirmedMeals, setConfirmedMeals] = useState<{ lunch?: string; dinner?: string }>({})
  const today = DAYS[new Date().getDay()]

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const greetEmoji = hour < 12 ? '🌤️' : hour < 17 ? '☀️' : '🌙'

  useEffect(() => {
    // Run depletion estimator silently on load
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

  async function confirmMeal(slot: 'lunch'|'dinner', dishName: string) {
    setConfirmedMeals(prev => ({ ...prev, [slot]: dishName }))
    await fetch('/api/log', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'cooked', metadata: { dish_name: dishName, slot, day: today } })
    })
  }

  async function addToOrder(itemName: string) {
    await fetch('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_name: itemName, source: 'pantry' })
    })
    setLowItems(prev => prev.filter(i => i.name !== itemName))
  }

  const todayLunch = todaySlots.filter(s => s.slot === 'lunch')
  const todayDinner = todaySlots.filter(s => s.slot === 'dinner')

  if (!user) return null

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      {/* ── Page header ── */}
      <div className="page-header px-5 pt-10 pb-10 mb-0">
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold mb-1 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Lora, serif' }}>
              {greetEmoji} {greeting}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>{household?.name}</p>
          </div>
          <button onClick={logout}
            className="text-xs px-3 py-1.5 rounded-full font-semibold transition-all mt-1"
            style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)' }}>
            Sign out
          </button>
        </div>
      </div>

      <div className="px-4 -mt-2 space-y-4 pb-8">
        {/* ── Smart Pick card ── */}
        <div className="kitchen-card overflow-hidden animate-slide-up stagger-1">
          <div className="px-5 pt-4 pb-3 flex items-center gap-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <span className="text-base">✨</span>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--green-mid)' }}>Smart Pick · Today</p>
          </div>
          <div className="p-5">
            {suggestionLoading ? (
              <div className="space-y-2">
                <div className="shimmer h-3 w-3/4" />
                <div className="shimmer h-3 w-1/2" />
                <div className="shimmer h-10 w-full mt-3 rounded-xl" />
              </div>
            ) : suggestion ? (
              <>
                <p className="text-xs italic mb-4 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  "{suggestion.reason}"
                </p>
                <div className="space-y-2">
                  {[{ slot: 'lunch' as const, label: '☀️ Lunch', dish: suggestion.lunch },
                    { slot: 'dinner' as const, label: '🌙 Dinner', dish: suggestion.dinner }
                  ].filter(s => s.dish).map(({ slot, label, dish }) => (
                    <div key={slot} className="flex items-center justify-between p-3 rounded-2xl transition-all"
                      style={{ background: confirmedMeals[slot] ? 'var(--green-light)' : 'var(--warm-white)' }}>
                      <div>
                        <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</p>
                        <p className="font-bold text-sm mt-0.5" style={{ fontFamily: 'Lora, serif' }}>{dish}</p>
                      </div>
                      {confirmedMeals[slot] ? (
                        <span className="pill" style={{ background: 'var(--green-mid)', color: 'white' }}>✓ Done</span>
                      ) : (
                        <button onClick={() => confirmMeal(slot, dish!)}
                          className="pill transition-all active:scale-95"
                          style={{ background: 'var(--green-deep)', color: 'white' }}>
                          Making this
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Add meal options and pantry items to get smart suggestions.
              </p>
            )}
          </div>
        </div>

        {/* ── Today's full menu — chalkboard style ── */}
        <div className="chalkboard p-5 animate-slide-up stagger-2">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <span>🍽️</span>
              <p className="text-xs font-bold uppercase tracking-widest chalkboard-text" style={{ opacity: 0.7 }}>
                Today's Menu
              </p>
            </div>
            {[{ label: '☀️ Lunch', items: todayLunch }, { label: '🌙 Dinner', items: todayDinner }].map(({ label, items }) => (
              <div key={label} className="mb-4 last:mb-0">
                <p className="text-xs mb-2 font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</p>
                {items.length === 0 ? (
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Nothing planned</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {items.map((s: any) => {
                      const isConfirmed = confirmedMeals[s.slot as 'lunch'|'dinner'] === s.dish?.name
                      return (
                        <button key={s.id} onClick={() => confirmMeal(s.slot, s.dish?.name)}
                          className="px-3 py-1.5 rounded-full text-sm font-semibold transition-all active:scale-95"
                          style={{
                            background: isConfirmed ? 'var(--green-soft)' : 'rgba(255,255,255,0.12)',
                            color: isConfirmed ? 'white' : 'rgba(255,255,255,0.85)',
                            border: isConfirmed ? 'none' : '1px solid rgba(255,255,255,0.15)',
                            fontFamily: 'Lora, serif',
                            fontStyle: 'italic'
                          }}>
                          {isConfirmed && '✓ '}{s.dish?.name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Pantry alerts ── */}
        {lowItems.length > 0 && (
          <div className="kitchen-card-warm p-5 animate-slide-up stagger-3"
            style={{ borderLeft: '3px solid var(--amber)' }}>
            <div className="flex items-center gap-2 mb-3">
              <span>⚠️</span>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--amber)' }}>
                Pantry Alerts · {lowItems.length} item{lowItems.length > 1 ? 's' : ''}
              </p>
            </div>
            <div className="space-y-2">
              {lowItems.map(item => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: item.stock_status === 'finished' ? 'var(--red-soft)' : 'var(--amber-warm)' }} />
                    <span className="text-sm font-semibold">{item.name}</span>
                    <span className="pill text-xs capitalize"
                      style={item.stock_status === 'finished'
                        ? { background: '#FEE2E2', color: '#991B1B' }
                        : { background: '#FEF3C7', color: '#92400E' }}>
                      {item.stock_status}
                    </span>
                  </div>
                  <button onClick={() => addToOrder(item.name)}
                    className="pill transition-all active:scale-95"
                    style={{ background: 'var(--green-light)', color: 'var(--green-deep)' }}>
                    + Order
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Quick nav grid ── */}
        <div className="grid grid-cols-2 gap-3 animate-slide-up stagger-4">
          {[
            { href: '/pantry',    emoji: '🥬', label: 'Pantry',    sub: 'Check stock levels' },
            { href: '/orders',    emoji: '🛒', label: 'Orders',    sub: 'Your shopping list' },
            { href: '/meal-plan', emoji: '📅', label: 'Meal Plan', sub: 'Weekly menu' },
            { href: '/discover',  emoji: '🍳', label: 'Discover',  sub: 'Find new dishes' },
          ].map(({ href, emoji, label, sub }) => (
            <a key={href} href={href}
              className="kitchen-card p-4 flex items-center gap-3 active:scale-95 transition-all">
              <span className="text-2xl">{emoji}</span>
              <div>
                <p className="font-bold text-sm" style={{ color: 'var(--green-deep)', fontFamily: 'Lora, serif' }}>{label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>
              </div>
            </a>
          ))}
        </div>

        {user.role === 'admin' && (
          <a href="/admin" className="kitchen-card p-4 flex items-center gap-3 active:scale-95 transition-all animate-slide-up stagger-5">
            <span className="text-2xl">⚙️</span>
            <div>
              <p className="font-bold text-sm" style={{ color: 'var(--green-deep)', fontFamily: 'Lora, serif' }}>Admin</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Manage household members</p>
            </div>
          </a>
        )}
      </div>
    </div>
  )
}
