import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

// GET /api/dishes — all dishes for this household
export async function GET(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('dishes')
    .select('*')
    .eq('household_id', user.household_id)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH /api/dishes — update a dish (name, meal_pairing, youtube_url, ingredients, complexity, tags)
export async function PATCH(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Only allow safe fields to be updated
  const allowed = ['name', 'meal_pairing', 'youtube_url', 'ingredients',
                   'complexity', 'tags', 'is_vegetarian', 'cuisine_type', 'description']
  const filtered = Object.fromEntries(
    Object.entries(updates).filter(([k]) => allowed.includes(k))
  )

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('dishes')
    .update(filtered)
    .eq('id', id)
    .eq('household_id', user.household_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
