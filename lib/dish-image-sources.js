/**
 * lib/dish-image-sources.js
 *
 * The dish-image resolution ladder. Plain CommonJS with zero dependencies so
 * that BOTH the Next.js server (lib/dish-image-resolver.ts) and the offline
 * backfill script (scripts/backfill-dish-images.js) run the exact same matching
 * rules. Do not fork this logic — change it here and both callers follow.
 *
 * The ladder, most-accurate first:
 *
 *   1. wikimedia — Wikipedia/Commons lead image for the dish's own article.
 *                  Free, no key, no quota. Clean plated photography.
 *   2. youtube   — YouTube Data API search. Costs 100 quota units per call
 *                  (≈100/day on the free tier) but returns a real recipe link
 *                  as well as a thumbnail.
 *   3. corpus    — borrow the thumbnail of a near-identical corpus dish that
 *                  already has one. Free and instant, but APPROXIMATE: it is
 *                  another dish's photo, so it only ever fills image_url and
 *                  must never be written to youtube_url.
 *   4. null      — caller falls back to the typographic monogram.
 *
 * IMPORTANT SEPARATION: image_url is "a picture to show". youtube_url is "a
 * recipe you can watch". They used to be the same field, which is why filling
 * images previously meant inventing fake recipe links. Only tier 2 is allowed
 * to set youtube_url.
 */

'use strict'

// ── Shared name vocabulary ────────────────────────────────────────────────────
// Kept in sync with scripts/enrich-corpus.js. If you add a protein or format
// word there, add it here too.

const NAME_STOP = new Set([
  'with', 'in', 'of', 'the', 'a', 'an', 'and', 'style', 'recipe', 'easy', 'quick',
  'simple', 'spicy', 'authentic', 'homemade', 'restaurant', 'street', 'instant',
  'crispy', 'how', 'to', 'make', 'fresh', 'special', 'classic', 'traditional',
  'veg', 'punjabi', 'south', 'north', 'indian', 'thai', 'chinese', 'goan',
  'masala', 'sabzi', 'sabji', 'curry', 'gravy', 'tadka', 'bhuna',
  'do', 'ki', 'ka', 'ke', 'da', 'de', 'wali', 'wale', 'waali', 'waale',
])

const DISH_PROTEINS = new Set([
  'paneer', 'chicken', 'murgh', 'mutton', 'egg', 'anda', 'prawn', 'fish', 'tofu', 'soya',
  'lamb', 'keema', 'mince', 'chole', 'rajma', 'moong', 'chana', 'gobi', 'bhindi',
  'aloo', 'baingan', 'palak', 'methi', 'lauki', 'tinda', 'arbi', 'suran',
])

const DISH_FORMATS = new Set([
  'biryani', 'paratha', 'sandwich', 'wrap', 'roll', 'kebab', 'kabab', 'kofta',
  'tikka', 'dosa', 'idli', 'vada', 'pakoda', 'pakora', 'poori', 'puri', 'bhature',
  'chaat', 'pulao', 'khichdi', 'soup', 'upma', 'halwa', 'bun', 'momo', 'pizza',
  'burger', 'noodles', 'pasta', 'rice', 'roti',
])

// ── Transliteration variants ──────────────────────────────────────────────────
// Hindi dish names have no fixed English spelling, so the same dish arrives as
// "Moong daal chilla", "Moong Dal Chilla" and "Moong Dhal Cheela". Measured
// against the live database, spelling alone was costing real matches:
// "Gobhi paratha" resolved while "Gobi Paratha" did not.
//
// SCOPE: this map is used ONLY for image matching. It is deliberately not
// wired into corpus dedup or Discover search — collapsing spellings is safe
// when the worst case is a slightly-wrong photograph, and unsafe when the
// worst case is deleting a dish from the corpus.
//
// Everything here must be a genuine spelling variant of the SAME ingredient.
// Near-neighbours that are actually different foods stay separate — notably
// tinda (apple gourd) vs tindli (ivy gourd), which are not interchangeable.
const VARIANTS = new Map(Object.entries({
  // lentils & pulses
  daal: 'dal', dhal: 'dal', dail: 'dal',
  // NOTE: canonical forms must match the spellings used in DISH_PROTEINS and
  // DISH_FORMATS below, or the conflict guard stops recognising them. That is
  // why these fold TO "moong", not to "mung".
  mung: 'moong',
  chhole: 'chole', channa: 'chana', chholay: 'chole', cholay: 'chole',
  rajmah: 'rajma',
  masur: 'masoor',
  // vegetables
  gobhi: 'gobi', gobbi: 'gobi',
  pyaaz: 'pyaz', pyaj: 'pyaz', piyaz: 'pyaz', pyaza: 'pyaz',
  alu: 'aloo', aalu: 'aloo', aloo: 'aloo',
  bhendi: 'bhindi', bhinda: 'bhindi',
  begun: 'baingan', brinjal: 'baingan', baigan: 'baingan',
  louki: 'lauki', ghiya: 'lauki', doodhi: 'lauki',
  arvi: 'arbi',
  tinde: 'tinda',
  toorai: 'turai', tori: 'turai',
  matar: 'mutter', mattar: 'mutter',
  // dairy & protein
  panir: 'paneer',
  kheema: 'keema', qeema: 'keema',
  aanda: 'anda',
  // grains & formats
  parantha: 'paratha', paranthaa: 'paratha',
  cheela: 'chilla', chila: 'chilla', cheela_: 'chilla',
  sooji: 'suji', rawa: 'rava',
  pulav: 'pulao', pilaf: 'pulao',
  biriyani: 'biryani', biriani: 'biryani',
  kadhi: 'kadi', karhi: 'kadi',
  pohe: 'poha',
  tava: 'tawa',
  rotti: 'roti',
}))

