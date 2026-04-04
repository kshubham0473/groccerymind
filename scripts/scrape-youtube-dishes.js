#!/usr/bin/env node
/**
 * GroceryMind — YouTube Recipe Scraper
 * =====================================
 * Fetches video titles from Indian cooking YouTube channels,
 * filters out non-dishes at source, then processes through Gemini
 * to extract structured dish data.
 *
 * USAGE:
 *   YOUTUBE_API_KEY=xxx GEMINI_API_KEY=xxx node scripts/scrape-youtube-dishes.js
 *
 * Get YouTube API key: console.cloud.google.com
 *   → New project → Enable "YouTube Data API v3" → Credentials → API Key
 * Get Gemini API key:  aistudio.google.com → Get API key
 *
 * No npm install needed — uses Node.js built-in fetch (Node 18+)
 *
 * CHANGELOG:
 *   v2 — Improved pre-filtering at source:
 *        - Skip titles that are collection/category/playlist names
 *        - Skip sweets, drinks, condiments, non-food content
 *        - Skip combo/thali titles and generic single-word titles
 *        - Skip titles over 60 chars (usually combos or clickbait)
 *        - Skip titles with 2+ commas (multiple dishes bundled)
 *        - Cleaner Gemini prompt with explicit exclusion list
 *        - Progress stats on filtered-out titles
 */

const fs   = require('fs')
const path = require('path')

const YOUTUBE_KEY = process.env.YOUTUBE_API_KEY
const GEMINI_KEY  = process.env.GEMINI_API_KEY

if (!YOUTUBE_KEY || !GEMINI_KEY) {
  console.error('❌  Set YOUTUBE_API_KEY and GEMINI_API_KEY env vars first.')
  process.exit(1)
}

// ── Channels ──────────────────────────────────────────────────────────────────
const CHANNELS = [
  { name: 'Hebbars Kitchen',   uploads: 'UUYNOe9bCJCg97IbcDllxFhg' },
  { name: "Kabita's Kitchen",  uploads: 'UUmMHHMzF7_lCTTFXp6X3TTA' },
  { name: 'Nisha Madhulika',   uploads: 'UUCijOziG2oNdh3_VFaWlyEw' },
  { name: 'Ranveer Brar',      uploads: 'UU4vSqUrNNOYaNgRcbTFhBpg' },
  { name: 'Your Food Lab',     uploads: 'UUwKuSMuiHcEBMnNhJJixULA' },
]

const MAX_PER_CHANNEL = 500   // videos to pull per channel
const BATCH           = 50    // titles per Gemini call
const OUT             = path.join(__dirname, '..', 'lib', 'dishes-corpus.json')

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Pre-filter: applied before sending to Gemini ──────────────────────────────
// Words that indicate a title is a collection/category, not a single dish
const COLLECTION_WORDS = [
  'recipes', 'recipe', 'thali', 'platter', 'combo', 'twists', 'collection',
  'series', 'episode', 'part 1', 'part 2', 'lunch box', 'meal prep',
  'batch cook', '| ep', 'vol.', 'vol ',
]

// Words that mean the video is not a dish at all
const NON_DISH_WORDS = [
  'kitchen tour', 'equipment', 'knife', 'cookware', 'review', 'unboxing',
  'challenge', 'mukbang', 'vlog', 'travel', 'market tour', 'haul',
  'how i ', 'my daily', 'morning routine', ' tips', ' tricks', ' hacks',
  'diet plan', 'weight loss plan', 'meal plan video', 'grocery', 'shopping',
]

// Ingredient/product categories that are never meal-plan dishes
const SKIP_CONTENT_WORDS = [
  // Sweets & desserts
  'halwa', 'kheer', 'ladoo', 'laddoo', 'barfi', 'burfi', 'mithai', 'payasam',
  'gulab jamun', 'jalebi', 'rasgulla', 'gulgule', 'malpua', 'modak', 'peda',
  'sheera', 'shrikhand', 'rabri', 'basundi', 'phirni', 'kulfi', 'falooda',
  // Drinks
  'juice', ' shake', 'milkshake', 'smoothie', 'lassi', 'chaas', 'buttermilk',
  'squash', 'sherbet', 'sharbat', ' drink', 'beverage', 'tea recipe', 'coffee recipe',
  'masala chai', 'doodh',
  // Condiments & accompaniments (standalone)
  ' pickle', ' achar', 'murabba', ' papad', 'papadum', 'pappadum',
]

