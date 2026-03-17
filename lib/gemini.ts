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
// ── Hindi↔English ingredient synonym map ────────────────────────────────────
// Used in dislike filtering and ingredient matching throughout the app.
// Covers common transliterations that appear in dish names and user input.
const HINDI_SYNONYMS: Record<string, string[]> = {
  onion:        ['onion','pyaaz','kanda','pyaz'],
  garlic:       ['garlic','lahsun','lasun','lasoon'],
  ginger:       ['ginger','adrak'],
  potato:       ['potato','aloo','alu'],
  tomato:       ['tomato','tamatar'],
  spinach:      ['spinach','palak'],
  fenugreek:    ['fenugreek','methi'],
  bittergourd:  ['bitter gourd','bitter-gourd','karela','kerala'],
  cauliflower:  ['cauliflower','gobi','gobhi'],
  okra:         ['okra','bhindi','ladyfinger','lady finger'],
  brinjal:      ['brinjal','eggplant','baingan','begun','vangi'],
  peas:         ['peas','matar','mattar'],
  bottlegourd:  ['bottle gourd','lauki','ghia','dudhi'],
  ridgegourd:   ['ridge gourd','turai','toorai','torai'],
  roundgourd:   ['round gourd','tinda','tinde'],
  drumstick:    ['drumstick','moringa','sehjan'],
  banana:       ['banana','kela'],
  lemon:        ['lemon','nimbu'],
  corn:         ['corn','maize','makka','bhutta'],
  mushroom:     ['mushroom','khumb'],
  jackfruit:    ['jackfruit','kathal'],
  rawmango:     ['raw mango','kairi','kachha aam','keri'],
  coconut:      ['coconut','nariyal','nariyal'],
  curd:         ['curd','yogurt','dahi'],
  paneer:       ['paneer','cottage cheese'],
  chicken:      ['chicken','murgi','murg'],
  mutton:       ['mutton','gosht','lamb'],
  fish:         ['fish','machli','machli'],
  egg:          ['egg','anda','ande'],
  rice:         ['rice','chawal','chaawal'],
  wheat:        ['wheat','atta','gehun'],
  lentil:       ['lentil','dal','daal','dhal'],
  chickpea:     ['chickpea','chole','chana','chhole'],
  kidney:       ['kidney bean','rajma','rajmah'],
  blackgram:    ['black gram','urad','urad dal'],
  greengram:    ['green gram','moong','mung'],
  bengalgram:   ['bengal gram','chana dal','besan'],
}

// Build a flat map: any known synonym → canonical English name
const SYNONYM_FLAT = new Map<string, string>()
for (const [canonical, synonyms] of Object.entries(HINDI_SYNONYMS)) {
  for (const syn of synonyms) {
    SYNONYM_FLAT.set(syn.toLowerCase(), canonical)
  }
}

// Expand a user-typed word to all its known synonyms for matching
function expandSynonyms(word: string): string[] {
  const w = word.toLowerCase().trim()
  const canonical = SYNONYM_FLAT.get(w)
  if (!canonical) return [w]
  return HINDI_SYNONYMS[canonical] || [w]
}

// Check if a dish name contains any of the dislike terms (with synonym expansion)
function matchesDislikes(dishName: string, dislikeWords: string[]): boolean {
  const n = dishName.toLowerCase()
  for (const word of dislikeWords) {
    const variants = expandSynonyms(word)
    if (variants.some(v => n.includes(v))) return true
  }
  return false
}

// ── Skip list — titles that should never appear in a meal plan ───────────────
const SKIP_WORDS = [
  'halwa','kheer','ladoo','barfi','mithai','payasam',
  'gulab jamun','jalebi','rasgulla','gulgule','chini paratha',
  'malpua','modak','peda','burfi','sheera','shrikhand',
  'chutney','pickle','achar','papad',
  'juice','shake','smoothie','lassi','chaas','squash','sherbet',
]

function isSkipDish(name: string): boolean {
  const n = name.toLowerCase()
  if (SKIP_WORDS.some(w => n.includes(w))) return true
  if ((name.match(/,/g) || []).length >= 2) return true
  if (name.length > 55) return true
  if (/\b(combo|recipes|recipe)\b/i.test(name)) return true
  return false
}

