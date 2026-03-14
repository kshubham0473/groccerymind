import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { getDishSuggestions, buildHouseholdContext } from '@/lib/gemini'

export async function GET(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userPrompt = new URL(req.url).searchParams.get('prompt') || undefined

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

  // Log the prompt for future preference learning
  if (userPrompt) {
    try {
      await supabase.from('behaviour_log').insert({
        household_id: user.household_id,
        user_id: user.id,
        event_type: 'discover_prompt',
        metadata: { prompt: userPrompt }
      })
    } catch (_) {}
  }

  try {
    const dishes = await getDishSuggestions({ availableItems, existingDishes, householdContext, userPrompt })
    return NextResponse.json({ dishes })
  } catch (e: any) {
    return NextResponse.json({ dishes: [], error: e.message })
  }
}
