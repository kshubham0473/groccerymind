import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { hashPassword, signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { code, username, password } = await req.json()
  if (!code || !username || !password) {
    return NextResponse.json({ error: 'Code, username, and password are required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Validate invite
  const { data: invite, error: inviteError } = await supabase
    .from('household_invites')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .single()

  if (inviteError || !invite) return NextResponse.json({ error: 'Invalid invite code' }, { status: 400 })
  if (invite.uses_so_far >= invite.max_uses) return NextResponse.json({ error: 'This invite has already been used the maximum number of times' }, { status: 400 })
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: 'This invite code has expired' }, { status: 400 })

  // Check username not taken globally
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('username', username.toLowerCase().trim())
    .single()
  if (existing) return NextResponse.json({ error: 'Username already taken' }, { status: 400 })

  const password_hash = hashPassword(password)
  const cleanUsername = username.toLowerCase().trim()
  const inviteType = invite.invite_type || 'member'

  let householdId: string
  let householdData: any

  if (inviteType === 'beta') {
    // ── Beta invite: create a brand new household for this user ──────────────
    // Household name defaults to their username — they can change it in settings
    const { data: newHousehold, error: hhError } = await supabase
      .from('households')
      .insert({
        name: `${cleanUsername}'s Kitchen`,
        member_count: 1,
        preferences: { onboarding_complete: false },
      })
      .select()
      .single()

    if (hhError || !newHousehold) {
      return NextResponse.json({ error: 'Failed to create household' }, { status: 500 })
    }

    householdId   = newHousehold.id
    householdData = newHousehold
  } else {
    // ── Member invite: join the creator's existing household ─────────────────
    householdId = invite.household_id

    const { data: hh } = await supabase
      .from('households')
      .select('*')
      .eq('id', householdId)
      .single()

    householdData = hh
  }

  // Create user
  const { data: newUser, error: userError } = await supabase
    .from('users')
    .insert({
      household_id: householdId,
      username:     cleanUsername,
      password_hash,
      role: inviteType === 'beta' ? 'admin' : 'member',
    })
    .select()
    .single()

  if (userError || !newUser) {
    // Clean up orphaned household if user creation failed on beta flow
    if (inviteType === 'beta') {
      await supabase.from('households').delete().eq('id', householdId)
    }
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }

  // Increment invite uses
  await supabase
    .from('household_invites')
    .update({ uses_so_far: invite.uses_so_far + 1 })
    .eq('id', invite.id)

  const token = signToken({
    id: newUser.id,
    username: newUser.username,
    role: newUser.role,
    household_id: newUser.household_id,
  })

  const response = NextResponse.json({
    user: {
      id: newUser.id,
      username: newUser.username,
      role: newUser.role,
      household_id: newUser.household_id,
    },
    household: householdData,
    invite_type: inviteType,
  })

  response.cookies.set('gm_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })

  return response
}
