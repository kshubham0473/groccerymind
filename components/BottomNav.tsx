'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Icon, { IconName } from './Icon'

const NAV: { href: string; icon: IconName; label: string }[] = [
  { href: '/dashboard', icon: 'home',     label: 'Home'     },
  { href: '/meal-plan', icon: 'meals',    label: 'Meals'    },
  { href: '/pantry',    icon: 'pantry',   label: 'Pantry'   },
  { href: '/orders',    icon: 'orders',   label: 'Orders'   },
  { href: '/discover',  icon: 'discover', label: 'Discover' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="bottom-nav" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      <div style={{ display: 'flex', maxWidth: 430, margin: '0 auto', padding: '6px 4px 10px' }}>
        {NAV.map(({ href, icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href} prefetch aria-current={active ? 'page' : undefined} style={{
              flex: 1, minHeight: 44,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              padding: '8px 4px', textDecoration: 'none',
              // Two signals only: colour + weight. No pill, no indicator bar.
              color: active ? 'var(--green-deep)' : 'var(--text-muted)',
            }}>
              <Icon name={icon} size={23} strokeWidth={active ? 2 : 1.7} />
              <span style={{ fontSize: 12, fontWeight: active ? 700 : 500 }}>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
