# Push notifications — setup and iOS testing

Everything is written and compiles. This is the sequence to get a notification onto your iPhone, and the list of things that will look broken but aren't.

---

## Part 1 — Setup (once)

### 1. Install the dependency

```bash
cd ~/Documents/GitHub/groccerymind
npm install
```

Adds `web-push` and `@types/web-push`.

### 2. Generate VAPID keys

```bash
npx web-push generate-vapid-keys
```

Prints a public and a private key. These identify *your server* to Apple's and Google's push services. Generate once and keep them — regenerating invalidates every existing subscription.

### 3. Add four env vars in Vercel

Vercel → `groccerymind` → Settings → Environment Variables → **Production**:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | the public key from step 2 |
| `VAPID_PRIVATE_KEY` | the private key from step 2 |
| `VAPID_SUBJECT` | `mailto:kshubham0473@gmail.com` |
| `CRON_SECRET` | any long random string — `openssl rand -hex 32` |

**Then redeploy.** Env changes don't reach the running build until a fresh deploy — the same gotcha noted in the handover.

### 4. Push the code

```bash
git add -A && git commit -m "Push notifications" && git push
```

### 5. Schedule the heartbeat

Only after step 4's deploy is live. Open `supabase-push.sql`, go to **section 3**, replace `YOUR_CRON_SECRET` with the value from step 3, and run that section in the Supabase SQL Editor.

The URL is already filled in as `https://groccerymind.vercel.app`.

Sections 1 and 2 are **already applied** — I ran them via MCP. `push_subscriptions` and `notification_log` exist.

---

## Part 2 — Getting it onto your iPhone

This is where iOS is fussy. Follow exactly.

### 1. Add to Home Screen

Open `https://groccerymind.vercel.app` **in Safari** (not Chrome — on iOS only Safari can install a PWA that receives push).

Share → **Add to Home Screen** → Add.

### 2. Open from the Home Screen icon

Not from Safari. **This is the step everything depends on.** In a Safari tab, `PushManager` does not exist, the toggle won't appear, and nothing will explain why.

### 3. Log in again

⚠️ **The installed app has its own cookie jar, separate from Safari.** You will be logged out and need to sign in again. This surprises people — it isn't a bug.

### 4. Turn on notifications

Settings → **Daily nudge** → *Turn on notifications* → Allow.

Must be a real tap. Safari ignores permission requests not tied to a user gesture, which is why there's no auto-prompt.

### 5. Send yourself a test

Settings → *Send me a test notification* (admin only).

If it arrives, the entire chain works: service worker → subscription → VAPID → Apple's push service → your device.

---

## Part 3 — What will look broken on iOS but isn't

**No "Lock it" / "Something else" buttons.** iOS ignores self-defined notification actions and shows only the default. Those buttons are in the payload and will appear on Android. On your iPhone you'll only ever see the title and body.

This is the single biggest limitation, and it's why the notification body tap is wired to open the lock screen directly — that's the iOS path to the same outcome, one tap slower.

**Notification opens the app, briefly showing the dashboard, then jumps to the lock screen.** Expected. iOS often ignores the URL passed to `openWindow` and boots `start_url` instead. The service worker stashes the intended destination in the Cache API first and `PushSetup.tsx` picks it up on launch. The redirect may be visible for a moment.

**Nothing arrives when the app is in the foreground.** Normal — iOS suppresses banners for the active app.

**No devtools.** You can't inspect a Home Screen app. Debug from the server side instead:

```bash
# What would go out right now, without sending anything
curl -X POST 'https://groccerymind.vercel.app/api/push/send?dry=1' \
  -H 'Cookie: <your session cookie>'

# Force a real send regardless of the time window
curl -X POST 'https://groccerymind.vercel.app/api/push/send?force=1' \
  -H 'x-cron-secret: YOUR_CRON_SECRET'
```

And in Supabase:

```sql
select * from push_subscriptions;                              -- did the device register?
select * from notification_log order by created_at desc;       -- what has been sent
select * from cron.job_run_details order by start_time desc limit 20;
```

---

## How the timing actually works

The cron is a dumb 15-minute tick. All decisions live in `app/api/push/send/route.ts`:

- **Slot** — lunch before 15:00 IST, dinner after. Mirrors the dashboard's `activeSlot()`.
- **Send time** — defaults to 11:00 (lunch) and 17:00 (dinner) IST. Once a household has 5+ locks logged, it switches to *their* median lock time minus 30 minutes, so the nudge lands before they'd normally decide.
- **Suppression** — nothing is sent if the slot is already locked, if a nudge already went out today for that slot, or if no dishes are planned.
- **Idempotency** — `notification_log` has a unique key on `(household_id, send_date, slot, kind)`, so a double-fired tick cannot double-send.

Everything is UTC in the database and IST in the logic; `lib/daily-pick.ts` does the conversion with a fixed +05:30 offset (India has no DST, so this is exact rather than approximate).

---

## A thing this fixed on the way past

The notification has to *name* a dish, and that name must match what you see when you open the app. The dashboard was picking client-side (`options[pick % length]`), so two people in the same household could see different answers — the open item in README-PATCH.

`lib/daily-pick.ts` makes the pick a pure function of `(household, date, slot)` via FNV-1a. Deterministic, identical for both partners and the server, no new table, no write. The send endpoint uses it now; **the dashboard still doesn't** — worth switching it over so the app and the notification can never disagree.

---

## What to measure once it's running

From the doc, the number that matters is **locks made without opening the app**. Every push-driven lock writes `metadata.source = 'push_action'` to `behaviour_log`:

```sql
select
  count(*) filter (where metadata->>'source' = 'push_action') as from_notification,
  count(*) filter (where metadata->>'source' is null)          as from_app
from behaviour_log
where event_type = 'meal_locked'
  and created_at > now() - interval '30 days';
```

On iOS that first number stays 0 by construction — no action buttons means no shade-locking. It only becomes meaningful with Android users. Until then the honest iOS metric is *notification → lock within 10 minutes*, which you can get by joining `notification_log` to `daily_locks` on date and slot.
