/**
 * lib/dish-image-resolver.ts — server only.
 *
 * Wraps the shared ladder in lib/dish-image-sources.js with the two things the
 * running app needs and the offline script does not:
 *
 *   1. A GLOBAL cache (`dish_images`, keyed on normalised dish name). Two
 *      households both adding "Aloo Methi" must cost one lookup, ever. This is
 *      what keeps the YouTube tier inside its ~100 lookups/day free quota.
 *   2. Fire-and-forget execution. Resolving an image must NEVER sit in front of
 *      a user locking a meal — that is the exact friction the product exists to
 *      remove. The dish row is written immediately with no image; the picture
 *      lands a second or two later and shows on the next render.
 *
 * Everything here fails soft. If Wikipedia is down, if the table is missing, if
 * the API key is absent — the dish still saves and the user sees the monogram.
 */

import { createServiceClient } from '@/lib/supabase'
import { loadFullCorpus } from '@/lib/corpus-utils'
import {
  resolveDishImage,
  nameKey,
  type ResolvedDishImage,
} from '@/lib/dish-image-sources'

/** Re-lookup a miss after this long — Wikipedia gains articles over time. */
const NEGATIVE_TTL_DAYS = 30

/** Per-instance memo, so a burst of inserts in one request hits the DB once. */
const memo = new Map<string, ResolvedDishImage | null>()

type CacheRow = {
  name_key: string
  image_url: string | null
  image_source: string | null
  image_attribution: string | null
  youtube_url: string | null
  resolved_at: string | null
}

function rowToResolved(row: CacheRow): ResolvedDishImage | null {
  if (!row.image_url) return null
  return {
    image_url: row.image_url,
    image_source: (row.image_source || 'wikimedia') as ResolvedDishImage['image_source'],
    image_attribution: row.image_attribution,
    ...(row.youtube_url ? { youtube_url: row.youtube_url } : {}),
  }
}

function isStale(resolvedAt: string | null): boolean {
  if (!resolvedAt) return true
  const age = Date.now() - new Date(resolvedAt).getTime()
  return age > NEGATIVE_TTL_DAYS * 24 * 60 * 60 * 1000
}

/**
 * Resolve an image for a dish name, consulting and populating the global cache.
 * Returns null when no tier produced a usable photo.
 */
export async function resolveWithCache(name: string): Promise<ResolvedDishImage | null> {
  const key = nameKey(name)
  if (!key) return null
  if (memo.has(key)) return memo.get(key)!

  const supabase = createServiceClient()

  // ── Cache read ──────────────────────────────────────────────────────────────
  try {
    const { data } = await supabase
      .from('dish_images')
      .select('*')
      .eq('name_key', key)
      .maybeSingle()

    if (data) {
      const row = data as CacheRow
      // A cached hit is always good. A cached MISS is only trusted until the TTL
      // expires, so dishes that were unknown last month get another chance.
      if (row.image_url || !isStale(row.resolved_at)) {
        const hit = rowToResolved(row)
        memo.set(key, hit)
        return hit
      }
    }
  } catch {
    // Table not migrated yet — carry on and resolve live.
  }

  // ── Live resolve ────────────────────────────────────────────────────────────
  let hit: ResolvedDishImage | null = null
  try {
    hit = await resolveDishImage(name, {
      youtubeApiKey: process.env.YOUTUBE_API_KEY || null,
      corpus: loadFullCorpus(),
    })
  } catch {
    hit = null
  }

  // ── Cache write (negative results included) ─────────────────────────────────
  try {
    await supabase.from('dish_images').upsert({
      name_key: key,
      name,
      image_url: hit?.image_url ?? null,
      image_source: hit?.image_source ?? null,
      image_attribution: hit?.image_attribution ?? null,
      youtube_url: hit?.youtube_url ?? null,
      resolved_at: new Date().toISOString(),
    }, { onConflict: 'name_key' })
  } catch {
    // Non-fatal — we just lose the caching benefit for this name.
  }

  memo.set(key, hit)
  return hit
}

/**
 * Resolve images for freshly-inserted dishes and patch the rows in place.
 *
 * Call this WITHOUT awaiting from a request handler. It is intentionally
 * detached: the response has already gone back to the user by the time this
 * runs, and any failure is swallowed.
 *
 * Note on serverless: on Vercel a detached promise may be cut short when the
 * function freezes. That is acceptable here — the miss is not cached, so the
 * next backfill run or the next insert of the same name picks it up. If this
 * turns out to drop too many, promote it to `waitUntil()` from
 * `@vercel/functions`, which keeps the instance alive for background work.
 */
export function backfillDishImages(
  dishes: Array<{ id: string; name: string; youtube_url?: string | null }>
): void {
  const pending = (dishes || []).filter(d => d?.id && d?.name)
  if (!pending.length) return

  void (async () => {
    const supabase = createServiceClient()
    for (const dish of pending) {
      try {
        const hit = await resolveWithCache(dish.name)
        if (!hit) continue

        const patch: Record<string, unknown> = {
          image_url: hit.image_url,
          image_source: hit.image_source,
          image_attribution: hit.image_attribution ?? null,
          image_checked_at: new Date().toISOString(),
        }
        // Only the youtube tier yields a recipe for THIS dish, and we never
        // overwrite a link the dish already had.
        if (hit.youtube_url && !dish.youtube_url) patch.youtube_url = hit.youtube_url

        await supabase.from('dishes').update(patch).eq('id', dish.id)
      } catch {
        // Next insert or the backfill script will retry.
      }
    }
  })()
}
