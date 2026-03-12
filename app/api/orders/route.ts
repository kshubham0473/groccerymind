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

  const items = data.map(item => ({
    ...item,
    added_by_username: item.added_by_user?.username || 'unknown',
  }))

  return NextResponse.json(items)
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
    })
    .select('*, added_by_user:users(username)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ...data,
    added_by_username: data.added_by_user?.username || 'unknown',
  })
}

export async function PATCH(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, is_checked } = await req.json()
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('order_items')
    .update({ is_checked })
    .eq('id', id)
    .eq('household_id', user.household_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If item is checked, mark corresponding pantry item as good (restocked)
  if (is_checked) {
    await supabase
      .from('pantry_items')
      .update({ stock_status: 'good', last_ordered_at: new Date().toISOString() })
      .eq('household_id', user.household_id)
      .ilike('name', data.item_name)
  }

  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, clear_checked } = await req.json()
  const supabase = createServiceClient()

  if (clear_checked) {
    const { error } = await supabase
      .from('order_items')
      .delete()
      .eq('household_id', user.household_id)
      .eq('is_checked', true)
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
