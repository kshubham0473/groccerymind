'use client'
import { useState } from 'react'
import { dishImage, ThumbSize } from '@/lib/dish-image'

/**
 * Dish photograph with a typographic fallback, so a missing or dead
 * thumbnail reads as a design choice rather than a broken image.
 *
 * The fallback is a serif monogram at every size — one tile, one behaviour.
 * (2a rendered the full dish name at small sizes, which fell below the 12px
 * type floor on a 46px thumb.)
 */
export default function DishImage({
  name, youtubeUrl, height, size = 'lg', style,
}: {
  name: string
  youtubeUrl?: string | null
  height: number
  size?: ThumbSize
  style?: React.CSSProperties
}) {
  const src = dishImage(youtubeUrl, size)
  const [failed, setFailed] = useState(false)

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
      onError={() => setFailed(true)}
      style={{ height, ...style }}
    />
  )
}
