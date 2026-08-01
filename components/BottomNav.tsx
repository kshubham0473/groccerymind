'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Four destinations. Discover is no longer a tab — it lives behind
// "Browse all" on the home screen, where choosing actually happens.
const NAV = [
  { href: '/dashboard', label: 'Tonight' },
  { href: '/meal-plan', label: 'Week'    },
  { href: '/pantry',    label: 'Kitchen' },
  { href: '/orders',    label: 'List'    },
]

export default function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="nav">
      <div className="nav-inner">
        {NAV.map(({ href, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href} prefetch className="nav-item tap"
                  aria-current={active ? 'page' : undefined}>
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
