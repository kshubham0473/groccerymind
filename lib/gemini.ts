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

// ── Dish suggestions (discover + chatbox prompt) ──────────────────────────────
export async function getDishSuggestions(context: {
  availableItems: string[]
  existingDishes: string[]
  householdContext?: string
  userPrompt?: string        // natural language intent from chatbox
}): Promise<any[]> {
  const intentLine = context.userPrompt
    ? `\nUser's specific request today: "${context.userPrompt}" — prioritise this intent above all else.`
    : ''

  const prompt = `You are a creative Indian home cooking assistant.
Available pantry items right now: ${context.availableItems.join(', ')}
Dishes this household already regularly makes (avoid repeating these unless specifically requested): ${context.existingDishes.slice(0, 25).join(', ')}
${context.householdContext || ''}${intentLine}

IMPORTANT RULES:
- Only suggest real, cookable food dishes. If the user's request is not about food, return an empty array with a message field.
- The "needsToBuy" list must NEVER include: salt, oil, ghee, butter, or ANY spice/spice powder (cumin, turmeric, garam masala, chilli powder, coriander powder, mustard seeds, hing, etc). Assume all spices are always stocked.
- Use at least 3 pantry items per dish
- Suggest exactly 3 dishes, each with a different character/style

Return ONLY a JSON array, no markdown, no backticks:
[
  {
    "name": "dish name",
    "description": "one appetising sentence",
    "usesFromPantry": ["item1", "item2", "item3"],
    "needsToBuy": ["item1", "item2"],
    "prepTime": "20 mins",
    "mood": "light"
  }
]
mood must be one of: "light", "hearty", "quick", "indulgent", "healthy"
If the user's request is not food-related, return: [{"error": "Please describe a type of food, dish, or ingredient you're craving."}]`

  try {
    const raw = await callGeminiRaw(prompt)
    const dishes = JSON.parse(cleanJson(raw))
    return Array.isArray(dishes) ? dishes : []
  } catch { return [] }
}

// ── Onboarding: generate starter dish shortlist ───────────────────────────────
// ── Corpus-aware dish selection ───────────────────────────────────────────────
// When lib/dishes-corpus.json exists (after running the YouTube scraper),
// we select from real curated dishes instead of generating from scratch.
// Falls back to Gemini generation if the corpus doesn't exist or is empty.
function loadCorpus(): any[] {
  try {
    // Use fs so the path resolves correctly in Vercel's runtime environment
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs')
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path')
    const corpusPath = path.join(process.cwd(), 'lib', 'dishes-corpus.json')
    if (!fs.existsSync(corpusPath)) return []
    const raw = fs.readFileSync(corpusPath, 'utf-8')
    const parsed = JSON.parse(raw)
    return parsed.dishes || []
  } catch { return [] }
}

async function selectFromCorpus(corpus: any[], householdContext: string): Promise<any[]> {
  if (corpus.length === 0) return []

  // Build a summary of the corpus for Gemini to select from
  // Send dish names + cuisine + complexity — Gemini picks 24 that match preferences
  const corpusSummary = corpus
    .map((d: any, i: number) => `${i+1}. ${d.name} (${d.cuisine_type || 'Indian'}, ${d.complexity || 'moderate'}, ${d.is_vegetarian ? 'veg' : 'non-veg'})`)
    .join('\n')
    .slice(0, 8000) // stay within token limits

  const prompt = `You are selecting dishes from a pre-verified corpus for an Indian household's weekly meal plan.
${householdContext}

From the dishes listed below, select exactly 24 that best match this household's preferences.
Rules:
- Pick diverse dishes across: rice meals, roti/paratha meals, breakfast/snack, legume-based, paneer, vegetables, eggs (if allowed), weekend specials
- No two dishes with the same primary defining ingredient
- Max 2 paneer dishes
- Respect dietary preference strictly

Return ONLY a JSON array of the dish names you selected (exactly as written), no markdown:
["Dal Tadka", "Poha", ...]

Corpus:
${corpusSummary}`

  try {
    const raw = await callGeminiRaw(prompt)
    const selected: string[] = JSON.parse(cleanJson(raw))
    if (!Array.isArray(selected)) return []

    // Map selected names back to full corpus objects
    const corpusMap = new Map(corpus.map((d: any) => [d.name.toLowerCase().trim(), d]))
    const result = selected
      .map((name: string) => corpusMap.get(name.toLowerCase().trim()))
      .filter(Boolean)
      .slice(0, 24)

    // Convert corpus format to onboarding format (add empty ingredients for now)
    return result.map((d: any) => ({
      name: d.name,
      description: d.description || '',
      meal_pairing: d.meal_pairing || '',
      cuisine_type: d.cuisine_type || 'Indian',
      complexity: d.complexity || 'moderate',
      cooking_time_mins: d.cooking_time_mins || null,
      is_vegetarian: d.is_vegetarian !== false,
      tags: d.tags || [],
      youtube_url: d.youtube_url || '',
      // Ingredients will still be empty from corpus — user can fill in later
      // or we generate them in a separate call
      ingredients: [],
    }))
  } catch { return [] }
}

