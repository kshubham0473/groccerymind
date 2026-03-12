// Gemini API utility — all LLM calls go through here
// Called server-side only (API routes), never from the browser

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

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
    throw new Error(`Gemini API error: ${err}`)
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
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
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed) ? parsed : []
  } catch {
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
}): Promise<{ lunch: string; dinner: string; reason: string } | null> {
  const prompt = `You are a smart Indian household kitchen assistant.

Today is ${context.today}.

Available lunch options: ${context.lunchOptions.join(', ') || 'none'}
Available dinner options: ${context.dinnerOptions.join(', ') || 'none'}
Pantry items running low or finished: ${[...context.lowItems, ...context.finishedItems].join(', ') || 'nothing critical'}
Recently cooked (avoid repeating): ${context.recentlyCooked.join(', ') || 'unknown'}

Suggest the best lunch and dinner option for today based on:
1. What ingredients are available (avoid dishes needing finished items)
2. Variety (don't repeat recent meals)
3. If any pantry item is expiring soon, prioritise dishes that use it

Return ONLY valid JSON, no markdown, no explanation:
{"lunch": "dish name or null", "dinner": "dish name or null", "reason": "one short sentence explaining why, mentioning any expiring ingredient if relevant"}`

  try {
    const raw = await callGemini(prompt)
    const cleaned = raw.replace(/```json|```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
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

Pantry items running low (with days since last ordered):
${context.lowPantryItems.map(i => `- ${i.name} (${i.tier}, ${i.daysSinceOrder} days since restock)`).join('\n') || 'none'}

Upcoming meals this week: ${context.upcomingMeals.join(', ') || 'unknown'}

Suggest up to 5 additional items to add to the order. Prioritise:
1. Items that are low/overdue for restock
2. Ingredients needed for upcoming meals that aren't already in the order
3. Common Indian household items that run out together (e.g. if ordering onions, tomatoes likely needed too)

Do NOT suggest items already in the order list.
Return ONLY a JSON array, no markdown:
[{"item": "item name", "reason": "short reason"}, ...]`

  try {
    const raw = await callGemini(prompt)
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed) ? parsed.slice(0, 5) : []
  } catch {
    return []
  }
}

// ── Log a behaviour event (for future LLM context) ──────────────────────────
export async function buildBehaviourContext(logs: any[]): Promise<string> {
  if (!logs.length) return 'No behaviour history yet.'
  const summary = logs.slice(-50).map(l =>
    `${new Date(l.created_at).toLocaleDateString('en-IN')}: ${l.event_type} — ${JSON.stringify(l.metadata)}`
  ).join('\n')
  return summary
}
