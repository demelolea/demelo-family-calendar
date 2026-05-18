// De Melo Family Calendar — Service Worker
// Handles push notifications and basic offline caching

const CACHE = 'demelo-v1'
const OFFLINE_URLS = ['/']

// ── Install ───────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(OFFLINE_URLS)).then(() => self.skipWaiting())
  )
})

// ── Activate ─────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// ── Fetch — network-first, fall back to cache ─────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  // Don't intercept Supabase or external API calls
  const url = new URL(event.request.url)
  if (!url.origin.includes(self.location.hostname)) return
  event.respondWith(
    fetch(event.request)
      .then(res => {
        // Cache successful page navigations only
        if (event.request.mode === 'navigate' && res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(event.request, clone))
        }
        return res
      })
      .catch(() => caches.match(event.request).then(r => r ?? caches.match('/')))
  )
})

// ── Push ─────────────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    data = { title: 'De Melo', body: event.data.text() }
  }

  const options = {
    body:    data.body  ?? '',
    icon:    '/apple-icon.png',
    badge:   '/apple-icon.png',
    tag:     data.tag   ?? 'demelo',
    renotify: true,
    data:    { url: data.url ?? '/' },
    vibrate: [100, 50, 100],
  }

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'De Melo', options)
  )
})

// ── Notification click ────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const targetUrl = event.notification.data?.url ?? '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Focus existing window if open
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      // Open new window
      if (clients.openWindow) return clients.openWindow(targetUrl)
    })
  )
})
