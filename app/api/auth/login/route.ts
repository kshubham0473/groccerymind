import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { verifyPassword, signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: user, error } = await supabase
    .from('users')
    .select('*, households(*)')
    .eq('username', username.toLowerCase().trim())
    .single()

  if (error || !user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const valid = verifyPassword(password, user.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = signToken({
    id: user.id,
    username: user.username,
    role: user.role,
    household_id: user.household_id,
  })

  const response = NextResponse.json({
    user: { id: user.id, username: user.username, role: user.role, household_id: user.household_id },
    household: user.households,
  })

  response.cookies.set('gm_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })

  return response
}
