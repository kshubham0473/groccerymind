# GroceryMind — direction 2a (editorial paper)

Drop-in replacements. **Copy file by file — do not replace whole folders**
(that's what broke the last Vercel build: `app/` and `components/` lost every
file that wasn't in the patch).

```bash
cp patch/app/globals.css          app/globals.css
cp patch/app/layout.tsx           app/layout.tsx
cp patch/app/dashboard/page.tsx   app/dashboard/page.tsx
cp patch/components/BottomNav.tsx components/BottomNav.tsx
cp patch/components/DishImage.tsx components/DishImage.tsx   # new
cp patch/lib/dish-image.ts        lib/dish-image.ts          # new
```

`components/Icon.tsx` and `components/Card.tsx` from the previous patch are no
longer used by the home screen — 2a has no cards and a text nav. Keep them if
pantry/orders will use them; otherwise delete.

---

## What the design does now

- **One decision per screen.** The app picks a dish from today's options for the
  active slot (lunch before 3pm, dinner after). One 60px `Cook this`, plus a
  reshuffle button so rejecting is one tap and never a dead end.
- **Photography carries it.** `lib/dish-image.ts` turns a corpus `youtube_url`
  into `i.ytimg.com/vi/<id>/hqdefault.jpg` — no key, no quota, no storage. It
  also repairs the malformed rows (`watch?ml9iYadIJJ0`, missing `v=`).
  `DishImage` falls back to a typographic tile so a dead thumbnail never reads
  as a bug.
- **Everything else is one sentence** at the bottom — pantry, order list,
  partner activity. No cards, no badges, no counts to parse.
- **Nav is four mono words** with an ochre underline. Discover moved behind
  "Browse all", where choosing actually happens.
- Paper `#FBFAF7`, ink `#1A1A18`, one warm accent `#8A5B14` used three times a
  screen. All text clears 4.5:1. Nothing under 12px. Every target ≥44px.

---

## Code work for your build chat

These are behaviour/data changes the design assumes and I can't make from here.
Roughly in priority order.

**1 — Repair the corpus URLs (30 min).**
About 1 in 12 rows in `lib/dishes-corpus.json` is `watch?<id>` with no `v=`.
`lib/dish-image.ts` recovers those at runtime, but fix them at the source too:

```js
// scripts/fix-youtube-urls.js
url.replace(/watch\?([A-Za-z0-9_-]{11})$/, 'watch?v=$1')
```

Then report how many dishes still have no usable id — that number decides how
often the fallback tile shows.

**2 — The pick needs to be shared, not per-device.**
Right now each user's client picks `options[0]`, and reshuffle only moves their
own copy. Two people can be looking at different answers. Make the pick a
server value: extend the `daily_locks` row (or add `daily_pick`) with
`{ lock_date, slot, dish_name, picked_by, picked_at }`, have the home screen
read it, and have reshuffle `PATCH` it. Reuse the Supabase realtime channel
from `orders/page.tsx` so the partner's screen updates live. This is the single
biggest change and the one that makes the household loop real.

**3 — "Everything in stock" (the line I had to leave out).**
The mock says "45 min · everything in stock"; the code currently prints cuisine
instead, because nothing joins a dish to pantry state. You need
`dish → ingredients[]` in the corpus (or from `lib/gemini.ts` parsing on
demand), then a match against `pantry.name`. Ship it as three states: *all in
stock* / *needs paneer* / *needs 3 things*. Missing-ingredient info is also
what should feed one-tap "add to order list".

**4 — `/api/log/summary` should return the partner's last action.**
The home screen wants `{ partner_action: { who, what } }` — e.g.
`{ who: 'anjali', what: 'added tomatoes an hour ago' }`. Today the endpoint
returns a raw event array which the old dashboard reduced into an insight card.
Keep the array for elsewhere; add this one field.

**5 — Timings.** `minutesFor()` maps `complexity` → 20/45/90 min. If the
scraper can pull video duration or a recipe time, replace it — the number is
load-bearing at 7pm and a wrong one erodes trust fast.

**6 — Order of pick candidates.** Whatever ranks `options` today decides what
the app suggests. Worth checking it prefers: in stock > not cooked recently >
matches the time available. Otherwise the reshuffle button becomes the main
interaction.

**7 — Delete on sight** while you're in there: `.page-header::after`,
`.page-header-btn`, and the `invert/sepia/hue-rotate` filter chain. The old
`--cream` / `--green-*` tokens are gone from `globals.css`, so pantry, orders,
meal-plan and discover will lose their backgrounds until they're moved onto
`--paper` / `--ink` / `--ochre`. Either port those four pages in the same pass,
or add temporary aliases:

```css
--cream: var(--paper); --white: #fff; --text-primary: var(--ink);
--text-secondary: var(--ink-soft); --text-muted: var(--ink-soft);
--border: var(--rule); --green-deep: var(--ink); --green-mid: var(--ochre);
```
