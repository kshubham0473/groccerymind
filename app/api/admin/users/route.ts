import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie, hashPassword } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, username, role, created_at')
    .eq('household_id', user.household_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { username, password, role = 'member' } = await req.json()
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('users')
    .insert({
      household_id: user.household_id,
      username: username.toLowerCase().trim(),
      password_hash: hashPassword(password),
      role,
    })
    .select('id, username, role, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
