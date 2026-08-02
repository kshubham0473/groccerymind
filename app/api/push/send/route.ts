import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getSessionFromCookie } from '@/lib/auth'
import { sendToUsers, pushConfigured, type PushPayload } from '@/lib/push'
import { dailyPick, istNow, slotForMinutes, DEFAULT_SEND_MINUTES } from '@/lib/daily-pick'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/push/send — the nudge heartbeat.
 *
 * Called by pg_cron every 15 minutes (see supabase-push.sql). The cron is a
 * dumb ticker; ALL the timing logic lives here. That's deliberate:
 *
 *   - Vercel Hobby cron is capped at once per day, at an imprecise hour, in
 *     UTC. Useless for "17:00 IST, per household". pg_cron gives us a real
 *     15-minute tick for free.
 *   - Send times are per-household and learned, so they can't live in a cron
 *     expression anyway.
 *
 * Idempotent: notification_log has a unique key on
 * (household_id, send_date, slot, kind), so a double-fired tick cannot send
 * the same nudge twice.
 *
 * Manual testing:
 *   POST /api/push/send?dry=1        logged-in admin, shows what WOULD send
 *   POST /api/push/send?force=1      ignore the time window, send now
 */

const WINDOW_MIN = 15          // must match the pg_cron interval
const LEARN_MIN_SAMPLES = 5    // locks needed before we trust a learned time
const LEARN_LOOKBACK_DAYS = 30
const LEAD_MIN = 30            // nudge this long BEFORE the usual lock time

export async function POST(req: NextRequest) {
  // ── Auth: cron secret, or an admin hitting it by hand ───────────────────────
  const secret = req.headers.get('x-cron-secret')
  const expected = process.env.CRON_SECRET
  let isCron = Boolean(expected && secret === expected)

  if (!isCron) {
    const user = getSessionFromCookie(req.headers.get('cookie'))
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  if (!pushConfigured()) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 503 })
  }

  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dry') === '1'
  const force = url.searchParams.get('force') === '1'

  const supabase = createServiceClient()
  const { date: today, minutes: nowMin, day } = istNow()
  const slot = slotForMinutes(nowMin)

  // ── Who could receive anything at all? ──────────────────────────────────────
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('user_id, household_id')

  if (!subs?.length) {
    return NextResponse.json({ ok: true, reason: 'no subscriptions', sent: 0 })
  }

  const byHousehold = new Map<string, Set<string>>()
  for (const s of subs) {
    if (!byHousehold.has(s.household_id)) byHousehold.set(s.household_id, new Set())
    byHousehold.get(s.household_id)!.add(s.user_id)
  }
  const householdIds = [...byHousehold.keys()]

  // ── Bulk-load everything, then decide per household ─────────────────────────
  const since = new Date(Date.now() - LEARN_LOOKBACK_DAYS * 86_400_000).toISOString()

  const [locksRes, slotsRes, historyRes, sentRes] = await Promise.all([
    supabase.from('daily_locks').select('household_id, slot')
      .in('household_id', householdIds).eq('lock_date', today),
    supabase.from('meal_slots').select('household_id, slot, dish:dishes(id, name)')
      .in('household_id', householdIds).eq('day', day),
    supabase.from('behaviour_log').select('household_id, created_at, metadata')
      .in('household_id', householdIds).eq('event_type', 'meal_locked').gte('created_at', since),
    supabase.from('notification_log').select('household_id')
      .in('household_id', householdIds).eq('send_date', today).eq('slot', slot).eq('kind', 'meal_nudge'),
  ])

  const lockedSet = new Set((locksRes.data || []).map(l => `${l.household_id}|${l.slot}`))
  const alreadySent = new Set((sentRes.data || []).map(n => n.household_id))

  // Learned send time = median historical lock time for this household+slot,
  // minus a lead so the nudge lands BEFORE they'd normally decide. Nudging
  // someone about a decision they already made is how a channel gets muted.
  const learned = new Map<string, number>()
  const buckets = new Map<string, number[]>()
  for (const row of historyRes.data || []) {
    const rowSlot = (row.metadata as { slot?: string } | null)?.slot
    if (rowSlot !== slot) continue
    const ist = new Date(new Date(row.created_at as string).getTime() + (5 * 60 + 30) * 60_000)
    const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes()
    const key = row.household_id as string
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(mins)
  }
  for (const [hid, mins] of buckets) {
    if (mins.length < LEARN_MIN_SAMPLES) continue
    mins.sort((a, b) => a - b)
    const median = mins[Math.floor(mins.length / 2)]
    learned.set(hid, Math.max(6 * 60, median - LEAD_MIN))
  }

  const optionsByHousehold = new Map<string, Array<{ id: string; name: string }>>()
  for (const row of slotsRes.data || []) {
    if (row.slot !== slot) continue
    const dish = row.dish as unknown as { id: string; name: string } | null
    if (!dish?.name) continue
    const key = row.household_id as string
    if (!optionsByHousehold.has(key)) optionsByHousehold.set(key, [])
    optionsByHousehold.get(key)!.push(dish)
  }

  // ── Decide and send ─────────────────────────────────────────────────────────
  const report: Array<Record<string, unknown>> = []
  let totalSent = 0

  for (const hid of householdIds) {
    const sendAt = learned.get(hid) ?? DEFAULT_SEND_MINUTES[slot]
    const due = force || (nowMin >= sendAt && nowMin < sendAt + WINDOW_MIN)

    const skip =
      !due ? 'not due'
      : lockedSet.has(`${hid}|${slot}`) ? 'already locked'
      : alreadySent.has(hid) ? 'already sent today'
      : null

    const options = optionsByHousehold.get(hid) || []
    if (!skip && !options.length) {
      report.push({ household: hid, skipped: 'no dishes planned' })
      continue
    }

    if (skip) {
      report.push({ household: hid, skipped: skip, sendAt, nowMin })
      continue
    }

    const pick = dailyPick(options, hid, today, slot)!
    const payload: PushPayload = {
      title: slot === 'dinner' ? 'Tonight' : 'Lunch today',
      // Name the dish. A teaser wastes the one surface that matters.
      body: pick.name,
      url: `/discover?lockSlot=${slot}&lockDate=${today}`,
      tag: `nudge-${today}-${slot}`,
      // Rendered on Android, ignored on iOS — where the body tap opens the
      // lock screen instead. Both paths must stay working.
      actions: [
        { action: 'lock', title: 'Lock it' },
        { action: 'other', title: 'Something else' },
      ],
      lock: { lock_date: today, slot, dish_name: pick.name, dish_id: pick.id },
    }

    if (dryRun) {
      report.push({ household: hid, wouldSend: pick.name, slot, sendAt })
      continue
    }

    const users = [...(byHousehold.get(hid) || [])]
    const { sent, failed } = await sendToUsers(users, payload, { perUserToken: true })
    totalSent += sent

    if (sent > 0) {
      await supabase.from('notification_log').insert({
        household_id: hid,
        send_date: today,
        slot,
        kind: 'meal_nudge',
        dish_name: pick.name,
        recipients: sent,
      })
    }

    report.push({ household: hid, dish: pick.name, sent, failed })
  }

  return NextResponse.json({
    ok: true,
    ist: { date: today, minutes: nowMin, slot },
    dryRun,
    force,
    sent: totalSent,
    households: report,
  })
}

/** GET is a convenience alias so the endpoint can be poked from a browser. */
export async function GET(req: NextRequest) {
  return POST(req)
}