// ── Filter corpus by household preferences ───────────────────────────────────
function filterCorpus(dishes: any[], prefs: Record<string, any>): any[] {
  const dietary      = prefs.dietary || 'No restrictions'
  const cuisinePrefs = (prefs.cuisine_prefs || []) as string[]
  const proteinPrefs = (prefs.protein_prefs || []) as string[]
  const dislikeRaw   = (prefs.dislikes || '').toLowerCase()
  const dislikeWords = dislikeRaw
    ? dislikeRaw.replace(/;/g, ',').split(',').map((w: string) => w.trim()).filter(Boolean)
    : []

  return dishes
    .filter(dish => {
      const name   = dish.name || ''
      const namel  = name.toLowerCase()
      const cType  = dish.cuisine_type || ''
      const pairing = dish.meal_pairing || ''

      // Dietary hard filter
      if (['Vegetarian','Vegan','Jain'].includes(dietary) && !dish.is_vegetarian) return false
      if (dietary === 'Eggetarian' && !dish.is_vegetarian) {
        if (!['egg','anda','omelette','bhurji'].some(w => namel.includes(w))) return false
      }

      // Dislikes (with Hindi synonym expansion)
      if (dislikeWords.length > 0 && matchesDislikes(name, dislikeWords)) return false

      // Skip unsuitable titles
      if (isSkipDish(name)) return false

      // Don't include pure snacks/street food in weekly rotation
      if (['Snack','Street Food'].includes(cType) &&
          ['standalone','as snack','as breakfast'].includes(pairing)) return false

      return true
    })
    .map(dish => {
      const namel = dish.name.toLowerCase()
      const cType = dish.cuisine_type || ''
      let score = 0

      if (cuisinePrefs.includes(cType)) score += 3
      else if (cType.includes('Indian') || cType === 'Indian') score += 1

      if (proteinPrefs.includes('Paneer')        && namel.includes('paneer'))  score += 2
      if (proteinPrefs.includes('Dal / Lentils') && ['dal','lentil','moong','masoor'].some(w => namel.includes(w))) score += 2
      if (proteinPrefs.includes('Eggs')          && (namel.startsWith('egg') || namel.startsWith('anda') || [' egg ',' anda '].some(w => namel.includes(w)))) score += 2
      if (proteinPrefs.includes('Rajma / Chole') && ['rajma','chole'].some(w => namel.includes(w))) score += 2
      if (proteinPrefs.includes('Chicken')       && namel.includes('chicken')) score += 2
      if (proteinPrefs.includes('Soya')          && namel.includes('soya'))    score += 2

      return { ...dish, _score: score }
    })
}

// ── Get primary ingredient for dedup ─────────────────────────────────────────
function getPrimaryIngredient(name: string): string {
  const n = name.toLowerCase()
  const primaries = [
    'paneer','rajma','chole','chana','dal','moong','masoor',
    'egg','anda','aloo','gobi','bhindi','palak','methi',
    'baingan','lauki','tinda','mushroom','soya','matar',
    'poha','upma','dosa','idli','paratha','pulao','biryani','khichdi',
    'puri','poori','sandwich','noodles','pasta','bread',
  ]
  for (const p of primaries) if (n.includes(p)) return p
  return n.split(' ')[0] || n
}

// ── Category definitions ──────────────────────────────────────────────────────
type CategoryDef = {
  name: string
  match: (d: any) => boolean
  target: number
}

