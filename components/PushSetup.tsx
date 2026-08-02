'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { registerServiceWorker, takePendingTarget } from '@/lib/push-client'

/**
 * Mounted once in the root layout. Two jobs, both invisible:
 *
 *   1. Register the service worker so a push can be received at all.
 *   2. Complete deep links that the service worker couldn't finish itself.
 *
 * On (2): tapping a notification should land on that slot's lock screen, not
 * the dashboard. Where a window is already open the worker posts a message and
 * we route in-page. On a cold start — which on iOS routinely ignores the URL
 * given to openWindow and boots start_url instead — the worker leaves the
 * destination in the Cache API and we pick it up here.
 */
export default function PushSetup() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    registerServiceWorker()

    // Cold start: did a notification tap put us here?
    takePendingTarget().then(target => {
      if (!cancelled && target) router.replace(target)
    })

    // Warm start: the worker focused an existing window and told us where to go.
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'gm-navigate' && event.data.url) {
        router.push(event.data.url as string)
      }
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)

    return () => {
      cancelled = true
      navigator.serviceWorker?.removeEventListener('message', onMessage)
    }
  }, [router])

  return null
}
