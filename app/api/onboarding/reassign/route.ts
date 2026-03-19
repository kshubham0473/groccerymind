import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { getReplacementDish, callGeminiRaw } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { exclude_names, dish_being_replaced } = await req.json()

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('households').select('preferences').eq('id', user.household_id).single()
  const prefs = data?.preferences || {}

  const replacement = await getReplacementDish(
    exclude_names || [],
    prefs,
    dish_being_replaced || 'Indian dish'
  )
  if (!replacement) {
    return NextResponse.json({ dish: null, error: 'No suitable replacement found' })
  }

  // Write a description
  let description = ''
  try {
    const raw = await callGeminiRaw(
      `Write one appetising sentence (8-12 words) for the dish "${replacement.name}". Do not start with the dish name. Return only the sentence.`
    )
    description = raw.trim().replace(/^["']|["']$/g, '')
  } catch { /* fine */ }

  return NextResponse.json({
    dish: {
      name: replacement.name, description,
      meal_pairing:  replacement.meal_pairing  || '',
      cuisine_type:  replacement.cuisine_type  || 'Indian',
      complexity:    replacement.complexity    || 'moderate',
      is_vegetarian: replacement.is_vegetarian !== false,
      tags:          replacement.tags          || [],
      youtube_url:   replacement.youtube_url   || '',
      ingredients:   [],
    }
  })
}
