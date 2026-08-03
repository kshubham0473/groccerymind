# GroceryMind redesign — drop-in update

Everything from turns 1–4 of the design doc, merged into one folder that mirrors
your repo. Later patches already win where they overlapped (`app/globals.css` and
`components/DishImage.tsx` are the patch-3 versions).

## Apply

From your repo root:

```bash
cp -R /path/to/update/* .
npm run dev
```

That's it — 15 files, all replacements of existing ones. No new dependencies, no
schema change, no new routes.

## What lands where

| File | From | What changed |
| --- | --- | --- |
| `app/globals.css` | turn 2a/3 | The editorial paper theme + every primitive (`.screen`, `.row`, `.rule`, `.field`, `.action`, `.word`, `.check`, `.label`, `.sheet`, `.skeleton`, `.tail`) |
| `app/layout.tsx` | turn 2a | Lora + JetBrains Mono via `next/font` |
| `app/dashboard/page.tsx` | turn 2a | Tonight — one decision, alternates as rows, the rest of the app as one sentence |
| `app/meal-plan/page.tsx` | turn 3 | Week — seven ruled lines, expand a day in place |
| `app/pantry/page.tsx` | turn 3 | Kitchen — attention rows first, the healthy remainder as prose |
| `app/orders/page.tsx` | turn 3 | List — ruled checklist, inline add, quick-commerce links in the header |
| `app/discover/page.tsx` | turn 3 | Behind "Browse all" — no longer a tab |
| `app/login/page.tsx` | turn 4 | Title page: name in Lora, ruled inputs, join as a sentence |
| `app/onboarding/page.tsx` | turn 4 | Six ruled segments, near-square chips, rotation as a checklist |
| `app/admin/page.tsx` | turn 4 | Household as rows, invite code set large in mono |
| `lib/tour-steps.ts` | turn 4 | 11 steps → 7, all selectors valid |
| `components/TourOverlay.tsx` | turn 4 | Paper sheet, square spotlight, one mono step count |
| `components/BottomNav.tsx` | turn 2a | Four mono words, no icons |
| `components/DishImage.tsx`, `lib/dish-image.ts` | turn 2a/3 | Shared dish thumbnail with YouTube fallback |

## Already done for you

The seven `data-tour` anchors the new tour needs are **already in these files** —
`tonight`, `commit`, `news` on dashboard; `week`, `browse` on meal-plan; `shelf`
on pantry; `list` on orders. Nothing to add by hand.

One small content change came with the `browse` anchor: the meal-plan footer line
now always renders (it used to appear only when nights were open), reading "The
week is full. Browse all" in the full case.

## Untouched

`components/TourProvider.tsx`, `components/AppProvider.tsx`, every `app/api/*`
route, all DB tables, and all localStorage keys (`gm_tour_seen`, `gm_tour_step`,
`gm_suggestion`).

Two deliberate behaviour cuts, both safe:

1. **Onboarding no longer assigns days per dish.** `POST /api/onboarding/starter`
   still receives `selected: [{ ...dish, days: [] }]` — the endpoint is unchanged.
   Days are assigned on Week now.
2. **The tour is 7 steps.** Anyone mid-tour resumes at the same index; worst case
   they land one step further along than they left off.
