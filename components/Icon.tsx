'use client'

/**
 * One stroke icon set, inlined so every glyph inherits currentColor.
 * Replaces: emoji in card headers / slots / actions, and the
 * invert/sepia/hue-rotate filter chain on <img src="/icons/*.svg">.
 */

export type IconName =
  | 'home' | 'meals' | 'pantry' | 'orders' | 'discover'
  | 'settings' | 'check' | 'alert' | 'plus' | 'search'
  | 'trash' | 'sun' | 'moon' | 'spark' | 'chevron' | 'refresh' | 'clock' | 'more'

const PATHS: Record<IconName, React.ReactNode> = {
  home:     <><path d="M4 10.5L12 4l8 6.5V20H4z" /><path d="M10 20v-5h4v5" /></>,
  meals:    <><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  pantry:   <><rect x="3.5" y="6" width="17" height="13" rx="2" /><path d="M3.5 11h17M10 6v5M14 11v8" /></>,
  orders:   <><path d="M4 5h2.2l2.3 9.4h9.1L20 8H7" /><circle cx="10" cy="19" r="1.3" /><circle cx="17" cy="19" r="1.3" /></>,
  discover: <><path d="M12 3.5l2.4 6L20.5 11l-6.1 1.5L12 18.5l-2.4-6L3.5 11l6.1-1.5z" /></>,
  spark:    <><path d="M12 3l2.2 5.6L20 10l-5.8 1.4L12 17l-2.2-5.6L4 10l5.8-1.4z" /></>,
  settings: <><circle cx="12" cy="12" r="3.2" /><path d="M12 3v2.4M12 18.6V21M21 12h-2.4M5.4 12H3M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7M18.4 18.4l-1.7-1.7M7.3 7.3L5.6 5.6" /></>,
  check:    <><path d="M4 12.5l5 5L20 6.5" /></>,
  alert:    <><path d="M12 4.5L21 19.5H3z" /><path d="M12 10v4M12 16.6v.2" /></>,
  plus:     <><path d="M12 5v14M5 12h14" /></>,
  search:   <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  trash:    <><path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" /></>,
  sun:      <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4M18.7 18.7l-1.4-1.4M6.7 6.7L5.3 5.3" /></>,
  moon:     <><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" /></>,
  chevron:  <><path d="M9 5l7 7-7 7" /></>,
  refresh:  <><path d="M20 12a8 8 0 1 1-2.5-5.8" /><path d="M20 4v5h-5" /></>,
  clock:    <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  more:     <><circle cx="5.5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18.5" cy="12" r="1.2" /></>,
}

export default function Icon({
  name, size = 20, strokeWidth = 1.8, style,
}: { name: IconName; size?: number; strokeWidth?: number; style?: React.CSSProperties }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true" focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}
