import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { getMoodNudge, buildHouseholdContext } from '@/lib/gemini'

const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']

export async function GET(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const dayOfWeek = DAYS[new Date().getDay()]

  const [logsRes, prefsRes, feedbackRes] = await Promise.all([
    supabase.from('behaviour_log').select('metadata').eq('household_id', user.household_id).eq('event_type', 'cooked').order('created_at', { ascending: false }).limit(6),
    supabase.from('households').select('preferences').eq('id', user.household_id).single(),
    supabase.from('dish_feedback').select('dish_name, signal').eq('household_id', user.household_id),
  ])

  const recentlyCooked = (logsRes.data || []).map(l => l.metadata?.dish_name).filter(Boolean) as string[]
  const prefs = prefsRes.data?.preferences || {}
  const feedback = feedbackRes.data || []
  const householdContext = buildHouseholdContext(prefs, feedback)

  try {
    const nudge = await getMoodNudge({ dayOfWeek, recentlyCooked, householdContext })
    return NextResponse.json({ nudge })
  } catch (e: any) {
    return NextResponse.json({ nudge: null, error: e.message })
  }
}
