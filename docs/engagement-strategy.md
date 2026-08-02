# GroceryMind — Engagement Strategy

**Date:** August 2026
**Status:** Thinking document. Nothing here is built. Decisions marked ⬜ are open.
**Companion to:** handover v3, "The core engagement problem"

---

## 0. The one-line reframe

> **The notification is the product surface, not the doorbell.**

Every engagement idea in this doc gets judged against that sentence. A notification that says *"Open GroceryMind to plan dinner"* has already failed — it asks the user to do the very thing they don't want to do. A notification that says *"Tonight: Rajma Chawal. [Lock it] [Something else]"* has succeeded **even if they never open the app**, because the decision — the actual product — got made.

This matters for sequencing. If the notification is a doorbell, you optimise for open rate and you're competing with Instagram. If the notification is the surface, you optimise for *decisions completed*, and the app becomes a place people visit occasionally rather than daily. The second target is far more winnable.

The handover's north star says a user should "lock today's meals in under 10 seconds." The logical end state of that sentence is **zero seconds in the app**.

---

## 1. Why the current situation is hard (state it honestly)

The blocker isn't a missing feature. It's that:

1. **The decision happens off-app**, in someone's head, around 6pm, often while doing something else.
2. **By the time the app is opened, the decision is already made** — so the app's suggestions arrive as second-guessing rather than relief.
3. **The consequences also happen off-app** — they order on Blinkit, they cook, they don't come back to tell us.

So there are three separate leaks, and notifications only address the first one. A strategy that only ships push will move the first number and leave the other two.

| Leak | What's lost | Lever |
|---|---|---|
| Decision made off-app | The core value prop | Timed nudge with the decision inside it |
| Ordering done off-app | Pantry accuracy → future suggestions degrade | Ride the existing shopping habit (§4.2) |
| Cooking not reported back | `behaviour_log` starves, learning stalls | One-tap check-in *from the notification* (§4.1) |

**The compounding risk:** leak 3 feeds leak 1. If nobody marks meals cooked, the learning context has nothing to learn from, suggestions stay generic, and the nudge gets less relevant over time — which makes it easier to ignore. Engagement and suggestion quality are the same problem.

---

## 2. Platform reality (verified August 2026)

### 2.1 Web push on Android — viable, and better than expected

- Works properly in Chrome on Android. No install step needed beyond a permission prompt.
- **Supports notification action buttons.** This is the important part: a service worker can render `[Lock it] [Something else]` and handle the tap in `notificationclick` without ever opening the app. One-tap locking from the shade is real.
- India is roughly 75–80% Android, so this single channel covers the large majority of the addressable base.
- Cost: free. Infra: VAPID keys, a `web-push` send, a service worker, and a Vercel cron to trigger. All within the existing free-tier stack.

**Caveat to plan for:** Android OEM battery optimisation (Xiaomi, Oppo, Vivo, Samsung are aggressive in India) can delay or suppress background pushes. Treat delivery as best-effort and measure *delivered*, not *sent*.

### 2.2 Web push on iOS — the gap

- Push works **only for PWAs installed to the Home Screen** (iOS 16.4+). Not in the Safari tab.
- So the funnel is: visit → *Share → Add to Home Screen* → open from icon → grant permission. Every step leaks, and the middle one is a manual gesture most users have never performed.
- iOS 26 helps at the margin (Home Screen sites now default to opening as web apps), but it does not remove the install step.
- Push is unavailable for web apps in the EU — irrelevant for this user base, noted for completeness.

**Implication:** don't treat iOS as "covered" by shipping web push. Ship it, add an explicit iOS install prompt, and **measure the install-to-permission conversion**. If it lands under ~20%, iOS engagement needs either WhatsApp or a native wrapper — that measurement is the decision input, not a guess.

### 2.3 WhatsApp — highest ceiling, heaviest setup

- Utility templates in India: **~₹0.13 per message**, among the cheapest rates globally. Free when sent inside the 24-hour customer service window (i.e. after the user replies).
- At 100 households × 1 message/day ≈ **₹13/day ≈ ₹400/month**. At 1,000 households ≈ ₹4,000/month.
- **Cost is not the barrier.** The barrier is Meta Business verification, template approval, and picking a BSP (AiSensy, Interakt, Gupshup, Twilio). That's days-to-weeks of lead time and a recurring platform fee on top of per-message cost.
- Quick-reply buttons on templates work, and replies hit your webhook — so *"Tonight: Rajma Chawal [Lock it] [Something else]"* is fully expressible, on every platform, with no install step and no permission prompt.

