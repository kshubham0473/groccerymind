import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('meal_slots')
    .select('*, dish:dishes(*)')
    .eq('household_id', user.household_id)
    .order('day')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { day, slot, dish_name, ingredients } = await req.json()
  const supabase = createServiceClient()

  // Create dish first
  const { data: dish, error: dishError } = await supabase
    .from('dishes')
    .insert({ household_id: user.household_id, name: dish_name, ingredients: ingredients || [] })
    .select()
    .single()

  if (dishError) return NextResponse.json({ error: dishError.message }, { status: 500 })

  // Create meal slot
  const { data: slot_data, error: slotError } = await supabase
    .from('meal_slots')
    .insert({ household_id: user.household_id, day, slot, dish_id: dish.id })
    .select('*, dish:dishes(*)')
    .single()

  if (slotError) return NextResponse.json({ error: slotError.message }, { status: 500 })
  return NextResponse.json(slot_data)
}

export async function DELETE(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slot_id } = await req.json()
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('meal_slots')
    .delete()
    .eq('id', slot_id)
    .eq('household_id', user.household_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
