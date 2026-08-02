#!/usr/bin/env node
/**
 * scripts/backfill-dish-images.js
 *
 * Fills `image_url` for every corpus dish that has no picture — i.e. the ~96
 * manually-curated dishes that were never scraped from YouTube and so render as
 * a bare monogram.
 *
 * Runs the same ladder the live app uses (lib/dish-image-sources.js), so what
 * you measure here is what users will get.
 *
 *   DRY RUN FIRST. It writes nothing and prints the per-tier hit rate:
 *     node scripts/backfill-dish-images.js --dry-run
 *
 *   Then, once the numbers look right:
 *     node scripts/backfill-dish-images.js
 *
 * Options
 *   --dry-run         resolve and report, write nothing         (do this first)
 *   --limit=N         only process the first N blank dishes     (sampling)
 *   --tiers=a,b       override the ladder, e.g. --tiers=wikimedia
 *   --file=PATH       target corpus file (default lib/dishes-meta.json)
 *   --force           re-resolve dishes that already have an image_url
 *   --delay=MS        pause between dishes (default 250, be kind to Wikipedia)
 *
 * Set YOUTUBE_API_KEY in your shell to enable tier 2. Without it the script
 * runs wikimedia + corpus only, which costs nothing and has no quota.
 *
 * PIPELINE POSITION: run this AFTER split-corpus.js, on the runtime meta file.
 * Re-running the full scrape → enrich → split chain will overwrite the images,
 * so re-run this script afterwards (it is idempotent and cache-friendly).
 */

'use strict'

const fs = require('fs')
const path = require('path')
const { resolveDishImage, nameKey } = require('../lib/dish-image-sources.js')

// ── Args ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const has = (flag) => argv.includes(flag)
const val = (name, fallback) => {
  const hit = argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : fallback
}

const DRY_RUN = has('--dry-run')
const FORCE = has('--force')
const LIMIT = parseInt(val('limit', '0'), 10) || 0
const DELAY = parseInt(val('delay', '250'), 10)
const TIERS = val('tiers', 'wikimedia,youtube,corpus').split(',').map(s => s.trim()).filter(Boolean)
const FILE = path.resolve(__dirname, '..', val('file', 'lib/dishes-meta.json'))

const YT_KEY = process.env.YOUTUBE_API_KEY || null

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ── Load ──────────────────────────────────────────────────────────────────────
if (!fs.existsSync(FILE)) {
  console.error(`✗ Corpus file not found: ${FILE}`)
  process.exit(1)
}

const raw = JSON.parse(fs.readFileSync(FILE, 'utf-8'))
const dishes = raw.dishes || raw
if (!Array.isArray(dishes)) {
  console.error('✗ Expected { dishes: [...] } or a bare array.')
  process.exit(1)
}

// Dishes that already have a YouTube thumbnail are fine — leave them alone.
// This is the "fill gaps only" scope; it does not re-image the whole corpus.
const blank = dishes.filter(d => {
  if (d.youtube_url) return false
  if (d.image_url && !FORCE) return false
  return true
})

const targets = LIMIT ? blank.slice(0, LIMIT) : blank

console.log('─'.repeat(64))
console.log(`  Corpus         ${path.relative(process.cwd(), FILE)}`)
console.log(`  Total dishes   ${dishes.length}`)
console.log(`  Without image  ${blank.length}`)
console.log(`  Processing     ${targets.length}${LIMIT ? `  (--limit=${LIMIT})` : ''}`)
console.log(`  Ladder         ${TIERS.join(' → ')}`)
console.log(`  YouTube tier   ${TIERS.includes('youtube') ? (YT_KEY ? 'enabled' : 'SKIPPED (no YOUTUBE_API_KEY)') : 'off'}`)
console.log(`  Mode           ${DRY_RUN ? 'DRY RUN — nothing will be written' : 'WRITE'}`)
console.log('─'.repeat(64))

if (TIERS.includes('youtube') && YT_KEY && targets.length > 100) {
  console.log(`  ⚠  ${targets.length} dishes but the YouTube free quota allows ~100`)
  console.log('     search calls/day. Later dishes may fall through to the corpus')
  console.log('     tier or come back empty. Consider --limit=100 across two days.\n')
}

