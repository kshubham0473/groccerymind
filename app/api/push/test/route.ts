import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { sendToUsers, pushConfigured } from '@/lib/push'
import { istNow, slotForMinutes } from '@/lib/daily-pick'

export const runtime = 'nodejs'

/**
 * POST /api/push/test — send a real push to yourself, right now.
 *
 * The only practical way to verify the iOS path, where nothing about push is
 * inspectable: no devtools on the Home Screen app, and a subscription that
 * silently doesn't exist if the site was opened in a Safari tab instead. If
 * this arrives on the phone, the whole chain works.
 */
export async function POST(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!pushConfigured()) {
    return NextResponse.json(
      { error: 'VAPID keys missing. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY, then redeploy.' },
      { status: 503 }
    )
  }

  const { date, minutes } = istNow()
  const slot = slotForMinutes(minutes)

  const { sent, failed } = await sendToUsers([user.id], {
    title: slot === 'dinner' ? 'Tonight' : 'Lunch today',
    body: 'Test nudge — tapping this should open the lock screen.',
    url: `/discover?lockSlot=${slot}&lockDate=${date}`,
    tag: 'grocerymind-test',
    actions: [
      { action: 'lock', title: 'Lock it' },
      { action: 'other', title: 'Something else' },
    ],
    lock: { lock_date: date, slot, dish_name: 'Test Dish' },
  }, { perUserToken: true })

  return NextResponse.json({
    sent,
    failed,
    note: sent === 0
      ? 'No subscription found for this user. On iOS the app must be opened from the Home Screen icon, not a Safari tab.'
      : 'Sent. On iOS you will see no action buttons — that is expected.',
  })
}
