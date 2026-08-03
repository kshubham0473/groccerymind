'use client'
import { useState } from 'react'
import { dishPicture, ThumbSize } from '@/lib/dish-image'

/**
 * Dish photograph with a typographic fallback, so a missing or dead
 * thumbnail reads as a design choice rather than a broken image.
 *
 * The fallback is a serif monogram at every size — one tile, one behaviour.
 * (2a rendered the full dish name at small sizes, which fell below the 12px
 * type floor on a 46px thumb.)
 */
export default function DishImage({
  name, youtubeUrl, imageUrl, height, size = 'lg', style,
}: {
  name: string
  /** Recipe video, if the dish has one. Used as the image of last resort. */
  youtubeUrl?: string | null
  /** Resolved photograph (Wikimedia / searched video / borrowed). Wins. */
  imageUrl?: string | null
  height: number
  size?: ThumbSize
  style?: React.CSSProperties
}) {
  const src = dishPicture({ image_url: imageUrl, youtube_url: youtubeUrl }, size)

  // Track WHICH src died rather than a boolean. Images now arrive after the
  // dish does (background resolution), and rows get reused as lists reorder —
  // a plain flag would wrongly blank out the replacement image.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const failed = !!src && failedSrc === src

  if (!src || failed) {
    return (
      <div
        className="dish-fallback"
        style={{ height, fontSize: Math.round(height * 0.38), ...style }}
        aria-label={name}
      >
        {(name || '?').trim().charAt(0).toUpperCase()}
      </div>
    )
  }

  return (
    <img
      className="dish-img"
      src={src}
      alt={name}
      height={height}
      loading="lazy"
      onError={() => setFailedSrc(src)}
      style={{ height, ...style }}
    />
  )
}
