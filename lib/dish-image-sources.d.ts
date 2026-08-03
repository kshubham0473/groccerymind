/** Types for lib/dish-image-sources.js (plain CJS, shared with scripts/). */

export type ImageSource = 'wikimedia' | 'youtube' | 'corpus'

export interface ResolvedDishImage {
  image_url: string
  image_source: ImageSource
  image_attribution?: string | null
  /** Only ever set by the youtube tier — a real recipe video for THIS dish. */
  youtube_url?: string
  matched_title?: string
  borrowed_from?: string
  confidence?: number
}

export interface ResolveOptions {
  youtubeApiKey?: string | null
  corpus?: Array<{ name: string; youtube_url?: string }> | null
  tiers?: ImageSource[]
}

export function resolveDishImage(
  name: string,
  opts?: ResolveOptions
): Promise<ResolvedDishImage | null>

export function fromWikimedia(name: string): Promise<ResolvedDishImage | null>
export function fromYouTube(name: string, apiKey?: string | null): Promise<ResolvedDishImage | null>
export function fromCorpus(
  name: string,
  corpus: Array<{ name: string; youtube_url?: string }>,
  minJaccard?: number
): ResolvedDishImage | null

export function tokeniseName(name: string): string[]
export function jaccard(a: string[], b: string[]): number
export function conflicts(a: string[], b: string[]): boolean
export function nameKey(name: string): string
export function youtubeIdFromUrl(url?: string | null): string | null
