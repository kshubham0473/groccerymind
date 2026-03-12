import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { parseIngredients } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { dish_name } = await req.json()
  if (!dish_name) return NextResponse.json({ error: 'dish_name required' }, { status: 400 })

  const ingredients = await parseIngredients(dish_name)
  return NextResponse.json({ ingredients })
}
