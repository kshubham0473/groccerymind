import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { searchCorpusForDiscover, buildHouseholdContext, callGeminiRaw, cleanJson } from '@/lib/gemini'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userPrompt = new URL(req.url).searchParams.get('prompt') || ''
  const supabase   = createServiceClient()

  const [pantryRes, prefsRes, feedbackRes] = await Promise.all([
    supabase.from('pantry_items').select('name').eq('household_id', user.household_id).eq('stock_status', 'good'),
    supabase.from('households').select('preferences').eq('id', user.household_id).single(),
    supabase.from('dish_feedback').select('dish_name, signal').eq('household_id', user.household_id),
  ])

  const pantryItems       = pantryRes.data?.map((p: any) => p.name) || []
  const prefs             = prefsRes.data?.preferences || {}
  const feedback          = feedbackRes.data || []
  const dislikedDishNames = feedback.filter((f: any) => f.signal === 'dislike').map((f: any) => f.dish_name).filter(Boolean)

  // Log prompt for behaviour learning
  if (userPrompt) {
    try {
      await supabase.from('behaviour_log').insert({
        household_id: user.household_id, user_id: user.id,
        event_type: 'discover_prompt', metadata: { prompt: userPrompt }
      })
    } catch (_) {}
  }

  // Step 1: Semantic search in corpus
  const candidates = await searchCorpusForDiscover(userPrompt, prefs, dislikedDishNames, pantryItems, 15)
  if (!candidates.length) {
    return NextResponse.json({ dishes: [], message: 'No matching dishes found. Try a different description.' })
  }

  // Step 2: Gemini ranks top 3 and writes descriptions — cannot invent dishes
  const householdContext = buildHouseholdContext(prefs, feedback)
  const candidateList    = candidates.map((d: any, i: number) =>
    `${i+1}. ${d.name} (${d.cuisine_type || 'Indian'}, ${d.complexity || 'moderate'}, pairing: ${d.meal_pairing || 'varies'})`
  ).join('\n')

  const rankPrompt = `You are helping an Indian household decide what to cook.
${householdContext}
${userPrompt ? `They are looking for: "${userPrompt}"` : 'They want general meal suggestions.'}

From the dishes below, pick the 3 best matches. For each, write one appetising sentence (8-12 words).
You MUST ONLY use dishes from this list — do not suggest any other dish.

Candidates:
${candidateList}

Return ONLY a JSON array of exactly 3, no markdown:
[{"name": "exact name from list above", "description": "one appetising sentence"}]`

  try {
    const raw    = await callGeminiRaw(rankPrompt)
    const ranked = JSON.parse(cleanJson(raw))
    if (!Array.isArray(ranked)) throw new Error('not array')

    const candidateMap = new Map(candidates.map((d: any) => [d.name.toLowerCase(), d]))
    const dishes = ranked.slice(0, 3)
      .map((r: any) => {
        const match = candidateMap.get((r.name || '').toLowerCase())
        if (!match) return null
        return {
          name:           match.name,
          description:    r.description || '',
          usesFromPantry: pantryItems.filter((p: string) => match.name.toLowerCase().includes(p.toLowerCase())),
          needsToBuy:     [],
          prepTime:       match.complexity === 'quick' ? '< 20 mins' : match.complexity === 'elaborate' ? '45+ mins' : '25–35 mins',
          mood:           match.tags?.includes('healthy') ? 'healthy'
                        : match.tags?.includes('comfort') ? 'hearty'
                        : match.tags?.includes('quick')   ? 'quick'
                        : match.tags?.includes('festive') ? 'indulgent' : 'light',
          meal_pairing:   match.meal_pairing || '',
          cuisine_type:   match.cuisine_type || '',
          youtube_url:    match.youtube_url  || '',
          is_vegetarian:  match.is_vegetarian !== false,
          tags:           match.tags || [],
        }
      })
      .filter(Boolean)

    return NextResponse.json({ dishes })
  } catch {
    // Fallback: top 3 without descriptions
    const fallback = candidates.slice(0, 3).map((d: any) => ({
      name: d.name, description: '',
      usesFromPantry: pantryItems.filter((p: string) => d.name.toLowerCase().includes(p.toLowerCase())),
      needsToBuy: [],
      prepTime:   d.complexity === 'quick' ? '< 20 mins' : '25–35 mins',
      mood:       d.tags?.includes('quick') ? 'quick' : 'light',
      meal_pairing: d.meal_pairing || '', cuisine_type: d.cuisine_type || '',
      youtube_url: d.youtube_url || '', is_vegetarian: d.is_vegetarian !== false, tags: d.tags || [],
    }))
    return NextResponse.json({ dishes: fallback })
  }
}
