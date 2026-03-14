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

// ── Auto-assign logic ─────────────────────────────────────────────────────────
// Groups dishes by protein type, distributes across 14 slots avoiding
// same protein in adjacent slots and clustering
function autoAssign(
  dishes: { name: string; ingredients: string[]; cuisine_type?: string }[],
  manualAssignments: Record<string, string[]> // dish name → ['monday_lunch', ...]
): Record<string, string[]> {
  const SLOTS: string[] = []
  const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
  for (const d of DAYS) for (const s of ['lunch','dinner']) SLOTS.push(`${d}_${s}`)

  // Fix manually assigned slots first
  const fixedSlots = new Set<string>()
  const result: Record<string, string[]> = {}
  for (const [name, days] of Object.entries(manualAssignments)) {
    if (days.length > 0) {
      result[name] = days
      days.forEach(d => fixedSlots.add(d))
    }
  }

  // Unassigned dishes that need auto-placement
  const unassigned = dishes.filter(d => !result[d.name] || result[d.name].length === 0)
  const freeSlots = SLOTS.filter(s => !fixedSlots.has(s))

  // Classify protein group for each dish
  function getGroup(dish: { name: string; ingredients: string[] }): string {
    const all = (dish.name + ' ' + (dish.ingredients || []).join(' ')).toLowerCase()
    if (all.includes('paneer')) return 'paneer'
    if (all.includes('egg') || all.includes('anda')) return 'egg'
    if (all.includes('dal') || all.includes('moong') || all.includes('chole') || all.includes('rajma') || all.includes('channa')) return 'legume'
    if (all.includes('rice') || all.includes('chawal') || all.includes('pulao') || all.includes('biryani')) return 'rice'
    if (all.includes('bread') || all.includes('paratha') || all.includes('roti') || all.includes('pav')) return 'bread'
    if (all.includes('chicken') || all.includes('mutton') || all.includes('fish')) return 'meat'
    return 'vegetable'
  }

  // Group dishes by protein type
  const groups: Record<string, typeof unassigned> = {}
  for (const d of unassigned) {
    const g = getGroup(d)
    if (!groups[g]) groups[g] = []
    groups[g].push(d)
  }

  // Interleave groups across free slots to avoid clustering
  const orderedDishes: typeof unassigned = []
  const groupKeys = Object.keys(groups)
  const maxLen = Math.max(...groupKeys.map(k => groups[k].length))
  for (let i = 0; i < maxLen; i++) {
    for (const k of groupKeys) {
      if (groups[k][i]) orderedDishes.push(groups[k][i])
    }
  }

  // Assign each dish to the next available free slot
  // Each dish gets exactly one slot (one appearance per week as default)
  let slotIdx = 0
  for (const dish of orderedDishes) {
    if (slotIdx >= freeSlots.length) break
    result[dish.name] = [freeSlots[slotIdx]]
    slotIdx++
  }

  return result
}

export async function POST(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { selected } = await req.json()
  // selected: { name, description, cuisine_type, ingredients, days: string[] }[]
  const supabase = createServiceClient()

  // 1. Clear existing dishes + meal slots
  await supabase.from('meal_slots').delete().eq('household_id', user.household_id)
  await supabase.from('dishes').delete().eq('household_id', user.household_id)

  if (!selected?.length) return NextResponse.json({ success: true })

  // 2. Run auto-assign for dishes without manual day assignments
  const manualMap: Record<string, string[]> = {}
  for (const d of selected) manualMap[d.name] = d.days || []
  const finalAssignments = autoAssign(selected, manualMap)

  // 3. Insert dishes
  const { data: insertedDishes, error: dishError } = await supabase
    .from('dishes')
    .insert(selected.map((d: any) => ({
      household_id: user.household_id,
      name: d.name,
      cuisine_type: d.cuisine_type || 'Indian',
      ingredients: d.ingredients || [],
    })))
    .select()

  if (dishError || !insertedDishes?.length) {
    return NextResponse.json({ error: dishError?.message || 'Failed to insert dishes' }, { status: 500 })
  }

  // 4. Insert meal slots from final assignments
  const VALID_DAYS = new Set(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'])
  const VALID_SLOTS = new Set(['lunch','dinner'])
  const dishNameToId = Object.fromEntries(insertedDishes.map(d => [d.name, d.id]))
  const slotAssignments: any[] = []

  for (const [dishName, daySlots] of Object.entries(finalAssignments)) {
    const dishId = dishNameToId[dishName]
    if (!dishId) continue
    for (const daySlot of daySlots) {
      const [day, slot] = daySlot.split('_')
      if (VALID_DAYS.has(day) && VALID_SLOTS.has(slot)) {
        slotAssignments.push({ household_id: user.household_id, day, slot, dish_id: dishId })
      }
    }
  }

  if (slotAssignments.length) {
    await supabase.from('meal_slots').insert(slotAssignments)
  }

  // 5. Derive pantry from all ingredients
  const allIngredients: string[] = []
  selected.forEach((d: any) => { if (Array.isArray(d.ingredients)) allIngredients.push(...d.ingredients) })

  const SPICE_BLACKLIST = new Set(['salt','oil','ghee','butter','cumin','turmeric','chilli','pepper','garam masala','coriander powder','mustard','hing','ajwain'])
  const unique = [...new Set(allIngredients.map(i => i.toLowerCase().trim()))]
    .filter(i => i.length > 1 && !SPICE_BLACKLIST.has(i) && !i.includes('powder') && !i.includes('masala') && !i.includes('spice') && !i.includes('seed'))

  function categorise(name: string): { category: string; tier: 'fresh'|'weekly'|'staple'; depletion_days: number } {
    const n = name.toLowerCase()
    if (['palak','tomato','onion','potato','capsicum','cauliflower','bhindi','baingan','peas','beans','carrot','cucumber','tinde','toorai','arabi','methi','banana'].some(k => n.includes(k)))
      return { category: 'Vegetables', tier: 'fresh', depletion_days: 5 }
    if (n.includes('paneer')) return { category: 'Dairy', tier: 'fresh', depletion_days: 4 }
    if (n.includes('egg')) return { category: 'Dairy', tier: 'fresh', depletion_days: 10 }
    if (['curd','yogurt'].some(k => n.includes(k))) return { category: 'Dairy', tier: 'fresh', depletion_days: 4 }
    if (n.includes('milk')) return { category: 'Dairy', tier: 'weekly', depletion_days: 7 }
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

  return NextResponse.json({ success: true, dishes: insertedDishes.length, pantryItems: unique.length, slots: slotAssignments.length })
}
