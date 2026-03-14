import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { getStarterDishes, buildHouseholdContext, callGeminiRaw, cleanJson } from '@/lib/gemini'

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

// ── Normalise ingredient names to catch duplicates ────────────────────────────
function normaliseIngredient(name: string): string {
  return name.toLowerCase().trim()
    .replace(/es$/, '').replace(/s$/, '')   // tomatoes→tomato, onions→onion
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Ask Gemini to categorise a batch of ingredients ───────────────────────────
async function categoriseIngredients(ingredients: string[]): Promise<Record<string, {
  category: string; tier: 'fresh' | 'weekly' | 'staple'; depletion_days: number
}>> {
  const prompt = `You are categorising pantry ingredients for an Indian household grocery tracking app.

For each ingredient below, return its:
- category: one of "Vegetables", "Leafy Greens", "Dairy", "Eggs", "Grains & Lentils", "Bakery", "Condiments", "Packaged", "General"
- tier: one of "fresh" (spoils in days), "weekly" (lasts ~1-2 weeks), "staple" (lasts months)
- depletion_days: realistic number of days before this household runs out (fresh: 3-7, weekly: 7-21, staple: 21-60)

Ingredients to categorise:
${ingredients.map((i, n) => `${n + 1}. ${i}`).join('\n')}

Return ONLY a JSON object mapping each ingredient name exactly as given to its categorisation. No markdown:
{
  "ingredient name": {"category": "Vegetables", "tier": "fresh", "depletion_days": 5},
  ...
}`

  try {
    const raw = await callGeminiRaw(prompt)
    return JSON.parse(cleanJson(raw))
  } catch {
    return {}
  }
}

// ── Auto-assign dishes to slots avoiding protein clustering ───────────────────
function autoAssign(
  dishes: { name: string; ingredients: string[] }[],
  manualAssignments: Record<string, string[]>
): Record<string, string[]> {
  const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
  const SLOTS: string[] = []
  for (const d of DAYS) for (const s of ['lunch','dinner']) SLOTS.push(`${d}_${s}`)

  const fixedSlots = new Set<string>()
  const result: Record<string, string[]> = {}
  for (const [name, days] of Object.entries(manualAssignments)) {
    if (days.length > 0) { result[name] = days; days.forEach(d => fixedSlots.add(d)) }
  }

  const unassigned = dishes.filter(d => !result[d.name] || result[d.name].length === 0)
  const freeSlots = SLOTS.filter(s => !fixedSlots.has(s))

  function getGroup(d: { name: string; ingredients: string[] }): string {
    const all = (d.name + ' ' + (d.ingredients || []).join(' ')).toLowerCase()
    if (all.includes('paneer')) return 'paneer'
    if (all.includes('egg') || all.includes('anda')) return 'egg'
    if (all.includes('dal') || all.includes('moong') || all.includes('chole') || all.includes('rajma') || all.includes('channa')) return 'legume'
    if (all.includes('rice') || all.includes('chawal') || all.includes('pulao')) return 'rice'
    if (all.includes('bread') || all.includes('paratha') || all.includes('roti') || all.includes('pav')) return 'bread'
    return 'vegetable'
  }

  const groups: Record<string, typeof unassigned> = {}
  for (const d of unassigned) {
    const g = getGroup(d); if (!groups[g]) groups[g] = []; groups[g].push(d)
  }
  const ordered: typeof unassigned = []
  const keys = Object.keys(groups)
  const maxLen = Math.max(...keys.map(k => groups[k].length))
  for (let i = 0; i < maxLen; i++) for (const k of keys) if (groups[k][i]) ordered.push(groups[k][i])

  let slotIdx = 0
  for (const dish of ordered) {
    if (slotIdx >= freeSlots.length) break
    result[dish.name] = [freeSlots[slotIdx++]]
  }
  return result
}

export async function POST(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { selected } = await req.json()
  const supabase = createServiceClient()

  await supabase.from('meal_slots').delete().eq('household_id', user.household_id)
  await supabase.from('dishes').delete().eq('household_id', user.household_id)

  if (!selected?.length) return NextResponse.json({ success: true })

  const manualMap: Record<string, string[]> = {}
  for (const d of selected) manualMap[d.name] = d.days || []
  const finalAssignments = autoAssign(selected, manualMap)

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
  if (slotAssignments.length) await supabase.from('meal_slots').insert(slotAssignments)

  // ── Derive pantry with Gemini categorisation ──────────────────────────────
  const allIngredients: string[] = []
  selected.forEach((d: any) => { if (Array.isArray(d.ingredients)) allIngredients.push(...d.ingredients) })

  // Deduplicate by normalised name
  const SPICE_BLACKLIST = new Set(['salt','oil','ghee','butter','cumin','turmeric','chilli','pepper','garam masala','coriander powder','mustard','hing','ajwain','red chilli','green chilli'])
  const seenNorm = new Map<string, string>() // norm → original preferred form
  for (const raw of allIngredients) {
    const norm = normaliseIngredient(raw)
    if (norm.length < 2) continue
    if (SPICE_BLACKLIST.has(norm)) continue
    if (norm.includes('powder') || norm.includes('masala') || norm.includes('spice') || norm.includes('seed')) continue
    // Keep the shorter/cleaner form
    if (!seenNorm.has(norm) || raw.length < (seenNorm.get(norm) || '').length) {
      seenNorm.set(norm, raw.trim())
    }
  }
  const uniqueIngredients = [...seenNorm.values()].slice(0, 50)

  // Ask Gemini to categorise them in batches of 25
  let categories: Record<string, any> = {}
  for (let i = 0; i < uniqueIngredients.length; i += 25) {
    const batch = uniqueIngredients.slice(i, i + 25)
    const batchCats = await categoriseIngredients(batch)
    categories = { ...categories, ...batchCats }
  }

  // Fallback categoriser for anything Gemini missed
  function fallbackCategorise(name: string): { category: string; tier: 'fresh'|'weekly'|'staple'; depletion_days: number } {
    const n = name.toLowerCase()
    if (['spinach','palak','methi','leafy','greens','coriander leaves','mint'].some(k => n.includes(k))) return { category: 'Leafy Greens', tier: 'fresh', depletion_days: 3 }
    if (['tomato','onion','potato','capsicum','cauliflower','bhindi','baingan','peas','beans','carrot','cucumber','tinde','toorai','arabi','gourd','vegetable','mixed veg'].some(k => n.includes(k))) return { category: 'Vegetables', tier: 'fresh', depletion_days: 5 }
    if (['paneer'].some(k => n.includes(k))) return { category: 'Dairy', tier: 'fresh', depletion_days: 4 }
    if (['egg'].some(k => n.includes(k))) return { category: 'Eggs', tier: 'fresh', depletion_days: 10 }
    if (['curd','yogurt'].some(k => n.includes(k))) return { category: 'Dairy', tier: 'fresh', depletion_days: 4 }
    if (['milk'].some(k => n.includes(k))) return { category: 'Dairy', tier: 'weekly', depletion_days: 7 }
    if (['dal','lentil','rice','wheat','atta','besan','suji','rava','moong','rajma','chole','channa','macaroni','pasta','sev','poha','vermicelli','oats','flour'].some(k => n.includes(k))) return { category: 'Grains & Lentils', tier: 'staple', depletion_days: 30 }
    if (['bread','pav'].some(k => n.includes(k))) return { category: 'Bakery', tier: 'fresh', depletion_days: 5 }
    if (['sauce','pickle','cream','chutney'].some(k => n.includes(k))) return { category: 'Condiments', tier: 'weekly', depletion_days: 21 }
    return { category: 'General', tier: 'weekly', depletion_days: 14 }
  }

  if (uniqueIngredients.length > 0) {
    await supabase.from('pantry_items').delete().eq('household_id', user.household_id)
    await supabase.from('pantry_items').insert(
      uniqueIngredients.map(name => {
        const geminiCat = categories[name]
        const cat = geminiCat && geminiCat.category && geminiCat.tier && geminiCat.depletion_days
          ? geminiCat
          : fallbackCategorise(name)
        return {
          household_id: user.household_id,
          name: name.charAt(0).toUpperCase() + name.slice(1),
          category: cat.category,
          tier: cat.tier,
          depletion_days: cat.depletion_days,
          stock_status: 'good',
        }
      })
    )
  }

  return NextResponse.json({ success: true, dishes: insertedDishes.length, pantryItems: uniqueIngredients.length, slots: slotAssignments.length })
}