// ── Resolve ───────────────────────────────────────────────────────────────────
async function main() {
  const stats = { wikimedia: 0, youtube: 0, corpus: 0, none: 0 }
  const misses = []
  const borrowed = []
  const seen = new Map()

  for (let i = 0; i < targets.length; i++) {
    const dish = targets[i]
    const label = `[${String(i + 1).padStart(3)}/${targets.length}] ${dish.name}`

    // Two spellings of the same dish shouldn't cost two lookups.
    const key = nameKey(dish.name)
    let hit
    if (seen.has(key)) {
      hit = seen.get(key)
    } else {
      hit = await resolveDishImage(dish.name, {
        youtubeApiKey: YT_KEY,
        corpus: dishes,
        tiers: TIERS,
      })
      seen.set(key, hit)
      if (DELAY) await sleep(DELAY)
    }

    if (!hit) {
      stats.none++
      misses.push(dish.name)
      console.log(`${label}\n      ✗ no image found`)
      continue
    }

    stats[hit.image_source] = (stats[hit.image_source] || 0) + 1

    if (hit.image_source === 'corpus') {
      borrowed.push({ dish: dish.name, from: hit.borrowed_from, confidence: hit.confidence })
    }

    const via = hit.image_source === 'corpus'
      ? `borrowed from "${hit.borrowed_from}" (j=${hit.confidence})`
      : hit.matched_title || ''
    console.log(`${label}\n      ✓ ${hit.image_source.padEnd(9)} ${via}`)

    if (!DRY_RUN) {
      dish.image_url = hit.image_url
      dish.image_source = hit.image_source
      if (hit.image_attribution) dish.image_attribution = hit.image_attribution
      // Only the youtube tier found a recipe for THIS dish. A borrowed corpus
      // thumbnail is another dish's video and must never become a recipe link.
      if (hit.youtube_url && hit.image_source === 'youtube') {
        dish.youtube_url = hit.youtube_url
      }
    }
  }

  // ── Report ──────────────────────────────────────────────────────────────────
  const resolved = targets.length - stats.none
  const pct = targets.length ? ((resolved / targets.length) * 100).toFixed(1) : '0.0'

  console.log('\n' + '─'.repeat(64))
  console.log('  RESULTS')
  console.log('─'.repeat(64))
  console.log(`  wikimedia   ${String(stats.wikimedia || 0).padStart(4)}`)
  console.log(`  youtube     ${String(stats.youtube || 0).padStart(4)}`)
  console.log(`  corpus      ${String(stats.corpus || 0).padStart(4)}   (approximate — another dish's photo)`)
  console.log(`  no image    ${String(stats.none || 0).padStart(4)}   (stays a monogram)`)
  console.log(`  ────────────────`)
  console.log(`  coverage    ${pct}%  (${resolved}/${targets.length})`)

  if (borrowed.length) {
    console.log('\n  BORROWED — eyeball these, they are the only approximate ones:')
    for (const b of borrowed) console.log(`    "${b.dish}"  ←  "${b.from}"  (j=${b.confidence})`)
  }

  if (misses.length) {
    console.log(`\n  STILL BLANK (${misses.length}):`)
    console.log('    ' + misses.join(', '))
  }

  if (DRY_RUN) {
    console.log('\n  Dry run — no files touched. Re-run without --dry-run to write.')
    return
  }

  // ── Write ───────────────────────────────────────────────────────────────────
  const backup = `${FILE}.bak`
  fs.copyFileSync(FILE, backup)
  const out = raw.dishes ? { ...raw, dishes } : dishes
  fs.writeFileSync(FILE, JSON.stringify(out, null, 2))

  console.log(`\n  ✓ Wrote ${path.relative(process.cwd(), FILE)}`)
  console.log(`  ✓ Backup at ${path.relative(process.cwd(), backup)}`)
  console.log('\n  Next: commit the updated meta file and redeploy.')
}

main().catch(err => {
  console.error('\n✗ Failed:', err)
  process.exit(1)
})
