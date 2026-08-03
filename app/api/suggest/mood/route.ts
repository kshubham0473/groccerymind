import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { getMoodNudge, buildHouseholdContext } from '@/lib/gemini'

const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']

// Time slot for nudge context
function getTimeSlot(hour: number): string {
  if (hour >= 6 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 15) return 'midday'
  if (hour >= 15 && hour < 19) return 'afternoon'
  return 'evening'
}

export async function GET(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use IST offset (UTC+5:30) so time slots are correct for Indian users
  const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const hour = nowIST.getUTCHours()
  const timeSlot = getTimeSlot(hour)
  const dayOfWeek = DAYS[new Date().getDay()]
  const supabase = createServiceClient()

  const [logsRes, prefsRes, feedbackRes] = await Promise.all([
    supabase.from('behaviour_log').select('metadata').eq('household_id', user.household_id).eq('event_type', 'cooked').order('created_at', { ascending: false }).limit(6),
    supabase.from('households').select('preferences').eq('id', user.household_id).single(),
    supabase.from('dish_feedback').select('dish_name, signal').eq('household_id', user.household_id),
  ])

  const recentlyCooked = (logsRes.data || []).map((l: any) => l.metadata?.dish_name).filter(Boolean) as string[]
  const prefs = prefsRes.data?.preferences || {}
  const feedback = feedbackRes.data || []
  const householdContext = buildHouseholdContext(prefs, feedback)

  const userName = (prefs.member_names || {})[user.username] || ''
  try {
    const nudge = await getMoodNudge({ dayOfWeek, timeSlot, recentlyCooked, householdContext, userName })
    return NextResponse.json({ nudge, timeSlot })
  } catch (e: any) {
    return NextResponse.json({ nudge: null, error: e.message })
  }
}
