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
    <nav className="bottom-nav" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      paddingBottom: 'env(safe-area-inset-bottom)'
    }}>
      <div style={{ display: 'flex', maxWidth: 430, margin: '0 auto' }}>
        {NAV.map(({ href, emoji, label }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '10px 4px 8px', textDecoration: 'none', position: 'relative',
              color: active ? 'var(--green-mid)' : 'var(--text-muted)'
            }}>
              {active && (
                <span style={{
                  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                  width: 24, height: 2, background: 'var(--green-mid)', borderRadius: 99
                }} />
              )}
              <span style={{ fontSize: 20, lineHeight: 1, marginBottom: 3 }}>{emoji}</span>
              <span style={{ fontSize: 10, fontWeight: 600 }}>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