export async function getStarterDishes(context: {
  householdContext: string
}): Promise<{
  name: string; description: string; meal_pairing: string
  cuisine_type: string; complexity: string; cooking_time_mins: number
  is_vegetarian: boolean; tags: string[]
  ingredients: { name: string; category: string; tier: string; depletion_days: number }[]
}[]> {
  const prompt = `You are building a weekly meal rotation for an Indian household.
${context.householdContext}

Generate exactly 24 DISTINCT dishes for their weekly rotation.

STRICT RULES:
1. Every dish must have a UNIQUE name — no duplicates, no near-duplicates
2. No two dishes can share the same primary defining ingredient (e.g. don't suggest both "Dal Tadka" AND "Dal Fry" — pick ONE dal dish; not both "Aloo Sabzi" AND "Aloo Methi")
3. Spread across 8 categories (~3 dishes each):
   - Everyday rice meals (dal chawal, khichdi, etc.)
   - Everyday roti/paratha meals
   - Quick breakfast/snack dishes (poha, upma, cheela, eggs)
   - Legume-based (chole, rajma — pick DIFFERENT legumes)
   - Paneer dishes (max 2 total)
   - Egg dishes (only if dietary allows)
   - Vegetable sabzis (DIFFERENT vegetables each)
   - Weekend/special dishes
4. meal_pairing: what this dish is typically served with (e.g. "with Steamed Rice", "with Roti", standalone)
5. complexity: "quick" (<20 min), "moderate" (20-40 min), "elaborate" (>40 min)
6. tags: 1-3 from: ["high-protein","low-oil","one-pot","kid-friendly","monsoon","summer","festive","quick","comfort"]
7. ingredients: list ONLY 3-4 KEY items to buy — specific grocery items a person actually buys (NOT "mixed vegetables", NOT "oil", NOT any spice). Each ingredient MUST have category, tier, and depletion_days:
   - category: "Vegetables" | "Leafy Greens" | "Dairy" | "Eggs" | "Grains & Lentils" | "Bakery" | "Condiments" | "Packaged"
   - tier: "fresh" | "weekly" | "staple"
   - depletion_days: integer (fresh: 3-7, weekly: 7-21, staple: 21-60)

Return ONLY a valid JSON array, no markdown:
[
  {
    "name": "Dal Tadka",
    "description": "Smoky tempered lentils — the weekday anchor",
    "meal_pairing": "with Steamed Rice and Papad",
    "cuisine_type": "North Indian",
    "complexity": "moderate",
    "cooking_time_mins": 30,
    "is_vegetarian": true,
    "tags": ["comfort", "high-protein"],
    "ingredients": [
      {"name": "Toor Dal", "category": "Grains & Lentils", "tier": "staple", "depletion_days": 30},
      {"name": "Tomato", "category": "Vegetables", "tier": "fresh", "depletion_days": 5}
    ]
  }
]`
  // Try corpus first
  const corpus = loadCorpus()
  if (corpus.length > 50) {
    console.log(`[getStarterDishes] Using corpus (${corpus.length} dishes)`)
    const corpusResult = await selectFromCorpus(corpus, context.householdContext)
    if (corpusResult.length >= 12) return corpusResult
    console.log('[getStarterDishes] Corpus selection too small, falling back to generation')
  }

  // Fall back to Gemini generation
  try {
    const raw = await callGeminiLarge(prompt)
    const dishes = JSON.parse(cleanJson(raw))
    if (!Array.isArray(dishes)) return []
    const seen = new Set<string>()
    return dishes.filter((d: any) => {
      if (!d.name) return false
      const norm = d.name.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (seen.has(norm)) return false
      seen.add(norm)
      return true
    }).slice(0, 24)
  } catch { return [] }
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
// Indian festival calendar — major festivals by month-day
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
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000) // IST
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

  // Rotate personality styles — picked fresh each call for variety
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
  upcomingMeals: string[]
  householdContext?: string
}): Promise<{ item: string; reason: string }[]> {
  const prompt = `You are a smart Indian household grocery assistant.
Already in order list: ${context.currentOrderItems.join(', ') || 'none'}
Low pantry items: ${context.lowPantryItems.map(i => `${i.name} (${i.daysSinceOrder}d since restock)`).join(', ') || 'none'}
Upcoming meals: ${context.upcomingMeals.join(', ') || 'none'}
${context.householdContext || ''}
Suggest up to 5 items to add. Do NOT suggest items already in the order list. Do NOT suggest spices or salt or oil.
Return ONLY a JSON array, no markdown:
[{"item": "name", "reason": "short reason"}]`
  try {
    const parsed = JSON.parse(cleanJson(await callGeminiRaw(prompt)))
    return Array.isArray(parsed) ? parsed.slice(0, 5) : []
  } catch { return [] }
}
