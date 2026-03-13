import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

// GET /api/locks?from=YYYY-MM-DD&days=3
export async function GET(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const from = url.searchParams.get('from') || new Date().toISOString().split('T')[0]
  const days = parseInt(url.searchParams.get('days') || '3')

  // Compute date range
  const dates: string[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(from)
    d.setDate(d.getDate() + i)
    dates.push(d.toISOString().split('T')[0])
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('daily_locks')
    .select('*')
    .eq('household_id', user.household_id)
    .in('lock_date', dates)
    .order('lock_date')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/locks — create or replace a lock
export async function POST(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { lock_date, slot, dish_id, dish_name } = await req.json()
  const supabase = createServiceClient()

  // Upsert — replacing any existing lock for same date+slot
  const { data, error } = await supabase
    .from('daily_locks')
    .upsert({
      household_id: user.household_id,
      lock_date,
      slot,
      dish_id: dish_id || null,
      dish_name,
      locked_by: user.id,
      locked_by_username: user.username,
    }, { onConflict: 'household_id,lock_date,slot' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log to behaviour_log
  await supabase.from('behaviour_log').insert({
    household_id: user.household_id,
    user_id: user.id,
    event_type: 'meal_locked',
    metadata: { lock_date, slot, dish_name }
  })

  return NextResponse.json(data)
}

// DELETE /api/locks — unlock a slot
export async function DELETE(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { lock_date, slot } = await req.json()
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('daily_locks')
    .delete()
    .eq('household_id', user.household_id)
    .eq('lock_date', lock_date)
    .eq('slot', slot)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