const MEAL_CATEGORIES: CategoryDef[] = [
  {
    name: 'Rice meals',
    match: d => (
      d.meal_pairing?.toLowerCase().includes('rice') ||
      ['pulao','biryani','khichdi','chawal'].some(w => d.name.toLowerCase().includes(w))
    ) && !d.tags?.includes('breakfast'),
    target: 3,
  },
  {
    name: 'Dal & legumes',
    match: d =>
      ['dal','rajma','chole','masoor','moong dal','chana dal'].some(w => d.name.toLowerCase().includes(w)) &&
      !['paratha','cheela','chilla','dosa','idli'].some(w => d.name.toLowerCase().includes(w)),
    target: 3,
  },
  {
    name: 'Paneer',
    match: d => d.name.toLowerCase().includes('paneer'),
    target: 2,
  },
  {
    name: 'Egg dishes',
    // Word-boundary match to avoid "Eggplant" false positive
    match: d => {
      const n = d.name.toLowerCase()
      return n.startsWith('egg ') || n.startsWith('egg\n') || n === 'egg' ||
             n.startsWith('anda') || n.startsWith('ande') ||
             [' egg ',' anda ','omelette','bhurji'].some(w => n.includes(w))
    },
    target: 2,
  },
  {
    name: 'Veg sabzi',
    match: d => {
      const n = d.name.toLowerCase()
      return ['sabzi','sabji','bhindi','gobi','palak','methi ','baingan','lauki','tinda','beans','aloo '].some(w => n.includes(w)) &&
             !['paratha','dal','paneer'].some(w => n.includes(w))
    },
    target: 4,
  },
  {
    name: 'Roti & paratha',
    match: d => {
      const n = d.name.toLowerCase()
      return ['paratha','poori','puri'].some(w => n.includes(w)) &&
             !n.includes('paneer')
    },
    target: 3,
  },
  {
    name: 'Breakfast & quick',
    match: d =>
      d.tags?.includes('breakfast') &&
      ['as breakfast','with Chutney'].includes(d.meal_pairing || ''),
    target: 3,
  },
  {
    name: 'Weekend special',
    match: d => d.complexity === 'elaborate' || d.tags?.includes('festive'),
    target: 2,
  },
  {
    name: 'Misc variety',
    match: () => true,
    target: 2,
  },
]

// ── Pick 24 dishes using category spread ─────────────────────────────────────
function pickDishesFromCorpus(
  filtered: any[],
  n = 24,
  excludeNames: string[] = []
): any[] {
  const excludeSet   = new Set(excludeNames)
  const usedNames    = new Set<string>()
  const usedPrimary  = new Map<string, number>()
  const result: any[] = []

  // Sort by score desc, shuffle within same score tier for variety
  const byScore = new Map<number, any[]>()
  for (const d of filtered) {
    const s = d._score || 0
    if (!byScore.has(s)) byScore.set(s, [])
    byScore.get(s)!.push(d)
  }
  const ordered: any[] = []
  for (const score of [...byScore.keys()].sort((a, b) => b - a)) {
    const group = [...byScore.get(score)!]
    // Fisher-Yates shuffle for consistent but varied results
    for (let i = group.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [group[i], group[j]] = [group[j], group[i]]
    }
    ordered.push(...group)
  }

  const available = (catFn: (d: any) => boolean) =>
    ordered.filter(d =>
      catFn(d) &&
      !usedNames.has(d.name) &&
      !excludeSet.has(d.name)
    )

  for (const cat of MEAL_CATEGORIES) {
    let picked = 0
    for (const d of available(cat.match)) {
      if (picked >= cat.target) break
      const primary = getPrimaryIngredient(d.name)
      // Global cap: same primary ingredient max 2 times total across all categories
      if ((usedPrimary.get(primary) || 0) >= 2) continue
      usedNames.add(d.name)
      usedPrimary.set(primary, (usedPrimary.get(primary) || 0) + 1)
      result.push({ ...d, _category: cat.name })
      picked++
    }
    if (result.length >= n) break
  }

  // Fill any remaining slots
  if (result.length < n) {
    for (const d of ordered) {
      if (result.length >= n) break
      if (usedNames.has(d.name) || excludeSet.has(d.name)) continue
      const primary = getPrimaryIngredient(d.name)
      if ((usedPrimary.get(primary) || 0) >= 2) continue
      result.push({ ...d, _category: 'Misc variety' })
      usedNames.add(d.name)
      usedPrimary.set(primary, (usedPrimary.get(primary) || 0) + 1)
    }
  }

  return result.slice(0, n)
}

// ── Load corpus from disk ─────────────────────────────────────────────────────
function loadCorpus(): any[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs   = require('fs')
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path')
    const corpusPath = path.join(process.cwd(), 'lib', 'dishes-corpus.json')
    if (!fs.existsSync(corpusPath)) return []
    const parsed = JSON.parse(fs.readFileSync(corpusPath, 'utf-8'))
    return parsed.dishes || []
  } catch { return [] }
}

