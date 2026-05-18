'use client'

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'demelo_install_prompt'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPrompt() {
  const [show, setShow]         = useState(false)
  const [isIos, setIsIos]       = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Already dismissed or installed
    if (localStorage.getItem(STORAGE_KEY)) return

    // Already running as standalone PWA — don't show
    if (window.matchMedia('(display-mode: standalone)').matches) return

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as { MSStream?: unknown }).MSStream
    setIsIos(ios)

    if (ios) {
      // iOS can't be prompted — show instructions after a delay
      const t = setTimeout(() => setShow(true), 5000)
      return () => clearTimeout(t)
    }

    // Android / Chrome — wait for browser's beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const dismiss = () => {
    setShow(false)
    localStorage.setItem(STORAGE_KEY, 'dismissed')
  }

  const install = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    localStorage.setItem(STORAGE_KEY, outcome === 'accepted' ? 'installed' : 'dismissed')
    setShow(false)
    setDeferredPrompt(null)
  }

  if (!show) return null

  return (
    <div className="fixed top-14 left-0 right-0 z-30 px-4 pt-2">
      <div className="bg-stone-800 text-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3">
        <div className="text-xl flex-shrink-0">📲</div>
        <div className="flex-1 min-w-0">
          {isIos ? (
            <>
              <p className="text-sm font-semibold leading-snug">Add to Home Screen</p>
              <p className="text-xs text-stone-300 mt-0.5">
                Tap <span className="font-medium">Share ⬆</span> then <span className="font-medium">Add to Home Screen</span>
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold leading-snug">Install De Melo</p>
              <p className="text-xs text-stone-300 mt-0.5">Add to your home screen for quick access</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isIos && (
            <button
              onClick={install}
              className="text-xs font-semibold bg-white text-stone-800 px-3 py-1.5 rounded-xl hover:bg-stone-100 transition-colors"
            >
              Install
            </button>
          )}
          <button
            onClick={dismiss}
            className="text-stone-400 hover:text-white transition-colors text-lg leading-none px-1"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
