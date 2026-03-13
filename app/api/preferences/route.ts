import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('households')
    .select('preferences')
    .eq('id', user.household_id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data.preferences || {})
}

export async function PATCH(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const updates = await req.json()
  const supabase = createServiceClient()

  // Merge with existing preferences
  const { data: existing } = await supabase
    .from('households')
    .select('preferences')
    .eq('id', user.household_id)
    .single()

  const merged = { ...(existing?.preferences || {}), ...updates }

  const { data, error } = await supabase
    .from('households')
    .update({ preferences: merged })
    .eq('id', user.household_id)
    .select('preferences')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data.preferences)
}
