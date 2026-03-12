import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const results: Record<string, any> = {}

  // Check env vars (just presence, not values)
  results.env = {
    SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    JWT_SECRET: !!process.env.JWT_SECRET,
    GEMINI_KEY: !!process.env.GEMINI_API_KEY,
  }

  // Check auth
  const user = getSessionFromCookie(req.headers.get('cookie'))
  results.auth = user ? { ok: true, household_id: user.household_id } : { ok: false }

  // Check DB connection
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('meal_slots')
      .select('id')
      .limit(1)
    results.db = error ? { ok: false, error: error.message } : { ok: true, rows: data?.length }
  } catch (e: any) {
    results.db = { ok: false, error: e.message }
  }

  // Check Gemini directly
  try {
    const apiKey = process.env.GEMINI_API_KEY
    const model = 'gemini-2.5-flash-lite-preview-06-17'
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Reply with just the word: working' }] }],
          generationConfig: { maxOutputTokens: 10 }
        })
      }
    )
    const data = await res.json()
    results.gemini = res.ok
      ? { ok: true, response: data.candidates?.[0]?.content?.parts?.[0]?.text }
      : { ok: false, status: res.status, error: JSON.stringify(data) }
  } catch (e: any) {
    results.gemini = { ok: false, error: e.message }
  }

  return NextResponse.json(results)
}
