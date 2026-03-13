import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { getDishSuggestions, buildHouseholdContext } from '@/lib/gemini'

export async function GET(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const [pantryRes, existingRes, prefsRes, feedbackRes] = await Promise.all([
    supabase.from('pantry_items').select('name, stock_status').eq('household_id', user.household_id).eq('stock_status', 'good'),
    supabase.from('dishes').select('name').eq('household_id', user.household_id),
    supabase.from('households').select('preferences').eq('id', user.household_id).single(),
    supabase.from('dish_feedback').select('dish_name, signal').eq('household_id', user.household_id),
  ])

  const availableItems = pantryRes.data?.map(p => p.name) || []
  const existingDishes = existingRes.data?.map(d => d.name) || []
  const prefs = prefsRes.data?.preferences || {}
  const feedback = feedbackRes.data || []
  const householdContext = buildHouseholdContext(prefs, feedback)
  const dislikedDishes = feedback.filter(f => f.signal === 'dislike').map(f => f.dish_name).filter(Boolean) as string[]

  try {
    const dishes = await getDishSuggestions({ availableItems, existingDishes, householdContext, dislikedDishes })
    return NextResponse.json({ dishes })
  } catch (e: any) {
    return NextResponse.json({ dishes: [], error: e.message })
  }
}
