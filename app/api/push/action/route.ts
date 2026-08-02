import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { verifyActionToken } from '@/lib/push'

export const runtime = 'nodejs'

/**
 * POST /api/push/action — act on a notification button without opening the app.
 *
 * Authenticated by the short-lived token embedded in the push payload rather
 * than by cookie, because a service worker's fetch cannot be relied on to carry
 * the session.
 *
 * ANDROID ONLY IN PRACTICE. iOS ignores notification actions entirely, so on
 * iPhone this route is never reached — the notification body tap opens the lock
 * screen instead. Keep both paths working.
 */
export async function POST(req: NextRequest) {
  const { token, action, lock_date, slot, dish_name, dish_id } = await req.json()

  const claims = token ? verifyActionToken(token) : null
  if (!claims) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

  if (action !== 'lock') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  }
  if (!lock_date || !slot || !dish_name) {
    return NextResponse.json({ error: 'Missing lock details' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Never overwrite a decision already made — the partner may have locked
  // something else in the minutes since this notification was sent.
  const { data: existing } = await supabase
    .from('daily_locks')
    .select('id, dish_name')
    .eq('household_id', claims.hid)
    .eq('lock_date', lock_date)
    .eq('slot', slot)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ success: true, alreadyLocked: true, dish_name: existing.dish_name })
  }

  const { data: user } = await supabase
    .from('users')
    .select('username')
    .eq('id', claims.sub)
    .maybeSingle()

  const { error } = await supabase.from('daily_locks').upsert({
    household_id: claims.hid,
    lock_date,
    slot,
    dish_id: dish_id || null,
    dish_name,
    locked_by: claims.sub,
    locked_by_username: user?.username || null,
  }, { onConflict: 'household_id,lock_date,slot' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Same shape the in-app lock writes, so learning and insights don't have to
  // care where the decision came from. The source tag is what lets us measure
  // "locks made without opening the app".
  await supabase.from('behaviour_log').insert({
    household_id: claims.hid,
    user_id: claims.sub,
    event_type: 'meal_locked',
    metadata: { lock_date, slot, dish_name, source: 'push_action' },
  })

  return NextResponse.json({ success: true })
}
