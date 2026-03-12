// Gemini API utility — all LLM calls go through here
// Called server-side only (API routes), never from the browser

const GEMINI_MODEL = 'gemini-2.0-flash'
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('[Gemini] GEMINI_API_KEY is not set')
    throw new Error('GEMINI_API_KEY not set')
  }

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }
    })
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`[Gemini] API error ${res.status}:`, err)
    throw new Error(`Gemini API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  if (!text) console.error('[Gemini] Empty response:', JSON.stringify(data))
  return text
}

// ── Parse ingredients from a dish name ──────────────────────────────────────
export async function parseIngredients(dishName: string): Promise<string[]> {
  const prompt = `You are a knowledgeable Indian home cooking assistant.

For the dish "${dishName}", list the main ingredients a typical Indian household would need to buy.
- Only include ingredients that need to be purchased (not pantry staples like salt, oil, basic spices)
- Focus on the key fresh/specific ingredients
- Return ONLY a JSON array of strings, no explanation, no markdown, no backticks
- Max 8 ingredients
- Use simple common names (e.g. "paneer" not "cottage cheese")

Example output: ["onion", "tomato", "paneer", "capsicum", "garam masala"]`

  try {
    const raw = await callGemini(prompt)
    const cleaned = raw.replace(/^```json\s*|^```\s*|```\s*$/gm, '').trim()
    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    console.error('[Gemini] parseIngredients failed:', e)
    return []
  }
}

// ── Smart "what to make today" suggestion ───────────────────────────────────
export async function getMealSuggestion(context: {
  today: string
  lunchOptions: string[]
  dinnerOptions: string[]
  lowItems: string[]
  finishedItems: string[]
  recentlyCooked: string[]
}): Promise<{ lunch: string | null; dinner: string | null; reason: string } | null> {
  const prompt = `You are a smart Indian household kitchen assistant.

Today is ${context.today}.

Available lunch options: ${context.lunchOptions.join(', ') || 'none'}
Available dinner options: ${context.dinnerOptions.join(', ') || 'none'}
Pantry items running low or finished: ${[...context.lowItems, ...context.finishedItems].join(', ') || 'nothing critical'}
Recently cooked (avoid repeating): ${context.recentlyCooked.join(', ') || 'unknown'}

Pick the best lunch and dinner for today. Consider variety and avoid dishes needing finished items.

Return ONLY valid JSON with no markdown, no backticks, no explanation:
{"lunch": "dish name", "dinner": "dish name", "reason": "one short sentence why"}`

  try {
    const raw = await callGemini(prompt)
    const cleaned = raw.replace(/^```json\s*|^```\s*|```\s*$/gm, '').trim()
    const parsed = JSON.parse(cleaned)
    return parsed
  } catch (e) {
    console.error('[Gemini] getMealSuggestion failed:', e)
    return null
  }
}

// ── Smart order suggestions ──────────────────────────────────────────────────
export async function getOrderSuggestions(context: {
  currentOrderItems: string[]
  lowPantryItems: { name: string; tier: string; daysSinceOrder: number }[]
  upcomingMeals: string[]
}): Promise<{ item: string; reason: string }[]> {
  const prompt = `You are a smart Indian household grocery assistant.

Items already in the order list: ${context.currentOrderItems.join(', ') || 'none'}

Pantry items running low:
${context.lowPantryItems.map(i => `- ${i.name} (${i.tier}, ${i.daysSinceOrder} days since restock)`).join('\n') || 'none'}

Upcoming meals: ${context.upcomingMeals.join(', ') || 'unknown'}

Suggest up to 5 additional items to add. Do NOT suggest items already in the order list.

Return ONLY a JSON array with no markdown, no backticks:
[{"item": "item name", "reason": "short reason"}]`

  try {
    const raw = await callGemini(prompt)
    const cleaned = raw.replace(/^```json\s*|^```\s*|```\s*$/gm, '').trim()
    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed) ? parsed.slice(0, 5) : []
  } catch (e) {
    console.error('[Gemini] getOrderSuggestions failed:', e)
    return []
  }
}
