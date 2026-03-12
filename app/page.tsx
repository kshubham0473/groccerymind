import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'

export default async function Home() {
  const cookieStore = await cookies()
  const token = cookieStore.get('gm_token')?.value
  if (token && verifyToken(token)) {
    redirect('/dashboard')
  }
  redirect('/login')
}
