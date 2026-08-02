-- GroceryMind — push notifications migration
--
-- Run in the Supabase SQL Editor. Sections 1–2 are safe to re-run.
-- Section 3 (pg_cron) needs your production URL and CRON_SECRET filled in and
-- should only be run ONCE the app is deployed with those env vars set.
--
-- WHY pg_cron RATHER THAN VERCEL CRON
-- Vercel's Hobby plan caps cron at once per day, fires at an imprecise moment
-- within the hour, and only understands UTC. The nudge needs per-household
-- timing in IST and both a lunch and a dinner slot, so a daily UTC trigger
-- cannot express it. pg_cron gives a real 15-minute tick for free, inside
-- infrastructure we already run.
--
-- The cron itself stays deliberately dumb — it just pings the endpoint. All
-- the "is this household due, have they already locked, have we already sent"
-- logic lives in app/api/push/send/route.ts where it can be read and tested.

-- ── 1. Subscriptions ──────────────────────────────────────────────────────────
-- Keyed on endpoint rather than user: one person can have several devices, and
-- browsers rotate endpoints. Upserting on endpoint prevents duplicate rows.
create table if not exists push_subscriptions (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references users(id) on delete cascade,
  household_id uuid references households(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists push_subscriptions_user_idx      on push_subscriptions (user_id);
create index if not exists push_subscriptions_household_idx on push_subscriptions (household_id);

-- ── 2. Send log ───────────────────────────────────────────────────────────────
-- Doubles as the idempotency guard and the measurement table. The unique
-- constraint is what makes a double-fired tick harmless.
create table if not exists notification_log (
  id           uuid primary key default uuid_generate_v4(),
  household_id uuid references households(id) on delete cascade,
  send_date    date not null,
  slot         text not null,
  kind         text not null default 'meal_nudge',
  dish_name    text,
  recipients   int default 0,
  created_at   timestamptz default now()
);

create unique index if not exists notification_log_unique_idx
  on notification_log (household_id, send_date, slot, kind);

-- ── 3. The heartbeat ──────────────────────────────────────────────────────────
-- RUN THIS PART ONLY AFTER DEPLOYING with CRON_SECRET set in Vercel.
-- Replace both placeholders first.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove any previous schedule so this block is re-runnable.
select cron.unschedule('grocerymind-nudge')
where exists (select 1 from cron.job where jobname = 'grocerymind-nudge');

select cron.schedule(
  'grocerymind-nudge',
  '*/15 * * * *',          -- every 15 min UTC; the endpoint decides who is due
  $$
  select net.http_post(
    url     := 'https://groccerymind.vercel.app/api/push/send',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'x-cron-secret', 'YOUR_CRON_SECRET'
               ),
    body    := '{}'::jsonb
  );
  $$
);

-- Useful afterwards:
--   select * from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 20;
--   select * from notification_log order by created_at desc limit 20;
