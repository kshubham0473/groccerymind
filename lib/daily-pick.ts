/**
 * lib/daily-pick.ts
 *
 * Which of today's options is "the" pick.
 *
 * The dashboard currently decides this client-side (`options[pick % length]`),
 * which means two people in the same household can see different answers — the
 * open item in README-PATCH ("make the daily pick a server value so both people
 * see the same answer").
 *
 * A notification forces the issue: it has to NAME a dish, and the name it uses
 * must be the one the user sees when they open the app. So the pick becomes a
 * pure function of (household, date, slot) — deterministic, identical for both
 * partners and for the server, with no extra table and no write.
 *
 * Stable across processes and deploys: FNV-1a is fixed, so the same inputs give
 * the same dish forever. Changing the hash reshuffles everyone's picks, so
 * don't, unless that's the intent.
 */

/** FNV-1a, 32-bit. Chosen for being tiny and stable, not for cryptography. */
function fnv1a(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/**
 * Index into today's option list for this household + slot.
 * Returns 0 when there's nothing to choose from.
 */
export function dailyPickIndex(
  householdId: string,
  dateISO: string,
  slot: string,
  optionCount: number
): number {
  if (!optionCount || optionCount < 1) return 0
  return fnv1a(`${householdId}|${dateISO}|${slot}`) % optionCount
}

/** Convenience: pick the element itself. */
export function dailyPick<T>(
  items: T[],
  householdId: string,
  dateISO: string,
  slot: string
): T | null {
  if (!items?.length) return null
  return items[dailyPickIndex(householdId, dateISO, slot, items.length)]
}

// ── Time helpers (IST) ────────────────────────────────────────────────────────
// Vercel and Supabase both run UTC; every user is in India. Rather than pull in
// a date library, IST is a fixed +05:30 offset with no daylight saving — so the
// arithmetic below is exact, not an approximation.

const IST_OFFSET_MIN = 5 * 60 + 30

export function istNow(now: Date = new Date()): { date: string; minutes: number; day: string } {
  const shifted = new Date(now.getTime() + IST_OFFSET_MIN * 60_000)
  const date = shifted.toISOString().split('T')[0]
  const minutes = shifted.getUTCHours() * 60 + shifted.getUTCMinutes()
  const day = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
    shifted.getUTCDay()
  ]
  return { date, minutes, day }
}

/** Mirrors the dashboard's activeSlot(): before 3pm it's lunch, after it's dinner. */
export function slotForMinutes(minutes: number): 'lunch' | 'dinner' {
  return minutes < 15 * 60 ? 'lunch' : 'dinner'
}

/** Defaults until a household has enough history to learn from. */
export const DEFAULT_SEND_MINUTES: Record<'lunch' | 'dinner', number> = {
  lunch: 11 * 60,   // 11:00 IST
  dinner: 17 * 60,  // 17:00 IST
}
