import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { getOrderSuggestions, buildHouseholdContext } from '@/lib/gemini'

export async function GET(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const [ordersRes, pantryRes, mealsRes, prefsRes, feedbackRes] = await Promise.all([
    supabase.from('order_items').select('item_name').eq('household_id', user.household_id).eq('is_checked', false),
    supabase.from('pantry_items').select('name, tier, last_ordered_at, stock_status').eq('household_id', user.household_id).neq('stock_status', 'good'),
    supabase.from('meal_slots').select('dish:dishes(name)').eq('household_id', user.household_id),
    supabase.from('households').select('preferences').eq('id', user.household_id).single(),
    supabase.from('dish_feedback').select('dish_name, signal').eq('household_id', user.household_id),
  ])

  const currentOrderItems = ordersRes.data?.map(o => o.item_name) || []
  const now = new Date()
  const lowPantryItems = (pantryRes.data || []).map(i => ({
    name: i.name, tier: i.tier,
    daysSinceOrder: i.last_ordered_at ? Math.floor((now.getTime() - new Date(i.last_ordered_at).getTime()) / 86400000) : 999
  }))
  const upcomingMeals = [...new Set((mealsRes.data || []).map((s: any) => s.dish?.name).filter(Boolean))] as string[]
  const prefs = prefsRes.data?.preferences || {}
  const feedback = feedbackRes.data || []
  const householdContext = buildHouseholdContext(prefs, feedback)

  try {
    const suggestions = await getOrderSuggestions({ currentOrderItems, lowPantryItems, upcomingMeals: upcomingMeals.slice(0, 10), householdContext })
    return NextResponse.json({ suggestions })
  } catch (e: any) {
    return NextResponse.json({ suggestions: [], error: e.message })
  }
}
