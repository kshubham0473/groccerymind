import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

// GET /api/log/summary — returns behaviour_log events for dashboard insights
export async function GET(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  // Last 30 days of events — enough for all insight computations
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('behaviour_log')
    .select('event_type, metadata, created_at')
    .eq('household_id', user.household_id)
    .gte('created_at', since)
    .in('event_type', ['cooked', 'meal_locked', 'discover_prompt'])
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json([], { status: 200 }) // fail silently — insights are non-critical
  return NextResponse.json(data || [])
}
