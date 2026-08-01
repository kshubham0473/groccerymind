'use client'
import { useState } from 'react'
import { dishImage, ThumbSize } from '@/lib/dish-image'

/**
 * Dish photograph with a typographic fallback, so a missing or dead
 * thumbnail reads as a design choice rather than a broken image.
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
        style={{ height, fontSize: height > 100 ? 22 : 13, ...style }}
        aria-label={name}
      >
        {name}
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
