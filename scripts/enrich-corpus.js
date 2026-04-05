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
// ── Name-based deduplication ──────────────────────────────────────────────────
// Two dishes are duplicates if and only if they share the same core identity
// after stripping stop/generic words, have ≥2 shared meaningful tokens,
// Jaccard similarity ≥ 0.65, no differing protein/format word, and neither
// dish's extra tokens add meaningful specificity (ingredient, region, technique).
//
// This replaces the previous cosine-only approach which collapsed unrelated
// dishes like "Veg Ramen" → "Veg Burrito Bowl" and "Palak Paneer" → "Palak Chicken".

const NAME_STOP = new Set([
  'with','in','of','the','a','an','and','style','recipe','easy','quick',
  'simple','spicy','authentic','homemade','restaurant','street','instant',
  'crispy','how','to','make','fresh','special','classic','traditional',
  'veg','punjabi','south','north','indian','thai','chinese','goan',
  // Generic cooking descriptors — not dish identity words
  'masala','sabzi','sabji','curry','gravy','tadka','bhuna',
  'do','ki','ka','ke','da','de','wali','wale','waali','waale',
])

// Proteins and main vegetables — dishes differing on these are NOT the same dish
const DISH_PROTEINS = new Set([
  'paneer','chicken','murgh','mutton','egg','anda','prawn','fish','tofu','soya',
  'lamb','keema','mince','chole','rajma','moong','chana','gobi','bhindi',
  'aloo','baingan','palak','methi','lauki','tinda','arbi','suran',
])

// Dish format/type words — dishes differing on these are NOT the same dish
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
  // Differ on protein
  const pa = [...sa].filter(t => DISH_PROTEINS.has(t))
  const pb = [...sb].filter(t => DISH_PROTEINS.has(t))
  if (pa.length && pb.length && pa.sort().join() !== pb.sort().join()) return true
  if (Boolean(pa.length) !== Boolean(pb.length)) return true
  // Differ on dish format
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
  // Extra tokens are meaningful if they're real words (not trivial particles)
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
    dedup_method:       'name-jaccard-two-signal',
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
