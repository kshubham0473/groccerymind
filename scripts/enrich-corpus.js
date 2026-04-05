#!/usr/bin/env node
/**
 * GroceryMind — Corpus Enrichment Script
 * =======================================
 * Does four things in one run:
 *   1. Loads current dishes-corpus.json, keeps only Hebbars / YFL / Ranveer
 *   2. Merges the supplementary dish list (international + curated Indian)
 *   3. Cleans obvious garbage (sweets, condiments, weird titles)
 *   4. Generates Gemini embeddings for every dish name
 *   5. Deduplicates using cosine similarity (threshold 0.92)
 *   6. Writes lib/dishes-corpus-v2.json (with embeddings)
 *
 * USAGE (in Codespaces terminal):
 *   GEMINI_API_KEY=your_key node scripts/enrich-corpus.js
 *
 * Run AFTER scrape-youtube-dishes.js has produced a clean dishes-corpus.json.
 * DEDUP_THRESHOLD lowered to 0.88 (from 0.92) — works correctly because the
 * scraper v2 pre-filters garbage titles, so fewer legitimate variants get collapsed.
 *
 * Time: ~15-20 min for ~900 dishes (rate-limited to stay within free quota)
 * Output: lib/dishes-corpus-v2.json
 */

const fs   = require('fs')
const path = require('path')

const GEMINI_KEY = process.env.GEMINI_API_KEY
if (!GEMINI_KEY) { console.error('❌  Set GEMINI_API_KEY'); process.exit(1) }

const CORPUS_IN    = path.join(__dirname, '..', 'lib', 'dishes-corpus.json')
const SUPPL_IN     = path.join(__dirname, '..', 'lib', 'supplementary-dishes.json')
const CORPUS_OUT   = path.join(__dirname, '..', 'lib', 'dishes-corpus-v2.json')
const EMBED_CACHE  = path.join(__dirname, '..', 'lib', '.embed-cache.json') // resume support

// ── Config ────────────────────────────────────────────────────────────────────
const KEEP_CHANNELS   = new Set(['Hebbars Kitchen', 'Your Food Lab', 'Ranveer Brar'])
// Dedup thresholds — cuisine-aware to prevent cross-cuisine collapses
// (e.g. "Veg Ramen" → "Veg Burrito Bowl" at 0.88 is a false positive)
const DEDUP_SAME_CUISINE      = 0.92  // strict within the same cuisine type
const DEDUP_RELATED_CUISINE   = 0.96  // looser across related cuisine groups
const DEDUP_CROSS_CUISINE     = 0.98  // almost never collapse across unrelated cuisines

// Cuisine groups — dishes within the same group use DEDUP_RELATED_CUISINE
const CUISINE_GROUPS = {
  'North Indian':    'indian',
  'South Indian':    'indian',
  'Maharashtrian':   'indian',
  'Punjabi':         'indian',
  'Gujarati':        'indian',
  'Bengali':         'indian',
  'Rajasthani':      'indian',
  'Goan':            'indian',
  'Kashmiri':        'indian',
  'Mughlai':         'indian',
  'Hyderabadi':      'indian',
  'Indian':          'indian',
  'Street Food':     'indian',
  'Snack':           'indian',
  'Chinese':         'eastasian',
  'Japanese':        'eastasian',
  'Korean':          'eastasian',
  'Thai':            'southeast_asian',
  'Vietnamese':      'southeast_asian',
  'Malaysian':       'southeast_asian',
  'Italian':         'western',
  'Continental':     'western',
  'Mediterranean':   'western',
  'Mexican':         'western',
  'American':        'western',
}

function getDedupThreshold(cuisineA, cuisineB) {
  if (!cuisineA || !cuisineB) return DEDUP_SAME_CUISINE
  if (cuisineA === cuisineB) return DEDUP_SAME_CUISINE
  const groupA = CUISINE_GROUPS[cuisineA]
  const groupB = CUISINE_GROUPS[cuisineB]
  if (groupA && groupB && groupA === groupB) return DEDUP_RELATED_CUISINE
  return DEDUP_CROSS_CUISINE
}
const BATCH_SIZE      = 20     // embeddings per API call (Gemini supports batch)
const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Step 1: load & filter corpus ─────────────────────────────────────────────
function loadAndFilter() {
  const raw     = JSON.parse(fs.readFileSync(CORPUS_IN, 'utf-8'))
  const all     = raw.dishes || []
  const kept    = all.filter(d => KEEP_CHANNELS.has(d.channel))
  console.log(`Loaded ${all.length} dishes, kept ${kept.length} from target channels`)
  return kept
}

