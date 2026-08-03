/**
 * lib/push-client.ts — browser-side push helpers.
 *
 * The iOS rules that shape all of this:
 *   - PushManager does not exist in a Safari tab. It appears only once the app
 *     has been added to the Home Screen and opened from that icon. So
 *     "unsupported" and "not installed yet" look identical unless we check
 *     standalone mode explicitly — hence `pushSupport()` returning a reason
 *     rather than a boolean.
 *   - The permission prompt must be triggered by a real user gesture.
 *   - A denial is effectively permanent. We get one ask, ever.
 */

export type PushSupport =
  | { ok: true }
  | { ok: false; reason: 'no-sw' | 'no-push' | 'ios-needs-install' | 'denied' }

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ reports as Mac; the touch check disambiguates.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** True when running as an installed Home Screen app rather than a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
}

export function pushSupport(): PushSupport {
  if (typeof window === 'undefined') return { ok: false, reason: 'no-sw' }
  if (!('serviceWorker' in navigator)) return { ok: false, reason: 'no-sw' }

  if (!('PushManager' in window)) {
    // On iOS this is almost always "you're in a Safari tab", not "your device
    // can't do this" — and telling the user the wrong one loses them.
    return { ok: false, reason: isIOS() && !isStandalone() ? 'ios-needs-install' : 'no-push' }
  }

  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
    return { ok: false, reason: 'denied' }
  }

  return { ok: true }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalised)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch {
    return null
  }
}

/**
 * Ask for permission and subscribe. MUST be called from a click handler —
 * Safari ignores permission requests that aren't tied to a user gesture.
 */
export async function subscribeToPush(vapidPublicKey: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const support = pushSupport()
  if (!support.ok) return { ok: false, error: support.reason }
  if (!vapidPublicKey) return { ok: false, error: 'no-vapid-key' }

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return { ok: false, error: 'denied' }

    const reg = (await navigator.serviceWorker.getRegistration())
      || (await registerServiceWorker())
    if (!reg) return { ok: false, error: 'no-sw' }
    await navigator.serviceWorker.ready

    // Reuse an existing subscription if there is one; re-subscribing with a
    // different key silently produces pushes that never decrypt.
    const existing = await reg.pushManager.getSubscription()
    const subscription = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    })

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription }),
    })
    if (!res.ok) return { ok: false, error: 'save-failed' }

    return { ok: true }
  } catch (err) {
    return { ok: false, error: (err as Error)?.message || 'subscribe-failed' }
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    const endpoint = sub?.endpoint
    await sub?.unsubscribe()
    await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    })
    return true
  } catch {
    return false
  }
}

/**
 * Consume the destination the service worker stashed before calling
 * openWindow. This is the iOS deep-link workaround: openWindow frequently
 * ignores its URL there and boots start_url instead, so the intended target is
 * left in the Cache API for the app to pick up on launch.
 */
export async function takePendingTarget(): Promise<string | null> {
  try {
    if (!('caches' in window)) return null
    const cache = await caches.open('gm-push')
    const res = await cache.match('/__pending-target')
    if (!res) return null
    const url = await res.text()
    await cache.delete('/__pending-target')
    return url || null
  } catch {
    return null
  }
}
