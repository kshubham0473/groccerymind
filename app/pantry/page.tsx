'use client'
import { useEffect, useState } from 'react'
import { cachedFetch, cacheInvalidate } from '@/lib/page-cache'
import { PantryItem, PantryTier, StockStatus } from '@/types'

const TIERS: { key: PantryTier; label: string }[] = [
  { key: 'fresh',  label: 'Fresh & daily' },
  { key: 'weekly', label: 'Weekly'        },
  { key: 'staple', label: 'Staples'       },
]

// Smart depletion day defaults by category
const DEPLETION_DEFAULTS: Record<string, { days: number; tier: PantryTier }> = {
  'Vegetables':    { days: 5,   tier: 'fresh'  },
  'Leafy Greens':  { days: 3,   tier: 'fresh'  },
  'Fruits':        { days: 5,   tier: 'fresh'  },
  'Dairy':         { days: 4,   tier: 'fresh'  },
  'Eggs':          { days: 10,  tier: 'fresh'  },
  'Bread':         { days: 4,   tier: 'fresh'  },
  'Grains & Rice': { days: 30,  tier: 'staple' },
  'Lentils & Dal': { days: 30,  tier: 'staple' },
  'Spices':        { days: 60,  tier: 'staple' },
  'Oil & Ghee':    { days: 30,  tier: 'staple' },
  'Flour':         { days: 21,  tier: 'weekly' },
  'Onion & Garlic':{ days: 14,  tier: 'weekly' },
  'Canned & Dry':  { days: 45,  tier: 'staple' },
  'Snacks':        { days: 14,  tier: 'weekly' },
  'Beverages':     { days: 14,  tier: 'weekly' },
  'Other':         { days: 7,   tier: 'weekly' },
}
const CATEGORIES = Object.keys(DEPLETION_DEFAULTS)

// Keyword-based auto-categoriser — runs as user types, no API call needed
function autoCategory(name: string): string | null {
  const n = name.toLowerCase().trim()
  if (!n) return null
  if (['palak','spinach','methi','coriander','mint','curry leaves','fenugreek','lettuce','kale','cabbage','patta'].some(k => n.includes(k))) return 'Leafy Greens'
  if (['tomato','onion','potato','aloo','capsicum','carrot','cauliflower','gobi','bhindi','baingan','peas','beans','tinda','lauki','cucumber','corn','sweet corn','broccoli','mushroom','pumpkin','zucchini','arbi','yam','radish','mooli','beetroot'].some(k => n.includes(k))) return 'Vegetables'
  if (['apple','banana','mango','orange','grape','papaya','watermelon','pomegranate','guava','kiwi','pear','peach','plum','lychee','strawberry','blueberry'].some(k => n.includes(k))) return 'Fruits'
  if (['milk','curd','dahi','yogurt','paneer','cream','cheese','butter','ghee','lassi','buttermilk','chaas','khoa','mawa'].some(k => n.includes(k))) return 'Dairy'
  if (['egg','anda','ande'].some(k => n.includes(k))) return 'Eggs'
  if (['bread','pav','bun','loaf','toast','rusk','biscuit','croissant'].some(k => n.includes(k))) return 'Bread'
  if (['rice','basmati','sona masoori','poha','puffed rice','murmura'].some(k => n.includes(k))) return 'Grains & Rice'
  if (['dal','lentil','rajma','chole','chana','moong','masoor','urad','toor','arhar','beans','kidney'].some(k => n.includes(k))) return 'Lentils & Dal'
  if (['atta','flour','maida','besan','suji','rava','semolina','wheat','oats','millet','bajra','jowar','ragi','cornflour'].some(k => n.includes(k))) return 'Flour'
  if (['oil','ghee','vanaspati','olive oil','coconut oil','groundnut','mustard oil','sunflower'].some(k => n.includes(k))) return 'Oil & Ghee'
  if (['onion','garlic','ginger','lahsun','adrak'].some(k => n.includes(k))) return 'Onion & Garlic'
  if (['masala','spice','powder','cumin','turmeric','chilli','pepper','cardamom','cinnamon','clove','bay leaf','star anise','saffron'].some(k => n.includes(k))) return 'Spices'
  if (['chips','namkeen','sev','mixture','popcorn','cracker','cookie','chocolate','candy','snack','wafer','kurkure'].some(k => n.includes(k))) return 'Snacks'
  if (['juice','water','soda','cola','drink','tea','coffee','chai','cocoa','sherbet','squash','energy'].some(k => n.includes(k))) return 'Beverages'
  if (['tinned','canned','can','packet','packaged','frozen','instant','ready','sauce','ketchup','pickle','jam','honey','vinegar','soy','noodle','pasta','macaroni','vermicelli'].some(k => n.includes(k))) return 'Canned & Dry'
  return null
}

