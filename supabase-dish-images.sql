-- GroceryMind — dish images migration
--
-- STATUS: ALREADY APPLIED to production (project cybptxnfnswlckmanzjp,
-- August 2026) as migration `dish_images`. Kept in the repo as the schema
-- record and for rebuilding a fresh environment. Safe to re-run — every
-- statement is guarded.
--
-- WHY THIS EXISTS
-- Until now an image was derived at render time from `youtube_url`, so one
-- column meant two different things: "a picture of the dish" and "a recipe you
-- can watch". Any dish without a YouTube video therefore had no picture, and
-- the only way to give it one was to invent a fake recipe link.
--
-- This splits them. `image_url` is what DishImage renders. `youtube_url` stays
-- exactly what it was and is still the only thing surfaced as "watch recipe".

-- ── 1. Image columns on dishes ────────────────────────────────────────────────
alter table dishes add column if not exists image_url         text;
alter table dishes add column if not exists image_source      text;  -- wikimedia | youtube | corpus
alter table dishes add column if not exists image_attribution text;  -- required for Wikimedia CC reuse
alter table dishes add column if not exists image_checked_at  timestamptz;

-- Find dishes still needing a picture without scanning the whole table.
create index if not exists dishes_missing_image_idx
  on dishes (household_id)
  where image_url is null;

-- ── 2. Global image cache ─────────────────────────────────────────────────────
-- Deliberately NOT scoped to a household. "Aloo Methi" is the same dish in every
-- kitchen, so it should cost one lookup across the entire user base — this is
-- what keeps the YouTube tier inside its ~100 lookups/day free quota.
--
-- Rows with a null image_url are negative cache entries: they stop us hammering
-- Wikipedia for a dish it has never heard of, and expire after 30 days so that
-- newly-written articles get picked up.
create table if not exists dish_images (
  name_key          text primary key,          -- lowercased, punctuation-stripped
  name              text not null,             -- the spelling we first saw
  image_url         text,
  image_source      text,
  image_attribution text,
  youtube_url       text,                      -- only set by the youtube tier
  resolved_at       timestamptz default now()
);

create index if not exists dish_images_resolved_at_idx on dish_images (resolved_at);

-- ── 3. Optional: seed the cache from what the corpus already knows ────────────
-- Every household dish that already carries a YouTube URL is a free cache entry.
insert into dish_images (name_key, name, image_url, image_source, youtube_url, resolved_at)
select
  lower(regexp_replace(name, '[^a-zA-Z0-9]+', ' ', 'g')) as name_key,
  min(name)  as name,
  min('https://i.ytimg.com/vi/' || substring(youtube_url from 'v=([A-Za-z0-9_-]{11})') || '/hqdefault.jpg') as image_url,
  'youtube'  as image_source,
  min(youtube_url) as youtube_url,
  now()
from dishes
where youtube_url is not null
  and youtube_url <> ''
  and substring(youtube_url from 'v=([A-Za-z0-9_-]{11})') is not null
group by 1
on conflict (name_key) do nothing;