// Titles that are just a single generic word — too vague to be useful
const GENERIC_SINGLE = new Set([
  'dosa', 'idli', 'paratha', 'roti', 'pulao', 'biryani', 'curry', 'rice',
  'chutney', 'pickle', 'sabzi', 'sabji', 'dal', 'soup', 'vada', 'pakoda',
  'salad', 'raita', 'bread', 'naan', 'poori', 'puri',
])

/**
 * Returns true if the title should be SKIPPED before even sending to Gemini.
 * Also returns a reason string for stats tracking.
 */
function shouldSkip(rawTitle) {
  const t  = rawTitle.toLowerCase()
  const tClean = t
    .replace(/[|–—:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // #shorts already handled upstream, but catch other YouTube noise
  if (t.includes('#') && !t.includes('recipe')) return 'shorts/hashtag'

  // Too long — usually combo videos like "Aloo Paratha + Dal Makhani + ..."
  if (rawTitle.length > 65) return 'too_long'

  // Multiple dishes bundled with commas or &
  const commaCount = (rawTitle.match(/,/g) || []).length
  if (commaCount >= 2) return 'combo_title'

  // Collection / category / playlist titles
  for (const word of COLLECTION_WORDS) {
    if (tClean.includes(word)) return `collection:${word}`
  }

  // Non-dish content (vlogs, reviews, etc.)
  for (const word of NON_DISH_WORDS) {
    if (tClean.includes(word)) return `non_dish:${word}`
  }

  // Sweets, drinks, condiments
  for (const word of SKIP_CONTENT_WORDS) {
    if (tClean.includes(word.trim())) return `skip_content:${word.trim()}`
  }

  // Pure standalone chutney (not "Coconut Chutney" as a dish but just "Chutney")
  // Allow "X Chutney" as part of a dish but block bare "Chutney" titles
  const coreWords = tClean.replace(/[^a-z\s]/g, '').trim().split(/\s+/)
  if (coreWords.length === 1 && GENERIC_SINGLE.has(coreWords[0])) return 'generic_single_word'
  if (coreWords.length === 2 && coreWords[1] === 'chutney') {
    // "X Chutney" is fine (Coconut Chutney, Tomato Chutney)
    // but "Chutney Recipes", "Indian Chutney" etc are caught by COLLECTION_WORDS already
  }

  return null // keep this title
}

// ── Step 1: fetch titles from YouTube playlist ────────────────────────────────
async function fetchTitles(playlistId, max) {
  const results = []
  let token = null
  while (results.length < max) {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&key=${YOUTUBE_KEY}${token ? '&pageToken=' + token : ''}`
    const res = await fetch(url)
    if (!res.ok) { console.warn('  YouTube error:', res.status); break }
    const data = await res.json()
    for (const item of data.items || []) {
      const title   = item.snippet?.title || ''
      const videoId = item.snippet?.resourceId?.videoId
      if (videoId && title.length > 5 && !title.toLowerCase().includes('#shorts')) {
        results.push({ title, url: `https://www.youtube.com/watch?v=${videoId}` })
      }
    }
    token = data.nextPageToken
    if (!token) break
    await sleep(150)
  }
  return results.slice(0, max)
}

// ── Step 2: pre-filter titles before Gemini ───────────────────────────────────
function preFilter(titles) {
  const kept = []
  const skipStats = {}
  for (const t of titles) {
    const reason = shouldSkip(t.title)
    if (reason) {
      const cat = reason.split(':')[0]
      skipStats[cat] = (skipStats[cat] || 0) + 1
    } else {
      kept.push(t)
    }
  }
  return { kept, skipStats }
}