/** Fold a token onto its canonical spelling. Unknown tokens pass through. */
function canonicalToken(t) {
  return VARIANTS.get(t) || t
}

function tokeniseName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
    .filter(t => t.length > 1 && !NAME_STOP.has(t))
    .map(canonicalToken)
    // A variant can fold onto a stop word (e.g. "sabji" → "sabzi"), so filter
    // once more after folding.
    .filter(t => !NAME_STOP.has(t))
}

// Purely grammatical words — no dish identity in them at any length.
const RAW_NOISE = new Set([
  'with', 'in', 'of', 'the', 'a', 'an', 'and', 'ki', 'ka', 'ke', 'da', 'de', 'do',
  'style', 'recipe', 'how', 'to', 'make', 'homemade', 'easy',
])

/**
 * Tokenise KEEPING words like "curry", "masala" and "sabzi".
 *
 * NAME_STOP drops those, which is correct for deduplication — there both names
 * are reduced the same way and the remaining tokens carry identity. It is
 * dangerous for image borrowing, because a two-word name collapses to one
 * token and then matches anything: "Chicken Curry" reduces to ["chicken"] and
 * happily borrows the photo of a dish literally called "Chicken".
 */
function rawTokens(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
    .filter(t => t.length > 1 && !RAW_NOISE.has(t))
    .map(canonicalToken)
}

function jaccard(a, b) {
  const sa = new Set(a), sb = new Set(b)
  if (!sa.size || !sb.size) return 0
  let inter = 0
  for (const t of sa) if (sb.has(t)) inter++
  return inter / (sa.size + sb.size - inter)
}

/** True when two names disagree on protein or format — never the same dish. */
function conflicts(ta, tb) {
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

/** Normalised cache key — "Veg  Pad-Thai " and "veg pad thai" collide. */
function nameKey(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

// ── Tier 1: Wikimedia ─────────────────────────────────────────────────────────

const WIKI_API = 'https://en.wikipedia.org/w/api.php'

// A dish name can collide with a film, album or surname ("Ramen", "Bibimbap"
// are safe; "Tacos" and "Waffles" are not always). Reject on the short
// description rather than trusting the title match alone.
const NOT_FOOD_RE =
  /\b(film|movie|album|song|single|band|musician|singer|actor|actress|novel|book|video game|manga|anime series|tv series|television|surname|given name|footballer|politician|municipality|village|town|river|company|software)\b/i

// Wikipedia's own placeholder / non-photographic lead images.
const BAD_IMAGE_RE = /(logo|icon|symbol|map|flag|coat_of_arms|disambig|question_book|\.svg$)/i

async function fetchJson(url, timeoutMs = 8000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        // Wikimedia requires a descriptive UA with contact info.
        'User-Agent': 'GroceryMind/1.0 (https://github.com/kshubham0473/groccerymind)',
        'Accept': 'application/json',
      },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Look up one exact Wikipedia title (following redirects). */
async function wikiByTitle(title) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    redirects: '1',
    prop: 'pageimages|description',
    piprop: 'original|thumbnail',
    pithumbsize: '800',
    titles: title,
  })
  const data = await fetchJson(`${WIKI_API}?${params}`)
  const page = data && data.query && data.query.pages && data.query.pages[0]
  if (!page || page.missing) return null
  if (page.description && NOT_FOOD_RE.test(page.description)) return null

  // Prefer the 800px thumbnail — `original` on Commons is routinely 4000px and
  // several MB, which is not something to put on a phone on Indian mobile data.
  const img = (page.thumbnail && page.thumbnail.source) ||
              (page.original && page.original.source)
  if (!img || BAD_IMAGE_RE.test(img)) return null

  return {
    image_url: img,
    image_source: 'wikimedia',
    image_attribution: `Wikimedia Commons — ${page.title}`,
    matched_title: page.title,
  }
}

