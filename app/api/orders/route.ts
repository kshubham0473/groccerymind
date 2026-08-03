import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('order_items')
    .select('*, added_by_user:users(username)')
    .eq('household_id', user.household_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data.map(item => ({
    ...item,
    added_by_username: item.added_by_user?.username || 'unknown',
  })))
}

export async function POST(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { item_name, source = 'manual' } = await req.json()
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('order_items')
    .insert({
      household_id: user.household_id,
      item_name: item_name.trim(),
      added_by: user.id,
      source,
      is_checked: false,
      status: 'pending',
    })
    .select('*, added_by_user:users(username)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ...data, added_by_username: data.added_by_user?.username || 'unknown' })
}

export async function PATCH(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const supabase = createServiceClient()

  // Bulk mark-all-ordered
  if (body.mark_all_ordered) {
    await supabase
      .from('order_items')
      .update({ is_checked: true, status: 'ordered' })
      .eq('household_id', user.household_id)
      .eq('status', 'pending')
    return NextResponse.json({ success: true })
  }

  const { id, status, is_checked } = body

  // Derive status from is_checked for legacy callers
  const newStatus = status ?? (is_checked === true ? 'ordered' : is_checked === false ? 'pending' : undefined)
  const newChecked = newStatus === 'ordered' ? true : newStatus === 'maybe' ? false : newStatus === 'pending' ? false : is_checked

  const { data, error } = await supabase
    .from('order_items')
    .update({ is_checked: newChecked, status: newStatus })
    .eq('id', id)
    .eq('household_id', user.household_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // When marked as ordered — run full restock logic on matching pantry item
  if (newStatus === 'ordered') {
    const { data: pantryItem } = await supabase
      .from('pantry_items')
      .select('id, last_ordered_at, depletion_days, order_count, avg_depletion_days')
      .eq('household_id', user.household_id)
      .ilike('name', data.item_name)
      .single()

    if (pantryItem) {
      const now = new Date()
      let avg_depletion_days = pantryItem.avg_depletion_days ?? null
      let order_count = (pantryItem.order_count ?? 0) + 1

      if (pantryItem.last_ordered_at) {
        const actual = Math.floor(
          (now.getTime() - new Date(pantryItem.last_ordered_at).getTime()) / 86400000
        )
        if (actual >= 1 && actual <= 90) {
          avg_depletion_days = avg_depletion_days
            ? Math.round(avg_depletion_days * 0.6 + actual * 0.4)
            : actual
        }
      }

      await supabase
        .from('pantry_items')
        .update({
          stock_status: 'good',
          last_ordered_at: now.toISOString(),
          order_count,
          avg_depletion_days,
        })
        .eq('id', pantryItem.id)
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, clear_ordered } = await req.json()
  const supabase = createServiceClient()

  if (clear_ordered) {
    const { error } = await supabase
      .from('order_items')
      .delete()
      .eq('household_id', user.household_id)
      .eq('status', 'ordered')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase
      .from('order_items')
      .delete()
      .eq('id', id)
      .eq('household_id', user.household_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
