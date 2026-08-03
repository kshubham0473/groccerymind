/**
 * lib/push.ts — server only. Web Push sending + subscription hygiene.
 *
 * Requires (Vercel → Environment Variables → Production, then redeploy):
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY   also read by the browser to subscribe
 *   VAPID_PRIVATE_KEY              secret
 *   VAPID_SUBJECT                  mailto:you@example.com
 *   CRON_SECRET                    shared secret for the pg_cron heartbeat
 *
 * Generate the keypair once with:  npx web-push generate-vapid-keys
 */

import webpush from 'web-push'
import jwt from 'jsonwebtoken'
import { createServiceClient } from '@/lib/supabase'

export type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
  actions?: Array<{ action: string; title: string }>
  actionToken?: string
  lock?: { lock_date: string; slot: string; dish_name: string; dish_id?: string | null }
}

let configured = false

function configure(): boolean {
  if (configured) return true
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:kshubham0473@gmail.com'
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
  return true
}

export function pushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

/**
 * Short-lived token embedded in a notification so an action button can act
 * without a cookie. Service workers don't reliably carry session cookies, and
 * a 6-hour single-purpose token is a smaller blast radius than one anyway.
 */
export function mintActionToken(userId: string, householdId: string): string {
  return jwt.sign(
    { sub: userId, hid: householdId, scope: 'push-action' },
    process.env.JWT_SECRET as string,
    { expiresIn: '6h' }
  )
}

export function verifyActionToken(token: string): { sub: string; hid: string } | null {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      sub: string; hid: string; scope?: string
    }
    if (decoded.scope !== 'push-action') return null
    return { sub: decoded.sub, hid: decoded.hid }
  } catch {
    return null
  }
}

type SubRow = {
  id: string
  user_id: string
  household_id: string
  endpoint: string
  p256dh: string
  auth: string
}

/**
 * Send to one subscription. Prunes the row on 404/410 — the endpoint is gone
 * for good and retrying it forever is how push tables rot.
 */
export async function sendToSubscription(sub: SubRow, payload: PushPayload): Promise<boolean> {
  if (!configure()) return false

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 3 * 60 * 60 }  // a dinner nudge is worthless tomorrow
    )
    return true
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode
    if (status === 404 || status === 410) {
      try {
        const supabase = createServiceClient()
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      } catch { /* non-fatal */ }
    }
    return false
  }
}

/** Send to every subscription belonging to a set of users. */
export async function sendToUsers(
  userIds: string[],
  payload: PushPayload,
  opts: { perUserToken?: boolean } = {}
): Promise<{ sent: number; failed: number }> {
  if (!userIds.length || !configure()) return { sent: 0, failed: 0 }

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, household_id, endpoint, p256dh, auth')
    .in('user_id', userIds)

  const subs = (data || []) as SubRow[]
  let sent = 0
  let failed = 0

  for (const sub of subs) {
    // Each recipient needs a token scoped to themselves, or partner A's phone
    // could act as partner B.
    const perSub: PushPayload = opts.perUserToken
      ? { ...payload, actionToken: mintActionToken(sub.user_id, sub.household_id) }
      : payload
    const ok = await sendToSubscription(sub, perSub)
    if (ok) sent++
    else failed++
  }

  return { sent, failed }
}
