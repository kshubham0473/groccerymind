'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/dashboard', emoji: '🏠', label: 'Home' },
  { href: '/meal-plan', emoji: '📋', label: 'Meals' },
  { href: '/pantry',    emoji: '🥬', label: 'Pantry' },
  { href: '/orders',    emoji: '🛒', label: 'Orders' },
  { href: '/discover',  emoji: '🍳', label: 'Discover' },
]

export default function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="bottom-nav fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex max-w-lg mx-auto">
        {NAV.map(({ href, emoji, label }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href}
              className="flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-all relative"
              style={{ color: active ? 'var(--green-mid)' : 'var(--text-muted)' }}>
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full"
                  style={{ background: 'var(--green-mid)' }} />
              )}
              <span className="text-lg leading-none" style={{
                filter: active ? 'none' : 'grayscale(0.4)',
                transform: active ? 'scale(1.15)' : 'scale(1)',
                transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)'
              }}>{emoji}</span>
              <span className="text-xs font-bold" style={{ fontFamily: 'Nunito', fontSize: '10px' }}>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
