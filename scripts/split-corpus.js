#!/usr/bin/env node
/**
 * GroceryMind — Corpus Split Script
 * ===================================
 * Splits dishes-corpus-v2.json (embeddings inline) into the two
 * runtime files the app actually loads:
 *
 *   lib/dishes-meta.json       — dish metadata only (no embeddings)
 *   lib/dishes-embeddings.json — _id + embedding vectors only
 *
 * Run this after enrich-corpus.js finishes.
 *
 * USAGE:
 *   node scripts/split-corpus.js
 */

const fs   = require('fs')
const path = require('path')

const V2_PATH   = path.join(__dirname, '..', 'lib', 'dishes-corpus-v2.json')
const META_PATH = path.join(__dirname, '..', 'lib', 'dishes-meta.json')
const EMB_PATH  = path.join(__dirname, '..', 'lib', 'dishes-embeddings.json')

if (!fs.existsSync(V2_PATH)) {
  console.error('❌  dishes-corpus-v2.json not found. Run enrich-corpus.js first.')
  process.exit(1)
}

console.log('📂  Loading dishes-corpus-v2.json...')
const v2 = JSON.parse(fs.readFileSync(V2_PATH, 'utf-8'))
const dishes = v2.dishes || []

if (!dishes.length) {
  console.error('❌  No dishes found in corpus.')
  process.exit(1)
}

const hasEmbeddings = dishes.filter(d => d.embedding?.length > 0).length
console.log(`    ${dishes.length} dishes total, ${hasEmbeddings} with embeddings`)

// Assign sequential _id if missing (corpus-utils.ts uses _id for embedding lookup)
const metaDishes = dishes.map((d, i) => {
  const { embedding, ...meta } = d
  return { _id: d._id ?? i + 1, ...meta }
})

const embDishes = dishes
  .filter(d => d.embedding?.length > 0)
  .map((d, i) => ({
    _id:       d._id ?? i + 1,
    embedding: d.embedding,
  }))

// Write meta
fs.writeFileSync(META_PATH, JSON.stringify({ dishes: metaDishes }, null, 2))
const metaKB = Math.round(fs.statSync(META_PATH).size / 1024)
console.log(`✅  dishes-meta.json       — ${metaDishes.length} dishes (${metaKB} KB)`)

// Write embeddings (no pretty-print — these are large float arrays)
fs.writeFileSync(EMB_PATH, JSON.stringify({ dishes: embDishes }))
const embKB  = Math.round(fs.statSync(EMB_PATH).size / 1024)
console.log(`✅  dishes-embeddings.json — ${embDishes.length} embeddings (${embKB} KB)`)

console.log('\n🎉  Split complete. Commit both files:')
console.log('    git add lib/dishes-meta.json lib/dishes-embeddings.json')
console.log('    git commit -m "Update corpus: N dishes"')
console.log('    git push')
