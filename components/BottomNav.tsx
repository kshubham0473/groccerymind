'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/dashboard', icon: '/icons/home.svg',     label: 'Home'     },
  { href: '/meal-plan', icon: '/icons/meals.svg',    label: 'Meals'    },
  { href: '/pantry',    icon: '/icons/pantry.svg',   label: 'Pantry'   },
  { href: '/orders',    icon: '/icons/orders.svg',   label: 'Orders'   },
  { href: '/discover',  icon: '/icons/discover.svg', label: 'Discover' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="bottom-nav" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      <div style={{ display: 'flex', maxWidth: 430, margin: '0 auto' }}>
        {NAV.map(({ href, icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href} prefetch={true} style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '10px 4px 8px',
              textDecoration: 'none',
              position: 'relative',
              color: active ? 'var(--green-mid)' : 'var(--text-muted)',
              background: active ? 'rgba(45,106,79,0.07)' : 'transparent',
              borderRadius: 12,
            }}>
              {/* Active indicator bar */}
              {active && (
                <span style={{
                  position: 'absolute', top: 0, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 24, height: 3,
                  background: 'var(--green-mid)',
                  borderRadius: '0 0 3px 3px',
                }} />
              )}

              {/* Icon — rendered as img, tinted via CSS filter */}
              <span style={{
                width: 22, height: 22,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 3,
              }}>
                <img
                  src={icon}
                  alt={label}
                  width={22}
                  height={22}
                  style={{
                    // CSS filter to tint: active = green-mid (#2D6A4F), inactive = muted grey
                    filter: active
                      ? 'invert(38%) sepia(30%) saturate(780%) hue-rotate(103deg) brightness(85%) contrast(90%)'
                      : 'invert(60%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(80%) contrast(90%)',
                    width: 22,
                    height: 22,
                    objectFit: 'contain',
                  }}
                />
              </span>

              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
