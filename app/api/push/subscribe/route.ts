import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'

/**
 * POST /api/push/subscribe — store (or refresh) this device's push subscription.
 *
 * Keyed on endpoint, not on user: one person may have a phone and a laptop, and
 * browsers rotate endpoints. Upserting on endpoint keeps the table honest
 * without accumulating dead rows.
 */
export async function POST(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subscription } = await req.json()
  const endpoint: string | undefined = subscription?.endpoint
  const p256dh: string | undefined = subscription?.keys?.p256dh
  const auth: string | undefined = subscription?.keys?.auth

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase.from('push_subscriptions').upsert({
    endpoint,
    p256dh,
    auth,
    user_id: user.id,
    household_id: user.household_id,
    user_agent: req.headers.get('user-agent')?.slice(0, 300) || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

/** DELETE /api/push/subscribe — user turned notifications off. */
export async function DELETE(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint } = await req.json().catch(() => ({ endpoint: null }))
  const supabase = createServiceClient()

  const query = supabase.from('push_subscriptions').delete().eq('user_id', user.id)
  if (endpoint) query.eq('endpoint', endpoint)

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

/** GET /api/push/subscribe — does this user have any live subscription? */
export async function GET(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { count } = await supabase
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  return NextResponse.json({
    subscribed: (count || 0) > 0,
    devices: count || 0,
    vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null,
  })
}