// ── Step 3: Gemini extraction ─────────────────────────────────────────────────
async function extractDishes(batch, channelName) {
  const lines = batch.map((t, i) => `${i+1}. [${t.url}] ${t.title}`).join('\n')
  const prompt = `Extract Indian home cooking dish names from these YouTube video titles (channel: ${channelName}).

SKIP these — do not include in output:
- Vlogs, kitchen tours, equipment reviews, shopping hauls
- Drinks, juices, shakes, tea, coffee, lassi
- Sweets and desserts (halwa, kheer, ladoo, barfi, jalebi, etc.)
- Standalone chutneys, pickles, papads used only as accompaniments
- Titles that are collections/playlists ("X Recipes", "Easy Y", "Best Z")
- Combo/thali videos listing multiple dishes in one title
- Generic category titles with no specific dish name

INCLUDE: any specific named Indian home-cooked dish — even if the title has marketing words like "restaurant style" or "easy". Extract just the core dish name.

For each valid dish return:
- name: clean dish name only — strip "recipe", "how to make", "easy", "restaurant style", "homemade", "quick", channel name, and any trailing descriptors. Keep regional adjectives if they distinguish the dish (e.g. "Punjabi Dum Aloo", "Goan Fish Curry").
- meal_pairing: "with Steamed Rice" | "with Roti" | "standalone" | "as snack" | "with Dal" | "with Chutney"
- cuisine_type: "North Indian" | "South Indian" | "Maharashtrian" | "Punjabi" | "Gujarati" | "Bengali" | "Goan" | "Rajasthani" | "Street Food" | "Snack" | "Continental" | "Chinese" | "Mexican" | "Thai" | "Italian" | "Japanese" | "Korean" | "Mediterranean"
- complexity: "quick" | "moderate" | "elaborate"
- is_vegetarian: true | false (false if contains eggs, meat, fish, or seafood)
- tags: subset of ["high-protein","low-oil","one-pot","kid-friendly","comfort","festive","quick","healthy","street-food","breakfast","snack"]
- youtube_url: the URL in brackets

Titles:
${lines}

Return ONLY a valid JSON array of dishes. Empty array [] if none qualify. No markdown:
[{"name":"Dal Tadka","meal_pairing":"with Steamed Rice","cuisine_type":"North Indian","complexity":"moderate","is_vegetarian":true,"tags":["comfort"],"youtube_url":"https://..."}]`

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 4000 }
    })
  })
  if (!res.ok) { console.warn('  Gemini error:', res.status); return [] }
  const raw = (await res.json()).candidates?.[0]?.content?.parts?.[0]?.text || ''
  try {
    const parsed = JSON.parse(raw.replace(/^```json\s*|^```\s*|```\s*$/gm, '').trim())
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

// ── Step 4: post-process Gemini output ────────────────────────────────────────
// Final safety filter on what Gemini returns — catches anything it missed
const POST_SKIP_WORDS = [
  'halwa','kheer','ladoo','laddoo','barfi','burfi','mithai','payasam',
  'gulab jamun','jalebi','rasgulla','gulgule','malpua','modak','peda',
  'sheera','shrikhand','rabri','kulfi','falooda','basundi','phirni',
  'juice','shake','smoothie','lassi','chaas','squash','sherbet','sharbat',
  'pickle','achar','murabba','papad',
  'chutney powder', 'chutney podi', 'thokku',  // standalone condiments
]
const POST_SKIP_PATTERNS = [
  /\brecipes?\b/i,
  /\bthali\b/i,
  /\bcombo\b/i,
  /\bplatter\b/i,
  /\blunch box\b/i,
  /,.+,/,                       // 2+ commas = combo title
  /^[a-z\s]+\s*&\s*[a-z\s]+$/i, // pure "X & Y" with no regional/method qualifier
]

function postFilter(dishes) {
  return dishes.filter(d => {
    if (!d.name || typeof d.name !== 'string') return false
    const n = d.name.toLowerCase()

    // Must have a minimum viable name
    if (d.name.trim().length < 3) return false

    // Strip titles that are just one generic word
    const words = n.replace(/[^a-z\s]/g, '').trim().split(/\s+/)
    if (words.length === 1 && GENERIC_SINGLE.has(words[0])) return false

    // Content-based skip
    for (const w of POST_SKIP_WORDS) {
      if (n.includes(w)) return false
    }
    for (const rx of POST_SKIP_PATTERNS) {
      if (rx.test(d.name)) return false
    }

    // Must have required fields
    if (!d.cuisine_type || !d.meal_pairing) return false

    return true
  })
}

// ── Step 5: deduplicate by normalised name ────────────────────────────────────
function norm(name) {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

function dedup(dishes) {
  const map = new Map()
  for (const d of dishes) {
    const k = norm(d.name)
    if (!map.has(k) || (!map.get(k).youtube_url && d.youtube_url)) map.set(k, d)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🎬  GroceryMind YouTube Recipe Scraper v2\n')
  const all = []
  let totalFetched = 0, totalPreFiltered = 0, totalPostFiltered = 0

  for (const ch of CHANNELS) {
    console.log(`📺  ${ch.name}`)
    const titles = await fetchTitles(ch.uploads, MAX_PER_CHANNEL)
    totalFetched += titles.length
    console.log(`    ${titles.length} videos fetched`)

    const { kept, skipStats } = preFilter(titles)
    const preFilteredOut = titles.length - kept.length
    totalPreFiltered += preFilteredOut

    if (Object.keys(skipStats).length) {
      const statStr = Object.entries(skipStats)
        .sort((a,b) => b[1]-a[1])
        .map(([k,v]) => `${k}:${v}`)
        .join(', ')
      console.log(`    pre-filter removed ${preFilteredOut}: ${statStr}`)
    }
    console.log(`    ${kept.length} titles sent to Gemini`)

    let channelDishes = []
    for (let i = 0; i < kept.length; i += BATCH) {
      const batch   = kept.slice(i, i + BATCH)
      const raw     = await extractDishes(batch, ch.name)
      const cleaned = postFilter(raw)
      const postOut = raw.length - cleaned.length
      totalPostFiltered += postOut
      process.stdout.write(`    batch ${Math.floor(i/BATCH)+1}/${Math.ceil(kept.length/BATCH)} → ${raw.length} extracted, ${cleaned.length} kept\n`)
      channelDishes.push(...cleaned.map(d => ({ ...d, channel: ch.name })))
      await sleep(1200)
    }
    console.log(`    ✓ ${channelDishes.length} dishes from ${ch.name}\n`)
    all.push(...channelDishes)
    await sleep(500)
  }

  const final = dedup(all)

  console.log('─'.repeat(50))
  console.log(`📊  Summary:`)
  console.log(`    Videos fetched:        ${totalFetched}`)
  console.log(`    Pre-filtered (source): ${totalPreFiltered}`)
  console.log(`    Post-filtered (Gemini):${totalPostFiltered}`)
  console.log(`    Raw dishes extracted:  ${all.length}`)
  console.log(`    After name dedup:      ${final.length}`)
  console.log()

  // Cuisine breakdown
  const cuisineCounts = {}
  for (const d of final) cuisineCounts[d.cuisine_type] = (cuisineCounts[d.cuisine_type]||0)+1
  console.log('Cuisine breakdown:')
  Object.entries(cuisineCounts).sort((a,b)=>b[1]-a[1]).forEach(([c,n]) => {
    console.log(`    ${c.padEnd(20)} ${n}`)
  })
  console.log()

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify({
    generated_at:  new Date().toISOString(),
    total:         final.length,
    channels:      CHANNELS.map(c => c.name),
    dishes:        final,
  }, null, 2))

  console.log(`✅  Saved to ${OUT}`)
  console.log('\nFirst 10 dishes:')
  final.slice(0,10).forEach(d => console.log(`    ${d.name.padEnd(35)} ${d.cuisine_type} · ${d.meal_pairing}`))
  console.log('\n🎉  Done! Next step: run scripts/enrich-corpus.js to generate embeddings.')
  console.log('    (Remember to lower DEDUP_THRESHOLD to 0.88 in enrich-corpus.js for better variety)\n')
}

main().catch(e => { console.error(e); process.exit(1) })