// ── Step 2: load supplementary ───────────────────────────────────────────────
function loadSupplementary() {
  if (!fs.existsSync(SUPPL_IN)) {
    console.warn('  ⚠️  No supplementary-dishes.json found, skipping')
    return []
  }
  const raw = JSON.parse(fs.readFileSync(SUPPL_IN, 'utf-8'))
  const dishes = (raw.dishes || []).map(d => ({ ...d, channel: 'curated', source: 'manual' }))
  console.log(`Loaded ${dishes.length} supplementary dishes`)
  return dishes
}

// ── Step 3: clean ─────────────────────────────────────────────────────────────
const SKIP_WORDS = [
  'halwa','kheer','ladoo','barfi','mithai','payasam','gulab jamun','jalebi',
  'rasgulla','gulgule','malpua','modak','peda','burfi','sheera','shrikhand',
  'chutney','pickle','achar','papad','raita',
  'juice','shake','smoothie','lassi','chaas','squash','sherbet',
  'chaat masala','masala powder',
]
const SKIP_PATTERNS = [
  /\b(combo|recipes?)\b/i,
  /^\d+ in \d+/,
  /&amp;/,
]

function isGarbage(name) {
  if (!name || typeof name !== 'string') return true
  const n = name.toLowerCase().trim()
  if (SKIP_WORDS.some(w => n.includes(w))) return true
  if (SKIP_PATTERNS.some(p => p.test(n))) return true
  if ((name.match(/,/g) || []).length >= 2) return true
  if (name.length > 60) return true
  // Generic non-dish titles
  if (/^(instant|quick|easy|simple|healthy|crispy)\s+\w+$/i.test(name.trim())) {
    // Only keep if the second word is a recognisable dish
    const second = name.trim().split(/\s+/).slice(1).join(' ').toLowerCase()
    const dishWords = ['dosa','idli','poha','upma','paratha','sabzi','dal','rice','roti','curry']
    if (!dishWords.some(w => second.includes(w))) return true
  }
  return false
}

function cleanDishes(dishes) {
  const before = dishes.length
  const cleaned = dishes.filter(d => !isGarbage(d.name))
  console.log(`Cleaned: ${before} → ${cleaned.length} (removed ${before - cleaned.length} garbage entries)`)
  return cleaned
}

// ── Step 4: embeddings ────────────────────────────────────────────────────────
// Load cache to allow resuming if the script is interrupted
function loadCache() {
  if (fs.existsSync(EMBED_CACHE)) {
    try { return JSON.parse(fs.readFileSync(EMBED_CACHE, 'utf-8')) }
    catch { return {} }
  }
  return {}
}
function saveCache(cache) {
  fs.writeFileSync(EMBED_CACHE, JSON.stringify(cache))
}

