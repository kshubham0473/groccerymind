import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { searchCorpusForDiscover, buildHouseholdContext, buildLearningContext, parseIngredients, callGeminiRaw, cleanJson } from '@/lib/gemini'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url        = new URL(req.url)
  const userPrompt = url.searchParams.get('prompt') || ''
  const pantryOnly = url.searchParams.get('pantry_only') === '1'
  const supabase   = createServiceClient()

  // Fetch all data in parallel — including behaviour_log for learning signals
  const [pantryRes, prefsRes, feedbackRes, cookedRes, lockedRes] = await Promise.all([
    supabase.from('pantry_items').select('name').eq('household_id', user.household_id).eq('stock_status', 'good'),
    supabase.from('households').select('preferences').eq('id', user.household_id).single(),
    supabase.from('dish_feedback').select('dish_name, signal, reason').eq('household_id', user.household_id),
    // Cooked events from last 14 days
    supabase.from('behaviour_log')
      .select('metadata')
      .eq('household_id', user.household_id)
      .eq('event_type', 'cooked')
      .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(20),
    // Lock events from last 30 days for slot/day preference learning
    supabase.from('behaviour_log')
      .select('metadata')
      .eq('household_id', user.household_id)
      .eq('event_type', 'meal_locked')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .limit(60),
  ])

  const pantryItems       = pantryRes.data?.map((p: any) => p.name) || []
  const prefs             = prefsRes.data?.preferences || {}
  const feedback          = feedbackRes.data || []
  const dislikedDishNames = feedback.filter((f: any) => f.signal === 'dislike').map((f: any) => f.dish_name).filter(Boolean)

  // Build learning signals from behaviour_log
  const recentlyCooked = (cookedRes.data || [])
    .map((r: any) => r.metadata?.dish_name)
    .filter(Boolean) as string[]

  const lockedPatterns = (lockedRes.data || [])
    .map((r: any) => {
      if (!r.metadata?.dish_name || !r.metadata?.lock_date || !r.metadata?.slot) return null
      const dow = new Date(r.metadata.lock_date).getDay()
      return { slot: r.metadata.slot, dish_name: r.metadata.dish_name, day_of_week: dow }
    })
    .filter(Boolean) as { slot: string; dish_name: string; day_of_week: number }[]

  // Log prompt for behaviour learning
  if (userPrompt) {
    try {
      await supabase.from('behaviour_log').insert({
        household_id: user.household_id, user_id: user.id,
        event_type: 'discover_prompt', metadata: { prompt: userPrompt }
      })
    } catch (_) {}
  }

  // Step 1: Semantic search in corpus (with optional pantry-only filter)
  const candidates = await searchCorpusForDiscover(userPrompt, prefs, dislikedDishNames, pantryItems, 15, pantryOnly)
  if (!candidates.length) {
    return NextResponse.json({ dishes: [], message: pantryOnly
      ? 'Not enough pantry matches found. Try turning off pantry filter.'
      : 'No matching dishes found. Try a different description.'
    })
  }

  // Step 2: Gemini ranks top 3 — injecting both household prefs AND learned patterns
  const householdContext = buildHouseholdContext(prefs, feedback)
  const learningContext  = buildLearningContext(feedback, recentlyCooked, lockedPatterns)
  const candidateList    = candidates.map((d: any, i: number) =>
    `${i+1}. ${d.name} (${d.cuisine_type || 'Indian'}, ${d.complexity || 'moderate'}, pairing: ${d.meal_pairing || 'varies'})`
  ).join('\n')

  const rankPrompt = `You are helping an Indian household decide what to cook.
${householdContext}
${learningContext}
${userPrompt ? `They are looking for: "${userPrompt}"` : 'They want general meal suggestions.'}

From the dishes below, pick the 3 best matches. Prioritise:
- Dishes not cooked recently
- Dishes matching their slot preferences (lunch/dinner patterns)
- Dishes they've enjoyed before
For each, write one appetising sentence (8-12 words).
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
    const pantrySet    = new Set(pantryItems.map(p => p.toLowerCase()))

    const rankedMatches = ranked.slice(0, 3)
      .map((r: any) => candidateMap.get((r.name || '').toLowerCase())
        ? { rank: r, match: candidateMap.get((r.name || '').toLowerCase())! }
        : null
      ).filter(Boolean) as { rank: any; match: any }[]

    // Pre-fetch ingredients for all 3 dishes in parallel so needsToBuy shows immediately
    const dishesWithIngredients = await Promise.all(
      rankedMatches.map(async ({ rank, match }) => {
        const usesFromPantry = pantryItems.filter(p =>
          match.name.toLowerCase().includes(p.toLowerCase())
        )
        let needsToBuy: string[] = []
        try {
          const allIngredients = await parseIngredients(match.name)
          needsToBuy = allIngredients.filter(ing =>
            !pantryItems.some(p => p.toLowerCase() === ing.toLowerCase())
          )
        } catch { needsToBuy = [] }
        return {
          name:          match.name,
          description:   rank.description || '',
          usesFromPantry,
          needsToBuy,
          prepTime:      match.complexity === 'quick' ? '< 20 mins' : match.complexity === 'elaborate' ? '45+ mins' : '25–35 mins',
          mood:          match.tags?.includes('healthy') ? 'healthy'
                       : match.tags?.includes('comfort') ? 'hearty'
                       : match.tags?.includes('quick')   ? 'quick'
                       : match.tags?.includes('festive') ? 'indulgent' : 'light',
          meal_pairing:  match.meal_pairing || '',
          cuisine_type:  match.cuisine_type || '',
          youtube_url:   match.youtube_url  || '',
          is_vegetarian: match.is_vegetarian !== false,
          tags:          match.tags || [],
        }
      })
    )

    return NextResponse.json({ dishes: dishesWithIngredients })
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
