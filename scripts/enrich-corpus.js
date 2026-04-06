#!/usr/bin/env node
/**
 * GroceryMind — Corpus Enrichment Script
 * =======================================
 *   1. Loads dishes-corpus.json, keeps only target channels
 *   2. Merges supplementary-dishes.json (curated Indian + international)
 *   3. Cleans garbage titles
 *   4. Generates Gemini embeddings for every dish name
 *   5. Deduplicates using name-based two-signal approach (Jaccard + structural)
 *   6. Writes lib/dishes-corpus-v2.json (with embeddings inline)
 *
 * USAGE:
 *   GEMINI_API_KEY=your_key node scripts/enrich-corpus.js
 *
 * Supports resuming — if interrupted, re-run and it will skip already-embedded dishes.
 * Time: ~15-20 min for ~600 dishes (rate-limited to stay within Gemini free quota)
 */

const fs   = require('fs')
const path = require('path')

const GEMINI_KEY = process.env.GEMINI_API_KEY
if (!GEMINI_KEY) { console.error('❌  Set GEMINI_API_KEY'); process.exit(1) }

const CORPUS_IN  = path.join(__dirname, '..', 'lib', 'dishes-corpus.json')
const SUPPL_IN   = path.join(__dirname, '..', 'lib', 'supplementary-dishes.json')
const CORPUS_OUT = path.join(__dirname, '..', 'lib', 'dishes-corpus-v2.json')
const EMBED_CACHE = path.join(__dirname, '..', 'lib', '.embed-cache.json')

const KEEP_CHANNELS = new Set(['Hebbars Kitchen', 'Your Food Lab', 'Ranveer Brar', "Kabita's Kitchen"])
const BATCH_SIZE    = 20
const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Step 1: load & filter corpus ──────────────────────────────────────────────
function loadAndFilter() {
  const raw  = JSON.parse(fs.readFileSync(CORPUS_IN, 'utf-8'))
  const all  = raw.dishes || []
  const kept = all.filter(d => KEEP_CHANNELS.has(d.channel))
  console.log(`Loaded ${all.length} dishes, kept ${kept.length} from target channels`)
  return kept
}

// ── Step 2: load supplementary ────────────────────────────────────────────────
function loadSupplementary() {
  if (!fs.existsSync(SUPPL_IN)) {
    console.warn('  ⚠️  No supplementary-dishes.json found, skipping')
    return []
  }
  const raw    = JSON.parse(fs.readFileSync(SUPPL_IN, 'utf-8'))
  const dishes = (raw.dishes || []).map(d => ({ ...d, channel: 'curated', source: 'manual' }))
  console.log(`Loaded ${dishes.length} supplementary dishes`)
  return dishes
}

// ── Step 3: clean ─────────────────────────────────────────────────────────────
const SKIP_WORDS = [
  'halwa','kheer','ladoo','laddoo','barfi','burfi','mithai','payasam',
  'gulab jamun','jalebi','rasgulla','gulgule','malpua','modak','peda',
  'sheera','shrikhand','rabri','kulfi','basundi','phirni',
  'juice','shake','smoothie','lassi','chaas','squash','sherbet','sharbat',
  'pickle','achar','murabba','papad',
]

function cleanDishes(dishes) {
  const before = dishes.length
  const cleaned = dishes.filter(d => {
    if (!d.name || typeof d.name !== 'string') return false
    const n = d.name.toLowerCase()
    if (d.name.trim().length < 3) return false
    if ((d.name.match(/,/g) || []).length >= 2) return false
    if (d.name.length > 80) return false
    if (/\b(recipes?|thali|combo|platter)\b/i.test(n)) return false
    for (const w of SKIP_WORDS) if (n.includes(w)) return false
    return true
  })
  console.log(`Cleaned: ${before} → ${cleaned.length} (removed ${before - cleaned.length})`)
  return cleaned
}

// ── Step 4: Gemini embeddings ─────────────────────────────────────────────────
async function embedBatch(names) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: names.map(name => ({
          model: 'models/gemini-embedding-001',
          content: { parts: [{ text: name }] },
        }))
      })
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Embedding API ${res.status}: ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  return (data.embeddings || []).map(e => e.values || [])
}

