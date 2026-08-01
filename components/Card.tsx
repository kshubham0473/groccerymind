'use client'
import Icon, { IconName } from './Icon'

/**
 * The card-with-header pattern, previously re-typed in eight places with
 * drifting padding (11px 16px / 10px 16px 14px / 14px 16px) and radii.
 */
export default function Card({
  title, icon, iconColor, count, action, onAction, children, tone = 'default', style, ...rest
}: {
  title?: string
  icon?: IconName
  iconColor?: string
  count?: number | string
  action?: string
  onAction?: () => void
  children: React.ReactNode
  tone?: 'default' | 'warn'
  style?: React.CSSProperties
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="card" style={{ overflow: 'hidden', ...style }} {...rest}>
      {title && (
        <div className="card-header">
          <span className="card-title" style={tone === 'warn' ? { color: 'var(--amber)' } : undefined}>
            {icon && <Icon name={icon} size={17} style={{ color: iconColor || 'currentColor' }} />}
            {title}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {count !== undefined && count !== 0 && (
              <span style={{
                fontSize: 14, fontWeight: 700,
                color: tone === 'warn' ? 'var(--amber)' : 'var(--text-secondary)'
              }}>{count}</span>
            )}
            {action && (
              <button onClick={onAction} className="tap" style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                font: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--green-mid)'
              }}>{action}</button>
            )}
          </span>
        </div>
      )}
      {children}
    </div>
  )
}

/** Content-shaped loading state. Replaces the centred 28px emoji. */
export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="card-header"><div className="skeleton" style={{ height: 12, width: 110 }} /></div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card-row">
          <div className="skeleton" style={{ height: 15, width: `${45 + (i % 3) * 15}%` }} />
          <div className="skeleton" style={{ height: 36, width: 78, borderRadius: 99 }} />
        </div>
      ))}
    </div>
  )
}
