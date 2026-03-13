import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: items } = await supabase
    .from('pantry_items')
    .select('id, name, stock_status, depletion_days, avg_depletion_days, last_ordered_at, order_count')
    .eq('household_id', user.household_id)

  if (!items?.length) return NextResponse.json({ updated: 0 })

  const now = new Date()
  const updates: { id: string; stock_status: string }[] = []

  for (const item of items) {
    if (!item.last_ordered_at) continue

    const daysSince = Math.floor(
      (now.getTime() - new Date(item.last_ordered_at).getTime()) / (1000 * 60 * 60 * 24)
    )

    // Use learned avg if available and order_count >= 3, otherwise use fixed
    const effectiveDays = (item.avg_depletion_days && item.order_count >= 3)
      ? item.avg_depletion_days
      : item.depletion_days

    let newStatus = item.stock_status
    if (daysSince >= effectiveDays) {
      newStatus = 'finished'
    } else if (daysSince >= effectiveDays * 0.65) {
      newStatus = 'low'
    }

    if (newStatus !== item.stock_status) {
      updates.push({ id: item.id, stock_status: newStatus })
    }
  }

  // Batch update
  await Promise.all(updates.map(u =>
    supabase.from('pantry_items').update({ stock_status: u.stock_status }).eq('id', u.id)
  ))

  return NextResponse.json({ updated: updates.length, changes: updates })
}

// PUT /api/pantry/estimate — "just restocked" — resets clock + updates learned depletion
export async function PUT(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  const supabase = createServiceClient()

  const { data: item } = await supabase
    .from('pantry_items')
    .select('last_ordered_at, depletion_days, order_count, avg_depletion_days')
    .eq('id', id)
    .single()

  const now = new Date()
  let avg_depletion_days = item?.avg_depletion_days || null
  let order_count = (item?.order_count || 0) + 1

  // Learn: if we have a previous restock date, compute actual depletion days
  if (item?.last_ordered_at) {
    const actual = Math.floor(
      (now.getTime() - new Date(item.last_ordered_at).getTime()) / (1000 * 60 * 60 * 24)
    )
    // Only accept reasonable values (1–90 days)
    if (actual >= 1 && actual <= 90) {
      // Rolling average weighted toward recent data
      if (avg_depletion_days) {
        avg_depletion_days = Math.round(avg_depletion_days * 0.6 + actual * 0.4)
      } else {
        avg_depletion_days = actual
      }
    }
  }

  const { data, error } = await supabase
    .from('pantry_items')
    .update({
      stock_status: 'good',
      last_ordered_at: now.toISOString(),
      order_count,
      avg_depletion_days,
    })
    .eq('id', id)
    .eq('household_id', user.household_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