async function embedAllDishes(dishes) {
  // Load cache
  let cache = {}
  if (fs.existsSync(EMBED_CACHE)) {
    try { cache = JSON.parse(fs.readFileSync(EMBED_CACHE, 'utf-8')) } catch {}
    console.log(`  Resume cache: ${Object.keys(cache).length} embeddings`)
  }

  const toEmbed = dishes.filter(d => !cache[d.name])
  console.log(`\nEmbedding ${toEmbed.length} dishes (${dishes.length - toEmbed.length} cached)...`)

  for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
    const batch = toEmbed.slice(i, i + BATCH_SIZE)
    const names = batch.map(d => d.name)
    let embeddings
    // Retry up to 3 times on failure
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        embeddings = await embedBatch(names)
        break
      } catch (e) {
        if (attempt === 3) throw e
        console.warn(`  Batch failed (attempt ${attempt}), retrying...`)
        await sleep(3000 * attempt)
      }
    }
    batch.forEach((d, j) => { if (embeddings[j]?.length) cache[d.name] = embeddings[j] })
    // Save cache after every batch for resume support
    fs.writeFileSync(EMBED_CACHE, JSON.stringify(cache))
    process.stdout.write(`  ${Math.min(i + BATCH_SIZE, toEmbed.length)}/${toEmbed.length} embedded\r`)
    await sleep(500)
  }
  console.log(`\n  Done embedding.`)

  return dishes
    .map(d => ({ ...d, embedding: cache[d.name] || [] }))
    .filter(d => d.embedding.length > 0)
}

// ── Step 5: name-based two-signal deduplication ───────────────────────────────
// Two dishes are duplicates if they share ≥2 meaningful tokens, Jaccard ≥ 0.65,
// don't differ on a protein/format word, and neither adds specificity via extra tokens.

const NAME_STOP = new Set([
  'with','in','of','the','a','an','and','style','recipe','easy','quick',
  'simple','spicy','authentic','homemade','restaurant','street','instant',
  'crispy','how','to','make','fresh','special','classic','traditional',
  'veg','punjabi','south','north','indian','thai','chinese','goan',
  'masala','sabzi','sabji','curry','gravy','tadka','bhuna',
  'do','ki','ka','ke','da','de','wali','wale','waali','waale',
])

const DISH_PROTEINS = new Set([
  'paneer','chicken','murgh','mutton','egg','anda','prawn','fish','tofu','soya',
  'lamb','keema','mince','chole','rajma','moong','chana','gobi','bhindi',
  'aloo','baingan','palak','methi','lauki','tinda','arbi','suran',
])

const DISH_FORMATS = new Set([
  'biryani','paratha','sandwich','wrap','roll','kebab','kabab','kofta',
  'tikka','dosa','idli','vada','pakoda','pakora','poori','puri','bhature',
  'chaat','pulao','khichdi','soup','upma','halwa','bun','momo','pizza',
  'burger','noodles','pasta','rice','roti',
])

function tokeniseName(name) {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
    .filter(t => t.length > 1 && !NAME_STOP.has(t))
}

function jaccard(a, b) {
  const sa = new Set(a), sb = new Set(b)
  let inter = 0
  for (const t of sa) if (sb.has(t)) inter++
  return inter / (sa.size + sb.size - inter)
}

function differOnKeyWord(ta, tb) {
  const sa = new Set(ta), sb = new Set(tb)
  const pa = [...sa].filter(t => DISH_PROTEINS.has(t))
  const pb = [...sb].filter(t => DISH_PROTEINS.has(t))
  if (pa.length && pb.length && pa.sort().join() !== pb.sort().join()) return true
  if (Boolean(pa.length) !== Boolean(pb.length)) return true
  const fa = [...sa].filter(t => DISH_FORMATS.has(t))
  const fb = [...sb].filter(t => DISH_FORMATS.has(t))
  if (fa.length && fb.length && fa.sort().join() !== fb.sort().join()) return true
  if (Boolean(fa.length) !== Boolean(fb.length)) return true
  return false
}

