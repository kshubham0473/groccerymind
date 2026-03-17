import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { getReplacementDish, callGeminiRaw, cleanJson } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { exclude_names, category_hint } = await req.json()

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('households')
    .select('preferences')
    .eq('id', user.household_id)
    .single()

  const prefs = data?.preferences || {}

  // Get replacement from corpus — no Gemini needed for selection
  const replacement = getReplacementDish(exclude_names || [], prefs, category_hint)

  if (!replacement) {
    return NextResponse.json({ dish: null, error: 'No suitable replacement found in corpus' })
  }

  // Get a description for it
  let description = ''
  try {
    const raw = await callGeminiRaw(
      `Write a single appetising one-sentence description (8-12 words) for the Indian dish "${replacement.name}". Do not start with the dish name. Return only the sentence, no quotes.`
    )
    description = raw.trim().replace(/^["']|["']$/g, '')
  } catch { /* fine, description stays empty */ }

  return NextResponse.json({
    dish: {
      name:          replacement.name,
      description,
      meal_pairing:  replacement.meal_pairing || '',
      cuisine_type:  replacement.cuisine_type || 'Indian',
      complexity:    replacement.complexity || 'moderate',
      is_vegetarian: replacement.is_vegetarian !== false,
      tags:          replacement.tags || [],
      youtube_url:   replacement.youtube_url || '',
      ingredients:   [],
      _category:     replacement._category || category_hint || '',
    }
  })
}
