import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

// POST /api/feedback — like/dislike a dish
export async function POST(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { dish_name, dish_id, signal, reason } = await req.json()
  const supabase = createServiceClient()

  // Upsert — one feedback per household per dish
  const { data, error } = await supabase
    .from('dish_feedback')
    .upsert({
      household_id: user.household_id,
      user_id: user.id,
      dish_id: dish_id || null,
      dish_name: dish_name || null,
      signal,
      reason: reason || null,
    }, { onConflict: 'household_id,dish_name' })
    .select()
    .single()

  if (error) {
    // Fallback insert if upsert fails (older rows without dish_name)
    const { data: inserted, error: insertError } = await supabase
      .from('dish_feedback')
      .insert({
        household_id: user.household_id,
        user_id: user.id,
        dish_id: dish_id || null,
        dish_name: dish_name || null,
        signal,
        reason: reason || null,
      })
      .select()
      .single()
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
    return NextResponse.json(inserted)
  }

  return NextResponse.json(data)
}

// GET /api/feedback — get all feedback for building preference context
export async function GET(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('dish_feedback')
    .select('dish_name, dish_id, signal, reason')
    .eq('household_id', user.household_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
