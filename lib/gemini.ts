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
      generationConfig: { temperature: 0.8, maxOutputTokens: 1500 }
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

// Build a household context string injected into every prompt
export function buildHouseholdContext(prefs: Record<string, any>, feedback: { dish_name: string; signal: string }[]): string {
  const lines: string[] = []
  if (prefs.dietary) lines.push(`Diet: ${prefs.dietary}`)
  if (prefs.cuisine_prefs?.length) lines.push(`Preferred cuisines: ${prefs.cuisine_prefs.join(', ')}`)
  if (prefs.dislikes) lines.push(`Dislikes/avoid: ${prefs.dislikes}`)
  const liked = feedback.filter(f => f.signal === 'like').map(f => f.dish_name).filter(Boolean)
  const disliked = feedback.filter(f => f.signal === 'dislike').map(f => f.dish_name).filter(Boolean)
  if (liked.length) lines.push(`Dishes they enjoy: ${liked.slice(0, 10).join(', ')}`)
  if (disliked.length) lines.push(`Dishes they dislike: ${disliked.slice(0, 10).join(', ')}`)
  return lines.length ? `\nHousehold preferences:\n${lines.join('\n')}` : ''
}

export async function parseIngredients(dishName: string): Promise<string[]> {
  const prompt = `You are a knowledgeable Indian home cooking assistant.
For the dish "${dishName}", list the main ingredients a typical Indian household needs to buy.
Exclude: salt, oil, and all spices/spice powders (cumin, turmeric, chilli powder, garam masala, coriander powder, etc).
Return ONLY a JSON array of strings, no markdown, no backticks, max 8 items.
Example: ["onion", "tomato", "paneer", "capsicum"]`
  try {
    const parsed = JSON.parse(cleanJson(await callGeminiRaw(prompt)))
    return Array.isArray(parsed) ? parsed : []
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

export async function getDishSuggestions(context: {
  availableItems: string[]
  existingDishes: string[]
  householdContext?: string
  dislikedDishes?: string[]
}): Promise<any[]> {
  const prompt = `You are a creative Indian home cooking assistant.
Available pantry items right now: ${context.availableItems.join(', ')}
Dishes this household already makes (don't repeat): ${context.existingDishes.slice(0, 25).join(', ')}
${context.householdContext || ''}

Suggest 3 different Indian dishes that can be made mostly with the available items.
Each dish should:
- Be a real, well-known Indian recipe
- Use at least 3 of the available pantry items
- Require at most 3 additional ingredients to buy
- NOT include spices or spice powders in the "needsToBuy" list (assume those are stocked)
- Be different in style/character from each other

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
mood must be one of: "light", "hearty", "quick", "indulgent", "healthy"`
  try {
    const raw = await callGeminiRaw(prompt)
    const dishes = JSON.parse(cleanJson(raw))
    return Array.isArray(dishes) ? dishes : []
  } catch { return [] }
}

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
Suggest up to 5 items to add. Do NOT suggest items already in the order list. Do NOT suggest spices.
Return ONLY a JSON array, no markdown:
[{"item": "name", "reason": "short reason"}]`
  try {
    const parsed = JSON.parse(cleanJson(await callGeminiRaw(prompt)))
    return Array.isArray(parsed) ? parsed.slice(0, 5) : []
  } catch { return [] }
}