// ── Corpus-based dish search for Discover feature ────────────────────────────
const DISCOVER_MOOD_MAP: Record<string, string[]> = {
  light:     ['low-oil','healthy'],
  healthy:   ['healthy','low-oil'],
  quick:     ['quick'],
  fast:      ['quick'],
  comfort:   ['comfort'],
  hearty:    ['comfort'],
  heavy:     ['comfort'],
  spicy:     ['spicy'],
  breakfast: ['breakfast'],
  snack:     ['snack'],
  festive:   ['festive'],
  protein:   ['high-protein'],
  'one pot': ['one-pot'],
  kid:       ['kid-friendly'],
}

const DISCOVER_CUISINE_MAP: Record<string, string> = {
  maharashtrian: 'Maharashtrian',
  'south indian': 'South Indian',
  'south-indian': 'South Indian',
  'north indian': 'North Indian',
  bengali: 'Bengali',
  gujarati: 'Gujarati',
  punjabi: 'Punjabi',
  rajasthani: 'Rajasthani',
  goan: 'Goan',
  chinese: 'Chinese',
  continental: 'Continental',
}

const DISCOVER_INGREDIENT_SYNONYMS: Record<string, string[]> = {
  egg:      ['egg','anda'],
  eggs:     ['egg','anda'],
  paneer:   ['paneer'],
  dal:      ['dal','lentil','daal'],
  rice:     ['rice','chawal','pulao','biryani','khichdi'],
  potato:   ['potato','aloo'],
  spinach:  ['spinach','palak'],
  chicken:  ['chicken'],
  mushroom: ['mushroom'],
  tofu:     ['tofu','soya'],
  onion:    ['onion','pyaaz','kanda'],
  garlic:   ['garlic','lahsun','lasun'],
  tomato:   ['tomato','tamatar'],
  gourd:    ['lauki','tinda','turai','karela'],
}

const DISCOVER_STOP_WORDS = new Set([
  'something','some','with','and','or','a','an','the','for','of','in',
  'make','cook','want','need','give','me','today','now','please',
  'good','nice','tasty','delicious','easy','simple','style','type',
  'kind','sort','using','use','up','any','indian','no','without',
  'avoid','not','dont',"don't",'except',
])

export function searchCorpusForDiscover(
  query: string,
  prefs: Record<string, any>,
  pantryItems: string[] = [],
  n = 12
): any[] {
  const corpus = loadCorpus()
  if (!corpus.length) return []

  const queryL     = query.toLowerCase().trim()
  const queryWords = new Set(queryL.match(/\w+/g) || [])

  // Detect negation — words after "no", "without", "avoid" are exclusions
  const negationWords = new Set<string>()
  const negationTriggers = ['no ','without ','avoid ','not ']
  for (const trigger of negationTriggers) {
    const idx = queryL.indexOf(trigger)
    if (idx >= 0) {
      const afterTrigger = queryL.slice(idx + trigger.length).match(/\w+/g) || []
      for (const w of afterTrigger) negationWords.add(w)
    }
  }

  // Detect cuisine intent
  let targetCuisine: string | null = null
  for (const [kw, cuisine] of Object.entries(DISCOVER_CUISINE_MAP)) {
    if (queryL.includes(kw)) { targetCuisine = cuisine; break }
  }

  // Detect mood → tags
  const targetTags = new Set<string>()
  for (const [word, tags] of Object.entries(DISCOVER_MOOD_MAP)) {
    if (queryL.includes(word)) tags.forEach(t => targetTags.add(t))
  }

  // Ingredient intent with synonym expansion
  const cuisineKws = new Set(Object.keys(DISCOVER_CUISINE_MAP).join(' ').split(' '))
  const moodKws    = new Set(Object.keys(DISCOVER_MOOD_MAP))
  const rawIngredients = [...queryWords].filter(w =>
    !DISCOVER_STOP_WORDS.has(w) && !cuisineKws.has(w) && !moodKws.has(w)
  )
  const searchTerms = new Set<string>()
  for (const w of rawIngredients) {
    const syns = DISCOVER_INGREDIENT_SYNONYMS[w] || [w]
    syns.forEach(s => searchTerms.add(s))
  }

  // Also expand negation words with synonyms
  const negationExpanded = new Set<string>()
  for (const w of negationWords) {
    const syns = DISCOVER_INGREDIENT_SYNONYMS[w] || [w]
    syns.forEach(s => negationExpanded.add(s))
  }

  const pantrySet = new Set(pantryItems.map(p => p.toLowerCase()))
  const dietary   = prefs.dietary || ''

  const scored: [number, any][] = []

  for (const dish of corpus) {
    if (isSkipDish(dish.name)) continue
    if (['Vegetarian','Vegan','Jain'].includes(dietary) && !dish.is_vegetarian) continue

    const namel  = dish.name.toLowerCase()
    const tags   = new Set(dish.tags || [])
    const cType  = dish.cuisine_type || ''
    const pairing = dish.meal_pairing || ''
    let score = 0

    // Hard exclude if dish contains a negated ingredient
    if ([...negationExpanded].some(w => namel.includes(w))) continue

    // Cuisine match — strong signal
    if (targetCuisine && cType === targetCuisine) score += 8
    else if (targetCuisine && cType.includes('Indian')) score += 1

    // Ingredient/keyword match
    for (const term of searchTerms) if (namel.includes(term)) score += 4

    // Tag match
    for (const tag of targetTags) if (tags.has(tag)) score += 3

    // Pantry overlap
    for (const item of pantrySet) if (namel.includes(item)) score += 1

    // Deprioritise pure standalone snacks unless explicitly asked
    if (['Snack','Street Food'].includes(cType) &&
        !queryL.includes('snack') && !queryL.includes('breakfast')) {
      if (['standalone','as snack'].includes(pairing)) score = Math.max(0, score - 3)
    }

    if (score > 0) scored.push([score, dish])
  }

  scored.sort((a, b) => b[0] - a[0])
  return scored.slice(0, n).map(([, d]) => d)
}

