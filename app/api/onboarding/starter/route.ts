import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { getStarterDishes } from '@/lib/gemini'

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

  // ── DIAGNOSTIC BLOCK — remove after debugging ──────────────────────────────
  const fs   = require('fs')
  const path = require('path')
  const cwd  = process.cwd()
  const metaPath = path.join(cwd, 'lib', 'dishes-meta.json')
  const embPath  = path.join(cwd, 'lib', 'dishes-embeddings.json')
  const diag = {
    cwd,
    metaPath,
    metaExists:  fs.existsSync(metaPath),
    embExists:   fs.existsSync(embPath),
    metaSize:    fs.existsSync(metaPath)  ? fs.statSync(metaPath).size  : null,
    embSize:     fs.existsSync(embPath)   ? fs.statSync(embPath).size   : null,
    libContents: fs.existsSync(path.join(cwd, 'lib')) ? fs.readdirSync(path.join(cwd, 'lib')) : 'lib/ missing',
    prefs_keys:  Object.keys(prefs),
    gemini_key:  !!process.env.GEMINI_API_KEY,
  }
  console.log('[starter/diag]', JSON.stringify(diag))

  if (req.nextUrl.searchParams.get('diag') === '1') {
    return NextResponse.json({ diag })
  }
  // ── END DIAGNOSTIC BLOCK ───────────────────────────────────────────────────

  try {
    const dishes = await getStarterDishes({ householdContext: '', prefs })
    if (!dishes.length) {
      return NextResponse.json({
        dishes: [],
        no_corpus: true,
        message: 'Recipe library not found. Please run the scraper script first.'
      })
    }
    return NextResponse.json({ dishes })
  } catch (e: any) {
    return NextResponse.json({ dishes: [], error: e.message })
  }
}