import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { getStarterDishes, buildHouseholdContext } from '@/lib/gemini'

export async function GET(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data } = await supabase.from('households').select('preferences').eq('id', user.household_id).single()
  const prefs = data?.preferences || {}
  const householdContext = buildHouseholdContext(prefs, [])

  try {
    const dishes = await getStarterDishes({ householdContext })
    return NextResponse.json({ dishes })
  } catch (e: any) {
    return NextResponse.json({ dishes: [], error: e.message })
  }
}

export async function POST(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { selected } = await req.json()
  const supabase = createServiceClient()

  // 1. Clear existing dishes + meal slots
  await supabase.from('meal_slots').delete().eq('household_id', user.household_id)
  await supabase.from('dishes').delete().eq('household_id', user.household_id)

  if (!selected?.length) return NextResponse.json({ success: true })

  // 2. Insert dishes
  const { data: insertedDishes } = await supabase
    .from('dishes')
    .insert(selected.map((d: any) => ({
      household_id: user.household_id,
      name: d.name,
      cuisine_type: d.cuisine_type || 'Indian',
      ingredients: d.ingredients || [],
    })))
    .select()

  if (!insertedDishes?.length) return NextResponse.json({ error: 'Failed to insert dishes' }, { status: 500 })

  // 3. Assign dishes to days/slots
  const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
  const SLOTS = ['lunch','dinner']
  const dishNameToId = Object.fromEntries(insertedDishes.map(d => [d.name, d.id]))
  const slotAssignments: any[] = []

  selected.forEach((dish: any) => {
    const dishId = dishNameToId[dish.name]
    if (!dishId || !dish.days?.length) return
    dish.days.forEach((daySlot: string) => {
      const [day, slot] = daySlot.split('_')
      if (DAYS.includes(day) && SLOTS.includes(slot)) {
        slotAssignments.push({ household_id: user.household_id, day, slot, dish_id: dishId })
      }
    })
  })

  if (slotAssignments.length) {
    await supabase.from('meal_slots').insert(slotAssignments)
  }

  // 4. Derive pantry from ingredients
  const allIngredients: string[] = []
  selected.forEach((d: any) => { if (Array.isArray(d.ingredients)) allIngredients.push(...d.ingredients) })

  const SPICE_BLACKLIST = new Set(['salt','oil','ghee','butter','cumin','turmeric','chilli','pepper','garam masala','coriander powder','mustard','hing','ajwain'])
  const unique = [...new Set(allIngredients.map(i => i.toLowerCase().trim()))]
    .filter(i => i.length > 1 && !SPICE_BLACKLIST.has(i) && !i.includes('powder') && !i.includes('masala') && !i.includes('spice') && !i.includes('seed'))

  function categorise(name: string): { category: string; tier: 'fresh'|'weekly'|'staple'; depletion_days: number } {
    const n = name.toLowerCase()
    if (['palak','tomato','onion','potato','capsicum','cauliflower','bhindi','baingan','peas','beans','carrot','cucumber','tinde','toorai','arabi','methi','banana','apple'].some(k => n.includes(k)))
      return { category: 'Vegetables', tier: 'fresh', depletion_days: 5 }
    if (['paneer'].some(k => n.includes(k))) return { category: 'Dairy', tier: 'fresh', depletion_days: 4 }
    if (['egg'].some(k => n.includes(k))) return { category: 'Dairy', tier: 'fresh', depletion_days: 10 }
    if (['curd','yogurt'].some(k => n.includes(k))) return { category: 'Dairy', tier: 'fresh', depletion_days: 4 }
    if (['milk'].some(k => n.includes(k))) return { category: 'Dairy', tier: 'weekly', depletion_days: 7 }
    if (['dal','rice','wheat','besan','suji','rava','moong','rajma','chole','channa','macaroni','pasta','sev','poha','vermicelli','oats','flour'].some(k => n.includes(k)))
      return { category: 'Grains & Lentils', tier: 'staple', depletion_days: 30 }
    if (['bread','pav'].some(k => n.includes(k))) return { category: 'Bakery', tier: 'fresh', depletion_days: 5 }
    if (['sauce','pickle','cream'].some(k => n.includes(k))) return { category: 'Condiments', tier: 'weekly', depletion_days: 21 }
    return { category: 'General', tier: 'weekly', depletion_days: 14 }
  }

  if (unique.length > 0) {
    await supabase.from('pantry_items').delete().eq('household_id', user.household_id)
    await supabase.from('pantry_items').insert(
      unique.slice(0, 50).map(name => {
        const cat = categorise(name)
        return { household_id: user.household_id, name: name.charAt(0).toUpperCase() + name.slice(1), ...cat, stock_status: 'good' }
      })
    )
  }

  return NextResponse.json({ success: true, dishes: insertedDishes.length, pantryItems: unique.length })
}
