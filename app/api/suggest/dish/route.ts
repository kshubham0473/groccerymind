import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { callGeminiRaw } from '@/lib/gemini'

export async function GET(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  // Get available pantry items
  const { data: pantry } = await supabase
    .from('pantry_items')
    .select('name, stock_status, tier')
    .eq('household_id', user.household_id)
    .eq('stock_status', 'good')

  // Get existing dishes to avoid repeats
  const { data: existing } = await supabase
    .from('dishes')
    .select('name')
    .eq('household_id', user.household_id)

  const availableItems = pantry?.map(p => p.name) || []
  const existingDishes = existing?.map(d => d.name) || []

  const prompt = `You are a creative Indian home cooking assistant.

Available pantry items right now: ${availableItems.join(', ')}
Dishes this household already makes (don't repeat): ${existingDishes.slice(0, 20).join(', ')}

Suggest 3 different Indian dishes that can be made mostly with the available items above.
Each dish should:
- Be a real, well-known Indian recipe
- Use at least 3 of the available items
- Require at most 2-3 additional ingredients to buy
- Be different from each other (variety of cuisine styles)

Return ONLY a JSON array, no markdown, no backticks:
[
  {
    "name": "dish name",
    "description": "one appetising sentence about the dish",
    "usesFromPantry": ["item1", "item2", "item3"],
    "needsToBuy": ["item1", "item2"],
    "prepTime": "20 mins",
    "mood": "light" 
  }
]
mood must be one of: "light", "hearty", "quick", "indulgent", "healthy"`

  try {
    const raw = await callGeminiRaw(prompt)
    const cleaned = raw.replace(/^```json\s*|^```\s*|```\s*$/gm, '').trim()
    const dishes = JSON.parse(cleaned)
    return NextResponse.json({ dishes: Array.isArray(dishes) ? dishes : [] })
  } catch (e: any) {
    console.error('[suggest/dish]', e.message)
    return NextResponse.json({ dishes: [], error: e.message })
  }
}
