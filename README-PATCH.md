# GroceryMind — patch 3: Week, Kitchen, List and Discover on paper

Ports the four remaining screens onto the 2a editorial theme. **Apply patch-2a
first** — this patch assumes `--paper` / `--ink` / `--ochre` exist and that
`BottomNav` is the four-word text nav.

Copy file by file. Do not replace whole folders.

```bash
cp patch-3/app/globals.css        app/globals.css      # 2a's file + new primitives
cp patch-3/components/DishImage.tsx components/DishImage.tsx  # monogram fallback
cp patch-3/app/meal-plan/page.tsx app/meal-plan/page.tsx
cp patch-3/app/pantry/page.tsx    app/pantry/page.tsx
cp patch-3/app/orders/page.tsx    app/orders/page.tsx
cp patch-3/app/discover/page.tsx  app/discover/page.tsx
```

`components/Icon.tsx` and `components/Card.tsx` are now unused by every screen
— safe to delete. The temporary `--cream` / `--green-*` aliases suggested at the
end of patch-2a's README are no longer needed either; delete them once these
four files are in.

Every fetch, endpoint, payload, cache key, realtime channel and state
transition is unchanged from your current code. This patch is render-only —
if a screen behaved a certain way before, it behaves that way now.

---

## The four rules

1. **No page header.** The dark gradient block and its decorative `::after` are
   gone from all four. Each screen opens with a mono meta line and one Lora
   sentence that states the situation — "Three need attention", not "Pantry".
2. **Rules replace cards.** `.card` survives only inside modal sheets. A 1px
   `--rule` line does the grouping.
3. **Words, not pills or emoji.** Status is mono uppercase: `--ochre` for low,
   `--finished` for finished, nothing at all for good. Category and source
   emoji are removed throughout.
4. **Long tails become sentences.** Anything you won't act on right now — the
   43 stocked pantry items, the 6 things already ordered — collapses to one
   line of `--ink-soft` prose instead of an accordion.

---

## What changed per screen

### Week (`/meal-plan`)

Was a day-selector strip plus two slot cards, with a four-step lock sheet
behind every cell. Now the week is a printed schedule: seven rows, one per day,
showing the locked dish or the day's first option with the second as plain text
underneath. Tapping a day expands that day inline (lunch and dinner, options,
add field, Choose/Unlock) — so the grid's functionality is intact but the
overview is readable without tapping anything.

`LockSheet` keeps all four modes and is restyled onto paper.

### Kitchen (`/pantry`)

Was 46 equal chips across three wood-grain shelves. Now anything not `good`
gets a full row with a reason and a status word, sorted finished-first, with a
single **Add all N to the list** action that posts each one to `/api/orders` —
previously only reachable one item at a time through the action sheet. The
healthy remainder collapses into three shelf sentences. The search field only
renders once the pantry passes 24 items.

### List (`/orders`)

Was five stacked cards, three of them accordions. Now one column of ruled rows
with a square check. The mono suffix says *why* the item is there (from the
kitchen, for Sunday, who added it) instead of an emoji source tag. "Not
immediate" and "Ordered" fold into one sentence, and smart suggestions surface
as a line under the add field rather than a section of their own.

### Discover (`/discover`)

Still routable and still handles `?prompt=`, `?lockSlot=` and `?lockDate=`, but
it is no longer a tab — it's where "Browse all" goes from the home screen, so
the nav stays four items. Results are the same ruled dish rows as home. Mood
colour pills are gone; the honest metadata is time and what's missing. Picking
a row arms the bottom slab (**Cook X**, or **Lock for dinner** in lock mode),
which mirrors the home screen's single-decision shape.

---

## Still on you (carried over from patch-2a, unchanged)

1. Repair the malformed `youtube_url` rows in `lib/dishes-corpus.json`.
2. Make the daily pick a server value so both people see the same answer.
3. `dish → ingredients[]` so "everything in stock" is real. This patch shows
   `needsToBuy` where it has it and falls back to cuisine or prep time where it
   doesn't — the copy degrades honestly, but the feature is still missing.
4. `/api/log/summary` should return `{ partner_action: { who, what } }`.
5. Real dish timings instead of the `complexity` → 20/45/90 proxy.
