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
export async function getStarterDishes(context: {
  householdContext: string
}): Promise<{ name: string; description: string; ingredients: string[]; cuisine_type: string }[]> {
  const prompt = `You are building a weekly meal rotation for an Indian household.
${context.householdContext}

Generate exactly 24 DISTINCT dishes they would realistically cook at home.

STRICT RULES — violations mean the output is unusable:
1. Every dish must have a UNIQUE name — no duplicates, no near-duplicates
2. No two dishes can share the same primary ingredient as their defining feature (e.g. don't suggest both "Dal Tadka" and "Dal Fry" and "Moong Dal" — pick ONE dal dish; don't suggest both "Aloo Sabzi" and "Aloo Methi" — pick one)
3. Spread across these 8 categories, roughly 3 dishes each:
   - Everyday rice meals (dal chawal, khichdi, curd rice, etc.)
   - Everyday roti/paratha meals (sabzi + roti, stuffed parathas)
   - Quick breakfast/snack dishes (poha, upma, cheela, eggs)
   - Legume-based (chole, rajma, channa — pick different legumes)
   - Paneer dishes (max 2 paneer dishes total)
   - Egg dishes (only if their dietary preference allows)
   - Vegetable sabzis (pick DIFFERENT vegetables — not same veg twice)
   - Occasional/weekend dishes (biryani, pulao, pav bhaji, etc.)
4. Each dish's ingredients: list only items to BUY. NEVER include: salt, oil, ghee, butter, or ANY spice/spice powder (cumin, turmeric, garam masala, chilli powder, coriander powder, mustard seeds, hing, etc.)
5. Max 5 ingredients per dish

Return ONLY a valid JSON array, no markdown, no commentary:
[
  {
    "name": "Dal Chawal",
    "description": "Everyday comfort — yellow lentils with steamed rice",
    "cuisine_type": "North Indian",
    "ingredients": ["toor dal", "rice", "onion", "tomato"]
  }
]`
  try {
    const raw = await callGeminiRaw(prompt)
    const dishes = JSON.parse(cleanJson(raw))
    if (!Array.isArray(dishes)) return []
    
    // Client-side dedup by normalised name as safety net
    const seen = new Set<string>()
    const deduped = dishes.filter((d: any) => {
      if (!d.name) return false
      const norm = d.name.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (seen.has(norm)) return false
      seen.add(norm)
      return true
    })
    return deduped.slice(0, 24)
  } catch { return [] }
}

// ── Meal suggestion ───────────────────────────────────────────────────────────
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
export async function getMoodNudge(context: {
  dayOfWeek: string
  timeSlot?: string
  recentlyCooked: string[]
  householdContext?: string
}): Promise<{ message: string; chips: string[] } | null> {
  const timeContext = {
    morning:   'morning — they are planning what to cook today',
    midday:    'midday — lunchtime, they might be deciding what to make right now',
    afternoon: 'afternoon — they are likely thinking about dinner',
    evening:   'evening — winding down, reflecting on the day or planning tomorrow',
  }[context.timeSlot || 'morning'] ?? 'daytime'

  const prompt = `You are a warm, friendly Indian household kitchen assistant.
Today is ${context.dayOfWeek}, ${timeContext}.
Recently cooked: ${context.recentlyCooked.join(', ') || 'nothing logged yet'}
${context.householdContext || ''}

Write ONE short, warm, conversational message (max 18 words) appropriate for this time of day.
- Morning: what are they thinking of cooking today?
- Midday: nudge about lunch
- Afternoon: what's for dinner tonight?
- Evening: light reflection or tomorrow's planning

Also suggest 3 short quick-tap chips (2–4 words each) as mood/craving options relevant to this time of day.

Return ONLY valid JSON, no markdown:
{"message": "...", "chips": ["Something light", "Comfort food", "Quick to make"]}`
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
