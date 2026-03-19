/**
 * corpus-utils.ts
 * Embedding-based corpus search and dish selection.
 * Module-level cache — embeddings loaded once per Lambda warm instance.
 */

// ── Types ─────────────────────────────────────────────────────────────────────
export interface CorpusDish {
  _id:           number
  name:          string
  meal_pairing:  string
  cuisine_type:  string
  complexity:    string
  is_vegetarian: boolean
  tags:          string[]
  youtube_url:   string
  channel:       string
}

// ── Module-level cache ────────────────────────────────────────────────────────
let _meta:       CorpusDish[] | null = null
let _embeddings: Map<number, number[]> | null = null

function loadMeta(): CorpusDish[] {
  if (_meta) return _meta
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs   = require('fs')
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path')
    const p = path.join(process.cwd(), 'lib', 'dishes-meta.json')
    if (!fs.existsSync(p)) return []
    _meta = JSON.parse(fs.readFileSync(p, 'utf-8')).dishes || []
    return _meta!
  } catch { return [] }
}

function loadEmbeddingsMap(): Map<number, number[]> {
  if (_embeddings) return _embeddings
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs   = require('fs')
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path')
    const p = path.join(process.cwd(), 'lib', 'dishes-embeddings.json')
    if (!fs.existsSync(p)) return new Map()
    const rows = JSON.parse(fs.readFileSync(p, 'utf-8')).dishes || []
    _embeddings = new Map(rows.map((r: any) => [r._id, r.embedding]))
    return _embeddings!
  } catch { return new Map() }
}

export function loadFullCorpus(): CorpusDish[] { return loadMeta() }
export function corpusAvailable():  boolean { return loadMeta().length > 0 }

// ── Math ──────────────────────────────────────────────────────────────────────
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const d = Math.sqrt(normA) * Math.sqrt(normB)
  return d === 0 ? 0 : dot / d
}

// ── Gemini Embedding API ───────────────────────────────────────────────────────
export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: { parts: [{ text }] },
        taskType: 'SEMANTIC_SIMILARITY',
      })
    }
  )
  if (!res.ok) throw new Error(`Embedding API ${res.status}`)
  const data = await res.json()
  return data.embedding?.values || []
}

// Batch embed with small delay between calls to respect rate limits
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = []
  for (const text of texts) {
    try {
      results.push(await embedText(text))
    } catch {
      results.push([]) // empty vector — will score 0 in similarity
    }
    await new Promise(r => setTimeout(r, 100)) // 100ms between calls
  }
  return results
}

// ── Find nearest corpus dishes to a query embedding ───────────────────────────
export function findNearest(
  queryEmbedding: number[],
  candidates: CorpusDish[],
  n       = 15,
  exclude?: Set<string>
): Array<{ dish: CorpusDish; score: number }> {
  if (!queryEmbedding.length) return []
  const embeddings = loadEmbeddingsMap()
  const scored: Array<{ dish: CorpusDish; score: number }> = []

  for (const dish of candidates) {
    if (exclude?.has(dish.name)) continue
    const emb = embeddings.get((dish as any)._id)
    if (!emb?.length) continue
    scored.push({ dish, score: cosineSimilarity(queryEmbedding, emb) })
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, n)
}

// ── Semantic dedup — removes near-duplicate dishes from a ranked list ─────────
// Walks list in order; skips any dish that is too similar to an already-kept dish.
// This eliminates "Dal Tadka" + "Dal Fry" appearing together (score ~0.93)
// while keeping "Dal Tadka" + "Chole" (score ~0.80) — same category, different dish.
export function semanticDedup(
  dishes: Array<CorpusDish & { _geminiName?: string }>,
  threshold = 0.88
): CorpusDish[] {
  const embeddings  = loadEmbeddingsMap()
  const kept: CorpusDish[] = []
  const keptEmbs:   number[][] = []

  for (const dish of dishes) {
    const emb = embeddings.get((dish as any)._id)
    if (!emb?.length) { kept.push(dish); continue }

    let tooSimilar = false
    for (const keptEmb of keptEmbs) {
      if (cosineSimilarity(emb, keptEmb) >= threshold) {
        tooSimilar = true
        break
      }
    }
    if (!tooSimilar) {
      kept.push(dish)
      keptEmbs.push(emb)
    }
  }
  return kept
}

