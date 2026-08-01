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
