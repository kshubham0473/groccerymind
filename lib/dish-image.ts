/**
 * YouTube thumbnails from the corpus — no API key, no quota, no storage.
 *
 * Handles the malformed rows in dishes-corpus.json (roughly 1 in 12):
 *   "https://www.youtube.com/watch?ml9iYadIJJ0"   ← missing v=
 *   "https://www.youtube.com/watch?v=abc123"      ← normal
 *   "https://youtu.be/abc123"
 */

const ID_RE = /^[A-Za-z0-9_-]{11}$/

export function youtubeId(url?: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    const v = u.searchParams.get('v')
    if (v && ID_RE.test(v)) return v
    // youtu.be/<id>
    if (u.hostname.endsWith('youtu.be')) {
      const id = u.pathname.slice(1)
      return ID_RE.test(id) ? id : null
    }
    // watch?<id> — malformed: the id landed as a bare query key
    for (const key of u.searchParams.keys()) {
      if (ID_RE.test(key)) return key
    }
  } catch { /* not a URL */ }
  return null
}

export type ThumbSize = 'sm' | 'lg'

/** hqdefault is 480×360 (4:3, letterboxed) — always crop with object-fit: cover. */
export function dishImage(url?: string | null, size: ThumbSize = 'lg'): string | null {
  const id = youtubeId(url)
  if (!id) return null
  return `https://i.ytimg.com/vi/${id}/${size === 'sm' ? 'mqdefault' : 'hqdefault'}.jpg`
}

/**
 * The one place that decides what picture a dish shows.
 *
 * `image_url` is a resolved photograph (Wikimedia, a searched YouTube video, or
 * a borrowed corpus thumbnail) and always wins — it is the more deliberate
 * answer. `youtube_url` remains the fallback so the ~950 corpus dishes that
 * already work keep working with no data migration.
 *
 * A stored ytimg URL is re-derived at the requested size, so small thumbnails
 * don't download a 480×360 image for a 46px tile.
 */
export function dishPicture(
  dish?: { image_url?: string | null; youtube_url?: string | null } | null,
  size: ThumbSize = 'lg'
): string | null {
  if (!dish) return null

  const stored = dish.image_url?.trim()
  if (stored) {
    const ytimg = stored.match(/^https:\/\/i\.ytimg\.com\/vi\/([A-Za-z0-9_-]{11})\//)
    if (ytimg) {
      return `https://i.ytimg.com/vi/${ytimg[1]}/${size === 'sm' ? 'mqdefault' : 'hqdefault'}.jpg`
    }
    return stored
  }

  return dishImage(dish.youtube_url, size)
}
