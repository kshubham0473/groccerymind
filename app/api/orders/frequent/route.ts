import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

// GET — return top 8 most frequently ordered item names in last 60 days
export async function GET(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('order_items')
    .select('item_name')
    .eq('household_id', user.household_id)
    .in('status', ['ordered'])
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error || !data?.length) return NextResponse.json([])

  // Count by normalised name
  const counts: Record<string, { count: number; display: string }> = {}
  for (const row of data) {
    const norm = row.item_name.toLowerCase().trim()
    if (!counts[norm]) counts[norm] = { count: 0, display: row.item_name }
    counts[norm].count++
  }

  const sorted = Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map(c => c.display)

  return NextResponse.json(sorted)
}
