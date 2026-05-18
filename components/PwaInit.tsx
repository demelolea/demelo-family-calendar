'use client'

import { useEffect } from 'react'

/**
 * Silently registers the service worker on mount.
 * Rendered once in RootLayout — has no visible UI.
 */
export default function PwaInit() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(err => console.warn('SW registration failed:', err))
    }
  }, [])
  return null
}
