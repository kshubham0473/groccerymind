import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { getStarterDishes } from '@/lib/gemini'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const user = getSessionFromCookie(req.headers.get('cookie'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('households')
    .select('preferences')
    .eq('id', user.household_id)
    .single()

  const prefs = data?.preferences || {}

  try {
    const dishes = await getStarterDishes({ householdContext: '', prefs })
    if (!dishes.length) {
      return NextResponse.json({
        dishes: [],
        no_corpus: true,
        message: 'Recipe library not found. Please run the scraper script first.'
      })
    }
    return NextResponse.json({ dishes })
  } catch (e: any) {
    return NextResponse.json({ dishes: [], error: e.message })
  }
}

// ── Normalise ingredient names ────────────────────────────────────────────────
const PANTRY_SYNONYMS: Record<string, string> = {
  'potatoes':'potato','tomatoes':'tomato','onions':'onion','eggs':'egg',
  'carrots':'carrot','peas':'pea','beans':'bean','lentils':'lentil',
  'dahi':'curd','yogurt':'curd','yoghurt':'curd',
  'aloo':'potato','alu':'potato','tamatar':'tomato','pyaaz':'onion',
  'anda':'egg','ande':'egg','palak':'spinach','gobi':'cauliflower',
  'bhindi':'okra','baingan':'brinjal','shimla mirch':'capsicum',
  'sweet corn':'corn','maize':'corn','bhutta':'corn',
  'matar':'peas','green peas':'peas','chana':'chickpeas','chole':'chickpeas',
  'rajma':'kidney beans','chawal':'rice','atta':'flour','maida':'flour',
  'paneer':'paneer','cottage cheese':'paneer',
}
function normaliseIngredient(name: string): string {
  const n = name.toLowerCase().trim().replace(/\s+/g, ' ')
  if (PANTRY_SYNONYMS[n]) return PANTRY_SYNONYMS[n]
  return n.replace(/es$/, '').replace(/s$/, '').trim()
}

// ── Ask Gemini to categorise a batch of ingredients ───────────────────────────
import { callGeminiRaw, cleanJson, parseIngredients } from '@/lib/gemini'

async function categoriseIngredients(ingredients: string[]): Promise<Record<string, any>> {
  const prompt = `Categorise these pantry ingredients for an Indian household grocery app.
For each, return: category, tier, depletion_days.
- category: "Vegetables" | "Leafy Greens" | "Dairy" | "Eggs" | "Grains & Lentils" | "Bakery" | "Condiments" | "Packaged" | "General"
- tier: "fresh" | "weekly" | "staple"
- depletion_days: realistic integer

Ingredients:
${ingredients.map((i, n) => `${n+1}. ${i}`).join('\n')}

Return ONLY a JSON object, no markdown:
{"Spinach": {"category": "Leafy Greens", "tier": "fresh", "depletion_days": 3}}`
  try {
    return JSON.parse(cleanJson(await callGeminiRaw(prompt)))
  } catch { return {} }
}

function fallbackCategorise(name: string): { category: string; tier: 'fresh'|'weekly'|'staple'; depletion_days: number } {
  const n = name.toLowerCase()
  if (['spinach','palak','methi','coriander leaves','mint','leafy'].some(k => n.includes(k)))
    return { category: 'Leafy Greens', tier: 'fresh', depletion_days: 3 }
  if (['tomato','onion','potato','capsicum','cauliflower','bhindi','baingan','peas',
       'beans','carrot','cucumber','tinde','toorai','arabi','methi','banana'].some(k => n.includes(k)))
    return { category: 'Vegetables', tier: 'fresh', depletion_days: 5 }
  if (n.includes('paneer')) return { category: 'Dairy', tier: 'fresh', depletion_days: 4 }
  if (n.includes('egg') || n.includes('anda')) return { category: 'Eggs', tier: 'fresh', depletion_days: 10 }
  if (['curd','yogurt','dahi'].some(k => n.includes(k))) return { category: 'Dairy', tier: 'fresh', depletion_days: 4 }
  if (n.includes('milk')) return { category: 'Dairy', tier: 'weekly', depletion_days: 7 }
  if (['dal','atta','besan','suji','rava','moong','rajma','chole','channa','macaroni',
       'pasta','sev','poha','vermicelli','oats','flour','rice','wheat'].some(k => n.includes(k)))
    return { category: 'Grains & Lentils', tier: 'staple', depletion_days: 30 }
  if (['bread','pav'].some(k => n.includes(k))) return { category: 'Bakery', tier: 'fresh', depletion_days: 5 }
  if (['sauce','pickle','cream','chutney'].some(k => n.includes(k))) return { category: 'Condiments', tier: 'weekly', depletion_days: 21 }
  return { category: 'General', tier: 'weekly', depletion_days: 14 }
}

function autoAssign(
  dishes: any[],
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
  const freeSlots  = SLOTS.filter(s => !fixedSlots.has(s))

  // Keep original category-interleaving so variety is spread across days
  function getGroup(d: any): string {
    const all = (d.name + ' ' + (d.ingredients || []).join(' ')).toLowerCase()
    if (all.includes('paneer')) return 'paneer'
    if (['egg','anda'].some(w => all.includes(w))) return 'egg'
    if (['dal','moong','chole','rajma','channa'].some(w => all.includes(w))) return 'legume'
    if (['rice','chawal','pulao'].some(w => all.includes(w))) return 'rice'
    if (['bread','paratha','roti','pav'].some(w => all.includes(w))) return 'bread'
    return 'vegetable'
  }

  const groups: Record<string, any[]> = {}
  for (const d of unassigned) {
    const g = getGroup(d)
    if (!groups[g]) groups[g] = []
    groups[g].push(d)
  }
  const ordered: any[] = []
  const keys = Object.keys(groups)
  const maxLen = Math.max(...keys.map(k => groups[k].length), 0)
  for (let i = 0; i < maxLen; i++) for (const k of keys) if (groups[k][i]) ordered.push(groups[k][i])

  // Wrap around so all dishes get a slot — each slot shows 1-2 options in meal plan
  for (let i = 0; i < ordered.length; i++) {
    result[ordered[i].name] = [freeSlots[i % freeSlots.length]]
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
      meal_pairing: d.meal_pairing || '',
      complexity: d.complexity || 'moderate',
      is_vegetarian: d.is_vegetarian !== false,
      tags: d.tags || [],
      youtube_url: d.youtube_url || '',
      ingredients: [],
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

  // Derive ingredients by calling parseIngredients() directly (avoids unreliable HTTP self-calls on Vercel)
  // Cap at 16 dishes to stay within Gemini rate limits; remaining dishes still appear in meal plan
  const fetchedIngredients = await Promise.all(
    insertedDishes.slice(0, 16).map(async (d: any) => {
      try { return await parseIngredients(d.name) } catch { return [] }
    })
  )

  const allIngredients: string[] = fetchedIngredients.flat()

  const SPICE_BLACKLIST = new Set(['salt','oil','ghee','butter','cumin','turmeric','chilli',
    'pepper','garam masala','coriander powder','mustard','hing','ajwain','red chilli','green chilli'])
  const seenNorm = new Map<string, string>()
  for (const raw of allIngredients) {
    const norm = normaliseIngredient(raw)
    if (norm.length < 2 || SPICE_BLACKLIST.has(norm)) continue
    if (norm.includes('powder') || norm.includes('masala') || norm.includes('spice') || norm.includes('seed')) continue
    if (!seenNorm.has(norm) || raw.length < (seenNorm.get(norm) || '').length) seenNorm.set(norm, raw.trim())
  }
  const uniqueIngredients = [...seenNorm.values()].slice(0, 50)

  let categories: Record<string, any> = {}
  for (let i = 0; i < uniqueIngredients.length; i += 25) {
    const batchCats = await categoriseIngredients(uniqueIngredients.slice(i, i + 25))
    categories = { ...categories, ...batchCats }
  }

  if (uniqueIngredients.length > 0) {
    await supabase.from('pantry_items').delete().eq('household_id', user.household_id)
    await supabase.from('pantry_items').insert(
      uniqueIngredients.map(name => {
        const geminiCat = categories[name]
        const cat = geminiCat?.category && geminiCat?.tier && geminiCat?.depletion_days
          ? geminiCat : fallbackCategorise(name)
        return {
          household_id: user.household_id,
          name: name.charAt(0).toUpperCase() + name.slice(1),
          category: cat.category, tier: cat.tier,
          depletion_days: cat.depletion_days, stock_status: 'good',
        }
      })
    )
  }

  return NextResponse.json({ success: true, dishes: insertedDishes.length, pantryItems: uniqueIngredients.length, slots: slotAssignments.length })
}