**Why it's tempting:** it solves iOS, solves the install problem, and solves the permission problem simultaneously. **Why it should still wait:** you don't yet know whether people act on the nudge at all. Learn that on the free channel first.

### 2.4 What is *not* available

- **Home screen widgets** — native only. A widget showing tonight's dish would be the single best fit for this product's psychology (glanceable, no open required, sits where the decision happens). Worth noting as the strongest argument for an eventual native app, alongside reliable push.
- **SMS** — DLT template registration in India plus per-message cost, with worse interactivity than WhatsApp. No reason to prefer it.

---

## 3. Sequencing recommendation

**Ship in this order. Each stage produces the number that justifies the next.**

### Stage 1 — Web push, Android-first (free, ~1 sprint)

Scope:
- VAPID keys, service worker, `push_subscriptions` table, permission prompt at the right moment (see §5.1).
- One daily nudge per household per slot, at a **learned** time (§5.2).
- **Action buttons: `[Lock it]` `[Something else]`.** Locking completes in the shade.
- Deep link, when opened, goes to *that slot's lock screen* — never the homepage.
- Suppression: never send for a slot that's already locked.

**The number this produces:** action rate — decisions completed per notification delivered. This is the headline metric for the whole strategy.

### Stage 2 — Partner signals (free, small, high leverage — §4.3)

Ship immediately after Stage 1 since it reuses the same infrastructure entirely.

### Stage 3 — Decide iOS, using data

Measure Home-Screen-install conversion during Stages 1–2. Then choose: iOS install push, WhatsApp, or accept iOS as a lower-engagement segment for now.

### Stage 4 — WhatsApp, only if Stage 1 earned it

If action rate is healthy (people *do* respond to a well-timed decision), WhatsApp extends a proven mechanic to everyone with no install friction — clearly worth the setup. If action rate is poor, WhatsApp would just be a more expensive way to be ignored, and the real problem is the *content* of the nudge, not the channel.

⬜ **Open decision:** whether to start Meta business verification in parallel during Stage 1, purely to absorb the lead time. Costs nothing but attention; the risk is sunk-cost pressure to use it.

---

## 4. Levers beyond the daily nudge

### 4.1 The cooked-it loop must close *in the notification*

The handover proposes an end-of-day "Did you cook tonight? Yes/No" check-in. Correct instinct — but it should never be a screen. It's a 9pm notification with two buttons, resolved in the shade.

Why it matters more than it looks: this is the only thing that feeds `behaviour_log` with ground truth about what actually got eaten. Every suggestion improvement downstream depends on it. It's a data-collection mechanism disguised as engagement.

The honest framing matters too: *"Did you cook tonight?"* with a real "No" option normalises the plan not happening. A guilt-free "No" gets answered; a "Mark as cooked ✅" button only gets pressed by people who cooked, which biases the log.

### 4.2 Ride the shopping habit instead of manufacturing a cooking habit

**This is the most under-used asset in the product.**

