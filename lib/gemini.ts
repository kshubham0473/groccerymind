// Gemini API utility — server-side only

const GEMINI_MODEL = 'gemini-2.5-flash-lite'
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

export async function callGeminiRaw(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 2000 }
    })
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

export function cleanJson(raw: string): string {
  return raw.replace(/^```json\s*|^```\s*|```\s*$/gm, '').trim()
}

// Large output variant — for prompts that return big JSON structures (24 dishes etc.)
export async function callGeminiLarge(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 8192 }
    })
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// ── Build a rich household context string injected into every prompt ──────────
export function buildHouseholdContext(
  prefs: Record<string, any>,
  feedback: { dish_name: string; signal: string }[]
): string {
  const lines: string[] = []

  // Core identity
  if (prefs.dietary && prefs.dietary !== 'No restrictions') lines.push(`Diet: ${prefs.dietary}`)
  if (prefs.cuisine_prefs?.length) lines.push(`Preferred cuisines: ${prefs.cuisine_prefs.join(', ')}`)
  if (prefs.dislikes) lines.push(`Hard dislikes / always avoid: ${prefs.dislikes}`)

  // Cooking style
  if (prefs.meal_complexity) lines.push(`Cooking complexity preference: ${prefs.meal_complexity}`)
  if (prefs.cooking_time) lines.push(`Preferred cooking time: ${prefs.cooking_time}`)
  if (prefs.spice_level) lines.push(`Spice level: ${prefs.spice_level}`)

  // Variety & habits
  if (prefs.meal_variety) lines.push(`Meal variety appetite: ${prefs.meal_variety}`)
  if (prefs.protein_prefs?.length) lines.push(`Preferred proteins: ${prefs.protein_prefs.join(', ')}`)
  if (prefs.texture_prefs?.length) lines.push(`Preferred dish styles: ${prefs.texture_prefs.join(', ')}`)

  // Health & occasions
  if (prefs.health_goals?.length && !prefs.health_goals.includes('no goals')) {
    lines.push(`Health goals: ${prefs.health_goals.join(', ')}`)
  }
  if (prefs.meal_occasions?.length) lines.push(`Cooks for: ${prefs.meal_occasions.join(', ')}`)

  // Learned feedback signals
  const liked = feedback.filter(f => f.signal === 'like').map(f => f.dish_name).filter(Boolean)
  const disliked = feedback.filter(f => f.signal === 'dislike').map(f => f.dish_name).filter(Boolean)
  if (liked.length) lines.push(`Dishes they've enjoyed: ${liked.slice(0, 12).join(', ')}`)
  if (disliked.length) lines.push(`Dishes they disliked: ${disliked.slice(0, 12).join(', ')}`)

  return lines.length ? `\nHousehold preferences:\n${lines.join('\n')}` : ''
}

// ── Learning context from behaviour signals ───────────────────────────────────
// Reads cooked history + lock patterns to inject personalised learning into prompts.
// Call alongside buildHouseholdContext in Discover and suggestion routes.
export function buildLearningContext(
  feedback: { dish_name: string | null; signal: string; reason?: string | null }[],
  recentlyCooked: string[],         // dish names from behaviour_log 'cooked' events, last 14 days
  lockedPatterns: { slot: string; dish_name: string; day_of_week: number }[]  // from 'meal_locked' events
): string {
  const lines: string[] = []

  const liked    = feedback.filter(f => f.signal === 'like').map(f => f.dish_name).filter(Boolean) as string[]
  const disliked = feedback.filter(f => f.signal === 'dislike').map(f => f.dish_name).filter(Boolean) as string[]

  if (liked.length)          lines.push(`Dishes they enjoy: ${liked.slice(0, 10).join(', ')}`)
  if (disliked.length)       lines.push(`Dishes to avoid (disliked): ${disliked.slice(0, 10).join(', ')}`)
  if (recentlyCooked.length) lines.push(`Cooked recently — avoid repeating: ${recentlyCooked.slice(0, 8).join(', ')}`)

  // Derive slot + day preferences from lock history
  const lunchDishes  = [...new Set(lockedPatterns.filter(l => l.slot === 'lunch').map(l => l.dish_name))].slice(0, 5)
  const dinnerDishes = [...new Set(lockedPatterns.filter(l => l.slot === 'dinner').map(l => l.dish_name))].slice(0, 5)
  const wkndDishes   = [...new Set(lockedPatterns.filter(l => [0, 6].includes(l.day_of_week)).map(l => l.dish_name))].slice(0, 4)

  if (lunchDishes.length)  lines.push(`Often chosen for lunch: ${lunchDishes.join(', ')}`)
  if (dinnerDishes.length) lines.push(`Often chosen for dinner: ${dinnerDishes.join(', ')}`)
  if (wkndDishes.length)   lines.push(`Weekend favourites (from history): ${wkndDishes.join(', ')}`)

  return lines.length ? `\nLearned patterns:\n${lines.join('\n')}` : ''
}

// ── Ingredient parser ─────────────────────────────────────────────────────────
export async function parseIngredients(dishName: string): Promise<string[]> {
  const prompt = `You are a knowledgeable Indian home cooking assistant.
For the dish "${dishName}", list the main ingredients a typical Indian household needs to buy.
Exclude ALL of the following — do NOT include them in your answer:
- Salt, oil, ghee, butter (pantry basics)
- Any spice or spice powder: cumin, turmeric, chilli powder, red chilli, garam masala, coriander powder, cumin powder, mustard seeds, hing, ajwain, kasuri methi, amchur, chaat masala, pav bhaji masala, biryani masala, etc.
- Fresh aromatics that are always stocked: ginger, garlic, green chilli, curry leaves
Only include main ingredients that someone would specifically need to buy for this dish.
Return ONLY a JSON array of strings, no markdown, no backticks, max 8 items.
Example: ["onion", "tomato", "paneer", "capsicum"]`
  try {
    const parsed = JSON.parse(cleanJson(await callGeminiRaw(prompt)))
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

// ── Corpus-based dish functions ──────────────────────────────────────────────
// Strategy:
//   Onboarding: Gemini names 50 dishes freely → embed → match to corpus →
//               semantic dedup → category spread → Gemini writes descriptions only
//   Regenerate: embed dish being replaced → find semantically similar but distinct corpus match
//   Discover:   embed user query → nearest corpus dishes → Gemini ranks/describes top 3

import {
  loadFullCorpus, applyHardFilters, embedText, embedBatch,
  findNearest, semanticDedup, CorpusDish
} from './corpus-utils'

// ── Category spread for final 24 selection ────────────────────────────────────
type CatDef = { name: string; match: (d: CorpusDish) => boolean; target: number }

const SPREAD_CATEGORIES: CatDef[] = [
  { name: 'Rice meals',
    match: d => {
      const n = d.name.toLowerCase()
      const isRiceDish = ['pulao','biryani','khichdi','chawal','fried rice'].some(w => n.includes(w)) || n.endsWith(' rice')
      const pairingIsRice = d.meal_pairing?.toLowerCase().includes('rice')
      // Exclude corpus data errors: rice dish paired with "with Steamed Rice"
      if (isRiceDish && pairingIsRice) return false
      return (pairingIsRice || isRiceDish) && !d.tags?.includes('breakfast')
    },
    target: 3 },
  { name: 'Dal & legumes',
    match: d => ['dal','rajma','chole','masoor','moong dal','chana dal']
      .some(w => d.name.toLowerCase().includes(w)) &&
      !['paratha','cheela','dosa','idli'].some(w => d.name.toLowerCase().includes(w)),
    target: 3 },
  { name: 'Paneer',
    match: d => d.name.toLowerCase().includes('paneer'),
    target: 2 },
  { name: 'Egg dishes',
    match: d => {
      const n = d.name.toLowerCase()
      return n.startsWith('egg ') || n === 'egg' || n.startsWith('anda') ||
        [' egg ',' anda ','omelette','bhurji'].some(w => n.includes(w))
    },
    target: 2 },
  { name: 'Veg sabzi',
    match: d => ['sabzi','sabji','bhindi','gobi','palak','methi ','baingan','tinda']
      .some(w => d.name.toLowerCase().includes(w)) &&
      !['paratha','dal','paneer'].some(w => d.name.toLowerCase().includes(w)),
    target: 3 },
  { name: 'Roti & paratha',
    match: d => ['paratha','poori','puri'].some(w => d.name.toLowerCase().includes(w)) &&
      !d.name.toLowerCase().includes('paneer') &&
      d.meal_pairing?.toLowerCase() !== 'standalone',
    target: 3 },
  { name: 'Breakfast & quick',
    match: d => !!d.tags?.includes('breakfast'),
    target: 3 },
  { name: 'Weekend special',
    match: d => d.complexity === 'elaborate' || !!d.tags?.includes('festive'),
    target: 2 },
  { name: 'Misc variety',
    match: () => true,
    target: 3 },
]

function spreadByCategory(candidates: CorpusDish[], fallbackPool: CorpusDish[], n: number): Array<CorpusDish & { _category: string }> {
  const used   = new Set<string>()
  const result: Array<CorpusDish & { _category: string }> = []

  for (const cat of SPREAD_CATEGORIES) {
    const eligible = candidates.filter(d => cat.match(d) && !used.has(d.name))
    let picked = 0
    for (const d of eligible) {
      if (picked >= cat.target) break
      used.add(d.name)
      result.push({ ...d, _category: cat.name })
      picked++
    }
  }

  // Fill remaining from fallback pool (shuffled)
  if (result.length < n) {
    const shuffled = [...fallbackPool].sort(() => Math.random() - 0.5)
    for (const d of shuffled) {
      if (result.length >= n) break
      if (used.has(d.name)) continue
      result.push({ ...d, _category: 'Misc variety' })
      used.add(d.name)
    }
  }
  return result.slice(0, n)
}

// ── Onboarding: 24 starter dishes ────────────────────────────────────────────
export async function getStarterDishes(context: {
  householdContext: string
  prefs?: Record<string, any>
}): Promise<any[]> {
  const corpus = loadFullCorpus()
  if (!corpus.length) return []

  const prefs    = context.prefs || {}
  const filtered = applyHardFilters(corpus, prefs)
  if (!filtered.length) return []

  // Step 1: Gemini freely names 50 dishes for this household
  const suggestPrompt = `You are helping plan meals for an Indian household.
${context.householdContext}

Name 50 dishes this household would realistically cook at home across a typical week.
Include: everyday rice meals, dal/legume dishes, vegetable sabzis, paratha/roti meals,
quick breakfasts, egg dishes (if dietary allows), paneer dishes, 2-3 weekend specials,
and 2-3 global dishes (pasta, noodles, tacos etc.) if it matches their preferences.

Return ONLY a JSON array of dish names, no markdown:
["Dal Tadka", "Poha", "Rajma Chawal"]`

  let suggestedNames: string[] = []
  try {
    const raw    = await callGeminiRaw(suggestPrompt)
    const parsed = JSON.parse(cleanJson(raw))
    suggestedNames = Array.isArray(parsed) ? parsed.slice(0, 50) : []
  } catch { return [] }

  if (!suggestedNames.length) return []

  // Step 2: Embed all suggested names, find nearest corpus match for each
  const MATCH_THRESHOLD = 0.80
  const embeddings      = await embedBatch(suggestedNames)
  const usedCorpus      = new Set<string>()
  const matched: Array<CorpusDish & { _geminiName: string }> = []

  for (let i = 0; i < suggestedNames.length; i++) {
    if (!embeddings[i]?.length) continue
    const nearest = findNearest(embeddings[i], filtered, 3, usedCorpus)
    if (nearest.length && nearest[0].score >= MATCH_THRESHOLD) {
      const match = nearest[0].dish
      matched.push({ ...match, _geminiName: suggestedNames[i] })
      usedCorpus.add(match.name)
    }
  }

  if (!matched.length) return []

  // Step 3: Semantic dedup — removes near-identical corpus matches
  const deduped = semanticDedup(matched, 0.88) as CorpusDish[]

  // Step 4: Spread across meal categories
  const selected = spreadByCategory(deduped, filtered, 24)

  // Step 5: Gemini writes descriptions only (no dish selection)
  const dishList = selected.map(d => d.name).join('\n')
  let descriptions: Record<string, string> = {}
  try {
    const raw = await callGeminiRaw(
      `Write a one-sentence appetising description (8-12 words) for each Indian dish.
Do NOT start with the dish name. Focus on flavour, occasion, or texture.
Dishes:
${dishList}

Return ONLY a JSON object, no markdown:
{"Dal Tadka": "Smoky tempered lentils — the anchor of every Indian week."}`
    )
    descriptions = JSON.parse(cleanJson(raw))
  } catch { /* descriptions stay blank */ }

  return selected.map(d => ({
    name:          d.name,
    description:   descriptions[d.name] || '',
    meal_pairing:  d.meal_pairing  || '',
    cuisine_type:  d.cuisine_type  || 'Indian',
    complexity:    d.complexity    || 'moderate',
    is_vegetarian: d.is_vegetarian !== false,
    tags:          d.tags          || [],
    youtube_url:   d.youtube_url   || '',
    ingredients:   [],
    _category:     (d as any)._category || '',
  }))
}

// ── Single card regeneration ──────────────────────────────────────────────────
export async function getReplacementDish(
  excludeNames: string[],
  prefs: Record<string, any>,
  dishBeingReplaced: string
): Promise<CorpusDish | null> {
  const corpus   = loadFullCorpus()
  const filtered = applyHardFilters(corpus, prefs)
  if (!filtered.length) return null

  const excludeSet     = new Set(excludeNames)
  const queryEmbedding = await embedText(dishBeingReplaced)
  const nearest        = findNearest(queryEmbedding, filtered, 20, excludeSet)

  const goodCandidates = nearest.filter(n => n.score < 0.88 && n.score > 0.50)
  const pool = goodCandidates.length ? goodCandidates.slice(0, 5) : nearest.slice(0, 5)

  if (!pool.length) return null
  return pool[Math.floor(Math.random() * pool.length)].dish
}

// ── Discover: semantic search + Gemini rank ───────────────────────────────────
export async function searchCorpusForDiscover(
  query: string,
  prefs: Record<string, any>,
  dislikedDishNames: string[],
  pantryItems: string[],
  nCandidates = 15,
  pantryOnly = false
): Promise<CorpusDish[]> {
  const corpus = loadFullCorpus()

  // Dietary + dislikes filter (includes snacks for discover)
  const allFiltered = corpus.filter(d => {
    const dietary = prefs.dietary || ''
    if (['Vegetarian','Vegan','Jain'].includes(dietary) && !d.is_vegetarian) return false
    const dislikes = (prefs.dislikes || '').toLowerCase()
    if (dislikes) {
      const words = dislikes.replace(/;/g, ',').split(',').map((w: string) => w.trim()).filter(Boolean)
      const n = d.name.toLowerCase()
      if (words.some((w: string) => n.includes(w))) return false
    }
    return true
  })

  if (!allFiltered.length) return []

  const dislikedSet = new Set(dislikedDishNames.map(n => n.toLowerCase()))
  let available = allFiltered.filter(d => !dislikedSet.has(d.name.toLowerCase()))

  // Pantry-only mode: restrict to dishes whose name overlaps with in-stock pantry items
  if (pantryOnly && pantryItems.length > 0) {
    const pantrySet = new Set(pantryItems.map(p => p.toLowerCase()))
    const pantryFiltered = available.filter(d => {
      const n = d.name.toLowerCase()
      return [...pantrySet].some(p => p.length > 3 && n.includes(p))
    })
    // Only apply if we get enough results; otherwise fall back gracefully
    if (pantryFiltered.length >= 4) available = pantryFiltered
  }

  // No query: return random varied selection
  if (!query.trim()) {
    return available.sort(() => Math.random() - 0.5).slice(0, nCandidates)
  }

  const queryEmbedding = await embedText(query)
  const nearest        = findNearest(queryEmbedding, available, nCandidates * 2)

  // Small pantry boost
  const pantrySet = new Set(pantryItems.map(p => p.toLowerCase()))
  const scored    = nearest.map(({ dish, score }) => ({
    dish,
    score: score + ([...pantrySet].some(p => dish.name.toLowerCase().includes(p)) ? 0.04 : 0)
  }))
  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, nCandidates).map(s => s.dish)
}

export async function getMealSuggestion(context: {
  today: string
  lunchOptions: string[]
  dinnerOptions: string[]
  lowItems: string[]
  finishedItems: string[]
  recentlyCooked: string[]
  householdContext?: string
}): Promise<{ lunch: string | null; dinner: string | null; reason: string } | null> {
  const prompt = `You are a smart Indian household kitchen assistant.
Today is ${context.today}.
Lunch options: ${context.lunchOptions.join(', ') || 'none'}
Dinner options: ${context.dinnerOptions.join(', ') || 'none'}
Low/finished pantry items: ${[...context.lowItems, ...context.finishedItems].join(', ') || 'none'}
Recently cooked (avoid repeating): ${context.recentlyCooked.join(', ') || 'none'}
${context.householdContext || ''}
Pick the best lunch and dinner from the options. Avoid dishes needing finished items. Prefer variety.
Return ONLY valid JSON, no markdown:
{"lunch": "dish name or null", "dinner": "dish name or null", "reason": "one short friendly sentence"}`
  try {
    return JSON.parse(cleanJson(await callGeminiRaw(prompt)))
  } catch { return null }
}

// ── Morning mood nudge ────────────────────────────────────────────────────────
const INDIAN_FESTIVALS: Record<string, string> = {
  '01-14': 'Makar Sankranti', '01-15': 'Makar Sankranti',
  '01-26': 'Republic Day',
  '03-25': 'Holi', '03-26': 'Holi',
  '04-14': 'Baisakhi / Ambedkar Jayanti',
  '08-15': 'Independence Day',
  '08-26': 'Janmashtami', '08-27': 'Janmashtami',
  '09-07': 'Ganesh Chaturthi', '09-08': 'Ganesh Chaturthi',
  '10-02': 'Gandhi Jayanti',
  '10-12': 'Navratri', '10-13': 'Navratri', '10-20': 'Dussehra',
  '11-01': 'Diwali', '11-02': 'Diwali',
  '11-15': 'Guru Nanak Jayanti',
  '12-25': 'Christmas',
}

function getTodayFestival(): string | null {
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(now.getUTCDate()).padStart(2, '0')
  return INDIAN_FESTIVALS[`${mm}-${dd}`] || null
}

export async function getMoodNudge(context: {
  dayOfWeek: string
  timeSlot?: string
  recentlyCooked: string[]
  householdContext?: string
  userName?: string
}): Promise<{ message: string; chips: string[] } | null> {
  const slot = context.timeSlot || 'morning'
  const timeContext = {
    morning:   "morning (7–11am) — planning the day's cooking",
    midday:    "midday (11am–3pm) — lunchtime decision",
    afternoon: "afternoon (3–7pm) — thinking about dinner",
    evening:   "evening (7pm+) — winding down, maybe planning tomorrow",
  }[slot] ?? 'daytime'

  const festival = getTodayFestival()
  const festivalLine = festival ? `Today is ${festival} — a great reason to cook something special!` : ''
  const nameLine = context.userName ? `The user's name is ${context.userName}.` : ''

  const personalities = [
    'cheeky and witty — use a food pun or clever wordplay',
    'warm and encouraging like a caring auntie',
    'philosophical and slightly dramatic about food',
    'playful and humorous — make them smile',
    'concise and sharp — one punchy line',
  ]
  const personality = personalities[Math.floor(Math.random() * personalities.length)]

  const prompt = `You are a personality-rich Indian household kitchen assistant.
Personality for this message: ${personality}
${nameLine}
Today is ${context.dayOfWeek}, ${timeContext}.
${festivalLine}
Recently cooked by this household: ${context.recentlyCooked.join(', ') || 'nothing logged yet'}
${context.householdContext || ''}

Write ONE short message (max 20 words) perfectly suited to this time of day and context.
Rules:
- If morning: something about planning today's meals
- If midday: a nudge about what's for lunch right now
- If afternoon: build anticipation about dinner
- If evening: reflection or light planning for tomorrow
- If it's a festival day, weave that in naturally
- Use the user's name if provided (max once, naturally)
- Match the personality style — be memorable, not generic
- No hashtags, no emojis in the text itself

Then suggest 3 quick-tap chips (2–4 words) that match the time of day and personality.
Chips should vary in mood — one practical, one indulgent, one playful/unexpected.

Return ONLY valid JSON, no markdown:
{"message": "...", "chips": ["Dal makhani weather?", "Something crunchy", "Surprise us"]}`
  try {
    return JSON.parse(cleanJson(await callGeminiRaw(prompt)))
  } catch { return null }
}

// ── Order suggestions ─────────────────────────────────────────────────────────
export async function getOrderSuggestions(context: {
  currentOrderItems: string[]
  lowPantryItems: { name: string; tier: string; daysSinceOrder: number }[]
  goodPantryItems?: string[]
  upcomingMeals: string[]
  householdContext?: string
}): Promise<{ item: string; reason: string }[]> {
  const goodStock = context.goodPantryItems?.length
    ? `Well stocked (already have): ${context.goodPantryItems.slice(0, 20).join(', ')}`
    : ''
  const prompt = `You are a smart Indian household grocery assistant.
Already in order list: ${context.currentOrderItems.join(', ') || 'none'}
Low / finished pantry items (need restocking): ${context.lowPantryItems.map(i => `${i.name} (${i.daysSinceOrder}d since restock)`).join(', ') || 'none'}
${goodStock}
Upcoming meals this week: ${context.upcomingMeals.join(', ') || 'none'}
${context.householdContext || ''}
Task: suggest up to 5 grocery items to order.
Rules:
- Cross-reference the upcoming meals against what is already well stocked — only suggest ingredients that are missing or low
- Do NOT suggest items already in the order list
- Do NOT suggest items that are already well stocked
- Do NOT suggest spices, salt, or oil
- Prioritise items needed for the upcoming meals first, then low pantry items
Return ONLY a JSON array, no markdown:
[{"item": "name", "reason": "short reason e.g. needed for Dal Tadka, running low"}]`
  try {
    const parsed = JSON.parse(cleanJson(await callGeminiRaw(prompt)))
    return Array.isArray(parsed) ? parsed.slice(0, 5) : []
  } catch { return [] }
}