function subsetAddsSpecificity(ta, tb) {
  const sa = new Set(ta), sb = new Set(tb)
  let extra
  if ([...sa].every(t => sb.has(t)) && sa.size < sb.size) extra = [...sb].filter(t => !sa.has(t))
  else if ([...sb].every(t => sa.has(t)) && sb.size < sa.size) extra = [...sa].filter(t => !sb.has(t))
  else return false
  const trivial = new Set(['da','de','wala','wali','waale','waali'])
  return extra.some(t => !trivial.has(t))
}

function deduplicateBySimilarity(dishes) {
  console.log(`\nDeduplicating ${dishes.length} dishes (name-based two-signal approach)...`)
  const kept   = []
  const merged = []

  for (const dish of dishes) {
    const ta = tokeniseName(dish.name)
    let isDuplicate = false

    for (const keptDish of kept) {
      const tb     = tokeniseName(keptDish.name)
      const shared = ta.filter(t => new Set(tb).has(t))
      if (shared.length < 2) continue
      const j = jaccard(ta, tb)
      if (j < 0.65) continue
      if (differOnKeyWord(ta, tb)) continue
      if (subsetAddsSpecificity(ta, tb)) continue

      isDuplicate = true
      merged.push({ duplicate: dish.name, kept: keptDish.name, jaccard: j.toFixed(3) })
      if (dish.youtube_url && !keptDish.youtube_url) {
        keptDish.youtube_url = dish.youtube_url
        keptDish.channel     = dish.channel || keptDish.channel
      }
      break
    }
    if (!isDuplicate) kept.push(dish)
  }

  console.log(`  Removed ${merged.length} duplicates → ${kept.length} unique dishes`)
  console.log('\n  Sample merges:')
  merged.slice(0, 20).forEach(m =>
    console.log(`    j=${m.jaccard}  "${m.duplicate}" → kept "${m.kept}"`)
  )
  return { kept, merged }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🍽️  GroceryMind Corpus Enrichment\n')

  const scraped       = loadAndFilter()
  const supplementary = loadSupplementary()

  const supplNames     = new Set(supplementary.map(d => d.name.toLowerCase()))
  const scrapedDeduped = scraped.filter(d => !supplNames.has(d.name.toLowerCase()))
  const merged         = [...supplementary, ...scrapedDeduped]
  console.log(`\nMerged: ${supplementary.length} supplementary + ${scrapedDeduped.length} scraped = ${merged.length} total`)

  const cleaned      = cleanDishes(merged)
  const withEmbed    = await embedAllDishes(cleaned)
  const { kept, merged: dupes } = deduplicateBySimilarity(withEmbed)

  const output = {
    generated_at:       new Date().toISOString(),
    total:              kept.length,
    channels_included:  [...KEEP_CHANNELS, 'curated'],
    dedup_method:       'name-jaccard-two-signal',
    duplicates_removed: dupes.length,
    dishes:             kept,
  }

  fs.writeFileSync(CORPUS_OUT, JSON.stringify(output))
  const sizeKB = Math.round(fs.statSync(CORPUS_OUT).size / 1024)
  console.log(`\n✅  Saved ${kept.length} dishes to ${CORPUS_OUT} (${sizeKB} KB)`)

  const cuisineMap = {}
  kept.forEach(d => cuisineMap[d.cuisine_type || 'Unknown'] = (cuisineMap[d.cuisine_type || 'Unknown'] || 0) + 1)
  console.log('\nCuisine breakdown:')
  Object.entries(cuisineMap).sort((a,b) => b[1]-a[1]).slice(0,15)
    .forEach(([k,v]) => console.log(`  ${k}: ${v}`))

  const veg = kept.filter(d => d.is_vegetarian).length
  console.log(`\nVegetarian: ${veg} | Non-veg: ${kept.length - veg}`)

  console.log('\n🎉  Done! Next step:')
  console.log('    node scripts/split-corpus.js')
  console.log('    git add lib/dishes-meta.json lib/dishes-embeddings.json lib/dishes-corpus-v2.json')
  console.log('    git commit -m "Update corpus"')
  console.log('    git push')
  console.log('\n⚠️   Do NOT commit lib/.embed-cache.json')
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
