import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { getMealSuggestion, buildHouseholdContext } from '@/lib/gemini'

export async function GET(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new URL(req.url).searchParams.get('day') || 'monday'
  const supabase = createServiceClient()

  const [slotsRes, pantryRes, logsRes, prefsRes, feedbackRes] = await Promise.all([
    supabase.from('meal_slots').select('*, dish:dishes(*)').eq('household_id', user.household_id).eq('day', today),
    supabase.from('pantry_items').select('name, stock_status').eq('household_id', user.household_id).neq('stock_status', 'good'),
    supabase.from('behaviour_log').select('metadata').eq('household_id', user.household_id).eq('event_type', 'cooked').order('created_at', { ascending: false }).limit(6),
    supabase.from('households').select('preferences').eq('id', user.household_id).single(),
    supabase.from('dish_feedback').select('dish_name, signal').eq('household_id', user.household_id),
  ])

  const slots = slotsRes.data || []
  const lunchOptions = slots.filter(s => s.slot === 'lunch').map(s => s.dish?.name).filter(Boolean) as string[]
  const dinnerOptions = slots.filter(s => s.slot === 'dinner').map(s => s.dish?.name).filter(Boolean) as string[]

  if (!lunchOptions.length && !dinnerOptions.length) {
    return NextResponse.json({ suggestion: null })
  }

  const pantry = pantryRes.data || []
  const lowItems = pantry.filter(i => i.stock_status === 'low').map(i => i.name)
  const finishedItems = pantry.filter(i => i.stock_status === 'finished').map(i => i.name)
  const recentlyCooked = (logsRes.data || []).map(l => l.metadata?.dish_name).filter(Boolean) as string[]
  const prefs = prefsRes.data?.preferences || {}
  const feedback = feedbackRes.data || []
  const householdContext = buildHouseholdContext(prefs, feedback)

  try {
    const suggestion = await getMealSuggestion({ today, lunchOptions, dinnerOptions, lowItems, finishedItems, recentlyCooked, householdContext })
    return NextResponse.json({ suggestion })
  } catch (e: any) {
    return NextResponse.json({ suggestion: null, error: e.message })
  }
}