async function embedBatch(texts) {
  const body = {
    requests: texts.map(text => ({
      model: 'models/text-embedding-004',
      content: { parts: [{ text }] },
      taskType: 'SEMANTIC_SIMILARITY',
    }))
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=${GEMINI_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Embed API ${res.status}: ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  return (data.embeddings || []).map(e => e.values || [])
}

async function embedAllDishes(dishes) {
  const cache = loadCache()
  let cacheHits = 0
  let apiCalls  = 0

  // Identify which need embedding
  const needEmbed = dishes.filter(d => !cache[d.name])
  const names     = needEmbed.map(d => d.name)

  console.log(`\nEmbedding ${names.length} dishes (${Object.keys(cache).length} cached)...`)

  for (let i = 0; i < names.length; i += BATCH_SIZE) {
    const batch = names.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(names.length / BATCH_SIZE)

    process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${batch.length} dishes)...`)

    try {
      const embeddings = await embedBatch(batch)
      for (let j = 0; j < batch.length; j++) {
        if (embeddings[j]?.length) {
          cache[batch[j]] = embeddings[j]
          apiCalls++
        }
      }
      saveCache(cache)
      process.stdout.write(` ✓\n`)
    } catch (err) {
      process.stdout.write(` ⚠️  ${err.message}\n`)
      // Wait longer on error (rate limit)
      await sleep(5000)
    }

    // Respect rate limits — ~1500 RPM for embedding API
    await sleep(600)
  }

  // Attach embeddings to all dishes
  const result = dishes.map(d => ({
    ...d,
    embedding: cache[d.name] || null
  })).filter(d => d.embedding !== null)

  console.log(`  Embedded: ${result.length} dishes (${apiCalls} new calls, ${Object.keys(cache).length - apiCalls} from cache)`)
  return result
}

// ── Step 5: cosine similarity deduplication ───────────────────────────────────
function cosine(a, b) {
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB) + 1e-10)
}

function deduplicateBySimilarity(dishes) {
  console.log(`\nDeduplicating ${dishes.length} dishes (cuisine-aware thresholds)...`)
  const kept   = []
  const merged = []

  for (const dish of dishes) {
    let isDuplicate = false
    for (const keptDish of kept) {
      const threshold = getDedupThreshold(dish.cuisine_type, keptDish.cuisine_type)
      const sim = cosine(dish.embedding, keptDish.embedding)
      if (sim >= threshold) {
        isDuplicate = true
        merged.push({
          duplicate: dish.name,
          kept:      keptDish.name,
          similarity: sim.toFixed(3),
          threshold:  threshold.toFixed(2),
          cuisines:  `${dish.cuisine_type} / ${keptDish.cuisine_type}`,
        })
        // If the duplicate has a YouTube URL and the kept one doesn't, swap
        if (dish.youtube_url && !keptDish.youtube_url) {
          keptDish.youtube_url = dish.youtube_url
          keptDish.channel     = dish.channel || keptDish.channel
        }
        break
      }
    }
    if (!isDuplicate) kept.push(dish)
  }

  console.log(`  Removed ${merged.length} duplicates → ${kept.length} unique dishes`)

  // Show a sample of what was merged — grouped by threshold used
  const crossCuisine = merged.filter(m => parseFloat(m.threshold) >= DEDUP_CROSS_CUISINE)
  const related      = merged.filter(m => parseFloat(m.threshold) === DEDUP_RELATED_CUISINE)
  const same         = merged.filter(m => parseFloat(m.threshold) === DEDUP_SAME_CUISINE)
  console.log(`  Same cuisine (${DEDUP_SAME_CUISINE}): ${same.length} merged`)
  console.log(`  Related cuisine (${DEDUP_RELATED_CUISINE}): ${related.length} merged`)
  console.log(`  Cross cuisine (${DEDUP_CROSS_CUISINE}): ${crossCuisine.length} merged`)

  console.log('\n  Sample merges:')
  merged.slice(0, 20).forEach(m =>
    console.log(`    ${m.similarity} [t=${m.threshold}] — "${m.duplicate}" → kept "${m.kept}" (${m.cuisines})`)
  )

  return { kept, merged }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🍽️  GroceryMind Corpus Enrichment\n')

  // 1. Load & filter
  const scraped = loadAndFilter()
  const supplementary = loadSupplementary()

  // 2. Merge (supplementary dishes get priority — they're already clean)
  const supplNames = new Set(supplementary.map(d => d.name.toLowerCase()))
  const scrapedDeduped = scraped.filter(d => !supplNames.has(d.name.toLowerCase()))
  const merged = [...supplementary, ...scrapedDeduped]
  console.log(`\nMerged: ${supplementary.length} supplementary + ${scrapedDeduped.length} scraped = ${merged.length} total`)

  // 3. Clean
  const cleaned = cleanDishes(merged)

  // 4. Embed
  const withEmbeddings = await embedAllDishes(cleaned)

  // 5. Deduplicate
  const { kept, merged: dupes } = deduplicateBySimilarity(withEmbeddings)

  // 6. Write output (embeddings included for runtime use)
  const output = {
    generated_at:       new Date().toISOString(),
    total:              kept.length,
    channels_included:  [...KEEP_CHANNELS, 'curated'],
    dedup_thresholds:   { same_cuisine: DEDUP_SAME_CUISINE, related: DEDUP_RELATED_CUISINE, cross: DEDUP_CROSS_CUISINE },
    duplicates_removed: dupes.length,
    dishes: kept,
  }

  fs.writeFileSync(CORPUS_OUT, JSON.stringify(output))
  const sizeKB = Math.round(fs.statSync(CORPUS_OUT).size / 1024)

  console.log(`\n✅  Saved ${kept.length} dishes to ${CORPUS_OUT} (${sizeKB} KB)`)

  // Stats
  const { Counter } = (() => {
    const c = {}
    return {
      Counter: arr => {
        const map = {}
        arr.forEach(x => map[x] = (map[x] || 0) + 1)
        return Object.entries(map).sort((a,b) => b[1]-a[1])
      }
    }
  })()

  console.log('\nCuisine breakdown:')
  Counter(kept.map(d => d.cuisine_type || 'Unknown'))
    .slice(0, 15)
    .forEach(([k, v]) => console.log(`  ${k}: ${v}`))

  const veg = kept.filter(d => d.is_vegetarian).length
  console.log(`\nVegetarian: ${veg} | Non-veg: ${kept.length - veg}`)

  console.log('\n🎉  Done! Now run:')
  console.log('    git add lib/dishes-corpus-v2.json')
  console.log('    git commit -m "Add enriched corpus v2 with embeddings"')
  console.log('    git push')
  console.log('\n⚠️   The .embed-cache.json file is for resuming only — do NOT commit it.')
  console.log('    Add lib/.embed-cache.json to your .gitignore')
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
