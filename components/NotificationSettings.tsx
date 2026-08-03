'use client'
import { useCallback, useEffect, useState } from 'react'
import {
  pushSupport, subscribeToPush, unsubscribeFromPush,
  isIOS, isStandalone, type PushSupport,
} from '@/lib/push-client'

/**
 * The notifications card in Settings.
 *
 * Most of this component is not the toggle — it's explaining, on iOS, why the
 * toggle isn't there yet. iOS only exposes push to Home Screen apps, and a
 * Safari tab gives no error at all: PushManager simply doesn't exist. Without
 * this explanation the feature looks broken rather than uninstalled.
 */
export default function NotificationSettings({ isAdmin = false }: { isAdmin?: boolean }) {
  const [support, setSupport] = useState<PushSupport | null>(null)
  const [subscribed, setSubscribed] = useState(false)
  const [vapidKey, setVapidKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    setSupport(pushSupport())
    setIos(isIOS() && !isStandalone())
    fetch('/api/push/subscribe')
      .then(r => r.json())
      .then(d => {
        setSubscribed(Boolean(d?.subscribed))
        setVapidKey(d?.vapidPublicKey || null)
      })
      .catch(() => {})
  }, [])

  const toggle = useCallback(async () => {
    setBusy(true)
    setNote(null)
    try {
      if (subscribed) {
        await unsubscribeFromPush()
        setSubscribed(false)
        setNote('Notifications off.')
      } else {
        if (!vapidKey) { setNote('Push keys not configured on the server yet.'); return }
        const res = await subscribeToPush(vapidKey)
        if (res.ok) {
          setSubscribed(true)
          setNote('On. You\'ll get one nudge before your usual decision time.')
        } else if (res.error === 'denied') {
          // Browsers only ask once — this state is effectively permanent.
          setNote('Blocked. Enable notifications for this app in your device settings.')
        } else {
          setNote(`Couldn't turn on notifications (${res.error}).`)
        }
      }
    } finally {
      setBusy(false)
    }
  }, [subscribed, vapidKey])

  const sendTest = useCallback(async () => {
    setBusy(true)
    setNote(null)
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      const data = await res.json()
      setNote(data.note || data.error || 'Sent.')
    } catch {
      setNote('Test failed.')
    } finally {
      setBusy(false)
    }
  }, [])

  const label = { fontSize: 12, fontWeight: 700, color: 'var(--green-deep)', marginBottom: 6,
                  textTransform: 'uppercase' as const, letterSpacing: '0.05em', opacity: 0.6 }
  const bodyText = { fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }

  // ── iOS, not installed: the toggle would do nothing, so don't show one ──────
  if (ios || support?.ok === false && support.reason === 'ios-needs-install') {
    return (
      <div className="card" style={{ padding: 16 }}>
        <p style={label}>🔔 Daily nudge</p>
        <p style={bodyText}>
          On iPhone, notifications only work once GroceryMind is on your Home Screen.
        </p>
        <ol style={{ ...bodyText, paddingLeft: 18, marginBottom: 0 }}>
          <li>Tap the <strong>Share</strong> button in Safari</li>
          <li>Choose <strong>Add to Home Screen</strong></li>
          <li>Open GroceryMind from the new icon, then come back here</li>
        </ol>
      </div>
    )
  }

  if (support?.ok === false) {
    const why = support.reason === 'denied'
      ? 'Notifications are blocked for this app. You can re-enable them in your device settings.'
      : 'This browser doesn\'t support push notifications.'
    return (
      <div className="card" style={{ padding: 16 }}>
        <p style={label}>🔔 Daily nudge</p>
        <p style={{ ...bodyText, marginBottom: 0 }}>{why}</p>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <p style={label}>🔔 Daily nudge</p>
      <p style={bodyText}>
        One notification before you usually decide, naming tonight&apos;s dish. Nothing is sent
        once the meal is already locked.
      </p>

      <button onClick={toggle} disabled={busy} style={{
        width: '100%', padding: '12px', borderRadius: 12, border: 'none',
        background: busy ? 'var(--green-soft)' : subscribed ? 'var(--green-pale)' : 'var(--green-mid)',
        color: subscribed ? 'var(--green-deep)' : 'white',
        fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer',
      }}>
        {busy ? 'Working…' : subscribed ? '✓ Notifications on — tap to turn off' : 'Turn on notifications'}
      </button>

      {subscribed && isAdmin && (
        <button onClick={sendTest} disabled={busy} style={{
          width: '100%', marginTop: 8, padding: '10px', borderRadius: 12,
          border: '1px solid var(--border)', background: 'white',
          fontSize: 13, cursor: 'pointer', color: 'var(--text-muted)',
        }}>
          Send me a test notification
        </button>
      )}

      {note && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '10px 0 0', lineHeight: 1.5 }}>
          {note}
        </p>
      )}
    </div>
  )
}
