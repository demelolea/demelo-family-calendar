'use client'

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'demelo_notif_prompt'   // 'shown' | 'granted' | 'denied'

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4)
  const base64  = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

interface Props {
  currentUser: string
}

export default function NotificationPrompt({ currentUser }: Props) {
  const [show, setShow]     = useState(false)
  const [state, setState]   = useState<'idle' | 'loading' | 'done' | 'denied'>('idle')

  useEffect(() => {
    // Don't show if:
    // • notifications not supported
    // • already handled (shown/granted/denied)
    // • permission already granted (re-subscribe silently instead)
    if (typeof Notification === 'undefined') return
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return

    // Show the prompt after a brief delay (let the page settle first)
    const t = setTimeout(() => setShow(true), 3000)
    return () => clearTimeout(t)
  }, [])

  const dismiss = () => {
    setShow(false)
    localStorage.setItem(STORAGE_KEY, 'shown')
  }

  const enable = async () => {
    setState('loading')
    try {
      // 1. Request browser permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState('denied')
        localStorage.setItem(STORAGE_KEY, 'denied')
        setTimeout(() => setShow(false), 2000)
        return
      }

      // 2. Get SW registration
      const reg = await navigator.serviceWorker.ready

      // 3. Subscribe to push
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) throw new Error('VAPID key not configured')

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      // 4. Send subscription to server
      await fetch('/api/push/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ person: currentUser, subscription: sub.toJSON() }),
      })

      setState('done')
      localStorage.setItem(STORAGE_KEY, 'granted')
      setTimeout(() => setShow(false), 2000)
    } catch (err) {
      console.error('Push subscribe failed:', err)
      setState('idle')
    }
  }

  if (!show) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto">
      <div className="bg-white border border-stone-200 rounded-2xl shadow-xl p-4">
        {state === 'done' ? (
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔔</span>
            <div>
              <p className="text-sm font-semibold text-stone-800">Notifications on!</p>
              <p className="text-xs text-stone-400">You'll hear about family updates.</p>
            </div>
          </div>
        ) : state === 'denied' ? (
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔕</span>
            <div>
              <p className="text-sm font-semibold text-stone-800">Notifications blocked</p>
              <p className="text-xs text-stone-400">You can enable them in browser settings.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl flex-shrink-0">🔔</span>
              <div>
                <p className="text-sm font-semibold text-stone-800">Stay in the loop</p>
                <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                  Get notified when someone adds a stay, updates Phoebe's schedule,
                  or assigns a guest room. No spam — only real family changes.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={dismiss}
                className="flex-1 py-2 border border-stone-200 rounded-xl text-sm text-stone-500 hover:bg-stone-50 transition-colors"
              >
                Not now
              </button>
              <button
                onClick={enable}
                disabled={state === 'loading'}
                className="flex-1 py-2 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-700 transition-colors disabled:opacity-50"
              >
                {state === 'loading' ? 'Setting up…' : 'Enable notifications'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
