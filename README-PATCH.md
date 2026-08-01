# Design pass — files to copy into the repo

Read-only access on my side, so these are drop-in replacements rather than a PR.
Copy over the same paths, run `npm run dev`, then commit.

```
patch/app/globals.css        →  app/globals.css        (replace)
patch/app/layout.tsx         →  app/layout.tsx         (replace)
patch/app/dashboard/page.tsx →  app/dashboard/page.tsx (replace)
patch/components/Icon.tsx    →  components/Icon.tsx    (new)
patch/components/Card.tsx    →  components/Card.tsx    (new)
patch/components/BottomNav.tsx → components/BottomNav.tsx (replace)
```

Suggested commit: `design: unify tokens, replace emoji icons, re-rank dashboard`

## What these files change

- **One surface, one header ink.** `#FAFAF8` everywhere; `--green-deep` is now `#14372A` and is the only header colour. Page identity comes from the eyebrow label.
- **Fonts.** Playfair Display + DM Sans link removed (never rendered). Lora + Inter move to `next/font` — self-hosted, preloaded, exposed as `--font-lora` / `--font-inter`.
- **Tokens.** Spacing 4/8/12/16/24/32, radius 8/12/16/full, five type sizes (12/15/17/20/28). Body is 15px, nothing below 12px.
- **Contrast.** `--text-muted` → `#6B7280`, `--text-secondary` → `#4B5563`, `--amber` → `#B45309`. `#9CA3AF` survives as `--text-disabled` for disabled state only.
- **Icons.** `components/Icon.tsx` — one stroke set inheriting `currentColor`. The `invert/sepia/hue-rotate` filter chain in BottomNav is gone; `/public/icons/*.svg` are no longer loaded.
- **Header geometry.** `border-radius` on the header itself, flex layout for actions, `env(safe-area-inset-top)` + `viewportFit: 'cover'`. The `::after` cream seam and `.page-header-btn` z-index patch are no longer needed — you can delete `.page-header-btn` usages.
- **Touch targets.** `.btn` is 44px min, `.btn-sm` 36px, `.tap` gives a small visual a 44px hit area.
- **Dashboard rank.** Today's plan is the hero (dark, 22px serif, real buttons); mood nudge is one line; Running out sits above Order list; insight is a single line.
- **Desktop.** Above 900px the 430px column becomes a framed card on deep green instead of a strip on white.

## Not included — mechanical follow-ups

These are find-and-replace jobs across the remaining pages, same values:

1. **pantry/page.tsx** — delete the `background: linear-gradient(160deg,#3A2A1E,#5C4A3A)` header override and the `#FAF8F5` page background; drop `emoji` from `TIERS` and use `<Icon name="pantry" />` once per shelf header; replace 🔍 / 🗑️ / 🔄 / ✅⚠️🚫 with `search` / `trash` / `refresh` / status dots; give the item chips `className="tap"`; replace the centred 🥬 loading state with `<CardSkeleton rows={5} />` (from `components/Card.tsx`).
2. **orders/page.tsx** — same header + background removal; 🛒 loading state → `CardSkeleton`; ⋯ menu button → `<Icon name="more" />` inside a 44px button; ▲/▼ → `<Icon name="chevron" />` rotated; the 🟡🟣🟠🟢 quick-commerce marks want real brand logos in `/public/brands/` or plain text pills — the coloured circles read as placeholder.
3. **meal-plan** and **discover** — header/background removal and `SOURCE_LABEL` emoji.
4. Once every page uses `.page-header` as-is, delete `.page-header::after` and `.page-header-btn` from `globals.css` (already omitted in the new file).