// ── Main starter dishes function ──────────────────────────────────────────────
export async function getStarterDishes(context: {
  householdContext: string
  prefs?: Record<string, any>
}): Promise<any[]> {
  const corpus = loadCorpus()

  if (corpus.length > 50 && context.prefs) {
    // Path 1: corpus exists — pure deterministic selection, no Gemini for picking
    const filtered = filterCorpus(corpus, context.prefs)
    const selected = pickDishesFromCorpus(filtered, 24)

    if (selected.length >= 12) {
      // Single Gemini call: just write descriptions for the selected dishes
      const dishList = selected.map((d: any) => d.name).join('\n')
      const descPrompt = `Write a one-sentence appetising description for each Indian dish listed.
Each description should be 8-12 words, evocative, and sound like something you'd read on a menu.
Do NOT start with the dish name. Focus on texture, flavour, or occasion.

Dishes:
${dishList}

Return ONLY a JSON object mapping dish name to description, no markdown:
{"Dal Khichdi": "Soft comfort in a bowl — rice and lentils simmered to perfection."}`

      let descriptions: Record<string, string> = {}
      try {
        const raw = await callGeminiRaw(descPrompt)
        descriptions = JSON.parse(cleanJson(raw))
      } catch { /* descriptions stay empty, fine */ }

      return selected.map((d: any) => ({
        name:              d.name,
        description:       descriptions[d.name] || '',
        meal_pairing:      d.meal_pairing || '',
        cuisine_type:      d.cuisine_type || 'Indian',
        complexity:        d.complexity || 'moderate',
        cooking_time_mins: null,
        is_vegetarian:     d.is_vegetarian !== false,
        tags:              d.tags || [],
        youtube_url:       d.youtube_url || '',
        ingredients:       [],
        _category:         d._category || '',
      }))
    }
  }

  // Path 2: no corpus — return empty so onboarding shows the "no corpus" state
  // (avoids showing hallucinated dishes when corpus isn't available)
  return []
}

// ── Single dish regeneration from corpus ─────────────────────────────────────
export function getReplacementDish(
  excludeNames: string[],
  prefs: Record<string, any>,
  categoryHint?: string
): any | null {
  const corpus   = loadCorpus()
  if (!corpus.length) return null

  const filtered = filterCorpus(corpus, prefs)
  const excludeSet = new Set(excludeNames)

  const catDef = categoryHint
    ? MEAL_CATEGORIES.find(c => c.name === categoryHint)
    : null

  const candidates = filtered
    .filter(d => !excludeSet.has(d.name) && (catDef ? catDef.match(d) : true))
    .sort((a, b) => (b._score || 0) - (a._score || 0))

  if (!candidates.length) return null

  // Pick randomly from top 10 to give variety on multiple regenerates
  const pool = candidates.slice(0, Math.min(10, candidates.length))
  return pool[Math.floor(Math.random() * pool.length)] || null
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