// ── Hard filters: dietary, dislikes, skip-list ────────────────────────────────
const SKIP_TITLE_WORDS = [
  'halwa','kheer','ladoo','barfi','mithai','payasam',
  'gulab jamun','jalebi','rasgulla','gulgule','malpua',
  'modak','peda','burfi','sheera','shrikhand',
  'chutney','pickle','achar','papad',
  'juice','shake','smoothie','lassi','chaas','squash','sherbet',
]

// Hindi↔English synonym map for dislike matching
const DISLIKE_SYNONYMS: Record<string, string[]> = {
  onion:          ['onion','pyaaz','kanda','pyaz'],
  pyaaz:          ['pyaaz','onion','kanda'],
  kanda:          ['kanda','onion','pyaaz'],
  garlic:         ['garlic','lahsun','lasun'],
  lahsun:         ['lahsun','garlic','lasun'],
  ginger:         ['ginger','adrak'],
  potato:         ['potato','aloo','alu'],
  aloo:           ['aloo','potato','alu'],
  tomato:         ['tomato','tamatar'],
  spinach:        ['spinach','palak'],
  palak:          ['palak','spinach'],
  fenugreek:      ['fenugreek','methi'],
  methi:          ['methi','fenugreek'],
  karela:         ['karela','bitter gourd','bitter-gourd'],
  'bitter gourd': ['bitter gourd','bitter-gourd','karela'],
  cauliflower:    ['cauliflower','gobi','gobhi'],
  gobi:           ['gobi','cauliflower','gobhi'],
  bhindi:         ['bhindi','okra','ladyfinger'],
  okra:           ['okra','bhindi'],
  brinjal:        ['brinjal','eggplant','baingan','begun'],
  baingan:        ['baingan','brinjal','eggplant'],
  lauki:          ['lauki','bottle gourd','ghia','dudhi','louki'],
  louki:          ['louki','lauki','bottle gourd'],
  'bottle gourd': ['bottle gourd','lauki','ghia','dudhi'],
  tinda:          ['tinda','round gourd','tinde'],
  mushroom:       ['mushroom','khumb'],
  coconut:        ['coconut','nariyal'],
  egg:            ['egg','anda','ande'],
  anda:           ['anda','egg','ande'],
  chicken:        ['chicken','murgi','murg'],
  mutton:         ['mutton','gosht','lamb'],
  fish:           ['fish','machli'],
}

export function applyHardFilters(
  dishes: CorpusDish[],
  prefs: Record<string, any>
): CorpusDish[] {
  const dietary      = prefs.dietary || 'No restrictions'
  const dislikeRaw   = (prefs.dislikes || '').toLowerCase()
  const dislikeWords = dislikeRaw
    ? dislikeRaw.replace(/;/g, ',').split(',').map((w: string) => w.trim()).filter(Boolean)
    : []

  return dishes.filter(dish => {
    const n       = dish.name.toLowerCase()
    const cType   = dish.cuisine_type || ''
    const pairing = dish.meal_pairing || ''

    // Dietary
    if (['Vegetarian','Vegan','Jain'].includes(dietary) && !dish.is_vegetarian) return false
    if (dietary === 'Eggetarian' && !dish.is_vegetarian) {
      if (!['egg','anda','omelette','bhurji'].some(w => n.includes(w))) return false
    }

    // Dislikes with synonym expansion
    for (const word of dislikeWords) {
      const variants = DISLIKE_SYNONYMS[word] || [word]
      if (variants.some(v => n.includes(v))) return false
    }

    // Skip unsuitable titles
    if (SKIP_TITLE_WORDS.some(w => n.includes(w))) return false
    if ((dish.name.match(/,/g) || []).length >= 2) return false
    if (dish.name.length > 55) return false
    if (/\b(combo|recipes|recipe)\b/i.test(n)) return false

    // Pure standalone snacks from Snack/Street Food category excluded from meal plan
    // (They're still included in Discover searches)
    if (['Snack','Street Food'].includes(cType) &&
        ['standalone','as snack'].includes(pairing)) return false

    return true
  })
}
