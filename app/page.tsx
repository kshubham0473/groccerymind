import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

export default async function Home() {
  const cookieStore = await cookies()
  const token = cookieStore.get('gm_token')?.value
  if (!token) redirect('/login')

  const user = verifyToken(token)
  if (!user) redirect('/login')

  // Check if onboarding is complete
  const supabase = createServiceClient()
  const { data: household } = await supabase
    .from('households')
    .select('preferences')
    .eq('id', user.household_id)
    .single()

  const prefs = household?.preferences || {}
  if (!prefs.onboarding_complete) {
    redirect('/onboarding')
  }

  redirect('/dashboard')
}
