import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { hashPassword } from '@/lib/auth'

function generateCode(len = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars
  let code = ''
  for (let i = 0; i < len; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

// GET — list all invite codes for this household
export async function GET(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('household_invites')
    .select('*')
    .eq('household_id', user.household_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — create a new invite code
export async function POST(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { max_uses = 2, expires_days = 30, invite_type = 'member' } = await req.json().catch(() => ({}))
  const supabase = createServiceClient()

  const expires_at = new Date(Date.now() + expires_days * 24 * 60 * 60 * 1000).toISOString()
  const code = generateCode()

  const { data, error } = await supabase
    .from('household_invites')
    .insert({
      household_id: user.household_id,
      code,
      max_uses,
      uses_so_far: 0,
      created_by: user.id,
      expires_at,
      invite_type,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE — revoke an invite code
export async function DELETE(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await req.json()
  const supabase = createServiceClient()

  await supabase.from('household_invites').delete().eq('id', id).eq('household_id', user.household_id)
  return NextResponse.json({ success: true })
}
