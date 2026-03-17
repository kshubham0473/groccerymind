import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { searchCorpusForDiscover, buildHouseholdContext, callGeminiRaw, cleanJson } from '@/lib/gemini'

export async function GET(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userPrompt = new URL(req.url).searchParams.get('prompt') || ''

  const supabase = createServiceClient()
  const [pantryRes, prefsRes, feedbackRes] = await Promise.all([
    supabase.from('pantry_items').select('name').eq('household_id', user.household_id).eq('stock_status', 'good'),
    supabase.from('households').select('preferences').eq('id', user.household_id).single(),
    supabase.from('dish_feedback').select('dish_name, signal').eq('household_id', user.household_id),
  ])

  const pantryItems = pantryRes.data?.map(p => p.name) || []
  const prefs       = prefsRes.data?.preferences || {}
  const feedback    = feedbackRes.data || []
  const dislikedDishNames = feedback.filter((f: any) => f.signal === 'dislike').map((f: any) => f.dish_name).filter(Boolean)

  // Log the prompt for behaviour learning
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

  // Step 1: Search corpus for candidates
  const candidates = searchCorpusForDiscover(userPrompt, prefs, pantryItems, 12)
    .filter((d: any) => !dislikedDishNames.includes(d.name))

  if (!candidates.length) {
    return NextResponse.json({ dishes: [], message: 'No matching dishes found. Try a different description.' })
  }

  // Step 2: Gemini ranks top candidates and writes descriptions
  // It cannot invent dishes — it only selects from and describes the candidates
  const householdContext = buildHouseholdContext(prefs, feedback)
  const candidateList = candidates.map((d: any, i: number) =>
    `${i+1}. ${d.name} (${d.cuisine_type || 'Indian'}, ${d.complexity || 'moderate'}, pairing: ${d.meal_pairing || 'varies'})`
  ).join('\n')

  const rankPrompt = `You are helping an Indian household decide what to cook.
${householdContext}
${userPrompt ? `User is looking for: "${userPrompt}"` : 'User wants general meal suggestions.'}

From the dishes below, pick the 3 best matches. For each write one appetising sentence (8-12 words).
Do NOT invent new dishes. ONLY use dishes from this list.

Candidates:
${candidateList}

Return ONLY a JSON array of exactly 3, no markdown:
[{"name": "exact dish name from list", "description": "one appetising sentence", "rank_reason": "brief reason"}]`

  try {
    const raw  = await callGeminiRaw(rankPrompt)
    const ranked = JSON.parse(cleanJson(raw))
    if (!Array.isArray(ranked)) throw new Error('not array')

    // Map ranked names back to full corpus objects
    const candidateMap = new Map(candidates.map((d: any) => [d.name.toLowerCase(), d]))
    const dishes = ranked
      .slice(0, 3)
      .map((r: any) => {
        const match = candidateMap.get((r.name || '').toLowerCase())
        if (!match) return null
        return {
          name:            match.name,
          description:     r.description || '',
          usesFromPantry:  pantryItems.filter((p: string) => match.name.toLowerCase().includes(p.toLowerCase())),
          needsToBuy:      [],  // not needed — corpus dishes don't have ingredient lists
          prepTime:        match.complexity === 'quick' ? '< 20 mins' : match.complexity === 'elaborate' ? '45+ mins' : '25-35 mins',
          mood:            match.tags?.includes('healthy') ? 'healthy'
                         : match.tags?.includes('comfort') ? 'hearty'
                         : match.tags?.includes('quick') ? 'quick'
                         : match.tags?.includes('festive') ? 'indulgent'
                         : 'light',
          meal_pairing:    match.meal_pairing || '',
          cuisine_type:    match.cuisine_type || '',
          youtube_url:     match.youtube_url || '',
          is_vegetarian:   match.is_vegetarian !== false,
          tags:            match.tags || [],
        }
      })
      .filter(Boolean)

    return NextResponse.json({ dishes })
  } catch (e: any) {
    // Fallback: return top 3 candidates without Gemini descriptions
    const fallback = candidates.slice(0, 3).map((d: any) => ({
      name:          d.name,
      description:   '',
      usesFromPantry: pantryItems.filter((p: string) => d.name.toLowerCase().includes(p.toLowerCase())),
      needsToBuy:    [],
      prepTime:      d.complexity === 'quick' ? '< 20 mins' : '25-35 mins',
      mood:          d.tags?.includes('quick') ? 'quick' : 'light',
      meal_pairing:  d.meal_pairing || '',
      cuisine_type:  d.cuisine_type || '',
      youtube_url:   d.youtube_url || '',
      is_vegetarian: d.is_vegetarian !== false,
      tags:          d.tags || [],
    }))
    return NextResponse.json({ dishes: fallback })
  }
}
