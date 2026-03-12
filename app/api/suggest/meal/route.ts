import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { getMealSuggestion } from '@/lib/gemini'

export async function GET(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new URL(req.url).searchParams.get('day') || 'monday'
  const supabase = createServiceClient()

  // Get today's meal options
  const { data: slots } = await supabase
    .from('meal_slots')
    .select('*, dish:dishes(*)')
    .eq('household_id', user.household_id)
    .eq('day', today)

  const lunchOptions = slots?.filter(s => s.slot === 'lunch').map(s => s.dish?.name).filter(Boolean) || []
  const dinnerOptions = slots?.filter(s => s.slot === 'dinner').map(s => s.dish?.name).filter(Boolean) || []

  // Get pantry state
  const { data: pantry } = await supabase
    .from('pantry_items')
    .select('name, stock_status')
    .eq('household_id', user.household_id)
    .neq('stock_status', 'good')

  const lowItems = pantry?.filter(i => i.stock_status === 'low').map(i => i.name) || []
  const finishedItems = pantry?.filter(i => i.stock_status === 'finished').map(i => i.name) || []

  // Get recently cooked from behaviour log
  const { data: logs } = await supabase
    .from('behaviour_log')
    .select('metadata')
    .eq('household_id', user.household_id)
    .eq('event_type', 'cooked')
    .order('created_at', { ascending: false })
    .limit(6)

  const recentlyCooked = logs?.map(l => l.metadata?.dish_name).filter(Boolean) || []

  if (!lunchOptions.length && !dinnerOptions.length) {
    return NextResponse.json({ suggestion: null, reason: 'No meal options set for today' })
  }

  const suggestion = await getMealSuggestion({
    today,
    lunchOptions,
    dinnerOptions,
    lowItems,
    finishedItems,
    recentlyCooked,
  })

  return NextResponse.json({ suggestion })
}
