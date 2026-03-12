import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { getOrderSuggestions } from '@/lib/gemini'

export async function GET(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  // Current order list
  const { data: orders } = await supabase
    .from('order_items')
    .select('item_name')
    .eq('household_id', user.household_id)
    .eq('is_checked', false)

  const currentOrderItems = orders?.map(o => o.item_name) || []

  // Low pantry items with days since last order
  const { data: pantry } = await supabase
    .from('pantry_items')
    .select('name, tier, stock_status, last_ordered_at')
    .eq('household_id', user.household_id)
    .neq('stock_status', 'good')

  const lowPantryItems = (pantry || []).map(item => {
    const daysSince = item.last_ordered_at
      ? Math.floor((Date.now() - new Date(item.last_ordered_at).getTime()) / (1000 * 60 * 60 * 24))
      : 999
    return { name: item.name, tier: item.tier, daysSinceOrder: daysSince }
  })

  // Upcoming meals (next 3 days)
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  const todayIdx = new Date().getDay()
  const upcomingDays = [0, 1, 2].map(i => days[(todayIdx + i) % 7])

  const { data: slots } = await supabase
    .from('meal_slots')
    .select('*, dish:dishes(name)')
    .eq('household_id', user.household_id)
    .in('day', upcomingDays)

  const upcomingMeals = slots?.map(s => s.dish?.name).filter(Boolean) || []

  const suggestions = await getOrderSuggestions({
    currentOrderItems,
    lowPantryItems,
    upcomingMeals,
  })

  return NextResponse.json({ suggestions })
}