/** Full-text search fallback, guarded by token overlap with the dish name. */
async function wikiBySearch(name) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrsearch: `${name} dish food`,
    gsrlimit: '3',
    prop: 'pageimages|description',
    piprop: 'original|thumbnail',
    pithumbsize: '800',
  })
  const data = await fetchJson(`${WIKI_API}?${params}`)
  const pages = (data && data.query && data.query.pages) || []
  const wanted = tokeniseName(name)

  for (const page of pages) {
    if (page.description && NOT_FOOD_RE.test(page.description)) continue
    const got = tokeniseName(page.title)
    // The article must actually be about this dish, not merely mention it.
    if (!got.length || jaccard(wanted, got) < 0.5) continue
    if (conflicts(wanted, got)) continue
    const img = (page.thumbnail && page.thumbnail.source) ||
                (page.original && page.original.source)
    if (!img || BAD_IMAGE_RE.test(img)) continue
    return {
      image_url: img,
      image_source: 'wikimedia',
      image_attribution: `Wikimedia Commons — ${page.title}`,
      matched_title: page.title,
    }
  }
  return null
}

/**
 * Tier 1. Tries the dish's own name, then its de-prefixed base name.
 *
 * The base-name attempt is what rescues "Veg Bibimbap" → Bibimbap and
 * "Chicken Ramen" → Ramen. Note tokeniseName() drops "veg" as a stop word but
 * KEEPS "chicken", so a chicken variant only falls back to the base article
 * when no chicken-specific article exists — and conflicts() still guards the
 * search path.
 */
async function fromWikimedia(name) {
  const direct = await wikiByTitle(name)
  if (direct) return direct

  const base = tokeniseName(name).join(' ')
  if (base && nameKey(base) !== nameKey(name)) {
    const viaBase = await wikiByTitle(base)
    if (viaBase) return { ...viaBase, image_source: 'wikimedia' }
  }

  return await wikiBySearch(name)
}

// ── Tier 2: YouTube Data API ──────────────────────────────────────────────────

// Mirrors the pre-filters in scripts/scrape-youtube-dishes.js — we do not want
// a playlist compilation or a shorts-farm title standing in for a dish.
const BAD_VIDEO_TITLE_RE =
  /(\b\d+\s*(recipes?|dishes|ideas|types)\b|top\s*\d+|playlist|compilation|collection|shorts?\b|challenge|mukbang|vlog|asmr)/i

/**
 * Tier 2. Returns a thumbnail AND a genuine recipe link.
 * Requires YOUTUBE_API_KEY. search.list costs 100 quota units per call, so the
 * free tier allows roughly 100 new dishes per day — hence the caching layer.
 */
async function fromYouTube(name, apiKey) {
  if (!apiKey) return null

  const params = new URLSearchParams({
    key: apiKey,
    part: 'snippet',
    q: `${name} recipe`,
    type: 'video',
    maxResults: '5',
    regionCode: 'IN',
    relevanceLanguage: 'en',
    safeSearch: 'strict',
    videoEmbeddable: 'true',
  })
  const data = await fetchJson(`https://www.googleapis.com/youtube/v3/search?${params}`)
  const items = (data && data.items) || []
  const wanted = tokeniseName(name)

  for (const item of items) {
    const title = (item.snippet && item.snippet.title) || ''
    const id = item.id && item.id.videoId
    if (!id || title.length > 200) continue
    if (BAD_VIDEO_TITLE_RE.test(title)) continue
    // Combo titles ("Aloo Paratha, Gobi Paratha, Paneer Paratha") — same rule
    // the scraper uses.
    if ((title.match(/,/g) || []).length >= 2) continue
    // The video must be about this dish.
    const got = tokeniseName(title)
    if (!wanted.length || !wanted.some(t => got.includes(t))) continue
    if (conflicts(wanted, got)) continue

    return {
      image_url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      image_source: 'youtube',
      image_attribution: null,
      // Tier 2 is the ONLY tier permitted to set this.
      youtube_url: `https://www.youtube.com/watch?v=${id}`,
      matched_title: title,
    }
  }
  return null
}

// ── Tier 3: corpus neighbour ──────────────────────────────────────────────────