Creating a new 6pm habit from nothing is genuinely hard — it's the hardest thing in consumer product. But an adjacent habit *already exists and is already daily-ish*: people open a list when they're ordering on Blinkit/Zepto or standing in a shop. That moment has its own trigger (I'm about to buy things), needs no reminder, and already brings them to the Orders screen.

The move is to attach the meal decision to that existing moment rather than compete with it:

- When the order list is opened, surface one line: *"Tonight's pick is Paneer Butter Masala — it needs paneer, not on your list."*
- After items are checked off: *"You've got everything for Rajma Chawal. Lock it for tomorrow?"*

This costs no notification budget, no permission, and no new habit. It's the cheapest engagement work available and it's currently not being done at all.

### 4.3 The partner is a better notification than the app is

GroceryMind is multiplayer — two people per household — and every engagement idea so far has been app→user. But *user→user* signals are categorically stronger, because social obligation beats software reminders and because they make locking feel consequential:

- *"Priya locked dinner: Rajma Chawal"* → to the partner.
- *"Shubham added 4 things to the list"* → to the partner.
- *"Nobody's locked dinner yet"* → to both, once, at the learned time.

Near-zero incremental cost on top of Stage 1: same push infrastructure, no content generation, no AI call. And it converts a solo utility into something with a second person on the other end — which is a different and much stickier product.

⬜ **Open decision:** default on or off? Notifying a partner about your actions has a mild surveillance quality. Recommend: **on by default for locks** (it's the shared decision — the whole point) and **off by default for pantry/list edits** (that's chores, and it's noise).

### 4.4 Streaks — a caution, not a recommendation

The handover lists "make the streak feel like an achievement." Worth pushing back on the standard implementation.

Duolingo-style streaks work through loss aversion: the fear of breaking the chain. That mechanic fights this product's stated soul ("a warm Indian kitchen, not a logistics tool") and it punishes ordinary life — travel, eating out, a bad week. A broken streak is a reason to stop opening the app, so the mechanic that drives engagement early actively causes churn later.

The same warmth without the trap: **retrospective, unbreakable, generous.**

- *"You cooked 11 different dishes in July."*
- *"Rajma Chawal was your most-cooked dish this month."*
- *"You've been trying more South Indian food lately."*

These reward looking back rather than threatening a loss, they can't be broken, and they suit the editorial tone the UI sprints established. They also make the monthly/weekly insight card worth opening — which is the actual goal.

---

## 5. Design details that decide whether this works

### 5.1 When to ask for notification permission

Not on first load. A cold permission prompt gets denied, and browser denials are effectively permanent — you get one attempt per user, ever.

Ask **immediately after the first successful lock**, when the value has just been demonstrated and the ask is legible: *"Want me to remind you at this time tomorrow?"* That framing is also literally what the notification does, so the permission and the feature are the same idea.

### 5.2 Learn the send time — do not hard-code 11am/5pm

Fixed times are a guess, and a nudge that arrives after the decision is worse than no nudge: it trains people to dismiss.

`behaviour_log` already carries lock timestamps. Use them:

- Default to 11:00 / 17:00 for a new household (a reasonable prior, nothing more).
- After ~5 locks, shift to **30 minutes before that household's median lock time** for that slot.
- Suppress entirely once the slot is locked.
- Weekend vs weekday are different distributions — segment them.

### 5.3 Notification copy

Three rules, all following from §0:

1. **Name the dish.** *"Tonight: Paneer Butter Masala"* — not *"Your dinner suggestion is ready"*. The dish name is the product; a teaser wastes the one surface that matters.
2. **One decision, two buttons.** `[Lock it]` and `[Something else]`. Not three options — this exists to end decision fatigue, not relocate it.
3. **Never guilt.** *"You haven't logged in for 3 days"* is a churn accelerant. If there's nothing useful to say, send nothing.

### 5.4 Frequency ceiling

Maximum **two per day** (one meal nudge, one evening check-in), and only when they have a job to do. The failure mode is a muted channel, and muting is unrecoverable.

---

## 6. What to measure

Instrument these from day one of Stage 1 — retrofitting metrics is how you end up with opinions instead of decisions.

| Metric | Why | Rough target |
|---|---|---|
| **Action rate** = decisions completed ÷ notifications delivered | The headline number. Justifies or kills Stage 4. | >15% |
| Delivered ÷ sent | Exposes Android OEM battery suppression | >85% |
| Permission grant rate | Validates the §5.1 timing | >50% |
| iOS Home-Screen install rate | The Stage 3 decision input | measure, no target |
| Locks made **without** opening the app | Proves the §0 thesis | rising over time |
| Cook check-in response rate | Health of the learning loop | >40% |
| Notification → mute/disable rate | The early warning for over-sending | <5% |

**The one to watch:** *locks without opening the app.* If it rises, the reframe is correct and the product is becoming ambient. If engagement only comes from app opens, the notification is still a doorbell and the copy needs work before any more channels get added.

---

## 7. Summary of open decisions

| ⬜ | Decision | Recommendation |
|---|---|---|
| 1 | Start Meta/WhatsApp verification in parallel with Stage 1? | Lean no — let Stage 1 data justify it |
| 2 | Partner notifications default on or off? | On for locks, off for pantry/list edits |
| 3 | Streaks, or retrospective insights? | Retrospective — streaks fight the product's tone |
| 4 | Explicit iOS "Add to Home Screen" prompt in onboarding? | Yes, but only after a first lock (same trigger as §5.1) |
| 5 | Is a native app on the roadmap at all? | Not yet — but widgets + reliable push are the case for it |
