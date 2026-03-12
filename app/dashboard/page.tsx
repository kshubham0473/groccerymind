'use client'
import { useEffect, useState } from 'react'
import { useApp } from '@/components/AppProvider'
import { PantryItem } from '@/types'

const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun'
}

export default function Dashboard() {
  const { user, household, logout } = useApp()
  const [lowItems, setLowItems] = useState<PantryItem[]>([])
  const [todaySlots, setTodaySlots] = useState<any[]>([])
  const today = DAYS[new Date().getDay()]

  useEffect(() => {
    fetch('/api/pantry').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setLowItems(data.filter((i: PantryItem) => i.stock_status !== 'good'))
    })
    fetch('/api/meal-plan').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setTodaySlots(data.filter((s: any) => s.day === today))
    })
  }, [today])

  const todayLunch = todaySlots.filter(s => s.slot === 'lunch')
  const todayDinner = todaySlots.filter(s => s.slot === 'dinner')

  async function addToOrder(itemName: string) {
    await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_name: itemName, source: 'pantry' })
    })
    setLowItems(prev => prev.filter(i => i.name !== itemName))
  }

  if (!user) return null

  return (
    <div className="max-w-lg mx-auto px-4 py-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="text-2xl font-bold mt-0.5" style={{ fontFamily: 'Playfair Display', color: 'var(--green-deep)' }}>
            Good morning 👋
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{household?.name}</p>
        </div>
        <button onClick={logout} className="text-xs px-3 py-1.5 rounded-full border transition-all"
          style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
          Sign out
        </button>
      </div>

      {/* Today's meals */}
      <div className="kitchen-card p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">📋</span>
          <h2 className="font-semibold text-base" style={{ color: 'var(--green-deep)' }}>
            Today's Menu — <span className="capitalize">{today}</span>
          </h2>
        </div>
        <div className="space-y-3">
          {[{ label: '☀️ Lunch', items: todayLunch }, { label: '🌙 Dinner', items: todayDinner }].map(({ label, items }) => (
            <div key={label}>
              <p className="text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
              {items.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nothing planned</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {items.map((s: any) => (
                    <span key={s.id} className="px-3 py-1.5 rounded-full text-sm font-medium"
                      style={{ background: 'var(--green-light)', color: 'var(--green-deep)' }}>
                      {s.dish?.name}
                    </span>
                  ))}
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
            <span className="text-xl">⚠️</span>
            <h2 className="font-semibold text-base" style={{ color: 'var(--amber)' }}>
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
                  + Add to order
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <a href="/pantry" className="kitchen-card p-4 flex items-center gap-3 active:scale-95 transition-all">
          <span className="text-2xl">🥬</span>
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--green-deep)' }}>Pantry</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Check stock</p>
          </div>
        </a>
        <a href="/orders" className="kitchen-card p-4 flex items-center gap-3 active:scale-95 transition-all">
          <span className="text-2xl">🛒</span>
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--green-deep)' }}>Orders</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Your list</p>
          </div>
        </a>
        <a href="/meal-plan" className="kitchen-card p-4 flex items-center gap-3 active:scale-95 transition-all">
          <span className="text-2xl">📅</span>
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--green-deep)' }}>Meal Plan</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Full week</p>
          </div>
        </a>
        {user.role === 'admin' && (
          <a href="/admin" className="kitchen-card p-4 flex items-center gap-3 active:scale-95 transition-all">
            <span className="text-2xl">⚙️</span>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--green-deep)' }}>Admin</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Manage users</p>
            </div>
          </a>
        )}
      </div>
    </div>
  )
}