const ID_RE = /^[A-Za-z0-9_-]{11}$/

/** Duplicated from lib/dish-image.ts so this module stays dependency-free. */
function youtubeIdFromUrl(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    const v = u.searchParams.get('v')
    if (v && ID_RE.test(v)) return v
    if (u.hostname.endsWith('youtu.be')) {
      const id = u.pathname.slice(1)
      return ID_RE.test(id) ? id : null
    }
    for (const key of u.searchParams.keys()) if (ID_RE.test(key)) return key
  } catch { /* not a URL */ }
  return null
}

/**
 * Tier 3. Borrow the thumbnail of a corpus dish that is near-identical by name.
 *
 * Uses the same two-signal test as the corpus deduplication (shared tokens +
 * Jaccard, rejected on protein/format disagreement) rather than embeddings —
 * embeddings conflate "related" with "the same dish", which is exactly the
 * mistake that collapsed Palak Paneer into Palak Chicken.
 *
 * Deliberately conservative: a wrong photo is worse than a monogram, because
 * the whole product rests on trusting the suggestion.
 */
function fromCorpus(name, corpus, minJaccard = 0.7, minRawJaccard = 0.6) {
  const wanted = tokeniseName(name)
  const wantedRaw = rawTokens(name)
  if (!wanted.length) return null

  let best = null
  let bestScore = 0

  for (const dish of corpus || []) {
    // Borrow from anything that HAS a picture — a corpus dish backfilled with a
    // Wikimedia photo is just as good a source as one with a video thumbnail.
    // (Checking youtube_url alone meant "Palak Paneer" typed by a user couldn't
    // borrow from corpus Palak Paneer, because that entry is itself one of the
    // videoless 96.)
    if (!dish || (!dish.youtube_url && !dish.image_url)) continue
    const got = tokeniseName(dish.name)
    if (!got.length) continue

    const shared = wanted.filter(t => got.includes(t)).length
    // Single-token names ("Poha", "Dhokla") can match on one token; anything
    // longer needs two, so "Egg Curry" can't borrow from "Chicken Curry".
    const needed = Math.min(2, wanted.length)
    if (shared < needed) continue

    const j = jaccard(wanted, got)
    if (j < minJaccard) continue
    if (conflicts(wanted, got)) continue

    // Second signal on the unreduced names. This is what stops
    // "Chicken Curry" → "Chicken" and "Chana Masala" → "Chana", where the
    // stop-word pass had thrown away the only distinguishing word.
    const jRaw = jaccard(wantedRaw, rawTokens(dish.name))
    if (jRaw < minRawJaccard) continue

    if (j > bestScore) { bestScore = j; best = dish }
  }

  if (!best) return null

  // Prefer an already-resolved photo over re-deriving a video thumbnail.
  let borrowedUrl = best.image_url || null
  if (!borrowedUrl) {
    const id = youtubeIdFromUrl(best.youtube_url)
    if (!id) return null
    borrowedUrl = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
  }

  return {
    image_url: borrowedUrl,
    image_source: 'corpus',
    image_attribution: best.image_attribution || null,
    // NOT a recipe for THIS dish — never surface it as one.
    matched_title: best.name,
    borrowed_from: best.name,
    confidence: Number(bestScore.toFixed(3)),
  }
}

// ── The ladder ────────────────────────────────────────────────────────────────

/**
 * Resolve an image for one dish.
 *
 * @param {string} name
 * @param {object} [opts]
 * @param {string|null} [opts.youtubeApiKey]  omit to skip tier 2
 * @param {Array}       [opts.corpus]         corpus dishes, omit to skip tier 3
 * @param {string[]}    [opts.tiers]          override order, e.g. ['wikimedia']
 * @returns {Promise<object|null>}
 */
async function resolveDishImage(name, opts = {}) {
  const {
    youtubeApiKey = null,
    corpus = null,
    tiers = ['wikimedia', 'youtube', 'corpus'],
  } = opts

  if (!name || !String(name).trim()) return null

  for (const tier of tiers) {
    let hit = null
    if (tier === 'wikimedia') hit = await fromWikimedia(name)
    else if (tier === 'youtube') hit = await fromYouTube(name, youtubeApiKey)
    else if (tier === 'corpus') hit = corpus ? fromCorpus(name, corpus) : null
    if (hit && hit.image_url) return hit
  }
  return null
}

module.exports = {
  resolveDishImage,
  fromWikimedia,
  fromYouTube,
  fromCorpus,
  tokeniseName,
  rawTokens,
  jaccard,
  conflicts,
  nameKey,
  youtubeIdFromUrl,
}
