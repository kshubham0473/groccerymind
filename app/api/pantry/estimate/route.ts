import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  // Get all good items with a last_ordered_at date
  const { data: items } = await supabase
    .from('pantry_items')
    .select('id, name, depletion_days, last_ordered_at, stock_status')
    .eq('household_id', user.household_id)
    .eq('stock_status', 'good')
    .not('last_ordered_at', 'is', null)

  const now = Date.now()
  const toUpdate: { id: string; stock_status: string }[] = []

  for (const item of items || []) {
    const daysSince = Math.floor((now - new Date(item.last_ordered_at).getTime()) / 86400000)
    const pct = daysSince / item.depletion_days

    if (pct >= 1.0) {
      toUpdate.push({ id: item.id, stock_status: 'finished' })
    } else if (pct >= 0.75) {
      toUpdate.push({ id: item.id, stock_status: 'low' })
    }
  }

  // Batch update
  for (const u of toUpdate) {
    await supabase
      .from('pantry_items')
      .update({ stock_status: u.stock_status })
      .eq('id', u.id)
      .eq('household_id', user.household_id)
  }

  return NextResponse.json({ updated: toUpdate.length, items: toUpdate })
}
