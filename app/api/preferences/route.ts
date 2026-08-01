import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('households')
    .select('preferences, name')
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

  // Pull household_name out — it updates the households.name column separately
  const { household_name, ...prefUpdates } = updates

  if (household_name) {
    await supabase
      .from('households')
      .update({ name: household_name.trim() })
      .eq('id', user.household_id)
  }

  if (Object.keys(prefUpdates).length > 0) {
    const { data: existing } = await supabase
      .from('households')
      .select('preferences')
      .eq('id', user.household_id)
      .single()

    const merged = { ...(existing?.preferences || {}), ...prefUpdates }

    const { data, error } = await supabase
      .from('households')
      .update({ preferences: merged })
      .eq('id', user.household_id)
      .select('preferences')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data.preferences)
  }

  return NextResponse.json({ success: true })
}
