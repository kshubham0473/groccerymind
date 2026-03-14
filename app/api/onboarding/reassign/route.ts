import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { callGeminiRaw, cleanJson, buildHouseholdContext } from '@/lib/gemini'

// POST — regenerate a single dish suggestion
export async function POST(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { exclude_names } = await req.json()
  const supabase = createServiceClient()

  const { data } = await supabase.from('households').select('preferences').eq('id', user.household_id).single()
  const prefs = data?.preferences || {}
  const householdContext = buildHouseholdContext(prefs, [])

  const prompt = `You are setting up a meal plan for an Indian household.
${householdContext}

Suggest ONE dish this household would enjoy cooking regularly.
It must NOT be any of these already suggested: ${(exclude_names || []).join(', ')}
The dish should be a real, well-known Indian recipe suitable for weekday cooking.
Exclude salt, oil, and all spices from ingredients.

Return ONLY a JSON object, no markdown:
{
  "name": "Dish Name",
  "description": "one appetising sentence",
  "cuisine_type": "North Indian",
  "ingredients": ["ingredient1", "ingredient2", "ingredient3"]
}`

  try {
    const raw = await callGeminiRaw(prompt)
    const dish = JSON.parse(cleanJson(raw))
    return NextResponse.json({ dish })
  } catch (e: any) {
    return NextResponse.json({ dish: null, error: e.message })
  }
}
