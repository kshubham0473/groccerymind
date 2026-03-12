'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/dashboard', emoji: '🏠', label: 'Home' },
  { href: '/meal-plan', emoji: '📋', label: 'Meals' },
  { href: '/pantry', emoji: '🥬', label: 'Pantry' },
  { href: '/orders', emoji: '🛒', label: 'Orders' },
]

export default function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t" style={{ background: 'white', borderColor: 'var(--border)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex">
        {NAV.map(({ href, emoji, label }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href} className="flex-1 flex flex-col items-center py-3 gap-0.5 transition-all"
              style={{ color: active ? 'var(--green-mid)' : 'var(--text-muted)', background: active ? 'var(--green-pale)' : 'transparent' }}>
              <span className="text-xl leading-none">{emoji}</span>
              <span className="text-xs font-medium" style={{ fontFamily: 'DM Sans' }}>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
