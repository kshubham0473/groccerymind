import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { searchCorpusForDiscover, buildHouseholdContext, parseIngredients, callGeminiRaw, cleanJson } from '@/lib/gemini'

export const maxDuration = 60

// ── Ingredient matching helpers ───────────────────────────────────────────────
// Handles plural/singular, Hindi↔English synonyms, and common name variants
const INGREDIENT_SYNONYMS: Record<string, string[]> = {
  potato:       ['potato','potatoes','aloo','alu'],
  tomato:       ['tomato','tomatoes','tamatar'],
  onion:        ['onion','onions','pyaaz','kanda','pyaz'],
  garlic:       ['garlic','lahsun','lasun'],
  ginger:       ['ginger','adrak'],
  curd:         ['curd','yogurt','yoghurt','dahi'],
  milk:         ['milk','doodh'],
  paneer:       ['paneer','cottage cheese'],
  capsicum:     ['capsicum','bell pepper','shimla mirch'],
  corn:         ['corn','sweet corn','maize','bhutta'],
  peas:         ['peas','matar','green peas','frozen peas'],
  spinach:      ['spinach','palak'],
  cauliflower:  ['cauliflower','gobi','gobhi'],
  'french beans':['french beans','beans','green beans','fansi'],
  carrot:       ['carrot','carrots','gajar'],
  lemon:        ['lemon','nimbu','lime'],
  egg:          ['egg','eggs','anda','ande'],
  chickpeas:    ['chickpeas','chole','chana','chick peas'],
  'kidney beans':['kidney beans','rajma'],
  rice:         ['rice','chawal','basmati'],
  flour:        ['flour','atta','wheat flour','maida'],
  oil:          ['oil','tel'],
  butter:       ['butter','makhan'],
  cream:        ['cream','malai','fresh cream'],
  bread:        ['bread','pav','pao'],
  mushroom:     ['mushroom','mushrooms','khumb'],
  brinjal:      ['brinjal','eggplant','baingan','aubergine'],
  'bitter gourd':['bitter gourd','karela'],
  'bottle gourd':['bottle gourd','lauki','ghia','dudhi'],
  'green chilli':['green chilli','hari mirch','green chili'],
  'spring onion':['spring onion','green onion','scallion'],
}

// Build reverse map: every variant → canonical form
const SYNONYM_LOOKUP = new Map<string, string>()
for (const [canonical, variants] of Object.entries(INGREDIENT_SYNONYMS)) {
  for (const v of variants) SYNONYM_LOOKUP.set(v.toLowerCase(), canonical)
}

function normaliseIngredientName(name: string): string {
  const n = name.toLowerCase().trim()
  // Check synonym map first
  if (SYNONYM_LOOKUP.has(n)) return SYNONYM_LOOKUP.get(n)!
  // Strip common plural suffixes
  if (n.endsWith('oes')) return n.slice(0, -2)  // tomatoes → tomat (then re-check)
  if (n.endsWith('es') && n.length > 4) return n.slice(0, -2)
  if (n.endsWith('s') && n.length > 3) return n.slice(0, -1)
  return n
}

function ingredientInPantry(ingredient: string, pantryItems: string[]): boolean {
  const normIng = normaliseIngredientName(ingredient)
  return pantryItems.some(p => {
    const normP = normaliseIngredientName(p)
    return normP === normIng ||
      normP.includes(normIng) ||
      normIng.includes(normP) ||
      // Also check original synonym variants
      (INGREDIENT_SYNONYMS[normP] || []).some(v => v === normIng) ||
      (INGREDIENT_SYNONYMS[normIng] || []).some(v => v === normP)
  })
}

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
  let candidates = await searchCorpusForDiscover(userPrompt, prefs, dislikedDishNames, pantryItems, 15)
  
  // Apply pantry-only filter if requested
  if (pantryOnly && pantryItems.length > 0) {
    const pantrySet = new Set(pantryItems.map(p => p.toLowerCase()))
    candidates = candidates.filter(d => {
      const dishIngredients = d.name.toLowerCase()
      return [...pantrySet].some(p => dishIngredients.includes(p))
    })
  }
  
  if (!candidates.length) {
    return NextResponse.json({ dishes: [], message: pantryOnly
      ? 'Not enough pantry matches found. Try turning off pantry filter.'
      : 'No matching dishes found. Try a different description.'
    })
  }

  // Step 2: Gemini ranks top 3 — injecting both household prefs AND learned patterns
  const householdContext = buildHouseholdContext(prefs, feedback)
  
  // Build learning context from behaviour patterns
  const learningParts: string[] = []
  if (recentlyCooked.length > 0) {
    learningParts.push(`Recently cooked: ${recentlyCooked.slice(0, 5).join(', ')}`)
  }
  const slotPrefs: Record<string, string[]> = { lunch: [], dinner: [] }
  for (const p of lockedPatterns) {
    if (slotPrefs[p.slot]) slotPrefs[p.slot].push(p.dish_name)
  }
  if (slotPrefs.lunch.length > 0) learningParts.push(`Lunch preferences: ${[...new Set(slotPrefs.lunch)].slice(0, 3).join(', ')}`)
  if (slotPrefs.dinner.length > 0) learningParts.push(`Dinner preferences: ${[...new Set(slotPrefs.dinner)].slice(0, 3).join(', ')}`)
  const learningContext = learningParts.length > 0 ? learningParts.join('\n') : ''
  
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
          ingredientInPantry(p, [match.name])  // check if pantry item is in dish name
        )
        let needsToBuy: string[] = []
        try {
          const allIngredients = await parseIngredients(match.name)
          needsToBuy = allIngredients.filter(ing => !ingredientInPantry(ing, pantryItems))
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
          image_url:     match.image_url    || '',
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
      usesFromPantry: pantryItems.filter((p: string) => ingredientInPantry(p, [d.name])),
      needsToBuy: [],
      prepTime:   d.complexity === 'quick' ? '< 20 mins' : '25–35 mins',
      mood:       d.tags?.includes('quick') ? 'quick' : 'light',
      meal_pairing: d.meal_pairing || '', cuisine_type: d.cuisine_type || '',
      youtube_url: d.youtube_url || '', image_url: d.image_url || '', is_vegetarian: d.is_vegetarian !== false, tags: d.tags || [],
    }))
    return NextResponse.json({ dishes: fallback })
  }
}
