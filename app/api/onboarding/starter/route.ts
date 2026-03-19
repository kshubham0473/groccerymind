import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { loadFullCorpus, applyHardFilters, embedBatch, findNearest } from '@/lib/corpus-utils'
import { getStarterDishes, callGeminiRaw, cleanJson } from '@/lib/gemini'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('households')
    .select('preferences')
    .eq('id', user.household_id)
    .single()

  const prefs = data?.preferences || {}

  // ── STEP-BY-STEP DIAGNOSTIC ────────────────────────────────────────────────
  if (req.nextUrl.searchParams.get('diag') === '2') {
    const diag: any = {}

    // Step 1: corpus load
    const corpus = loadFullCorpus()
    diag.corpus_length = corpus.length
    diag.corpus_sample = corpus.slice(0, 2).map(d => ({ name: d.name, _id: (d as any)._id }))

    // Step 2: hard filters
    const filtered = applyHardFilters(corpus, prefs)
    diag.filtered_length = filtered.length
    diag.prefs_dietary = prefs.dietary
    diag.prefs_dislikes = prefs.dislikes

    // Step 3: Gemini name call
    try {
      const raw = await callGeminiRaw('Return ONLY this JSON, nothing else: ["Dal Tadka","Poha","Rajma"]')
      diag.gemini_raw = raw.slice(0, 200)
      diag.gemini_parsed = JSON.parse(cleanJson(raw))
    } catch (e: any) {
      diag.gemini_error = e.message
    }

    // Step 4: single embedding call
    try {
      const embs = await embedBatch(['Dal Tadka'])
      diag.embedding_length = embs[0]?.length ?? 0
      diag.embedding_sample = embs[0]?.slice(0, 3)
    } catch (e: any) {
      diag.embedding_error = e.message
    }

    // Step 5: findNearest on one embedding (if we got one)
    if (diag.embedding_length > 0 && filtered.length > 0) {
      try {
        const embs = await embedBatch(['Dal Tadka'])
        const nearest = findNearest(embs[0], filtered, 3)
        diag.nearest = nearest.map(n => ({ name: n.dish.name, score: n.score }))
      } catch (e: any) {
        diag.nearest_error = e.message
      }
    }

    console.log('[starter/diag2]', JSON.stringify(diag))
    return NextResponse.json({ diag })
  }
  // ── END DIAGNOSTIC ─────────────────────────────────────────────────────────

  try {
    const dishes = await getStarterDishes({ householdContext: '', prefs })
    if (!dishes.length) {
      return NextResponse.json({ dishes: [], no_corpus: true, message: 'Recipe library not found.' })
    }
    return NextResponse.json({ dishes })
  } catch (e: any) {
    return NextResponse.json({ dishes: [], error: e.message })
  }
}