const TIER_WORD: Record<string, string> = { fresh: 'Fresh', weekly: 'Weekly', staple: 'Staple' }

/** One honest sentence about why this item is on the attention list. */
function reasonFor(i: PantryItem): string {
  const tier = TIER_WORD[i.tier] || 'Pantry'
  if (i.stock_status === 'finished') return `${tier} · usually lasts ${i.depletion_days} days`
  const since = (i as any).days_since_restock
  if (typeof since === 'number') return `${tier} · ${since} days since restock`
  return `${tier} · refreshes every ${i.depletion_days} days`
}

/** Names as prose: first four, then a count. The long tail is not a list. */
function shelfLine(names: { name: string; low: boolean }[]) {
  const head = names.slice(0, 4)
  const rest = names.length - head.length
  return { head, rest }
}

export default function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string|null>(null)
  const [search, setSearch] = useState('')
  const [actionItem, setActionItem] = useState<PantryItem|null>(null)
  const [adding, setAdding] = useState(false)
  const [newItem, setNewItem] = useState({ name: '', tier: 'fresh' as PantryTier, category: 'Vegetables', depletion_days: 5 })
  const [saving, setSaving] = useState(false)
  const [autoCatApplied, setAutoCatApplied] = useState(false)
  const [addedAll, setAddedAll] = useState(false)

  useEffect(() => {
    fetch('/api/pantry/estimate', { method: 'POST' }).catch(() => {})
    cachedFetch(
      'pantry:items',
      () => fetch('/api/pantry').then(r => r.json()),
      (d, isStale) => {
        if (!d) { setFetchError('Network error'); setLoading(false); return }
        if (Array.isArray(d)) { setItems(d) } else { setFetchError(d.error || 'Failed to load pantry') }
        setLoading(false)
      }
    ).catch(e => { setFetchError(e.message || 'Network error'); setLoading(false) })
  }, [])

  function onCategoryChange(cat: string) {
    const def = DEPLETION_DEFAULTS[cat] || { days: 7, tier: 'weekly' as PantryTier }
    setNewItem(p => ({ ...p, category: cat, depletion_days: def.days, tier: def.tier }))
  }

  async function updateStatus(id: string, stock_status: StockStatus) {
    const item = items.find(i => i.id === id)
    setItems(p => p.map(i => i.id === id ? { ...i, stock_status } : i))
    setActionItem(null)
    cacheInvalidate('pantry:items', 'dashboard:pantry')
    await fetch('/api/pantry', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, stock_status }) })
    if (stock_status === 'finished' && item) {
      await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_name: item.name, source: 'pantry' }) })
    }
  }

  async function addItem() {
    if (!newItem.name.trim()) return
    setSaving(true)
    cacheInvalidate('pantry:items', 'dashboard:pantry')
    const res = await fetch('/api/pantry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newItem, name: newItem.name.trim(), stock_status: 'good' }) })
    const d = await res.json()
    if (!d.error) setItems(p => [...p, d])
    setAdding(false)
    setNewItem({ name: '', tier: 'fresh', category: 'Vegetables', depletion_days: 5 })
    setSaving(false)
  }

  async function markRestocked(id: string) {
    const res = await fetch('/api/pantry/estimate', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    const d = await res.json()
    if (!d.error) setItems(p => p.map(i => i.id === id ? { ...i, ...d } : i))
    setActionItem(null)
  }

  async function deleteItem(id: string) {
    setItems(p => p.filter(i => i.id !== id)); setActionItem(null)
    cacheInvalidate('pantry:items', 'dashboard:pantry')
    await fetch('/api/pantry', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
  }

  /** New in patch 3 — the whole attention list in one action. */
  async function addAllToList(list: PantryItem[]) {
    setAddedAll(true)
    cacheInvalidate('orders:items', 'dashboard:orders')
    for (const i of list) {
      await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_name: i.name, source: 'pantry' })
      }).catch(() => {})
    }
  }

  const searching = search.trim().length > 0
  const matches = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))

  const attention = items
    .filter(i => i.stock_status !== 'good')
    .sort((a, b) => (a.stock_status === 'finished' ? 0 : 1) - (b.stock_status === 'finished' ? 0 : 1))

  const headline =
    attention.length === 0 ? 'Everything in stock' :
    attention.length === 1 ? 'One thing needs attention' :
    `${attention.length} need attention`

  if (loading) return (
    <div className="screen"><div className="screen-body" style={{ paddingTop: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="skeleton" style={{ height: 15, width: 90 }} />
      <div className="skeleton" style={{ height: 34, width: '70%' }} />
      <div className="skeleton" style={{ height: 1, width: '100%' }} />
      <div className="skeleton" style={{ height: 54, width: '100%' }} />
      <div className="skeleton" style={{ height: 54, width: '100%' }} />
    </div></div>
  )

  if (fetchError) return (
    <div className="screen"><div className="screen-body" style={{ paddingTop: 40 }}>
      <p className="font-display" style={{ fontSize: 'var(--t-page)', fontWeight: 600, margin: 0 }}>The kitchen didn&apos;t load</p>
      <p style={{ fontSize: 15, color: 'var(--ink-soft)', margin: '10px 0 0' }}>{fetchError}</p>
      <button className="action" style={{ marginTop: 22 }} onClick={() => location.reload()}>Try again</button>
    </div></div>
  )

  return (
    <div className="screen">

      <div className="screen-head">
        <span className="label">{items.length} items</span>
        <button className="word tap" onClick={() => setAdding(true)}>Add</button>
      </div>

      <div className="screen-body">

        <div style={{ paddingTop: 22 }}>
          <p className="font-display" style={{ fontSize: 'var(--t-page)', lineHeight: 1.15, fontWeight: 600, margin: 0 }}>
            {headline}
          </p>
          <p style={{ fontSize: 15, color: 'var(--ink-soft)', margin: '8px 0 0' }}>
            {attention.length === 0
              ? `All ${items.length} items were fine as of this morning.`
              : 'Everything else was fine as of this morning.'}
          </p>
        </div>

        {/* Search only earns its place on a long pantry. */}
        {items.length > 24 && (
          <div style={{ paddingTop: 20 }}>
            <input className="field" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find an item" />
          </div>
        )}

        {searching ? (
          <div style={{ paddingTop: 24 }}>
            <p className="label" style={{ margin: '0 0 12px' }}>{matches.length} found</p>
            <div className="rule" />
            {matches.map(item => (
              <div key={item.id}>
                <button className="row" onClick={() => setActionItem(item)}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <p className="row-title">{item.name}</p>
                    <p className="row-meta">{reasonFor(item)}</p>
                  </span>
                  {item.stock_status !== 'good' && (
                    <span className={item.stock_status === 'finished' ? 'status status-out' : 'status status-low'}>
                      {item.stock_status === 'finished' ? 'Finished' : 'Low'}
                    </span>
                  )}
                </button>
                <div className="rule" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* ── Needs attention — full rows, a reason, a word ─────── */}
            {attention.length > 0 && (
              <div style={{ paddingTop: 26 }}>
                <div className="rule" />
                {attention.map(item => (
                  <div key={item.id}>
                    <button className="row" onClick={() => setActionItem(item)}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <p className="row-title">{item.name}</p>
                        <p className="row-meta">{reasonFor(item)}</p>
                      </span>
                      <span className={item.stock_status === 'finished' ? 'status status-out' : 'status status-low'}>
                        {item.stock_status === 'finished' ? 'Finished' : 'Low'}
                      </span>
                    </button>
                    <div className="rule" />
                  </div>
                ))}
                <button className="action-sm" style={{ width: '100%', marginTop: 16 }}
                        disabled={addedAll} onClick={() => addAllToList(attention)}>
                  {addedAll
                    ? 'Added to the list'
                    : `Add all ${attention.length === 1 ? 'of it' : attention.length} to the list`}
                </button>
              </div>
            )}

            {/* ── The healthy remainder, as three sentences ─────────── */}
            {TIERS.map(tier => {
              const tierItems = items.filter(i => i.tier === tier.key)
              if (tierItems.length === 0) return null
              const { head, rest } = shelfLine(tierItems.map(i => ({ name: i.name, low: i.stock_status !== 'good' })))
              return (
                <div key={tier.key} style={{ paddingTop: 26 }}>
                  <p className="label" style={{ margin: '0 0 8px' }}>{tier.label} · {tierItems.length}</p>
                  <p className="tail">
                    {head.map((n, idx) => (
                      <span key={n.name}>
                        {n.low ? <em>{n.name}</em> : n.name}{idx < head.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                    {rest > 0 ? `, +${rest} more.` : '.'}
                  </p>
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* ── Action sheet ───────────────────────────────────────────── */}
      {actionItem && (
        <div className="sheet-scrim" onClick={() => setActionItem(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <p className="sheet-title">{actionItem.name}</p>
            <p className="sheet-sub">{reasonFor(actionItem)}</p>

            <div style={{ paddingTop: 20 }}>
              <div className="rule" />
              {([
                { s: 'good'     as StockStatus, t: 'Well stocked',  m: 'No action needed' },
                { s: 'low'      as StockStatus, t: 'Running low',   m: 'Flagged on the home screen' },
                { s: 'finished' as StockStatus, t: 'Finished',      m: 'Goes straight onto the list' },
              ]).map(({ s, t, m }) => (
                <div key={s}>
                  <button className="row" onClick={() => updateStatus(actionItem.id, s)}>
                    <span style={{ flex: 1 }}>
                      <p className="row-title" style={{ fontSize: 18 }}>{t}</p>
                      <p className="row-meta">{m}</p>
                    </span>
                    {actionItem.stock_status === s && <span className="status status-low">Now</span>}
                  </button>
                  <div className="rule" />
                </div>
              ))}
              <button className="row" onClick={() => markRestocked(actionItem.id)}>
                <span style={{ flex: 1 }}>
                  <p className="row-title" style={{ fontSize: 18 }}>Just restocked</p>
                  <p className="row-meta">
                    {actionItem.avg_depletion_days && actionItem.order_count && actionItem.order_count >= 3
                      ? `Resets the clock — learned average ${actionItem.avg_depletion_days} days`
                      : 'Resets the depletion clock'}
                  </p>
                </span>
              </button>
              <div className="rule" />
            </div>

            <button className="action-sm" style={{ width: '100%', marginTop: 18, borderColor: 'var(--rule)', color: 'var(--finished)' }}
                    onClick={() => deleteItem(actionItem.id)}>
              Remove from the kitchen
            </button>
          </div>
        </div>
      )}

      {/* ── Add sheet ──────────────────────────────────────────────── */}
      {adding && (
        <div className="sheet-scrim" onClick={() => { setAdding(false); setAutoCatApplied(false); setNewItem({ name: '', tier: 'fresh', category: 'Vegetables', depletion_days: 5 }) }}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <p className="sheet-title">Add to the kitchen</p>

            <input autoFocus className="field" style={{ marginTop: 18 }} value={newItem.name}
              placeholder="Item name"
              onChange={e => {
                const name = e.target.value
                setNewItem(p => ({ ...p, name }))
                const cat = autoCategory(name)
                if (cat && cat !== newItem.category) { onCategoryChange(cat); setAutoCatApplied(true) }
                else if (!cat) setAutoCatApplied(false)
              }} />

            <div style={{ paddingTop: 22 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                <span className="label">Category</span>
                {autoCatApplied && <span className="label" style={{ color: 'var(--ochre)' }}>Detected</span>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 14px' }}>
                {CATEGORIES.map(cat => (
                  <button key={cat}
                    className={newItem.category === cat ? 'word tap' : 'word word-quiet tap'}
                    onClick={() => { onCategoryChange(cat); setAutoCatApplied(false) }}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ paddingTop: 24, display: 'flex', gap: 32 }}>
              <div>
                <p className="label" style={{ margin: '0 0 6px' }}>Shelf</p>
                <p className="font-display" style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{TIER_WORD[newItem.tier]}</p>
              </div>
              <div>
                <p className="label" style={{ margin: '0 0 6px' }}>Lasts about</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                  <input type="number" value={newItem.depletion_days}
                    onChange={e => setNewItem(p => ({ ...p, depletion_days: +e.target.value }))}
                    className="field"
                    style={{ width: 52, fontFamily: 'var(--font-lora), Georgia, serif', fontSize: 20, fontWeight: 600, padding: '2px 0' }} />
                  <span style={{ fontSize: 15, color: 'var(--ink-soft)' }}>days</span>
                </div>
              </div>
            </div>

            <button className="action" style={{ marginTop: 26 }} onClick={addItem} disabled={saving || !newItem.name.trim()}>
              {saving ? 'Adding…' : 'Add to the kitchen'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
