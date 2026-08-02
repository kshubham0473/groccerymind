/**
 * GroceryMind service worker — push notifications only.
 *
 * Deliberately NOT a caching service worker. Adding offline caching here would
 * fight Next.js's own asset handling and the stale-while-revalidate layer in
 * lib/page-cache.ts. This file exists to receive pushes and route taps.
 *
 * ── iOS reality (read this before changing anything) ─────────────────────────
 * 1. Push only works when the app was added to the Home Screen. In a Safari
 *    tab, PushManager does not exist and everything here is dead code.
 * 2. `actions` (notification buttons) are IGNORED on iOS — only the default
 *    "View" is shown. They render on Android. So the one-tap "Lock it" flow is
 *    an Android-only enhancement and tapping the body must always work.
 * 3. `clients.openWindow(url)` is unreliable on iOS: the PWA opens but often
 *    lands on start_url instead of the URL passed. We therefore stash the
 *    intended destination in the Cache API BEFORE calling openWindow, and the
 *    app reads it on boot (see components/PushSetup.tsx). Do not "simplify"
 *    this back to a bare openWindow — it silently breaks deep linking on iOS.
 */

const PENDING_CACHE = 'gm-push'
const PENDING_KEY = '/__pending-target'

/** Take over as soon as possible so the first push after install works. */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// ── Receiving a push ──────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'GroceryMind', body: event.data ? event.data.text() : '' }
  }

  const {
    title = 'GroceryMind',
    body = '',
    url = '/dashboard',
    tag = 'grocerymind',
    actions = [],
    actionToken = null,
    lock = null,
  } = payload

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,                    // same tag replaces rather than stacks
      renotify: false,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // Ignored on iOS, rendered on Android.
      actions,
      data: { url, actionToken, lock },
    })
  )
})

// ── Tapping the notification (or one of its buttons) ──────────────────────────
self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data || {}
  const action = event.action
  event.notification.close()

  event.waitUntil(handleClick(action, data))
})

async function handleClick(action, data) {
  // Android-only fast path: lock straight from the shade, never opening the app.
  // The token is a short-lived JWT minted by the send endpoint, so the service
  // worker needs no cookie and no session of its own.
  if (action === 'lock' && data.actionToken && data.lock) {
    try {
      const res = await fetch('/api/push/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: data.actionToken,
          action: 'lock',
          lock_date: data.lock.lock_date,
          slot: data.lock.slot,
          dish_name: data.lock.dish_name,
          dish_id: data.lock.dish_id || null,
        }),
      })
      if (res.ok) {
        await self.registration.showNotification('Locked', {
          body: `${data.lock.dish_name} for ${data.lock.slot}.`,
          tag: 'grocerymind-confirm',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
        })
        return
      }
    } catch {
      // Fall through and open the app so the decision is still reachable.
    }
  }

  // "Something else", a failed quick-lock, or a plain tap (always the iOS case).
  const target = action === 'other' && data.lock
    ? `/discover?lockSlot=${data.lock.slot}&lockDate=${data.lock.lock_date}`
    : (data.url || '/dashboard')

  await openApp(target)
}

async function openApp(target) {
  const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })

  // Already open somewhere — focus it and route in-page. This path is reliable
  // on both platforms because it never depends on openWindow honouring a URL.
  for (const client of all) {
    if ('focus' in client) {
      try {
        await client.focus()
        client.postMessage({ type: 'gm-navigate', url: target })
        return
      } catch {
        /* try the next client */
      }
    }
  }

  // Cold start. Stash the destination first — on iOS openWindow frequently
  // ignores the URL and boots start_url, and the app picks this up instead.
  try {
    const cache = await caches.open(PENDING_CACHE)
    await cache.put(PENDING_KEY, new Response(target))
  } catch {
    /* non-fatal — worst case the user lands on the dashboard */
  }

  try {
    await self.clients.openWindow(target)
  } catch {
    await self.clients.openWindow('/dashboard')
  }
}

// ── Subscription rotation ─────────────────────────────────────────────────────
// Browsers silently rotate endpoints. Without this the subscription goes stale
// and pushes stop arriving with no visible error anywhere.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      const sub = await self.registration.pushManager.subscribe(
        event.oldSubscription?.options || { userVisibleOnly: true }
      )
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub, rotated: true }),
      })
    } catch {
      /* the app re-subscribes on next open */
    }
  })())
})
