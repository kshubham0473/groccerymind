#!/usr/bin/env node
/**
 * GroceryMind — YouTube Recipe Scraper
 * =====================================
 * Fetches video titles from Indian cooking YouTube channels,
 * processes them through Gemini to extract structured dish data,
 * and writes a corpus JSON to lib/dishes-corpus.json
 *
 * USAGE:
 *   YOUTUBE_API_KEY=xxx GEMINI_API_KEY=xxx node scripts/scrape-youtube-dishes.js
 *
 * Get YouTube API key: console.cloud.google.com
 *   → New project → Enable "YouTube Data API v3" → Credentials → API Key
 * Get Gemini API key:  aistudio.google.com → Get API key
 *
 * No npm install needed — uses Node.js built-in fetch (Node 18+)
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
  { name: "Hebbars Kitchen",    uploads: "UUYNOe9bCJCg97IbcDllxFhg" },
  { name: "Kabita's Kitchen",   uploads: "UUmMHHMzF7_lCTTFXp6X3TTA" },
  { name: "Nisha Madhulika",    uploads: "UUCijOziG2oNdh3_VFaWlyEw" },
  { name: "Ranveer Brar",       uploads: "UU4vSqUrNNOYaNgRcbTFhBpg" },
]

const MAX_PER_CHANNEL = 500   // videos to pull per channel
const BATCH           = 50    // titles per Gemini call
const OUT             = path.join(__dirname, '..', 'lib', 'dishes-corpus.json')

const sleep = ms => new Promise(r => setTimeout(r, ms))

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

// ── Step 2: Gemini extraction ─────────────────────────────────────────────────
async function extractDishes(batch, channelName) {
  const lines = batch.map((t, i) => `${i+1}. [${t.url}] ${t.title}`).join('\n')
  const prompt = `Extract Indian home cooking recipes from these YouTube titles (channel: ${channelName}).

SKIP: vlogs, kitchen tours, equipment, drinks, sweets/desserts, non-recipe content.
INCLUDE: any genuine Indian home-cooked dish.

For each valid recipe return:
- name: clean dish name (no "recipe"/"how to make"/"easy"/"restaurant style")
- meal_pairing: "with Steamed Rice" | "with Roti" | "standalone" | "as snack" | etc
- cuisine_type: "North Indian" | "South Indian" | "Maharashtrian" | "Punjabi" | "Gujarati" | "Bengali" | "Street Food" | "Snack" | "Continental"
- complexity: "quick" | "moderate" | "elaborate"
- is_vegetarian: true | false
- tags: subset of ["high-protein","low-oil","one-pot","kid-friendly","comfort","festive","quick","healthy","street-food","breakfast","snack"]
- youtube_url: the URL in brackets

Titles:
${lines}

Return ONLY a JSON array of valid recipes (skip non-recipes). No markdown:
[{"name":"Dal Tadka","meal_pairing":"with Steamed Rice","cuisine_type":"North Indian","complexity":"moderate","is_vegetarian":true,"tags":["comfort"],"youtube_url":"https://..."}]`

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 4000 } })
  })
  if (!res.ok) { console.warn('  Gemini error:', res.status); return [] }
  const raw = (await res.json()).candidates?.[0]?.content?.parts?.[0]?.text || ''
  try { return JSON.parse(raw.replace(/^```json\s*|^```\s*|```\s*$/gm,'').trim()) || [] }
  catch { return [] }
}

// ── Step 3: deduplicate ───────────────────────────────────────────────────────
function norm(name) { return name.toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim() }

function dedup(dishes) {
  const map = new Map()
  for (const d of dishes) {
    const k = norm(d.name)
    if (!map.has(k) || (!map.get(k).youtube_url && d.youtube_url)) map.set(k, d)
  }
  return [...map.values()].sort((a,b) => a.name.localeCompare(b.name))
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🎬  GroceryMind YouTube Recipe Scraper\n')
  const all = []

  for (const ch of CHANNELS) {
    console.log(`📺  ${ch.name}`)
    const titles = await fetchTitles(ch.uploads, MAX_PER_CHANNEL)
    console.log(`    ${titles.length} videos fetched`)

    for (let i = 0; i < titles.length; i += BATCH) {
      const batch  = titles.slice(i, i + BATCH)
      const dishes = await extractDishes(batch, ch.name)
      process.stdout.write(`    batch ${Math.floor(i/BATCH)+1}/${Math.ceil(titles.length/BATCH)} → ${dishes.length} dishes\n`)
      all.push(...dishes.map(d => ({ ...d, channel: ch.name })))
      await sleep(1200) // stay well within Gemini rate limits
    }
    console.log()
    await sleep(500)
  }

  const final = dedup(all)
  console.log(`🧹  ${all.length} total → ${final.length} unique after dedup\n`)

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify({ generated_at: new Date().toISOString(), total: final.length, dishes: final }, null, 2))

  console.log(`✅  Saved to ${OUT}`)
  console.log('\nFirst 10 dishes:')
  final.slice(0,10).forEach(d => console.log(`    ${d.name.padEnd(30)} ${d.cuisine_type} · ${d.meal_pairing}`))
  console.log('\n🎉  Done! Commit lib/dishes-corpus.json to your repo.')
}

main().catch(e => { console.error(e); process.exit(1) })
